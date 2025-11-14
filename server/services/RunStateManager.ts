import type { WebSocketServer } from 'ws';
import { broadcastToUser } from '../routes/websocket.ts';
import { 
  RunState, 
  RunConfig, 
  RunPhase, 
  Task, 
  TaskStatus,
  EventEnvelope,
  createEvent,
  RunStartedData,
  RunStateUpdateData,
  RunCompletedData,
  RunFailedData,
  TaskCreatedData,
  TaskUpdatedData,
  RunPhaseData,
  PlanCreatedData
} from '@shared/agentEvents';
import { nanoid } from 'nanoid';

/**
 * RunStateManager - Single Source of Truth for LomuAI Run State
 * 
 * Centralizes ALL run state mutations and WebSocket broadcasts.
 * Replaces scattered task/phase emissions with unified state management.
 * 
 * Key Responsibilities:
 * - Maintain canonical RunState for each active run
 * - Emit structured events (run.started, run.state_updated, task.created, etc.)
 * - Broadcast state changes via WebSocket
 * - Provide query methods for current state
 */
export class RunStateManager {
  private runStates: Map<string, RunState> = new Map();
  private wss: WebSocketServer;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    console.log('[RUN-STATE-MGR] 🎯 RunStateManager initialized');
  }

  // ============================================================================
  // CORE STATE MUTATIONS
  // ============================================================================

  /**
   * Create a new run and emit run.started event
   */
  createRun(config: RunConfig, userId: string, sessionId: string, runId?: string): RunState {
    const id = runId || nanoid();
    const now = new Date().toISOString();

    const runState: RunState = {
      runId: id,
      sessionId,
      userId,
      phase: 'thinking',
      status: 'active',
      tasks: [],
      currentTaskId: null,
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        totalToolCalls: 0,
        currentIteration: 0,
        maxIterations: config.maxIterations,
      },
      startedAt: now,
      lastActivityAt: now,
      config,
      errors: [],
    };

    this.runStates.set(id, runState);

    // Emit run.started event
    const event = createEvent<RunStartedData>('run.started', 'system', {
      runId: id,
      sessionId,
      userId,
      config,
      timestamp: now,
    });

    this.broadcast(userId, event);

    console.log(`[RUN-STATE-MGR] ✅ Created run ${id} for user ${userId}`);
    return runState;
  }

  /**
   * Update the current phase and emit run.state_updated event
   */
  updatePhase(runId: string, phase: RunPhase, message?: string): void {
    const runState = this.runStates.get(runId);
    if (!runState) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Run ${runId} not found for phase update`);
      return;
    }

    runState.phase = phase;
    runState.lastActivityAt = new Date().toISOString();

    // Emit run.phase event (legacy compatibility)
    const phaseEvent = createEvent<RunPhaseData>('run.phase', 'agent', {
      phase,
      message,
    });
    this.broadcast(runState.userId, phaseEvent);

    // Emit unified run.state_updated event
    const stateEvent = createEvent<RunStateUpdateData>('run.state_updated', 'system', {
      runId,
      phase,
    });
    this.broadcast(runState.userId, stateEvent);

    console.log(`[RUN-STATE-MGR] 📍 Phase updated: ${runId} → ${phase}${message ? ` (${message})` : ''}`);
  }

  /**
   * Add a new task and emit task.created event
   */
  addTask(runId: string, task: Task): void {
    const runState = this.runStates.get(runId);
    if (!runState) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Run ${runId} not found for task addition`);
      return;
    }

    runState.tasks.push(task);
    runState.metrics.totalTasks = runState.tasks.length;
    runState.lastActivityAt = new Date().toISOString();

    // Emit task.created event
    const event = createEvent<TaskCreatedData>('task.created', 'agent', {
      task,
    });
    this.broadcast(runState.userId, event);

    console.log(`[RUN-STATE-MGR] ➕ Task added: ${task.id} - ${task.title}`);
  }

  /**
   * Add multiple tasks at once (plan creation)
   */
  addTasks(runId: string, tasks: Task[], planSummary?: string): void {
    const runState = this.runStates.get(runId);
    if (!runState) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Run ${runId} not found for tasks addition`);
      return;
    }

    // Add all tasks
    runState.tasks.push(...tasks);
    runState.metrics.totalTasks = runState.tasks.length;
    runState.lastActivityAt = new Date().toISOString();

    // Emit plan.created event
    const planEvent = createEvent<PlanCreatedData>('plan.created', 'agent', {
      planId: nanoid(),
      tasks,
      summary: planSummary || `Created plan with ${tasks.length} tasks`,
    });
    this.broadcast(runState.userId, planEvent);

    // Also emit individual task.created events for each task
    tasks.forEach(task => {
      const taskEvent = createEvent<TaskCreatedData>('task.created', 'agent', {
        task,
      });
      this.broadcast(runState.userId, taskEvent);
    });

    console.log(`[RUN-STATE-MGR] 📝 Plan created with ${tasks.length} tasks for run ${runId}`);
  }

  /**
   * Update an existing task and emit task.updated event
   */
  updateTask(runId: string, taskId: string, updates: Partial<Task>): void {
    const runState = this.runStates.get(runId);
    if (!runState) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Run ${runId} not found for task update`);
      return;
    }

    const task = runState.tasks.find(t => t.id === taskId);
    if (!task) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Task ${taskId} not found in run ${runId}`);
      return;
    }

    // Apply updates
    Object.assign(task, updates);
    task.updatedAt = new Date().toISOString();
    runState.lastActivityAt = task.updatedAt;

    // Update metrics
    this.updateMetrics(runState);

    // Track current task
    if (updates.status === 'in_progress') {
      runState.currentTaskId = taskId;
    } else if (task.status === 'done' && runState.currentTaskId === taskId) {
      runState.currentTaskId = null;
    }

    // Emit task.updated event
    const event = createEvent<TaskUpdatedData>('task.updated', 'agent', {
      taskId,
      status: updates.status,
      verification: updates.verification,
      artifacts: updates.artifacts,
    });
    this.broadcast(runState.userId, event);

    console.log(`[RUN-STATE-MGR] 🔄 Task updated: ${taskId} → ${updates.status || 'modified'}`);
  }

  /**
   * Record a tool call (increment metrics)
   */
  recordToolCall(runId: string, toolName: string): void {
    const runState = this.runStates.get(runId);
    if (!runState) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Run ${runId} not found for tool call`);
      return;
    }

    runState.metrics.totalToolCalls += 1;
    runState.lastActivityAt = new Date().toISOString();

    console.log(`[RUN-STATE-MGR] 🔧 Tool called: ${toolName} (total: ${runState.metrics.totalToolCalls})`);
  }

  /**
   * Increment iteration count
   */
  incrementIteration(runId: string): void {
    const runState = this.runStates.get(runId);
    if (!runState) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Run ${runId} not found for iteration increment`);
      return;
    }

    runState.metrics.currentIteration += 1;
    console.log(`[RUN-STATE-MGR] 🔄 Iteration: ${runState.metrics.currentIteration}/${runState.metrics.maxIterations}`);
  }

  /**
   * Mark run as complete and emit run.completed event
   */
  markComplete(runId: string): void {
    const runState = this.runStates.get(runId);
    if (!runState) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Run ${runId} not found for completion`);
      return;
    }

    const now = new Date().toISOString();
    runState.status = 'completed';
    runState.phase = 'complete';
    runState.completedAt = now;
    runState.lastActivityAt = now;

    const totalDurationMs = new Date(now).getTime() - new Date(runState.startedAt).getTime();

    // Emit run.completed event
    const event = createEvent<RunCompletedData>('run.completed', 'system', {
      runId,
      totalDurationMs,
      tasksCompleted: runState.metrics.completedTasks,
      totalToolCalls: runState.metrics.totalToolCalls,
      finalPhase: 'complete',
      timestamp: now,
    });
    this.broadcast(runState.userId, event);

    console.log(`[RUN-STATE-MGR] ✅ Run ${runId} completed in ${totalDurationMs}ms`);
  }

  /**
   * Mark run as failed and emit run.failed event
   */
  markFailed(runId: string, errorMessage: string, phase?: RunPhase, taskId?: string): void {
    const runState = this.runStates.get(runId);
    if (!runState) {
      console.warn(`[RUN-STATE-MGR] ⚠️ Run ${runId} not found for failure`);
      return;
    }

    const now = new Date().toISOString();
    runState.status = 'failed';
    runState.completedAt = now;
    runState.lastActivityAt = now;

    // Add error to errors array
    runState.errors.push({
      timestamp: now,
      message: errorMessage,
      phase: phase || runState.phase,
      taskId,
    });

    // Emit run.failed event
    const event = createEvent<RunFailedData>('run.failed', 'system', {
      runId,
      phase: phase || runState.phase,
      errorMessage,
      timestamp: now,
      taskId,
    });
    this.broadcast(runState.userId, event);

    console.error(`[RUN-STATE-MGR] ❌ Run ${runId} failed: ${errorMessage}`);
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get run state by runId
   */
  getRunState(runId: string): RunState | undefined {
    return this.runStates.get(runId);
  }

  /**
   * Get all tasks for a run
   */
  getTasks(runId: string): Task[] {
    const runState = this.runStates.get(runId);
    return runState?.tasks || [];
  }

  /**
   * Get current phase for a run
   */
  getCurrentPhase(runId: string): RunPhase | undefined {
    const runState = this.runStates.get(runId);
    return runState?.phase;
  }

  /**
   * Check if all tasks are complete
   */
  areAllTasksComplete(runId: string): boolean {
    const runState = this.runStates.get(runId);
    if (!runState || runState.tasks.length === 0) {
      return false;
    }

    return runState.tasks.every(task => task.status === 'done');
  }

  /**
   * Get completion percentage
   */
  getCompletionPercentage(runId: string): number {
    const runState = this.runStates.get(runId);
    if (!runState || runState.metrics.totalTasks === 0) {
      return 0;
    }

    return Math.round((runState.metrics.completedTasks / runState.metrics.totalTasks) * 100);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Update run metrics based on current tasks
   */
  private updateMetrics(runState: RunState): void {
    runState.metrics.completedTasks = runState.tasks.filter(t => t.status === 'done').length;
    runState.metrics.failedTasks = runState.tasks.filter(t => t.status === 'blocked').length;
  }

  /**
   * Broadcast event to user via WebSocket
   */
  private broadcast(userId: string, event: EventEnvelope): void {
    broadcastToUser(this.wss, userId, event);
  }

  /**
   * Clean up old run states (call periodically or on run completion)
   */
  cleanupOldRuns(maxAgeMs: number = 60 * 60 * 1000): void {
    const now = Date.now();
    const runsToDelete: string[] = [];

    this.runStates.forEach((runState, runId) => {
      const lastActivity = new Date(runState.lastActivityAt).getTime();
      const age = now - lastActivity;

      if (age > maxAgeMs && (runState.status === 'completed' || runState.status === 'failed')) {
        runsToDelete.push(runId);
      }
    });

    runsToDelete.forEach(runId => {
      this.runStates.delete(runId);
      console.log(`[RUN-STATE-MGR] 🗑️ Cleaned up old run: ${runId}`);
    });

    if (runsToDelete.length > 0) {
      console.log(`[RUN-STATE-MGR] 🧹 Cleaned up ${runsToDelete.length} old runs`);
    }
  }
}
