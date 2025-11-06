import { randomUUID } from 'crypto';
import { startSubagent } from '../subagentOrchestration';

interface SubagentTask {
  id: string;
  userId: string;
  task: string;
  relevantFiles: string[];
  sendEvent: (type: string, data: any) => void;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: SubagentResult;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface SubagentResult {
  success: boolean;
  summary: string;
  filesModified: string[];
  error?: string;
}

// Memory safety constants
const MEMORY_LIMIT_MB = 400; // Leave 112MB buffer on Railway's 512MB limit
const ESTIMATED_MEMORY_PER_SUBAGENT_MB = 150; // Conservative estimate (needs RSS profiling to optimize)
const MAX_CONCURRENT_PER_USER = 2; // Railway safety (increase to 3 requires memory instrumentation)
const SUBAGENT_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes

class ParallelSubagentQueue {
  private tasks: Map<string, SubagentTask> = new Map();
  private userQueues: Map<string, string[]> = new Map(); // userId -> taskIds
  private runningTasks: Map<string, string[]> = new Map(); // userId -> taskIds

  /**
   * Enqueue a new subagent task
   */
  async enqueueSubagent(params: {
    userId: string;
    task: string;
    relevantFiles: string[];
    sendEvent: (type: string, data: any) => void;
  }): Promise<string> {
    const { userId, task, relevantFiles, sendEvent } = params;

    // Generate unique task ID
    const taskId = randomUUID();

    // Create task record
    const subagentTask: SubagentTask = {
      id: taskId,
      userId,
      task,
      relevantFiles,
      sendEvent,
      status: 'queued',
    };

    this.tasks.set(taskId, subagentTask);

    // Add to user's queue
    if (!this.userQueues.has(userId)) {
      this.userQueues.set(userId, []);
    }
    this.userQueues.get(userId)!.push(taskId);

    console.log(`[PARALLEL-QUEUE] Task ${taskId} queued for user ${userId}`);
    console.log(`[PARALLEL-QUEUE] Queue status: ${this.getStatus(userId).queued} queued, ${this.getStatus(userId).running} running`);

    // Notify user
    sendEvent('subagent_progress', {
      subagentId: taskId,
      message: `📋 Subagent task queued: ${task.slice(0, 60)}...`,
      status: 'queued',
    });

    // Try to start the task immediately if slots available
    this.processQueue(userId);

    return taskId;
  }

  /**
   * Process the queue for a user - start tasks if slots available
   */
  private async processQueue(userId: string) {
    const queue = this.userQueues.get(userId) || [];
    const running = this.runningTasks.get(userId) || [];

    // Check memory safety
    const totalRunning = Array.from(this.runningTasks.values()).reduce(
      (sum, tasks) => sum + tasks.length,
      0
    );
    const estimatedMemoryUsage = totalRunning * ESTIMATED_MEMORY_PER_SUBAGENT_MB;

    if (estimatedMemoryUsage >= MEMORY_LIMIT_MB) {
      console.warn(`[PARALLEL-QUEUE] Memory limit approaching: ${estimatedMemoryUsage}MB / ${MEMORY_LIMIT_MB}MB`);
      return;
    }

    // Check if user has available slots
    if (running.length >= MAX_CONCURRENT_PER_USER) {
      console.log(`[PARALLEL-QUEUE] User ${userId} at max concurrency (${running.length}/${MAX_CONCURRENT_PER_USER})`);
      return;
    }

    // Find next queued task
    const nextTaskId = queue.find(id => {
      const task = this.tasks.get(id);
      return task && task.status === 'queued';
    });

    if (!nextTaskId) {
      console.log(`[PARALLEL-QUEUE] No queued tasks for user ${userId}`);
      return;
    }

    // Start the task
    await this.startTask(nextTaskId);
  }

