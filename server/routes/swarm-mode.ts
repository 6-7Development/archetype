/**
 * SWARM Mode API Routes
 * Handles SWARM mode execution, status, and history
 */

import { Router, Request, Response } from 'express';
import { swarmCoordinator } from '../services/swarmModeCoordinator';
import { aiDecisionLogger } from '../services/aiDecisionLogger';
import { nanoid } from 'nanoid';

const router = Router();

/**
 * POST /api/swarm/execute
 * Execute SWARM mode task
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { description, requiredTools, params, priority = 'medium', maxCost = 500 } = req.body;
    const userId = (req as any).user?.id || 'anonymous';
    const sessionId = (req as any).sessionId || nanoid();

    if (!description || !requiredTools || !Array.isArray(requiredTools)) {
      return res.status(400).json({ error: 'Missing or invalid: description, requiredTools' });
    }

    const task = {
      id: nanoid(),
      userId,
      sessionId,
      description,
      requiredTools,
      params: params || {},
      priority,
      maxCost,
      timeout: 300000, // 5 minutes
    };

    const execution = await swarmCoordinator.executeSwarmTask(task);

    res.json({
      taskId: task.id,
      execution,
      message: 'SWARM mode execution completed',
    });
  } catch (error: any) {
    console.error('[SWARM-API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/swarm/status/:taskId
 * Get execution status
 */
router.get('/status/:taskId', (req: Request, res: Response) => {
  try {
    const execution = swarmCoordinator.getExecutionStatus(req.params.taskId);

    if (!execution) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(execution);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/swarm/cancel/:taskId
 * Cancel execution
 */
router.post('/cancel/:taskId', async (req: Request, res: Response) => {
  try {
    const success = await swarmCoordinator.cancelExecution(req.params.taskId);

    if (!success) {
      return res.status(400).json({ error: 'Cannot cancel execution in current state' });
    }

    res.json({ message: 'Execution cancelled', taskId: req.params.taskId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/swarm/stats
 * Get SWARM mode statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const stats = aiDecisionLogger.getStats(userId);

    res.json({
      activeExecutions: swarmCoordinator.getActiveExecutionCount(),
      stats,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/swarm/audit/:sessionId
 * Get audit report
 */
router.get('/audit/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const report = await aiDecisionLogger.generateAuditReport(userId, req.params.sessionId);

    res.type('text/markdown').send(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
