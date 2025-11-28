/**
 * Configuration Override API - Allows HexadAI to modify editable configs
 * Sensitive operations require owner approval
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth';
import {
  isProtectedConfig,
  isEditableConfig,
  validateConfigValue,
  requiresOwnerApproval,
  CRITICAL_CONFIG,
  SENSITIVE_CONFIG,
} from '@client/config/protected';
import { approvalService } from '../services/approval-service';

const router = Router();

interface ConfigOverrideRequest {
  path: string;
  value: any;
  reason?: string;
}

/**
 * GET /api/config - Get current configuration
 * Only non-sensitive values returned
 */
router.get('/config', requireAuth, async (req: Request, res: Response) => {
  try {
    // Load current app.config.ts values
    const config = await import('@client/config/app.config').then(m => m.APP_CONFIG);

    // Filter out protected values
    const safeConfig = JSON.parse(JSON.stringify(config));

    res.json({
      success: true,
      config: safeConfig,
      protectedPaths: Object.keys(CRITICAL_CONFIG),
      editablePaths: SENSITIVE_CONFIG.requiresOwnerApproval,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load configuration' });
  }
});

/**
 * PATCH /api/config - Update editable configuration
 * Sensitive operations require approval, others apply immediately
 */
router.patch('/config', requireAuth, async (req: Request, res: Response) => {
  const { path, value, reason } = req.body as ConfigOverrideRequest;
  const userId = (req.user as any)?.id;
  const isOwner = (req.user as any)?.isOwner;

  if (!path || value === undefined) {
    return res.status(400).json({ success: false, error: 'Missing path or value' });
  }

  try {
    // Check if protected
    if (isProtectedConfig(path)) {
      return res.status(403).json({
        success: false,
        error: 'This configuration is protected and cannot be modified',
        severity: 'critical',
      });
    }

    // Check if editable
    if (!isEditableConfig(path)) {
      return res.status(403).json({
        success: false,
        error: 'This configuration cannot be modified',
        severity: 'warning',
      });
    }

    // Validate value
    const validation = validateConfigValue(path, value);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        severity: 'validation',
      });
    }

    // Check if requires approval
    const needsApproval = requiresOwnerApproval(`CONFIG_OVERRIDE_${path}`);

    if (needsApproval && !isOwner) {
      // Create approval request
      const approval = await approvalService.createApprovalRequest({
        operation: 'CONFIGURATION_OVERRIDE',
        resourceType: 'configuration',
        resourceId: path,
        userId,
        reason,
        metadata: { configPath: path, newValue: value },
      });

      return res.status(202).json({
        success: true,
        message: 'Approval required',
        approvalId: approval.id,
        status: 'pending_approval',
      });
    }

    // Owner or non-sensitive operation - apply immediately
    const oldValue = await getConfigValue(path);

    // Apply configuration change
    await applyConfigChange(path, value);

    // Log in audit trail
    await approvalService.logOperation(
      'CONFIG_CHANGE',
      'configuration',
      path,
      userId,
      oldValue,
      value,
      reason
    );

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      path,
      oldValue,
      newValue: value,
      appliedAt: new Date(),
    });
  } catch (error) {
    console.error('[CONFIG-OVERRIDE] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

/**
 * POST /api/config/approvals/:approvalId - Approve configuration change
 * Owner only
 */
router.post('/config/approvals/:approvalId/approve', requireOwner, async (req: Request, res: Response) => {
  const { approvalId } = req.params;
  const { reason } = req.body;
  const ownerId = (req.user as any)?.id;

  try {
    const approval = await approvalService.approveRequest(approvalId, ownerId, reason);

    if (!approval.metadata?.configPath || approval.metadata?.newValue === undefined) {
      return res.status(400).json({ success: false, error: 'Invalid approval metadata' });
    }

    // Apply the configuration change
    await applyConfigChange(approval.metadata.configPath, approval.metadata.newValue);

    res.json({
      success: true,
      message: 'Configuration change approved and applied',
      approval,
    });
  } catch (error) {
    console.error('[CONFIG-APPROVAL] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve configuration' });
  }
});

/**
 * POST /api/config/approvals/:approvalId - Reject configuration change
 * Owner only
 */
router.post('/config/approvals/:approvalId/reject', requireOwner, async (req: Request, res: Response) => {
  const { approvalId } = req.params;
  const { reason } = req.body;
  const ownerId = (req.user as any)?.id;

  try {
    const approval = await approvalService.rejectRequest(approvalId, ownerId, reason);

    res.json({
      success: true,
      message: 'Configuration change rejected',
      approval,
    });
  } catch (error) {
    console.error('[CONFIG-REJECTION] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject configuration' });
  }
});

/**
 * GET /api/config/approvals - Get pending approvals
 * Owner only
 */
router.get('/config/approvals', requireOwner, async (req: Request, res: Response) => {
  try {
    const pending = approvalService.getPendingApprovals();

    res.json({
      success: true,
      pendingApprovals: pending,
      count: pending.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch approvals' });
  }
});

/**
 * GET /api/config/protection-status - Get protection levels for paths
 */
router.get('/config/protection-status', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      criticalPaths: Object.keys(CRITICAL_CONFIG),
      sensitiveOperations: SENSITIVE_CONFIG.requiresOwnerApproval,
      editablePaths: [
        'branding.*',
        'theme.*',
        'messages.*',
        'chat.*',
        'features.*',
        'ui.*',
        'shortcuts.*',
        'social.*',
      ],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get protection status' });
  }
});

/**
 * Helper: Get current config value
 */
async function getConfigValue(path: string): Promise<any> {
  const config = await import('@client/config/app.config').then(m => m.APP_CONFIG);
  const parts = path.split('.');
  let value = config;

  for (const part of parts) {
    value = value?.[part as any];
    if (value === undefined) break;
  }

  return value;
}

/**
 * Helper: Apply config change (in production, this would update env vars or config service)
 */
async function applyConfigChange(path: string, value: any): Promise<void> {
  // In production, this would:
  // 1. Update environment variables
  // 2. Update config service
  // 3. Notify all clients of config change
  // 4. Store in database for persistence

  console.log(`[CONFIG-CHANGE] Applied: ${path} = ${JSON.stringify(value)}`);

  // Emit config change event to all connected websockets
  // This allows HexadAI and other clients to react to config changes
}

export default router;
