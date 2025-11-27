/**
 * APPROVAL QUEUE - GAP #5 FIX
 * Queues destructive operations for user approval
 * Implements approval workflow for delete/reset/deploy operations
 */

interface ApprovalRequest {
  id: string;
  toolName: string;
  input: any;
  reason: string;
  createdAt: number;
  approved?: boolean;
  rejectedAt?: number;
  approvedAt?: number;
}

export class ApprovalQueue {
  private static queue: Map<string, ApprovalRequest> = new Map();
  private static requestCounter = 0;

  // Tools that require approval
  private static readonly DESTRUCTIVE_TOOLS = [
    'delete_project_file',
    'delete_platform_file',
    'write_project_file', // Only if overwriting
    'deployment_reset',
    'database_reset',
  ];

  /**
   * Check if tool requires approval
   */
  static requiresApproval(toolName: string, input?: any): { required: boolean; reason: string } {
    if (!this.DESTRUCTIVE_TOOLS.includes(toolName)) {
      return { required: false, reason: '' };
    }

    // Additional checks based on tool
    if (toolName === 'delete_project_file') {
      return { required: true, reason: 'Deleting files is irreversible' };
    }

    if (toolName === 'delete_platform_file') {
      return { required: true, reason: 'Deleting platform files affects all users' };
    }

    if (toolName === 'write_project_file' && input?.isOverwrite) {
      return { required: true, reason: 'Overwriting existing file - requires confirmation' };
    }

    if (toolName === 'deployment_reset') {
      return { required: true, reason: 'Resetting deployment is destructive' };
    }

    if (toolName === 'database_reset') {
      return { required: true, reason: 'Resetting database will delete all data' };
    }

    return { required: false, reason: '' };
  }

  /**
   * Request approval for a tool execution
   */
  static requestApproval(toolName: string, input: any): {
    id: string;
    reason: string;
    status: 'pending';
  } {
    const check = this.requiresApproval(toolName, input);
    if (!check.required) {
      throw new Error(`Tool ${toolName} does not require approval`);
    }

    const id = `approval-${++this.requestCounter}`;
    const request: ApprovalRequest = {
      id,
      toolName,
      input,
      reason: check.reason,
      createdAt: Date.now(),
    };

    this.queue.set(id, request);

    console.log(`🔒 [APPROVAL-QUEUE] Queued approval request ${id} for ${toolName}`);

    return {
      id,
      reason: check.reason,
      status: 'pending' as const,
    };
  }

  /**
   * Get pending approval requests
   */
  static getPending(): ApprovalRequest[] {
    return Array.from(this.queue.values()).filter((r) => r.approved === undefined);
  }

  /**
   * Approve a request
   */
  static approve(requestId: string): { approved: true; toolName: string; input: any } {
    const request = this.queue.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }

    request.approved = true;
    request.approvedAt = Date.now();

    console.log(`✅ [APPROVAL-QUEUE] Approved request ${requestId} for ${request.toolName}`);

    return {
      approved: true,
      toolName: request.toolName,
      input: request.input,
    };
  }

  /**
   * Reject a request
   */
  static reject(requestId: string): { rejected: true; reason: string } {
    const request = this.queue.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }

    request.approved = false;
    request.rejectedAt = Date.now();

    console.log(`❌ [APPROVAL-QUEUE] Rejected request ${requestId} for ${request.toolName}`);

    return {
      rejected: true,
      reason: `Destructive operation cancelled: ${request.toolName}`,
    };
  }

  /**
   * Check status of a request
   */
  static getStatus(requestId: string): ApprovalRequest | null {
    return this.queue.get(requestId) || null;
  }

  /**
   * Clean up old requests (older than 1 hour)
   */
  static cleanup(): number {
    const oneHourAgo = Date.now() - 3600000;
    let removed = 0;

    for (const [id, request] of this.queue.entries()) {
      if (request.createdAt < oneHourAgo) {
        this.queue.delete(id);
        removed++;
      }
    }

    console.log(`🧹 [APPROVAL-QUEUE] Cleaned up ${removed} old requests`);
    return removed;
  }
}
