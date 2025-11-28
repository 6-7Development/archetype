import { db } from '../db';
import { auditRetentionPolicies } from '@shared/schema';
import { logger, logJob } from './logger';
import { sql, lt, and, eq } from 'drizzle-orm';

/**
 * Purge expired audit logs based on retention policies
 * This job runs hourly to enforce data retention compliance
 */
export async function purgeExpiredAuditLogs(): Promise<void> {
  const startTime = Date.now();
  let totalPurged = 0;
  
  try {
    logger.info('Starting audit log retention check...');
    
    // Get all enabled retention policies
    const policies = await db.query.auditRetentionPolicies.findMany({
      where: eq(auditRetentionPolicies.enabled, true),
    });
    
    logger.info(`Found ${policies.length} active retention policies`);
    
    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
      
      try {
        // Delete expired logs based on log type
        // Note: This assumes audit_logs table exists with logType and createdAt columns
        const result = await db.execute(sql`
          DELETE FROM audit_logs 
          WHERE log_type = ${policy.logType}
          AND workspace_id = ${policy.workspaceId}
          AND created_at < ${cutoffDate}
        `);
        
        const purgedCount = (result as any).rowCount || 0;
        totalPurged += purgedCount;
        
        if (purgedCount > 0) {
          logger.info(`Purged ${purgedCount} ${policy.logType} logs for workspace ${policy.workspaceId}`, {
            workspaceId: policy.workspaceId,
            logType: policy.logType,
            retentionDays: policy.retentionDays,
            cutoffDate: cutoffDate.toISOString(),
            purgedCount,
          });
        }
        
        // Update policy with last purge timestamp
        await db
          .update(auditRetentionPolicies)
          .set({
            lastPurgeAt: new Date(),
            nextPurgeAt: new Date(Date.now() + 3600000), // Next run in 1 hour
            updatedAt: new Date(),
          })
          .where(eq(auditRetentionPolicies.id, policy.id));
          
      } catch (error: any) {
        logger.error(`Failed to purge logs for policy ${policy.id}`, {
          error: error.message,
          policyId: policy.id,
          workspaceId: policy.workspaceId,
        });
      }
    }
    
    const duration = Date.now() - startTime;
    logJob('audit-retention', 'completed', duration);
    
    logger.info('Audit log retention check completed', {
      totalPolicies: policies.length,
      totalPurged,
      durationMs: duration,
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logJob('audit-retention', 'failed', duration, error);
    logger.error('Audit log retention check failed', { error: error.message });
  }
}

/**
 * Create or update a retention policy for a workspace
 */
export async function upsertRetentionPolicy(
  workspaceId: string,
  logType: string,
  retentionDays: number
): Promise<void> {
  try {
    // Check if policy exists
    const existing = await db.query.auditRetentionPolicies.findFirst({
      where: and(
        eq(auditRetentionPolicies.workspaceId, workspaceId),
        eq(auditRetentionPolicies.logType, logType)
      ),
    });
    
    if (existing) {
      await db
        .update(auditRetentionPolicies)
        .set({
          retentionDays,
          updatedAt: new Date(),
        })
        .where(eq(auditRetentionPolicies.id, existing.id));
        
      logger.info('Updated retention policy', { workspaceId, logType, retentionDays });
    } else {
      await db.insert(auditRetentionPolicies).values({
        workspaceId,
        logType,
        retentionDays,
        nextPurgeAt: new Date(Date.now() + 3600000),
      });
      
      logger.info('Created retention policy', { workspaceId, logType, retentionDays });
    }
  } catch (error: any) {
    logger.error('Failed to upsert retention policy', {
      error: error.message,
      workspaceId,
      logType,
    });
    throw error;
  }
}

/**
 * Get retention policies for a workspace
 */
export async function getWorkspaceRetentionPolicies(workspaceId: string) {
  return db.query.auditRetentionPolicies.findMany({
    where: eq(auditRetentionPolicies.workspaceId, workspaceId),
  });
}
