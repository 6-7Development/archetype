import { db } from '../db';
import { agentRuns, creditWallets } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { CreditManager } from './creditManager';

export class AgentExecutor {
  /**
   * Create new agent run and reserve credits
   * 
   * NEW: Accepts token estimates for accurate credit calculation
   * - Platform healing (targetContext='platform'): FREE (0 credits)
   * - Project work (targetContext='project'): Calculate from tokens or use estimatedCredits fallback
   */
  static async startRun(params: {
    userId: string;
    projectId: string | null;
    estimatedInputTokens?: number;   // NEW: Token estimate for input
    estimatedOutputTokens?: number;  // NEW: Token estimate for output
    estimatedCredits?: number;       // OLD: Fallback if tokens not provided
    targetContext: 'platform' | 'project'; // NEW: Determine FREE vs PAID
  }): Promise<{ success: boolean; runId?: string; error?: string; creditsReserved?: number }> {
    const { userId, projectId, estimatedInputTokens, estimatedOutputTokens, estimatedCredits, targetContext } = params;

    try {
      // Calculate credits needed based on targetContext
      let creditsNeeded: number;

      if (targetContext === 'platform') {
        // Platform healing = FREE for owners
        creditsNeeded = 0;
        console.log('[AGENT-EXECUTOR] Platform healing - FREE access (0 credits)');
      } else if (estimatedInputTokens !== undefined && estimatedOutputTokens !== undefined) {
        // Calculate from token estimates (preferred method)
        creditsNeeded = CreditManager.calculateCreditsForTokens(estimatedInputTokens, estimatedOutputTokens);
        console.log(`[AGENT-EXECUTOR] Calculated ${creditsNeeded} credits from tokens (input: ${estimatedInputTokens}, output: ${estimatedOutputTokens})`);
      } else if (estimatedCredits !== undefined) {
        // Fallback to estimated credits
        creditsNeeded = estimatedCredits;
        console.log(`[AGENT-EXECUTOR] Using fallback estimated credits: ${creditsNeeded}`);
      } else {
        // No estimates provided - use conservative default
        creditsNeeded = 100;
        console.warn('[AGENT-EXECUTOR] No token or credit estimates provided - using default 100 credits');
      }

      // Create agent run record
      const [run] = await db
        .insert(agentRuns)
        .values({
          userId,
          projectId,
          status: 'running',
          creditsReserved: creditsNeeded,
          creditsConsumed: 0,
          context: {},
        })
        .returning();

      // Reserve credits if needed (skip for FREE platform access)
      if (creditsNeeded > 0) {
        const reservation = await CreditManager.reserveCredits({
          userId,
          creditsNeeded,
          agentRunId: run.id,
        });

        if (!reservation.success) {
          // Failed to reserve - delete run and return error
          await db.delete(agentRuns).where(eq(agentRuns.id, run.id));
          return { success: false, error: reservation.error };
        }
      }

      return { success: true, runId: run.id, creditsReserved: creditsNeeded };
    } catch (error: any) {
      console.error('[AGENT-EXECUTOR] Error starting run:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if agent should pause due to credit depletion
   */
  static async shouldPause(runId: string): Promise<boolean> {
    try {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));

      if (!run) return true;

      // CRITICAL FIX: Never pause for owners (creditsReserved === 0)
      if (run.creditsReserved === 0) {
        return false;
      }

      // Check if consumed credits exceed reserved
      if (run.creditsConsumed >= run.creditsReserved) {
        return true;
      }

      return false;
    } catch (error) {
      return true; // Pause on error to be safe
    }
  }

  /**
   * Pause agent run and save state
   */
  static async pauseRun(params: {
    runId: string;
    context: any;
  }): Promise<{ success: boolean; error?: string }> {
    const { runId, context } = params;

    try {
      await db
        .update(agentRuns)
        .set({
          status: 'paused',
          context,
          pausedAt: new Date(),
        })
        .where(eq(agentRuns.id, runId));

      return { success: true };
    } catch (error: any) {
      console.error('[AGENT-EXECUTOR] Error pausing run:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume agent run after credit top-up
   */
  static async resumeRun(params: {
    runId: string;
    additionalCredits: number;
  }): Promise<{ success: boolean; context?: any; error?: string }> {
    const { runId, additionalCredits } = params;

    try {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));

      if (!run) {
        return { success: false, error: 'Run not found' };
      }

      if (run.status !== 'paused') {
        return { success: false, error: 'Run is not paused' };
      }

      // Reserve additional credits
      const reservation = await CreditManager.reserveCredits({
        userId: run.userId,
        creditsNeeded: additionalCredits,
        agentRunId: runId,
      });

      if (!reservation.success) {
        return { success: false, error: reservation.error };
      }

      // Update run with additional credits and resume
      await db
        .update(agentRuns)
        .set({
          status: 'running',
          creditsReserved: run.creditsReserved + additionalCredits,
          resumedAt: new Date(),
        })
        .where(eq(agentRuns.id, runId));

      return { success: true, context: run.context };
    } catch (error: any) {
      console.error('[AGENT-EXECUTOR] Error resuming run:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete agent run and reconcile credits
   * 
   * OVERLOADED: Supports both legacy and new signatures for backward compatibility
   * - NEW: completeRun({ runId, actualCreditsUsed, source })
   * - LEGACY: completeRun(runId, creditsUsed) - defaults source to 'lomu_chat'
   */
  static async completeRun(
    paramsOrRunId: { runId: string; actualCreditsUsed: number; source: 'lomu_chat' | 'architect_consultation' } | string,
    creditsUsed?: number
  ): Promise<{ success: boolean; error?: string }> {
    // Backward compatibility: Handle both old (positional) and new (object) signatures
    let runId: string;
    let actualCreditsUsed: number;
    let source: 'lomu_chat' | 'architect_consultation';

    if (typeof paramsOrRunId === 'string') {
      // LEGACY SIGNATURE: completeRun(runId, creditsUsed)
      runId = paramsOrRunId;
      actualCreditsUsed = creditsUsed ?? 0;
      source = 'lomu_chat'; // Default source for legacy callers
      console.log('[AGENT-EXECUTOR] Using LEGACY completeRun signature');
    } else {
      // NEW SIGNATURE: completeRun({ runId, actualCreditsUsed, source })
      ({ runId, actualCreditsUsed, source } = paramsOrRunId);
      console.log('[AGENT-EXECUTOR] Using NEW completeRun signature');
    }

    try {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));

      if (!run) {
        return { success: false, error: 'Run not found' };
      }

      // Reconcile credits
      if (run.creditsReserved > 0) {
        await CreditManager.reconcileCredits({
          userId: run.userId,
          agentRunId: runId,
          creditsReserved: run.creditsReserved,
          creditsActuallyUsed: actualCreditsUsed,
          source,
          metadata: { projectId: run.projectId },
        });
      }

      // Mark run as completed
      await db
        .update(agentRuns)
        .set({
          status: 'completed',
          creditsConsumed: actualCreditsUsed,
          completedAt: new Date(),
        })
        .where(eq(agentRuns.id, runId));

      return { success: true };
    } catch (error: any) {
      console.error('[AGENT-EXECUTOR] Error completing run:', error);
      return { success: false, error: error.message };
    }
  }
}
