import { Router } from 'express';
import { db } from '../db';
import { taskLists, tasks } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated } from '../universalAuth';

const router = Router();

/**
 * GET /api/tasks/:chatMessageId
 * Fetch task list for a specific chat message
 * This ensures tasks persist when navigating between chats
 * 
 * Note: Real-time task updates come via WebSocket events (task_created, task_updated)
 * This endpoint is for initial load and persistence only
 */
router.get('/:chatMessageId', isAuthenticated, async (req: any, res) => {
  try {
    const { chatMessageId } = req.params;
    const userId = req.authenticatedUserId;

    // Get task list for this chat message
    const [taskList] = await db
      .select()
      .from(taskLists)
      .where(
        and(
          eq(taskLists.userId, userId),
          eq(taskLists.chatMessageId, chatMessageId)
        )
      )
      .orderBy(desc(taskLists.createdAt))
      .limit(1);

    if (!taskList) {
      return res.json({ tasks: [] });
    }

    // Get all tasks for this task list
    const taskItems = await db
      .select()
      .from(tasks)
      .where(eq(tasks.taskListId, taskList.id))
      .orderBy(tasks.createdAt);

    res.json({
      taskListId: taskList.id,
      tasks: taskItems,
    });
  } catch (error: any) {
    console.error('[TASKS-API] Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
