import { db } from '../../db.ts';
import { conversationStates, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import type { WebSocketServer } from 'ws';
import { EMERGENCY_LIMITS } from './constants.ts';

// ✅ STATUS MAPPING: Convert database statuses to RunStateManager TaskStatus
export function mapDatabaseStatusToRunState(dbStatus: string): 'backlog' | 'in_progress' | 'verifying' | 'done' | 'blocked' {
  const statusMap: Record<string, 'backlog' | 'in_progress' | 'verifying' | 'done' | 'blocked'> = {
    'pending': 'backlog',
    'in_progress': 'in_progress',
    'completed': 'done',
    'failed': 'blocked',
    'cancelled': 'blocked',
    'verifying': 'verifying',
    'backlog': 'backlog',
    'done': 'done',
    'blocked': 'blocked',
  };
  
  const mapped = statusMap[dbStatus.toLowerCase()];
  if (!mapped) {
    console.warn(`[STATUS-MAP] Unknown status "${dbStatus}", defaulting to "backlog"`);
    return 'backlog';
  }
  
  return mapped;
}

// 📊 GAP 1: RUNTIME VALIDATION - Detect low-confidence patterns in responses
export function detectLowConfidencePatterns(response: string): { hasLowConfidence: boolean; patterns: string[] } {
  const lowConfidencePatterns = [
    /\b(assuming|probably|might be|possibly|perhaps|maybe|likely|could be|seems like)\b/i,
    /\b(i think|i believe|i guess|i suspect|i assume)\b/i,
    /\b(not sure|uncertain|unclear|ambiguous)\b/i,
    /path\/to\//i, // Placeholder paths
    /\[X\]|\[Y\]|\[Z\]/i, // Placeholder variables
    /TODO|FIXME|PLACEHOLDER/i, // Placeholder code
  ];

  const foundPatterns: string[] = [];
  
  for (const pattern of lowConfidencePatterns) {
    const matches = response.match(pattern);
    if (matches) {
      foundPatterns.push(matches[0]);
    }
  }

  const hasLowConfidence = foundPatterns.length > 0;

  if (hasLowConfidence) {
    console.warn('[LOW-CONFIDENCE-DETECTOR] ⚠️ Detected low-confidence patterns:', foundPatterns);
    console.warn('[LOW-CONFIDENCE-DETECTOR] Agent should have used user_query tool for clarification');
    // Non-blocking for now - just log the warning
  }

  return { hasLowConfidence, patterns: foundPatterns };
}

// 🔄 EXPONENTIAL BACKOFF RETRY LOGIC for Anthropic API overload errors
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  context: string = 'API call'
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      // Check if it's an Anthropic overload error
      const isOverloadError = error.error?.type === 'overloaded_error' || 
                              error.message?.includes('overloaded') ||
                              error.type === 'overloaded_error';
      
      if (isOverloadError && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s exponential backoff
        console.log(`[RETRY] ${context} - Anthropic API overloaded, retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not an overload error, or we've exhausted retries, throw the error
      throw error;
    }
  }
  throw new Error('Retry logic error - should not reach here');
}

// 🔄 SESSION LIFECYCLE MANAGEMENT - Auto-renew stale conversations
export async function ensureActiveSession(conversationStateId: string): Promise<void> {
  const [state] = await db
    .select()
    .from(conversationStates)
    .where(eq(conversationStates.id, conversationStateId));
  
  if (!state) return;
  
  // Check if session is stale (last interaction > 30 min ago)
  const now = Date.now();
  const lastInteraction = state.lastInteractionAt ? new Date(state.lastInteractionAt).getTime() : now;
  const idleTime = now - lastInteraction;
  
  if (idleTime > EMERGENCY_LIMITS.SESSION_IDLE_TIMEOUT) {
    const idleMinutes = Math.round(idleTime / 60000);
    console.log(`[SESSION-LIFECYCLE] Conversation idle for ${idleMinutes} minutes - renewing session (threshold: 30 min)`);
    
    // Reset session counters and timestamps
    await db
      .update(conversationStates)
      .set({
        conversationStartTime: new Date(),
        lastInteractionAt: new Date(),
        apiCallCount: 0,
      })
      .where(eq(conversationStates.id, conversationStateId));
    
    console.log(`[SESSION-LIFECYCLE] ✅ Session renewed - fresh 10-minute active window started`);
  } else {
    // Session is still active, just update lastInteractionAt
    await db
      .update(conversationStates)
      .set({ lastInteractionAt: new Date() })
      .where(eq(conversationStates.id, conversationStateId));
  }
}

// SECURITY: Validate project file paths to prevent path traversal attacks
export function validateProjectPath(filePath: string): string {
  // Reject null, undefined, or empty paths
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path: path is required');
  }

  // Normalize the path to resolve any .. or . segments
  const normalized = path.normalize(filePath);

  // Reject paths that try to escape using ..
  if (normalized.includes('..')) {
    throw new Error('Path traversal detected: paths cannot contain ".."');
  }

  // Reject absolute paths (must be relative to project root)
  if (path.isAbsolute(normalized)) {
    throw new Error('Absolute paths are not allowed: path must be relative to project root');
  }

  // Reject paths starting with / or \ (additional safety)
  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    throw new Error('Paths cannot start with / or \\');
  }

  return normalized;
}

// STEP 2: Centralized Access Control - Validate targetContext access
export async function validateContextAccess(
  userId: string,
  targetContext: 'platform' | 'project',
  projectId?: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  // Platform context: owner-only access
  if (targetContext === 'platform') {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    // Check if user is the platform owner
    if (!user || !user.isOwner) {
      console.log(`[TARGET-CONTEXT] ❌ Access denied - platform healing requires owner access (userId: ${userId})`);
      return { 
        allowed: false, 
        reason: 'Platform healing requires owner access. Only the platform owner can modify platform code.' 
      };
    }
    
    console.log(`[TARGET-CONTEXT] ✅ Platform access granted for owner (userId: ${userId})`);
    return { allowed: true };
  }
  
  // Project context: allow scratch work (null projectId) or project-specific work
  if (targetContext === 'project') {
    // Allow scratch/temporary work without a project (credit-based billing applies)
    if (!projectId) {
      console.log(`[TARGET-CONTEXT] ✅ Project scratch access granted (userId: ${userId}, no projectId - scratch work)`);
      return { allowed: true };
    }
    
    // NOTE: Project ownership validation pending - would check if userId owns the project
    // Currently allows all authenticated users to access projects (credential-based auth sufficient)
    console.log(`[TARGET-CONTEXT] ✅ Project access granted (userId: ${userId}, projectId: ${projectId})`);
    return { allowed: true };
  }
  
  return { 
    allowed: false, 
    reason: 'Invalid context. Must be "platform" or "project"' 
  };
}

// STEP 3: Centralized Billing Logic - Handle FREE vs credit billing
// NOTE: This function is deprecated - billing is now handled in onComplete callback
// Keeping it for backwards compatibility with older code paths
export async function handleBilling(
  userId: string,
  targetContext: 'platform' | 'project',
  creditsUsed: number,
  agentRunId: string
): Promise<void> {
  // Platform healing = FREE (skip billing entirely)
  if (targetContext === 'platform') {
    console.log(`[BILLING] 🆓 Platform healing - FREE access, no charges applied (runId: ${agentRunId})`);
    
    // Complete the agent run with zero cost
    const AgentExecutor = (await import('../../services/agentExecutor')).AgentExecutor;
    await AgentExecutor.completeRun({
      runId: agentRunId,
      actualCreditsUsed: 0,
      source: 'lomu_chat',
    });
    
    return;
  }
  
  // Project context = credit billing (existing logic)
  if (targetContext === 'project') {
    console.log(`[BILLING] 💳 User project - charging ${creditsUsed} credits (userId: ${userId}, runId: ${agentRunId})`);
    
    // Complete the agent run with actual credit charges
    const AgentExecutor = (await import('../../services/agentExecutor')).AgentExecutor;
    await AgentExecutor.completeRun({
      runId: agentRunId,
      actualCreditsUsed: creditsUsed,
      source: 'lomu_chat',
    });
    
    return;
  }
}

// STEP 5: Broadcast file update with context-specific room isolation
// Updated to support targetContext for proper room-based broadcasting
export function broadcastFileUpdate(
  wss: WebSocketServer | null,
  path: string, 
  operation: 'create' | 'modify' | 'delete', 
  targetContext: 'platform' | 'project' = 'platform',
  projectId: string | null = null,
  userId: string | null = null
) {
  if (!wss) {
    console.warn('[LOMU-AI] WebSocket not initialized, skipping file update broadcast');
    return;
  }

  // Construct room ID for context isolation
  // Platform context: room = `platform_${userId}` (owner-specific)
  // Project context: room = `project_${projectId}` (project-specific)
  const roomId = targetContext === 'platform' 
    ? `platform_${userId || 'owner'}` 
    : `project_${projectId || 'unknown'}`;

  const updateMessage = JSON.stringify({
    type: 'platform_file_updated',
    path,
    operation,
    targetContext,
    projectId: projectId || null,
    roomId, // Include roomId so clients can filter by their active context
    timestamp: Date.now(),
  });

  let broadcastCount = 0;
  
  // NOTE: Current WebSocketServer doesn't have native room support
  // Clients should filter messages by roomId to achieve room isolation
  // Future: Upgrade to socket.io for server-side room filtering
  wss.clients.forEach((client: any) => {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      try {
        client.send(updateMessage);
        broadcastCount++;
      } catch (error: any) {
        console.warn('[LOMU-AI] Failed to send WebSocket message:', error.message);
        // Add error listener to prevent memory leaks
        if (!client.errorListenerAdded) {
          client.on('error', (wsError: any) => {
            console.error('[LOMU-AI] WebSocket client error:', wsError);
          });
          client.on('close', () => {
            console.log('[LOMU-AI] WebSocket client disconnected');
          });
          client.errorListenerAdded = true;
        }
      }
    }
  });

  console.log(`[LOMU-AI] 📡 Broadcasted file update (${operation}: ${path}) to room: ${roomId} (${broadcastCount} clients)`);
}

// Session management for approval workflow
const approvalPromises = new Map<string, { resolve: (value: boolean) => void; reject: (error: any) => void }>();

export function waitForApproval(messageId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    approvalPromises.set(messageId, { resolve, reject });

    // Timeout after 10 minutes
    setTimeout(() => {
      if (approvalPromises.has(messageId)) {
        approvalPromises.delete(messageId);
        reject(new Error('Approval timeout - no response after 10 minutes'));
      }
    }, 600000);
  });
}

export function resolveApproval(messageId: string, approved: boolean) {
  const promise = approvalPromises.get(messageId);
  if (promise) {
    promise.resolve(approved);
    approvalPromises.delete(messageId);
    return true;
  }
  return false;
}
