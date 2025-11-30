/**
 * Project Change Validator
 * Validates that BeeHiveAI/users can only make changes allowed by project protection settings
 * Blocks changes to critical files, creates approval requests for sensitive operations
 */

import { getProjectConfig, fileRequiresApproval, createApprovalRequest } from './project-config-service';
import { getFileProtectionStatus } from '@client/config/project-protection';

export interface FileChange {
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  content?: string;
  userId: string;
  reason?: string;
}

export interface ValidationResult {
  allowed: boolean;
  requiresApproval: boolean;
  approvalId?: string;
  reason?: string;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Validate a file change against project protection rules
 */
export async function validateFileChange(
  projectId: string,
  change: FileChange
): Promise<ValidationResult> {
  try {
    const config = await getProjectConfig(projectId);
    const protection = config.protectionSettings as any;

    // Get protection status
    const status = getFileProtectionStatus(change.filePath, protection);

    // CRITICAL files cannot be modified at all
    if (status === 'critical') {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `${change.filePath} is a critical file and cannot be modified. Contact project owner.`,
        severity: 'critical',
      };
    }

    // PROTECTED files require approval
    if (status === 'protected') {
      const approvalId = await createApprovalRequest({
        projectId,
        requestedBy: change.userId,
        operation: `${change.operation.toUpperCase()}_FILE`,
        filePath: change.filePath,
        description: `Requested to ${change.operation} file: ${change.filePath}`,
        reason: change.reason,
      });

      return {
        allowed: true,
        requiresApproval: true,
        approvalId,
        reason: `${change.filePath} requires approval. Approval request created.`,
        severity: 'warning',
      };
    }

    // EDITABLE files are allowed
    return {
      allowed: true,
      requiresApproval: false,
      reason: `${change.filePath} can be modified freely`,
      severity: 'info',
    };
  } catch (error) {
    console.error('[CHANGE-VALIDATOR] Error validating change:', error);
    // Default to requiring approval on error
    return {
      allowed: true,
      requiresApproval: true,
      reason: 'Validation error - approval requested for safety',
      severity: 'warning',
    };
  }
}

/**
 * Validate multiple file changes
 */
export async function validateBatchChanges(
  projectId: string,
  changes: FileChange[]
): Promise<{
  validChanges: FileChange[];
  blockedChanges: FileChange[];
  changesRequiringApproval: Array<FileChange & { approvalId: string }>;
  summary: string;
}> {
  const validChanges: FileChange[] = [];
  const blockedChanges: FileChange[] = [];
  const changesRequiringApproval: Array<FileChange & { approvalId: string }> = [];

  for (const change of changes) {
    const result = await validateFileChange(projectId, change);

    if (!result.allowed) {
      blockedChanges.push(change);
    } else if (result.requiresApproval) {
      changesRequiringApproval.push({
        ...change,
        approvalId: result.approvalId!,
      });
    } else {
      validChanges.push(change);
    }
  }

  const summary = `
    Valid: ${validChanges.length}
    Blocked: ${blockedChanges.length}
    Approval Required: ${changesRequiringApproval.length}
  `.trim();

  return { validChanges, blockedChanges, changesRequiringApproval, summary };
}

/**
 * Check if user can modify a specific file
 */
export async function canUserModifyFile(
  projectId: string,
  filePath: string,
  userId: string
): Promise<boolean> {
  const result = await validateFileChange(projectId, {
    filePath,
    operation: 'modify',
    userId,
  });

  return result.allowed && !result.requiresApproval;
}
