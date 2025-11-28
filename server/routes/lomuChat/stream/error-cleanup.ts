/**
 * Error Handling and Cleanup Module for Hexad Stream Handler
 * 
 * This module contains centralized error handling and cleanup logic
 * extracted from the main stream handler (lines 4500-4649 of lomuChat.ts).
 * 
 * Key responsibilities:
 * - Error message persistence with graceful fallback
 * - Trace logging on failures
 * - Billing reconciliation for both FREE (platform) and PAID (project) modes
 * - Stream resource cleanup (heartbeat, timeout, active streams tracking)
 * 
 * @module error-cleanup
 */

import type { Response } from 'express';
import { db } from '../../../db.ts';
import { chatMessages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { performanceMonitor } from '../../../services/performanceMonitor.ts';
import { traceLogger } from '../../../services/traceLogger.ts';
import { terminateStream } from '../streaming.ts';
import { handleBilling } from '../../lomu/utils.ts';

/**
 * Context for error handling operations
 * Contains all necessary state to handle errors gracefully
 */
export interface ErrorHandlerContext {
  error: Error;
  userId: string;
  conversationState: any;
  res: Response;
  sendEvent: (type: string, data: any) => void;
  heartbeatInterval?: NodeJS.Timeout;
}

/**
 * Context for cleanup operations
 * Contains all resources that need to be released on stream end
 */
export interface CleanupContext {
  userId: string;
  targetContext: 'platform' | 'project';
  totalCreditsUsed: number;
  agentRunId: string;
  activeStreamsKey: string;
  activeStreams: Set<string>;
  streamTimeoutId?: NodeJS.Timeout;
  heartbeatInterval?: NodeJS.Timeout;
}

/**
 * Handle stream errors with graceful degradation
 * 
 * This function performs the following operations:
 * 1. Records error in performance monitor
 * 2. Clears heartbeat interval to prevent memory leaks
 * 3. Persists trace for debugging even on failure
 * 4. Saves friendly error message to database
 * 5. Terminates stream with error event
 * 
 * Graceful fallback: If DB save fails, still sends error event with temporary ID
 * 
 * @param context - Error handler context with all necessary state
 * @returns Promise<void>
 */
export async function handleStreamError(context: ErrorHandlerContext): Promise<void> {
  const { error, userId, conversationState, res, sendEvent, heartbeatInterval } = context;

  console.error('[LOMU-AI-CHAT] Stream error:', error);

  // 🆕 Record error in performance monitor for telemetry
  try {
    performanceMonitor.recordError(error.message || 'Unknown error');
  } catch (monitorError: any) {
    console.error('[ERROR-CLEANUP] Failed to record performance error:', monitorError.message);
  }

  // 🔥 RAILWAY FIX: Clear heartbeat on error to prevent memory leaks
  // Critical for long-running processes on Railway/serverless platforms
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    console.log('[LOMU-AI-HEARTBEAT] Cleared on error');
  }

  // 🔍 FIX 2: TRACE PERSISTENCE - Persist trace even on failure
  // This ensures debugging data is available for failed requests
  try {
    if (conversationState?.traceId) {
      await traceLogger.persist(
        conversationState.traceId,
        conversationState.id,
        userId
      );
      console.log(`[TRACE] Persisted trace on error: ${conversationState.traceId}`);
    }
  } catch (traceError: any) {
    console.error('[TRACE] Failed to persist trace on error:', traceError.message);
  }

  // Save error message to DB with friendly user-facing message
  try {
    const errorMsg = `Oops! Something went wrong: ${error.message}. Don't worry, I'm on it! Let me try a different approach. 🍋`;
    const [errorAssistantMsg] = await db.insert(chatMessages).values({
      userId,
      projectId: null,
      conversationStateId: conversationState?.id || null,
      fileId: null,
      role: 'assistant',
      content: errorMsg,
      isPlatformHealing: true,
    }).returning();

    // Send error and done events, then close stream
    terminateStream(res, sendEvent, errorAssistantMsg.id, `Oops! ${error.message}. Let me try again!`);
  } catch (dbError: any) {
    // GRACEFUL FALLBACK: If we can't save to DB, still notify user
    // This prevents silent failures and provides better UX
    console.error('[LOMU-AI-CHAT] Failed to save error message:', dbError);
    terminateStream(res, sendEvent, 'error-' + Date.now(), `Something went sideways, but I'm still here to help!`);
  }
}

/**
 * Clean up stream resources
 * 
 * This function is called in the `finally` block to ensure resources are
 * always released, regardless of success or failure.
 * 
 * Operations performed:
 * 1. Remove stream from active streams registry
 * 2. Clear stream timeout to prevent orphaned timeouts
 * 3. Clear heartbeat interval to prevent memory leaks
 * 
 * ✅ FIX #5: BILLING MOVED TO ORCHESTRATOR
 * Billing is now handled ONLY in orchestrator's finally block after all iterations complete.
 * This prevents double-billing that occurred when both error-cleanup and orchestrator called handleBilling.
 * 
 * @param context - Cleanup context with all resources to release
 * @returns Promise<void>
 */
