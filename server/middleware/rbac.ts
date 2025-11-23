/**
 * RBAC (Role-Based Access Control) Middleware
 * Enforces access control based on user roles and project ownership
 */

import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'user' | 'admin';
    isOwner: boolean;
  };
  project?: {
    id: string;
    ownerId: string;
  };
}

/**
 * Check if user owns the project
 */
export async function isProjectOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const { projectId } = req.params;
  const userId = req.user?.id;

  if (!projectId || !userId) {
    return res.status(400).json({ success: false, error: 'Missing projectId or userId' });
  }

  try {
    // In production, fetch from database
    // For now, assume req.project is set by upstream middleware
    const isOwner = req.project?.ownerId === userId;

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'You do not own this project',
        severity: 'unauthorized',
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
}

/**
 * Check if user is admin or platform owner
 */
export function isAdminOrOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const isAdmin = user.role === 'admin' || user.isOwner;
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'This action requires admin or owner privileges',
      severity: 'unauthorized',
    });
  }

  next();
}

/**
 * Check if user is platform owner (for platform healing)
 */
export function isPlatformOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.user;

  if (!user?.isOwner) {
    return res.status(403).json({
      success: false,
      error: 'Platform healing requires owner privileges',
      severity: 'unauthorized',
    });
  }

  next();
}

/**
 * Determine user role in a specific project context
 */
export function getUserProjectRole(
  user: any,
  projectOwnerId: string
): 'owner' | 'member' | 'admin' | 'super_admin' {
  if (user.isOwner) return 'super_admin';
  if (user.role === 'admin') return 'admin';
  if (user.id === projectOwnerId) return 'owner';
  return 'member';
}

/**
 * Check if user can edit a project file
 */
export function canEditProjectFile(
  user: any,
  projectOwnerId: string,
  filePermissions?: {
    canEditCritical: boolean;
    canEditProtected: boolean;
  }
): boolean {
  const role = getUserProjectRole(user, projectOwnerId);

  // Super admin can do anything
  if (role === 'super_admin') return true;

  // Admin can edit protected and editable
  if (role === 'admin') return !filePermissions?.canEditCritical;

  // Owner can edit protected and editable
  if (role === 'owner') return !filePermissions?.canEditCritical;

  // Members can only edit editable files
  return false;
}

/**
 * Check if user can heal platform
 */
export function canHealPlatform(user: any): boolean {
  return user?.isOwner === true;
}

/**
 * Check if user can approve changes
 */
export function canApproveChanges(
  user: any,
  projectOwnerId: string
): boolean {
  const role = getUserProjectRole(user, projectOwnerId);
  return role === 'owner' || role === 'admin' || role === 'super_admin';
}
