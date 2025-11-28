import { startSessionCleanupJob, stopSessionCleanupJob } from '../services/sessionCleanupService';
import { processWebhookQueue } from '../services/webhookQueueService';
import { purgeExpiredAuditLogs } from '../services/auditRetentionService';
import { logger } from '../services/logger';

let webhookQueueInterval: NodeJS.Timeout | null = null;
let auditRetentionInterval: NodeJS.Timeout | null = null;

/**
 * Initialize all background jobs
 * Called during server startup after database is ready
 */
export async function initializeJobs(): Promise<void> {
  try {
    logger.info('Initializing background jobs...');
    
    // Start the session cleanup job (runs every 24 hours)
    await startSessionCleanupJob();
    
    // Start the webhook queue processor (runs every 30 seconds)
    startWebhookQueueProcessor();
    
    // Start audit log retention job (runs every hour)
    startAuditRetentionJob();
    
    logger.info('Background jobs initialized successfully', {
      jobs: ['session-cleanup', 'webhook-queue', 'audit-retention']
    });
    console.log('✅ Background jobs initialized');
  } catch (error: any) {
    logger.error('Failed to initialize background jobs', { error: error.message });
    console.error('❌ Failed to initialize background jobs:', error.message);
  }
}

/**
 * Start the webhook queue processor
 * Processes pending webhooks with exponential backoff retry
 */
function startWebhookQueueProcessor(): void {
  logger.info('Starting webhook queue processor (30s interval)');
  
  webhookQueueInterval = setInterval(async () => {
    try {
      await processWebhookQueue();
    } catch (error: any) {
      logger.error('Webhook queue processor error', { error: error.message });
    }
  }, 30000); // Every 30 seconds
  
  console.log('✅ Webhook queue processor started');
}

/**
 * Start the audit log retention job
 * Purges expired audit logs based on retention policies
 */
function startAuditRetentionJob(): void {
  logger.info('Starting audit retention job (1h interval)');
  
  auditRetentionInterval = setInterval(async () => {
    try {
      await purgeExpiredAuditLogs();
    } catch (error: any) {
      logger.error('Audit retention job error', { error: error.message });
    }
  }, 3600000); // Every hour
  
  console.log('✅ Audit log retention job started');
}

/**
 * Cleanup all background jobs
 * Called during graceful shutdown
 */
export function cleanupJobs(): void {
  try {
    logger.info('Cleaning up background jobs...');
    console.log('🧹 Cleaning up background jobs...');
    
    stopSessionCleanupJob();
    
    if (webhookQueueInterval) {
      clearInterval(webhookQueueInterval);
      webhookQueueInterval = null;
    }
    
    if (auditRetentionInterval) {
      clearInterval(auditRetentionInterval);
      auditRetentionInterval = null;
    }
    
    logger.info('Background jobs cleaned up successfully');
    console.log('✅ Background jobs cleaned up');
  } catch (error: any) {
    logger.error('Error during job cleanup', { error: error.message });
    console.error('⚠️ Error during job cleanup:', error.message);
  }
}
