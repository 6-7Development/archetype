/**
 * FILE LOCK MANAGER - Phase 1 Safety (Simplified FIFO Design)
 * 
 * ARCHITECT'S SIMPLIFIED DESIGN:
 * - Single completeRequest() helper for ALL state transitions
 * - Immediate dequeue semantics (resolve once, clear timers, remove from map)
 * - FIFO queue processing with explicit state tracking
 * 
 * STATE TRANSITIONS (all go through completeRequest):
 * - pending → granted   (lock available)
 * - pending → timeout   (queue timeout expired)
 * - pending → cancelled (lock expired while queued)
 * 
 * CRITICAL: No double resolutions - state checked before every transition
 */

import { nanoid } from 'nanoid';

export interface FileLock {
  lockId: string;
  filePath: string;
  sessionId: string;
  userId: string;
  acquiredAt: Date;
  expiresAt: Date;
  operation: 'read' | 'write';
}

export interface LockRequest {
  filePath: string;
  sessionId: string;
  userId: string;
  operation: 'read' | 'write';
  timeoutMs?: number;
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  reason?: string;
  lockedBy?: {
    sessionId: string;
    userId: string;
    acquiredAt: Date;
  };
}

/**
 * SIMPLIFIED QUEUE ENTRY:
 * - request: The lock request details
 * - resolve/reject: Promise handlers
 * - timer: Timeout timer (cleared in completeRequest)
 * - state: Current state (prevents double resolution)
 */
interface QueueEntry {
  requestId: string;
  request: LockRequest;
  resolve: (result: LockResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout | null;
  state: 'pending' | 'granted' | 'timeout' | 'cancelled';
  queuedAt: Date;
}

class FileLockManager {
  // Active locks: Map<filePath, FileLock[]>
  private locks: Map<string, FileLock[]> = new Map();
  
  // Queue: Map<filePath, QueueEntry[]>
  private queue: Map<string, QueueEntry[]> = new Map();
  
  private readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly QUEUE_TIMEOUT_MS = 30 * 1000; // 30 seconds
  
  constructor() {
    // Cleanup expired locks every 30 seconds
    setInterval(() => this.cleanupExpiredLocks(), 30000);
    console.log('[FILE-LOCK] Initialized - Phase 1 Safety (Simplified FIFO)');
  }
  
  /**
   * ACQUIRE LOCK (FIFO Queue)
   * If available → grant immediately
   * If blocked → enqueue with timeout timer
   */
  async acquireLock(request: LockRequest): Promise<LockResult> {
    const { filePath, sessionId, userId, operation, timeoutMs } = request;
    const normalizedPath = this.normalizePath(filePath);
    
    console.log(`[FILE-LOCK] Request: ${operation} on ${normalizedPath} by ${sessionId}`);
    
    // Try immediate grant
    if (this.canAcquireLock(normalizedPath, operation, sessionId)) {
      return this.grantLock(normalizedPath, sessionId, userId, operation, timeoutMs);
    }
    
    // Enqueue with timeout
    const requestId = nanoid();
    console.log(`[FILE-LOCK] Queuing ${requestId} for ${normalizedPath}`);
    
    return new Promise((resolve, reject) => {
      // Create queue entry
      const entry: QueueEntry = {
        requestId,
        request,
        resolve,
        reject,
        timer: null,
        state: 'pending',
        queuedAt: new Date(),
      };
      
      // Set timeout timer (calls completeRequest on expiry)
      const effectiveTimeout = request.timeoutMs || this.QUEUE_TIMEOUT_MS;
      entry.timer = setTimeout(() => {
        this.completeRequest(entry, 'timeout', {
          acquired: false,
          reason: `Lock acquisition timeout after ${effectiveTimeout}ms`,
          lockedBy: this.getCurrentLockOwner(normalizedPath),
        });
      }, effectiveTimeout);
      
      // Add to queue
      if (!this.queue.has(normalizedPath)) {
        this.queue.set(normalizedPath, []);
      }
      this.queue.get(normalizedPath)!.push(entry);
      
      console.log(`[FILE-LOCK] Queued ${requestId} (queue size: ${this.queue.get(normalizedPath)!.length})`);
    });
  }
  
