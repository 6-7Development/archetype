/**
 * Task Runner Service - Parallel task execution system
 * Manages worker pools and concurrent task execution
 */

import { db } from '../db';
import { taskRunners, tasks, type InsertTaskRunner, type TaskRunner } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { EventEmitter } from 'events';

export class TaskRunnerService extends EventEmitter {
  private activeRunners: Map<string, { status: string; abortController: AbortController }> = new Map();
  private maxConcurrentRunners = 5; // Default max concurrent runners

  constructor() {
    super();
  }

  /**
   * Spawn a new task runner for a task
   */
  async spawnRunner(params: {
    userId: string;
    projectId?: string;
    taskId: string;
    runnerType: 'parallel' | 'sequential' | 'background';
  }): Promise<string> {
    const runner = await db.insert(taskRunners).values({
      userId: params.userId,
      projectId: params.projectId,
      taskId: params.taskId,
      runnerType: params.runnerType,
      status: 'idle',
      progress: 0,
      metadata: {},
    }).returning();

    const runnerId = runner[0].id;
    this.activeRunners.set(runnerId, {
      status: 'idle',
      abortController: new AbortController(),
    });

    this.emit('runner:spawned', { runnerId, ...params });
    return runnerId;
  }

  /**
   * Start a task runner
   */
  async startRunner(runnerId: string, currentStep?: string): Promise<void> {
    const runner = this.activeRunners.get(runnerId);
    if (!runner) {
      throw new Error('Runner not found in active pool');
    }

    runner.status = 'running';
    
    await db.update(taskRunners)
      .set({
        status: 'running',
        startedAt: new Date(),
        currentStep: currentStep || 'Starting...',
      })
      .where(eq(taskRunners.id, runnerId));

    this.emit('runner:started', { runnerId, currentStep });
  }

  /**
   * Update runner progress
   */
  async updateProgress(runnerId: string, progress: number, currentStep?: string): Promise<void> {
    await db.update(taskRunners)
      .set({
        progress,
        currentStep,
      })
      .where(eq(taskRunners.id, runnerId));

    this.emit('runner:progress', { runnerId, progress, currentStep });
  }

  /**
   * Complete a task runner
   */
  async completeRunner(runnerId: string, tokensUsed: number = 0): Promise<void> {
    const runner = this.activeRunners.get(runnerId);
    if (!runner) return;

    runner.status = 'completed';
    
    await db.update(taskRunners)
      .set({
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        tokensUsed,
      })
      .where(eq(taskRunners.id, runnerId));

    this.activeRunners.delete(runnerId);
    this.emit('runner:completed', { runnerId, tokensUsed });
  }

  /**
   * Fail a task runner
   */
  async failRunner(runnerId: string, error: string): Promise<void> {
    const runner = this.activeRunners.get(runnerId);
    if (!runner) return;

    runner.status = 'failed';
    
    await db.update(taskRunners)
      .set({
        status: 'failed',
        error,
        completedAt: new Date(),
      })
      .where(eq(taskRunners.id, runnerId));

    this.activeRunners.delete(runnerId);
    this.emit('runner:failed', { runnerId, error });
  }

  /**
   * Pause a task runner
   */
  async pauseRunner(runnerId: string): Promise<void> {
    const runner = this.activeRunners.get(runnerId);
    if (!runner) return;

    runner.status = 'paused';
    
    await db.update(taskRunners)
      .set({ status: 'paused' })
      .where(eq(taskRunners.id, runnerId));

    this.emit('runner:paused', { runnerId });
  }

  /**
   * Resume a paused runner
   */
  async resumeRunner(runnerId: string): Promise<void> {
    const runner = this.activeRunners.get(runnerId);
    if (!runner) return;

    runner.status = 'running';
    
    await db.update(taskRunners)
      .set({ status: 'running' })
      .where(eq(taskRunners.id, runnerId));

    this.emit('runner:resumed', { runnerId });
  }

  /**
   * Get active runner count
   */
  getActiveRunnerCount(): number {
    return this.activeRunners.size;
  }

  /**
   * Can spawn more runners?
   */
  canSpawnRunner(): boolean {
    return this.activeRunners.size < this.maxConcurrentRunners;
  }

  /**
   * Set max concurrent runners
   */
  setMaxConcurrentRunners(max: number): void {
    this.maxConcurrentRunners = max;
  }

  /**
   * Get runner status
   */
  async getRunnerStatus(runnerId: string): Promise<TaskRunner | null> {
    const result = await db.query.taskRunners.findFirst({
      where: eq(taskRunners.id, runnerId),
    });
    return result || null;
  }

  /**
   * Get all active runners for a user
   */
  async getActiveRunners(userId: string): Promise<TaskRunner[]> {
    return await db.query.taskRunners.findMany({
      where: and(
        eq(taskRunners.userId, userId),
        eq(taskRunners.status, 'running')
      ),
    });
  }

  /**
   * Cleanup stale runners (running for > 1 hour)
   */
  async cleanupStaleRunners(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Find stale runners
    const staleRunners = await db.query.taskRunners.findMany({
      where: and(
        eq(taskRunners.status, 'running'),
      ),
    });

    for (const runner of staleRunners) {
      if (runner.startedAt && runner.startedAt < oneHourAgo) {
        await this.failRunner(runner.id, 'Runner timeout - exceeded 1 hour');
      }
    }
  }
}

// Export singleton instance
export const taskRunnerService = new TaskRunnerService();

// Cleanup stale runners every 15 minutes
setInterval(() => {
  taskRunnerService.cleanupStaleRunners();
}, 15 * 60 * 1000);
