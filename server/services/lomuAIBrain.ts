/**
 * LOMU AI BRAIN - Unified Session Management
 * 
 * Single source of truth for all LomuAI sessions.
 * Hybrid pattern: In-memory cache + database persistence.
 */

import { nanoid } from 'nanoid';
import { db } from '../db';
import { conversationStates, chatMessages, tokenLedger, lomuJobs } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { WebSocket } from 'ws';

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

class LomuAIBrain {
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
   * Update session activity timestamp
   */
  touchSession(userId: string, sessionId: string): void {
    const session = this.registry.get(userId, sessionId);
    if (session) {
      session.lastActivityAt = new Date();
      session.status = 'active';
    }
  }
  
  /**
   * Close session and persist final state
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
    
    // Remove from registry
    this.registry.delete(userId, sessionId);
    
    console.log(`[BRAIN] ✅ Closed session: ${userId}:${sessionId}`);
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
    
    session.wsConnection = ws;
    session.wsRoomId = roomId;
    
    console.log(`[BRAIN] WebSocket registered for session: ${userId}:${sessionId} (room: ${roomId})`);
  }
  
  /**
   * Unregister WebSocket connection
   */
  unregisterWebSocket(userId: string, sessionId: string): void {
    const session = this.registry.get(userId, sessionId);
    if (session) {
      session.wsConnection = undefined;
      session.wsRoomId = undefined;
      console.log(`[BRAIN] WebSocket unregistered for session: ${userId}:${sessionId}`);
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
   * Cleanup idle sessions (called periodically)
   */
  cleanupIdleSessions(): number {
    return this.registry.cleanupIdleSessions();
  }
}

// ========== SINGLETON EXPORT ==========

export const lomuAIBrain = new LomuAIBrain();

// Cleanup idle sessions every 10 minutes
setInterval(() => {
  lomuAIBrain.cleanupIdleSessions();
}, 10 * 60 * 1000);

console.log('[BRAIN] ✅ LomuAI Brain initialized - Universal session management active');
