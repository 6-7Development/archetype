/**
 * Project Configuration API
 * Allows users to manage their project's protection rules
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireProjectOwner } from '../middleware/auth';
import {
  getProjectConfig,
  updateProjectConfig,
  getPendingApprovals,
  approveChange,
  rejectChange,
  fileRequiresApproval,
} from '../services/project-config-service';

const router = Router({ mergeParams: true });

/**
 * GET /api/projects/:projectId/config - Get project configuration
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const config = await getProjectConfig(projectId);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load configuration' });
  }
});

/**
 * PATCH /api/projects/:projectId/config - Update project configuration
 */
router.patch('/', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = (req.user as any)?.id;

  // Verify user is project owner
  const isOwner = await requireProjectOwner(projectId, userId);
  if (!isOwner) {
    return res.status(403).json({ success: false, error: 'Not project owner' });
  }

  const { protectedFiles, requireApprovalFor, customConfig } = req.body;

  try {
    await updateProjectConfig(projectId, {
      projectId,
      ownerId: userId,
      protectedFiles,
      requireApprovalFor,
      customConfig,
    });

    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

/**
 * GET /api/projects/:projectId/approvals - Get pending approvals
 */
router.get('/approvals', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = (req.user as any)?.id;

  // Verify user is project owner
  const isOwner = await requireProjectOwner(projectId, userId);
  if (!isOwner) {
    return res.status(403).json({ success: false, error: 'Not project owner' });
  }

  try {
    const approvals = await getPendingApprovals(projectId);
    res.json({ success: true, approvals, count: approvals.length });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load approvals' });
  }
});

/**
 * POST /api/projects/:projectId/approvals/:approvalId/approve - Approve change
 */
router.post('/approvals/:approvalId/approve', requireAuth, async (req: Request, res: Response) => {
  const { projectId, approvalId } = req.params;
  const userId = (req.user as any)?.id;
  const { reason } = req.body;

  // Verify user is project owner
  const isOwner = await requireProjectOwner(projectId, userId);
  if (!isOwner) {
    return res.status(403).json({ success: false, error: 'Not project owner' });
  }

  try {
    await approveChange(approvalId, userId, reason);
    res.json({ success: true, message: 'Change approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve change' });
  }
});

/**
 * POST /api/projects/:projectId/approvals/:approvalId/reject - Reject change
 */
router.post('/approvals/:approvalId/reject', requireAuth, async (req: Request, res: Response) => {
  const { projectId, approvalId } = req.params;
  const userId = (req.user as any)?.id;
  const { reason } = req.body;

  // Verify user is project owner
  const isOwner = await requireProjectOwner(projectId, userId);
  if (!isOwner) {
    return res.status(403).json({ success: false, error: 'Not project owner' });
  }

  try {
    await rejectChange(approvalId, userId, reason);
    res.json({ success: true, message: 'Change rejected' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject change' });
  }
});

/**
 * GET /api/projects/:projectId/config/protection-status - Get file protection status
 */
router.get('/protection-status/:filePath', requireAuth, async (req: Request, res: Response) => {
  const { projectId, filePath } = req.params;

  try {
    const requiresApproval = await fileRequiresApproval(projectId, filePath);
    res.json({
      success: true,
      filePath,
      requiresApproval,
      protectionStatus: requiresApproval ? 'protected' : 'editable',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get protection status' });
  }
});

export default router;
