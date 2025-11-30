/**
 * LOMU AI BRAIN - Unified Session Management
 * 
 * Single source of truth for all BeeHiveAI sessions.
 * Hybrid pattern: In-memory cache + database persistence.
 * 
 * Integrations:
 * - GuardRailsManager: RCE prevention, input sanitization, rate limiting
 * - AIDecisionLogger: Complete audit trail for all AI decisions
 */

import { nanoid } from 'nanoid';
import { db } from '../db';
import { conversationStates, chatMessages, tokenLedger, lomuJobs } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { WebSocket } from 'ws';
import { guardrails } from './guardrailsManager';
import { aiDecisionLogger } from './aiDecisionLogger';

// ========== INTERFACES ==========

export interface SessionState {
  // Identity
  sessionId: string;
  userId: string;
  targetContext: 'platform' | 'project';
  projectId?: string;
  
  // Conversation
  conversationStateId?: string; // Link to DB conversationStates record
  currentGoal?: string;
  mentionedFiles: string[];
  messageCount: number;
  
  // Execution
  activeToolCalls: Map<string, ToolExecution>;
  filesModified: Set<string>;
  taskListId?: string;
  subagentTaskIds: string[];
  
  // Billing
  tokensUsed: number;
  creditsReserved: number;
  creditsConsumed: number;
  
  // Transport
  wsConnection?: WebSocket;
  wsRoomId?: string; // For broadcasting
  
  // Metadata
  createdAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'idle' | 'completed' | 'error';
}

export interface ToolExecution {
  toolName: string;
  args: any;
  startedAt: Date;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface SessionEvent {
  type: 'message' | 'tool_call' | 'billing' | 'status_change' | 'websocket';
  timestamp: Date;
  data: any;
}

// ========== PERSISTENCE ADAPTER ==========

class PersistenceAdapter {
  /**
   * Load existing conversation state from database
   */
  async loadConversationState(userId: string, projectId: string | null): Promise<any | null> {
    const query = projectId
      ? and(eq(conversationStates.userId, userId), eq(conversationStates.projectId, projectId))
      : and(eq(conversationStates.userId, userId), isNull(conversationStates.projectId));
    
    const [state] = await db
      .select()
      .from(conversationStates)
      .where(query)
      .limit(1);
    
    return state || null;
  }
  
  /**
   * Create or update conversation state
   */
  async persistConversationState(session: SessionState): Promise<string> {
    if (session.conversationStateId) {
      // Update existing
      await db
        .update(conversationStates)
        .set({
          currentGoal: session.currentGoal,
          mentionedFiles: session.mentionedFiles,
          lastUpdated: new Date(),
        })
        .where(eq(conversationStates.id, session.conversationStateId));
      
      return session.conversationStateId;
    } else {
      // Create new
      const [newState] = await db
        .insert(conversationStates)
        .values({
          userId: session.userId,
          projectId: session.projectId || null,
          currentGoal: session.currentGoal || null,
          mentionedFiles: session.mentionedFiles,
          context: {},
        })
        .returning();
      
      return newState.id;
    }
  }
  
  /**
   * Record token usage in ledger
   */
  async recordTokenUsage(session: SessionState, inputTokens: number, outputTokens: number): Promise<void> {
    const totalTokens = inputTokens + outputTokens;
    const costUsd = (totalTokens / 1000000) * 0.075; // Gemini 2.5 Flash pricing
    const creditsCharged = Math.ceil(totalTokens / 1000); // 1 credit = 1,000 tokens
    
    await db.insert(tokenLedger).values({
      userId: session.userId,
      targetContext: session.targetContext,
      projectId: session.projectId || null,
      promptTokens: inputTokens,
      candidatesTokens: outputTokens,
      totalTokens,
      modelUsed: 'gemini-2.5-flash',
      requestType: 'LOMU_CHAT',
      costUsd: costUsd.toFixed(6),
      creditsCharged,
    });
  }
}

// ========== ACTIVE SESSION REGISTRY ==========

class ActiveSessionRegistry {
  private sessions: Map<string, SessionState> = new Map();
  
