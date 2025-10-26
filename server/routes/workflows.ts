/**
 * Workflows API Routes - Parallel/sequential command execution
 */

import { Router } from 'express';
import { workflowEngine } from '../services/workflowEngine';

const router = Router();

/**
 * POST /api/workflows
 * Create a new workflow definition
 */
router.post('/', async (req, res) => {
  try {
    const { userId, projectId, name, description, executionMode, steps, environment } = req.body;

    if (!userId || !name || !executionMode || !steps) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const workflowId = await workflowEngine.createWorkflow({
      userId,
      projectId,
      name,
      description,
      executionMode,
      steps,
      environment,
    });

    res.status(201).json({ workflowId });
  } catch (error: any) {
    console.error('[WORKFLOWS] Error creating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workflows/:workflowId
 * Get workflow definition
 */
router.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflow = await workflowEngine.getWorkflow(workflowId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);
  } catch (error: any) {
    console.error('[WORKFLOWS] Error getting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workflows
 * Get user's workflows
 */
router.get('/', async (req, res) => {
  try {
    const { userId, projectId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const workflows = await workflowEngine.getUserWorkflows(
      userId as string,
      projectId as string | undefined
    );

    res.json(workflows);
  } catch (error: any) {
    console.error('[WORKFLOWS] Error getting workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/workflows/:workflowId/execute
 * Execute a workflow
 */
router.post('/:workflowId/execute', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const runId = await workflowEngine.executeWorkflow(workflowId, userId);
    res.status(201).json({ runId });
  } catch (error: any) {
    console.error('[WORKFLOWS] Error executing workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/workflows/runs/:runId/cancel
 * Cancel a running workflow
 */
router.post('/runs/:runId/cancel', async (req, res) => {
  try {
    const { runId } = req.params;
    await workflowEngine.cancelWorkflow(runId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[WORKFLOWS] Error cancelling workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workflows/runs/:runId
 * Get workflow run status
 */
router.get('/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = await workflowEngine.getWorkflowRun(runId);

    if (!run) {
      return res.status(404).json({ error: 'Workflow run not found' });
    }

    res.json(run);
  } catch (error: any) {
    console.error('[WORKFLOWS] Error getting workflow run:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
