import { Router } from 'express';
import { db } from '../db';
import { agentRuns } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated, isAdmin } from '../universalAuth';
import { AgentExecutor } from '../services/agentExecutor';

const router = Router();

// Resume paused agent run
router.post('/resume/:runId', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { runId } = req.params;
    const userId = req.authenticatedUserId;
    const { additionalCredits = 100 } = req.body;

    console.log(`[AGENTS] Resume request - runId: ${runId}, userId: ${userId}, additionalCredits: ${additionalCredits}`);

    // Verify run belongs to user
    const [run] = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, runId));

    if (!run) {
      console.error(`[AGENTS] Run not found: ${runId}`);
      return res.status(404).json({ error: 'Agent run not found' });
    }

    if (run.userId !== userId) {
      console.error(`[AGENTS] Unauthorized resume attempt - runId: ${runId}, userId: ${userId}, ownerId: ${run.userId}`);
      return res.status(403).json({ error: 'Not authorized to resume this run' });
    }

    if (run.status !== 'paused') {
      console.error(`[AGENTS] Run is not paused - runId: ${runId}, status: ${run.status}`);
      return res.status(400).json({ error: `Run is not paused (current status: ${run.status})` });
    }

    console.log(`[AGENTS] Resuming run ${runId} with ${additionalCredits} credits`);

    // Resume the run
    const result = await AgentExecutor.resumeRun({
      runId,
      additionalCredits,
    });

    if (!result.success) {
      console.error(`[AGENTS] Resume failed - runId: ${runId}, error: ${result.error}`);
      return res.status(402).json({ 
        error: result.error,
        requiresCreditPurchase: true,
      });
    }

    console.log(`[AGENTS] Run resumed successfully - runId: ${runId}`);

    res.json({
      success: true,
      runId,
      context: result.context,
      message: 'Agent resumed successfully. Refresh to see continued output.',
    });
  } catch (error: any) {
    console.error('[AGENTS] Error resuming run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active paused run for user
router.get('/paused', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;

    const [pausedRun] = await db
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.userId, userId),
          eq(agentRuns.status, 'paused')
        )
      )
      .orderBy(desc(agentRuns.pausedAt))
      .limit(1);

    res.json({
      success: true,
      pausedRun: pausedRun || null,
    });
  } catch (error: any) {
    console.error('[AGENTS] Error getting paused run:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
