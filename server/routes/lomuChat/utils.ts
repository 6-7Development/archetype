import { db } from '../../db.ts';
import { conversationStates, users, subscriptions, projects } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { WebSocketServer } from 'ws';
import { broadcastToUser, broadcastToProject } from '../websocket.ts';
import { LOMU_LIMITS } from '../../config/lomuLimits.ts';
import { CreditManager } from '../../services/creditManager.ts';
import { AgentExecutor } from '../../services/agentExecutor.ts';

export const MAX_CONSECUTIVE_THINKING = 3; // Moved from lomuChat.ts

export function mapDatabaseStatusToRunState(dbStatus: string): 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' {
  switch (dbStatus) {
    case 'pending':
      return 'pending';
    case 'in_progress':
      return 'running';
    case 'completed':
      return 'completed';
    case 'completed_pending_review':
      return 'completed'; // Treat as completed for run state
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

export async function detectLowConfidencePatterns(message: string): Promise<{ hasLowConfidence: boolean; patterns: string[] }> {
  const lowConfidencePatterns = [
    /i (think|believe|guess)/i,
    /perhaps|maybe|possibly/i,
    /could be|might be/i,
    /i am not sure/i,
    /unclear|uncertain/i,
    /if i understand correctly/i,
    /this is my best guess/i,
  ];

  const patternsFound: string[] = [];
  let hasLowConfidence = false;

  for (const pattern of lowConfidencePatterns) {
    if (pattern.test(message)) {
      hasLowConfidence = true;
      patternsFound.push(pattern.source);
    }
  }

  return { hasLowConfidence, patterns: patternsFound };
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, description = 'Operation'): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
      console.warn(`[RETRY] ${description} failed (attempt ${i + 1}/${retries}). Retrying in ${delay.toFixed(0)}ms. Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.error(`[RETRY] ${description} failed after ${retries} attempts.`);
  throw lastError; // Re-throw the last error after all retries are exhausted
}

export async function ensureActiveSession(conversationStateId: string) {
  const [state] = await db.select().from(conversationStates).where(eq(conversationStates.id, conversationStateId));

  if (!state) {
    throw new Error(`Conversation state ${conversationStateId} not found.`);
  }

  const now = new Date();
  const lastUpdated = state.lastUpdated || state.createdAt;
  const idleDuration = now.getTime() - lastUpdated.getTime();

  // If idle for more than 30 minutes, reset counters (simulate new session)
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  if (idleDuration > IDLE_TIMEOUT_MS) {
    console.log(`[SESSION-MANAGER] Session ${conversationStateId} idle for ${idleDuration / 60000} minutes, resetting counters.`);
    await db.update(conversationStates).set({
      apiCallCount: 0,
      conversationStartTime: now,
      lastUpdated: now,
      traceId: null, // Clear trace for new session
    }).where(eq(conversationStates.id, conversationStateId));
  } else {
    // Just update lastUpdated to keep session active
    await db.update(conversationStates).set({ lastUpdated: now }).where(eq(conversationStates.id, conversationStateId));
  }
}

export function validateProjectPath(filePath: string): string {
  // Basic path sanitization to prevent directory traversal
  const normalizedPath = filePath.normalize('NFC');
  if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
    throw new Error('Invalid file path: Absolute paths or directory traversal attempts are not allowed.');
  }
  return normalizedPath;
}

export async function validateContextAccess(userId: string, targetContext: 'platform' | 'project', projectId: string | null): Promise<{ allowed: boolean; reason?: string }> {
  if (targetContext === 'platform') {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.isOwner) {
      return { allowed: false, reason: 'Platform healing requires owner access' };
    }
  } else if (targetContext === 'project') {
    if (!projectId) {
      return { allowed: false, reason: 'Project ID is required for project context' };
    }
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project || project.userId !== userId) {
      return { allowed: false, reason: 'You do not have access to this project' };
    }
  }
  return { allowed: true };
}

export async function handleBilling(userId: string, targetContext: 'platform' | 'project', totalCreditsUsed: number, agentRunId: string) {
  if (targetContext === 'platform') {
    // Platform healing is free for owners
    console.log(`[BILLING] Platform healing (run ${agentRunId}) is FREE for owner ${userId}. No credits charged.`);
    await AgentExecutor.completeRun({
      runId: agentRunId,
      actualCreditsUsed: 0,
      source: 'lomu_chat',
    });
  } else {
    // Project work is paid
    console.log(`[BILLING] Project work (run ${agentRunId}) for user ${userId}. Total credits used: ${totalCreditsUsed}`);
    await AgentExecutor.completeRun({
      runId: agentRunId,
      actualCreditsUsed: totalCreditsUsed,
      source: 'lomu_chat',
    });
  }
}

export function broadcastFileUpdate(wss: WebSocketServer | null, path: string, operation: 'create' | 'modify' | 'delete', targetContext: 'platform' | 'project' = 'platform', projectId: string | null = null, userId: string | null = null) {
  if (wss) {
    // Scoped broadcast to prevent cross-tenant leakage
    if (projectId) {
      broadcastToProject(wss, projectId, {
        type: 'file_change',
        file: { path, operation },
        targetContext,
        projectId,
        userId,
        timestamp: new Date().toISOString()
      });
    } else if (userId) {
      // For platform changes, broadcast only to the specific user (owner)
      broadcastToUser(wss, userId, {
        type: 'file_change',
        file: { path, operation },
        targetContext,
        projectId,
        userId,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Placeholder for approval functions (actual implementation in services/approval.ts)
export async function waitForApproval(messageId: string): Promise<boolean> {
  // This is a placeholder. Actual implementation would involve a Promise that resolves
  // when the /approve/:messageId or /reject/:messageId endpoint is hit.
  console.warn(`[APPROVAL] Waiting for approval for message ${messageId}. This is a placeholder.`);
  return new Promise(resolve => {
    // In a real scenario, you'd store the resolve function in a map keyed by messageId
    // and call it from the /approve or /reject route.
    setTimeout(() => {
      console.warn(`[APPROVAL] Auto-approving message ${messageId} after 10 seconds for dev purposes.`);
      resolve(true); // Auto-approve for development
    }, 10000);
  });
}

export function resolveApproval(messageId: string, approved: boolean): boolean {
  // This is a placeholder. In a real scenario, this would resolve the Promise
  // created by waitForApproval.
  console.warn(`[APPROVAL] Resolving approval for message ${messageId}: ${approved}. This is a placeholder.`);
  return true; // Assume resolved for dev purposes
}