  /**
   * Start a specific task
   */
  private async startTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`[PARALLEL-QUEUE] Task ${taskId} not found`);
      return;
    }

    // Update task status
    task.status = 'running';
    task.startedAt = new Date();

    // Add to running tasks
    if (!this.runningTasks.has(task.userId)) {
      this.runningTasks.set(task.userId, []);
    }
    this.runningTasks.get(task.userId)!.push(taskId);

    console.log(`[PARALLEL-QUEUE] Starting task ${taskId} for user ${task.userId}`);

    // Notify user
    task.sendEvent('subagent_progress', {
      subagentId: taskId,
      message: `🚀 Subagent started: ${task.task.slice(0, 60)}...`,
      status: 'running',
    });

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(taskId);
    }, SUBAGENT_TIMEOUT_MS);

    // Execute the subagent task
    try {
      const result = await startSubagent({
        task: task.task,
        relevantFiles: task.relevantFiles,
        userId: task.userId,
        sendEvent: (type: string, data: any) => {
          // Wrap events with subagent ID
          task.sendEvent('subagent_progress', {
            subagentId: taskId,
            ...data,
          });
        },
      });

      // Clear timeout
      clearTimeout(timeoutHandle);

      // Mark as completed
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      console.log(`[PARALLEL-QUEUE] Task ${taskId} completed successfully`);

      // Notify user
      task.sendEvent('subagent_progress', {
        subagentId: taskId,
        message: `✅ Subagent completed: ${result.summary}`,
        status: 'completed',
        result,
      });
    } catch (error: any) {
      // Clear timeout
      clearTimeout(timeoutHandle);

      // Mark as failed
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error.message;

      console.error(`[PARALLEL-QUEUE] Task ${taskId} failed:`, error);

      // Notify user
      task.sendEvent('subagent_progress', {
        subagentId: taskId,
        message: `❌ Subagent failed: ${error.message}`,
        status: 'failed',
        error: error.message,
      });
    } finally {
      // Remove from running tasks
      const running = this.runningTasks.get(task.userId) || [];
      const index = running.indexOf(taskId);
      if (index > -1) {
        running.splice(index, 1);
      }

      // Process queue again to start next task
      this.processQueue(task.userId);
    }
  }

  /**
   * Handle task timeout
   */
  private handleTimeout(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.status === 'running') {
      console.warn(`[PARALLEL-QUEUE] Task ${taskId} timed out after ${SUBAGENT_TIMEOUT_MS / 1000}s`);

      task.status = 'timeout';
      task.completedAt = new Date();
      task.error = 'Task exceeded 8-minute timeout';

      // Notify user
      task.sendEvent('subagent_progress', {
        subagentId: taskId,
        message: `⏱️ Subagent timed out (8 minutes exceeded)`,
        status: 'timeout',
        error: task.error,
      });

      // Remove from running tasks
      const running = this.runningTasks.get(task.userId) || [];
      const index = running.indexOf(taskId);
      if (index > -1) {
        running.splice(index, 1);
      }

      // Process queue again
      this.processQueue(task.userId);
    }
  }

  /**
   * Get queue status for a user
   */
  getStatus(userId: string): {
    running: number;
    queued: number;
    completed: number;
    failed: number;
    timeout: number;
  } {
    const queue = this.userQueues.get(userId) || [];
    const tasks = queue.map(id => this.tasks.get(id)).filter(Boolean) as SubagentTask[];

    return {
      running: tasks.filter(t => t.status === 'running').length,
      queued: tasks.filter(t => t.status === 'queued').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      timeout: tasks.filter(t => t.status === 'timeout').length,
    };
  }

  /**
   * Wait for specific tasks to complete
   */
  async waitForCompletion(userId: string, taskIds: string[]): Promise<SubagentResult[]> {
    const results: SubagentResult[] = [];

    // Poll for completion
    const pollInterval = 1000; // 1 second
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const allCompleted = taskIds.every(id => {
        const task = this.tasks.get(id);
        return task && (task.status === 'completed' || task.status === 'failed' || task.status === 'timeout');
      });

      if (allCompleted) {
        // Collect results
        for (const taskId of taskIds) {
          const task = this.tasks.get(taskId);
          if (task) {
            if (task.result) {
              results.push(task.result);
            } else if (task.error) {
              results.push({
                success: false,
                summary: `Task ${taskId} failed`,
                filesModified: [],
                error: task.error,
              });
            }
          }
        }
        break;
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return results;
  }

  /**
   * Get task details
   */
  getTask(taskId: string): SubagentTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'queued') {
      task.status = 'failed';
      task.error = 'Task cancelled by user';
      task.completedAt = new Date();

      console.log(`[PARALLEL-QUEUE] Task ${taskId} cancelled`);

      task.sendEvent('subagent_progress', {
        subagentId: taskId,
        message: `🚫 Subagent task cancelled`,
        status: 'failed',
        error: task.error,
      });

      return true;
    }

    // Cannot cancel running tasks (would require more complex implementation)
    return false;
  }

  /**
   * Get overall system status
   */
  getSystemStatus(): {
    totalRunning: number;
    estimatedMemoryUsageMB: number;
    memoryLimitMB: number;
    usersWithActiveTasks: number;
  } {
    const totalRunning = Array.from(this.runningTasks.values()).reduce(
      (sum, tasks) => sum + tasks.length,
      0
    );

    return {
      totalRunning,
      estimatedMemoryUsageMB: totalRunning * ESTIMATED_MEMORY_PER_SUBAGENT_MB,
      memoryLimitMB: MEMORY_LIMIT_MB,
      usersWithActiveTasks: this.runningTasks.size,
    };
  }

  /**
   * Cleanup completed tasks older than 1 hour
   */
  cleanup() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleanedCount = 0;

    // Convert Map.entries() to Array to avoid TypeScript iteration issue
    const tasksArray = Array.from(this.tasks.entries());
    for (const [taskId, task] of tasksArray) {
      if (
        task.completedAt &&
        task.completedAt < oneHourAgo &&
        (task.status === 'completed' || task.status === 'failed' || task.status === 'timeout')
      ) {
        this.tasks.delete(taskId);

        // Remove from user queue
        const queue = this.userQueues.get(task.userId) || [];
        const index = queue.indexOf(taskId);
        if (index > -1) {
          queue.splice(index, 1);
        }

        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[PARALLEL-QUEUE] Cleaned up ${cleanedCount} old tasks`);
    }
  }
}

// Singleton instance
export const parallelSubagentQueue = new ParallelSubagentQueue();

// Cleanup old tasks every hour
setInterval(() => {
  parallelSubagentQueue.cleanup();
}, 60 * 60 * 1000);

// Export for external use
export { SubagentTask, SubagentResult };
