import { db } from '../db';
import { taskLists, tasks, insertTaskListSchema, insertTaskSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Create Task List Tool
 * Breaks down complex user requests into manageable tasks
 * SECURITY: Input validation using schemas
 */
export async function createTaskList(params: {
  userId: string;
  projectId?: string;
  chatMessageId?: string;
  title: string;
  description?: string;
  tasks: Array<{
    title: string;
    description?: string;
    status?: string;
  }>;
}): Promise<{ success: boolean; taskListId?: string; tasks?: Array<{ id: string; title: string; status: string }>; error?: string }> {
  try {
    // Verify project ownership if projectId provided
    if (params.projectId) {
      const { projects } = await import('@shared/schema');
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, params.projectId), eq(projects.userId, params.userId)))
        .limit(1);

      if (!project) {
        return {
          success: false,
          error: 'Unauthorized: Project does not belong to user',
        };
      }
    }

    // Validate task statuses
    const validStatuses = ['pending', 'in_progress'];
    for (const task of params.tasks) {
      if (task.status && !validStatuses.includes(task.status)) {
        return {
          success: false,
          error: `Invalid task status: ${task.status}. Must be 'pending' or 'in_progress'`,
        };
      }
    }

    // Validate task list data using schema
    const taskListData = insertTaskListSchema.parse({
      userId: params.userId,
      projectId: params.projectId,
      chatMessageId: params.chatMessageId,
      title: params.title,
      description: params.description,
      status: 'active',
    });

    // Create task list
    const [taskList] = await db
      .insert(taskLists)
      .values(taskListData)
      .returning();

    // Create individual tasks with validation and return their IDs
    const createdTasks: Array<{ id: string; title: string; status: string }> = [];
    if (params.tasks && params.tasks.length > 0) {
      const taskValues = params.tasks.map((task) => {
        const taskData = insertTaskSchema.parse({
          taskListId: taskList.id,
          title: task.title,
          description: task.description,
          status: task.status || 'pending',
        });
        return taskData;
      });

      const insertedTasks = await db.insert(tasks).values(taskValues).returning();
      
      // Return task IDs so AI knows which IDs to use for update_task()
      createdTasks.push(...insertedTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status
      })));
    }

    return {
      success: true,
      taskListId: taskList.id,
      tasks: createdTasks, // ← NEW: Return actual task IDs!
    };
  } catch (error: any) {
    console.error('Failed to create task list:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update Task Tool
 * Update task status and progress
 * SECURITY: Verifies ownership through task list
 */
export async function updateTask(params: {
  userId: string; // REQUIRED for security
  taskId: string;
  status?: string;
  architectReviewed?: string;
  architectReviewReason?: string;
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // First, check if user has any task lists at all
    const userTaskLists = await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.userId, params.userId))
      .limit(1);

    if (userTaskLists.length === 0) {
      return {
        success: false,
        error: 'No task list found. You need to read your task list with read_task_list() first to see available task IDs. Tasks are created automatically when conversations start.',
      };
    }

    // Verify ownership with joined query (per-task authorization)
    const result = await db
      .select({ task: tasks, taskList: taskLists })
      .from(tasks)
      .innerJoin(taskLists, eq(tasks.taskListId, taskLists.id))
      .where(and(eq(tasks.id, params.taskId), eq(taskLists.userId, params.userId)))
      .limit(1);

    if (result.length === 0) {
      // Check if the task exists at all (but belongs to someone else or invalid ID)
      const taskExists = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, params.taskId))
        .limit(1);

      if (taskExists.length === 0) {
        return {
          success: false,
          error: `Task ID "${params.taskId}" not found. Call read_task_list() to see your current task IDs and use one of those instead.`,
        };
      } else {
        return {
          success: false,
          error: 'Task found but does not belong to you (unauthorized)',
        };
      }
    }

    const { task, taskList } = result[0];

    // Validate status enum if provided
    const validStatuses = ['pending', 'in_progress', 'completed_pending_review', 'completed', 'cancelled'];
    if (params.status && !validStatuses.includes(params.status)) {
      return {
        success: false,
        error: `Invalid status: ${params.status}`,
      };
    }

    // Validate architectReviewed enum if provided
    const validReviewStatuses = ['yes', 'no', 'not_applicable'];
    if (params.architectReviewed && !validReviewStatuses.includes(params.architectReviewed)) {
      return {
        success: false,
        error: `Invalid architectReviewed status: ${params.architectReviewed}`,
      };
    }

    // Build update object (NEVER allow changing taskListId)
    const updateData: any = {};
    if (params.status) {
      updateData.status = params.status;
      // Auto-set completedAt when marking as completed
      if (params.status === 'completed' && !params.completedAt) {
        updateData.completedAt = new Date();
      }
    }
    if (params.architectReviewed) updateData.architectReviewed = params.architectReviewed;
    if (params.architectReviewReason) updateData.architectReviewReason = params.architectReviewReason;
    if (params.result) updateData.result = params.result;
    if (params.error) updateData.error = params.error;
    if (params.startedAt) updateData.startedAt = params.startedAt;
    if (params.completedAt) updateData.completedAt = params.completedAt;

    // Update with explicit WHERE clause including ownership check
    await db
      .update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, params.taskId), eq(tasks.taskListId, taskList.id)));

    return { success: true };
  } catch (error: any) {
    console.error('Failed to update task:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Read Task List Tool
 * Get current task list and task statuses
 * SECURITY: Always scoped to userId
 */
export async function readTaskList(params: {
  taskListId?: string;
  userId: string; // REQUIRED for security
  projectId?: string;
}): Promise<{
  success: boolean;
  taskLists?: Array<any>;
  error?: string;
}> {
  try {
    // Build WHERE conditions properly using and()
    const conditions = [eq(taskLists.userId, params.userId)];

    if (params.taskListId) {
      conditions.push(eq(taskLists.id, params.taskListId));
    }

    if (params.projectId) {
      conditions.push(eq(taskLists.projectId, params.projectId));
    }

    const lists = await db
      .select()
      .from(taskLists)
      .where(and(...conditions));

    // Get tasks for each list
    const listsWithTasks = await Promise.all(
      lists.map(async (list) => {
        const taskItems = await db
          .select()
          .from(tasks)
          .where(eq(tasks.taskListId, list.id));
        return {
          ...list,
          tasks: taskItems,
        };
      })
    );

    return {
      success: true,
      taskLists: listsWithTasks,
    };
  } catch (error: any) {
    console.error('Failed to read task list:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
