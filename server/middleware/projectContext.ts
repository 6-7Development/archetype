import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { projectSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request type to include activeProjectId
declare global {
  namespace Express {
    interface Request {
      activeProjectId?: string;
    }
  }
}

/**
 * Middleware to require an active project for agent operations
 * Ensures project isolation by enforcing that user has selected a project
 */
export async function requireActiveProject(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.authenticatedUserId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user's active project session
    const [session] = await db
      .select()
      .from(projectSessions)
      .where(eq(projectSessions.userId, userId))
      .limit(1);

    if (!session || !session.activeProjectId) {
      return res.status(400).json({
        error: 'No active project',
        message: 'Please select a project before using the agent',
        requiresProjectSelection: true,
      });
    }

    // Attach activeProjectId to request for downstream use
    req.activeProjectId = session.activeProjectId;
    next();
  } catch (error: any) {
    console.error('[PROJECT-CONTEXT] Error checking active project:', error);
    res.status(500).json({ error: 'Failed to verify active project' });
  }
}

/**
 * Optional middleware to load active project ID if available (doesn't enforce)
 */
export async function loadActiveProject(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.authenticatedUserId;

    if (userId) {
      const [session] = await db
        .select()
        .from(projectSessions)
        .where(eq(projectSessions.userId, userId))
        .limit(1);

      if (session?.activeProjectId) {
        req.activeProjectId = session.activeProjectId;
      }
    }

    next();
  } catch (error: any) {
    console.error('[PROJECT-CONTEXT] Error loading active project:', error);
    // Don't fail the request - just continue without active project
    next();
  }
}