  /**
   * Generate composite key: userId:sessionId
   */
  private getKey(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`;
  }
  
  /**
   * Store session in registry
   */
  set(session: SessionState): void {
    const key = this.getKey(session.userId, session.sessionId);
    this.sessions.set(key, session);
    console.log(`[BRAIN-REGISTRY] Session stored: ${key}`);
  }
  
  /**
   * Retrieve session from registry
   */
  get(userId: string, sessionId: string): SessionState | null {
    const key = this.getKey(userId, sessionId);
    return this.sessions.get(key) || null;
  }
  
  /**
   * Remove session from registry
   */
  delete(userId: string, sessionId: string): boolean {
    const key = this.getKey(userId, sessionId);
    const deleted = this.sessions.delete(key);
    if (deleted) {
      console.log(`[BRAIN-REGISTRY] Session removed: ${key}`);
    }
    return deleted;
  }
  
  /**
   * Get all sessions for a user
   */
  getAllForUser(userId: string): SessionState[] {
    const sessions: SessionState[] = [];
    for (const [key, session] of Array.from(this.sessions.entries())) {
      if (session.userId === userId) {
        sessions.push(session);
      }
    }
    return sessions;
  }
  
  /**
   * Get all active sessions
   */
  getAll(): SessionState[] {
    return Array.from(this.sessions.values());
  }
  
  /**
   * Cleanup idle sessions (last activity > 30 min)
   */
  cleanupIdleSessions(): number {
    const now = Date.now();
    const idleThreshold = 30 * 60 * 1000; // 30 minutes
    let cleaned = 0;
    
    for (const [key, session] of Array.from(this.sessions.entries())) {
      const idleTime = now - session.lastActivityAt.getTime();
      if (idleTime > idleThreshold && session.status === 'idle') {
        this.sessions.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[BRAIN-REGISTRY] Cleaned up ${cleaned} idle sessions`);
    }
    
    return cleaned;
  }
}

// ========== LOMU AI BRAIN (MAIN SERVICE) ==========

class BeeHiveAIBrain {
  private registry = new ActiveSessionRegistry();
  private persistence = new PersistenceAdapter();
  
  /**
   * Create a new session
   */
  async createSession(params: {
    userId: string;
    sessionId?: string;
    targetContext: 'platform' | 'project';
    projectId?: string;
  }): Promise<SessionState> {
    const { userId, targetContext, projectId } = params;
    const sessionId = params.sessionId || nanoid();
    
    // Check if session already exists
    const existing = this.registry.get(userId, sessionId);
    if (existing) {
      console.log(`[BRAIN] Session already exists: ${userId}:${sessionId}`);
      return existing;
    }
    
    // Load existing conversation state if available
    const dbState = await this.persistence.loadConversationState(userId, projectId || null);
    
    // Create new session state
    const session: SessionState = {
      sessionId,
      userId,
      targetContext,
      projectId,
      conversationStateId: dbState?.id,
      currentGoal: dbState?.currentGoal,
      mentionedFiles: dbState?.mentionedFiles || [],
      messageCount: 0,
      activeToolCalls: new Map(),
      filesModified: new Set(),
      subagentTaskIds: [],
      tokensUsed: 0,
      creditsReserved: 0,
      creditsConsumed: 0,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active',
    };
    
    // Store in registry
    this.registry.set(session);
    
    console.log(`[BRAIN] ✅ Created session: ${userId}:${sessionId} (${targetContext})`);
    
    return session;
  }
  
  /**
   * Get existing session or null
   */
  getSession(userId: string, sessionId: string): SessionState | null {
    return this.registry.get(userId, sessionId);
  }
  
  /**
   * Get or create session
   */
  async getOrCreateSession(params: {
    userId: string;
    sessionId?: string;
    targetContext: 'platform' | 'project';
    projectId?: string;
  }): Promise<SessionState> {
    const { userId, sessionId } = params;
    
    if (sessionId) {
      const existing = this.getSession(userId, sessionId);
      if (existing) {
        return existing;
      }
    }
    
    return this.createSession(params);
  }
  
  /**
   * Update session activity timestamp (heartbeat)
   * CRITICAL: Call this on every user interaction to prevent stale session cleanup
   */
  touchSession(userId: string, sessionId: string): void {
    const session = this.registry.get(userId, sessionId);
    if (session) {
      session.lastActivityAt = new Date();
      
      // If session was idle, reactivate it
      if (session.status === 'idle') {
        console.log(`[BRAIN] Reactivating idle session: ${userId}:${sessionId}`);
        session.status = 'active';
      } else {
        session.status = 'active';
      }
    }
  }
  
  /**
   * Mark session as idle (for cleanup)
   * Called when no heartbeat received for threshold period
   */
  markSessionIdle(userId: string, sessionId: string): void {
    const session = this.registry.get(userId, sessionId);
    if (session && session.status === 'active') {
      console.log(`[BRAIN] Marking session as idle: ${userId}:${sessionId}`);
      session.status = 'idle';
    }
  }
  
