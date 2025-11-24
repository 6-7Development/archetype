/**
 * Automatic Chat Message Cleanup Service
 * Prevents database bloat by removing empty, stale, and orphaned messages
 */

import { db } from '../db.ts';
import { chatMessages } from '@shared/schema';
import { eq, and, isNull, lt, or, like } from 'drizzle-orm';

const CLEANUP_INTERVAL = 60 * 60 * 1000; // Run every hour
const STALE_MESSAGE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const EMPTY_MESSAGE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CleanupStats {
  emptyMessages: number;
  staleMessages: number;
  orphanedMessages: number;
  invalidToolMessages: number;
  totalRemoved: number;
}

/**
 * Clean empty chat messages (created but never filled with content)
 */
async function cleanEmptyMessages(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - EMPTY_MESSAGE_AGE);

  const result = await db
    .delete(chatMessages)
    .where(
      and(
        or(
          eq(chatMessages.content, ''),
          eq(chatMessages.content, null as any),
          like(chatMessages.content, '%undefined%'),
          like(chatMessages.content, '%null%')
        ),
        lt(chatMessages.createdAt, sevenDaysAgo)
      )
    )
    .returning({ id: chatMessages.id });

  return result.length;
}

/**
 * Clean stale messages older than 30 days
 */
async function cleanStaleMessages(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - STALE_MESSAGE_AGE);

  const result = await db
    .delete(chatMessages)
    .where(lt(chatMessages.createdAt, thirtyDaysAgo))
    .returning({ id: chatMessages.id });

  return result.length;
}

/**
 * Clean messages with invalid/malformed tool calls
 */
async function cleanInvalidToolMessages(): Promise<number> {
  const result = await db
    .delete(chatMessages)
    .where(
      and(
        eq(chatMessages.role, 'tool'),
        or(
          like(chatMessages.content, '%createTaskList(%'),
          like(chatMessages.content, '%updateTask(%'),
          like(chatMessages.content, '%readTaskList(%'),
          like(chatMessages.content, '%startSubagent(%'),
          like(chatMessages.content, '%architectConsult(%'),
          like(chatMessages.content, '%performDiagnosis(%'),
          like(chatMessages.content, '%readPlatformFile(%'),
          like(chatMessages.content, '%writePlatformFile(%'),
          like(chatMessages.content, '%listPlatformDirectory(%')
        )
      )
    )
    .returning({ id: chatMessages.id });

  return result.length;
}

/**
 * Clean orphaned messages (no user or project context)
 */
async function cleanOrphanedMessages(): Promise<number> {
  const result = await db
    .delete(chatMessages)
    .where(
      and(
        isNull(chatMessages.userId),
        isNull(chatMessages.projectId),
        lt(chatMessages.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // 24 hours old
      )
    )
    .returning({ id: chatMessages.id });

  return result.length;
}

/**
 * Run complete cleanup cycle
 */
export async function runChatCleanup(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    emptyMessages: 0,
    staleMessages: 0,
    orphanedMessages: 0,
    invalidToolMessages: 0,
    totalRemoved: 0,
  };

  try {
    console.log('🧹 [CHAT-CLEANUP] Starting automatic chat message cleanup...');

    stats.emptyMessages = await cleanEmptyMessages();
    stats.staleMessages = await cleanStaleMessages();
    stats.invalidToolMessages = await cleanInvalidToolMessages();
    stats.orphanedMessages = await cleanOrphanedMessages();

    stats.totalRemoved = stats.emptyMessages + stats.staleMessages + stats.invalidToolMessages + stats.orphanedMessages;

    if (stats.totalRemoved > 0) {
      console.log(`✅ [CHAT-CLEANUP] Removed ${stats.totalRemoved} messages:`);
      console.log(`   - Empty: ${stats.emptyMessages}`);
      console.log(`   - Stale: ${stats.staleMessages}`);
      console.log(`   - Invalid Tools: ${stats.invalidToolMessages}`);
      console.log(`   - Orphaned: ${stats.orphanedMessages}`);
    } else {
      console.log('✅ [CHAT-CLEANUP] Database is clean - no messages removed');
    }

    return stats;
  } catch (error: any) {
    console.error('❌ [CHAT-CLEANUP] Cleanup failed:', error.message);
    return stats;
  }
}

/**
 * Start periodic cleanup scheduler
 */
export async function startCleanupScheduler() {
  console.log(`⏱️  [CHAT-CLEANUP] Starting scheduler (interval: ${CLEANUP_INTERVAL / 1000 / 60} minutes)`);

  // Run cleanup immediately on startup
  await runChatCleanup();

  // Schedule periodic cleanup
  setInterval(async () => {
    await runChatCleanup();
  }, CLEANUP_INTERVAL);

  console.log('✅ [CHAT-CLEANUP] Scheduler started successfully');
}
