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
  teamId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  isTeamAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      teamContext?: TeamContext;
    }
  }
}

/**
 * Middleware: Extract team context from request
 * Supports:
 *   - Query param: ?teamId=xxx
 *   - Header: X-Team-Id: xxx
 *   - Default: User's primary team (from user profile)
 */
export async function extractTeamContext(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).authenticatedUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Priority: query param > header > user's primary team
    let teamId = (req.query.teamId as string) || req.get('X-Team-Id');

    if (!teamId) {
      // Default to user's primary team (first team they're member of)
      const [memberRecord] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1);

      if (!memberRecord) {
        return res.status(400).json({ error: 'No team context - user not member of any team' });
      }
      teamId = memberRecord.teamId;
    }

    // Verify user is member of this team
    const membership = await db
      .select()
      .from(teamMembers)
      .where(
        eq(teamMembers.teamId, teamId) && eq(teamMembers.userId, userId)
      );

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: 'Not member of this team' });
    }

    // Attach team context to request
    (req as any).teamContext = {
      teamId,
      userId,
      role: membership[0]?.role,
      isTeamAdmin: membership[0]?.role === 'admin',
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
 * Helper: Require team admin role
 */
export function requireTeamAdmin(req: Request, res: Response, next: NextFunction) {
  const context = (req as any).teamContext;
  if (!context?.isTeamAdmin) {
    return res.status(403).json({ error: 'Team admin role required' });
  }
  next();
}

/**
 * Helper: Verify team membership before operation
 */
export async function verifyTeamMembership(userId: string, teamId: string): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(teamMembers)
      .where(
        eq(teamMembers.teamId, teamId) && eq(teamMembers.userId, userId)
      )
      .limit(1);

    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Helper: Get user's teams
 */
export async function getUserTeams(userId: string): Promise<typeof teams.$inferSelect[]> {
  try {
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    if (userTeams.length === 0) return [];

    const teamIds = userTeams.map((t) => t.teamId);
    const results = await db
      .select()
      .from(teams)
      .where(teams.id.inArray(teamIds));

    return results;
  } catch (error) {
    console.error('[TEAM-SCOPING] Error fetching user teams:', error);
    return [];
  }
}