  /**
   * Check for stale sessions and mark them idle
   * Session is stale if no activity for STALE_THRESHOLD_MS
   */
  checkStaleSessionsAndMarkIdle(): number {
    const now = Date.now();
    const STALE_THRESHOLD_MS = 60 * 1000; // 60 seconds - matches Gemini's recommendation
    let markedIdle = 0;
    
    for (const session of this.registry.getAll()) {
      if (session.status === 'active') {
        const idleTime = now - session.lastActivityAt.getTime();
        
        if (idleTime > STALE_THRESHOLD_MS) {
          console.log(`[BRAIN-STALE-DETECTION] Session ${session.userId}:${session.sessionId} idle for ${Math.floor(idleTime / 1000)}s - marking as idle`);
          this.markSessionIdle(session.userId, session.sessionId);
          markedIdle++;
        }
      }
    }
    
    if (markedIdle > 0) {
      console.log(`[BRAIN-STALE-DETECTION] Marked ${markedIdle} sessions as idle`);
    }
    
    return markedIdle;
  }
  
  /**
   * Close session and persist final state
   * CRITICAL: Also releases all file locks and cleans up resources
   */
  async closeSession(userId: string, sessionId: string): Promise<void> {
    const session = this.registry.get(userId, sessionId);
    if (!session) {
      console.log(`[BRAIN] Session not found: ${userId}:${sessionId}`);
      return;
    }
    
    // Update status
    session.status = 'completed';
    
    // Persist final conversation state
    if (session.currentGoal || session.mentionedFiles.length > 0) {
      await this.persistence.persistConversationState(session);
    }
    
    // BRAIN-GAP-1: Release all file locks for this session
    try {
      const { fileLockManager } = await import('./fileLockManager');
      const releasedLocks = fileLockManager.releaseAllLocksForSession(sessionId);
      if (releasedLocks > 0) {
        console.log(`[BRAIN] Released ${releasedLocks} file locks for session ${sessionId}`);
      }
    } catch (error: any) {
      console.error('[BRAIN] Error releasing file locks:', error.message);
    }
    
    // Close WebSocket if still connected
    if (session.wsConnection) {
      try {
        session.wsConnection.close(1000, 'Session closed');
      } catch (err) {
        console.error('[BRAIN] Error closing WebSocket:', err);
      }
    }
    
    // Remove from registry
    this.registry.delete(userId, sessionId);
    
    console.log(`[BRAIN] ✅ Closed session: ${userId}:${sessionId}`);
  }
  
  /**
   * GUARD RAILS INTEGRATION: Sanitize and validate user input before processing
   * Layer 1: Input sanitization, Layer 2-5: RCE prevention, rate limiting, cost tracking
   */
  async sanitizeUserInput(userId: string, userMessage: string, context: 'shell' | 'code' | 'sql' | 'llm' = 'llm'): Promise<{ safe: boolean; sanitized: string; risks: string[] }> {
    // Check rate limit FIRST
    const rateLimit = guardrails.checkRateLimit(userId);
    if (!rateLimit.allowed) {
      console.warn(`[BRAIN-GUARD] Rate limit exceeded for user: ${userId}`);
      return {
        safe: false,
        sanitized: '',
        risks: [`Rate limit exceeded. Remaining: ${rateLimit.remaining}`]
      };
    }

    // Sanitize input
    const sanitizationResult = guardrails.sanitizeInput(userMessage, context);
    
    if (!sanitizationResult.isSafe) {
      console.warn(`[BRAIN-GUARD] Unsafe input detected for user ${userId}:`, sanitizationResult.risks);
      // Log decision for audit trail
      aiDecisionLogger.logDecision({
        timestamp: new Date(),
        userId,
        eventType: 'INPUT_REJECTED',
        data: {
          reason: 'Failed sanitization',
          risks: sanitizationResult.risks,
          messagePreview: userMessage.substring(0, 100)
        }
      });
    } else {
      console.log(`[BRAIN-GUARD] ✅ Input sanitized for user ${userId} (${sanitizationResult.risks.length} risks detected)`);
    }

    return {
      safe: sanitizationResult.isSafe,
      sanitized: sanitizationResult.sanitized,
      risks: sanitizationResult.risks
    };
  }

  /**
   * GUARD RAILS INTEGRATION: Validate code safety before execution
   */
  async validateCodeExecution(userId: string, code: string): Promise<{ valid: boolean; issues: string[] }> {
    const validation = guardrails.validateCodeSafety(code);
    
    if (!validation.safe) {
      console.warn(`[BRAIN-GUARD] Unsafe code detected for user ${userId}:`, validation.issues);
      aiDecisionLogger.logDecision({
        timestamp: new Date(),
        userId,
        eventType: 'CODE_REJECTED',
        data: {
          reason: 'Code validation failed',
          issues: validation.issues,
          codeHash: guardrails.hashContent(code)
        }
      });
    } else {
      console.log(`[BRAIN-GUARD] ✅ Code validated for user ${userId}`);
    }

    return {
      valid: validation.safe,
      issues: validation.issues
    };
  }

