import { Router, type Request, Response } from 'express';
import { db } from '../db';
import { aiKnowledgeBase, aiFixAttempts } from '@shared/schema';
import { desc, eq, sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/ai-knowledge/stats
 * Get AI knowledge base statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // Get total knowledge entries
    const [totalEntries] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiKnowledgeBase);

    // Get total fix attempts
    const [totalAttempts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiFixAttempts);

    // Get success rate
    const [successfulAttempts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiFixAttempts)
      .where(eq(aiFixAttempts.outcome, 'success'));

    // Get average confidence
    const [avgConfidence] = await db
      .select({ avg: sql<number>`avg(confidence)::float` })
      .from(aiKnowledgeBase);

    // Get most common error types
    const topErrors = await db
      .select({
        errorType: aiKnowledgeBase.errorType,
        count: sql<number>`count(*)::int`,
        avgConfidence: sql<number>`avg(confidence)::float`,
      })
      .from(aiKnowledgeBase)
      .groupBy(aiKnowledgeBase.errorType)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Get recent learning activity
    const recentLearning = await db
      .select({
        date: sql<string>`date(last_encountered)`,
        newErrors: sql<number>`count(*)::int`,
      })
      .from(aiKnowledgeBase)
      .groupBy(sql`date(last_encountered)`)
      .orderBy(desc(sql`date(last_encountered)`))
      .limit(7);

    const successRate =
      totalAttempts.count > 0 ? ((successfulAttempts.count / totalAttempts.count) * 100).toFixed(1) : '0.0';

    res.json({
      totalKnowledgeEntries: totalEntries.count,
      totalFixAttempts: totalAttempts.count,
      successfulFixes: successfulAttempts.count,
      successRate: parseFloat(successRate),
      averageConfidence: avgConfidence.avg ? parseFloat(avgConfidence.avg.toFixed(2)) : 0,
      topErrorTypes: topErrors.map((e) => ({
        type: e.errorType,
        occurrences: e.count,
        avgConfidence: e.avgConfidence ? parseFloat(e.avgConfidence.toFixed(2)) : 0,
      })),
      recentLearning: recentLearning.map((l) => ({
        date: l.date,
        newErrors: l.newErrors,
      })),
    });
  } catch (error) {
    console.error('[AI-KNOWLEDGE] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch AI knowledge stats' });
  }
});

/**
 * GET /api/ai-knowledge/errors
 * List known error patterns with pagination
 */
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const errors = await db
      .select({
        id: aiKnowledgeBase.id,
        errorSignature: aiKnowledgeBase.errorSignature,
        errorType: aiKnowledgeBase.errorType,
        confidence: aiKnowledgeBase.confidence,
        timesEncountered: aiKnowledgeBase.timesEncountered,
        timesFixed: aiKnowledgeBase.timesFixed,
        lastEncountered: aiKnowledgeBase.lastEncountered,
        context: aiKnowledgeBase.context,
      })
      .from(aiKnowledgeBase)
      .orderBy(desc(aiKnowledgeBase.confidence), desc(aiKnowledgeBase.lastEncountered))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [total] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiKnowledgeBase);

    res.json({
      errors: errors.map((e) => ({
        id: e.id,
        errorSignature: e.errorSignature,
        errorType: e.errorType,
        confidence: parseFloat(e.confidence),
        timesEncountered: e.timesEncountered,
        timesFixed: e.timesFixed,
        successRate: e.timesEncountered > 0 ? ((e.timesFixed / e.timesEncountered) * 100).toFixed(1) : '0.0',
        lastEncountered: e.lastEncountered,
        context: e.context,
      })),
      pagination: {
        page,
        limit,
        total: total.count,
        totalPages: Math.ceil(total.count / limit),
      },
    });
  } catch (error) {
    console.error('[AI-KNOWLEDGE] Error fetching errors:', error);
    res.status(500).json({ error: 'Failed to fetch error patterns' });
  }
});

/**
 * GET /api/ai-knowledge/errors/:id
 * Get detailed information about a specific error pattern
 */
router.get('/errors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [error] = await db
      .select()
      .from(aiKnowledgeBase)
      .where(eq(aiKnowledgeBase.id, id))
      .limit(1);

    if (!error) {
      return res.status(404).json({ error: 'Error pattern not found' });
    }

    // Get fix attempts for this error
    const attempts = await db
      .select()
      .from(aiFixAttempts)
      .where(eq(aiFixAttempts.errorSignature, error.errorSignature))
      .orderBy(desc(aiFixAttempts.createdAt))
      .limit(10);

    res.json({
      error: {
        ...error,
        confidence: parseFloat(error.confidence),
        successRate: error.timesEncountered > 0 ? ((error.timesFixed / error.timesEncountered) * 100).toFixed(1) : '0.0',
      },
      fixAttempts: attempts.map((a) => ({
        ...a,
        confidenceScore: parseFloat(a.confidenceScore),
      })),
    });
  } catch (error) {
    console.error('[AI-KNOWLEDGE] Error fetching error details:', error);
    res.status(500).json({ error: 'Failed to fetch error details' });
  }
});

/**
 * POST /api/ai-knowledge/reset
 * Admin only: Clear the knowledge base (dangerous!)
 */
router.post('/reset', async (req: any, res: Response) => {
  try {
    // Check if user is admin or owner
    const user = req.session?.user;
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Delete all knowledge base entries
    const [deletedKnowledge] = await db
      .delete(aiKnowledgeBase)
      .returning({ count: sql<number>`count(*)::int` });

    // Delete all fix attempts
    const [deletedAttempts] = await db
      .delete(aiFixAttempts)
      .returning({ count: sql<number>`count(*)::int` });

    console.log(`[AI-KNOWLEDGE] ⚠️ Knowledge base reset by ${user.email}`);

    res.json({
      message: 'AI knowledge base reset successfully',
      deletedKnowledgeEntries: deletedKnowledge?.count || 0,
      deletedAttempts: deletedAttempts?.count || 0,
    });
  } catch (error) {
    console.error('[AI-KNOWLEDGE] Error resetting knowledge base:', error);
    res.status(500).json({ error: 'Failed to reset knowledge base' });
  }
});

export default router;
