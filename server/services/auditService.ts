/**
 * ENTERPRISE PHASE 5: Audit Service
 * Tracks all admin actions (member changes, billing updates, SSO config, etc.) for compliance
 */

import { db } from '../db';
import { auditLogs } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

export interface AuditLogEntry {
  workspaceId: string;
  userId: string;
  action: string; // e.g., 'workspace.created', 'member.added', 'billing.updated'
  resourceType: string; // e.g., 'workspace', 'member', 'billing'
  resourceId?: string;
  changesBefore?: Record<string, any>;
  changesAfter?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failed';
  errorMessage?: string;
}

export class AuditService {
  /**
   * Log an admin action
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        ...entry,
        status: entry.status || 'success',
      });
    } catch (error) {
      console.error('[AUDIT] Error logging action:', error);
    }
  }

  /**
   * Get audit logs for workspace
   */
  static async getWorkspaceAuditLogs(
    workspaceId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: string;
      resourceType?: string;
      daysBack?: number;
    }
  ) {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const daysBack = options?.daysBack || 90;

      const conditions = [eq(auditLogs.workspaceId, workspaceId)];

      // Filter by date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      conditions.push(gte(auditLogs.createdAt, startDate));

      // Optional filters
      if (options?.action) {
        conditions.push(eq(auditLogs.action, options.action));
      }
      if (options?.resourceType) {
        conditions.push(eq(auditLogs.resourceType, options.resourceType));
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return logs;
    } catch (error) {
      console.error('[AUDIT] Error fetching logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for specific user
   */
  static async getUserAuditLogs(
    workspaceId: string,
    userId: string,
    options?: { limit?: number; offset?: number; daysBack?: number }
  ) {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const daysBack = options?.daysBack || 90;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const logs = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.workspaceId, workspaceId),
            eq(auditLogs.userId, userId),
            gte(auditLogs.createdAt, startDate)
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return logs;
    } catch (error) {
      console.error('[AUDIT] Error fetching user logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for specific resource
   */
  static async getResourceAuditLogs(
    workspaceId: string,
    resourceType: string,
    resourceId: string
  ) {
    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.workspaceId, workspaceId),
            eq(auditLogs.resourceType, resourceType),
            eq(auditLogs.resourceId, resourceId)
          )
        )
        .orderBy(desc(auditLogs.createdAt));

      return logs;
    } catch (error) {
      console.error('[AUDIT] Error fetching resource logs:', error);
      return [];
    }
  }

  /**
   * Get summary statistics for workspace
   */
  static async getAuditSummary(workspaceId: string, daysBack: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const logs = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.workspaceId, workspaceId),
            gte(auditLogs.createdAt, startDate)
          )
        );

      // Group by action and status
      const actionCounts: Record<string, { success: number; failed: number }> = {};
      logs.forEach((log) => {
        if (!actionCounts[log.action]) {
          actionCounts[log.action] = { success: 0, failed: 0 };
        }
        if (log.status === 'success') {
          actionCounts[log.action].success++;
        } else {
          actionCounts[log.action].failed++;
        }
      });

      return {
        totalEvents: logs.length,
        successfulActions: logs.filter((l) => l.status === 'success').length,
        failedActions: logs.filter((l) => l.status === 'failed').length,
        actionBreakdown: actionCounts,
        dateRange: { from: startDate, to: new Date() },
      };
    } catch (error) {
      console.error('[AUDIT] Error generating summary:', error);
      return null;
    }
  }
}

export const auditService = new AuditService();