  /**
   * GUARD RAILS INTEGRATION: Track and enforce cost limits per request
   */
  async trackRequestCost(userId: string, requestId: string, estimatedTokens: number): Promise<{ withinBudget: boolean; costUsd: number; remaining: number }> {
    // Estimate cost: $0.075 per 1M input tokens
    const costUsd = (estimatedTokens / 1000000) * 0.075;
    const costTracking = guardrails.trackCost(userId, requestId, costUsd);

    if (!costTracking.withinBudget) {
      console.warn(`[BRAIN-GUARD] Cost limit exceeded for user ${userId}: $${costUsd.toFixed(4)}`);
      aiDecisionLogger.logDecision({
        timestamp: new Date(),
        userId,
        eventType: 'COST_LIMIT_EXCEEDED',
        data: {
          requestId,
          costUsd,
          budgetRemaining: costTracking.remaining
        }
      });
    }

    return {
      withinBudget: costTracking.withinBudget,
      costUsd,
      remaining: costTracking.remaining
    };
  }

  /**
   * Record a tool execution
   */
  recordToolCall(userId: string, sessionId: string, toolName: string, args: any): string {
    const session = this.registry.get(userId, sessionId);
    if (!session) {
      throw new Error(`Session not found: ${userId}:${sessionId}`);
    }
    
    const toolCallId = nanoid();
    session.activeToolCalls.set(toolCallId, {
      toolName,
      args,
      startedAt: new Date(),
      status: 'running',
    });
    
    this.touchSession(userId, sessionId);
    
    return toolCallId;
  }
  
  /**
   * Complete a tool execution
   */
  completeToolCall(userId: string, sessionId: string, toolCallId: string, result: any): void {
    const session = this.registry.get(userId, sessionId);
    if (!session) return;
    
    const toolCall = session.activeToolCalls.get(toolCallId);
    if (toolCall) {
      toolCall.status = 'completed';
      toolCall.result = result;
    }
  }
  
  /**
   * Register WebSocket connection
   */
  registerWebSocket(userId: string, sessionId: string, ws: WebSocket, roomId: string): void {
    const session = this.registry.get(userId, sessionId);
    if (!session) {
      console.error(`[BRAIN] Cannot register WebSocket: session not found ${userId}:${sessionId}`);
      return;
    }
    
    // Close old WebSocket if exists (prevent duplicate connections)
    if (session.wsConnection) {
      console.log(`[BRAIN] 🔄 Closing duplicate WebSocket for session: ${userId}:${sessionId}`);
      try {
        session.wsConnection.close(1000, 'Replaced by new connection');
      } catch (err) {
        console.error('[BRAIN] Error closing old WebSocket:', err);
      }
    }
    
    session.wsConnection = ws;
    session.wsRoomId = roomId;
    
    console.log(`[BRAIN] WebSocket registered for session: ${userId}:${sessionId} (room: ${roomId})`);
  }
  
  /**
   * Unregister WebSocket connection (only if it matches the current connection)
   */
  unregisterWebSocket(userId: string, sessionId: string, ws?: WebSocket): void {
    const session = this.registry.get(userId, sessionId);
    if (session) {
      // Only unregister if the WebSocket matches (prevents stale close handlers from wiping active connections)
      if (!ws || session.wsConnection === ws) {
        session.wsConnection = undefined;
        session.wsRoomId = undefined;
        console.log(`[BRAIN] WebSocket unregistered for session: ${userId}:${sessionId}`);
      } else {
        console.log(`[BRAIN] Ignoring unregister for stale WebSocket: ${userId}:${sessionId}`);
      }
    }
  }
  
  /**
   * Record token usage and persist to ledger
   */
  async recordTokens(userId: string, sessionId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const session = this.registry.get(userId, sessionId);
    if (!session) return;
    
    session.tokensUsed += inputTokens + outputTokens;
    
    // Persist to token ledger
    await this.persistence.recordTokenUsage(session, inputTokens, outputTokens);
    
    console.log(`[BRAIN] Recorded ${inputTokens + outputTokens} tokens for session ${userId}:${sessionId}`);
  }
  
  /**
   * Track file modification
   */
  trackFileModified(userId: string, sessionId: string, filePath: string): void {
    const session = this.registry.get(userId, sessionId);
    if (session) {
      session.filesModified.add(filePath);
      
      // Also add to mentioned files
      if (!session.mentionedFiles.includes(filePath)) {
        session.mentionedFiles.push(filePath);
      }
    }
  }
  