export async function cleanupStream(context: CleanupContext): Promise<void> {
  const {
    userId,
    activeStreamsKey,
    activeStreams,
    streamTimeoutId,
    heartbeatInterval,
  } = context;

  // ✅ BILLING REMOVED: Now handled in orchestrator.ts finally block
  // This fixes the double-billing issue where credits were charged twice

  // STEP 2: Remove from active streams registry
  // This allows the user to start new streams (prevents "stream already active" errors)
  activeStreams.delete(activeStreamsKey);
  console.log('[LOMU-AI-CHAT] Stream unregistered for user:', userId);

  // STEP 3: Clear stream timeout
  // Prevents orphaned timeouts that would fire after stream ends
  if (streamTimeoutId) {
    clearTimeout(streamTimeoutId);
    console.log('[LOMU-AI-CHAT] Stream timeout cleared');
  }

  // STEP 4: 🔥 RAILWAY FIX: ALWAYS clear heartbeat when stream ends
  // This ensures cleanup happens on success, error, or early termination
  // Critical for preventing memory leaks in long-running Node processes
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    console.log('[LOMU-AI-HEARTBEAT] Cleared on stream end');
  }
}

/**
 * Handle project-specific error scenarios
 * Extends base error handling with project context
 */
export async function handleProjectStreamError(
  context: ErrorHandlerContext & { projectId: string }
): Promise<void> {
  const { projectId, error } = context;
  
  console.error(`[LOMU-AI-PROJECT] Stream error for project ${projectId}:`, error.message);
  
  // Perform base error handling
  await handleStreamError(context);
  
  // Additional project-specific cleanup can be added here
  // e.g., release file locks, rollback partial changes, etc.
}

/**
 * Create error message for quality analysis failures
 * Used when quality analysis detects poor response quality
 */
export function createQualityErrorMessage(
  qualityScore: number,
  issues: string[],
  userMessage: string
): string {
  return `Agent Response Quality Issue (Score: ${qualityScore})\n\n` +
    `**User Message:** ${userMessage.substring(0, 200)}${userMessage.length > 200 ? '...' : ''}\n\n` +
    `**Quality Score:** ${qualityScore}/100\n\n` +
    `**Issues Detected:**\n${issues.map(i => `- ${i}`).join('\n')}`;
}

/**
 * Check if error is retryable
 * Helps determine if we should retry or fail immediately
 */
export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /timeout/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /429/i, // Rate limit
    /503/i, // Service unavailable
  ];

  return retryablePatterns.some(pattern => pattern.test(error.message));
}

/**
 * Get friendly error message for user display
 * Converts technical errors into user-friendly messages
 */
export function getFriendlyErrorMessage(error: Error): string {
  const errorMap: Record<string, string> = {
    'timeout': 'The request took too long. Let me try a quicker approach! 🍋',
    'rate limit': 'I\'m getting too excited! Let me slow down a bit. 🍋',
    'out of memory': 'That was a bit too much to handle. Let me break it down! 🍋',
    'network': 'Having trouble connecting. Let me retry! 🍋',
  };

  const errorType = Object.keys(errorMap).find(key => 
    error.message.toLowerCase().includes(key)
  );

  if (errorType) {
    return errorMap[errorType];
  }

  return `Oops! Something went wrong: ${error.message}. Don't worry, I'm on it! 🍋`;
}

/**
 * Cleanup partial changes on error
 * Rolls back uncommitted file changes to prevent corruption
 * 
 * 🔧 BUG FIX: Added comprehensive error handling and git instance validation
 * to prevent "git instance is undefined" runtime errors.
 * 
 * @param fileChanges - Array of file changes to rollback
 * @param projectPath - Root path of the project
 */
