/**
 * SWARM Mode API Routes
 * Handles SWARM mode execution, status, and history
 */

import { Router, Request, Response } from 'express';
import { swarmCoordinator } from '../services/swarmModeCoordinator';
import { aiDecisionLogger } from '../services/aiDecisionLogger';
import { versionManager } from '../services/versionManager';
import { nanoid } from 'nanoid';

const router = Router();
const activeSwarmTasks = new Map<string, any>();

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

/**
 * PUT /api/swarm/:taskId
 * Update task mid-execution (GAP #1 FIX)
 */
router.put('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { priority, params, description } = req.body;

    const task = activeSwarmTasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Allow updates only for pending/running tasks
    if (task.status !== 'pending' && task.status !== 'running') {
      return res.status(400).json({ error: `Cannot update ${task.status} task` });
    }

    // Update task properties
    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      task.priority = priority;
    }
    if (params && typeof params === 'object') {
      task.params = { ...task.params, ...params };
    }
    if (description && typeof description === 'string') {
      task.description = description;
    }

    activeSwarmTasks.set(taskId, task);

    res.json({
      taskId,
      message: 'Task updated successfully',
      task: {
        priority: task.priority,
        description: task.description,
        status: task.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/swarm/:taskId/close
 * Explicitly close a task (GAP #1 FIX)
 */
router.post('/:taskId/close', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { reason = 'user_requested' } = req.body;

    const task = activeSwarmTasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Allow closing only for pending/running tasks
    if (task.status === 'completed' || task.status === 'failed') {
      return res.status(400).json({ error: `Task already ${task.status}` });
    }

    // Mark as closed
    task.status = 'closed';
    task.closedAt = new Date();
    task.closedReason = reason;

    activeSwarmTasks.set(taskId, task);

    res.json({
      taskId,
      message: 'Task closed successfully',
      task: {
        status: task.status,
        closedAt: task.closedAt,
        reason: task.closedReason,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/version
 * Get current version for environment (GAP #4 FIX)
 */
router.get('/version', async (req: Request, res: Response) => {
  try {
    const environment = (req.query.env as string) || 'production';

    const version = await versionManager.getCurrentVersion(
      environment as 'development' | 'staging' | 'production'
    );

    res.json({
      environment,
      version: version || 'unknown',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/deployment/history
 * Get deployment history (GAP #3 FIX)
 */
router.get('/deployment/history', async (req: Request, res: Response) => {
  try {
    const environment = (req.query.env as string) || undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || '20'), 100);

    const history = await versionManager.getDeploymentHistory(environment, limit);

    res.json({
      count: history.length,
      deployments: history,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/deployment/validate
 * Validate if safe to deploy (GAP #3 FIX)
 */
router.post('/deployment/validate', async (req: Request, res: Response) => {
  try {
    const { environment = 'production', lastMinutes = 5 } = req.body;

    const validation = await versionManager.validateDeployment(environment, lastMinutes);

    res.json({
      environment,
      ...validation,
      message: validation.safe ? 'Safe to deploy' : 'Too many recent failures - consider waiting',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