  /**
   * RELEASE LOCK
   * Remove lock, then process queue to grant next pending request
   */
  releaseLock(lockId: string): boolean {
    console.log(`[FILE-LOCK] Releasing ${lockId}`);
    
    for (const [filePath, fileLocks] of this.locks.entries()) {
      const index = fileLocks.findIndex(l => l.lockId === lockId);
      
      if (index !== -1) {
        const lock = fileLocks[index];
        fileLocks.splice(index, 1);
        
        if (fileLocks.length === 0) {
          this.locks.delete(filePath);
        }
        
        console.log(`[FILE-LOCK] Released ${lock.operation} on ${filePath}`);
        
        // Process queue (FIFO)
        this.processQueue(filePath);
        
        return true;
      }
    }
    
    console.warn(`[FILE-LOCK] Lock ${lockId} not found`);
    return false;
  }
  
  /**
   * RELEASE ALL LOCKS FOR SESSION
   * Cleanup on session close/crash
   */
  releaseAllLocksForSession(sessionId: string): number {
    console.log(`[FILE-LOCK] Releasing all locks for ${sessionId}`);
    
    const lockIds: string[] = [];
    
    for (const fileLocks of this.locks.values()) {
      for (const lock of fileLocks) {
        if (lock.sessionId === sessionId) {
          lockIds.push(lock.lockId);
        }
      }
    }
    
    for (const lockId of lockIds) {
      this.releaseLock(lockId);
    }
    
    console.log(`[FILE-LOCK] Released ${lockIds.length} locks for ${sessionId}`);
    return lockIds.length;
  }
  
  /**
   * GET LOCK STATUS
   */
  getLockStatus(filePath: string): {
    isLocked: boolean;
    locks: FileLock[];
    queueSize: number;
  } {
    const normalized = this.normalizePath(filePath);
    const locks = this.locks.get(normalized) || [];
    const queueSize = this.queue.get(normalized)?.length || 0;
    
    return {
      isLocked: locks.length > 0,
      locks: [...locks],
      queueSize,
    };
  }
  
  /**
   * CHECK IF SESSION HAS LOCKS
   */
  hasActiveLocks(sessionId: string): boolean {
    for (const fileLocks of this.locks.values()) {
      if (fileLocks.some(lock => lock.sessionId === sessionId)) {
        return true;
      }
    }
    return false;
  }
  
  // ============================================================================
  // PRIVATE: STATE TRANSITION HELPERS
  // ============================================================================
  
  /**
   * COMPLETE REQUEST (Centralized State Transition)
   * 
   * ARCHITECT'S KEY INSIGHT:
   * ALL state transitions go through this single method to ensure:
   * 1. No double resolutions (state checked first)
   * 2. Timer always cleared
   * 3. Promise always resolved exactly once
   * 4. Entry immediately removed from queue
   * 
   * Called by:
   * - Timeout timer (→ timeout)
   * - processQueue (→ granted)
   * - cleanupExpiredLocks (→ cancelled)
   */
  private completeRequest(
    entry: QueueEntry,
    newState: 'granted' | 'timeout' | 'cancelled',
    result: LockResult
  ): void {
    // CRITICAL: Check if already completed
    if (entry.state !== 'pending') {
      console.log(`[FILE-LOCK] Entry ${entry.requestId} already ${entry.state} - skipping transition to ${newState}`);
      return;
    }
    
    // State transition
    entry.state = newState;
    
    // Clear timeout timer
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    
    // Resolve promise
    entry.resolve(result);
    
    // Immediate dequeue
    this.dequeueEntry(entry.requestId, this.normalizePath(entry.request.filePath));
    
    console.log(`[FILE-LOCK] ✅ Completed ${entry.requestId} → ${newState}`);
  }
  
  /**
   * PROCESS QUEUE (FIFO)
   * Try to grant locks to pending requests in order
   * Stop at first blocked request (maintains FIFO order)
   */
  private processQueue(filePath: string): void {
    const queue = this.queue.get(filePath);
    if (!queue || queue.length === 0) return;
    
    console.log(`[FILE-LOCK] Processing queue for ${filePath} (${queue.length} waiting)`);
    
    let granted = 0;
    
    // FIFO: Process from head until blocked
    while (queue.length > 0) {
      const entry = queue[0];
      
      // Skip non-pending (already completed)
      if (entry.state !== 'pending') {
        this.dequeueEntry(entry.requestId, filePath);
        continue;
      }
      
      // Try to acquire
      const { operation, sessionId } = entry.request;
      
      if (this.canAcquireLock(filePath, operation, sessionId)) {
        // Grant lock
        const lockResult = this.grantLock(
          filePath,
          sessionId,
          entry.request.userId,
          operation,
          entry.request.timeoutMs
        );
        
        // Complete request (state: pending → granted)
        this.completeRequest(entry, 'granted', lockResult);
        granted++;
      } else {
        // Blocked - stop processing (FIFO order)
        break;
      }
    }
    
    if (granted > 0) {
      console.log(`[FILE-LOCK] Granted ${granted} queued locks for ${filePath}`);
    }
  }
  
