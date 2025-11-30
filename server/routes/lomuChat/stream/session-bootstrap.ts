import type { Response } from 'express';
import type { WebSocketServer } from 'ws';
import { db } from '../../../db.ts';
import { storage } from '../../../storage.ts';
import { chatMessages, lomuAttachments, conversationStates, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { beehiveAIBrain } from '../../../services/lomuAIBrain.ts';
import { traceLogger } from '../../../services/traceLogger.ts';
import { FileChangeTracker } from '../../../services/validationHelpers.ts';
import { 
  getOrCreateState, 
  clearState, 
  clearCodeScratchpad 
} from '../../../services/conversationState.ts';
import {
  configureSSEHeaders,
  sendInitialHeartbeat,
  createEventSender,
  setupHeartbeat,
  setupStreamTimeout,
  setupSocketKeepAlive,
} from '../streaming.ts';
import type { 
  StreamRequest, 
  AutonomyLevelConfig,
  StreamState,
  StreamContext 
} from './types.ts';

/**
 * Parameters for bootstrapping a stream session
 */
export interface BootstrapSessionParams {
  req: any; // Express request (typed as any to avoid Express type complexity)
  res: Response;
  userId: string;
  message: string;
  attachments?: StreamRequest['attachments'];
  activeStreams: Set<string>;
  wss: WebSocketServer | null;
  sessionId?: string;
  targetContext: 'platform' | 'project';
  projectId: string | null;
}

/**
 * Result of session bootstrap operation
 * Contains all session data and stream utilities needed for agent execution
 */
export interface BootstrapSessionResult {
  // Session and conversation context
  session: any; // BeeHive Brain session
  conversationState: any; // Database conversation state
  userMsg: any; // Saved user message record
  traceId: string | null;
  autonomyLevel: 'basic' | 'standard' | 'deep' | 'max';
  config: AutonomyLevelConfig;
  
  // Stream utilities
  sendEvent: (type: string, data: any) => void;
  fileChangeTracker: FileChangeTracker;
  heartbeatInterval: NodeJS.Timeout;
  streamTimeoutId: NodeJS.Timeout;
  activeStreamsKey: string;
  
  // Early termination flag (for @RESET/@NEWPROJECT commands)
  shouldTerminate: boolean;
  terminationMessageId?: string;
}

/**
 * Autonomy level configurations
 * Defines capabilities and limits for each tier
 */
const AUTONOMY_LEVEL_CONFIG: Record<string, AutonomyLevelConfig> = {
  basic: { 
    maxTokens: 8000, 
    allowTaskTracking: false, 
    allowWebSearch: false, 
    allowSubAgents: false, 
    requireApproval: true 
  },
  standard: { 
    maxTokens: 8000, 
    allowTaskTracking: true, 
    allowWebSearch: false, 
    allowSubAgents: false, 
    requireApproval: false 
  },
  deep: { 
    maxTokens: 16000, 
    allowTaskTracking: true, 
    allowWebSearch: true, 
    allowSubAgents: true, 
    requireApproval: false 
  },
  max: { 
    maxTokens: 16000, 
    allowTaskTracking: true, 
    allowWebSearch: true, 
    allowSubAgents: true, 
    requireApproval: false 
  },
};

/**
 * Bootstrap a new stream session with SSE setup, session creation, and user message handling
 * 
 * This function handles all initialization logic for a BeeHive chat stream:
 * - Prevents concurrent streams per user
 * - Sets up SSE headers and heartbeat
 * - Creates or retrieves session via beehiveAIBrain
 * - Saves user message and attachments to database
 * - Initializes trace logging
 * - Detects and handles @RESET/@NEWPROJECT commands
 * 
 * @param params - Bootstrap parameters including request, user info, and stream config
 * @returns Session context, stream utilities, and termination flag
 */
export async function bootstrapStreamSession(
  params: BootstrapSessionParams
): Promise<BootstrapSessionResult> {
  const { 
    req, 
    res, 
    userId, 
    message, 
    attachments, 
    activeStreams, 
    wss,
    sessionId,
    targetContext,
    projectId 
  } = params;

  // ============================================================================
  // STEP 1: PREVENT CONCURRENT STREAMS PER USER
  // ============================================================================
  const activeStreamsKey = `lomu-ai-stream-${userId}`;
  if (activeStreams.has(activeStreamsKey)) {
    console.log('[SESSION-BOOTSTRAP] Concurrent stream detected for user:', userId);
    throw new Error('CONCURRENT_STREAM');
  }
  activeStreams.add(activeStreamsKey);
  console.log('[SESSION-BOOTSTRAP] Stream registered for user:', userId);

  // ============================================================================
  // STEP 2: SETUP SSE HEADERS AND HEARTBEAT
  // ============================================================================
  console.log('[SESSION-BOOTSTRAP] Setting up SSE headers');
  configureSSEHeaders(res);
  sendInitialHeartbeat(res);
  setupSocketKeepAlive(req);

  // Create event sender for SSE communication
  const sendEvent = createEventSender(res);

  // ============================================================================
  // STEP 3: CREATE FILE CHANGE TRACKER
  // ============================================================================
  const fileChangeTracker = new FileChangeTracker();
  console.log('[SESSION-BOOTSTRAP] FileChangeTracker initialized');

  // ============================================================================
  // STEP 4: SETUP HEARTBEAT AND TIMEOUT
  // ============================================================================
  const heartbeatInterval = setupHeartbeat(res);
  const streamTimeoutId = setupStreamTimeout(res, sendEvent);
  console.log('[SESSION-BOOTSTRAP] Heartbeat and timeout configured');

  // ============================================================================
  // STEP 5: FETCH USER AUTONOMY LEVEL
  // ============================================================================
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const autonomyLevel = (user?.autonomyLevel || 'basic') as 'basic' | 'standard' | 'deep' | 'max';
  console.log(`[SESSION-BOOTSTRAP] User autonomy level: ${autonomyLevel}`);

  // Get autonomy level configuration
  const config = AUTONOMY_LEVEL_CONFIG[autonomyLevel] || AUTONOMY_LEVEL_CONFIG.basic;

  // ============================================================================
  // STEP 6: CREATE OR RETRIEVE LOMU BRAIN SESSION
  // ============================================================================
  const session = await beehiveAIBrain.getOrCreateSession({
    userId,
    sessionId: sessionId || nanoid(),
    targetContext,
    projectId: projectId || undefined,
  });
  
  // Update session activity timestamp
  beehiveAIBrain.touchSession(userId, session.sessionId);
  
  // Get conversation state for backward compatibility with existing code
  // Brain tracks session, but we still use conversationState for some DB operations
  const conversationState = await getOrCreateState(userId, projectId);

  // ============================================================================
  // STEP 7: SAVE USER MESSAGE TO DATABASE
  // ============================================================================
  const [userMsg] = await db
    .insert(chatMessages)
    .values({
      userId,
      projectId: projectId || null,
      conversationStateId: conversationState.id,
      fileId: null,
      role: 'user',
      content: message,
      isPlatformHealing: targetContext === 'platform',
    })
    .returning();

  console.log(`[SESSION-BOOTSTRAP] User message saved: ${userMsg.id}`);

  // ============================================================================
  // STEP 8: SAVE ATTACHMENTS TO DATABASE
  // ============================================================================
  if (attachments && attachments.length > 0) {
    console.log('[SESSION-BOOTSTRAP] Saving', attachments.length, 'attachments');
    const attachmentValues = attachments.map((att: any) => {
      // Handle both URL-only attachments (from pasted images) and full attachments
      const fileName = att.fileName || (att.url ? att.url.split('/').pop() : 'attachment');
      const fileType = att.fileType || 'image/png';
      const content = att.content || att.url || '';
      const mimeType = att.mimeType || 'image/png';
      const size = att.size || 0;
      
      console.log('[SESSION-BOOTSTRAP] Attachment:', { fileName, fileType, size });
      
      return {
        messageId: userMsg.id,
        fileName,
        fileType,
        content,
        mimeType,
        size,
      };
    });

    await db.insert(lomuAttachments).values(attachmentValues);
    console.log('[SESSION-BOOTSTRAP] Attachments saved successfully');
  }

  // Emit user message event
  sendEvent('user_message', { messageId: userMsg.id });

  // ============================================================================
  // STEP 9: INITIALIZE TRACE LOGGING
  // ============================================================================
  let traceId = conversationState.traceId;
  if (!traceId) {
    traceId = traceLogger.startTrace(conversationState.id);
    await db
      .update(conversationStates)
      .set({ traceId })
      .where(eq(conversationStates.id, conversationState.id));
    console.log(`[SESSION-BOOTSTRAP] Started new trace: ${traceId} for conversation ${conversationState.id}`);
  }

  // ============================================================================
  // STEP 10: INITIALIZE CONVERSATION START TIME (EMERGENCY BRAKES)
  // ============================================================================
  if (!conversationState.conversationStartTime) {
    await db
      .update(conversationStates)
      .set({ conversationStartTime: new Date() })
      .where(eq(conversationStates.id, conversationState.id));
    console.log(`[SESSION-BOOTSTRAP] Initialized conversationStartTime for ${conversationState.id}`);
  }

  // Log user message to trace
  traceLogger.log(traceId, 'prompt', {
    userId,
    message: message.substring(0, 500),
    attachmentCount: attachments?.length || 0,
  });

  // ============================================================================
  // STEP 11: DETECT AND HANDLE @RESET/@NEWPROJECT COMMANDS
  // ============================================================================
  const lowerMessage = message.toLowerCase().trim();
  if (lowerMessage.startsWith('@reset') || lowerMessage.startsWith('@newproject')) {
    console.log('[SESSION-BOOTSTRAP] Detected reset command, clearing conversation state and scratchpad');
    
    // Clear conversation state
    await clearState(conversationState.id);
    
    // Clear code scratchpad
    await clearCodeScratchpad(conversationState.id);
    
    // Clear scratchpad entries
    await storage.clearScratchpadEntries(conversationState.id);
    
    // Send confirmation message
    const resetMessage = lowerMessage.startsWith('@reset') 
      ? 'Conversation reset! Starting fresh. How can I help you?'
      : 'New project started! Previous context cleared. What would you like to build?';
    
    const [resetMsg] = await db
      .insert(chatMessages)
      .values({
        userId,
        projectId: projectId || null,
        conversationStateId: conversationState.id,
        fileId: null,
        role: 'assistant',
        content: resetMessage,
        isPlatformHealing: targetContext === 'platform',
      })
      .returning();
    
    // Send reset confirmation events
    sendEvent('content', { content: resetMessage });
    sendEvent('complete', {});
    res.write(`data: ${JSON.stringify({ type: 'complete', messageId: resetMsg.id })}\n\n`);
    
    console.log(`[SESSION-BOOTSTRAP] Reset command processed, terminating stream early`);
    
    // Return early termination result
    return {
      session,
      conversationState,
      userMsg,
      traceId,
      autonomyLevel,
      config,
      sendEvent,
      fileChangeTracker,
      heartbeatInterval,
      streamTimeoutId,
      activeStreamsKey,
      shouldTerminate: true,
      terminationMessageId: resetMsg.id,
    };
  }

  // ============================================================================
  // STEP 12: LOG SESSION INITIALIZATION SUCCESS
  // ============================================================================
  console.log('[SESSION-BOOTSTRAP] Session active:', session.sessionId);
  console.log('[SESSION-BOOTSTRAP] Bootstrap completed successfully');

  // Return session context and stream utilities
  return {
    session,
    conversationState,
    userMsg,
    traceId,
    autonomyLevel,
    config,
    sendEvent,
    fileChangeTracker,
    heartbeatInterval,
    streamTimeoutId,
    activeStreamsKey,
    shouldTerminate: false,
  };
}

/**
 * Cleanup function to remove user from active streams
 * Should be called in finally block of stream handler
 * 
 * @param activeStreams - Set of active stream keys
 * @param activeStreamsKey - Key to remove from active streams
 */
export function cleanupStreamSession(
  activeStreams: Set<string>,
  activeStreamsKey: string
): void {
  activeStreams.delete(activeStreamsKey);
  console.log('[SESSION-BOOTSTRAP] Stream cleanup completed for:', activeStreamsKey);
}
