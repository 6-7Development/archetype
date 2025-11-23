/**
 * Project Configuration Service
 * Manages project-specific protection rules and configurations
 */

import { db } from '../db';
import { projectConfigs, projectApprovals } from '@shared/schema/project-config';
import { eq } from 'drizzle-orm';
import { DEFAULT_PROJECT_PROTECTION } from '@client/config/project-protection';

export interface ProjectConfigData {
  projectId: string;
  ownerId: string;
  customConfig?: Record<string, any>;
  protectedFiles?: string[];
  requireApprovalFor?: string[];
}

/**
 * Get or create project configuration
 */
export async function getProjectConfig(projectId: string) {
  let config = await db
    .select()
    .from(projectConfigs)
    .where(eq(projectConfigs.projectId, projectId))
    .limit(1);

  if (!config.length) {
    // Create default config
    await db.insert(projectConfigs).values({
      projectId,
      ownerId: '', // Will be set when project is created
      protectionSettings: DEFAULT_PROJECT_PROTECTION,
    });

    config = await db
      .select()
      .from(projectConfigs)
      .where(eq(projectConfigs.projectId, projectId))
      .limit(1);
  }

  return config[0];
}

/**
 * Update project configuration
 */
export async function updateProjectConfig(
  projectId: string,
  updates: Partial<ProjectConfigData>
) {
  const config = await getProjectConfig(projectId);

  return await db
    .update(projectConfigs)
    .set({
      customConfig: updates.customConfig || config.customConfig,
      protectedFiles: updates.protectedFiles || config.protectedFiles,
      requireApprovalFor: updates.requireApprovalFor || config.requireApprovalFor,
      updatedAt: new Date(),
    })
    .where(eq(projectConfigs.projectId, projectId));
}

/**
 * Check if file requires approval
 */
export async function fileRequiresApproval(
  projectId: string,
  filePath: string
): Promise<boolean> {
  const config = await getProjectConfig(projectId);
  const protection = config.protectionSettings as any;

  // Check if in critical files
  if (config.protectedFiles?.includes(filePath)) {
    return true;
  }

  // Check if matches critical patterns
  if (protection?.critical) {
    return protection.critical.some((pattern: string) => {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      return regex.test(filePath);
    });
  }

  return false;
}

/**
 * Create approval request for project change
 */
export async function createApprovalRequest(data: {
  projectId: string;
  requestedBy: string;
  operation: string;
  filePath?: string;
  description: string;
  reason?: string;
  changeBefore?: any;
  changeAfter?: any;
}) {
  const id = `proj_approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(projectApprovals).values({
    id,
    projectId: data.projectId,
    requestedBy: data.requestedBy,
    operation: data.operation,
    filePath: data.filePath,
    description: data.description,
    reason: data.reason,
    changeBefore: data.changeBefore,
    changeAfter: data.changeAfter,
  });

  return id;
}

/**
 * Get pending approvals for a project
 */
export async function getPendingApprovals(projectId: string) {
  return await db
    .select()
    .from(projectApprovals)
    .where(eq(projectApprovals.projectId, projectId))
    .where(eq(projectApprovals.status, 'pending'));
}

/**
 * Approve a project change
 */
export async function approveChange(
  approvalId: string,
  approvedBy: string,
  reason?: string
) {
  return await db
    .update(projectApprovals)
    .set({
      status: 'approved',
      approvedBy,
      approvalReason: reason,
      respondedAt: new Date(),
    })
    .where(eq(projectApprovals.id, approvalId));
}

/**
 * Reject a project change
 */
export async function rejectChange(
  approvalId: string,
  rejectedBy: string,
  reason?: string
) {
  return await db
    .update(projectApprovals)
    .set({
      status: 'rejected',
      approvedBy: rejectedBy,
      approvalReason: reason,
      respondedAt: new Date(),
    })
    .where(eq(projectApprovals.id, approvalId));
}

/**
 * Add to audit trail
 */
export async function logProjectChange(
  projectId: string,
  change: {
    action: string;
    filePath?: string;
    userId: string;
    timestamp: Date;
    before?: any;
    after?: any;
    approved: boolean;
  }
) {
  const config = await getProjectConfig(projectId);
  const auditTrail = (config.auditTrail as any[]) || [];

  auditTrail.push(change);

  // Keep only last 1000 entries
  if (auditTrail.length > 1000) {
    auditTrail.shift();
  }

  return await db
    .update(projectConfigs)
    .set({ auditTrail })
    .where(eq(projectConfigs.projectId, projectId));
}
