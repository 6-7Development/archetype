/**
 * Plan Mode Service - Brainstorming and planning without code modification
 */

import { db } from '../db';
import { planSessions, planSteps, type InsertPlanSession, type PlanSession, type InsertPlanStep, type PlanStep } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { EventEmitter } from 'events';

export class PlanModeService extends EventEmitter {
  /**
   * Create a new planning session
   */
  async createSession(params: {
    userId: string;
    projectId?: string;
    title: string;
    description?: string;
    metadata?: any;
  }): Promise<string> {
    const result = await db.insert(planSessions).values({
      userId: params.userId,
      projectId: params.projectId,
      title: params.title,
      description: params.description,
      status: 'active',
      metadata: params.metadata,
    }).returning();

    const sessionId = result[0].id;
    this.emit('session:created', { sessionId, ...params });
    
    return sessionId;
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<PlanSession | null> {
    const result = await db.query.planSessions.findFirst({
      where: eq(planSessions.id, sessionId),
    });

    return result || null;
  }

  /**
   * Get user's planning sessions
   */
  async getUserSessions(userId: string, projectId?: string): Promise<PlanSession[]> {
    const whereClause = projectId
      ? and(eq(planSessions.userId, userId), eq(planSessions.projectId, projectId))
      : eq(planSessions.userId, userId);

    return await db.query.planSessions.findMany({
      where: whereClause,
      orderBy: (planSessions, { desc }) => [desc(planSessions.createdAt)],
    });
  }

  /**
   * Add steps to a planning session
   */
  async addSteps(sessionId: string, steps: { title: string; description?: string; estimatedTime?: number }[]): Promise<PlanStep[]> {
    const insertData = steps.map((step, index) => ({
      sessionId,
      stepNumber: index + 1,
      title: step.title,
      description: step.description,
      estimatedTime: step.estimatedTime,
      status: 'pending',
    }));

    const result = await db.insert(planSteps).values(insertData).returning();
    this.emit('steps:added', { sessionId, steps: result });
    
    return result;
  }

  /**
   * Get session steps
   */
  async getSessionSteps(sessionId: string): Promise<PlanStep[]> {
    return await db.query.planSteps.findMany({
      where: eq(planSteps.sessionId, sessionId),
      orderBy: (planSteps, { asc }) => [asc(planSteps.stepNumber)],
    });
  }

  /**
   * Update step status
   */
  async updateStepStatus(stepId: string, status: string): Promise<void> {
    await db.update(planSteps)
      .set({
        status,
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(eq(planSteps.id, stepId));

    this.emit('step:updated', { stepId, status });
  }

  /**
   * Complete planning session
   */
  async completeSession(sessionId: string): Promise<void> {
    await db.update(planSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(planSessions.id, sessionId));

    this.emit('session:completed', { sessionId });
  }

  /**
   * Archive planning session
   */
  async archiveSession(sessionId: string): Promise<void> {
    await db.update(planSessions)
      .set({ status: 'archived' })
      .where(eq(planSessions.id, sessionId));

    this.emit('session:archived', { sessionId });
  }

  /**
   * Export session to Build Mode (returns task list)
   */
  async exportToBuildMode(sessionId: string): Promise<{
    session: PlanSession;
    steps: PlanStep[];
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const steps = await this.getSessionSteps(sessionId);
    
    this.emit('session:exported', { sessionId });
    
    return { session, steps };
  }
}

// Export singleton instance
export const planModeService = new PlanModeService();