  /**
   * Update current goal
   */
  async setGoal(userId: string, sessionId: string, goal: string): Promise<void> {
    const session = this.registry.get(userId, sessionId);
    if (!session) return;
    
    session.currentGoal = goal;
    
    // Persist to database
    session.conversationStateId = await this.persistence.persistConversationState(session);
  }
  
  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionState[] {
    return this.registry.getAll();
  }
  
  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): SessionState[] {
    return this.registry.getAllForUser(userId);
  }
  
  /**
   * RESILIENT CLEANUP (Architect's Simplified Design)
   * 
   * CRITICAL: Timeout protection prevents lock release hangs
   * - Wraps lock release in Promise.race with 5s timeout
   * - ALWAYS deletes from registry (even on failure/timeout)
   * - Structured logging for diagnostics
   */
  async cleanupIdleSessions(): Promise<number> {
    const idleSessions = this.registry.getAll().filter(s => s.status === 'idle');
    let cleaned = 0;
    
    if (idleSessions.length === 0) {
      return 0;
    }
    
    console.log(`[BRAIN-CLEANUP] Starting cleanup of ${idleSessions.length} idle sessions`);
    
    // Process each session with error isolation
    for (const session of idleSessions) {
      const sessionKey = `${session.userId}:${session.sessionId}`;
      let releasedLocks = 0;
      
      try {
        // Structured logging - session context
        console.log(`[BRAIN-CLEANUP] Processing: ${sessionKey}`);
        console.log(`[BRAIN-CLEANUP]   - Created: ${session.createdAt.toISOString()}`);
        console.log(`[BRAIN-CLEANUP]   - Last activity: ${session.lastActivityAt.toISOString()}`);
        console.log(`[BRAIN-CLEANUP]   - Files modified: ${session.filesModified.size}`);
        console.log(`[BRAIN-CLEANUP]   - Active tool calls: ${session.activeToolCalls.size}`);
        
        // ARCHITECT'S TIMEOUT PROTECTION (5s limit)
        const { fileLockManager } = await import('./fileLockManager');
        const releasePromise = fileLockManager.releaseAllLocksForSession(session.sessionId);
        
        releasedLocks = await Promise.race([
          releasePromise,
          new Promise<number>((_, reject) => 
            setTimeout(() => reject(new Error('Lock release timeout (5s)')), 5000)
          )
        ]);
        
        if (releasedLocks > 0) {
          console.log(`[BRAIN-CLEANUP] ✅ Released ${releasedLocks} locks for ${sessionKey}`);
        } else {
          console.log(`[BRAIN-CLEANUP] No locks to release for ${sessionKey}`);
        }
      } catch (error: any) {
        // Log error but continue cleanup
        console.error(`[BRAIN-CLEANUP] ❌ Lock release failed/timeout for ${sessionKey}:`);
        console.error(`[BRAIN-CLEANUP]   - Error: ${error.message}`);
        console.error(`[BRAIN-CLEANUP]   - Continuing cleanup...`);
      } finally {
        // ALWAYS delete from registry (critical for preventing orphaned sessions)
        const deleted = this.registry.delete(session.userId, session.sessionId);
        
        if (deleted) {
          cleaned++;
          console.log(`[BRAIN-CLEANUP] ✅ Removed ${sessionKey} from registry (locks: ${releasedLocks})`);
        } else {
          console.warn(`[BRAIN-CLEANUP] ⚠️  Session ${sessionKey} already removed`);
        }
      }
    }
    
    console.log(`[BRAIN-CLEANUP] ✅ Complete: ${cleaned} sessions removed`);
    
    return cleaned;
  }
}

// ========== SINGLETON EXPORT ==========

export const beehiveAIBrain = new BeeHiveAIBrain();

// BRAIN-GAP-2: Check for stale sessions every 30 seconds
// Mark sessions as idle if no heartbeat for 60s
setInterval(() => {
  beehiveAIBrain.checkStaleSessionsAndMarkIdle();
}, 30 * 1000);

// Cleanup idle sessions every 10 minutes
// This removes sessions marked as idle and releases their file locks
setInterval(async () => {
  const cleaned = await beehiveAIBrain.cleanupIdleSessions();
  
  if (cleaned > 0) {
    console.log(`[BRAIN-CLEANUP] Cleaned ${cleaned} idle sessions with file locks released`);
  }
}, 10 * 60 * 1000);

console.log('[BRAIN] ✅ BeeHiveAI Brain initialized - Universal session management active');
