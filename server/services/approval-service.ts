/**
 * Approval Service - Manages owner approvals for sensitive operations
 * Tracks all approvals in audit log for compliance
 */

import { db } from '../db';
import { auditLogs } from '@shared/schema';
import { sql } from 'drizzle-orm';

export interface ApprovalRequest {
  operation: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ApprovalRecord {
  id: string;
  operation: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Sensitive operations that require approval
const SENSITIVE_OPERATIONS = [
  'DELETE_USER',
  'DELETE_PROJECT',
  'DELETE_DEPLOYMENT',
  'DATABASE_MIGRATION',
  'ENVIRONMENT_VAR_CHANGE',
  'RATE_LIMIT_INCREASE',
  'DISABLE_FEATURE',
  'MODIFY_AUTH_STRATEGY',
  'PLATFORM_HEALING_TRIGGER',
  'DATA_EXPORT',
  'DATA_IMPORT',
  'CONFIGURATION_OVERRIDE',
] as const;

/**
 * Check if operation requires approval
 */
export function requiresApproval(operation: string): boolean {
  return SENSITIVE_OPERATIONS.includes(operation as any);
}

/**
 * Log operation in audit trail
 */
export async function logOperation(
  operation: string,
  resourceType: string,
  resourceId: string,
  userId: string,
  changeBefore?: any,
  changeAfter?: any,
  reason?: string
) {
  try {
    await db.insert(auditLogs).values({
      operation,
      resourceType,
      resourceId,
      userId,
      changeBefore: changeBefore ? JSON.stringify(changeBefore) : null,
      changeAfter: changeAfter ? JSON.stringify(changeAfter) : null,
      reason,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[AUDIT-LOG] Failed to log operation:', error);
    // Don't throw - audit logging should not block operations
  }
}

/**
 * Create approval request
 */
export async function createApprovalRequest(
  request: ApprovalRequest
): Promise<ApprovalRecord> {
  const id = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const record: ApprovalRecord = {
    id,
    operation: request.operation,
    resourceType: request.resourceType,
    resourceId: request.resourceId,
    userId: request.userId,
    reason: request.reason,
    status: 'pending',
    metadata: request.metadata,
    createdAt: new Date(),
  };

  // Store in memory for now (can be extended to database)
  approvalRequests.set(id, record);

  return record;
}

/**
 * Approve a request (owner only)
 */
export async function approveRequest(
  requestId: string,
  ownerId: string,
  reason?: string
): Promise<ApprovalRecord> {
  const request = approvalRequests.get(requestId);
  if (!request) {
    throw new Error('Approval request not found');
  }

  const updated: ApprovalRecord = {
    ...request,
    status: 'approved',
    approvedBy: ownerId,
    approvedAt: new Date(),
  };

  approvalRequests.set(requestId, updated);

  // Log in audit trail
  await logOperation(
    `${request.operation}_APPROVED`,
    request.resourceType,
    request.resourceId,
    request.userId,
    null,
    updated,
    `Approved by owner: ${reason || 'No reason provided'}`
  );

  return updated;
}

/**
 * Reject a request (owner only)
 */
export async function rejectRequest(
  requestId: string,
  ownerId: string,
  reason?: string
): Promise<ApprovalRecord> {
  const request = approvalRequests.get(requestId);
  if (!request) {
    throw new Error('Approval request not found');
  }

  const updated: ApprovalRecord = {
    ...request,
    status: 'rejected',
    approvedBy: ownerId,
  };

  approvalRequests.set(requestId, updated);

  // Log in audit trail
  await logOperation(
    `${request.operation}_REJECTED`,
    request.resourceType,
    request.resourceId,
    request.userId,
    null,
    null,
    `Rejected by owner: ${reason || 'No reason provided'}`
  );

  return updated;
}

/**
 * Get pending approvals for owner
 */
export function getPendingApprovals(): ApprovalRecord[] {
  return Array.from(approvalRequests.values()).filter(r => r.status === 'pending');
}

/**
 * Get approval request status
 */
export function getApprovalStatus(requestId: string): ApprovalRecord | null {
  return approvalRequests.get(requestId) || null;
}

/**
 * In-memory storage (can be replaced with database)
 */
const approvalRequests = new Map<string, ApprovalRecord>();

// Cleanup old approval requests after 24 hours
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [id, record] of approvalRequests.entries()) {
    if (now - record.createdAt.getTime() > maxAge) {
      approvalRequests.delete(id);
    }
  }
}, 60 * 60 * 1000); // Check every hour
