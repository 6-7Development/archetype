import { db } from './db';
import { platformAuditLog } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface AuditLogEntry {
  userId: string;
  action: 'heal' | 'rollback' | 'backup' | 'restore';
  description: string;
  changes?: any;
  backupId?: string;
  commitHash?: string;
  status: 'success' | 'failure' | 'pending';
  error?: string;
}

export class PlatformAuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await db.insert(platformAuditLog).values({
        userId: entry.userId,
        action: entry.action,
        description: entry.description,
        changes: entry.changes,
        backupId: entry.backupId,
        commitHash: entry.commitHash,
        status: entry.status,
        error: entry.error,
      });

      console.log(`[AUDIT] ${entry.action} by user ${entry.userId}: ${entry.description} - ${entry.status}`);
    } catch (error: any) {
      console.error('[AUDIT] Failed to write audit log:', error);
    }
  }

  async getHistory(limit: number = 50): Promise<any[]> {
    try {
      const logs = await db
        .select()
        .from(platformAuditLog)
        .orderBy(platformAuditLog.createdAt)
        .limit(limit);

      return logs;
    } catch (error: any) {
      console.error('[AUDIT] Failed to get audit history:', error);
      return [];
    }
  }

  async getUserActivity(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const logs = await db
        .select()
        .from(platformAuditLog)
        .where(eq(platformAuditLog.userId, userId))
        .orderBy(platformAuditLog.createdAt)
        .limit(limit);

      return logs;
    } catch (error: any) {
      console.error('[AUDIT] Failed to get user activity:', error);
      return [];
    }
  }
}

export const platformAudit = new PlatformAuditService();
