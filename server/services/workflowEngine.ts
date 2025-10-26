/**
 * Workflow Engine - Parallel/sequential command execution
 */

import { db } from '../db';
import { workflows, workflowRuns, type InsertWorkflow, type Workflow, type InsertWorkflowRun, type WorkflowRun } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';

export class WorkflowEngine extends EventEmitter {
  private activeRuns: Map<string, { processes: any[]; aborted: boolean }> = new Map();

  /**
   * Create a new workflow definition
   */
  async createWorkflow(params: {
    userId: string;
    projectId?: string;
    name: string;
    description?: string;
    executionMode: 'parallel' | 'sequential';
    steps: any[];
    environment?: any;
  }): Promise<string> {
    const result = await db.insert(workflows).values({
      userId: params.userId,
      projectId: params.projectId,
      name: params.name,
      description: params.description,
      executionMode: params.executionMode,
      steps: params.steps,
      environment: params.environment,
    }).returning();

    const workflowId = result[0].id;
    this.emit('workflow:created', { workflowId, ...params });
    
    return workflowId;
  }

  /**
   * Get workflow definition
   */
  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const result = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    return result || null;
  }

  /**
   * Get user's workflows
   */
  async getUserWorkflows(userId: string, projectId?: string): Promise<Workflow[]> {
    const whereClause = projectId
      ? { userId, projectId }
      : { userId };

    return await db.query.workflows.findMany({
      where: (workflow, { eq, and }) => 
        projectId
          ? and(eq(workflow.userId, userId), eq(workflow.projectId, projectId))
          : eq(workflow.userId, userId),
      orderBy: (workflows, { desc }) => [desc(workflows.createdAt)],
    });
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, userId: string): Promise<string> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Create workflow run record
    const result = await db.insert(workflowRuns).values({
      workflowId,
      userId,
      status: 'running',
      currentStep: 0,
      totalSteps: workflow.steps.length,
    }).returning();

    const runId = result[0].id;

    // Execute based on mode
    if (workflow.executionMode === 'parallel') {
      this.executeParallel(runId, workflow);
    } else {
      this.executeSequential(runId, workflow);
    }

    this.emit('workflow:started', { runId, workflowId });
    return runId;
  }

  /**
   * Execute workflow steps in parallel
   */
  private async executeParallel(runId: string, workflow: Workflow): Promise<void> {
    const processes: any[] = [];
    const outputs: string[] = [];
    const steps = workflow.steps as any[];

    this.activeRuns.set(runId, { processes, aborted: false });

    try {
      const promises = steps.map((step: any, index: number) => {
        return new Promise((resolve, reject) => {
          const proc = spawn(step.command, {
            shell: true,
            env: { ...process.env, ...(workflow.environment as any || {}) },
          });

          processes.push(proc);

          let stepOutput = '';
          proc.stdout?.on('data', (data) => {
            stepOutput += data.toString();
          });

          proc.stderr?.on('data', (data) => {
            stepOutput += data.toString();
          });

          proc.on('close', (code) => {
            outputs[index] = stepOutput;
            if (code === 0) {
              resolve(stepOutput);
            } else {
              reject(new Error(`Step ${index + 1} failed with code ${code}`));
            }
          });
        });
      });

      await Promise.all(promises);

      // Mark as completed
      await db.update(workflowRuns)
        .set({
          status: 'completed',
          output: outputs.join('\n\n'),
          completedAt: new Date(),
        })
        .where(eq(workflowRuns.id, runId));

      this.emit('workflow:completed', { runId });
    } catch (error: any) {
      await db.update(workflowRuns)
        .set({
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        })
        .where(eq(workflowRuns.id, runId));

      this.emit('workflow:failed', { runId, error: error.message });
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  /**
   * Execute workflow steps sequentially
   */
  private async executeSequential(runId: string, workflow: Workflow): Promise<void> {
    const processes: any[] = [];
    const outputs: string[] = [];
    const steps = workflow.steps as any[];

    this.activeRuns.set(runId, { processes, aborted: false });

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Update current step
        await db.update(workflowRuns)
          .set({ currentStep: i + 1 })
          .where(eq(workflowRuns.id, runId));

        const output = await new Promise<string>((resolve, reject) => {
          const proc = spawn(step.command, {
            shell: true,
            env: { ...process.env, ...(workflow.environment as any || {}) },
          });

          processes.push(proc);

          let stepOutput = '';
          proc.stdout?.on('data', (data) => {
            stepOutput += data.toString();
          });

          proc.stderr?.on('data', (data) => {
            stepOutput += data.toString();
          });

          proc.on('close', (code) => {
            if (code === 0) {
              resolve(stepOutput);
            } else {
              reject(new Error(`Step ${i + 1} failed with code ${code}`));
            }
          });
        });

        outputs.push(output);
      }

      // Mark as completed
      await db.update(workflowRuns)
        .set({
          status: 'completed',
          output: outputs.join('\n\n'),
          completedAt: new Date(),
        })
        .where(eq(workflowRuns.id, runId));

      this.emit('workflow:completed', { runId });
    } catch (error: any) {
      await db.update(workflowRuns)
        .set({
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        })
        .where(eq(workflowRuns.id, runId));

      this.emit('workflow:failed', { runId, error: error.message });
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(runId: string): Promise<void> {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    run.aborted = true;
    run.processes.forEach(proc => proc.kill());

    await db.update(workflowRuns)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId));

    this.activeRuns.delete(runId);
    this.emit('workflow:cancelled', { runId });
  }

  /**
   * Get workflow run status
   */
  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    const result = await db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, runId),
    });

    return result || null;
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();
