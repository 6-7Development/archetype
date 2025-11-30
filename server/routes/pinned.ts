import { Router } from 'express';
import { isAuthenticated } from '../universalAuth.js';
import { db } from '../db.js';
import { pinnedItems } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

const createPinnedItemSchema = z.object({
  itemType: z.enum(['message', 'code_snippet', 'file', 'url']),
  referenceId: z.string().optional(),
  title: z.string().max(255).optional(),
  content: z.string().optional(),
  language: z.string().max(20).optional(),
  filePath: z.string().max(500).optional(),
  lineStart: z.number().int().optional(),
  lineEnd: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().max(20).optional(),
  projectId: z.string().optional(),
});

router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const projectId = req.query.projectId as string | undefined;

    const { or, isNull } = await import('drizzle-orm');

    let whereClause;
    if (projectId) {
      whereClause = and(
        eq(pinnedItems.userId, userId),
        or(
          eq(pinnedItems.projectId, projectId),
          isNull(pinnedItems.projectId)
        )
      );
    } else {
      whereClause = eq(pinnedItems.userId, userId);
    }

    const items = await db
      .select()
      .from(pinnedItems)
      .where(whereClause)
      .orderBy(pinnedItems.sortOrder, desc(pinnedItems.pinnedAt));

    res.json({ success: true, items });
  } catch (error: any) {
    console.error('[PINNED] Error fetching items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const validation = createPinnedItemSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const data = validation.data;

    const [item] = await db
      .insert(pinnedItems)
      .values({
        userId,
        projectId: data.projectId || null,
        itemType: data.itemType,
        referenceId: data.referenceId || null,
        title: data.title || null,
        content: data.content || null,
        language: data.language || null,
        filePath: data.filePath || null,
        lineStart: data.lineStart || null,
        lineEnd: data.lineEnd || null,
        tags: data.tags || null,
        color: data.color || null,
        sortOrder: 0,
      })
      .returning();

    console.log(`[PINNED] Created pinned item ${item.id} for user ${userId}`);
    res.json({ success: true, item });
  } catch (error: any) {
    console.error('[PINNED] Error creating item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { id } = req.params;

    await db
      .delete(pinnedItems)
      .where(and(
        eq(pinnedItems.id, id),
        eq(pinnedItems.userId, userId)
      ));

    console.log(`[PINNED] Deleted pinned item ${id} for user ${userId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[PINNED] Error deleting item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/order', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { id } = req.params;
    const { sortOrder } = req.body;

    if (typeof sortOrder !== 'number') {
      return res.status(400).json({ success: false, error: 'Invalid sort order' });
    }

    const [item] = await db
      .update(pinnedItems)
      .set({ sortOrder, updatedAt: new Date() })
      .where(and(
        eq(pinnedItems.id, id),
        eq(pinnedItems.userId, userId)
      ))
      .returning();

    res.json({ success: true, item });
  } catch (error: any) {
    console.error('[PINNED] Error updating order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
