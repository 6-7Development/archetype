/**
 * Dynamic Intelligence API Routes
 */

import express from 'express';
import { dynamicIntelligenceService } from '../services/dynamicIntelligence';

const router = express.Router();

// Start a thinking session
router.post('/start', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId, taskId, mode, problem } = req.body;

    if (!mode || !problem) {
      return res.status(400).json({ error: 'mode and problem are required' });
    }

    const sessionId = await dynamicIntelligenceService.startSession({
      userId: req.user.id,
      projectId,
      taskId,
      mode,
      problem,
    });

    res.json({ success: true, sessionId });
  } catch (error: any) {
    console.error('[DYNAMIC-INTEL] Start session error:', error);
    res.status(500).json({ error: error.message || 'Failed to start thinking session' });
  }
});

// Get session status
router.get('/:sessionId', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await dynamicIntelligenceService.getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  } catch (error: any) {
    console.error('[DYNAMIC-INTEL] Get session error:', error);
    res.status(500).json({ error: error.message || 'Failed to get session' });
  }
});

// Get user's thinking sessions
router.get('/sessions/history', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessions = await dynamicIntelligenceService.getUserSessions(req.user.id);
    res.json({ sessions });
  } catch (error: any) {
    console.error('[DYNAMIC-INTEL] Get sessions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

// Estimate cost
router.post('/estimate', async (req: express.Request, res: express.Response) => {
  try {
    const { mode, estimatedTokens } = req.body;
    const cost = dynamicIntelligenceService.estimateCost(
      mode || 'extended_thinking',
      estimatedTokens || 10000
    );

    res.json({ cost });
  } catch (error: any) {
    console.error('[DYNAMIC-INTEL] Estimate cost error:', error);
    res.status(500).json({ error: error.message || 'Failed to estimate cost' });
  }
});

export default router;
