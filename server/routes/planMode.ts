/**
 * Plan Mode API Routes - Brainstorming and planning without code modification
 */

import { Router } from 'express';
import { planModeService } from '../services/planMode';

const router = Router();

/**
 * POST /api/plan-mode/sessions
 * Create a new planning session
 */
router.post('/sessions', async (req, res) => {
  try {
    const { userId, projectId, title, description, metadata } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sessionId = await planModeService.createSession({
      userId,
      projectId,
      title,
      description,
      metadata,
    });

    res.status(201).json({ sessionId });
  } catch (error: any) {
    console.error('[PLAN_MODE] Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/plan-mode/sessions/:sessionId
 * Get session details
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await planModeService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error: any) {
    console.error('[PLAN_MODE] Error getting session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/plan-mode/sessions
 * Get user's planning sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const { userId, projectId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const sessions = await planModeService.getUserSessions(
      userId as string,
      projectId as string | undefined
    );

    res.json(sessions);
  } catch (error: any) {
    console.error('[PLAN_MODE] Error getting sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/plan-mode/sessions/:sessionId/steps
 * Add steps to a session
 */
router.post('/sessions/:sessionId/steps', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { steps } = req.body;

    if (!Array.isArray(steps)) {
      return res.status(400).json({ error: 'Steps must be an array' });
    }

    const createdSteps = await planModeService.addSteps(sessionId, steps);
    res.status(201).json(createdSteps);
  } catch (error: any) {
    console.error('[PLAN_MODE] Error adding steps:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/plan-mode/sessions/:sessionId/steps
 * Get session steps
 */
router.get('/sessions/:sessionId/steps', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const steps = await planModeService.getSessionSteps(sessionId);
    res.json(steps);
  } catch (error: any) {
    console.error('[PLAN_MODE] Error getting steps:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/plan-mode/steps/:stepId
 * Update step status
 */
router.patch('/steps/:stepId', async (req, res) => {
  try {
    const { stepId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing status' });
    }

    await planModeService.updateStepStatus(stepId, status);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[PLAN_MODE] Error updating step:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/plan-mode/sessions/:sessionId/complete
 * Complete a planning session
 */
router.post('/sessions/:sessionId/complete', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await planModeService.completeSession(sessionId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[PLAN_MODE] Error completing session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/plan-mode/sessions/:sessionId/export
 * Export session to Build Mode
 */
router.post('/sessions/:sessionId/export', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const exportData = await planModeService.exportToBuildMode(sessionId);
    res.json(exportData);
  } catch (error: any) {
    console.error('[PLAN_MODE] Error exporting session:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
