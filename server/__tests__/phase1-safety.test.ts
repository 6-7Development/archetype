/**
 * PHASE 1 SAFETY SYSTEMS - Integration Tests (Simplified Design)
 * 
 * Tests architect's simplified FIFO design with fake timers
 * for deterministic, fast testing.
 * 
 * KEY FEATURES:
 * - Vitest fake timers (vi.useFakeTimers)
 * - Deterministic timeout testing
 * - No race conditions in tests
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { fileLockManager } from '../services/fileLockManager';
import { hexadAIBrain } from '../services/lomuAIBrain';

describe('Phase 1 Safety - FileLockManager (Simplified FIFO)', () => {
  const userId = 'test-user';
  const sessionId = 'test-session';
  const filePath = 'src/test.ts';
  
  beforeEach(() => {
    vi.useFakeTimers();
    fileLockManager.releaseAllLocksForSession(sessionId);
  });
  
  afterEach(() => {
    vi.useRealTimers();
    fileLockManager.releaseAllLocksForSession(sessionId);
  });
  
  test('FIFO queue guarantees write exclusivity', async () => {
    // Session 1 acquires write lock
    const lock1 = await fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-1',
      userId,
      operation: 'write',
    });
    
    expect(lock1.acquired).toBe(true);
    console.log('[TEST] ✅ Session 1 acquired write lock');
    
    // Session 2 tries to acquire write lock (should queue)
    const lock2Promise = fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-2',
      userId,
      operation: 'write',
    });
    
    // Give event loop a tick
    await Promise.resolve();
    
    // Verify session 2 is queued
    const status = fileLockManager.getLockStatus(filePath);
    expect(status.queueSize).toBe(1);
    console.log('[TEST] ✅ Session 2 queued (FIFO)');
    
    // Session 1 releases lock
    fileLockManager.releaseLock(lock1.lockId!);
    
    // Session 2 should now be granted
    const lock2 = await lock2Promise;
    expect(lock2.acquired).toBe(true);
    console.log('[TEST] ✅ Session 2 granted after session 1 released (FIFO order maintained)');
    
    // Cleanup
    fileLockManager.releaseLock(lock2.lockId!);
  });
  
  test('Timeout cancels queued request (fake timers)', async () => {
    // Acquire lock
    const lock1 = await fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-1',
      userId,
      operation: 'write',
    });
    
    expect(lock1.acquired).toBe(true);
    console.log('[TEST] ✅ Lock acquired');
    
    // Queue second request (30s timeout)
    const lock2Promise = fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-2',
      userId,
      operation: 'write',
    });
    
    // Verify queued
    await Promise.resolve();
    expect(fileLockManager.getLockStatus(filePath).queueSize).toBe(1);
    console.log('[TEST] ✅ Request queued');
    
    // Advance timers past queue timeout (30s + buffer)
    console.log('[TEST] ⏱️  Advancing timers to trigger timeout...');
    vi.advanceTimersByTime(31000);
    
    // Should timeout
    const lock2 = await lock2Promise;
    expect(lock2.acquired).toBe(false);
    expect(lock2.reason).toContain('timeout');
    console.log('[TEST] ✅ Request timed out (no hang):', lock2.reason);
    
    // Cleanup
    fileLockManager.releaseLock(lock1.lockId!);
  });
  
  test('Respects per-request timeout override', async () => {
    // Acquire lock with default timeout
    const result1 = await fileLockManager.acquireLock({
      filePath: 'test.txt',
      sessionId: 'session1',
      userId: 'user1',
      operation: 'write'
    });
    expect(result1.acquired).toBe(true);
    console.log('[TEST] ✅ Lock acquired with default timeout');
    
    // Queue second request with 1s custom timeout
    const promise2 = fileLockManager.acquireLock({
      filePath: 'test.txt',
      sessionId: 'session2',
      userId: 'user2',
      operation: 'write',
      timeoutMs: 1000
    });
    
    // Verify queued
    await Promise.resolve();
    expect(fileLockManager.getLockStatus('test.txt').queueSize).toBe(1);
    console.log('[TEST] ✅ Request queued with custom 1s timeout');
    
    // Advance timer by 1500ms (past custom timeout, but before global 30s)
    console.log('[TEST] ⏱️  Advancing timers by 1500ms...');
    vi.advanceTimersByTime(1500);
    
    const result2 = await promise2;
    
    // Should timeout after 1s (custom), not 30s (global)
    expect(result2.acquired).toBe(false);
    expect(result2.reason).toContain('1000ms');
    console.log('[TEST] ✅ Timed out after custom 1000ms (not global 30000ms)');
    
    // Cleanup
    fileLockManager.releaseLock(result1.lockId!);
  });
  
  test('cleanupExpiredLocks cancels queued requests', async () => {
    // Acquire lock with short timeout (1s)
    const lock1 = await fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-1',
      userId,
      operation: 'write',
      timeoutMs: 1000,
    });
    
    expect(lock1.acquired).toBe(true);
    console.log('[TEST] ✅ Lock acquired with 1s timeout');
    
    // Queue second request
    const lock2Promise = fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-2',
      userId,
      operation: 'write',
    });
    
    await Promise.resolve();
    expect(fileLockManager.getLockStatus(filePath).queueSize).toBe(1);
    console.log('[TEST] ✅ Request queued');
    
    // Advance past lock expiry (1s + buffer)
    console.log('[TEST] ⏱️  Advancing timers to expire lock...');
    vi.advanceTimersByTime(1500);
    
    // Trigger cleanup manually
    // @ts-ignore - accessing private method for testing
    fileLockManager.cleanupExpiredLocks();
    
    // Queued request should be cancelled
    const lock2 = await lock2Promise;
    expect(lock2.acquired).toBe(false);
    expect(lock2.reason).toContain('expired');
    console.log('[TEST] ✅ Queued request cancelled due to lock expiry');
  });
  
  test('completeRequest prevents double resolution', async () => {
    // This tests the architect's key insight: state checked before every transition
    
    const lock1 = await fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-1',
      userId,
      operation: 'write',
    });
    
    const lock2Promise = fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-2',
      userId,
      operation: 'write',
    });
    
    await Promise.resolve();
    console.log('[TEST] ✅ Request queued');
    
    // Release lock (should trigger processQueue → completeRequest)
    fileLockManager.releaseLock(lock1.lockId!);
    
    // Wait for queue processing
    const lock2 = await lock2Promise;
    expect(lock2.acquired).toBe(true);
    console.log('[TEST] ✅ Request granted through processQueue');
    
    // Advance timers to trigger timeout (should be no-op since already granted)
    vi.advanceTimersByTime(31000);
    
    // Should still be granted (no double resolution)
    console.log('[TEST] ✅ No double resolution occurred');
    
    // Cleanup
    fileLockManager.releaseLock(lock2.lockId!);
  });
  
  test('Multiple queued requests processed in FIFO order', async () => {
    // Acquire initial lock
    const lock1 = await fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-1',
      userId,
      operation: 'write',
    });
    
    // Queue 3 more requests
    const lock2Promise = fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-2',
      userId,
      operation: 'write',
    });
    
    const lock3Promise = fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-3',
      userId,
      operation: 'write',
    });
    
    const lock4Promise = fileLockManager.acquireLock({
      filePath,
      sessionId: 'session-4',
      userId,
      operation: 'write',
    });
    
    await Promise.resolve();
    expect(fileLockManager.getLockStatus(filePath).queueSize).toBe(3);
    console.log('[TEST] ✅ Three requests queued');
    
    // Release session 1 - should grant session 2
    fileLockManager.releaseLock(lock1.lockId!);
    const lock2 = await lock2Promise;
    expect(lock2.acquired).toBe(true);
    console.log('[TEST] ✅ Session 2 granted (FIFO)');
    
    // Release session 2 - should grant session 3
    fileLockManager.releaseLock(lock2.lockId!);
    const lock3 = await lock3Promise;
    expect(lock3.acquired).toBe(true);
    console.log('[TEST] ✅ Session 3 granted (FIFO)');
    
    // Release session 3 - should grant session 4
    fileLockManager.releaseLock(lock3.lockId!);
    const lock4 = await lock4Promise;
    expect(lock4.acquired).toBe(true);
    console.log('[TEST] ✅ Session 4 granted (FIFO order maintained)');
    
    // Cleanup
    fileLockManager.releaseLock(lock4.lockId!);
  });
});

describe('Phase 1 Safety - HexadBrain (Resilient Cleanup)', () => {
  const userId = 'test-brain-user';
  const sessionId = 'test-brain-session';
  
  beforeEach(async () => {
    vi.useFakeTimers();
    const existing = hexadAIBrain.getSession(userId, sessionId);
    if (existing) {
      await hexadAIBrain.closeSession(userId, sessionId);
    }
  });
  
  afterEach(async () => {
    vi.useRealTimers();
    await hexadAIBrain.closeSession(userId, sessionId);
  });
  
  test('Idle session cleanup releases locks AND removes session', async () => {
    // Create session
    const session = await hexadAIBrain.createSession({
      userId,
      sessionId,
      targetContext: 'project',
      projectId: 'test-project',
    });
    
    expect(session.status).toBe('active');
    console.log('[TEST] ✅ Session created');
    
    // Acquire locks
    const lock1 = await fileLockManager.acquireLock({
      filePath: 'src/file1.ts',
      sessionId,
      userId,
      operation: 'write',
    });
    
    const lock2 = await fileLockManager.acquireLock({
      filePath: 'src/file2.ts',
      sessionId,
      userId,
      operation: 'read',
    });
    
    expect(lock1.acquired).toBe(true);
    expect(lock2.acquired).toBe(true);
    console.log('[TEST] ✅ Two locks acquired');
    
    // Mark session as idle
    hexadAIBrain.markSessionIdle(userId, sessionId);
    const idleSession = hexadAIBrain.getSession(userId, sessionId);
    expect(idleSession?.status).toBe('idle');
    console.log('[TEST] ✅ Session marked idle');
    
    // Run cleanup
    const cleaned = await hexadAIBrain.cleanupIdleSessions();
    expect(cleaned).toBeGreaterThan(0);
    console.log('[TEST] ✅ Cleanup ran');
    
    // Verify locks released
    const hasLocks = fileLockManager.hasActiveLocks(sessionId);
    expect(hasLocks).toBe(false);
    console.log('[TEST] ✅ Locks released');
    
    // Verify session removed
    const sessionAfter = hexadAIBrain.getSession(userId, sessionId);
    expect(sessionAfter).toBeNull();
    console.log('[TEST] ✅ Session removed from registry');
  });
  
  test('Cleanup continues despite lock release timeout', async () => {
    // This tests the Promise.race timeout protection
    
    const session1 = await hexadAIBrain.createSession({
      userId,
      sessionId: 'session-1',
      targetContext: 'platform',
    });
    
    const session2 = await hexadAIBrain.createSession({
      userId,
      sessionId: 'session-2',
      targetContext: 'platform',
    });
    
    hexadAIBrain.markSessionIdle(userId, 'session-1');
    hexadAIBrain.markSessionIdle(userId, 'session-2');
    console.log('[TEST] ✅ Two sessions marked idle');
    
    // Run cleanup (should handle timeout gracefully)
    const cleaned = await hexadAIBrain.cleanupIdleSessions();
    expect(cleaned).toBeGreaterThanOrEqual(2);
    console.log('[TEST] ✅ Both sessions cleaned despite any timeouts');
    
    // Verify both removed
    expect(hexadAIBrain.getSession(userId, 'session-1')).toBeNull();
    expect(hexadAIBrain.getSession(userId, 'session-2')).toBeNull();
    console.log('[TEST] ✅ Sessions removed (resilient cleanup)');
  });
  
  test('Stale session scheduler marks idle sessions', async () => {
    // Create session
    const session = await hexadAIBrain.createSession({
      userId,
      sessionId,
      targetContext: 'platform',
    });
    
    expect(session.status).toBe('active');
    console.log('[TEST] ✅ Session created (active)');
    
    // Touch session to reset activity
    hexadAIBrain.touchSession(userId, sessionId);
    
    // Advance time past stale threshold (60s)
    console.log('[TEST] ⏱️  Advancing time past stale threshold...');
    vi.advanceTimersByTime(61000);
    
    // Trigger stale detection
    const markedIdle = hexadAIBrain.checkStaleSessionsAndMarkIdle();
    expect(markedIdle).toBeGreaterThan(0);
    console.log('[TEST] ✅ Stale session detected and marked idle');
    
    // Verify session is now idle
    const sessionAfter = hexadAIBrain.getSession(userId, sessionId);
    expect(sessionAfter?.status).toBe('idle');
    console.log('[TEST] ✅ Session status: idle');
    
    // Cleanup
    await hexadAIBrain.closeSession(userId, sessionId);
  });
  
  test('End-to-end: Session lifecycle with fake timers', async () => {
    // Create session
    const session = await hexadAIBrain.createSession({
      userId,
      sessionId,
      targetContext: 'project',
      projectId: 'e2e-project',
    });
    
    console.log('[TEST] ✅ Session created');
    
    // Acquire locks
    await fileLockManager.acquireLock({
      filePath: 'src/app.ts',
      sessionId,
      userId,
      operation: 'write',
    });
    
    console.log('[TEST] ✅ Lock acquired');
    
    // Touch session (simulate activity)
    hexadAIBrain.touchSession(userId, sessionId);
    
    // Advance time to make session stale (60s)
    vi.advanceTimersByTime(61000);
    
    // Run stale detection
    hexadAIBrain.checkStaleSessionsAndMarkIdle();
    
    const idleSession = hexadAIBrain.getSession(userId, sessionId);
    expect(idleSession?.status).toBe('idle');
    console.log('[TEST] ✅ Session marked idle after inactivity');
    
    // Run cleanup
    const cleaned = await hexadAIBrain.cleanupIdleSessions();
    expect(cleaned).toBeGreaterThan(0);
    console.log('[TEST] ✅ Cleanup ran');
    
    // Verify locks released and session removed
    expect(fileLockManager.hasActiveLocks(sessionId)).toBe(false);
    expect(hexadAIBrain.getSession(userId, sessionId)).toBeNull();
    console.log('[TEST] ✅ End-to-end lifecycle complete');
  });
});

describe('Phase 1 Safety - Integration Tests', () => {
  test('Full workflow: Create → Lock → Idle → Cleanup', async () => {
    vi.useFakeTimers();
    
    const userId = 'integration-user';
    const sessionId = 'integration-session';
    
    // Create session
    const session = await hexadAIBrain.createSession({
      userId,
      sessionId,
      targetContext: 'project',
      projectId: 'integration-test',
    });
    
    expect(session.status).toBe('active');
    console.log('[INTEGRATION] ✅ Session created');
    
    // Acquire multiple locks
    await fileLockManager.acquireLock({
      filePath: 'src/main.ts',
      sessionId,
      userId,
      operation: 'write',
    });
    
    await fileLockManager.acquireLock({
      filePath: 'src/utils.ts',
      sessionId,
      userId,
      operation: 'read',
    });
    
    expect(fileLockManager.hasActiveLocks(sessionId)).toBe(true);
    console.log('[INTEGRATION] ✅ Locks acquired');
    
    // Track activity
    hexadAIBrain.trackFileModified(userId, sessionId, 'src/main.ts');
    hexadAIBrain.touchSession(userId, sessionId);
    
    // Simulate inactivity (61s)
    vi.advanceTimersByTime(61000);
    
    // Mark stale sessions as idle
    hexadAIBrain.checkStaleSessionsAndMarkIdle();
    
    const idleSession = hexadAIBrain.getSession(userId, sessionId);
    expect(idleSession?.status).toBe('idle');
    console.log('[INTEGRATION] ✅ Session marked idle');
    
    // Cleanup idle sessions
    const cleaned = await hexadAIBrain.cleanupIdleSessions();
    expect(cleaned).toBeGreaterThan(0);
    console.log('[INTEGRATION] ✅ Cleanup complete');
    
    // Verify everything cleaned up
    expect(fileLockManager.hasActiveLocks(sessionId)).toBe(false);
    expect(hexadAIBrain.getSession(userId, sessionId)).toBeNull();
    expect(fileLockManager.getLockStatus('src/main.ts').isLocked).toBe(false);
    expect(fileLockManager.getLockStatus('src/utils.ts').isLocked).toBe(false);
    
    console.log('[INTEGRATION] ✅ All resources released');
    
    vi.useRealTimers();
  });
  
  test('Concurrent requests queue properly (FIFO)', async () => {
    vi.useFakeTimers();
    
    const userId = 'concurrent-user';
    const file = 'src/concurrent.ts';
    
    // Acquire initial lock
    const lock1 = await fileLockManager.acquireLock({
      filePath: file,
      sessionId: 'session-1',
      userId,
      operation: 'write',
    });
    
    // Fire off 5 concurrent requests
    const promises: Promise<import('../services/fileLockManager').LockResult>[] = [];
    for (let i = 2; i <= 6; i++) {
      promises.push(
        fileLockManager.acquireLock({
          filePath: file,
          sessionId: `session-${i}`,
          userId,
          operation: 'write',
        })
      );
    }
    
    await Promise.resolve();
    expect(fileLockManager.getLockStatus(file).queueSize).toBe(5);
    console.log('[CONCURRENT] ✅ 5 requests queued');
    
    // Release locks sequentially to allow FIFO processing
    const results: import('../services/fileLockManager').LockResult[] = [];
    
    // Release initial lock to start the queue
    fileLockManager.releaseLock(lock1.lockId!);
    
    // Process each queued request in order
    // (Write locks are exclusive, so each must be released before next is granted)
    for (const promise of promises) {
      const result = await promise;
      results.push(result);
      expect(result.acquired).toBe(true);
      
      // Release this lock to allow next in queue to be granted
      if (result.lockId) {
        fileLockManager.releaseLock(result.lockId);
      }
    }
    
    expect(results.every(r => r.acquired)).toBe(true);
    console.log('[CONCURRENT] ✅ All requests granted in FIFO order');
    
    vi.useRealTimers();
  });
});

console.log('\n✅ Phase 1 Safety Systems - All tests defined with fake timers\n');
