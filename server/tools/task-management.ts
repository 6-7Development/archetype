import { db } from '../db';
import { taskLists, tasks, insertTaskListSchema, insertTaskSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Import WebSocket for broadcasting task updates
let wss: any = null;
export function setWebSocketServer(websocketServer: any) {
  wss = websocketServer;
}

/**
 * Broadcast task updates to the user via WebSocket
 * Matches the same format as lomu_ai_job_update for consistency
 */
function broadcastTaskUpdate(userId: string, updateType: string, data: any) {
  if (!wss) {
    console.warn('[TASK-MGMT] WebSocket not initialized, skipping broadcast');
    return;
  }

  wss.clients.forEach((client: any) => {
    if (client.readyState === 1 && client.userId === userId) {
      client.send(JSON.stringify({
        type: 'lomu_ai_job_update',  // Match the existing event type
        updateType,  // This will be 'task_list_created' or 'task_updated'
        ...data,
      }));
    }
  });
  
  console.log(`[TASK-MGMT] 📡 Broadcast ${updateType} to user ${userId}`);
}

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
    console.log('[TASK-MGMT] createTaskList called with userId:', params.userId, 'title:', params.title);

    // Verify project ownership if projectId provided
    if (params.projectId) {
      const { projects } = await import('@shared/schema');
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, params.projectId), eq(projects.userId, params.userId)))
        .limit(1);

      if (!project) {
        console.error('[TASK-MGMT] Unauthorized: Project does not belong to user', params.userId);
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
        console.error('[TASK-MGMT] Invalid task status:', task.status);
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

    console.log('[TASK-MGMT] Task list created:', taskList);

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
      console.log('[TASK-MGMT] Created tasks:', createdTasks);
    }

    // 📡 Broadcast task list creation to user's UI
    broadcastTaskUpdate(params.userId, 'task_list_created', {
      taskListId: taskList.id,
      title: taskList.title,
      tasks: createdTasks.map(t => ({ 
        ...t, 
        progress: 0 // All tasks start at 0% progress
      })),
      chatMessageId: params.chatMessageId,
    });

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
    console.log('[TASK-MGMT] updateTask called with userId:', params.userId, 'taskId:', params.taskId, 'status:', params.status);

    // First, check if user has any task lists at all
    const userTaskLists = await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.userId, params.userId))
      .limit(1);

    if (userTaskLists.length === 0) {
      console.error('[TASK-MGMT] No task list found for userId:', params.userId);
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
        console.error('[TASK-MGMT] Task ID not found:', params.taskId);
        return {
          success: false,
          error: `Task ID "${params.taskId}" not found. Call read_task_list() to see your current task IDs and use one of those instead.`,
        };
      } else {
        console.error('[TASK-MGMT] Task found but does not belong to user:', params.userId, 'taskId:', params.taskId);
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
      console.error('[TASK-MGMT] Invalid status:', params.status);
      return {
        success: false,
        error: `Invalid status: ${params.status}`,
      };
    }

    // Validate architectReviewed enum if provided
    const validReviewStatuses = ['yes', 'no', 'not_applicable'];
    if (params.architectReviewed && !validReviewStatuses.includes(params.architectReviewed)) {
      console.error('[TASK-MGMT] Invalid architectReviewed status:', params.architectReviewed);
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
    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, params.taskId), eq(tasks.taskListId, taskList.id)))
      .returning();

    console.log('[TASK-MGMT] Task updated:', updatedTask);

    // Calculate real progress based on task completion
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.taskListId, taskList.id));
    
    // ✅ Count BOTH completed and completed_pending_review as done
    const completedStatuses = ['completed', 'completed_pending_review'];
    const completedTasks = allTasks.filter(t => 
      completedStatuses.includes(t.status) || 
      (t.id === updatedTask.id && params.status && completedStatuses.includes(params.status))
    ).length;
    const totalTasks = allTasks.length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 📡 Broadcast task update to user's UI with REAL progress
    broadcastTaskUpdate(params.userId, 'task_updated', {
      taskId: updatedTask.id,
      taskListId: updatedTask.taskListId,
      title: updatedTask.title,
      status: updatedTask.status,
      result: params.result,
      error: params.error,
      progress: progressPercentage, // ✅ Real progress based on completed/total
    });

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
    console.log('[TASK-MGMT] readTaskList called with userId:', params.userId, 'taskListId:', params.taskListId, 'projectId:', params.projectId);

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

    console.log('[TASK-MGMT] readTaskList returning:', listsWithTasks);

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
