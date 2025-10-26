/**
 * Dynamic Intelligence Service - Extended thinking mode for deep analysis
 */

import { db } from '../db';
import { dynamicIntelligenceSessions, type InsertDynamicIntelligenceSession, type DynamicIntelligenceSession } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';

export class DynamicIntelligenceService extends EventEmitter {
  /**
   * Start an extended thinking session
   */
  async startSession(params: {
    userId: string;
    projectId?: string;
    taskId?: string;
    mode: 'extended_thinking' | 'high_power';
    problem: string;
  }): Promise<string> {
    const result = await db.insert(dynamicIntelligenceSessions).values({
      userId: params.userId,
      projectId: params.projectId,
      taskId: params.taskId,
      mode: params.mode,
      problem: params.problem,
      status: 'running',
      thinkingTime: 0,
      tokensUsed: 0,
    }).returning();

    const sessionId = result[0].id;

    this.emit('session:started', {
      sessionId,
      ...params,
    });

    return sessionId;
  }

  /**
   * Update session with analysis
   */
  async updateSession(sessionId: string, updates: {
    analysis?: string;
    recommendations?: string;
    tokensUsed?: number;
    thinkingTime?: number;
    cost?: number;
    status?: string;
  }): Promise<void> {
    const dbUpdates: any = { ...updates };
    if (updates.cost !== undefined) {
      dbUpdates.cost = updates.cost.toString();
    }
    
    await db.update(dynamicIntelligenceSessions)
      .set({
        ...dbUpdates,
        completedAt: updates.status === 'completed' ? new Date() : undefined,
      })
      .where(eq(dynamicIntelligenceSessions.id, sessionId));

    this.emit('session:updated', { sessionId, ...updates });
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string, result: {
    analysis: string;
    recommendations: string;
    tokensUsed: number;
    thinkingTime: number;
    cost: number;
  }): Promise<void> {
    await db.update(dynamicIntelligenceSessions)
      .set({
        analysis: result.analysis,
        recommendations: result.recommendations,
        tokensUsed: result.tokensUsed,
        thinkingTime: result.thinkingTime,
        cost: result.cost.toString(),
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(dynamicIntelligenceSessions.id, sessionId));

    this.emit('session:completed', { sessionId, ...result });
  }

  /**
   * Fail a session
   */
  async failSession(sessionId: string, error: string): Promise<void> {
    await db.update(dynamicIntelligenceSessions)
      .set({
        status: 'failed',
        completedAt: new Date(),
        metadata: { error },
      })
      .where(eq(dynamicIntelligenceSessions.id, sessionId));

    this.emit('session:failed', { sessionId, error });
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<DynamicIntelligenceSession | null> {
    const result = await db.query.dynamicIntelligenceSessions.findFirst({
      where: eq(dynamicIntelligenceSessions.id, sessionId),
    });

    return result || null;
  }

  /**
   * Get user's thinking sessions
   */
  async getUserSessions(userId: string): Promise<DynamicIntelligenceSession[]> {
    return await db.query.dynamicIntelligenceSessions.findMany({
      where: eq(dynamicIntelligenceSessions.userId, userId),
      orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
      limit: 10,
    });
  }

  /**
   * Estimate session cost
   */
  estimateCost(mode: 'extended_thinking' | 'high_power', estimatedTokens: number): number {
    const tokenPricing = {
      extended_thinking: 0.015 / 1000, // $0.015 per 1K tokens (Claude Opus pricing)
      high_power: 0.030 / 1000, // $0.030 per 1K tokens (premium model)
    };

    return estimatedTokens * tokenPricing[mode];
  }
}

// Export singleton instance
export const dynamicIntelligenceService = new DynamicIntelligenceService();
