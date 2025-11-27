/**
 * ENTERPRISE PHASE 2: Team Scoping Middleware
 * Ensures all queries are filtered by team context
 * Single responsibility: Extract teamId from request and attach to context
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { teamMembers, teams } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface TeamContext {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  isWorkspaceOwner: boolean;
}

declare global {
  namespace Express {
    interface Request {
      teamContext?: TeamContext;
    }
  }
}

/**
 * Middleware: Extract workspace context from request
 * Supports:
 *   - Query param: ?workspaceId=xxx
 *   - Header: X-Workspace-Id: xxx
 *   - Default: User's primary workspace
 */
export async function extractTeamContext(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).authenticatedUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Priority: query param > header > user's primary workspace
    let workspaceId = (req.query.workspaceId as string) || req.get('X-Workspace-Id');

    if (!workspaceId) {
      // Default to user's primary workspace (first workspace they're member of)
      const [memberRecord] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1);

      if (!memberRecord) {
        return res.status(400).json({ error: 'No workspace context - user not member of any workspace' });
      }
      workspaceId = memberRecord.workspaceId;
    }

    // Verify user is member of this workspace
    const membership = await db
      .select()
      .from(teamMembers)
      .where(
        eq(teamMembers.workspaceId, workspaceId) && eq(teamMembers.userId, userId)
      );

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: 'Not member of this workspace' });
    }

    // Attach team context to request
    (req as any).teamContext = {
      workspaceId,
      userId,
      role: membership[0]?.role,
      isWorkspaceOwner: membership[0]?.role === 'owner',
    };

    next();
  } catch (error: any) {
    console.error('[TEAM-SCOPING] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Helper: Add teamId filter to queries
 * Usage: const result = await addTeamFilter(db.select().from(projects), req);
 */
export function getTeamContext(req: Request): TeamContext {
  const context = (req as any).teamContext;
  if (!context) {
    throw new Error('Team context not found - ensure extractTeamContext middleware is applied');
  }
  return context;
}

/**
 * Helper: Require workspace owner role
 */
export function requireTeamAdmin(req: Request, res: Response, next: NextFunction) {
  const context = (req as any).teamContext;
  if (!context?.isWorkspaceOwner) {
    return res.status(403).json({ error: 'Workspace owner role required' });
  }
  next();
}

/**
 * Helper: Verify workspace membership before operation
 */
export async function verifyTeamMembership(userId: string, workspaceId: string): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(teamMembers)
      .where(
        eq(teamMembers.workspaceId, workspaceId) && eq(teamMembers.userId, userId)
      )
      .limit(1);

    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Helper: Get user's workspaces
 */
export async function getUserTeams(userId: string): Promise<typeof teamWorkspaces.$inferSelect[]> {
  try {
    const userWorkspaces = await db
      .select({ workspaceId: teamMembers.workspaceId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    if (userWorkspaces.length === 0) return [];

    const workspaceIds = userWorkspaces.map((w) => w.workspaceId);
    const results = await db
      .select()
      .from(teamWorkspaces)
      .where(teamWorkspaces.id.inArray(workspaceIds));

    return results;
  } catch (error) {
    console.error('[TEAM-SCOPING] Error fetching user workspaces:', error);
    return [];
  }
}