export async function rollbackPartialChanges(
  fileChanges: Array<{ path: string; operation: string }>,
  projectPath: string
): Promise<void> {
  console.log(`[ERROR-CLEANUP] 🔄 Rolling back ${fileChanges.length} partial changes in ${projectPath}`);
  
  if (fileChanges.length === 0) {
    console.log('[ERROR-CLEANUP] No changes to rollback');
    return;
  }
  
  // Validate projectPath before attempting git operations
  if (!projectPath || typeof projectPath !== 'string') {
    console.error('[ERROR-CLEANUP] ❌ Invalid projectPath:', projectPath);
    return;
  }
  
  try {
    // STEP 1: Import and instantiate git client with comprehensive error handling
    console.log('[ERROR-CLEANUP] 📦 Importing simple-git...');
    const simpleGitModule = await import('simple-git');
    
    // Validate module import
    if (!simpleGitModule || !simpleGitModule.default) {
      console.error('[ERROR-CLEANUP] ❌ Failed to import simple-git - module or default export is undefined');
      console.error('[ERROR-CLEANUP] Module:', simpleGitModule);
      return;
    }
    
    const simpleGit = simpleGitModule.default;
    console.log('[ERROR-CLEANUP] ✅ simple-git imported successfully');
    
    // STEP 2: Create git instance with validation
    console.log(`[ERROR-CLEANUP] 🔧 Instantiating git client for: ${projectPath}`);
    const git = simpleGit(projectPath);
    
    // Validate git instance was created
    if (!git) {
      console.error('[ERROR-CLEANUP] ❌ Git instance is undefined after calling simpleGit()');
      return;
    }
    
    // Validate git instance has required methods
    if (typeof git.checkIsRepo !== 'function') {
      console.error('[ERROR-CLEANUP] ❌ Git instance missing checkIsRepo method');
      console.error('[ERROR-CLEANUP] Git instance type:', typeof git);
      console.error('[ERROR-CLEANUP] Git instance keys:', Object.keys(git));
      return;
    }
    
    console.log('[ERROR-CLEANUP] ✅ Git client instantiated successfully');
    
    // STEP 3: Check if we're in a git repository
    console.log('[ERROR-CLEANUP] 🔍 Checking if directory is a git repository...');
    let isRepo: boolean;
    try {
      isRepo = await git.checkIsRepo();
      console.log(`[ERROR-CLEANUP] Repository check result: ${isRepo}`);
    } catch (repoError: any) {
      console.error('[ERROR-CLEANUP] ❌ Failed to check if directory is a git repo:', repoError.message);
      return;
    }
    
    if (!isRepo) {
      console.warn('[ERROR-CLEANUP] ⚠️ Not a git repository - cannot rollback via git');
      console.warn('[ERROR-CLEANUP] Files will remain in their current state');
      return;
    }
    
    // STEP 4: Get current git status
    console.log('[ERROR-CLEANUP] 📊 Fetching git status...');
    let status;
    try {
      status = await git.status();
      console.log(
        `[ERROR-CLEANUP] Git status - ` +
        `modified: ${status.modified.length}, ` +
        `created: ${status.created.length}, ` +
        `deleted: ${status.deleted.length}, ` +
        `not_added: ${status.not_added.length}`
      );
    } catch (statusError: any) {
      console.error('[ERROR-CLEANUP] ❌ Failed to get git status:', statusError.message);
      return;
    }
    
    // STEP 5: Categorize file changes
    const modifiedFiles = fileChanges.filter(f => f.operation === 'modify').map(f => f.path);
    const createdFiles = fileChanges.filter(f => f.operation === 'create').map(f => f.path);
    const deletedFiles = fileChanges.filter(f => f.operation === 'delete').map(f => f.path);
    
    console.log('[ERROR-CLEANUP] 📋 Rollback plan:');
    console.log(`  - Revert ${modifiedFiles.length} modified files`);
    console.log(`  - Delete ${createdFiles.length} newly created files`);
    console.log(`  - Restore ${deletedFiles.length} deleted files`);
    
    // STEP 6: Revert modified files to HEAD
    if (modifiedFiles.length > 0) {
      console.log(`[ERROR-CLEANUP] ↩️ Reverting ${modifiedFiles.length} modified files...`);
      try {
        await git.checkout(['HEAD', '--', ...modifiedFiles]);
        console.log('[ERROR-CLEANUP] ✅ Modified files reverted successfully');
      } catch (checkoutError: any) {
        console.error('[ERROR-CLEANUP] ❌ Failed to revert modified files:', checkoutError.message);
        console.error('[ERROR-CLEANUP] Files that failed:', modifiedFiles);
      }
    }
    
    // STEP 7: Delete newly created files (not in git yet)
    if (createdFiles.length > 0) {
      console.log(`[ERROR-CLEANUP] 🗑️ Removing ${createdFiles.length} newly created files...`);
      const fs = await import('fs/promises');
      let deletedCount = 0;
      let failedCount = 0;
      
      for (const file of createdFiles) {
        try {
          await fs.unlink(file);
          deletedCount++;
          console.log(`[ERROR-CLEANUP] ✅ Deleted: ${file}`);
        } catch (err: any) {
          failedCount++;
          console.warn(`[ERROR-CLEANUP] ⚠️ Failed to delete ${file}: ${err.message}`);
        }
      }
      
      console.log(`[ERROR-CLEANUP] File deletion complete - ${deletedCount} deleted, ${failedCount} failed`);
    }
    
    // STEP 8: Restore deleted files from HEAD
    if (deletedFiles.length > 0) {
      console.log(`[ERROR-CLEANUP] 📥 Restoring ${deletedFiles.length} deleted files...`);
      try {
        await git.checkout(['HEAD', '--', ...deletedFiles]);
        console.log('[ERROR-CLEANUP] ✅ Deleted files restored successfully');
      } catch (restoreError: any) {
        console.error('[ERROR-CLEANUP] ❌ Failed to restore deleted files:', restoreError.message);
        console.error('[ERROR-CLEANUP] Files that failed:', deletedFiles);
      }
    }
    
    console.log('[ERROR-CLEANUP] ✅ Rollback completed successfully');
    
  } catch (error: any) {
    console.error('[ERROR-CLEANUP] ❌ Rollback failed with error:', error.message);
    console.error('[ERROR-CLEANUP] Error stack:', error.stack);
    console.error('[ERROR-CLEANUP] ⚠️ Manual intervention may be required');
    console.error('[ERROR-CLEANUP] Project path:', projectPath);
    console.error('[ERROR-CLEANUP] File changes:', fileChanges);
  }
}
