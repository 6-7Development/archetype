/**
 * Approval API Routes
 * 
 * Handles user approval/rejection of file modification requests from LomuAI.
 * 
 * Endpoints:
 * - POST /api/approve/:messageId - Approve pending modification
 * - POST /api/reject/:messageId - Reject pending modification
 * - GET /api/approvals/pending - List pending approvals for current user
 */

import { Router } from 'express';
import { approvalManager } from '../services/approvalManager';
import { isAuthenticated } from '../universalAuth';

const router = Router();

/**
 * Approve a pending file modification
 */
router.post('/approve/:messageId', isAuthenticated, async (req: any, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.authenticatedUserId;
    
    console.log(`[APPROVAL-API] User ${userId} approving ${messageId}`);
    
    const success = approvalManager.approve(messageId);
    
    if (!success) {
      return res.status(404).json({
        error: 'No pending approval found',
        messageId,
      });
    }
    
    return res.json({
      success: true,
      messageId,
      status: 'approved',
    });
  } catch (error: any) {
    console.error('[APPROVAL-API] Error approving:', error);
    return res.status(500).json({
      error: 'Failed to approve request',
      details: error.message,
    });
  }
});

/**
 * Reject a pending file modification
 */
router.post('/reject/:messageId', isAuthenticated, async (req: any, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.authenticatedUserId;
    
    console.log(`[APPROVAL-API] User ${userId} rejecting ${messageId}`);
    
    const success = approvalManager.reject(messageId);
    
    if (!success) {
      return res.status(404).json({
        error: 'No pending approval found',
        messageId,
      });
    }
    
    return res.json({
      success: true,
      messageId,
      status: 'rejected',
    });
  } catch (error: any) {
    console.error('[APPROVAL-API] Error rejecting:', error);
    return res.status(500).json({
      error: 'Failed to reject request',
      details: error.message,
    });
  }
});

/**
 * Get pending approval requests for current user
 */
router.get('/approvals/pending', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    const pending = approvalManager.getPendingForUser(userId);
    
    return res.json({
      success: true,
      count: pending.length,
      approvals: pending,
    });
  } catch (error: any) {
    console.error('[APPROVAL-API] Error fetching pending approvals:', error);
    return res.status(500).json({
      error: 'Failed to fetch pending approvals',
      details: error.message,
    });
  }
});

export default router;
