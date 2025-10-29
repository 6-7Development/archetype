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
  private tableExists: boolean | null = null;

  /**
   * Check if the platform_audit_log table exists
   * This prevents errors when the table hasn't been created yet
   */
  private async checkTableExists(): Promise<boolean> {
    if (this.tableExists !== null) {
      return this.tableExists;
    }

    try {
      // Try a simple query to see if table exists
      await db.select().from(platformAuditLog).limit(1);
      this.tableExists = true;
      return true;
    } catch (error: any) {
      // Check if error is about table not existing
      if (error.message && (
        error.message.includes('does not exist') ||
        error.message.includes('relation') ||
        error.message.includes('platform_audit_log')
      )) {
        console.warn('[AUDIT] Table platform_audit_log does not exist yet. Run database migrations with: npm run db:push');
        this.tableExists = false;
        return false;
      }
      // Other errors - assume table exists but there's a different issue
      this.tableExists = true;
      return true;
    }
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Check if table exists before attempting to write
      const exists = await this.checkTableExists();
      if (!exists) {
        // Silently skip audit logging if table doesn't exist
        // Still log to console for visibility
        console.log(`[AUDIT] ${entry.action} by user ${entry.userId}: ${entry.description} - ${entry.status} (table not created)`);
        return;
      }

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
      const exists = await this.checkTableExists();
      if (!exists) {
        console.warn('[AUDIT] Cannot get history - table does not exist');
        return [];
      }

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
      const exists = await this.checkTableExists();
      if (!exists) {
        console.warn('[AUDIT] Cannot get user activity - table does not exist');
        return [];
      }

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
