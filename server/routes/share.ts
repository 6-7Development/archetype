import { Router } from 'express';
import { isAuthenticated } from '../universalAuth';
import { db } from '../db';
import { shareLinks, projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

const createShareSchema = z.object({
  projectId: z.string().uuid(),
  expiresIn: z.enum(['1h', '24h', '7d', 'never']).default('24h'),
  isPublic: z.boolean().default(true),
});

function generateShortCode(): string {
  return crypto.randomBytes(6).toString('base64url');
}

function calculateExpiry(expiresIn: string): Date | null {
  if (expiresIn === 'never') return null;
  
  const now = new Date();
  switch (expiresIn) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const validation = createShareSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }
    
    const { projectId, expiresIn, isPublic } = validation.data;
    
    const project = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, userId)
      ))
      .limit(1);
    
    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const shortCode = generateShortCode();
    const expiresAt = calculateExpiry(expiresIn);
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000';
    
    const [shareLink] = await db
      .insert(shareLinks)
      .values({
        projectId,
        userId,
        shortCode,
        expiresAt,
        isPublic,
        accessCount: 0,
      })
      .returning();
    
    console.log(`[SHARE] Created share link ${shortCode} for project ${projectId}`);
    
    res.json({
      id: shareLink.id,
      url: `${baseUrl}/s/${shortCode}`,
      shortCode: shareLink.shortCode,
      expiresAt: shareLink.expiresAt?.toISOString() || null,
      accessCount: shareLink.accessCount,
      isPublic: shareLink.isPublic,
    });
  } catch (error: any) {
    console.error('[SHARE] Error creating share link:', error);
    res.status(500).json({ error: error.message || 'Failed to create share link' });
  }
});

router.get('/:shortCode', async (req: any, res) => {
  try {
    const { shortCode } = req.params;
    
    const [shareLink] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.shortCode, shortCode))
      .limit(1);
    
    if (!shareLink) {
      return res.status(404).json({ error: 'Share link not found' });
    }
    
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }
    
    if (!shareLink.isPublic && !req.authenticatedUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    await db
      .update(shareLinks)
      .set({ accessCount: shareLink.accessCount + 1 })
      .where(eq(shareLinks.id, shareLink.id));
    
    res.json({
      projectId: shareLink.projectId,
      isPublic: shareLink.isPublic,
      accessCount: shareLink.accessCount + 1,
    });
  } catch (error: any) {
    console.error('[SHARE] Error accessing share link:', error);
    res.status(500).json({ error: error.message || 'Failed to access share link' });
  }
});

router.get('/project/:projectId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { projectId } = req.params;
    
    const links = await db
      .select()
      .from(shareLinks)
      .where(and(
        eq(shareLinks.projectId, projectId),
        eq(shareLinks.userId, userId)
      ));
    
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000';
    
    res.json(links.map(link => ({
      id: link.id,
      url: `${baseUrl}/s/${link.shortCode}`,
      shortCode: link.shortCode,
      expiresAt: link.expiresAt?.toISOString() || null,
      accessCount: link.accessCount,
      isPublic: link.isPublic,
      createdAt: link.createdAt,
    })));
  } catch (error: any) {
    console.error('[SHARE] Error fetching share links:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch share links' });
  }
});

router.delete('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { id } = req.params;
    
    await db
      .delete(shareLinks)
      .where(and(
        eq(shareLinks.id, id),
        eq(shareLinks.userId, userId)
      ));
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[SHARE] Error deleting share link:', error);
    res.status(500).json({ error: error.message || 'Failed to delete share link' });
  }
});

export function registerShareRoutes(app: any) {
  app.use('/api/share', router);
  console.log('[SHARE] Share routes registered at /api/share');
}
