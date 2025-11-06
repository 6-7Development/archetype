import { db } from '../db';
import { agentRuns, creditWallets } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { CreditManager } from './creditManager';

export class AgentExecutor {
  /**
   * Create new agent run and reserve credits
   */
  static async startRun(params: {
    userId: string;
    projectId: string | null;
    estimatedCredits: number;
  }): Promise<{ success: boolean; runId?: string; error?: string }> {
    const { userId, projectId, estimatedCredits } = params;

    try {
      // Check if owner should get free credits
      const shouldCharge = await CreditManager.shouldChargeUser(userId, projectId);
      const creditsToReserve = shouldCharge ? estimatedCredits : 0;

      // Create agent run record
      const [run] = await db
        .insert(agentRuns)
        .values({
          userId,
          projectId,
          status: 'running',
          creditsReserved: creditsToReserve,
          creditsConsumed: 0,
          context: {},
        })
        .returning();

      // Reserve credits if not owner
      if (creditsToReserve > 0) {
        const reservation = await CreditManager.reserveCredits({
          userId,
          creditsNeeded: creditsToReserve,
          agentRunId: run.id,
        });

        if (!reservation.success) {
          // Failed to reserve - delete run and return error
          await db.delete(agentRuns).where(eq(agentRuns.id, run.id));
          return { success: false, error: reservation.error };
        }
      }

      return { success: true, runId: run.id };
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
   */
  static async completeRun(params: {
    runId: string;
    actualCreditsUsed: number;
    source: 'lomu_chat' | 'architect_consultation';
  }): Promise<{ success: boolean; error?: string }> {
    const { runId, actualCreditsUsed, source } = params;

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