  /**
   * CLEANUP EXPIRED LOCKS
   * Release expired locks, cancel queued requests
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let expired = 0;
    const affectedFiles: string[] = [];
    
    // Remove expired locks
    for (const [filePath, fileLocks] of this.locks.entries()) {
      const validLocks = fileLocks.filter(lock => {
        const isExpired = lock.expiresAt.getTime() < now;
        if (isExpired) {
          console.log(`[FILE-LOCK] Expired: ${lock.lockId} on ${filePath}`);
          expired++;
          affectedFiles.push(filePath);
        }
        return !isExpired;
      });
      
      if (validLocks.length > 0) {
        this.locks.set(filePath, validLocks);
      } else {
        this.locks.delete(filePath);
      }
    }
    
    if (expired > 0) {
      console.log(`[FILE-LOCK] Cleaned ${expired} expired locks`);
    }
    
    // Cancel queued requests for affected files
    for (const filePath of affectedFiles) {
      const queue = this.queue.get(filePath);
      if (queue) {
        for (const entry of queue) {
          if (entry.state === 'pending') {
            this.completeRequest(entry, 'cancelled', {
              acquired: false,
              reason: 'Lock expired while request was queued',
            });
          }
        }
      }
      
      // Now process remaining requests
      this.processQueue(filePath);
    }
  }
  
  /**
   * DEQUEUE ENTRY
   * Remove entry from queue array and clean up map
   */
  private dequeueEntry(requestId: string, filePath: string): void {
    const queue = this.queue.get(filePath);
    if (!queue) return;
    
    const index = queue.findIndex(e => e.requestId === requestId);
    if (index !== -1) {
      queue.splice(index, 1);
      console.log(`[FILE-LOCK] Dequeued ${requestId}`);
    }
    
    // Clean up empty queue
    if (queue.length === 0) {
      this.queue.delete(filePath);
    }
  }
  
  // ============================================================================
  // PRIVATE: LOCK MANAGEMENT
  // ============================================================================
  
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/\/$/, '');
  }
  
  private canAcquireLock(filePath: string, operation: 'read' | 'write', sessionId: string): boolean {
    const locks = this.locks.get(filePath) || [];
    
    if (locks.length === 0) return true;
    
    if (operation === 'read') {
      // Read: OK if no write locks
      return !locks.some(l => l.operation === 'write');
    } else {
      // Write: Exclusive (OK only if same session)
      return locks.every(l => l.sessionId === sessionId);
    }
  }
  
  private grantLock(
    filePath: string,
    sessionId: string,
    userId: string,
    operation: 'read' | 'write',
    timeoutMs?: number
  ): LockResult {
    const lockId = nanoid();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (timeoutMs || this.LOCK_TIMEOUT_MS));
    
    const lock: FileLock = {
      lockId,
      filePath,
      sessionId,
      userId,
      acquiredAt: now,
      expiresAt,
      operation,
    };
    
    if (!this.locks.has(filePath)) {
      this.locks.set(filePath, []);
    }
    
    this.locks.get(filePath)!.push(lock);
    
    console.log(`[FILE-LOCK] ✅ Granted ${operation} ${lockId} on ${filePath} to ${sessionId}`);
    
    return {
      acquired: true,
      lockId,
    };
  }
  
  private getCurrentLockOwner(filePath: string): {
    sessionId: string;
    userId: string;
    acquiredAt: Date;
  } | undefined {
    const locks = this.locks.get(filePath);
    if (!locks || locks.length === 0) return undefined;
    
    const first = locks[0];
    return {
      sessionId: first.sessionId,
      userId: first.userId,
      acquiredAt: first.acquiredAt,
    };
  }
}

// Singleton export
export const fileLockManager = new FileLockManager();
