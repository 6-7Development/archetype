/**
 * ENTERPRISE PHASE 5: Audit Middleware
 * Automatically logs admin operations (member management, billing changes, SSO config)
 */

import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/auditService';

/**
 * Extract client info from request
 */
function getClientInfo(req: Request) {
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Middleware to log admin operations
 * Usage: Apply to routes that perform admin actions
 *
 * Example:
 *   app.post('/api/members/:memberId/update', auditMiddleware('member.updated'), handler)
 */
export function auditMiddleware(action: string, resourceType: string = 'admin') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const context = (req as any).teamContext;
    const userId = (req as any).authenticatedUserId;

    // Capture original response
    const originalJson = res.json;
    const { ipAddress, userAgent } = getClientInfo(req);

    res.json = function (body: any) {
      // Determine status from response
      const httpStatus = res.statusCode;
      const status = httpStatus >= 200 && httpStatus < 400 ? 'success' : 'failed';

      // Log the action
      auditService.log({
        workspaceId: context?.workspaceId,
        userId,
        action,
        resourceType,
        resourceId: req.params.id || req.params.memberId || req.params.settingId,
        changesAfter: req.body,
        ipAddress,
        userAgent,
        status,
        errorMessage: status === 'failed' ? body?.error || 'Unknown error' : undefined,
      });

      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Helper to manually log an audit entry
 * Usage: auditLog(req, 'workspace.created', 'workspace', workspaceId, null, newWorkspaceData)
 */
export async function auditLog(
  req: Request,
  action: string,
  resourceType: string,
  resourceId: string | undefined,
  changesBefore: Record<string, any> | null,
  changesAfter: Record<string, any> | null
) {
  const context = (req as any).teamContext;
  const userId = (req as any).authenticatedUserId;
  const { ipAddress, userAgent } = getClientInfo(req);

  await auditService.log({
    workspaceId: context?.workspaceId,
    userId,
    action,
    resourceType,
    resourceId,
    changesBefore: changesBefore || undefined,
    changesAfter: changesAfter || undefined,
    ipAddress,
    userAgent,
    status: 'success',
  });
}
