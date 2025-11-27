import { startSessionCleanupJob, stopSessionCleanupJob } from '../services/sessionCleanupService';

/**
 * Initialize all background jobs
 * Called during server startup after database is ready
 */
export async function initializeJobs(): Promise<void> {
  try {
    console.log('🚀 Initializing background jobs...');
    
    // Start the session cleanup job (runs every 24 hours)
    await startSessionCleanupJob();
    
    console.log('✅ Background jobs initialized');
  } catch (error: any) {
    console.error('❌ Failed to initialize background jobs:', error.message);
    // Don't throw - allow server to continue even if job initialization fails
    // The jobs are important but not critical to server functionality
  }
}

/**
 * Cleanup all background jobs
 * Called during graceful shutdown
 */
export function cleanupJobs(): void {
  try {
    console.log('🧹 Cleaning up background jobs...');
    stopSessionCleanupJob();
    console.log('✅ Background jobs cleaned up');
  } catch (error: any) {
    console.error('⚠️ Error during job cleanup:', error.message);
  }
}
