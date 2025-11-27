import { db } from '../db';
import { sessions } from '@shared/schema';
import { lt } from 'drizzle-orm';

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start a background job to clean up expired sessions every 24 hours
 * - Logs session count before and after deletion
 * - Deletes sessions where expire < NOW() - 30 days
 * - Gracefully handles errors
 */
export async function startSessionCleanupJob(): Promise<void> {
  try {
    // Run cleanup immediately on startup
    console.log('🧹 Starting initial session cleanup...');
    await performSessionCleanup();
    
    // Schedule cleanup to run every 24 hours
    cleanupInterval = setInterval(async () => {
      try {
        await performSessionCleanup();
      } catch (error: any) {
        console.error('❌ Session cleanup job failed:', error.message);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
    
    console.log('✅ Session cleanup job scheduled (runs every 24 hours)');
  } catch (error: any) {
    console.error('❌ Failed to start session cleanup job:', error.message);
    // Don't throw - allow server to continue even if job initialization fails
  }
}

/**
 * Perform the actual session cleanup
 * - Logs current session count
 * - Deletes expired sessions (older than 30 days)
 * - Logs deleted count
 */
async function performSessionCleanup(): Promise<void> {
  try {
    // Get current session count before deletion
    const beforeCount = await db
      .select()
      .from(sessions);
    
    console.log(`📊 Current session count: ${beforeCount.length}`);
    
    // Calculate the cutoff date (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Delete expired sessions
    const deletedSessions = await db
      .delete(sessions)
      .where(lt(sessions.expire, thirtyDaysAgo))
      .returning({ sid: sessions.sid });
    
    // Get session count after deletion
    const afterCount = await db
      .select()
      .from(sessions);
    
    const deletedCount = deletedSessions.length;
    
    if (deletedCount > 0) {
      console.log(`✅ Session cleanup complete: Deleted ${deletedCount} expired sessions`);
      console.log(`📊 Session count after cleanup: ${afterCount.length}`);
    } else {
      console.log('✅ Session cleanup complete: No expired sessions found');
    }
  } catch (error: any) {
    console.error('❌ Error during session cleanup:', error.message);
    if (error.code) {
      console.error('   Database error code:', error.code);
    }
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Stop the session cleanup job
 * Used for graceful shutdown
 */
export function stopSessionCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('⏹️ Session cleanup job stopped');
  }
}
