/**
 * Approval Manager Service
 * 
 * Manages user approvals for file modifications via EventEmitter.
 * When BeeHiveAI wants to modify files, it:
 * 1. Registers approval request via requestApproval()
 * 2. Waits for user response (blocks execution)
 * 3. User approves/rejects via frontend → POST /api/approve/:messageId
 * 4. EventEmitter resolves the Promise and execution continues
 * 
 * This replaces the placeholder in lomuChat/utils.ts
 */

import { EventEmitter } from 'events';
import type { WebSocketServer } from 'ws';
import { broadcastToUser } from '../routes/websocket';

interface ApprovalRequest {
  messageId: string;
  userId: string;
  operation: string;
  files: string[];
  timestamp: Date;
  resolve: (approved: boolean) => void;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Global approval manager using EventEmitter pattern
 */
class ApprovalManager extends EventEmitter {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private wss: WebSocketServer | null = null;
  
  /**
   * Set WebSocket server for broadcasting approval requests
   */
  setWebSocketServer(wss: WebSocketServer) {
    this.wss = wss;
    console.log('[APPROVAL-MANAGER] WebSocket server connected');
  }
  
  /**
   * Request approval for file modifications
   * 
   * 🔧 BUG FIX: Now handles offline users by checking broadcastToUser return value.
   * If no active WebSocket clients are found, immediately rejects instead of stalling.
   * 
   * @param messageId - Unique message ID for this approval
   * @param userId - User ID who needs to approve
   * @param operation - Description of operation (e.g., "modify 3 files")
   * @param files - Array of file paths being modified
   * @param timeoutMs - Timeout in milliseconds (default: 5 minutes)
   * @returns Promise that resolves to true (approved) or false (rejected)
   */
  async requestApproval(
    messageId: string,
    userId: string,
    operation: string,
    files: string[],
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<boolean> {
    console.log(`[APPROVAL-MANAGER] Requesting approval for ${messageId}: ${operation}`);
    
    // Check if already pending
    if (this.pendingApprovals.has(messageId)) {
      console.warn(`[APPROVAL-MANAGER] Approval already pending for ${messageId}`);
      return false;
    }
    
    return new Promise<boolean>((resolve) => {
      // Set timeout to auto-reject after timeoutMs
      const timeoutId = setTimeout(() => {
        console.warn(`[APPROVAL-MANAGER] ⏰ Approval timeout for ${messageId} - auto-rejecting`);
        this.pendingApprovals.delete(messageId);
        resolve(false);
      }, timeoutMs);
      
      // Store approval request
      const request: ApprovalRequest = {
        messageId,
        userId,
        operation,
        files,
        timestamp: new Date(),
        resolve,
        timeoutId,
      };
      
      this.pendingApprovals.set(messageId, request);
      
      // Broadcast approval request to user via WebSocket
      if (!this.wss) {
        console.error('[APPROVAL-MANAGER] ❌ No WebSocket server available - cannot request approval');
        clearTimeout(timeoutId);
        this.pendingApprovals.delete(messageId);
        resolve(false);
        return;
      }
      
      // 🔧 BUG FIX: Check if broadcast was successful (user has active connection)
      const delivered = broadcastToUser(this.wss, userId, {
        type: 'approval_request',
        messageId,
        operation,
        files,
        timestamp: new Date().toISOString(),
      });
      
      // Handle offline user - reject immediately instead of stalling
      if (!delivered) {
        console.error(
          `[APPROVAL-MANAGER] ❌ User ${userId} has no active WebSocket connection - ` +
          `cannot request approval for ${messageId}`
        );
        console.error('[APPROVAL-MANAGER] Auto-rejecting approval request due to offline user');
        clearTimeout(timeoutId);
        this.pendingApprovals.delete(messageId);
        resolve(false);
        return;
      }
      
      console.log(`[APPROVAL-MANAGER] ✅ Approval request broadcasted successfully to user ${userId}`);
    });
  }
  
  /**
   * Approve pending request
   * Called from POST /api/approve/:messageId endpoint
   */
  approve(messageId: string): boolean {
    const request = this.pendingApprovals.get(messageId);
    
    if (!request) {
      console.warn(`[APPROVAL-MANAGER] No pending approval for ${messageId}`);
      return false;
    }
    
    // Clear timeout
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }
    
    console.log(`[APPROVAL-MANAGER] ✅ Approved: ${messageId}`);
    
    // Resolve with approval
    request.resolve(true);
    
    // Cleanup
    this.pendingApprovals.delete(messageId);
    
    return true;
  }
  
  /**
   * Reject pending request
   * Called from POST /api/reject/:messageId endpoint
   */
  reject(messageId: string): boolean {
    const request = this.pendingApprovals.get(messageId);
    
    if (!request) {
      console.warn(`[APPROVAL-MANAGER] No pending approval for ${messageId}`);
      return false;
    }
    
    // Clear timeout
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }
    
    console.log(`[APPROVAL-MANAGER] ❌ Rejected: ${messageId}`);
    
    // Resolve with rejection
    request.resolve(false);
    
    // Cleanup
    this.pendingApprovals.delete(messageId);
    
    return true;
  }
  
  /**
   * Get pending approval requests for a user
   */
  getPendingForUser(userId: string): Array<Omit<ApprovalRequest, 'resolve' | 'timeoutId'>> {
    const pending = Array.from(this.pendingApprovals.values())
      .filter(req => req.userId === userId)
      .map(({ messageId, userId, operation, files, timestamp }) => ({
        messageId,
        userId,
        operation,
        files,
        timestamp,
      }));
    
    return pending;
  }
  
  /**
   * Get approval status by ID (GAP #5 FIX)
   * Enables client-side polling for approval status changes
   */
  getApprovalStatus(approvalId: string): {
    status: 'pending' | 'approved' | 'rejected' | 'not_found';
    toolName?: string;
    createdAt?: Date;
    resolvedAt?: Date;
  } | null {
    const request = this.pendingApprovals.get(approvalId);
    
    if (!request) {
      // Check if it was recently resolved (we could track resolved approvals)
      return null;
    }
    
    return {
      status: 'pending',
      toolName: request.operation,
      createdAt: request.timestamp,
    };
  }
  
  /**
   * Cancel all pending approvals (cleanup on shutdown)
   */
  cancelAll(): void {
    console.log(`[APPROVAL-MANAGER] Cancelling ${this.pendingApprovals.size} pending approvals`);
    
    for (const [messageId, request] of this.pendingApprovals.entries()) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.resolve(false);
    }
    
    this.pendingApprovals.clear();
  }
}

// Export singleton instance
export const approvalManager = new ApprovalManager();

/**
 * Convenience function to replace placeholder in utils.ts
 */
export async function waitForApproval(
  messageId: string,
  userId: string,
  operation: string,
  files: string[]
): Promise<boolean> {
  return approvalManager.requestApproval(messageId, userId, operation, files);
}
