/**
 * Task Runner API Routes
 */

import express from 'express';
import { taskRunnerService } from '../services/taskRunner';

const router = express.Router();

// Spawn a new task runner
router.post('/spawn', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId, taskId, runnerType } = req.body;

    if (!taskId || !runnerType) {
      return res.status(400).json({ error: 'taskId and runnerType are required' });
    }

    const runnerId = await taskRunnerService.spawnRunner({
      userId: req.user.id,
      projectId,
      taskId,
      runnerType,
    });

    res.json({ success: true, runnerId });
  } catch (error: any) {
    console.error('[TASK-RUNNER] Spawn error:', error);
    res.status(500).json({ error: error.message || 'Failed to spawn task runner' });
  }
});

// Get active runners
router.get('/active', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const runners = await taskRunnerService.getActiveRunners(req.user.id);
    res.json({ runners });
  } catch (error: any) {
    console.error('[TASK-RUNNER] Get active error:', error);
    res.status(500).json({ error: error.message || 'Failed to get active runners' });
  }
});

// Get runner status
router.get('/:runnerId', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const runner = await taskRunnerService.getRunnerStatus(req.params.runnerId);
    
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found' });
    }

    res.json({ runner });
  } catch (error: any) {
    console.error('[TASK-RUNNER] Get status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get runner status' });
  }
});

// Pause a runner
router.post('/:runnerId/pause', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await taskRunnerService.pauseRunner(req.params.runnerId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[TASK-RUNNER] Pause error:', error);
    res.status(500).json({ error: error.message || 'Failed to pause runner' });
  }
});

// Resume a runner
router.post('/:runnerId/resume', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await taskRunnerService.resumeRunner(req.params.runnerId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[TASK-RUNNER] Resume error:', error);
    res.status(500).json({ error: error.message || 'Failed to resume runner' });
  }
});

export default router;
