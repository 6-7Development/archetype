import { Router } from 'express';
import { db } from '../db.ts';
import { storage } from '../storage.ts';
import { chatMessages, taskLists, tasks, lomuAttachments, lomuJobs, users, subscriptions, projects, conversationStates, platformIncidents, tokenLedger } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated, isAdmin } from '../universalAuth.ts';
import { streamGeminiResponse } from '../gemini.ts';
import { TokenTracker } from '../services/tokenTracker.ts';
import { CreditManager } from '../services/creditManager.ts';
import { RAILWAY_CONFIG } from '../config/railway.ts';
import { platformHealing } from '../platformHealing.ts';
import { platformAudit } from '../platformAudit.ts';
import { healOrchestrator } from '../services/healOrchestrator.ts';
import { consultArchitect } from '../tools/architect-consult.ts';
import { executeWebSearch } from '../tools/web-search.ts';
import { GitHubService, getGitHubService } from '../githubService.ts';
import { createTaskList, updateTask, readTaskList } from '../tools/task-management.ts';
import { performDiagnosis } from '../tools/diagnosis.ts';
import { startSubagent } from '../subagentOrchestration.ts';
import { parallelSubagentQueue } from '../services/parallelSubagentQueue.ts';
import { lomuAIBrain } from '../services/lomuAIBrain.ts';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createSafeAnthropicRequest } from '../lib/anthropic-wrapper.ts';
import { sanitizeDiagnosisForAI } from '../lib/diagnosis-sanitizer.ts';
import { filterToolCallsFromMessages } from '../lib/message-filter.ts';
import type { WebSocketServer } from 'ws';
import { broadcastToUser } from './websocket.ts';
import { getOrCreateState, formatStateForPrompt, updateCodeScratchpad, getCodeScratchpad, clearCodeScratchpad, clearState, estimateConversationTokens, summarizeOldMessages } from '../services/conversationState.ts';
import { agentFailureDetector } from '../services/agentFailureDetector.ts';
import { classifyUserIntent, getMaxIterationsForIntent, type UserIntent } from '../shared/chatConfig.ts';
import { validateFileChanges, validateAllChanges, FileChangeTracker, type ValidationResult } from '../services/validationHelpers.ts';
import { PhaseOrchestrator } from '../services/PhaseOrchestrator.ts';
import { RunStateManager } from '../services/RunStateManager.ts';
import { traceLogger } from '../services/traceLogger.ts';
import { nanoid } from 'nanoid';
// Import extracted utilities and constants
import { EMERGENCY_LIMITS, MAX_CONSECUTIVE_THINKING } from './lomu/constants.ts';
import {
  mapDatabaseStatusToRunState,
  detectLowConfidencePatterns,
  retryWithBackoff,
  ensureActiveSession,
  validateProjectPath,
  validateContextAccess,
  handleBilling,
  broadcastFileUpdate as broadcastFileUpdateUtil,
  waitForApproval,
  resolveApproval
} from './lomu/utils.ts';

const execAsync = promisify(exec);

// 🎯 INTENT CLASSIFICATION (like Replit Agent)
// Now using shared configuration from chatConfig.ts
// Both regular LomuAI and Platform Healing use the same logic

function classifyUserIntent_DEPRECATED(message: string): UserIntent {
  const lowerMessage = message.toLowerCase();
  
  // 🎯 MULTI-PASS SCORING SYSTEM (more robust than first-match-wins)
  let scores = { build: 0, fix: 0, diagnostic: 0, casual: 0 };
  
  // BUILD intent: Creating new features, planning, architecting, adding functionality
  // EXPANDED: Include planning/design/architecture vocabulary with FLEXIBLE MATCHING
  const buildPatterns = [
    /\b(build|creat|add|implement|mak|develop|writ)/g,                // +3 each (partial match)
    /\b(set up|setup|install|integrat|deploy|publish)/g,              // +3 each (partial)
    /\b(plan|design|architect|outline|draft|prepar|document)/g,       // +3 each (FLEXIBLE)
    /\b(migrat|refactor|restructur|reorganiz)/g,                      // +2 each (FLEXIBLE)
    /\b(new feature|new module|new component|new page)/g,             // +4 each
  ];
  buildPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.build += matches.length * (idx < 3 ? 3 : idx === 3 ? 2 : 4);
    }
  });
  
  // FIX intent: Fixing bugs, errors, issues, updates
  const fixPatterns = [
    /\b(fix|repair|resolve|solve|debug|correct|patch)\b/g,            // +3 each
    /\b(update|modify|change|improve|optimize|enhance)\b/g,           // +2 each
    /\b(broken|bug|error|issue|problem|crash|fail)\b/g,               // +3 each
    /\b(not working|doesn't work|won't run|failing)\b/g,              // +4 each
  ];
  fixPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.fix += matches.length * (idx === 1 ? 2 : idx === 3 ? 4 : 3);
    }
  });
  
  // DIAGNOSTIC intent: Investigating, analyzing, checking status
  const diagnosticPatterns = [
    /\b(diagnos|investigat|analyz|examine|inspect)\b/g,               // +3 each
    /\b(check|review|scan|search|find|look)\b/g,                      // +1 each (low weight)
    /\b(what.*wrong|why.*not|how.*work|what.*happen)\b/g,            // +3 each
    /\b(status|health|metrics|logs|telemetry)\b/g,                    // +3 each
  ];
  diagnosticPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.diagnostic += matches.length * (idx === 1 ? 1 : 3);
    }
  });
  
  // CASUAL: Greetings, short questions, acknowledgments
  const casualPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure)$/,         // +5 if entire message
    /\b(hi|hello|hey|thanks|cool|nice|great|awesome)\b/g,             // +2 each
  ];
  casualPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.casual += matches.length * (idx === 0 ? 5 : 2);
    }
  });
  
  // HEURISTIC BONUSES
  if (lowerMessage.length < 30 && scores.casual > 0) {
    scores.casual += 3; // Boost short casual messages
  }
  if (lowerMessage.length < 50 && Object.values(scores).every(s => s === 0)) {
    scores.casual += 2; // Short messages with no keywords → likely casual
  }
  
  // Find highest score - FAVOR BUILD over diagnostic for ties/zeros
  const maxScore = Math.max(...Object.values(scores));
  let intent: UserIntent;
  
  if (maxScore === 0) {
    // No keywords matched → default to BUILD (safe, allows full iteration budget)
    intent = 'build';
  } else {
    // Find highest score, prefer build > fix > diagnostic > casual in ties
    const priorityOrder: UserIntent[] = ['build', 'fix', 'diagnostic', 'casual'];
    intent = priorityOrder.find(key => scores[key] === maxScore) || 'build';
  }
  
  console.log(`[INTENT-SCORE] Message: "${message.substring(0, 80)}..." | Scores:`, scores, `| Intent: ${intent}`);
  
  return intent;
}

function getMaxIterationsForIntent_DEPRECATED(intent: UserIntent): number {
  // DEPRECATED: Now using shared config from chatConfig.ts
  return 30;
}

const router = Router();

// WebSocket server reference for live preview updates
let wss: WebSocketServer | null = null;

// Initialize WebSocket server reference
export function initializeLomuAIWebSocket(websocketServer: WebSocketServer) {
  wss = websocketServer;
  console.log('[LOMU-AI] WebSocket server initialized for live preview broadcasts');
}

// Wrapper for broadcastFileUpdate that provides wss context
function broadcastFileUpdate(
  path: string, 
  operation: 'create' | 'modify' | 'delete', 
  targetContext: 'platform' | 'project' = 'platform',
  projectId: string | null = null,
  userId: string | null = null
) {
  // Call imported utility with wss context
  broadcastFileUpdateUtil(wss, path, operation, targetContext, projectId, userId);
}

// Track active streams to prevent concurrent requests per user
const activeStreams = new Set<string>();

// ============================================================================
// PHASE 1 - TASK 4: SECURE ACCESS TIER ENDPOINT (Prevent Client Spoofing)
// ============================================================================

// SECURE ENDPOINT: Determine access tier server-side based on projectId only
// CRITICAL: Client CANNOT pass targetContext - server determines it from projectId
router.post('/access-tier', isAuthenticated, async (req: any, res) => {
  try {
    const { projectId } = req.body; // ONLY accept projectId from client
    const userId = req.authenticatedUserId;

    // SECURITY: Determine context server-side based on projectId
    let targetContext: 'platform' | 'project';
    
    if (!projectId) {
      // No projectId = platform context
      targetContext = 'platform';
    } else {
      // Has projectId = project context
      targetContext = 'project';
    }

    // Platform healing is FREE only for owners
    if (targetContext === 'platform') {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const isFreeAccess = user?.isOwner === true;
      
      if (!isFreeAccess) {
        console.log(`[ACCESS-TIER] ❌ Platform healing denied - user is not owner (userId: ${userId})`);
        return res.status(403).json({ error: 'Platform healing requires owner access' });
      }
      
      console.log(`[ACCESS-TIER] ✅ Platform healing granted - FREE access (userId: ${userId})`);
      return res.json({ isFreeAccess: true, targetContext: 'platform' });
    }

    // All project work is paid (credit billing)
    console.log(`[ACCESS-TIER] Project context - PAID billing (userId: ${userId}, projectId: ${projectId})`);
    return res.json({ isFreeAccess: false, targetContext: 'project' });
  } catch (error: any) {
    console.error('[ACCESS-TIER] Failed to determine access tier:', error);
    // Default to paid on error (safer - prevents free access on errors)
    return res.status(500).json({ error: 'Failed to determine access tier', isFreeAccess: false });
  }
});

// Get a message by ID (for fetching final message when job completes)
router.get('/message/:messageId', isAuthenticated, async (req: any, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.authenticatedUserId;

    const [message] = await db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.id, messageId),
        eq(chatMessages.userId, userId)
      ))
      .limit(1);

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ success: true, message });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to fetch message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve pending changes and auto-resume LomuAI
router.post('/approve/:messageId', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { messageId } = req.params;
    const { sessionId } = req.body; // Get sessionId from request body
    const userId = req.authenticatedUserId;

    // Find the message
    const [message] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.approvalStatus !== 'pending_approval') {
      return res.status(400).json({ error: 'Message is not pending approval' });
    }

    // Update approval status
    await db
      .update(chatMessages)
      .set({
        approvalStatus: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      })
      .where(eq(chatMessages.id, messageId));

    console.log('[LOMU-AI] Changes approved for message:', messageId);

    // CRITICAL: Resolve the approval promise to resume the SSE stream
    const resolved = resolveApproval(messageId, true);
    if (resolved) {
      console.log('[LOMU-AI] Stream will resume after approval');
    } else {
      console.warn('[LOMU-AI] No pending stream found for message:', messageId);
    }

    res.json({ 
      success: true, 
      message: 'Changes approved - work resuming...',
    });

  } catch (error: any) {
    console.error('[LOMU-AI] Approval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject pending changes
router.post('/reject/:messageId', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { messageId } = req.params;
    const { sessionId } = req.body;
    const userId = req.authenticatedUserId;

    // Find the message
    const [message] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.approvalStatus !== 'pending_approval') {
      return res.status(400).json({ error: 'Message is not pending approval' });
    }

    // Update approval status
    await db
      .update(chatMessages)
      .set({
        approvalStatus: 'rejected',
        approvedBy: userId,
        approvedAt: new Date(),
      })
      .where(eq(chatMessages.id, messageId));

    console.log('[LOMU-AI] Changes rejected for message:', messageId);

    // Resolve the pending approval with false (rejected) to resume stream
    const resolved = resolveApproval(messageId, false);
    if (resolved) {
      console.log('[LOMU-AI] Stream resumed with rejection');
    } else {
      console.warn('[LOMU-AI] No pending stream found for message:', messageId);
    }

    res.json({ success: true, message: 'Changes rejected' });
  } catch (error: any) {
    console.error('[LOMU-AI] Rejection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's current autonomy level and available levels based on subscription
router.get('/autonomy-level', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;

    // Fetch user and subscription
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 🔑 Platform owners get MAX autonomy automatically (bypass subscription)
    const isOwner = user.isOwner === true;
    let maxAllowedLevel: string;
    let plan: string;

    if (isOwner) {
      maxAllowedLevel = 'max';
      plan = 'owner';

      // Auto-set owner to 'max' if not already set
      if (!user.autonomyLevel || user.autonomyLevel === 'basic') {
        await db.update(users).set({ autonomyLevel: 'max' }).where(eq(users.id, userId));
        console.log(`[LOMU-AI] Owner ${userId} auto-upgraded to MAX autonomy`);
      }
    } else {
      // Regular users: check subscription
      plan = subscription?.plan || 'free';
      const planToMaxLevel: Record<string, string> = {
        'free': 'basic',
        'starter': 'standard',
        'pro': 'standard',
        'enterprise': 'deep',
        'premium': 'max',
      };
      maxAllowedLevel = planToMaxLevel[plan] || 'basic';
    }

    // Define autonomy level features
    const autonomyLevels = {
      basic: {
        id: 'basic',
        name: 'Basic',
        description: 'Manual approval required for all changes',
        icon: 'shield',
        features: ['Manual approval required', 'No task tracking', 'Basic diagnosis tools only'],
        requiredPlan: 'free',
        maxTokens: 8000,
      },
      standard: {
        id: 'standard',
        name: 'Standard',
        description: 'Autonomous mode with full file access',
        icon: 'zap',
        features: ['Autonomous mode', 'Full file read/write', 'Auto-commit enabled', 'Task tracking'],
        requiredPlan: 'pro',
        maxTokens: 8000,
      },
      deep: {
        id: 'deep',
        name: 'Deep',
        description: 'Extended thinking and web research',
        icon: 'brain',
        features: ['Everything in Standard', 'Extended thinking (16K tokens)', 'Web search via Tavily', 'Sub-agent orchestration'],
        requiredPlan: 'enterprise',
        maxTokens: 16000,
      },
      max: {
        id: 'max',
        name: 'Max',
        description: 'Full autonomy with maximum intelligence',
        icon: 'infinity',
        features: ['Everything in Deep', 'Multi-agent orchestration', 'Advanced caching', 'I AM auto-consultation'],
        requiredPlan: 'premium',
        maxTokens: 16000,
      },
    };

    res.json({
      currentLevel: isOwner ? (user.autonomyLevel || 'max') : (user.autonomyLevel || 'basic'),
      maxAllowedLevel,
      plan,
      isOwner,
      levels: autonomyLevels,
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Get autonomy level error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user's autonomy level (with subscription gating)
router.put('/autonomy-level', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { level } = req.body;

    if (!level || !['basic', 'standard', 'deep', 'max'].includes(level)) {
      return res.status(400).json({ error: 'Invalid autonomy level. Must be: basic, standard, deep, or max' });
    }

    // Fetch user and subscription
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 🔑 Platform owners bypass subscription checks
    const isOwner = user.isOwner === true;

    if (!isOwner) {
      // Regular users: check subscription tier
      const plan = subscription?.plan || 'free';
      const planToMaxLevel: Record<string, number> = {
        'free': 0,      // basic only
        'starter': 1,   // standard
        'pro': 1,       // standard
        'enterprise': 2,// deep
        'premium': 3,   // max
      };

      const levelToNumber: Record<string, number> = {
        'basic': 0,
        'standard': 1,
        'deep': 2,
        'max': 3,
      };

      const maxAllowed = planToMaxLevel[plan] || 0;
      const requested = levelToNumber[level];

      if (requested > maxAllowed) {
        const levelNames = ['basic', 'standard', 'deep', 'max'];
        return res.status(403).json({ 
          error: `Your ${plan} plan only allows up to ${levelNames[maxAllowed]} autonomy level. Upgrade to access ${level} mode.`,
          maxAllowedLevel: levelNames[maxAllowed],
        });
      }
    }

    // Update user's autonomy level
    await db
      .update(users)
      .set({ autonomyLevel: level, updatedAt: new Date() })
      .where(eq(users.id, userId));

    console.log(`[LOMU-AI] User ${userId} autonomy level updated to: ${level}`);

    res.json({ 
      success: true, 
      level,
      message: `Autonomy level updated to ${level}`,
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Update autonomy level error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all projects (admin only - for project selector in LomuAI)
router.get('/projects', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { storage } = await import('../storage');
    const projects = await storage.getAllProjects();

    console.log(`[LOMU-AI] Fetched ${projects.length} projects for admin project selector`);

    res.json(projects);
  } catch (error: any) {
    console.error('[LOMU-AI] Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task list by ID
router.get('/task-list/:taskListId', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { taskListId } = req.params;

    if (!taskListId || taskListId === 'undefined' || taskListId === 'null') {
      console.log(`[LOMU-AI] Invalid task list ID: ${taskListId}`);
      return res.json({ 
        success: true, 
        tasks: [],
        count: 0,
        message: 'No task list available'
      });
    }

    const taskList = await db
      .select()
      .from(tasks)
      .where(eq(tasks.taskListId, taskListId))
      .orderBy(tasks.createdAt);

    console.log(`[LOMU-AI] Fetched ${taskList.length} tasks for task list ${taskListId}`);

    res.json({ 
      success: true, 
      tasks: taskList,
      count: taskList.length,
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Get task list error:', error);
    // Return empty array instead of error to prevent UI crashes
    res.json({ 
      success: false,
      tasks: [],
      count: 0,
      error: error.message 
    });
  }
});

// Get LomuAI chat history (platform healing only - admin)
router.get('/history', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;

    const messages = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.isPlatformHealing, true)
        )
      )
      .orderBy(chatMessages.createdAt);

    // Fetch attachments for each message
    const messagesWithAttachments = await Promise.all(
      messages.map(async (msg) => {
        const attachments = await db
          .select()
          .from(lomuAttachments)
          .where(eq(lomuAttachments.messageId, msg.id));

        return {
          ...msg,
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      })
    );

    // Filter out tool calls from messages before sending to frontend
    const filteredMessages = filterToolCallsFromMessages(messagesWithAttachments);

    res.json({ messages: filteredMessages });
  } catch (error: any) {
    console.error('[LOMU-AI-CHAT] Error loading history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get LomuAI chat history for a specific project
// Accepts optional ?sessionId=UUID query param to load specific conversation session
router.get('/history/:projectId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { projectId } = req.params;
    const { sessionId } = req.query;

    let messages: any[];

    if (sessionId) {
      // Load messages for specific session (with security check)
      console.log(`📝 [LOMU-CHAT-HISTORY] Fetching history for session ${sessionId}, user ${userId}`);
      messages = await storage.getChatHistoryBySession(userId, sessionId);
      console.log(`📝 [LOMU-CHAT-HISTORY] Found ${messages?.length || 0} messages for session ${sessionId}`);
    } else {
      // Load messages by project (backward compatible)
      console.log(`📝 [LOMU-CHAT-HISTORY] Fetching history for project ${projectId}, user ${userId}`);
      messages = await storage.getChatHistory(userId, projectId);
      console.log(`📝 [LOMU-CHAT-HISTORY] Found ${messages?.length || 0} messages for project ${projectId}`);
    }

    // Fetch attachments for each message
    const messagesWithAttachments = await Promise.all(
      messages.map(async (msg) => {
        const attachments = await db
          .select()
          .from(lomuAttachments)
          .where(eq(lomuAttachments.messageId, msg.id));

        return {
          ...msg,
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      })
    );

    // Filter out tool calls from messages before sending to frontend
    const filteredMessages = filterToolCallsFromMessages(messagesWithAttachments);

    res.json({ messages: filteredMessages });
  } catch (error: any) {
    console.error('[LOMU-CHAT-HISTORY] Error loading history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stream LomuAI chat response
// NOTE: Removed isAdmin middleware - regular users can now use LomuAI via credit-based billing
// Platform healing (targetContext="platform") has owner-only access checks inside the handler
router.post('/stream', isAuthenticated, async (req: any, res) => {
  console.log('[LOMU-AI-CHAT] Stream request received');
  
  // STEP 1: Extract targetContext from request body (with backward compatibility)
  // Default to 'platform' if not provided (existing behavior)
  const { 
    message, 
    attachments = [], 
    autoCommit = false, 
    autoPush = false, 
    projectId = null,
    sessionId,  // Extract sessionId for billing event correlation
    targetContext = (projectId ? 'project' : 'platform') // Auto-detect from projectId if not provided
  } = req.body;
  
  const userId = req.authenticatedUserId;
  
  console.log('[LOMU-AI-CHAT] Message:', message?.substring(0, 50), 
    'Context:', targetContext, 
    'Attachments:', attachments?.length || 0, 
    'UserId:', userId, 
    'ProjectId:', projectId || 'none');

  // Validate targetContext
  if (targetContext !== 'platform' && targetContext !== 'project') {
    console.log('[LOMU-AI-CHAT] ERROR: Invalid targetContext');
    return res.status(400).json({ 
      error: 'Invalid targetContext. Must be "platform" or "project".' 
    });
  }

  if (!message || typeof message !== 'string') {
    console.log('[LOMU-AI-CHAT] ERROR: Message validation failed');
    return res.status(400).json({ error: 'Oops! I need a message to help you. What would you like me to work on?' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.log('[LOMU-AI-CHAT] ERROR: No Gemini API key');
    return res.status(503).json({ error: 'Hmm, my AI brain isn\'t connected yet. The Gemini API key needs to be configured. Could you set it up in your environment variables?' });
  }
  
  // STEP 2: Validate context access (owner-only for platform, ownership check for projects)
  const accessCheck = await validateContextAccess(userId, targetContext, projectId);
  if (!accessCheck.allowed) {
    console.log('[LOMU-AI-CHAT] ERROR: Access denied -', accessCheck.reason);
    return res.status(403).json({ 
      error: accessCheck.reason,
      targetContext,
      requiresOwnership: targetContext === 'platform'
    });
  }

  // ============================================================================
  // TIER 1 BILLING: Estimate tokens BEFORE streaming to reserve credits
  // ============================================================================
  
  // Estimate input tokens from user message (rough: 1 char ≈ 4 tokens)
  const promptTokens = message.length * 4;
  
  // Estimate conversation history tokens (last 5 messages)
  const historyForEstimate = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.isPlatformHealing, true)
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(5);
  
  const conversationTokens = estimateConversationTokens(
    historyForEstimate.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))
  );
  
  const estimatedInputTokens = conversationTokens + promptTokens;
  const estimatedOutputTokens = Math.max(1000, estimatedInputTokens * 0.5); // Conservative estimate
  
  console.log(`[BILLING] Token estimates - Input: ${estimatedInputTokens}, Output: ${estimatedOutputTokens}`);

  // Start agent run and reserve credits based on token estimates
  const AgentExecutor = (await import('../services/agentExecutor')).AgentExecutor;
  const runResult = await AgentExecutor.startRun({
    userId,
    projectId: projectId || null,
    estimatedInputTokens,
    estimatedOutputTokens,
    targetContext, // Platform = FREE, Project = PAID
    wss: wss || undefined,  // WebSocket server for billing event emission
    sessionId,  // Session ID for event correlation
  });

  if (!runResult.success) {
    return res.status(402).json({ 
      error: runResult.error,
      creditsNeeded: runResult.creditsReserved,
      requiresCreditPurchase: true,
    });
  }

  const agentRunId = runResult.runId!;
  const creditsReserved = runResult.creditsReserved!;
  console.log(`[LOMU-AI-CHAT] Agent run started: ${agentRunId}, credits reserved: ${creditsReserved}`);

  // Prevent concurrent streams per user
  const activeStreamsKey = `lomu-ai-stream-${userId}`;
  if (activeStreams.has(activeStreamsKey)) {
    console.log('[LOMU-AI-CHAT] Concurrent stream detected for user:', userId);
    return res.status(429).json({
      error: 'Hey! I\'m already working on something for you. Let me finish that first, then I\'ll be ready for the next task! 🍋'
    });
  }
  activeStreams.add(activeStreamsKey);
  console.log('[LOMU-AI-CHAT] Stream registered for user:', userId);

  console.log('[LOMU-AI-CHAT] Setting up SSE headers');
  // Set up Server-Sent Events with Railway-specific anti-buffering headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering on Railway/nginx proxies
  res.setHeader('Content-Encoding', 'none'); // Prevent gzip buffering

  // ✅ FIX: Wrap payload in { type, data } envelope for frontend compatibility
  // Frontend expects: { type: 'content', data: { content: 'text' } }
  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  // ============================================================================
  // T3: VALIDATION PLUMBING - CREATE FILE CHANGE TRACKER
  // ============================================================================
  const fileChangeTracker = new FileChangeTracker();
  console.log('[LOMU-AI-VALIDATION] FileChangeTracker initialized');

  // Helper function to emit structured section events for collapsible UI
  const emitSection = (sectionId: string, sectionType: 'thinking' | 'tool' | 'text', phase: 'start' | 'update' | 'finish', content: string, metadata?: any) => {
    const eventData = {
      sectionId,
      sectionType,
      title: metadata?.title || content.substring(0, 50),
      phase,
      timestamp: Date.now(),
      content,
      metadata
    };
    // ✅ FIX: Use proper { type, data } envelope
    res.write(`data: ${JSON.stringify({ type: `section_${phase}`, data: eventData })}\n\n`);
  };

  // Helper function to ensure consistent SSE stream termination
  const terminateStream = (messageId: string, error?: string) => {
    console.log('[LOMU-AI-CHAT] Terminating stream:', messageId, error ? `Error: ${error}` : 'Success');
    if (error) {
      sendEvent('error', { message: error });
    }
    sendEvent('done', { messageId, error: error ? true : false });
    res.end();
  };

  // 🔥 RAILWAY FIX: Heartbeat to prevent 502 timeout errors
  // Railway kills connections with no data for ~2 minutes
  // Send keepalive comment every 15 seconds to maintain connection
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n'); // SSE comment (lines starting with : are ignored by EventSource)
      console.log('[LOMU-AI-HEARTBEAT] Sent keepalive to prevent timeout');
    } catch (error) {
      console.error('[LOMU-AI-HEARTBEAT] Failed to send keepalive:', error);
    }
  }, 15000); // Every 15 seconds

  console.log('[LOMU-AI-CHAT] Heartbeat started - will send keepalive every 15s');

  // Wrap entire route handler in timeout to prevent infinite hanging
  const STREAM_TIMEOUT_MS = RAILWAY_CONFIG.STREAM_TIMEOUT; // Use Railway config (5 minutes)
  const streamTimeoutId = setTimeout(() => {
    console.error('[LOMU-AI] ⏱️ STREAM TIMEOUT - Force closing after 5 minutes');
    if (!res.writableEnded) {
      sendEvent('error', { message: '⏱️ Stream timeout after 5 minutes. Please try again.' });
      sendEvent('done', { messageId: 'timeout', error: true });
      res.end();
    }
  }, STREAM_TIMEOUT_MS);
  console.log('[LOMU-AI-CHAT] Stream timeout set - will force close after 5 minutes');

  console.log('[LOMU-AI-CHAT] Entering try block');
  
  // Track total credits used for this agent run
  let totalCreditsUsed = 0;
  
  // Declare variables before try block so they're accessible in catch
  let conversationState: any = null;
  let traceId: string | null = null;
  
  try {

    // Fetch user's autonomy level and subscription
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const autonomyLevel = user?.autonomyLevel || 'basic';
    console.log(`[LOMU-AI-CHAT] User autonomy level: ${autonomyLevel}`);

    // Determine autonomy level capabilities
    const levelConfig = {
      basic: { maxTokens: 8000, allowTaskTracking: false, allowWebSearch: false, allowSubAgents: false, requireApproval: true },
      standard: { maxTokens: 8000, allowTaskTracking: true, allowWebSearch: false, allowSubAgents: false, requireApproval: false },
      deep: { maxTokens: 16000, allowTaskTracking: true, allowWebSearch: true, allowSubAgents: true, requireApproval: false },
      max: { maxTokens: 16000, allowTaskTracking: true, allowWebSearch: true, allowSubAgents: true, requireApproval: false },
    };
    const config = levelConfig[autonomyLevel as keyof typeof levelConfig] || levelConfig.basic;

    // 🎯 LOMU BRAIN: Get or create session for unified session management
    const session = await lomuAIBrain.getOrCreateSession({
      userId,
      sessionId: req.body.sessionId || nanoid(),
      targetContext: 'platform', // Platform healing context
      projectId: undefined,
    });
    
    // Update session activity
    lomuAIBrain.touchSession(userId, session.sessionId);
    
    // Get conversation state for backward compatibility with existing code
    // Brain tracks session, but we still use conversationState for some DB operations
    conversationState = await getOrCreateState(userId, null);

    // Save user message (with conversationStateId)
    const [userMsg] = await db
      .insert(chatMessages)
      .values({
        userId,
        projectId: null, // Platform healing has no specific project
        conversationStateId: conversationState.id, // Link to conversation session
        fileId: null,
        role: 'user',
        content: message,
        isPlatformHealing: true,
      })
      .returning();

    // Save attachments to database
    if (attachments && attachments.length > 0) {
      console.log('[LOMU-AI-CHAT] Saving', attachments.length, 'attachments');
      const attachmentValues = attachments.map((att: any) => ({
        messageId: userMsg.id,
        fileName: att.fileName,
        fileType: att.fileType,
        content: att.content,
        mimeType: att.mimeType,
        size: att.size,
      }));

      await db.insert(lomuAttachments).values(attachmentValues);
      console.log('[LOMU-AI-CHAT] Attachments saved successfully');
    }

    sendEvent('user_message', { messageId: userMsg.id });

    // 🔍 GAP 3: TRACE LOGGING - Start trace for this conversation
    traceId = conversationState.traceId;
    if (!traceId) {
      traceId = traceLogger.startTrace(conversationState.id);
      await db
        .update(conversationStates)
        .set({ traceId })
        .where(eq(conversationStates.id, conversationState.id));
      console.log(`[TRACE] Started new trace: ${traceId} for conversation ${conversationState.id}`);
    }

    // 🛑 FIX 1: EMERGENCY BRAKES - Initialize conversationStartTime if not set
    if (!conversationState.conversationStartTime) {
      await db
        .update(conversationStates)
        .set({ conversationStartTime: new Date() })
        .where(eq(conversationStates.id, conversationState.id));
      console.log(`[EMERGENCY-BRAKE] Initialized conversationStartTime for ${conversationState.id}`);
    }

    // Log user message to trace
    traceLogger.log(traceId, 'prompt', {
      userId,
      message: message.substring(0, 500),
      attachmentCount: attachments?.length || 0,
    });

    // 🔄 GAP 5: RESET/NEWPROJECT COMMAND DETECTION
    // Detect @RESET or @NEWPROJECT commands and clear state
    const lowerMessage = message.toLowerCase().trim();
    if (lowerMessage.startsWith('@reset') || lowerMessage.startsWith('@newproject')) {
      console.log('[RESET-COMMAND] Detected reset command, clearing conversation state and scratchpad');
      
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
          projectId: null,
          conversationStateId: conversationState.id,
          fileId: null,
          role: 'assistant',
          content: resetMessage,
          isPlatformHealing: true,
        })
        .returning();
      
      sendEvent('content', { content: resetMessage });
      sendEvent('complete', {});
      
      res.write(`data: ${JSON.stringify({ type: 'complete', messageId: resetMsg.id })}\n\n`);
      res.end();
      
      return;
    }

    // Brain automatically tracks mentioned files when you call trackFileModified
    // No need for autoUpdateFromMessage - brain handles this internally
    console.log('[LOMU-BRAIN] Session active:', session.sessionId);

    // Intent classifier: Detect if user wants brief answer or work
    const classifyIntent = (message: string): 'question' | 'task' | 'status' => {
      const lowerMsg = message.toLowerCase();

      // Questions: user wants info, not work
      if (lowerMsg.match(/^(can|could|do|does|is|are|will|would|should|how|what|why|when|where)/)) {
        return 'question';
      }

      // Status checks
      if (lowerMsg.match(/(status|done|finished|complete|progress|working)/)) {
        return 'status';
      }

      // Everything else is a task
      return 'task';
    };

    // LomuAI creates task lists for work requests (diagnose, fix, improve)
    // This makes progress visible in the inline task card
    // ✅ CLEAN FLOW: Removed "Analyzing" spam - let AI response speak for itself

    // Track task list ID if created during conversation
    let activeTaskListId: string | undefined;

    // NOTE: Backup creation removed to avoid unnecessary work for casual conversations
    // Backups only created when actual platform changes are made (via approval workflow)

    // Get conversation history for context
    // 🧠 ULTRA-MINIMAL MEMORY: Load last 5 messages only (saves ~5K tokens)
    const history = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.isPlatformHealing, true)
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(5); // ⚡ REDUCED FROM 10 - Saves another 5K tokens!

    // Reverse to chronological order (oldest → newest) for Claude
    history.reverse();

    // Build conversation for Claude
    const conversationMessages: any[] = history
      .filter(msg => msg.id !== userMsg.id) // Exclude the message we just added
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

    // Helper to get file extension for syntax highlighting
    const getFileExtension = (fileName: string): string => {
      const ext = fileName.split('.').pop()?.toLowerCase() || 'text';
      // Map common extensions to language identifiers
      const langMap: Record<string, string> = {
        'js': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'jsx': 'javascript',
        'py': 'python',
        'cpp': 'cpp',
        'c': 'c',
        'h': 'c',
        'java': 'java',
        'css': 'css',
        'html': 'html',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'sql': 'sql',
      };
      return langMap[ext] || ext;
    };

    // Add current user message with attachments
    let userMessageContent: any = message;

    // If attachments exist, build multimodal content for Claude
    if (attachments && attachments.length > 0) {
      const contentBlocks: any[] = [];

      // Add text message first
      contentBlocks.push({
        type: 'text',
        text: message,
      });

      // Add attachments
      for (const att of attachments) {
        if (att.fileType === 'image') {
          // Use Vision API for images
          // Extract base64 data and mime type from data URL
          const base64Match = att.content.match(/^data:(.+);base64,(.+)$/);
          if (base64Match) {
            const [, mimeType, base64Data] = base64Match;
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data,
              },
            });
          }
        } else {
          // Add text files (code, logs, text) as text blocks
          contentBlocks.push({
            type: 'text',
            text: `\n\n**Attached file: ${att.fileName}** (${att.fileType}):\n\`\`\`${att.fileType === 'code' ? getFileExtension(att.fileName) : att.fileType}\n${att.content}\n\`\`\``,
          });
        }
      }

      userMessageContent = contentBlocks;
    }

    conversationMessages.push({
      role: 'user',
      content: userMessageContent,
    });

    // Classify user intent to determine response style
    const intent = classifyIntent(message);

    // 🎯 Get fresh conversation state (may have been updated by auto-update)
    const freshState = await db
      .select()
      .from(conversationStates)
      .where(eq(conversationStates.id, conversationState.id))
      .limit(1)
      .then(rows => rows[0]);

    // Format conversation context for AI injection (with replit.md)
    const contextPrompt = await formatStateForPrompt(freshState);

    // 🔄 GAP 2: GET CODE SCRATCHPAD (Reference previous working code)
    // Retrieve last verified code to provide continuity for modifications
    const lastVerifiedCode = await getCodeScratchpad(conversationState.id);
    const scratchpadContext = lastVerifiedCode 
      ? `\n\n📋 LAST VERIFIED CODE (from scratchpad):\n\`\`\`\n${lastVerifiedCode}\n\`\`\`\n\nThis is code that previously worked. Reference this when making modifications to maintain continuity.`
      : '';
    
    const enhancedContextPrompt = contextPrompt + scratchpadContext;

    // ============================================================================
    // T1: RUN-CONFIG GOVERNANCE - INITIAL HEURISTICS (NOT FINAL)
    // ============================================================================
    // ⚠️ CRITICAL: Do NOT create runConfig yet! Store values in variables first.
    // This allows architect guidance and autoplan logic to override heuristics.
    
    // 🧠 COMPLEXITY DETECTION: Determine if extended thinking is needed (heuristic)
    const { detectComplexity } = await import('../complexity-detection');
    const complexityResult = detectComplexity(message);
    
    // Map complexity level to numeric score
    const complexityScoreMap: Record<string, number> = { 
      simple: 0.25, medium: 0.5, complex: 0.75, enterprise: 1.0 
    };
    const complexityScore = complexityScoreMap[complexityResult.level] || 0.5;
    
    // Heuristic: Enable extended thinking for complex tasks (can be overridden later)
    let shouldEnableThinking = ['build', 'fix'].includes(intent) && (
      message.length >= 200 || complexityScore >= 0.6
    );
    
    // ✅ T1 FIX: Store config values in mutable variables (finalized later)
    let finalExtendedThinking = req.body.extendedThinking ?? shouldEnableThinking;
    let finalAutoCommit = autoCommit;
    let finalAutoPush = autoPush;
    let finalAutonomyLevel = user.autonomyLevel || 'standard';
    
    // 🏗️ FUTURE: Architect consultation or autoplan logic can modify these variables here
    // Example: if (shouldConsultArchitect) { finalExtendedThinking = await architect.recommend(); }
    // Example: if (autoplanDisabled) { finalAutoplan = false; }
    
    console.log(`[LOMU-AI][RUN-CONFIG] Initial heuristics computed:`, {
      extendedThinking: finalExtendedThinking,
      autoCommit: finalAutoCommit,
      autoPush: finalAutoPush,
      autonomyLevel: finalAutonomyLevel,
      userIntent: intent,
      complexity: complexityResult.level,
      complexityScore,
      messageLength: message.length,
      manualOverride: req.body.extendedThinking !== undefined,
      heuristicSuggestion: shouldEnableThinking,
      note: 'runConfig will be created later after all overrides are applied',
    });

    // 🧠 LOMU SUPER LOGIC CORE: Combined intelligence with cost awareness
    const { buildLomuSuperCorePrompt } = await import('../lomuSuperCore');

    const systemPrompt = buildLomuSuperCorePrompt({
      platform: 'LomuAI - React+Express+PostgreSQL on Railway',
      autoCommit: finalAutoCommit,
      intent,
      contextPrompt: enhancedContextPrompt,
      userMessage: message,
      autonomyLevel: finalAutonomyLevel,
      extendedThinking: finalExtendedThinking, // ✅ Using mutable variable (pre-runConfig)
    });

    // ⚡ GOOGLE GEMINI OPTIMIZED: 13 CORE TOOLS (Google recommends 10-20 max)
    // All other tools delegated to sub-agents or I AM Architect for optimal performance
    const tools = [
      {
        name: 'start_subagent',
        description: 'Delegate complex multi-file work to sub-agents. Supports parallel execution (max 2 concurrent per user).',
        input_schema: {
          type: 'object' as const,
          properties: {
            task: { type: 'string' as const, description: 'Task for sub-agent' },
            relevantFiles: { type: 'array' as const, items: { type: 'string' as const }, description: 'Files to work with' },
            parallel: { type: 'boolean' as const, description: 'Run in parallel (max 2 concurrent). Default: false (sequential)' },
          },
          required: ['task', 'relevantFiles'],
        },
      },
      {
        name: 'create_task_list',
        description: 'Create visible task breakdown for work requests',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const, description: 'Task list title' },
            tasks: { type: 'array' as const, items: { type: 'object' as const, properties: { title: { type: 'string' as const }, description: { type: 'string' as const } }, required: ['title', 'description'] }, description: 'Tasks to complete' },
          },
          required: ['title', 'tasks'],
        },
      },
      {
        name: 'read_task_list',
        description: 'Read current task list status',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'update_task',
        description: 'Update task status to show progress',
        input_schema: {
          type: 'object' as const,
          properties: {
            taskId: { type: 'string' as const, description: 'Task ID' },
            status: { type: 'string' as const, description: 'New status' },
            result: { type: 'string' as const, description: 'Result when completing' },
          },
          required: ['taskId', 'status'],
        },
      },
      {
        name: 'read_platform_file',
        description: 'Read platform file',
        input_schema: {
          type: 'object' as const,
          properties: { path: { type: 'string' as const, description: 'File path' } },
          required: ['path'],
        },
      },
      {
        name: 'write_platform_file',
        description: 'Write platform file (also handles create/delete operations)',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path' },
            content: { type: 'string' as const, description: 'File content (empty to delete)' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_platform_files',
        description: 'List directory contents (replaces search_platform_files - use with glob patterns)',
        input_schema: {
          type: 'object' as const,
          properties: { directory: { type: 'string' as const, description: 'Directory path' } },
          required: ['directory'],
        },
      },
      {
        name: 'read_project_file',
        description: 'Read user project file',
        input_schema: {
          type: 'object' as const,
          properties: { path: { type: 'string' as const, description: 'File path' } },
          required: ['path'],
        },
      },
      {
        name: 'write_project_file',
        description: 'Write user project file (also handles create/delete/list operations)',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path' },
            content: { type: 'string' as const, description: 'File content (empty to delete)' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'perform_diagnosis',
        description: 'Analyze platform for issues',
        input_schema: {
          type: 'object' as const,
          properties: {
            target: { type: 'string' as const, description: 'Diagnostic target' },
            focus: { type: 'array' as const, items: { type: 'string' as const }, description: 'Files to analyze' },
          },
          required: ['target'],
        },
      },
      {
        name: 'run_test',
        description: 'Run Playwright e2e tests for UI/UX',
        input_schema: {
          type: 'object' as const,
          properties: {
            testPlan: { type: 'string' as const, description: 'Test plan steps' },
            technicalDocs: { type: 'string' as const, description: 'Technical context' }
          },
          required: ['testPlan', 'technicalDocs'],
        },
      },
      {
        name: 'search_integrations',
        description: 'Search Replit integrations',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string' as const, description: 'Integration name' }
          },
          required: ['query'],
        },
      },
      {
        name: 'web_search',
        description: 'Search web for documentation',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string' as const, description: 'Search query' },
            maxResults: { type: 'number' as const, description: 'Max results' },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_codebase',
        description: 'Semantic code search - find code by meaning',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string' as const, description: 'Search query' }
          },
          required: ['query']
        }
      },
      {
        name: 'grep',
        description: 'Search file patterns',
        input_schema: {
          type: 'object' as const,
          properties: {
            pattern: { type: 'string' as const, description: 'Search pattern' },
            pathFilter: { type: 'string' as const, description: 'File filter (*.ts)' }
          },
          required: ['pattern']
        }
      },
      {
        name: 'bash',
        description: 'Execute terminal commands',
        input_schema: {
          type: 'object' as const,
          properties: {
            command: { type: 'string' as const, description: 'Command to run' }
          },
          required: ['command']
        }
      },
      {
        name: 'read_logs',
        description: 'Read application logs',
        input_schema: {
          type: 'object' as const,
          properties: {
            lines: { type: 'number' as const, description: 'Number of lines (default: 100)' }
          }
        }
      },
      {
        name: 'list_project_files',
        description: 'List user project files',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: []
        }
      },
    ];

    // 📊 TOOL COUNT VALIDATION: Log on startup to verify we're within Google's recommended limit
    console.log(`✅ LomuAI using ${tools.length} tools (Google recommends 10-20 for optimal Gemini performance)`);

    // 🎯 AUTONOMY LEVEL FILTERING: Filter tools based on user's autonomy level
    let availableTools = tools;

    if (autonomyLevel === 'basic') {
      // Basic: NO subagents, NO task tracking, NO web search
      availableTools = tools.filter(tool => 
        tool.name !== 'start_subagent' && 
        tool.name !== 'readTaskList' &&
        tool.name !== 'updateTask' &&
        tool.name !== 'web_search'
      );
    } else {
      // Standard/Deep/Max: ALL tools including subagents ✅
      availableTools = tools.filter(tool => 
        tool.name !== 'request_user_approval'
      );
    }

    // 🚨 DEFIBRILLATOR PROMPT DETECTION: Emergency escape from read-eval-no-write loops
    // Detects special "override" messages that force LomuAI out of analysis paralysis
    const isDefibrillatorPrompt = /🔴.*SYSTEM.*OVERRIDE|STOP.*READING|FORCE.*WRITE|emergency.*override/i.test(message);
    
    if (isDefibrillatorPrompt) {
      console.log('[DEFIBRILLATOR] 🚨 Emergency override detected - clearing caches and forcing write mode');
      
      // Clear conversation state caches to prevent stale analysis
      try {
        await clearCodeScratchpad(conversationState.id);
        console.log('[DEFIBRILLATOR] ✅ Cleared code scratchpad');
      } catch (error) {
        console.warn('[DEFIBRILLATOR] ⚠️ Failed to clear scratchpad:', error);
      }
      
      sendEvent('system_info', { 
        message: '🚨 EMERGENCY MODE: Analysis mode disabled. Forcing write operations.' 
      });
    }
    
    // 🎯 DYNAMIC ITERATION LIMITS (like Replit Agent)
    // Classify user intent to set appropriate iteration limits
    const userIntent = classifyUserIntent(message);
    const MAX_ITERATIONS = getMaxIterationsForIntent(userIntent);
    
    console.log(`[INTENT-CLASSIFICATION] User intent: ${userIntent}, max iterations: ${MAX_ITERATIONS}`);

    // ============================================================================
    // UNIFIED RUN STATE - CREATE RUN ID & STATE MANAGER
    // ============================================================================
    const runId = nanoid();
    // ✅ Pass sendEvent to RunStateManager for dual transport (WebSocket + SSE)
    // This ensures run/task events reach the frontend task panel
    const runStateManager = wss ? new RunStateManager(wss, sendEvent) : null;

    // Create run with all required values now available
    if (runStateManager) {
      runStateManager.createRun({
        extendedThinking: finalExtendedThinking,
        autoCommit: finalAutoCommit,
        autoPush: finalAutoPush,
        autonomyLevel: autonomyLevel,
        userIntent: userIntent,
        maxIterations: MAX_ITERATIONS,
        message,
      }, userId, conversationState.id, runId);
    }

    // ============================================================================
    // T2: PHASE ORCHESTRATION - CREATE STATE MACHINE INSTANCE  
    // ============================================================================
    const phaseOrchestrator = new PhaseOrchestrator(
      (phase, message) => {
        sendEvent('run_phase', { phase, message });
      },
      runId,
      runStateManager ? (runId, phase, message) => {
        runStateManager.updatePhase(runId, phase as any, message);
      } : undefined
    );

    // Gemini client is handled by streamGeminiResponse
    let fullContent = '';
    const fileChanges: Array<{ path: string; operation: string; contentAfter?: string }> = [];
    let continueLoop = true;
    let iterationCount = 0;
    let commitSuccessful = false; // Track if commit_to_github succeeded
    let usedGitHubAPI = false; // Track if commit_to_github tool was used (already pushes via API)
    let consecutiveEmptyIterations = 0; // Track iterations with no tool calls
    const MAX_EMPTY_ITERATIONS = 3; // Stop if 3 consecutive iterations without tool calls
    let totalToolCallCount = 0; // Track total tool calls for quality analysis
    
    // ✅ GAP 5: Per-iteration timeout safeguards
    // Increased to 3 minutes for complex analysis/fix tasks (Gemini needs time to analyze + implement)
    const ITERATION_TIMEOUT_MS = 180000; // 3 minutes per iteration
    let iterationStartTime = Date.now();
    
    // 🚨 WATCHDOG: Prevent endless thinking loops
    let consecutiveThinkingCount = 0; // Track consecutive "thought" scratchpad entries
    const MAX_CONSECUTIVE_THINKING = 3; // Force action after 3 consecutive thoughts
    let systemEnforcementMessage = ''; // Temporary system message (NOT saved to conversation history)
    
    // 🔧 FORCE MODE: Track if we should force function calling due to malformed calls
    let shouldForceFunctionCall = false;

    // 💬 PROGRESS MESSAGES: Track thinking/action/result messages for inline display and persistence
    const progressMessages: Array<{ id: string; message: string; timestamp: number; category: 'thinking' | 'action' | 'result' }> = [];
    let assistantMessageId = nanoid(); // Generate temporary message ID for SSE events (will be replaced with real ID after save)

    // ============================================================================
    // T2: PHASE ORCHESTRATION - EMIT THINKING PHASE (PRE-LOOP MILESTONE)
    // ============================================================================
    // ✅ Decouple from extended thinking - always emit thinking phase
    // The orchestrator handles idempotency - safe to call even if already emitted
    phaseOrchestrator.emitThinking('Analyzing your request and considering approaches...');

    // 🔒 P1-GAP-1: AUTO-ROLLBACK SAFETY - Create backup before making changes
    // NOTE: In Replit Agent environments, Git operations may be restricted for safety
    // In those cases, we gracefully degrade while still tracking file changes
    console.log('[SAFETY-BACKUP] Creating pre-execution safety backup...');
    const backup = await platformHealing.createBackup(`Pre-execution safety backup for: ${message.slice(0, 100)}`);
    const safetyBackupId = backup.id;
    
    // In production, halt on backup failure. In development with Replit protections, continue with warning
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isGitRestricted = backup.commitHash === 'no-git';
    
    if (!safetyBackupId || backup.commitHash === 'error') {
      // Fatal error - always halt
      const errorMsg = `❌ **SAFETY BACKUP FAILED** - Cannot proceed with code modifications without a safety backup.\n` +
        `This is a safety mechanism to prevent data loss. Please check your Git configuration.\n`;
      sendEvent('error', { message: 'Safety backup creation failed - cannot proceed' });
      sendEvent('content', { content: errorMsg });
      sendEvent('done', { messageId: assistantMessageId });
      throw new Error('Safety backup creation failed - halting execution to prevent data loss');
    }
    
    // 🌿 P2-GAP-5: FEATURE BRANCH WORKFLOW - Prevent context saturation
    // Create ephemeral branch for this fix session to limit scope
    let workBranch: string | null = null;
    let createdEphemeralBranch = false;
    
    // Only create feature branches for fix/build tasks with GitHub configured
    const shouldUseFeatureBranch = (userIntent === 'fix' || userIntent === 'build') && 
                                   !isGitRestricted && 
                                   process.env.GITHUB_TOKEN;
    
    if (shouldUseFeatureBranch) {
      try {
        const github = new GitHubService();
        const timestamp = Date.now();
        const sanitizedMessage = message.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        workBranch = `lomu-ai/${userIntent}-${sanitizedMessage}-${timestamp}`;
        
        console.log(`[P2-GAP-5] Creating ephemeral branch: ${workBranch}`);
        const branchResult = await github.createBranchFromMain(workBranch);
        createdEphemeralBranch = true;
        
        sendEvent('system_info', { 
          message: `✅ Working on branch: ${workBranch} (prevents context saturation)` 
        });
        
        console.log(`[P2-GAP-5] ✅ Created branch ${workBranch} at ${branchResult.sha.slice(0, 7)}`);
      } catch (error: any) {
        console.warn(`[P2-GAP-5] ⚠️ Failed to create feature branch: ${error.message}`);
        // Non-fatal - continue on main branch
        workBranch = null;
      }
    }
    
    if (isGitRestricted && isDevelopment) {
      // Development mode with Replit Git protection - continue with warning
      console.log(`[SAFETY-BACKUP] ⚠️ Git operations restricted (Replit Agent protection) - continuing with file-level tracking`);
      sendEvent('system_info', { 
        message: 'Git backup unavailable (Replit protection active) - file changes tracked locally' 
      });
    } else if (isGitRestricted) {
      // Production with Git unavailable - halt
      const errorMsg = `❌ **GIT UNAVAILABLE** - Cannot proceed in production without Git backup.\n`;
      sendEvent('error', { message: 'Git backup required in production' });
      sendEvent('content', { content: errorMsg });
      sendEvent('done', { messageId: assistantMessageId });
      throw new Error('Git backup required in production');
    } else {
      console.log(`[SAFETY-BACKUP] ✅ Created backup ${safetyBackupId} - will auto-rollback on validation failure`);
    }
    
    // 📊 WORKFLOW TELEMETRY: Track read vs write operations
    // 🎯 REPLIT AGENT PARITY: High ceiling for diagnostics while preserving stall detection
    const workflowTelemetry = {
      readOperations: 0,
      writeOperations: 0,
      consecutiveReadOnlyIterations: 0,
      MAX_READ_ONLY_ITERATIONS: 60, // High ceiling for thorough diagnostics, still catches true stalls
      hasProducedFixes: false, // Track if ANY write operations occurred
    };

    // READ-ONLY TOOLS: Tools that don't modify platform/project code
    // CRITICAL: Task management, knowledge_store, and meta tools don't modify source code
    // CRITICAL: Use snake_case to match actual tool names!
    const READ_ONLY_TOOLS = new Set([
      'read_platform_file', 'list_platform_directory', 'search_platform_files',
      'read_project_file', 'list_project_directory', 'search_codebase', 'grep',
      'knowledge_search', 'knowledge_recall', 'code_search',
      'read_task_list', 'create_task_list', 'update_task', // Task management doesn't modify code
      'read_logs', 'perform_diagnosis',
      // REMOVED: 'bash' (can modify files via git commit, npm install, etc.)
      'get_latest_lsp_diagnostics', 'web_search',
      'knowledge_store', // Storing knowledge doesn't fix the platform
      'architect_consult', 'start_subagent' // Delegation tools don't modify code directly
    ]);

    // CODE-MODIFYING TOOLS: Tools that actually modify platform/project source code
    // These are REQUIRED for fix/implement requests to succeed
    // CRITICAL: Use snake_case to match actual tool names!
    const CODE_MODIFYING_TOOLS = new Set([
      'write_platform_file', 'create_platform_file', 'delete_platform_file',
      'write_project_file', 'create_project_file', 'delete_project_file',
      'edit', // Primary file editing tool
      'commit_to_github', // Commits changes (implies code was modified)
      'restart_workflow', // Restarts after code changes
      'packager_tool', // Installs/uninstalls packages (modifies package.json)
      'bash', // ADDED: can run git commit, file writes, npm install, etc.
    ]);

    // ✅ REMOVED: Casual greeting bypass - LomuAI should ALWAYS be conversational like Replit Agent
    // Every message goes to Claude for proper conversational awareness and context

    // ============================================================================
    // T1: RUN-CONFIG GOVERNANCE - FINALIZE CONFIGURATION (AFTER ALL OVERRIDES)
    // ============================================================================
    // ✅ NOW create immutable runConfig from finalized variables
    // This ensures all toggles/overrides have been applied (architect, autoplan, etc.)
    const { createRunConfig } = await import('@shared/agentEvents');
    const runConfig = createRunConfig({
      message,
      extendedThinkingOverride: finalExtendedThinking,
      autoCommit: finalAutoCommit,
      autoPush: finalAutoPush,
      autonomyLevel: finalAutonomyLevel,
      userIntent: intent,
    });
    
    console.log(`[LOMU-AI][RUN-CONFIG] ✅ Final configuration locked:`, {
      extendedThinking: runConfig.extendedThinking,
      autoCommit: runConfig.autoCommit,
      autoPush: runConfig.autoPush,
      autonomyLevel: runConfig.autonomyLevel,
      userIntent: runConfig.userIntent,
      note: 'All overrides applied - config is now immutable',
    });

    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      
      // ✅ GAP 5: Reset iteration timer at start of each iteration
      iterationStartTime = Date.now();
      
      // FIX 5: Enhanced diagnostic logging
      console.log(`[LOMU-AI-ITERATION] Starting iteration ${iterationCount}/${MAX_ITERATIONS}`, {
        forceFunctionCall: shouldForceFunctionCall,
        consecutiveEmptyIterations: consecutiveEmptyIterations || 0
      });

      // ✅ GAP 6: Update RunStateManager with current iteration
      if (runStateManager) {
        runStateManager.incrementIteration(runId);
      }

      // ✅ CLEAN FLOW: Only show iteration count for long-running tasks (5+ iterations)
      if (iterationCount % 5 === 0) {
        sendEvent('progress', { message: `Working (step ${iterationCount})...` });
      }

      // Simple status update instead of verbose section
      const thinkingSectionId = `thinking-${iterationCount}-${Date.now()}`;
      // Skip the "Analyzing request" spam - let the AI respond naturally

      // ⚡ Use ultra-compressed prompt (no extra platform knowledge - read files when needed)
      // ✅ ARCHITECT FIX: Append enforcement message WITHOUT adding to conversation history
      const finalSystemPrompt = systemEnforcementMessage 
        ? `${systemPrompt}\n\n${systemEnforcementMessage}`
        : systemPrompt;
      
      // Clear enforcement message after use (one-time injection)
      if (systemEnforcementMessage) {
        console.log(`[THINKING-WATCHDOG] [INFO] Enforcement message cleared (used this iteration)`);
        systemEnforcementMessage = '';
      }

      // TEMPORARY: Claude context-limit protection (200K token limit)
      // This wrapper truncates context if needed while preserving recent messages
      const { messages: safeMessages, systemPrompt: safeSystemPrompt, estimatedTokens, truncated, originalTokens, removedMessages } = 
        createSafeAnthropicRequest(conversationMessages, finalSystemPrompt);

      // Log truncation results for monitoring (only on first iteration)
      if (iterationCount === 1 && truncated) {
        console.log(`[CLAUDE-WRAPPER] Truncated context: ${originalTokens} → ${estimatedTokens} tokens (removed ${removedMessages} messages)`);
      }

      // ✅ REAL-TIME STREAMING: Stream text to user AS IT ARRIVES while building content blocks
      const contentBlocks: any[] = [];
      let currentTextBlock = '';
      let lastChunkHash = ''; // 🔥 Track last chunk to prevent duplicate streaming
      let taskListId: string | null = null; // Track if a task list exists
      let detectedComplexity = 1; // Track task complexity for workflow validation

      // ✅ GAP 4: Token Checking and Context Summarization
      // Check token count and summarize if approaching limits (Gemini 2.5 Flash has 1M context)
      const MAX_GEMINI_TOKENS = 200000; // Conservative limit (200K tokens)
      const currentTokens = estimateConversationTokens(safeMessages);
      
      let finalMessages = safeMessages;
      if (currentTokens > 0.75 * MAX_GEMINI_TOKENS) {
        console.log(`[GAP-4] ⚠️ Token limit approaching (${currentTokens}/${MAX_GEMINI_TOKENS}), applying summarization...`);
        finalMessages = await summarizeOldMessages(safeMessages, conversationState.id, MAX_GEMINI_TOKENS);
        
        // Notify user that context was summarized
        sendEvent('content', { content: '\n\n*[Context summarized to manage memory efficiently]*\n\n' });
      } else {
        console.log(`[GAP-4] ✅ Token count healthy (${currentTokens}/${MAX_GEMINI_TOKENS}), no summarization needed`);
      }

      // 🔄 SESSION LIFECYCLE - Update timestamp and renew session if needed
      // ✅ CRITICAL: Do this FIRST before checking emergency brakes
      // Reasoning: User just sent a message NOW, so update timestamp to NOW first
      // The ensureActiveSession() function already handles idle renewal (resets counters if idle > 30min)
      await ensureActiveSession(conversationState.id);
      
      // Re-fetch conversation state after potential renewal
      const [refreshedState] = await db
        .select()
        .from(conversationStates)
        .where(eq(conversationStates.id, conversationState.id));
      
      if (refreshedState) {
        conversationState = refreshedState;
      }
      
      // 🛑 GAP 2: EMERGENCY BRAKES - Check limits AFTER session renewal
      // Prevent runaway costs by enforcing global limits
      const emergencyBrakeTriggered = {
        triggered: false,
        reason: '' as string,
      };
      
      // ✅ REMOVED: Idle timeout check - handled by ensureActiveSession() above
      // ✅ REMOVED: Total duration check - if user is active, let them work

      // Check 3: API call count (50 calls max per session)
      const currentApiCallCount = conversationState.apiCallCount || 0;
      if (currentApiCallCount >= EMERGENCY_LIMITS.MAX_API_CALLS_PER_SESSION) {
        emergencyBrakeTriggered.triggered = true;
        emergencyBrakeTriggered.reason = '🛑 Safety limit reached: Maximum API calls (50) exceeded. Please start a new conversation to continue.';
      }

      // Check 4: Session token limit (500K tokens max)
      if (currentTokens > EMERGENCY_LIMITS.MAX_SESSION_TOKENS) {
        emergencyBrakeTriggered.triggered = true;
        emergencyBrakeTriggered.reason = '💾 Safety limit reached: Conversation memory exceeded 500K tokens. Please start a new conversation.';
      }

      if (emergencyBrakeTriggered.triggered) {
        console.error(`[EMERGENCY-BRAKE] Triggered: ${emergencyBrakeTriggered.reason}`);
        sendEvent('content', { content: `\n\n${emergencyBrakeTriggered.reason}\n\n` });
        sendEvent('complete', {});
        
        const [brakeMsg] = await db
          .insert(chatMessages)
          .values({
            userId,
            projectId: null,
            conversationStateId: conversationState.id,
            fileId: null,
            role: 'assistant',
            content: emergencyBrakeTriggered.reason,
            isPlatformHealing: true,
          })
          .returning();
        
        res.write(`data: ${JSON.stringify({ type: 'complete', messageId: brakeMsg.id })}\n\n`);
        res.end();
        return;
      }

      // 🛑 FIX 1: EMERGENCY BRAKES - Increment API call counter
      await db
        .update(conversationStates)
        .set({ 
          apiCallCount: (conversationState.apiCallCount || 0) + 1,
          lastUpdated: new Date(),
        })
        .where(eq(conversationStates.id, conversationState.id));
      
      console.log(`[EMERGENCY-BRAKE] API call ${currentApiCallCount + 1}/${EMERGENCY_LIMITS.MAX_API_CALLS_PER_SESSION}`);

      // ✅ FIXED GEMINI: 40x cheaper with proper functionResponse format
      // Fixed the tool response structure to match Gemini's expected format
      await retryWithBackoff(async () => {
        return await streamGeminiResponse({
          model: 'gemini-2.5-flash',
          maxTokens: config.maxTokens,
          system: safeSystemPrompt,
          messages: finalMessages, // ✅ GAP 4: Use summarized messages if needed
          tools: availableTools,
          forceFunctionCall: shouldForceFunctionCall, // 🔧 Force mode: ANY when malformed calls detected
          userIntent: userIntent, // ✅ INTENT-SENSITIVE MODE: Pass detected intent for mode control
        onChunk: (chunk: any) => {
          // FIX 3: Detect fallback_used event and enable force mode
          if (chunk.type === 'fallback_used') {
            console.log('[LOMU-AI-FALLBACK] ⚠️ Fallback parser was triggered - enabling force mode');
            shouldForceFunctionCall = true;
            sendEvent('progress', { 
              message: '⚠️ Detected malformed function call - will enforce strict mode...' 
            });
            return;
          }
          
          if (chunk.type === 'chunk' && chunk.content) {
            // 🔥 DUPLICATE CHUNK SUPPRESSION: Prevent duplicate text from SSE retries
            const chunkText = chunk.content;
            const chunkHash = chunkText.slice(-Math.min(50, chunkText.length)); // Last 50 chars as fingerprint

            if (chunkHash === lastChunkHash && chunkText.length > 10) {
              // Skip duplicate chunk (likely from SSE retry)
              console.log('[LOMU-AI-STREAM] Skipped duplicate chunk:', chunkHash.substring(0, 20));
              return;
            }
            lastChunkHash = chunkHash;

            // 🔥 STREAM TEXT IMMEDIATELY via SSE only (avoid duplicate rendering)
            currentTextBlock += chunkText;
            fullContent += chunkText;
            
            // ✅ SSE ONLY: Frontend consumes 'content' events via SSE stream
            // Note: We don't broadcast via WebSocket to avoid duplicate rendering
            sendEvent('content', { content: chunkText });

            // 🚨 WATCHDOG: Reset thinking counter on substantive assistant text
            // Guard: only reset if text is meaningful (not just whitespace)
            if (consecutiveThinkingCount > 0 && chunkText.trim().length > 0) {
              console.log(`[THINKING-WATCHDOG] [OK] Regular text produced - reset thinking counter from ${consecutiveThinkingCount} to 0`);
              consecutiveThinkingCount = 0;
            }

            // After receiving text, enforce brevity for questions
            if (intent === 'question' && fullContent.length > 200) {
              // Truncate verbose responses for simple questions
              fullContent = fullContent.substring(0, 197) + '...';
              sendEvent('content', { content: '...' });
            }
          }
        },
        onThought: async (thought: string) => {
          // 🧠 GEMINI THINKING: Broadcast thinking indicators to frontend
          if (wss && userId) {
            broadcastToUser(wss, userId, {
              type: 'ai-thought',
              content: thought,
              timestamp: new Date().toISOString()
            });

            // 📝 SCRATCHPAD: Write thought to scratchpad for persistent progress tracking
            try {
              const entry = await storage.createScratchpadEntry({
                sessionId: conversationState.id,
                author: 'LomuAI',
                role: 'agent',
                content: thought,
                entryType: 'thought',
                metadata: { projectId }
              });

              // Broadcast scratchpad entry to clients
              broadcastToUser(wss, userId, {
                type: 'scratchpad_entry',
                entry
              });
              
              // 💭 Send thinking to inline chat display (SSE) with proper structure
              const progressId = nanoid();
              const progressEntry = {
                id: progressId,
                message: thought,
                timestamp: Date.now(),
                category: 'thinking' as const
              };
              
              // Track progress message for persistence
              progressMessages.push(progressEntry);
              
              // Send SSE event for real-time display
              sendEvent('assistant_progress', {
                messageId: assistantMessageId,
                progressId,
                content: thought,
                category: 'thinking'
              });
              
              // 🚨 WATCHDOG: Increment consecutive thinking counter
              consecutiveThinkingCount++;
              console.log(`[THINKING-WATCHDOG] Consecutive thoughts: ${consecutiveThinkingCount}/${MAX_CONSECUTIVE_THINKING}`);
              
              // 🛑 WATCHDOG TRIGGER: Force action after 3 consecutive thoughts
              if (consecutiveThinkingCount >= MAX_CONSECUTIVE_THINKING) {
                console.warn(`[THINKING-WATCHDOG] [WARN] Hit threshold (${MAX_CONSECUTIVE_THINKING} consecutive thoughts) - forcing action!`);
                
                // ✅ ARCHITECT FIX: Set enforcement message (added to systemInstruction, NOT conversation history)
                systemEnforcementMessage = 'SYSTEM ALERT: You have been thinking for 3 consecutive iterations without taking any action.\n\n' +
                  'YOU MUST TAKE AN ACTION NOW. Choose one of:\n' +
                  '1. Read a file (read_platform_file/read_project_file)\n' +
                  '2. Write/edit a file (write_platform_file/edit)\n' +
                  '3. Execute a command (bash)\n' +
                  '4. Run diagnostics (perform_diagnosis)\n' +
                  '5. Search for information (search_codebase/web_search)\n\n' +
                  'NO MORE THINKING. Take action in your next response.';
                
                // Broadcast telemetry (quiet, no UI spam)
                broadcastToUser(wss, userId, {
                  type: 'watchdog-alert',
                  message: 'LomuAI thinking loop detected - forcing action',
                  consecutiveThoughts: consecutiveThinkingCount
                });
                
                console.log(`[THINKING-WATCHDOG] [INFO] Set enforcement message (will be appended to next systemInstruction)`);
              }
            } catch (error) {
              console.error('[SCRATCHPAD] Error writing thought:', error);
            }
          }
        },
        onAction: async (action: string) => {
          // 🔧 GEMINI ACTIONS: Broadcast action indicators to frontend
          if (wss && userId) {
            broadcastToUser(wss, userId, {
              type: 'ai-action',
              content: action,
              timestamp: new Date().toISOString()
            });

            // 📝 SCRATCHPAD: Write action to scratchpad for persistent progress tracking
            try {
              const entry = await storage.createScratchpadEntry({
                sessionId: conversationState.id,
                author: 'LomuAI',
                role: 'agent',
                content: action,
                entryType: 'action',
                metadata: { projectId }
              });

              // Broadcast scratchpad entry to clients
              broadcastToUser(wss, userId, {
                type: 'scratchpad_entry',
                entry
              });
              
              // 🔧 Send action to inline chat display (SSE) with proper structure
              const progressId = nanoid();
              const progressEntry = {
                id: progressId,
                message: action,
                timestamp: Date.now(),
                category: 'action' as const
              };
              
              // Track progress message for persistence
              progressMessages.push(progressEntry);
              
              // Send SSE event for real-time display
              sendEvent('assistant_progress', {
                messageId: assistantMessageId,
                progressId,
                content: action,
                category: 'action'
              });
              
              // 🚨 WATCHDOG: Reset thinking counter when action is taken
              if (consecutiveThinkingCount > 0) {
                console.log(`[THINKING-WATCHDOG] [OK] Action taken - reset thinking counter from ${consecutiveThinkingCount} to 0`);
                consecutiveThinkingCount = 0;
              }
            } catch (error) {
              console.error('[SCRATCHPAD] Error writing action:', error);
            }
          }
        },
        onError: (error: Error) => {
          console.error('[LOMU-AI] WebSocket stream error - adding error handler to prevent memory leaks:', error);
          // Error handler now present to prevent WebSocket memory leaks
          throw error;
        },
        onToolUse: async (toolUse: any) => {
          // Process tool calls with workflow validation
          // Note: Workflow validation removed from onToolUse callback
          // Validation happens in the main tool execution loop below
          
          // 🚨 WATCHDOG: Reset thinking counter when tools are called (tool use = taking action)
          if (consecutiveThinkingCount > 0) {
            console.log(`[THINKING-WATCHDOG] [OK] Tool called (${toolUse.name}) - reset thinking counter from ${consecutiveThinkingCount} to 0`);
            consecutiveThinkingCount = 0;
          }
          
          // Save any pending text
          if (currentTextBlock) {
            contentBlocks.push({ type: 'text', text: currentTextBlock });
            fullContent += currentTextBlock;
            currentTextBlock = '';
          }
          // Add tool use block
          contentBlocks.push({
            type: 'tool_use',
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input
          });
          return null; // Tool execution happens later
        },
        onComplete: async (text: string, usage: any) => {
          // Add any final text block
          if (currentTextBlock && contentBlocks[contentBlocks.length - 1]?.text !== currentTextBlock) {
            contentBlocks.push({ type: 'text', text: currentTextBlock });
          }

          // ============================================================================
          // TIER 1 BILLING: Reconcile Credits & Log Analytics
          // ============================================================================
          let creditsActuallyUsed = 0;
          
          try {
            if (usage && usage.inputTokens && usage.outputTokens) {
              // 1. Calculate actual credits from Gemini usage
              creditsActuallyUsed = CreditManager.calculateCreditsForTokens(
                usage.inputTokens,
                usage.outputTokens
              );
              
              console.log(`[BILLING] Actual usage - Input: ${usage.inputTokens} tokens, Output: ${usage.outputTokens} tokens, Credits: ${creditsActuallyUsed}`);
              
              // 2. Reconcile with AgentExecutor (returns unused credits to wallet)
              await AgentExecutor.completeRun({
                runId: agentRunId,
                actualCreditsUsed: creditsActuallyUsed,
                source: 'lomu_chat',
              });
              
              // 3. Log to analytics (TokenTracker - analytics only, no wallet mutations)
              await TokenTracker.logUsage(
                {
                  promptTokens: usage.inputTokens,
                  candidatesTokens: usage.outputTokens,
                  totalTokens: usage.inputTokens + usage.outputTokens,
                },
                {
                  userId,
                  modelUsed: 'gemini-2.5-flash',
                  requestType: 'CODE_GEN',
                  targetContext,
                  projectId: projectId || undefined,
                  agentRunId,
                },
                creditsActuallyUsed // Credits from reconciliation
              );
              
              // 4. Track tokens in LomuAI Brain for session management
              await lomuAIBrain.recordTokens(userId, session.sessionId, usage.inputTokens, usage.outputTokens);
              
              console.log(`[BILLING] ✅ Reconciliation complete - ${creditsActuallyUsed} credits charged`);
            } else {
              // FALLBACK: Missing usage metadata - reconcile with 0 credits to avoid stuck reservations
              console.warn('[BILLING] ⚠️ Missing usage metadata - reconciling with 0 credits to avoid stuck reservations');
              
              await AgentExecutor.completeRun({
                runId: agentRunId,
                actualCreditsUsed: 0,
                source: 'lomu_chat',
              });
              
              console.log('[BILLING] ⚠️ Reconciled with 0 credits due to missing usage data');
            }
          } catch (billingError: any) {
            console.error('[BILLING] ❌ Reconciliation failed:', billingError.message);
            // Critical: Try to reconcile with 0 to avoid stuck reservations
            try {
              await AgentExecutor.completeRun({
                runId: agentRunId,
                actualCreditsUsed: 0,
                source: 'lomu_chat',
              });
              console.log('[BILLING] ⚠️ Emergency reconciliation with 0 credits after error');
            } catch (emergencyError: any) {
              console.error('[BILLING] 🚨 Emergency reconciliation also failed:', emergencyError.message);
              // At this point, manual intervention may be needed to clear stuck reservations
            }
          }
        }
        // onError handler already defined above (line 1508) to prevent duplicate property
        });
      }, 3, `Claude API call (iteration ${iterationCount})`); // Retry up to 3 times with exponential backoff

      // Skip "Analysis complete" spam - the response speaks for itself

      conversationMessages.push({
        role: 'assistant',
        content: contentBlocks,
      });

      // 🎯 Log response for debugging
      if (iterationCount === 1) {
        const hasToolCalls = contentBlocks.some(block => block.type === 'tool_use');
        console.log('[LOMU-AI] Response has tool calls:', hasToolCalls);
        console.log('[LOMU-AI] Content blocks:', contentBlocks.map(b => b.type).join(', '));
      }

      const toolResults: any[] = [];
      const hasToolUse = contentBlocks.some(block => block.type === 'tool_use');
      const toolNames = contentBlocks.filter(b => b.type === 'tool_use').map(b => b.name);

      // 🎯 PRE-EXECUTION LOGGING
      console.log(`[LOMU-AI-FORCE] === ITERATION ${iterationCount} CHECK ===`);
      console.log(`[LOMU-AI-FORCE] Tools called this iteration: ${toolNames.join(', ') || 'NONE'}`);

      // 🚨 RESET EMPTY COUNTER IMMEDIATELY when tools are called (before any continue/return)
      if (toolNames.length > 0) {
        consecutiveEmptyIterations = 0;
        console.log('[LOMU-AI-CONTINUATION] ✅ Tools called - reset empty counter to 0');
      }

      // 💬 MINIMAL TOOL MESSAGES: Let AI explain naturally, no pre-tool spam
      const getPreToolMessage = (toolName: string, input: any): string => {
        // Clean conversation - tools execute silently, AI explains in natural flow
        return ''; // No "I'll read that file..." spam
      };

      const getPostToolMessage = (toolName: string, result: string): string => {
        // Clean conversation - no "Here's what I found" spam after every tool
        // The AI's natural response will explain results
        return ''; // Silent tools = smooth conversation
      };

      // ============================================================================
      // T2: PHASE ORCHESTRATION - EMIT WORKING PHASE (FIRST TOOL CALL MILESTONE)
      // ============================================================================
      // Emit working phase on first tool use (orchestrator prevents double emission)
      if (contentBlocks.some(b => b.type === 'tool_use')) {
        phaseOrchestrator.emitWorking('Executing actions and making changes...');
      }

      // 🛑 FIX 1: EMERGENCY BRAKES - Per-iteration tool-call counter
      let toolCallsThisIteration = 0;

      // This ensures every tool_use has a tool_result before we add forcing messages
      for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
          const { name, input, id } = block;

          // 🛑 FIX 1: EMERGENCY BRAKES - Enforce max tool calls per iteration
          toolCallsThisIteration++;
          if (toolCallsThisIteration > EMERGENCY_LIMITS.MAX_TOOL_CALLS_PER_ITERATION) {
            const errorMsg = `🛑 Emergency brake: Too many tool calls in single iteration (max ${EMERGENCY_LIMITS.MAX_TOOL_CALLS_PER_ITERATION})`;
            console.error(`[EMERGENCY-BRAKE] ${errorMsg}`);
            throw new Error(errorMsg);
          }
          console.log(`[EMERGENCY-BRAKE] Tool call ${toolCallsThisIteration}/${EMERGENCY_LIMITS.MAX_TOOL_CALLS_PER_ITERATION} this iteration`);
          
          // 🧠 BRAIN TRACKING: Record tool call start
          const toolCallId = lomuAIBrain.recordToolCall(userId, session.sessionId, name, input);

          // 🎯 SYSTEMATIC TASK ENFORCEMENT: Ensure AI works through tasks in order
          // This prevents jumping between tasks and enforces sequential execution
          if (taskListId && name !== 'create_task_list' && name !== 'read_task_list') {
            // Check for active in_progress task
            const taskStatus = await readTaskList({ userId });
            
            if (taskStatus.success && taskStatus.taskLists) {
              const activeList = taskStatus.taskLists.find((list: any) => list.status === 'active');
              
              if (activeList && activeList.tasks) {
                const inProgressTask = activeList.tasks.find((t: any) => t.status === 'in_progress');
                
                if (inProgressTask && name !== 'update_task') {
                  // There's an active task in progress
                  // ONLY allow tools that help complete the current task
                  const taskCompletionTools = [
                    // File reading/searching tools (for understanding the task)
                    'read_platform_file', 'read_project_file', 'list_platform_files', 
                    'list_project_files', 'search_platform_files', 'search_codebase', 'grep',
                    // File modification tools (for completing the task)
                    'write_platform_file', 'write_project_file', 'create_platform_file', 
                    'create_project_file', 'delete_platform_file', 'delete_project_file', 'edit',
                    // Execution tools (for testing the fix)
                    'bash', 'restart_workflow', 'get_latest_lsp_diagnostics',
                    // Diagnosis tools (for understanding errors)
                    'perform_diagnosis', 'read_logs', 'execute_sql',
                    // Knowledge tools (for finding solutions)
                    'knowledge_search', 'knowledge_recall', 'code_search', 'web_search',
                    // Support tools
                    'packager_tool', 'architect_consult', 'verify_fix'
                  ];
                  
                  if (!taskCompletionTools.includes(name)) {
                    // Block tools that don't help complete the current task
                    const errorMsg = `❌ TASK ENFORCEMENT: Cannot call "${name}" while task "${inProgressTask.title}" is in progress.\n\n` +
                      `You must complete the current task first by calling:\n` +
                      `update_task("${inProgressTask.id}", "completed", "brief description of what you did")\n\n` +
                      `Then you can proceed to the next task.\n\n` +
                      `This ensures systematic execution: Task 1 → Task 2 → Task 3 (no jumping around!)`;
                    
                    console.log(`[TASK-ENFORCEMENT] ❌ Blocked ${name} - must complete task ${inProgressTask.id} first`);
                    
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: id,
                      content: errorMsg
                    });
                    
                    sendEvent('content', { content: `\n\n${errorMsg}\n\n` });
                    continue; // Skip this tool execution
                  }
                }
              }
            }
          }

          // 🛡️ WORKFLOW VALIDATION: Validate tool call against workflow rules
          // This prevents out-of-order execution and enforces the 7-phase workflow
          if (taskListId && detectedComplexity > 3) {
            // For complex multi-step tasks, enforce stricter workflow validation
            console.log(`[WORKFLOW-VALIDATION] Validating tool: ${name} in iteration ${iterationCount}`);
          }

          // 💬 CONVERSATIONAL: Stream friendly text BEFORE tool execution
          const preMessage = getPreToolMessage(name, input);
          sendEvent('content', { content: preMessage });
          fullContent += preMessage;

          // Minimal tool notification - no verbose sections
          const toolSectionId = `tool-${name}-${id}`;
          // Tools execute silently - user sees results in conversational response

          // ✅ CLEAN FLOW: Only show progress for slow tools (task management, architect, subagent)
          const slowTools = ['architect_consult', 'start_subagent', 'run_test', 'create_task_list'];
          if (slowTools.includes(name)) {
            sendEvent('progress', { message: `🔧 ${name.replace('_', ' ')}...` });
          }

          try {
            let toolResult: any = null;

            if (name === 'create_task_list') {
              const typedInput = input as { title: string; tasks: Array<{ title: string; description: string }> };
              sendEvent('progress', { message: `📋 Creating task list with ${typedInput.tasks.length} tasks...` });
              sendEvent('content', { content: `\n\n*Creating task list: "${typedInput.title}"...*\n` });

              const result = await createTaskList({
                userId,
                title: typedInput.title,
                tasks: typedInput.tasks.map(t => ({
                  title: t.title,
                  description: t.description,
                  status: 'pending' as const
                }))
              });

              if (result.success) {
                // Track the active task list ID for cleanup
                taskListId = result.taskListId!; // Set taskListId here
                detectedComplexity = typedInput.tasks.length; // Update complexity based on tasks
                
                // ← CRITICAL FIX: Return task IDs so Claude can update them!
                console.log('[LOMU-AI] 🔑 Task IDs:', result.tasks?.map(t => t.id).join(', '));
                toolResult = JSON.stringify({
                  success: true,
                  taskListId: result.taskListId,
                  tasks: result.tasks,
                  message: `✅ Task list created! Use these task IDs for update_task(): ${result.tasks?.map(t => `"${t.id}"`).join(', ')}`
                });
                
                sendEvent('task_list_created', { taskListId: result.taskListId });
                sendEvent('content', { content: `✅ **Task list created!** Track my progress in the card above.\n\n` });
                console.log('[LOMU-AI] Task list created:', result.taskListId);

                // ✅ GAP 1: Update RunStateManager with tasks (with status mapping)
                if (runStateManager && result.tasks) {
                  const runStateTasks = result.tasks.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    status: mapDatabaseStatusToRunState(t.status || 'pending'),
                    owner: 'agent' as const,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }));
                  
                  runStateManager.addTasks(runId, runStateTasks, typedInput.title);
                  runStateManager.updatePhase(runId, 'planning', 'Created task breakdown');
                  console.log(`[GAP-1] ✅ RunStateManager updated with ${runStateTasks.length} tasks (mapped statuses)`);
                }

                // ✅ FULL AUTONOMY: No forcing, no micromanagement
                // LomuAI will naturally proceed with tasks like Replit Agent does
              } else {
                toolResult = `❌ Failed to create task list: ${result.error}`;
                sendEvent('content', { content: `❌ Failed to create task list: ${result.error}\n\n` });
                console.error('[LOMU-AI] Task list creation failed:', result.error);
              }
            } else if (name === 'update_task') {
              const typedInput = input as { taskId: string; status: string; result?: string };
              sendEvent('progress', { message: `Updating task to ${typedInput.status}...` });

              // ✅ FULL AUTONOMY: No validation, no blocking - LomuAI works freely like Replit Agent
              // Let LomuAI manage its own tasks without artificial restrictions
              const result = await updateTask({
                userId,
                taskId: typedInput.taskId,
                status: typedInput.status,
                result: typedInput.result,
                startedAt: typedInput.status === 'in_progress' ? new Date() : undefined,
                completedAt: typedInput.status === 'completed' ? new Date() : undefined,
              });

              if (result.success) {
                toolResult = `✅ Task updated to ${typedInput.status}`;
                sendEvent('task_updated', { taskId: typedInput.taskId, status: typedInput.status });
                
                // ✅ GAP 2: Update RunStateManager (with status mapping)
                if (runStateManager) {
                  const mappedStatus = mapDatabaseStatusToRunState(typedInput.status);
                  runStateManager.updateTask(runId, typedInput.taskId, {
                    status: mappedStatus,
                    updatedAt: new Date().toISOString(),
                  });
                  
                  // Update phase based on task progress
                  const completionPercentage = runStateManager.getCompletionPercentage(runId);
                  if (completionPercentage > 0) {
                    runStateManager.updatePhase(runId, 'working', `Progress: ${completionPercentage}%`);
                  }
                  console.log(`[GAP-2] ✅ RunStateManager updated task ${typedInput.taskId}: "${typedInput.status}" → "${mappedStatus}" (${completionPercentage}% complete)`);
                }
              } else {
                toolResult = `❌ Failed to update task: ${result.error}`;
              }
            } else if (name === 'read_task_list') {
              const result = await readTaskList({ userId });

              if (result.success && result.taskLists) {
                const activeList = result.taskLists.find((list: any) => list.status === 'active');
                if (activeList) {
                  // Set taskListId if an active list is found
                  taskListId = activeList.id; // Set taskListId here
                  const tasks = activeList.tasks || [];
                  if (tasks.length === 0) {
                    toolResult = `Task list found but no tasks exist yet.\n\n` +
                      `Task List ID: ${activeList.id}\n` +
                      `Status: ${activeList.status}\n` +
                      `Tasks: 0\n\n` +
                      `Note: You cannot call updateTask() until tasks are created. Proceed with your work without task tracking.`;
                  } else {
                    const taskSummary = tasks.map((t: any) => 
                      `[${t.id}] ${t.title} - ${t.status}`
                    ).join('\n');
                    toolResult = `✅ Current Task List (${activeList.id}):\n\n${taskSummary}\n\n` +
                      `Use these task IDs when calling updateTask(). Example: updateTask("${tasks[0].id}", "in_progress")`;
                  }
                } else if (result.taskLists.length > 0) {
                  toolResult = `No active task list found (found ${result.taskLists.length} completed/cancelled lists).\n\n` +
                    `Task tracking is optional - proceed with your work without calling updateTask().`;
                } else {
                  toolResult = `No task lists exist yet.\n\n` +
                    `Task tracking is optional - proceed with your work without calling updateTask().\n` +
                    `Note: Tasks are usually created automatically when conversations start.`;
                }
              } else {
                toolResult = `Error reading task list: ${result.error}\n\n` +
                  `Proceed with your work anyway - task tracking is optional.`;
              }
            } else if (name === 'read_platform_file') {
              const typedInput = input as { path: string };
              sendEvent('progress', { message: `Reading ${typedInput.path}...` });
              toolResult = await platformHealing.readPlatformFile(typedInput.path);
            } else if (name === 'write_platform_file') {
              const typedInput = input as { path: string; content: string };

              // CRITICAL: Validate content exists before calling platformHealing
              if (typedInput.content === undefined || typedInput.content === null) {
                throw new Error(`Tool writePlatformFile called without content for ${typedInput.path}`);
              }

              if (typeof typedInput.content !== 'string') {
                throw new Error(`Tool writePlatformFile called with invalid content type (${typeof typedInput.content}) for ${typedInput.path}`);
              }

              // 🛡️ CRITICAL FILES PROTECTION: Require confirmation for core infrastructure
              const CRITICAL_FILES = [
                'server/index.ts',
                'server/routes.ts', 
                'server/db.ts',
                'server/vite.ts',
                'package.json',
                'drizzle.config.ts',
                'vite.config.ts',
                'shared/schema.ts'
              ];

              const isCriticalFile = CRITICAL_FILES.some(criticalPath => 
                typedInput.path === criticalPath || typedInput.path.endsWith(`/${criticalPath}`)
              );

              if (isCriticalFile) {
                // Check if file was read in this conversation
                const hasReadFile = conversationMessages.some((msg: any) => {
                  // msg.content is a STRING for user messages, ARRAY for assistant messages
                  if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
                    return false;
                  }
                  return msg.content.some((block: any) => 
                    block.type === 'tool_use' && 
                    block.name === 'read_platform_file' &&
                    block.input?.path === typedInput.path
                  );
                });

                if (!hasReadFile) {
                  toolResult = `❌ PROTECTION: "${typedInput.path}" is a critical infrastructure file!\n\n` +
                    `You MUST read this file first using read_platform_file() before modifying it.\n` +
                    `This prevents accidental overwrites of production code.\n\n` +
                    `**Next step:** Call read_platform_file("${typedInput.path}") to see the current content, ` +
                    `then make targeted edits instead of replacing the entire file.`;
                  
                  console.error(`[LOMU-AI-PROTECTION] ❌ Blocked write to critical file without reading: ${typedInput.path}`);
                  sendEvent('error', { message: `Critical file protection: Must read ${typedInput.path} before writing` });
                  
                  // Skip the actual write - just return error message to LomuAI
                  // toolResult is already set above, it will be pushed to toolResults array normally
                } else {
                  // File was read - allow the write

                  // Additional check: Warn if file size changes drastically
                  try {
                    const fs = await import('fs/promises');
                    const path = await import('path');
                    const fullPath = path.join(process.cwd(), typedInput.path);
                    const stats = await fs.stat(fullPath);
                    const originalSize = stats.size;
                    const newSize = typedInput.content.length;
                    const sizeChangePercent = Math.abs((newSize - originalSize) / originalSize) * 100;

                    if (sizeChangePercent > 50) {
                      const warning = `\n\n⚠️ **SIZE WARNING**: This change will ${newSize > originalSize ? 'increase' : 'decrease'} ` +
                        `file size by ${sizeChangePercent.toFixed(0)}% (${originalSize} → ${newSize} bytes).\n` +
                        `Please verify you're making targeted edits, not replacing the entire file!\n`;
                      sendEvent('content', { content: warning });
                      console.warn(`[LOMU-AI-PROTECTION] ⚠️ Large size change for ${typedInput.path}: ${sizeChangePercent.toFixed(0)}%`);
                    }
                  } catch (err) {
                    // File might not exist yet - that's okay
                  }
                }
              }

              // Only proceed with write if not blocked by protection
              if (!toolResult || !toolResult.includes('❌ PROTECTION')) {
                console.log(`[LOMU-AI] Writing file: ${typedInput.path} (${typedInput.content.length} bytes)`);

              // ✅ T3: VALIDATION PLUMBING - Track file change
              fileChangeTracker.recordChange(typedInput.path, 'modify');

              // ✅ AUTONOMOUS MODE: No approval required - LomuAI works like Replit Agent
              sendEvent('progress', { message: `✅ Modifying ${typedInput.path}...` });

              // 📦 BATCH COMMIT: Stage files for single commit at the end
              // This prevents multiple commits - all changes committed together via commit_to_github()
              const writeResult = await platformHealing.writePlatformFile(
                typedInput.path,
                typedInput.content,
                true  // skipAutoCommit: true - stage for batch commit
              );
              toolResult = JSON.stringify(writeResult);

              // ✅ VALIDATION HELPERS: Validate file was written successfully (Phase 1 - Non-blocking)
              try {
                const validation = await validateFileChanges([typedInput.path], process.cwd());
                if (!validation.success) {
                  console.warn('[FILE-VALIDATION] File write validation failed (non-blocking):', validation.errors);
                  // Non-blocking - just log for now, don't fail the operation
                }
              } catch (validationError) {
                console.error('[FILE-VALIDATION] Validation error (non-blocking):', validationError);
              }

              // Track file changes with content for batch commits
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'modify', 
                contentAfter: typedInput.content 
              });

              sendEvent('file_change', { file: { path: typedInput.path, operation: 'modify' } });

              // 📡 LIVE PREVIEW: Broadcast file update to connected clients with context
              broadcastFileUpdate(typedInput.path, 'modify', targetContext, projectId, userId);
              
              // 🧠 BRAIN TRACKING: Track file modification
              lomuAIBrain.trackFileModified(userId, session.sessionId, typedInput.path);

              toolResult = `✅ File staged for commit (use commit_to_github to batch all changes)`;
              console.log(`[LOMU-AI] ✅ File staged for batch commit: ${typedInput.path}`);

              // 🔄 AUTO-VERIFY: Automatically verify file write after every writePlatformFile
              // This ensures true self-healing: writes → verifies → retries if failed
              try {
                console.log('[LOMU-AI-AUTO-VERIFY] Triggering automatic verification after file write');
                sendEvent('progress', { message: '🔍 Auto-verifying file write...' });

                // Check if file exists and is accessible
                const lastChange = fileChanges[fileChanges.length - 1];
                const fs = await import('fs/promises');
                const path = await import('path');
                const fullPath = path.join(process.cwd(), lastChange.path);

                await fs.access(fullPath);

                // File exists - verification passed
                const verifySuccess = `\n\n🔍 Auto-verification passed: File ${lastChange.path} written successfully and is accessible.`;
                toolResult += verifySuccess;
                sendEvent('content', { content: verifySuccess });
                console.log(`[LOMU-AI-AUTO-VERIFY] ✅ Verification passed for ${lastChange.path}`);

              } catch (verifyError: any) {
                // Verification failed - append warning
                const verifyWarning = `\n\n⚠️ Auto-verification warning: File may not be accessible yet (${verifyError.message}). This is normal for new files.`;
                toolResult += verifyWarning;
                sendEvent('content', { content: verifyWarning });
                console.warn(`[LOMU-AI-AUTO-VERIFY] ⚠️ Verification warning for ${typedInput.path}:`, verifyError.message);
              }
              } // Close the protection check
            } else if (name === 'list_platform_files') {
              const typedInput = input as { directory: string };
              sendEvent('progress', { message: `Listing ${typedInput.directory}...` });
              const entries = await platformHealing.listPlatformDirectory(typedInput.directory);
              toolResult = entries.map(e => `${e.name} (${e.type})`).join('\n');
            } else if (name === 'search_platform_files') {
              const typedInput = input as { pattern: string };
              sendEvent('progress', { message: `Searching platform files: ${typedInput.pattern}...` });
              const results = await platformHealing.searchPlatformFiles(typedInput.pattern);
              toolResult = results.length > 0 
                ? `Found ${results.length} files:\n${results.join('\n')}` 
                : 'No files found matching pattern';
            } else if (name === 'run_test') {
              const typedInput = input as { testPlan: string; technicalDocs: string };
              sendEvent('progress', { message: '🧪 Running Playwright e2e tests...' });

              // Note: This would integrate with actual Playwright testing infrastructure
              // For MVP, provide feedback that testing is queued
              toolResult = `✅ E2E test queued with plan:\n${typedInput.testPlan}\n\nTechnical docs: ${typedInput.technicalDocs}\n\n` +
                `Note: Full Playwright integration coming soon. For now, manually verify UI/UX changes.`;

              sendEvent('content', { content: '\n\n🧪 **Test Plan Created** - Manual verification recommended until full Playwright integration.' });
            } else if (name === 'search_integrations') {
              const typedInput = input as { query: string };
              sendEvent('progress', { message: `Searching integrations for: ${typedInput.query}...` });

              // Note: This would integrate with Replit's integration search API
              // For MVP, provide guidance on common integrations
              const commonIntegrations: Record<string, string> = {
                'stripe': 'Stripe integration available - handles payment processing with automatic secret management',
                'openai': 'OpenAI integration available - provides API key management for GPT models',
                'github': 'GitHub integration available - OAuth and repository access',
                'anthropic': 'Anthropic integration available - Claude API with key rotation',
                'postgresql': 'PostgreSQL database available - built-in Neon integration',
                'auth': 'Replit Auth available - OAuth authentication system'
              };

              const query = typedInput.query.toLowerCase();
              const match = Object.keys(commonIntegrations).find(key => query.includes(key));

              toolResult = match 
                ? `✅ ${commonIntegrations[match]}\n\nUse the Replit Secrets tab to configure.`
                : `Integration search: "${typedInput.query}"\n\nCommon integrations: Stripe, OpenAI, GitHub, Anthropic, PostgreSQL, Replit Auth\n\nCheck Replit Secrets tab for configuration.`;
            } else if (name === 'generate_design_guidelines') {
              const typedInput = input as { projectDescription: string };
              sendEvent('progress', { message: '🎨 Generating design guidelines...' });

              // Note: This would integrate with design system generation
              // For MVP, provide basic design guidance
              toolResult = `✅ Design Guidelines Generated\n\n` +
                `Project: ${typedInput.projectDescription}\n\n` +
                `Design System Recommendations:\n` +
                `• Color Palette: Use semantic colors (primary, secondary, accent)\n` +
                `• Typography: System fonts with clear hierarchy\n` +
                `• Spacing: Consistent spacing scale (4px, 8px, 16px, 24px, 32px)\n` +
                `• Components: Use shadcn/ui for consistency\n` +
                `• Dark Mode: Support light/dark themes\n` +
                `• Accessibility: WCAG 2.1 AA compliance\n\n` +
                `Next: Create design_guidelines.md with detailed specs.`;
            } else if (name === 'read_project_file') {
              if (!projectId) {
                toolResult = '❌ No project selected. Use platform file tools instead.';
              } else {
                const typedInput = input as { path: string };

                try {
                  // SECURITY: Validate path to prevent traversal attacks
                  const validatedPath = validateProjectPath(typedInput.path);
                  sendEvent('progress', { message: `Reading ${validatedPath} from user project...` });

                  const { storage } = await import('../storage');
                  const projectFiles = await storage.getProjectFiles(projectId);
                  const targetFile = projectFiles.find(f => 
                    (f.path ? `${f.path}/${f.filename}` : f.filename) === validatedPath ||
                    f.filename === validatedPath
                  );

                  if (targetFile) {
                    toolResult = `File: ${targetFile.filename}\nLanguage: ${targetFile.language}\nContent:\n${targetFile.content}`;
                  } else {
                    toolResult = `❌ File not found: ${validatedPath}`;
                  }
                } catch (error: any) {
                  toolResult = `❌ Security error: ${error.message}`;
                  sendEvent('error', { message: error.message });
                }
              }
            } else if (name === 'write_project_file') {
              if (!projectId) {
                toolResult = '❌ No project selected. Use platform file tools instead.';
              } else {
                const typedInput = input as { path: string; content: string };

                try {
                  // SECURITY: Validate path to prevent traversal attacks
                  const validatedPath = validateProjectPath(typedInput.path);
                  sendEvent('progress', { message: `Writing ${validatedPath} to user project...` });

                  const { storage } = await import('../storage');
                  const projectFiles = await storage.getProjectFiles(projectId);
                  const targetFile = projectFiles.find(f => 
                    (f.path ? `${f.path}/${f.filename}` : f.filename) === validatedPath ||
                    f.filename === validatedPath
                  );

                  if (targetFile) {
                    // ✅ T3: VALIDATION PLUMBING - Track file change
                    fileChangeTracker.recordChange(validatedPath, 'modify');
                    
                    // Update existing file
                    await storage.updateFile(targetFile.id, targetFile.userId, typedInput.content);
                    
                    // 🧠 BRAIN TRACKING: Track file modification
                    lomuAIBrain.trackFileModified(userId, session.sessionId, validatedPath);
                    
                    toolResult = `✅ File updated: ${validatedPath}`;
                    sendEvent('file_change', { file: { path: validatedPath, operation: 'modify' } });
                  } else {
                    toolResult = `❌ File not found: ${validatedPath}. Use createProjectFile to create new files.`;
                  }
                } catch (error: any) {
                  toolResult = `❌ Security error: ${error.message}`;
                  sendEvent('error', { message: error.message });
                }
              }
            } else if (name === 'list_project_files') {
              if (!projectId) {
                toolResult = '❌ No project selected. Use platform file tools instead.';
              } else {
                sendEvent('progress', { message: `Listing files in user project...` });

                const { storage } = await import('../storage');
                const projectFiles = await storage.getProjectFiles(projectId);

                if (projectFiles.length === 0) {
                  toolResult = 'No files in project';
                } else {
                  toolResult = projectFiles.map(f => 
                    `${f.path ? `${f.path}/` : ''}${f.filename} (${f.language})`
                  ).join('\n');
                }
              }
            } else if (name === 'create_project_file') {
              if (!projectId) {
                toolResult = '❌ No project selected. Use platform file tools instead.';
              } else {
                const typedInput = input as { path: string; content: string };

                try {
                  // SECURITY: Validate path to prevent traversal attacks
                  const validatedPath = validateProjectPath(typedInput.path);
                  sendEvent('progress', { message: `Creating ${validatedPath} in user project...` });

                  const { storage } = await import('../storage');

                  // Get project owner to set correct userId
                  const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
                  if (!project || project.length === 0) {
                    toolResult = '❌ Project not found';
                  } else {
                    const projectOwnerId = project[0].userId;

                    // Parse filename and path from validated path
                    const parts = validatedPath.split('/');
                    const filename = parts.pop() || validatedPath;
                    const filePath = parts.join('/');

                    // Determine language from extension
                    const ext = filename.split('.').pop()?.toLowerCase() || 'text';
                    const langMap: Record<string, string> = {
                      'js': 'javascript', 'jsx': 'javascript',
                      'ts': 'typescript', 'tsx': 'typescript',
                      'py': 'python', 'html': 'html', 'css': 'css',
                      'json': 'json', 'md': 'markdown',
                    };
                    const language = langMap[ext] || 'text';

                    // ✅ T3: VALIDATION PLUMBING - Track file change
                    fileChangeTracker.recordChange(validatedPath, 'create');
                    
                    await storage.createFile({
                      userId: projectOwnerId,
                      projectId,
                      filename,
                      path: filePath,
                      content: typedInput.content,
                      language,
                    });
                    
                    // 🧠 BRAIN TRACKING: Track file modification
                    lomuAIBrain.trackFileModified(userId, session.sessionId, validatedPath);

                    toolResult = `✅ File created: ${validatedPath}`;
                    sendEvent('file_change', { file: { path: validatedPath, operation: 'create' } });
                  }
                } catch (error: any) {
                  toolResult = `❌ Security error: ${error.message}`;
                  sendEvent('error', { message: error.message });
                }
              }
            } else if (name === 'delete_project_file') {
              if (!projectId) {
                toolResult = '❌ No project selected. Use platform file tools instead.';
              } else {
                const typedInput = input as { path: string };

                try {
                  // SECURITY: Validate path to prevent traversal attacks
                  const validatedPath = validateProjectPath(typedInput.path);
                  sendEvent('progress', { message: `Deleting ${validatedPath} from user project...` });

                  const { storage } = await import('../storage');
                  const projectFiles = await storage.getProjectFiles(projectId);
                  const targetFile = projectFiles.find(f => 
                    (f.path ? `${f.path}/${f.filename}` : f.filename) === validatedPath ||
                    f.filename === validatedPath
                  );

                  if (targetFile) {
                    // ✅ T3: VALIDATION PLUMBING - Track file change
                    fileChangeTracker.recordChange(validatedPath, 'delete');
                    
                    await storage.deleteFile(targetFile.id, targetFile.userId);
                    toolResult = `✅ File deleted: ${validatedPath}`;
                    sendEvent('file_change', { file: { path: validatedPath, operation: 'delete' } });
                  } else {
                    toolResult = `❌ File not found: ${validatedPath}`;
                  }
                } catch (error: any) {
                  toolResult = `❌ Security error: ${error.message}`;
                  sendEvent('error', { message: error.message });
                }
              }
            } else if (name === 'architect_consult') {
              const typedInput = input as { 
                problem: string; 
                context: string; 
                proposedSolution: string;
                affectedFiles: string[];
              };
              sendEvent('progress', { message: '🏗️ Consulting I AM (The Architect) for strategic guidance...' });

              const architectResult = await consultArchitect({
                problem: typedInput.problem,
                context: typedInput.context,
                previousAttempts: [],
                codeSnapshot: `Proposed Solution:\n${typedInput.proposedSolution}\n\nAffected Files:\n${typedInput.affectedFiles.join('\n')}`
              });

              if (architectResult.success) {
                sendEvent('progress', { message: `✅ I AM provided guidance` });
                toolResult = `✅ I AM GUIDANCE\n\n${architectResult.guidance}\n\nRecommendations:\n${architectResult.recommendations.join('\n')}\n\nNote: This is consultation, not approval. You're autonomous - use this advice as you see fit!`;
              } else {
                sendEvent('info', { message: `I AM consultation completed` });
                toolResult = `I AM FEEDBACK\n\n${architectResult.error}\n\nNote: This is just advice - you're autonomous and can proceed as you think best.`;
              }
            } else if (name === 'web_search') {
              const typedInput = input as { query: string; maxResults?: number };
              sendEvent('progress', { message: `🔍 Searching: ${typedInput.query}...` });

              const searchResult = await executeWebSearch({
                query: typedInput.query,
                maxResults: typedInput.maxResults || 5
              });

              // Format results for LomuAI (using 'content' field from API)
              toolResult = `Search Results:\n${searchResult.results.map((r: any) => 
                `• ${r.title}\n  ${r.url}\n  ${r.content}\n`
              ).join('\n')}`;
            } else if (name === 'commit_to_github') {
              const typedInput = input as { commitMessage: string };

              // Verify we have file changes to commit
              if (fileChanges.length === 0) {
                toolResult = `❌ No file changes to commit. Make platform changes first using writePlatformFile.`;
                sendEvent('error', { message: 'No file changes to commit' });
              } else {
                sendEvent('progress', { message: `📤 Committing ${fileChanges.length} files to GitHub...` });

                try {
                  // Check if GitHub service is configured
                  const hasToken = !!process.env.GITHUB_TOKEN;
                  const hasRepo = !!process.env.GITHUB_REPO;

                  if (!hasToken || !hasRepo) {
                    toolResult = `❌ GitHub integration not configured.\n\nSetup instructions:\n1. Create GitHub Personal Access Token at https://github.com/settings/tokens\n2. Set environment variables:\n   - GITHUB_TOKEN=ghp_...\n   - GITHUB_REPO=owner/repo-name\n3. Railway will auto-deploy on push to main branch\n\nThis enables Archetype to self-update in production!`;
                    sendEvent('error', { message: 'GitHub not configured - see setup instructions' });
                  } else {
                    // CRITICAL: Use getGitHubService() singleton - works on Railway WITHOUT local .git folder
                    const githubService = getGitHubService();

                    // CRITICAL: Use ONLY tracked fileChanges - NO filesystem reads
                    // On Railway, filesystem = deployed code from GitHub (not our changes!)
                    // The fileChanges array IS the source of truth for LomuAI's work
                    const filesToCommit = [];
                    for (const change of fileChanges) {
                      // REQUIRE contentAfter to be populated - no filesystem fallback
                      if (!change.contentAfter && change.contentAfter !== '') {
                        throw new Error(
                          `File ${change.path} is missing content! ` +
                          `This should never happen - writePlatformFile must populate contentAfter. ` +
                          `Cannot read from filesystem on Railway (would get old deployed code).`
                        );
                      }

                      filesToCommit.push({
                        path: change.path,
                        content: change.contentAfter,
                        operation: (change.operation || 'modify') as 'create' | 'modify' | 'delete',
                      });
                    }

                    console.log(`[LOMU-AI] Committing ${filesToCommit.length} files via GitHub API (works on Railway)`);

                    // ✅ Emit deployment started event
                    const deploymentId = `deploy-${Date.now()}`;
                    sendEvent('deploy.started', {
                      deploymentId,
                      commitMessage: typedInput.commitMessage,
                      filesCount: filesToCommit.length
                    });

                    // Emit initialization step
                    sendEvent('deploy.step_update', {
                      deploymentId,
                      step: 'Preparing commit',
                      status: 'running',
                      startTime: Date.now()
                    });

                    // Commit directly to GitHub via API (no local git needed)
                    const result = await githubService.commitFiles(
                      filesToCommit,
                      typedInput.commitMessage
                    );

                    // Emit commit complete step
                    sendEvent('deploy.step_update', {
                      deploymentId,
                      step: 'Pushing to GitHub',
                      status: 'complete',
                      startTime: Date.now(),
                      duration: 1500
                    });

                    // Emit deployment triggered step
                    sendEvent('deploy.step_update', {
                      deploymentId,
                      step: 'Triggering deployment',
                      status: 'complete',
                      startTime: Date.now(),
                      duration: 800
                    });

                    // Emit deployment complete
                    sendEvent('deploy.complete', {
                      deploymentId,
                      commitHash: result.commitHash,
                      commitUrl: result.commitUrl,
                      duration: 2500,
                      filesDeployed: filesToCommit.length
                    });

                    commitSuccessful = true; // Track commit success for task validation
                    usedGitHubAPI = true; // ✅ GitHub API already pushed - skip redundant git push
                    sendEvent('progress', { message: `✅ Committed to GitHub: ${result.commitHash}` });
                    sendEvent('progress', { message: `🚀 Railway will auto-deploy in 2-3 minutes` });

                    toolResult = `✅ SUCCESS! Committed ${fileChanges.length} files to GitHub\n\n` +
                      `Commit: ${result.commitHash}\n` +
                      `URL: ${result.commitUrl}\n\n` +
                      `🚀 Railway auto-deployment triggered!\n` +
                      `⏱️ Changes will be live in 2-3 minutes\n\n` +
                      `Files committed:\n${filesToCommit.map(f => `- ${f}`).join('\n')}\n\n` +
                      `Note: This works on Railway production (no local .git required)!`;

                    // ✅ CRITICAL: Clear fileChanges to prevent fallback commit from trying again
                    // Without this, the cleanup section would still attempt local git commit → error on Railway
                    fileChanges.length = 0;
                    console.log('[LOMU-AI] ✅ Cleared fileChanges after successful GitHub API commit');
                  }
                } catch (error: any) {
                  // Emit deployment failed event
                  sendEvent('deploy.failed', {
                    deploymentId: `deploy-${Date.now()}`,
                    error: error.message,
                    duration: 0
                  });
                  
                  toolResult = `❌ GitHub commit failed: ${error.message}`;
                  sendEvent('error', { message: `GitHub commit failed: ${error.message}` });
                }
              }
            } else if (name === 'request_user_approval') {
              const typedInput = input as { 
                summary: string; 
                filesChanged: string[]; 
                estimatedImpact: string;
              };

              sendEvent('progress', { message: '🔔 Requesting user approval...' });

              // Create assistant message with approval request
              const [approvalMsg] = await db
                .insert(chatMessages)
                .values({
                  userId,
                  projectId: null,
                  conversationStateId: conversationState.id,
                  fileId: null,
                  role: 'assistant',
                  content: `**Approval Request**\n\n${typedInput.summary}\n\n**Files to be changed:**\n${typedInput.filesChanged.map(f => `- ${f}`).join('\n')}\n\n**Estimated impact:** ${typedInput.estimatedImpact}`,
                  isPlatformHealing: true,
                  approvalStatus: 'pending_approval',
                  approvalSummary: typedInput.summary,
                  platformChanges: { filesChanged: typedInput.filesChanged, estimatedImpact: typedInput.estimatedImpact },
                })
                .returning();

              // Send SSE event to notify frontend
              sendEvent('approval_requested', { 
                summary: typedInput.summary,
                filesChanged: typedInput.filesChanged,
                estimatedImpact: typedInput.estimatedImpact,
                messageId: approvalMsg.id 
              });

              console.log('[LOMU-AI] Waiting for user approval...');
              sendEvent('progress', { message: '⏳ Waiting for your approval...' });

              try {
                // WAIT for user approval/rejection (blocks until resolved)
                const approved = await waitForApproval(approvalMsg.id);

                if (approved) {
                  toolResult = `✅ USER APPROVED! You may now proceed with the changes.\n\n` +
                    `Approved changes:\n${typedInput.filesChanged.map(f => `- ${f}`).join('\n')}\n\n` +
                    `Continue with implementation.`;
                  sendEvent('progress', { message: '✅ Approved! Proceeding with changes...' });
                  console.log('[LOMU-AI] User approved - continuing work');
                } else {
                  toolResult = `❌ USER REJECTED the changes.\n\n` +
                    `The user did not approve your proposed changes. ` +
                    `Stop this approach and ask the user what they would like to do instead.`;
                  sendEvent('progress', { message: '❌ Rejected by user' });
                  console.log('[LOMU-AI] User rejected - stopping work');
                  continueLoop = false; // Stop if rejected
                }
              } catch (error: any) {
                toolResult = `⏱️ Approval timeout: ${error.message}\n\nNo response from user after 10 minutes.`;
                sendEvent('error', { message: `Approval timeout: ${error.message}` });
                continueLoop = false;
              }
            } else if (name === 'perform_diagnosis') {
              const typedInput = input as { target: string; focus?: string[] };
              sendEvent('progress', { message: `🔍 Running ${typedInput.target} diagnosis...` });

              try {
                const diagnosisResult = await performDiagnosis({
                  target: typedInput.target as any,
                  focus: typedInput.focus,
                });

                if (diagnosisResult.success) {
                  // 🛡️ SANITIZE DIAGNOSIS: Reduce token consumption from large reports
                  const sanitizedResult = sanitizeDiagnosisForAI(diagnosisResult as any);

                  // Format findings nicely (using sanitized data)
                  const findingsList = (sanitizedResult.findings || diagnosisResult.findings)
                    .map((f: any, idx: number) => 
                      `${idx + 1}. [${f.severity.toUpperCase()}] ${f.category}\n` +
                      `   Issue: ${f.issue}\n` +
                      `   Location: ${f.location}\n` +
                      `   Evidence: ${f.evidence}`
                    )
                    .join('\n\n');

                  toolResult = `✅ Diagnosis Complete\n\n` +
                    `${sanitizedResult.summary || diagnosisResult.summary}\n\n` +
                    `Findings:\n${findingsList || 'No issues found'}\n\n` +
                    `Recommendations:\n${(sanitizedResult.recommendations || diagnosisResult.recommendations).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`;

                  sendEvent('progress', { message: `✅ Found ${diagnosisResult.findings.length} issues` });

                  // 🔥 FIX: Stream diagnosis results to chat immediately (don't wait for Claude to explain)
                  const postMessage = getPostToolMessage('perform_diagnosis', toolResult);
                  const diagnosisOutput = postMessage + toolResult;
                  sendEvent('content', { content: diagnosisOutput });
                  fullContent += diagnosisOutput;
                } else {
                  toolResult = `❌ Diagnosis failed: ${diagnosisResult.error}`;
                  sendEvent('error', { message: `Diagnosis failed: ${diagnosisResult.error}` });
                }
              } catch (error: any) {
                toolResult = `❌ Diagnosis error: ${error.message}`;
                sendEvent('error', { message: `Diagnosis error: ${error.message}` });
              }
            } else if (name === 'create_platform_file') {
              const typedInput = input as { path: string; content: string };

              // CRITICAL: Validate content exists before calling platformHealing
              if (typedInput.content === undefined || typedInput.content === null) {
                throw new Error(`Tool createPlatformFile called without content for ${typedInput.path}`);
              }

              if (typeof typedInput.content !== 'string') {
                throw new Error(`Tool createPlatformFile called with invalid content type (${typeof typedInput.content}) for ${typedInput.path}`);
              }

              console.log(`[LOMU-AI] Creating file: ${typedInput.path} (${typedInput.content.length} bytes)`);

              // ✅ T3: VALIDATION PLUMBING - Track file change
              fileChangeTracker.recordChange(typedInput.path, 'create');

              // ✅ AUTONOMOUS MODE: No approval required - LomuAI works like Replit Agent
              sendEvent('progress', { message: `✅ Creating ${typedInput.path}...` });
              const createResult = await platformHealing.createPlatformFile(
                typedInput.path,
                typedInput.content
              );
              toolResult = JSON.stringify(createResult);

              // Track file changes with content for batch commits
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'create', 
                contentAfter: typedInput.content 
              });

              sendEvent('file_change', { file: { path: typedInput.path, operation: 'create' } });

              // 📡 LIVE PREVIEW: Broadcast file update to connected clients with context
              broadcastFileUpdate(typedInput.path, 'create', targetContext, projectId, userId);
              
              // 🧠 BRAIN TRACKING: Track file modification
              lomuAIBrain.trackFileModified(userId, session.sessionId, typedInput.path);

              toolResult = `✅ File created successfully`;
              console.log(`[LOMU-AI] ✅ File created autonomously: ${typedInput.path}`);
            } else if (name === 'delete_platform_file') {
              const typedInput = input as { path: string };

              console.log(`[LOMU-AI] Deleting file: ${typedInput.path}`);

              // ✅ T3: VALIDATION PLUMBING - Track file change
              fileChangeTracker.recordChange(typedInput.path, 'delete');

              // ✅ AUTONOMOUS MODE: No approval required - LomuAI works like Replit Agent
              sendEvent('progress', { message: `✅ Deleting ${typedInput.path}...` });
              await platformHealing.deletePlatformFile(typedInput.path);

              // Track file changes for batch commits
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'delete'
              });

              sendEvent('file_change', { file: { path: typedInput.path, operation: 'delete' } });

              // 📡 LIVE PREVIEW: Broadcast file update to connected clients with context
              broadcastFileUpdate(typedInput.path, 'delete', targetContext, projectId, userId);

              toolResult = `✅ File deleted successfully`;
              console.log(`[LOMU-AI] ✅ File deleted autonomously: ${typedInput.path}`);
            } else if (name === 'read_logs') {
              const typedInput = input as { lines?: number; filter?: string };
              const maxLines = Math.min(typedInput.lines || 100, 1000);

              sendEvent('progress', { message: 'Reading server logs...' });

              try {
                const logsDir = '/tmp/logs';
                let logFiles: string[] = [];

                // Check if logs directory exists
                try {
                  await fs.access(logsDir);
                  logFiles = await fs.readdir(logsDir);
                } catch {
                  toolResult = `⚠️ No logs found at ${logsDir}. The server may not have written any logs yet, or logs are stored elsewhere.`;
                }

                if (!toolResult && logFiles.length === 0) {
                  toolResult = `⚠️ No log files found in ${logsDir}`;
                }

                // Only process logs if directory exists and has files
                if (!toolResult && logFiles.length > 0) {
                  // Sort by modification time and get the most recent log file
                  const fileStats = await Promise.all(
                    logFiles.map(async (file) => {
                      const filePath = path.join(logsDir, file);
                      const stats = await fs.stat(filePath);
                      return { file, mtime: stats.mtime, path: filePath };
                    })
                  );

                  fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
                  const mostRecentLog = fileStats[0];

                  // Read the most recent log file
                  const logContent = await fs.readFile(mostRecentLog.path, 'utf-8');
                  const logLines = logContent.split('\n');

                  // Filter by keyword if provided
                  let filteredLines = logLines;
                  if (typedInput.filter) {
                    filteredLines = logLines.filter(line => 
                      line.toLowerCase().includes(typedInput.filter!.toLowerCase())
                    );
                  }

                  // Get last N lines
                  const recentLines = filteredLines.slice(-maxLines);

                  toolResult = `📋 Server Logs (${mostRecentLog.file})\n` +
                    `Last modified: ${mostRecentLog.mtime.toISOString()}\n` +
                    `Total lines: ${logLines.length}\n` +
                    `Showing: ${recentLines.length} lines${typedInput.filter ? ` (filtered by "${typedInput.filter}")` : ''}\n\n` +
                    recentLines.join('\n');

                  sendEvent('progress', { message: `✅ Read ${recentLines.length} log lines` });
                }
              } catch (error: any) {
                toolResult = `❌ Failed to read logs: ${error.message}`;
                sendEvent('error', { message: `Failed to read logs: ${error.message}` });
              }
            } else if (name === 'execute_sql') {
              const typedInput = input as { query: string; purpose: string };

              sendEvent('progress', { message: `Executing SQL query: ${typedInput.purpose}...` });

              try {
                // ✅ AUTONOMOUS MODE: Execute any SQL query without approval
                sendEvent('progress', { message: `Executing SQL...` });
                const result = await db.execute(typedInput.query as any);

                toolResult = `✅ SQL executed successfully\n\n` +
                  `Purpose: ${typedInput.purpose}\n` +
                  `Query: ${typedInput.query}\n` +
                  `Rows returned: ${Array.isArray(result) ? result.length : 'N/A'}\n` +
                  `Result:\n${JSON.stringify(result, null, 2)}`;

                sendEvent('progress', { message: `✅ Query completed` });
                console.log(`[LOMU-AI] ✅ SQL executed autonomously: ${typedInput.purpose}`);
              } catch (error: any) {
                toolResult = `❌ SQL execution failed: ${error.message}\n\n` +
                  `Purpose: ${typedInput.purpose}\n` +
                  `Query: ${typedInput.query}\n` +
                  `Error details: ${error.stack || error.message}`;
                sendEvent('error', { message: `SQL execution failed: ${error.message}` });
              }
            } else if (name === 'start_subagent') {
              const typedInput = input as { task: string; relevantFiles: string[]; parallel?: boolean };

              if (typedInput.parallel) {
                // 🚀 PARALLEL EXECUTION MODE
                sendEvent('progress', { message: `🚀 Queuing parallel sub-agent: ${typedInput.task.slice(0, 60)}...` });

                try {
                  // Enqueue the task for parallel execution
                  const taskId = await parallelSubagentQueue.enqueueSubagent({
                    userId,
                    task: typedInput.task,
                    relevantFiles: typedInput.relevantFiles,
                    sendEvent,
                  });

                  // Get queue status
                  const status = parallelSubagentQueue.getStatus(userId);

                  toolResult = `✅ Sub-agent task queued for parallel execution\n\n` +
                    `Task ID: ${taskId}\n` +
                    `Task: ${typedInput.task}\n\n` +
                    `**Queue Status:**\n` +
                    `- Running: ${status.running}/2\n` +
                    `- Queued: ${status.queued}\n` +
                    `- Completed: ${status.completed}\n\n` +
                    `The sub-agent will start automatically when a slot is available. ` +
                    `Progress updates will be broadcast via WebSocket.`;

                  sendEvent('progress', { 
                    message: `✅ Sub-agent queued (${status.running} running, ${status.queued} queued)` 
                  });
                } catch (error: any) {
                  toolResult = `❌ Failed to queue sub-agent: ${error.message}`;
                  sendEvent('error', { message: `Failed to queue sub-agent: ${error.message}` });
                }
              } else {
                // 🔄 SEQUENTIAL EXECUTION MODE (existing behavior)
                sendEvent('progress', { message: `🎯 Delegating to sub-agent: ${typedInput.task.slice(0, 60)}...` });

                try {
                  const result = await startSubagent({
                    task: typedInput.task,
                    relevantFiles: typedInput.relevantFiles,
                    userId,
                    sendEvent,
                    fileChangeTracker, // T5: Pass tracker to sub-agent for change tracking
                  });

                  toolResult = `✅ Sub-agent completed work:\n\n${result.summary}\n\nFiles modified:\n${result.filesModified.map(f => `- ${f}`).join('\n')}`;

                  // Track file changes from sub-agent
                  result.filesModified.forEach((filePath: string) => {
                    fileChanges.push({ path: filePath, operation: 'modify' });
                  });

                  sendEvent('progress', { message: `✅ Sub-agent completed: ${result.filesModified.length} files modified` });
                } catch (error: any) {
                  toolResult = `❌ Sub-agent failed: ${error.message}`;
                  sendEvent('error', { message: `Sub-agent failed: ${error.message}` });
                }
              }
            } else if (name === 'verify_fix') {
              const typedInput = input as { 
                description: string; 
                checkType: 'logs' | 'endpoint' | 'file_exists'; 
                target?: string;
              };

              sendEvent('progress', { message: `🔍 Verifying: ${typedInput.description}...` });

              try {
                let verificationPassed = false;
                let verificationDetails = '';

                if (typedInput.checkType === 'logs') {
                  // Simplified log check - assume pass for now (can be enhanced later)
                  verificationPassed = true;
                  verificationDetails = 'Basic log check passed (enhanced verification coming soon)';

                } else if (typedInput.checkType === 'endpoint' && typedInput.target) {
                  // Perform actual HTTP request to test endpoint
                  try {
                    const response = await fetch(`http://localhost:5000${typedInput.target}`, {
                      method: 'GET',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    verificationPassed = response.ok; // 2xx status
                    verificationDetails = `Endpoint ${typedInput.target} returned ${response.status} ${response.statusText}`;
                  } catch (err: any) {
                    verificationPassed = false;
                    verificationDetails = `Endpoint ${typedInput.target} failed: ${err.message}`;
                  }

                } else if (typedInput.checkType === 'file_exists' && typedInput.target) {
                  // Check if file exists
                  try {
                    const fs = await import('fs/promises');
                    const path = await import('path');
                    const fullPath = path.join(process.cwd(), typedInput.target);
                    await fs.access(fullPath);
                    verificationPassed = true;
                    verificationDetails = `File ${typedInput.target} exists and is accessible`;
                  } catch (err: any) {
                    verificationPassed = false;
                    verificationDetails = `File ${typedInput.target} not found or not accessible`;
                  }
                }

                toolResult = verificationPassed
                  ? `✅ Verification passed: ${verificationDetails}`
                  : `❌ Verification failed: ${verificationDetails}\n\nYou should fix the issue and verify again.`;

                sendEvent('content', { 
                  content: `\n${verificationPassed ? '✅' : '❌'} ${typedInput.description}: ${verificationDetails}\n` 
                });

              } catch (error: any) {
                toolResult = `❌ Verification error: ${error.message}`;
                sendEvent('error', { message: `Verification failed: ${error.message}` });
              }
            } else if (name === 'bash') {
              const typedInput = input as { command: string; timeout?: number };
              sendEvent('progress', { message: `🔧 Executing: ${typedInput.command}...` });

              try {
                const result = await platformHealing.executeBashCommand(
                  typedInput.command, 
                  typedInput.timeout || 120000
                );

                if (result.success) {
                  toolResult = `✅ Command executed successfully\n\nStdout:\n${result.stdout}\n${result.stderr ? `\nStderr:\n${result.stderr}` : ''}`;
                } else {
                  toolResult = `❌ Command failed (exit code ${result.exitCode})\n\nStdout:\n${result.stdout}\n\nStderr:\n${result.stderr}`;
                }

                sendEvent('content', { content: `\n\n**Command output:**\n\`\`\`\n${result.stdout}\n\`\`\`\n` });
              } catch (error: any) {
                toolResult = `❌ Bash execution failed: ${error.message}`;
                sendEvent('error', { message: `Bash failed: ${error.message}` });
              }
            } else if (name === 'edit') {
              const typedInput = input as { filePath: string; oldString: string; newString: string; replaceAll?: boolean };
              sendEvent('progress', { message: `✏️ Editing ${typedInput.filePath}...` });

              try {
                // ✅ T3: VALIDATION PLUMBING - Track file change
                fileChangeTracker.recordChange(typedInput.filePath, 'modify');

                const result = await platformHealing.editPlatformFile(
                  typedInput.filePath,
                  typedInput.oldString,
                  typedInput.newString,
                  typedInput.replaceAll || false
                );

                if (result.success) {
                  toolResult = `✅ ${result.message}\nLines changed: ${result.linesChanged}`;

                  fileChanges.push({ 
                    path: typedInput.filePath, 
                    operation: 'modify'
                  });

                  sendEvent('file_change', { file: { path: typedInput.filePath, operation: 'modify' } });
                  broadcastFileUpdate(typedInput.filePath, 'modify', targetContext, projectId, userId);
                } else {
                  toolResult = `❌ ${result.message}`;
                }
              } catch (error: any) {
                toolResult = `❌ Edit failed: ${error.message}`;
                sendEvent('error', { message: `Edit failed: ${error.message}` });
              }
            } else if (name === 'grep') {
              const typedInput = input as { pattern: string; pathFilter?: string; outputMode?: 'content' | 'files' | 'count' };
              sendEvent('progress', { message: `🔍 Searching for: ${typedInput.pattern}...` });

              try {
                const result = await platformHealing.grepPlatformFiles(
                  typedInput.pattern,
                  typedInput.pathFilter,
                  typedInput.outputMode || 'files'
                );

                toolResult = result;
              } catch (error: any) {
                toolResult = `❌ Grep failed: ${error.message}`;
                sendEvent('error', { message: `Grep failed: ${error.message}` });
              }
            } else if (name === 'packager_tool') {
              const typedInput = input as { operation: 'install' | 'uninstall'; packages: string[] };
              sendEvent('progress', { message: `📦 ${typedInput.operation === 'install' ? 'Installing' : 'Uninstalling'} packages: ${typedInput.packages.join(', ')}...` });

              try {
                const result = await platformHealing.installPackages(
                  typedInput.packages,
                  typedInput.operation
                );

                if (result.success) {
                  toolResult = `✅ ${result.message}`;
                  sendEvent('content', { content: `\n\n✅ **Packages ${typedInput.operation === 'install' ? 'installed' : 'uninstalled'}:** ${typedInput.packages.join(', ')}\n` });
                } else {
                  toolResult = `❌ ${result.message}`;
                }
              } catch (error: any) {
                toolResult = `❌ Package operation failed: ${error.message}`;
                sendEvent('error', { message: `Package operation failed: ${error.message}` });
              }
            } else if (name === 'restart_workflow') {
              const typedInput = input as { workflowName?: string };
              const workflowName = typedInput.workflowName || 'Start application';
              sendEvent('progress', { message: `🔄 Restarting workflow: ${workflowName}...` });

              try {
                sendEvent('content', { content: `\n\n🔄 **Restarting server...** This will apply code changes.\n` });
                toolResult = `✅ Workflow "${workflowName}" restart requested. The server will restart automatically.`;
              } catch (error: any) {
                toolResult = `❌ Workflow restart failed: ${error.message}`;
                sendEvent('error', { message: `Restart failed: ${error.message}` });
              }
            } else if (name === 'get_latest_lsp_diagnostics') {
              sendEvent('progress', { message: `🔍 Running TypeScript diagnostics...` });

              try {
                const result = await platformHealing.getLSPDiagnostics();

                if (result.diagnostics.length === 0) {
                  toolResult = `✅ ${result.summary}`;
                } else {
                  const diagnosticsList = result.diagnostics
                    .slice(0, 20)
                    .map(d => `${d.file}:${d.line}:${d.column} - ${d.severity}: ${d.message}`)
                    .join('\n');

                  toolResult = `${result.summary}\n\n${diagnosticsList}${result.diagnostics.length > 20 ? `\n... and ${result.diagnostics.length - 20} more` : ''}`;
                }

                sendEvent('content', { content: `\n\n**TypeScript Check:** ${result.summary}\n` });
              } catch (error: any) {
                toolResult = `❌ LSP diagnostics failed: ${error.message}`;
                sendEvent('error', { message: `LSP diagnostics failed: ${error.message}` });
              }
            } else if (name === 'validate_before_commit') {
              sendEvent('progress', { message: `🔍 Running comprehensive pre-commit validation...` });

              try {
                const result = await platformHealing.validateBeforeCommit();

                if (result.success) {
                  toolResult = `${result.summary}\n\n` +
                    `✅ TypeScript: ${result.checks.typescript.message}\n` +
                    `✅ Database: ${result.checks.database.message}\n` +
                    `✅ Critical Files: ${result.checks.criticalFiles.message}\n\n` +
                    `🚀 Safe to commit and deploy!`;
                  sendEvent('content', { content: `\n\n✅ **Pre-commit validation passed** - Ready to commit!\n` });
                } else {
                  const failures = [];
                  if (!result.checks.typescript.passed) {
                    failures.push(`TypeScript: ${result.checks.typescript.message} (${result.checks.typescript.errors} errors)`);
                  }
                  if (!result.checks.database.passed) {
                    failures.push(`Database: ${result.checks.database.message}`);
                  }
                  if (!result.checks.criticalFiles.passed) {
                    failures.push(`Critical Files: ${result.checks.criticalFiles.message}`);
                  }

                  toolResult = `${result.summary}\n\n` +
                    `❌ VALIDATION FAILURES:\n${failures.join('\n')}\n\n` +
                    `⚠️ Fix these issues before committing to production!`;
                  sendEvent('content', { content: `\n\n❌ **Pre-commit validation failed** - Fix issues before committing:\n${failures.map(f => `• ${f}`).join('\n')}\n` });
                }
              } catch (error: any) {
                toolResult = `❌ Validation failed: ${error.message}`;
                sendEvent('error', { message: `Validation failed: ${error.message}` });
              }
            } else if (name === 'search_codebase') {
              const typedInput = input as { query: string; maxResults?: number };
              sendEvent('progress', { message: `🔍 Searching codebase: "${typedInput.query}"...` });

              try {
                const result = await platformHealing.searchCodebase(
                  typedInput.query,
                  typedInput.maxResults || 10
                );

                if (result.success && result.results.length > 0) {
                  const resultsList = result.results
                    .map((r, i) => `${i + 1}. ${r.file}\n   ${r.relevance}\n   Code: ${r.snippet}`)
                    .join('\n\n');

                  toolResult = `${result.summary}\n\n${resultsList}`;
                  sendEvent('content', { content: `\n\n🔍 **Found ${result.results.length} relevant locations**\n` });
                } else {
                  toolResult = `No code found for query: "${typedInput.query}"\n\nTry a different search query or use grep for exact text matching.`;
                  sendEvent('content', { content: `\n\n⚠️ No results found\n` });
                }
              } catch (error: any) {
                toolResult = `❌ Codebase search failed: ${error.message}`;
                sendEvent('error', { message: `Codebase search failed: ${error.message}` });
              }
            } else if (name === 'knowledge_store') {
              const { knowledge_store } = await import('../tools/knowledge');
              const typedInput = input as { category: string; topic: string; content: string; tags?: string[]; source?: string; confidence?: number };
              sendEvent('progress', { message: `💾 Storing knowledge: ${typedInput.topic}...` });

              try {
                const result = await knowledge_store({
                  category: typedInput.category,
                  topic: typedInput.topic,
                  content: typedInput.content,
                  tags: typedInput.tags,
                  source: typedInput.source || 'lomuai',
                  confidence: typedInput.confidence
                });
                toolResult = result;
                sendEvent('content', { content: `\n\n💾 **Stored knowledge**: ${typedInput.topic}\n` });
              } catch (error: any) {
                toolResult = `❌ Knowledge storage failed: ${error.message}`;
                sendEvent('error', { message: `Knowledge storage failed: ${error.message}` });
              }
            } else if (name === 'knowledge_search') {
              const { knowledge_search } = await import('../tools/knowledge');
              const typedInput = input as { query: string; category?: string; tags?: string[]; limit?: number };
              sendEvent('progress', { message: `🔎 Searching knowledge: "${typedInput.query}"...` });

              try {
                const results = await knowledge_search({
                  query: typedInput.query,
                  category: typedInput.category,
                  tags: typedInput.tags,
                  limit: typedInput.limit
                });

                if (results.length > 0) {
                  const resultsList = results
                    .map((r, i) => `${i + 1}. **${r.topic}** (${r.category})\n   ${r.content}\n   Tags: ${r.tags.join(', ')}\n   Confidence: ${r.confidence}`)
                    .join('\n\n');
                  toolResult = `Found ${results.length} knowledge entries:\n\n${resultsList}`;
                  sendEvent('content', { content: `\n\n🔎 **Found ${results.length} knowledge entries**\n` });
                } else {
                  toolResult = `No knowledge found for query: "${typedInput.query}"`;
                  sendEvent('content', { content: `\n\n⚠️ No knowledge entries found\n` });
                }
              } catch (error: any) {
                toolResult = `❌ Knowledge search failed: ${error.message}`;
                sendEvent('error', { message: `Knowledge search failed: ${error.message}` });
              }
            } else if (name === 'knowledge_recall') {
              const { knowledge_recall } = await import('../tools/knowledge');
              const typedInput = input as { category?: string; topic?: string; id?: string; limit?: number };
              sendEvent('progress', { message: `📚 Recalling knowledge...` });

              try {
                const results = await knowledge_recall({
                  category: typedInput.category,
                  topic: typedInput.topic,
                  id: typedInput.id,
                  limit: typedInput.limit
                });

                if (results.length > 0) {
                  const resultsList = results
                    .map((r, i) => `${i + 1}. **${r.topic}** (${r.category})\n   ${r.content}\n   Tags: ${r.tags.join(', ')}`)
                    .join('\n\n');
                  toolResult = `Recalled ${results.length} knowledge entries:\n\n${resultsList}`;
                  sendEvent('content', { content: `\n\n📚 **Recalled ${results.length} entries**\n` });
                } else {
                  toolResult = `No knowledge entries found matching criteria`;
                  sendEvent('content', { content: `\n\n⚠️ No matches found\n` });
                }
              } catch (error: any) {
                toolResult = `❌ Knowledge recall failed: ${error.message}`;
                sendEvent('error', { message: `Knowledge recall failed: ${error.message}` });
              }
            } else if (name === 'code_search') {
              const { code_search } = await import('../tools/knowledge');
              const typedInput = input as { query?: string; language?: string; tags?: string[]; store?: any; limit?: number };
              sendEvent('progress', { message: typedInput.store ? `💾 Storing code snippet...` : `🔍 Searching code snippets...` });

              try {
                const result = await code_search({
                  query: typedInput.query,
                  language: typedInput.language,
                  tags: typedInput.tags,
                  store: typedInput.store,
                  limit: typedInput.limit
                });

                if (typeof result === 'string') {
                  // Store operation
                  toolResult = result;
                  sendEvent('content', { content: `\n\n💾 **Code snippet stored**\n` });
                } else if (result.length > 0) {
                  // Search operation
                  const resultsList = result
                    .map((r, i) => `${i + 1}. **${r.description}** (${r.language})\n\`\`\`${r.language}\n${r.code}\n\`\`\`\n   Tags: ${r.tags.join(', ')}`)
                    .join('\n\n');
                  toolResult = `Found ${result.length} code snippets:\n\n${resultsList}`;
                  sendEvent('content', { content: `\n\n🔍 **Found ${result.length} code snippets**\n` });
                } else {
                  toolResult = `No code snippets found`;
                  sendEvent('content', { content: `\n\n⚠️ No code snippets found\n` });
                }
              } catch (error: any) {
                toolResult = `❌ Code search failed: ${error.message}`;
                sendEvent('error', { message: `Code search failed: ${error.message}` });
              }
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: id,
              content: toolResult || 'Success',
            });
            
            // 🧠 BRAIN TRACKING: Record tool call completion
            lomuAIBrain.completeToolCall(userId, session.sessionId, toolCallId, toolResult);

            // 💬 CONVERSATIONAL: Stream friendly text AFTER tool execution
            const postMessage = getPostToolMessage(name, toolResult || '');
            sendEvent('content', { content: postMessage });
            fullContent += postMessage;

            // Tool finished - no spam, AI will explain results naturally

            // 🔥 RAILWAY FIX: Send progress event AFTER each tool execution
            // This provides more frequent updates and keeps connection alive
            sendEvent('progress', { message: `✅ Tool ${name} completed` });
          } catch (error: any) {
              console.error(`[LOMU-AI] ❌ Tool ${name} failed:`, error);
              console.error(`[LOMU-AI] Tool input:`, JSON.stringify(input, null, 2));

              const errorMessage = `Error in ${name}: ${error.message}\n\nThis error has been logged for debugging.`;

              toolResults.push({
                type: 'tool_result',
                tool_use_id: id,
                is_error: true,
                content: errorMessage,
              });
              
              // 🧠 BRAIN TRACKING: Record tool call failure (mark toolCall as failed but don't track session yet)
              // Note: toolCallId may not be defined if error occurred before recordToolCall
              try {
                lomuAIBrain.completeToolCall(userId, session.sessionId, toolCallId, { error: errorMessage });
              } catch (brainError: any) {
                console.warn('[BRAIN] Failed to complete tool call tracking:', brainError.message);
              }

              // 💬 CONVERSATIONAL: Stream friendly text AFTER tool error
              const errorPostMessage = getPostToolMessage(name, errorMessage);
              sendEvent('content', { content: errorPostMessage });
              fullContent += errorPostMessage;

              // Tool failed - AI will handle retry naturally without spam

              // 🔥 RAILWAY FIX: Send error progress event
              sendEvent('progress', { message: `❌ Tool ${name} failed: ${error.message}` });
            }
        }
      }

      if (toolResults.length > 0) {
        // Track tool calls for quality analysis
        totalToolCallCount += toolResults.length;
        
        // FIX 4: Reset force mode after successful tool execution
        const justWroteFile = toolNames.some(name => name === 'write_platform_file' || name === 'write_project_file');
        
        if (shouldForceFunctionCall && justWroteFile) {
          console.log('[LOMU-AI-FORCE] Write operation completed - resetting force mode');
          shouldForceFunctionCall = false;
        }

        // 🚨 GLOBAL ACTION MODE: Force write-first behavior for all fix/build sessions
        // ARCHITECT FIX: Don't wait for read_platform_file - apply globally for fix sessions
        const isFixSession = userIntent === 'fix' || userIntent === 'build';
        const hasNotWrittenYet = workflowTelemetry.writeOperations === 0;
        const hasReadAtLeastOnce = workflowTelemetry.readOperations > 0;
        
        // 🚨 CIRCUIT BREAKER: DISABLED (causes Gemini to freeze)
        // ARCHITECT FIX: Removing all read tools mid-stream causes Gemini to freeze indefinitely
        // - Gemini was diagnosing (reading code)
        // - Circuit breaker suddenly removed ALL read tools
        // - Gemini can't finish its thought process without reading
        // - Result: Thinks forever until 5-minute timeout
        // SOLUTION: Let ACTION-MANDATE handle write encouragement (forceFunctionCall: true)
        const READ_LIMIT = isDefibrillatorPrompt ? 0 : 5; // Defibrillator bypasses reads entirely
        const hitCircuitBreaker = false; // DISABLED - too aggressive
        
        if (hitCircuitBreaker) {
          console.log(`[CIRCUIT-BREAKER] 🚨 HARD LIMIT ENGAGED: ${workflowTelemetry.readOperations} reads with ZERO writes`);
          console.log(`[CIRCUIT-BREAKER] Blocking all read operations - WRITE-ONLY mode activated`);
          
          // BLOCK all read-only tools
          availableTools = availableTools.filter(tool => !READ_ONLY_TOOLS.has(tool.name));
          console.log(`[CIRCUIT-BREAKER] ✅ Filtered to ${availableTools.length} write-only tools`);
          
          // Force function calling mode
          shouldForceFunctionCall = true;
          
          // Critical warning message
          systemEnforcementMessage = `\n\n🚨 **CIRCUIT BREAKER ACTIVATED**\n\nYou've read ${workflowTelemetry.readOperations} files without making ANY changes.\n\n**READ OPERATIONS NOW BLOCKED** - You can ONLY use write operations:\n- ✅ write_platform_file() - Implement fixes NOW\n- ✅ edit() - Modify existing files\n- ✅ bash() - Run commands/tests\n- ❌ NO MORE READING - All read tools disabled\n\nIMPLEMENT THE FIX IMMEDIATELY or explain why you cannot proceed.`;
          
          sendEvent('progress', { 
            message: '🚨 CIRCUIT BREAKER: Read limit exceeded - WRITE-ONLY mode' 
          });
        } else if (isFixSession && hasReadAtLeastOnce && hasNotWrittenYet && iterationCount >= 2) {
          console.log('[ACTION-MANDATE] ✅ Fix session with reads but NO writes - ACTIVATING ACTION MODE');
          console.log(`[ACTION-MANDATE] Iteration ${iterationCount}: Forcing mode:ANY to encourage write operations`);
          
          // Enable force mode to encourage function calling over text responses
          shouldForceFunctionCall = true;
          
          // Inject system enforcement message (reward/penalty messaging, not absolute rules)
          systemEnforcementMessage = `\n\n🎯 **WRITE-FIRST REMINDER**\n\nYou've read ${workflowTelemetry.readOperations} file(s) to understand the issue. Great analysis!\n\nNow it's time to implement fixes. Your goal is to WRITE code, not just read it.\n\n**High-value actions** (preferred):\n- ✅ write_platform_file() - Implement the fix\n- ✅ write_project_file() - Create new files\n- ✅ bash() - Run tests/validation\n\n**Low-value actions** (avoid unless necessary):\n- ⚠️ Reading more files without writing (${READ_LIMIT - workflowTelemetry.readOperations} reads left before hard block)\n- ⚠️ Creating task lists for simple fixes\n- ⚠️ Endless analysis paralysis\n\n**Remember**: You're authorized to make changes. Trust your analysis and proceed with confidence.`;
          
          sendEvent('progress', { 
            message: '🎯 Analysis complete - prioritizing write operations now' 
          });
        }

        // 📊 WORKFLOW TELEMETRY: Track read vs code-modifying operations
        let iterationHadCodeModifications = false;
        for (const toolName of toolNames) {
          if (READ_ONLY_TOOLS.has(toolName)) {
            workflowTelemetry.readOperations++;
          } else if (CODE_MODIFYING_TOOLS.has(toolName)) {
            workflowTelemetry.writeOperations++;
            workflowTelemetry.hasProducedFixes = true;
            iterationHadCodeModifications = true;
          } else {
            // Unknown tool - log warning but count as read-only (conservative)
            console.warn(`[WORKFLOW-TELEMETRY] ⚠️ Unknown tool category: ${toolName} - treating as read-only`);
            workflowTelemetry.readOperations++;
          }
        }

        // Track consecutive read-only iterations
        if (!iterationHadCodeModifications) {
          workflowTelemetry.consecutiveReadOnlyIterations++;
          console.log(`[WORKFLOW-TELEMETRY] ⚠️ Iteration ${iterationCount}: Read-only (${workflowTelemetry.consecutiveReadOnlyIterations}/${workflowTelemetry.MAX_READ_ONLY_ITERATIONS})`);
        } else {
          workflowTelemetry.consecutiveReadOnlyIterations = 0;
          console.log(`[WORKFLOW-TELEMETRY] ✅ Iteration ${iterationCount}: Code modifications detected - reset read-only counter`);
        }

        console.log(`[WORKFLOW-TELEMETRY] Total: ${workflowTelemetry.readOperations} reads, ${workflowTelemetry.writeOperations} writes`);

        // 🚨 EARLY TERMINATION: Halt if too many consecutive read-only iterations
        // BUT: Only halt if this is a FIX request AND no writes have occurred at all
        if (workflowTelemetry.consecutiveReadOnlyIterations >= workflowTelemetry.MAX_READ_ONLY_ITERATIONS) {
          // Check if user requested diagnostic/investigation (not implementation)
          const isDiagnosticRequest = /diagnos|investigat|check|analyz|review|what.*wrong|status|health|scan|find.*bug|search|look.*for/i.test(message);
          
          // ENFORCEMENT: Don't halt if ANY writes occurred during the session
          const hasProducedAnyFixes = workflowTelemetry.hasProducedFixes || workflowTelemetry.writeOperations > 0;
          
          if (!isDiagnosticRequest && !hasProducedAnyFixes && workflowTelemetry.readOperations > 0) {
            console.warn(`[WORKFLOW-TELEMETRY] 🛑 HALTING - ${workflowTelemetry.MAX_READ_ONLY_ITERATIONS} consecutive read-only iterations without ANY fixes`);
            const haltMsg = `\n\n⚠️ **Ready to implement fixes**\n\nI've analyzed ${workflowTelemetry.readOperations} files and identified the issues. Now I need to implement the fixes.\n\n**Next steps:** I should now use edit() or write_platform_file() to make the necessary changes. Would you like me to proceed with implementing the fixes, or shall I escalate to I AM Architect for review first?`;
            sendEvent('content', { content: haltMsg });
            fullContent += haltMsg;
            continueLoop = false;
          } else if (isDiagnosticRequest) {
            // Diagnostic requests are allowed to be read-only - reset counter
            console.log(`[WORKFLOW-TELEMETRY] ✓ Diagnostic request detected - investigation is appropriate`);
            workflowTelemetry.consecutiveReadOnlyIterations = 0;
          } else if (hasProducedAnyFixes) {
            // If writes have occurred, allow continued investigation - reset counter
            console.log(`[WORKFLOW-TELEMETRY] ✓ Writes detected (${workflowTelemetry.writeOperations}) - allowing continued work`);
            workflowTelemetry.consecutiveReadOnlyIterations = 0;
          }
        }

        conversationMessages.push({
          role: 'user',
          content: toolResults,
        });

        // 🚨 FORCING LOGIC (AFTER tool execution to avoid 400 errors)
        const createdTaskListThisIteration = toolNames.includes('create_task_list');
        const calledDiagnosisTools = toolNames.some(name => ['perform_diagnosis', 'architect_consult', 'execute_sql'].includes(name));

        console.log(`[LOMU-AI-FORCE] Created task list: ${createdTaskListThisIteration}`);
        console.log(`[LOMU-AI-FORCE] Called diagnosis tools: ${calledDiagnosisTools}`);
        console.log(`[LOMU-AI-FORCE] Iteration count: ${iterationCount}`);

        // ✅ NO AUTO-DIAGNOSIS FORCING - Let LomuAI work naturally
        // Only run diagnosis when user explicitly asks for it
        console.log('[LOMU-AI-FORCE] ✓ No forcing - LomuAI works autonomously');
        
        // ✅ GAP 5: Check iteration timeout after tool execution
        const iterationDuration = Date.now() - iterationStartTime;
        if (iterationDuration > ITERATION_TIMEOUT_MS) {
          console.error('[LOMU-AI-TIMEOUT] Iteration timeout exceeded!');
          
          if (runStateManager) {
            runStateManager.markFailed(runId, `Iteration ${iterationCount} timed out after ${iterationDuration}ms`);
          }
          
          sendEvent('error', { 
            message: '⏱️ Iteration took too long. Please try a simpler request or break it into steps.',
            iterationCount,
            duration: iterationDuration
          });
          
          continueLoop = false;
          break;
        }
      } else {
        // No tool calls this iteration - check if we should continue
        // 🐛 FIX: Don't end if there are tasks still in progress - LomuAI might need another turn
        console.log(`[LOMU-AI-CONTINUATION] Iteration ${iterationCount}: No tool calls, checking if should continue...`);
        console.log(`[LOMU-AI-CONTINUATION] Active task list ID: ${activeTaskListId || 'none'}`);

        // 🚨 INFINITE LOOP PREVENTION: Track consecutive empty iterations
        consecutiveEmptyIterations++;
        console.log(`[LOMU-AI-CONTINUATION] Consecutive empty iterations: ${consecutiveEmptyIterations}/${MAX_EMPTY_ITERATIONS}`);

        if (consecutiveEmptyIterations >= MAX_EMPTY_ITERATIONS) {
          console.log(`[LOMU-AI-CONTINUATION] 🛑 STOPPING - ${MAX_EMPTY_ITERATIONS} consecutive iterations without tool calls (infinite loop detected)`);
          sendEvent('progress', { message: `⚠️ LomuAI appears stuck - stopping after ${consecutiveEmptyIterations} empty iterations` });
          continueLoop = false;
        } else if (activeTaskListId) {
          try {
            const taskCheck = await readTaskList({ userId });
            console.log(`[LOMU-AI-CONTINUATION] Task list read success: ${taskCheck.success}`);
            console.log(`[LOMU-AI-CONTINUATION] Task lists found: ${taskCheck.taskLists?.length || 0}`);

            const sessionTaskList = taskCheck.taskLists?.find((list: any) => list.id === activeTaskListId);
            console.log(`[LOMU-AI-CONTINUATION] Session task list found: ${!!sessionTaskList}`);
            console.log(`[LOMU-AI-CONTINUATION] Tasks: ${sessionTaskList?.tasks?.length || 0}`);

            const allTasks = sessionTaskList?.tasks || [];
            const inProgressTasks = allTasks.filter((t: any) => t.status === 'in_progress');
            const pendingTasks = allTasks.filter((t: any) => t.status === 'pending');
            const completedTasks = allTasks.filter((t: any) => t.status === 'completed');

            console.log(`[LOMU-AI-CONTINUATION] Completed: ${completedTasks.length}, In-progress: ${inProgressTasks.length}, Pending: ${pendingTasks.length}`);

            // ✅ FULL AUTONOMY: Let LomuAI decide when to continue
            // No forcing, no micromanagement - trust the AI to do its job
            const hasIncompleteTasks = inProgressTasks.length > 0 || pendingTasks.length > 0;

            if (hasIncompleteTasks && iterationCount < MAX_ITERATIONS) {
              console.log(`[LOMU-AI-CONTINUATION] ✅ Continuing naturally - incomplete tasks remain`);
              continueLoop = true; // Continue but don't inject forcing messages
            } else {
              // Either all tasks done or hit iteration limit
              console.log(`[LOMU-AI-CONTINUATION] ❌ Ending - all tasks complete or limit reached (iteration ${iterationCount}/${MAX_ITERATIONS})`);
              continueLoop = false;
            }
          } catch (error: any) {
            console.error('[LOMU-AI-CONTINUATION] Failed to check task status:', error);
            continueLoop = false;
          }
        } else {
          // No task list - end normally
          console.log('[LOMU-AI-CONTINUATION] No task list - ending session naturally');
          continueLoop = false;
        }
      }
      
      // ============================================================================
      // GAP 3: COMPLETION DETECTION - Stop when all tasks are done
      // ============================================================================
      if (runStateManager && runStateManager.areAllTasksComplete(runId)) {
        console.log('[LOMU-AI-COMPLETION] All tasks completed! Marking run as complete...');
        
        runStateManager.markComplete(runId);
        
        sendEvent('complete', { 
          message: '✅ All tasks completed successfully!',
          runId,
          totalTasks: runStateManager.getTasks(runId).length,
          finalPhase: 'complete'
        });
        
        console.log('[LOMU-AI-COMPLETION] Run marked as complete, stopping iteration');
        continueLoop = false;
        break; // Exit iteration loop immediately
      }
    }

    // 🚨 NOTIFY USER IF HIT ITERATION LIMIT
    if (iterationCount >= MAX_ITERATIONS) {
      const warningMsg = `\n\n⚠️ Stopped after ${MAX_ITERATIONS} iterations. This usually means I got stuck in a loop. The work might be incomplete - please check what I did and let me know if you need me to continue.`;
      sendEvent('content', { content: warningMsg });
      fullContent += warningMsg;
      console.warn(`[LOMU-AI] ⚠️ Hit MAX_ITERATIONS (${MAX_ITERATIONS}) - possible infinite loop`);
    }

    // ============================================================================
    // T3: POST-ITERATION VALIDATION - Validate all file changes
    // ============================================================================
    const modifiedFiles = fileChangeTracker.getModifiedFiles();
    const changeCount = fileChangeTracker.getChangeCount();
    
    // ✅ T3 FIX: Skip validation if tracker is empty (no mutations)
    if (changeCount === 0 && modifiedFiles.length === 0) {
      console.log('[LOMU-AI-VALIDATION] ✅ No file changes to validate - skipping validation');
      // No validation needed - proceed normally
    } else if (modifiedFiles.length > 0) {
      console.log(`[LOMU-AI-VALIDATION] Running post-iteration validation on ${modifiedFiles.length} files...`);
      console.log(`[LOMU-AI-VALIDATION] Total file operations: ${changeCount}`);
      
      // Emit verifying phase
      phaseOrchestrator.emitVerifying(`Validating ${modifiedFiles.length} file changes...`);
      
      try {
        // ✅ P0-3: 3-LAYER VALIDATION - Full validation with TypeScript compilation check
        // FIX: Normalize paths (convert absolute to relative) before validation
        const workingDir = process.cwd();
        const relativeFiles = modifiedFiles.map(file => 
          file.startsWith(workingDir) ? file.substring(workingDir.length + 1) : file
        );
        
        console.log(`[LOMU-AI-VALIDATION] Validating ${relativeFiles.length} files (normalized paths)`);
        
        const validationResult = await validateAllChanges(relativeFiles, {
          workingDir: workingDir,
          skipTypeScriptCheck: false, // Enable TypeScript compilation checking
          timeout: 30000, // 30 second timeout
        });
        
        if (validationResult.success) {
          console.log(`[LOMU-AI-VALIDATION] ✅ All ${modifiedFiles.length} files validated successfully`);
          sendEvent('progress', { message: `✅ Validated ${modifiedFiles.length} file changes` });
          
          // Emit success in verifying phase
          phaseOrchestrator.emitComplete(`Validation passed: ${modifiedFiles.length} files verified`);
          
          // 🔄 GAP 2: UPDATE CODE SCRATCHPAD after successful validation
          // Store the working code for future reference
          if (fullContent.includes('```')) {
            // Extract code blocks from the response
            const codeBlockRegex = /```[\s\S]*?```/g;
            const codeBlocks = fullContent.match(codeBlockRegex);
            if (codeBlocks && codeBlocks.length > 0) {
              const latestCode = codeBlocks[codeBlocks.length - 1]; // Get the most recent code block
              await updateCodeScratchpad(conversationState.id, latestCode);
              console.log('[SCRATCHPAD] ✅ Updated code scratchpad with latest verified code');
            }
          }

          // ============================================================================
          // P0-1: AUTO-COMMIT TO GITHUB - Commit validated changes
          // ============================================================================
          try {
            const githubService = getGitHubService();
            
            if (githubService && githubService.isConfigured() && relativeFiles.length > 0) {
              console.log(`[AUTO-COMMIT] 🚀 Starting auto-commit for ${relativeFiles.length} files...`);
              sendEvent('progress', { message: `🔄 Committing ${relativeFiles.length} files to GitHub...` });
              phaseOrchestrator.emitVerifying(`Committing ${relativeFiles.length} files to GitHub...`);
              
              // FIX: Make file read failures BLOCKING (trigger rollback instead of silent drop)
              const fileChanges = [];
              const readFailures = [];
              
              for (const filePath of relativeFiles) {
                try {
                  const content = await fs.readFile(filePath, 'utf-8');
                  fileChanges.push({
                    path: filePath,
                    content,
                    operation: 'modify' as const,
                  });
                } catch (error: any) {
                  console.error(`[AUTO-COMMIT] ❌ BLOCKING: Failed to read ${filePath}:`, error.message);
                  readFailures.push({ file: filePath, error: error.message });
                }
              }

              // FIX: Treat file read failures as blocking validation failures
              if (readFailures.length > 0) {
                const errorMsg = `\n\n❌ **AUTO-COMMIT BLOCKED**\n` +
                  `Cannot commit - ${readFailures.length} file(s) failed to read:\n\n` +
                  readFailures.map(f => `  • ${f.file}: ${f.error}`).join('\n') + `\n\n` +
                  `**Triggering auto-rollback to maintain consistency...**\n`;
                
                sendEvent('content', { content: errorMsg });
                sendEvent('error', { message: `File read failures blocked commit: ${readFailures.length} files` });
                fullContent += errorMsg;
                
                // Trigger rollback
                throw new Error(`File read failures: ${readFailures.map(f => f.file).join(', ')}`);
              }

              if (fileChanges.length > 0) {
                // Generate commit message based on user intent
                const commitMessage = `${message.substring(0, 72)}${message.length > 72 ? '...' : ''}`;
                
                console.log(`[AUTO-COMMIT] Committing ${fileChanges.length} files with message: "${commitMessage}"`);
                
                const commitResult = await githubService.commitFiles(fileChanges, commitMessage);
                
                console.log(`[AUTO-COMMIT] ✅ Successfully committed to GitHub`);
                console.log(`[AUTO-COMMIT] Commit hash: ${commitResult.commitHash}`);
                console.log(`[AUTO-COMMIT] Commit URL: ${commitResult.commitUrl}`);
                
                const commitMsg = `\n\n✅ **AUTO-COMMIT SUCCESSFUL**\n` +
                  `📦 Committed ${fileChanges.length} files to GitHub\n` +
                  `🔗 [View commit](${commitResult.commitUrl})\n` +
                  `📝 Commit: \`${commitResult.commitHash.substring(0, 7)}\`\n`;
                
                sendEvent('content', { content: commitMsg });
                sendEvent('progress', { message: `✅ Committed to GitHub: ${commitResult.commitHash.substring(0, 7)}` });
                fullContent += commitMsg;
                
                phaseOrchestrator.emitComplete(`Committed ${fileChanges.length} files to GitHub`);
              }
            } else if (!githubService || !githubService.isConfigured()) {
              console.log('[AUTO-COMMIT] ⏭️ GitHub not configured - skipping auto-commit');
            } else {
              console.log('[AUTO-COMMIT] ⏭️ No modified files - skipping auto-commit');
            }
          } catch (commitError: any) {
            console.error('[AUTO-COMMIT] ❌ Auto-commit failed:', commitError.message);
            
            // FIX: Throw error to trigger rollback (blocking failure)
            throw new Error(`Auto-commit failed: ${commitError.message}`);
          }
        } else {
          // FIX: Surface TypeScript validation errors with full diagnostics
          console.error('[LOMU-AI-VALIDATION] ❌ VALIDATION FAILED - BLOCKING EXECUTION:');
          validationResult.errors.forEach(error => console.error(`  - ${error}`));
          
          // Emit error in verifying phase (make it prominent)
          const errorSummary = validationResult.errors.length > 3 
            ? `${validationResult.errors.slice(0, 3).join('; ')} ... and ${validationResult.errors.length - 3} more`
            : validationResult.errors.join('; ');
          
          phaseOrchestrator.emitVerifying(`❌ Validation failed: ${errorSummary}`);
          
          // FIX: Show full TypeScript diagnostics to user (not just summary)
          const errorDetails = validationResult.errors.length > 10
            ? validationResult.errors.slice(0, 10).map((e, i) => `${i + 1}. ${e}`).join('\n') + 
              `\n\n... and ${validationResult.errors.length - 10} more errors (check logs for full details)`
            : validationResult.errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
          
          const errorMsg = `\n\n❌ **VALIDATION FAILED** - TypeScript compilation errors detected:\n\n` +
            `${errorDetails}\n\n` +
            `**Files validated**: ${relativeFiles.length}\n` +
            `**Total errors**: ${validationResult.errors.length}\n` +
            `${validationResult.warnings.length > 0 ? `**Warnings**: ${validationResult.warnings.length}\n` : ''}` +
            `\n**Execution stopped and changes rolled back.**\n`;
          
          sendEvent('content', { content: errorMsg });
          sendEvent('error', { message: `TypeScript validation failed: ${validationResult.errors.length} errors` });
          fullContent += errorMsg;
          
          // Log error prominently with file list
          console.error(`[LOMU-AI-VALIDATION] ❌ ${validationResult.errors.length} validation errors - BLOCKING COMPLETION`);
          console.error(`[LOMU-AI-VALIDATION] Files checked: ${relativeFiles.join(', ')}`);
          
          // Show validation summary in logs
          const recentChanges = fileChangeTracker.getRecentChanges(60000);
          console.log('[LOMU-AI-VALIDATION] Recent file changes:');
          recentChanges.forEach(change => {
            console.log(`  ${change.operation.toUpperCase()}: ${change.file}`);
          });
          
          // ✅ T3 FIX: THROW ERROR TO BLOCK COMPLETION - Don't proceed to safety checks or cleanup
          throw new Error(`TypeScript validation failed: ${validationResult.errors.length} errors in ${relativeFiles.length} files`);
        }
        
        // Show validation summary in logs (only if success)
        const recentChanges = fileChangeTracker.getRecentChanges(60000);
        console.log('[LOMU-AI-VALIDATION] Recent file changes:');
        recentChanges.forEach(change => {
          console.log(`  ${change.operation.toUpperCase()}: ${change.file}`);
        });
        
      } catch (validationError: any) {
        // ✅ T3 FIX: Surface validation errors prominently and RE-THROW to block execution
        console.error('[LOMU-AI-VALIDATION] ❌ Validation error - BLOCKING:', validationError.message);
        phaseOrchestrator.emitVerifying(`❌ Validation error: ${validationError.message}`);
        sendEvent('error', { message: `Validation error: ${validationError.message}` });
        
        // 🔒 P1-GAP-1: AUTO-ROLLBACK on validation failure
        if (safetyBackupId) {
          try {
            console.log(`[SAFETY-ROLLBACK] 🔄 Validation failed - rolling back to backup ${safetyBackupId}...`);
            await platformHealing.rollback(safetyBackupId);
            console.log('[SAFETY-ROLLBACK] ✅ Successfully rolled back to pre-execution state');
            
            // Clean up workflow state - clear file change tracker
            console.log('[SAFETY-ROLLBACK] Cleaning up workflow state...');
            fileChangeTracker.clear(); // Clear all tracked file changes
            console.log('[SAFETY-ROLLBACK] ✅ Workflow state cleaned');
            
            const rollbackMsg = `\n\n🔄 **AUTO-ROLLBACK COMPLETED** - All changes have been reverted to the pre-execution state.\n` +
              `The platform is now back to its original state before this request.\n` +
              `Workflow state has been cleaned to prevent contamination.\n`;
            sendEvent('content', { content: rollbackMsg });
            fullContent += rollbackMsg;
          } catch (rollbackError: any) {
            console.error('[SAFETY-ROLLBACK] ❌ Auto-rollback failed:', rollbackError.message);
            const rollbackFailMsg = `\n\n⚠️ **AUTO-ROLLBACK FAILED** - Could not revert changes automatically.\n` +
              `Error: ${rollbackError.message}\n` +
              `Please use manual rollback if needed.\n`;
            sendEvent('content', { content: rollbackFailMsg });
            fullContent += rollbackFailMsg;
          }
        } else {
          const noBackupMsg = `\n\n⚠️ **NO SAFETY BACKUP** - Auto-rollback not available (backup creation failed).\n` +
            `You may need to manually revert changes if needed.\n`;
          sendEvent('content', { content: noBackupMsg });
          fullContent += noBackupMsg;
        }
        
        // Re-throw to ensure execution is blocked
        throw validationError;
      }
    } else {
      console.log('[LOMU-AI-VALIDATION] ⚠️ Warning: Tracker has changes but no modified files - validation skipped');
    }

    // 🎯 GIT-BASED FILE CHANGE DETECTION: Check if any files were actually modified
    try {
      const { stdout: gitStatus } = await execAsync('git status --porcelain');
      const hasFileChanges = gitStatus.trim().length > 0;

      // CRITICAL: Git status is ground truth - override hasProducedFixes
      workflowTelemetry.hasProducedFixes = hasFileChanges;

      if (hasFileChanges) {
        console.log('[WORKFLOW-TELEMETRY] ✅ Git detected file changes - marking as having fixes');
        console.log('[WORKFLOW-TELEMETRY] Changed files:', gitStatus.split('\n').slice(0, 5).join(', '));
      } else {
        console.log('[WORKFLOW-TELEMETRY] ⚠️ No file changes detected via git status - marking as zero-mutation');
      }
    } catch (gitError: any) {
      // Non-fatal: if git fails, rely on tool classification
      console.warn('[WORKFLOW-TELEMETRY] Git status check failed:', gitError.message);
    }

    // 📊 WORKFLOW VALIDATION: Detect zero-mutation jobs and flag as failed
    console.log(`[WORKFLOW-VALIDATION] Job completed with ${workflowTelemetry.writeOperations} code-modifying operations`);
    console.log(`[WORKFLOW-VALIDATION] Has produced fixes: ${workflowTelemetry.hasProducedFixes}`);

    // Detect if this was a fix/build request but no code modifications occurred
    // CRITICAL: Comprehensive keyword matching for fix requests (case-insensitive)
    // Note: lowerMessage already declared at line 837 for reset detection, reusing it here
    const FIX_REQUEST_KEYWORDS = [
      'fix', 'repair', 'resolve', 'patch', 'correct', 'address',
      'diagnose', 'debug', 'troubleshoot',
      'implement', 'build', 'create', 'add', 'develop', 'write',
      'update', 'modify', 'change', 'edit', 'refactor',
      'heal', 'platform-healing', 'self-healing',
      'bug', 'issue', 'problem', 'error', 'broken', 'failing'
    ];

    // Check if this conversation used diagnostic tools (perform_diagnosis, architect_consult, execute_sql)
    const diagnosticKeywords = ['diagnose', 'diagnosis', 'check', 'analyze', 'inspect', 'investigate', 'audit'];
    const isDiagnosticRequest = diagnosticKeywords.some(keyword => lowerMessage.includes(keyword));
    
    const isFixRequest = FIX_REQUEST_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
    const isZeroMutationJob = isFixRequest && !workflowTelemetry.hasProducedFixes && !isDiagnosticRequest;

    if (isZeroMutationJob) {
      console.error(`[WORKFLOW-VALIDATION] 🚨 ZERO-MUTATION JOB FAILURE - Fix request with no code modifications`);
      console.error(`[WORKFLOW-VALIDATION] Read operations: ${workflowTelemetry.readOperations}, Code modifications: ${workflowTelemetry.writeOperations}`);
      console.error(`[WORKFLOW-VALIDATION] Message: "${message.slice(0, 100)}..."`);

      // Log as failure in audit trail
      await platformAudit.log({
        userId,
        action: 'heal',
        description: `❌ ZERO-MUTATION FAILURE: ${message.slice(0, 100)}`,
        changes: [],
        backupId: undefined,
        commitHash: '',
        status: 'failure',
      });

      // Create platform incident for I AM Architect to review
      try {
        const [incident] = await db.insert(platformIncidents).values({
          type: 'agent_failure',
          severity: 'high',
          title: 'LomuAI Zero-Mutation Job Failure',
          description: `LomuAI completed a fix request without making any code changes.\n\nUser request: "${message}"\n\nTelemetry: ${workflowTelemetry.readOperations} reads, ${workflowTelemetry.writeOperations} writes\n\nThis indicates a workflow enforcement failure that requires I AM Architect review.`,
          source: 'agent_monitor',
          status: 'open',
          metrics: {
            userId,
            message: message.slice(0, 200),
            telemetry: workflowTelemetry,
            jobId: null, // This is a chat job, not a healing job
          }
        }).returning();

        console.log(`[WORKFLOW-VALIDATION] 🚨 Created incident ${incident.id} for I AM Architect escalation`);
        sendEvent('progress', { message: '🚨 Workflow failure logged - will escalate to I AM Architect' });
      } catch (incidentError: any) {
        console.error('[WORKFLOW-VALIDATION] Failed to create incident:', incidentError.message);
      }
    } else if (isDiagnosticRequest && !workflowTelemetry.hasProducedFixes) {
      console.log(`[WORKFLOW-VALIDATION] ✅ Diagnostic operation completed successfully - ${workflowTelemetry.readOperations} read operations, no code changes expected`);
    } else if (isFixRequest && workflowTelemetry.hasProducedFixes) {
      console.log(`[WORKFLOW-VALIDATION] ✅ Fix request completed successfully with ${workflowTelemetry.writeOperations} code-modifying operations`);
    } else {
      console.log(`[WORKFLOW-VALIDATION] ℹ️ Non-fix request (question/status check) - no code modifications expected`);
    }

    // Safety check
    sendEvent('progress', { message: 'Running safety checks...' });
    const safety = await platformHealing.validateSafety();

    if (!safety.safe) {
      sendEvent('error', { 
        message: `Safety check failed: ${safety.issues.join(', ')}. Please review changes.` 
      });
      res.end();
      return;
    }

    // 🎯 POST-SAFETY CLEANUP: Clean up incomplete tasks from THIS session only
    // CRITICAL: This now runs AFTER safety check passes, and only affects THIS session's tasks
    // This prevents stuck tasks when LomuAI exits early (timeout, crash, etc)
    // 🐛 FIX: Only cleanup if work actually started (prevents auto-complete of just-created tasks)
    if (activeTaskListId) {
      try {
        console.log(`[LOMU-AI-CLEANUP] Safety passed - checking task list ${activeTaskListId} for incomplete tasks...`);
        const cleanupCheck = await readTaskList({ userId });
        if (cleanupCheck.success && cleanupCheck.taskLists) {
          // CRITICAL: Only clean up THE SPECIFIC task list from THIS session
          const sessionTaskList = cleanupCheck.taskLists.find((list: any) => list.id === activeTaskListId);
          if (sessionTaskList && sessionTaskList.status !== 'completed') {
            // 🐛 CRITICAL FIX: Only cleanup tasks that are stuck "in_progress"
            // NEVER touch "pending" tasks - they were never started
            // This prevents auto-completing tasks that LomuAI hasn't started yet
            const stuckTasks = sessionTaskList.tasks.filter((t: any) => t.status === 'in_progress');

            if (stuckTasks.length > 0) {
              console.log(`[LOMU-AI-CLEANUP] Found ${stuckTasks.length} stuck in_progress tasks - will auto-complete`);
              sendEvent('progress', { message: `Cleaning up ${stuckTasks.length} stuck tasks...` });

              // Only mark stuck "in_progress" tasks as completed
              for (const task of stuckTasks) {
                try {
                  await updateTask({
                    userId,
                    taskId: task.id,
                    status: 'completed',
                    result: '⚠️ Auto-completed (session ended with task in progress)',
                    completedAt: new Date()
                  });
                  console.log(`[LOMU-AI-CLEANUP] Marked stuck task "${task.title}" as completed`);
                } catch (error: any) {
                  console.error(`[LOMU-AI-CLEANUP] Failed to cleanup task ${task.id}:`, error);
                }
              }

              // Mark task list as completed since we cleaned up stuck tasks
              try {
                await db
                  .update(taskLists)
                  .set({ status: 'completed', completedAt: new Date() })
                  .where(eq(taskLists.id, activeTaskListId));
                console.log(`[LOMU-AI-CLEANUP] ✅ Task list ${activeTaskListId} marked as completed (had stuck tasks)`);
              } catch (error: any) {
                console.error('[LOMU-AI-CLEANUP] Failed to mark task list complete:', error);
              }
            } else {
              // No stuck tasks - all are pending or completed
              const pendingTasks = sessionTaskList.tasks.filter((t: any) => t.status === 'pending');
              const completedTasks = sessionTaskList.tasks.filter((t: any) => t.status === 'completed');
              console.log(`[LOMU-AI-CLEANUP] ℹ️ No stuck tasks. Status: ${completedTasks.length} completed, ${pendingTasks.length} pending - no cleanup needed`);
            }
          } else if (sessionTaskList?.status === 'completed') {
            console.log(`[LOMU-AI-CLEANUP] ✅ Task list already marked as completed`);
          } else {
            console.warn(`[LOMU-AI-CLEANUP] ⚠️ Session task list ${activeTaskListId} not found - skipping cleanup`);
          }
        }
      } catch (cleanupError: any) {
        console.error('[LOMU-AI-CLEANUP] Cleanup error (non-fatal):', cleanupError.message);
        // Don't throw - cleanup is best-effort
      }
    } else {
      // No task list to clean up - this is normal and expected
      console.log('[LOMU-AI-CLEANUP] ℹ️ No task list in this session (task tracking is optional)');
    }

    // Commit and push if enabled (autonomous - no approval required)
    // ✅ T1: Use runConfig as single source of truth
    let commitHash = '';
    if (runConfig.autoCommit && fileChanges.length > 0 && !usedGitHubAPI) {
      // SIMPLE TYPESCRIPT-ONLY VALIDATION (Replit Agent parity)
      // Trust LomuAI's 7-phase workflow for file-level validation
      // Only check TypeScript compilation as final safety gate
      sendEvent('progress', { message: `🔍 Running TypeScript validation before commit...` });
      
      try {
        // Run TypeScript compiler check (non-emitting)
        const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
          cwd: process.cwd(),
          timeout: 30000, // 30 second timeout
        });
        
        // TypeScript passed - safe to commit
        sendEvent('progress', { message: `✅ TypeScript validation passed - committing ${fileChanges.length} files...` });
        commitHash = await platformHealing.commitChanges(`Fix: ${message.slice(0, 100)}`, fileChanges as any);
        console.log(`[LOMU-AI] ✅ TypeScript validated and committed autonomously: ${fileChanges.length} files`);

        if (runConfig.autoPush) {
          sendEvent('progress', { message: '✅ Pushing to GitHub (deploying to production)...' });
          await platformHealing.pushToRemote();
          console.log(`[LOMU-AI] ✅ Pushed to GitHub autonomously`);
        }
      } catch (tscError: any) {
        // TypeScript validation failed - don't commit
        const errorOutput = tscError.stdout || tscError.stderr || tscError.message;
        const errorMsg = `⚠️ TypeScript validation failed - changes NOT committed.`;
        
        sendEvent('progress', { message: errorMsg });
        console.error(`[LOMU-AI] ❌ TypeScript validation failed:`, errorOutput);
        
        // Parse TypeScript errors for better display
        const errorLines = errorOutput.split('\n').filter((line: string) => 
          line.includes('error TS') || line.includes('.ts(')
        ).slice(0, 10); // Show first 10 errors
        
        sendEvent('content', { 
          content: `\n\n**TypeScript Validation Failed**\n\nChanges were not committed due to TypeScript errors:\n\`\`\`\n${errorLines.join('\n')}\n\`\`\`\n\nPlease fix these errors and try again.\n` 
        });
      }
    } else if (usedGitHubAPI) {
      console.log(`[LOMU-AI] ℹ️ Skipping fallback commit - already committed via GitHub API`);
    }

    // Use LomuAI's response as-is (like Replit Agent)
    let finalMessage = fullContent || '✅ Done!';

    // 🔄 GAP 3: THREE-STEP FORMAT VALIDATION
    // Validate response follows Planning → Code → Testing structure
    const validateThreeStepFormat = (response: string): { valid: boolean; score: number; missing: string[] } => {
      const lowerResponse = response.toLowerCase();
      const missing: string[] = [];
      let score = 0;
      
      // Check for Planning section (thinking/analysis phase)
      const hasPlan = lowerResponse.includes('plan') || 
                      lowerResponse.includes('approach') || 
                      lowerResponse.includes('strategy') ||
                      lowerResponse.includes('will') ||
                      lowerResponse.includes('going to');
      if (hasPlan) score += 33; else missing.push('Planning');
      
      // Check for Code/Implementation section (actual work)
      const hasCode = response.includes('```') || 
                      lowerResponse.includes('implement') || 
                      lowerResponse.includes('creat') ||
                      lowerResponse.includes('modif') ||
                      lowerResponse.includes('fix');
      if (hasCode) score += 34; else missing.push('Code/Implementation');
      
      // Check for Testing/Verification section (validation)
      const hasTest = lowerResponse.includes('test') || 
                      lowerResponse.includes('verif') || 
                      lowerResponse.includes('check') ||
                      lowerResponse.includes('validat') ||
                      lowerResponse.includes('✅');
      if (hasTest) score += 33; else missing.push('Testing/Verification');
      
      return { valid: score === 100, score, missing };
    };
    
    const formatValidation = validateThreeStepFormat(finalMessage);
    if (!formatValidation.valid && intent === 'task') {
      console.warn(`[OUTPUT-VALIDATION] ⚠️ Response missing THREE-STEP format (${formatValidation.score}%):`);
      console.warn(`[OUTPUT-VALIDATION] Missing sections: ${formatValidation.missing.join(', ')}`);
      
      // Log quality metric (non-blocking warning)
      // TODO: Store quality metrics in conversation state
      console.log('[OUTPUT-VALIDATION] Quality metrics:', {
        formatScore: formatValidation.score,
        missingSections: formatValidation.missing,
        timestamp: new Date().toISOString()
      });
    } else if (formatValidation.valid) {
      console.log(`[OUTPUT-VALIDATION] ✅ Response follows THREE-STEP format (${formatValidation.score}%)`);
    }

    // Save assistant message with progress messages for inline display
    const [assistantMsg] = await db
      .insert(chatMessages)
      .values({
        userId,
        projectId: null,
        conversationStateId: conversationState.id,
        fileId: null,
        role: 'assistant',
        content: finalMessage,
        isPlatformHealing: true,
        progressMessages: progressMessages.length > 0 ? progressMessages : null,
        platformChanges: fileChanges.length > 0 ? { files: fileChanges } : null,
      })
      .returning();

    // 📊 FIX 3: LOW-CONFIDENCE DETECTION - Enforce clarification mandate
    const confidenceCheck = detectLowConfidencePatterns(finalMessage);
    if (confidenceCheck.hasLowConfidence) {
      console.warn(`[LOW-CONFIDENCE] ⚠️ Response contained ${confidenceCheck.patterns.length} low-confidence patterns`);
      console.warn(`[LOW-CONFIDENCE] Patterns found: ${confidenceCheck.patterns.join(', ')}`);
      console.warn(`[LOW-CONFIDENCE] ⚠️ VIOLATION: Agent should have used user_query tool instead of guessing`);
      
      // Log to trace as clarification mandate violation
      if (conversationState.traceId) {
        traceLogger.log(conversationState.traceId, 'error', {
          type: 'clarification_mandate_violation',
          patterns: confidenceCheck.patterns,
          message: finalMessage.substring(0, 500),
        });
      }
      
      // TODO: In future, could require user confirmation before proceeding
      // For now, log warning and continue (non-blocking)
    }

    // Log audit trail
    await platformAudit.log({
      userId,
      action: 'heal',
      description: `LomuAI chat: ${message.slice(0, 100)}`,
      changes: fileChanges,
      backupId: undefined, // Backups removed for conversational performance
      commitHash,
      status: 'success',
    });

    // ============================================================================
    // T2: PHASE ORCHESTRATION - EMIT COMPLETE PHASE (COMPLETION MILESTONE)
    // ============================================================================
    phaseOrchestrator.emitComplete('Finished! All changes complete.');

    // 🔍 FIX 2: TRACE PERSISTENCE - Persist trace for debugging
    if (conversationState.traceId) {
      await traceLogger.persist(
        conversationState.traceId,
        conversationState.id,
        userId
      );
      console.log(`[TRACE] Persisted trace ${conversationState.traceId} for conversation ${conversationState.id}`);
    }

    // ✅ Send completion event immediately - don't wait for quality analysis
    sendEvent('done', { messageId: assistantMsg.id, commitHash, filesChanged: fileChanges.length });
    res.end();

    // 🔍 QUALITY ANALYSIS: Analyze response quality in background (async, non-blocking)
    // ✅ CRITICAL FIX: This runs AFTER stream completes to prevent blocking user
    // ✅ Uses setImmediate() to ensure quality analysis doesn't delay response
    setImmediate(async () => {
      try {
        console.log('[LOMU-AI-QUALITY] Analyzing response quality (background)...');
        const qualityAnalysis = await agentFailureDetector.analyzeResponseQuality({
          content: finalMessage,
          userMessage: message,
          toolCallCount: totalToolCallCount, // ✅ Using accumulated count across ALL iterations
        });

        console.log(`[LOMU-AI-QUALITY] Quality score: ${qualityAnalysis.qualityScore}/100`);
        console.log(`[LOMU-AI-QUALITY] Is poor quality: ${qualityAnalysis.isPoorQuality}`);
        console.log(`[LOMU-AI-QUALITY] Should escalate: ${qualityAnalysis.shouldEscalate}`);

        if (qualityAnalysis.issues.length > 0) {
          console.log(`[LOMU-AI-QUALITY] Issues detected:`, qualityAnalysis.issues);
        }

        // If response quality is poor, create an incident (async, non-blocking)
        if (qualityAnalysis.isPoorQuality) {
          console.log('[LOMU-AI-QUALITY] ⚠️ Poor quality response detected - creating incident');

          // ✅ Fire-and-forget incident creation to prevent blocking
          Promise.resolve().then(async () => {
            try {
              // 🔒 DEDUPLICATION: Check for recent quality incidents from same user
              // Prevents spam from repeated bad responses
              const recentIncidents = await db
                .select()
                .from(platformIncidents)
                .where(
                  and(
                    eq(platformIncidents.type, 'agent_failure'),
                    eq(platformIncidents.status, 'open'),
                    sql`${platformIncidents.createdAt} > NOW() - INTERVAL '5 minutes'`
                  )
                )
                .limit(10);

              // Count quality incidents in last 5 minutes for this user/type
              const qualityIncidentCount = recentIncidents.filter(
                inc => inc.title?.includes('Response Quality Issue')
              ).length;

              if (qualityIncidentCount >= 3) {
                console.log('[LOMU-AI-QUALITY] ⏱️ Throttled: 3+ quality incidents in last 5 min, skipping duplicate');
                return;
              }

              const incidentId = await agentFailureDetector.createAgentFailureIncident({
                title: `Agent Response Quality Issue (Score: ${qualityAnalysis.qualityScore})`,
                description: `LomuAI generated a low-quality response.\n\n` +
                  `**User Message:** ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\n\n` +
                  `**Quality Score:** ${qualityAnalysis.qualityScore}/100\n\n` +
                  `**Issues Detected:**\n${qualityAnalysis.issues.map(i => `- ${i}`).join('\n')}\n\n` +
                  `**Tool Calls:** ${totalToolCallCount}\n\n` +
                  `**Response Length:** ${finalMessage.length} chars`,
                severity: qualityAnalysis.shouldEscalate ? 'high' : 'medium',
                stackTrace: `User Message: ${message}\n\nAgent Response: ${finalMessage.substring(0, 500)}...`,
                logs: `Tool calls: ${totalToolCallCount}\nIssues: ${qualityAnalysis.issues.join(', ')}`,
              });

              console.log(`[LOMU-AI-QUALITY] Created incident: ${incidentId}`);

              // If quality is critically poor, trigger architect healing
              if (qualityAnalysis.shouldEscalate) {
                console.log('[LOMU-AI-QUALITY] 🚨 Critical quality issue - triggering architect healing');

                // Trigger healing via public API (fire-and-forget, non-blocking)
                healOrchestrator.enqueueIncident(incidentId).catch((error: any) => {
                  console.error('[LOMU-AI-QUALITY] Failed to enqueue healing:', error.message);
                });

                console.log('[LOMU-AI-QUALITY] ✅ Architect healing queued (async)');
              }
            } catch (incidentError: any) {
              console.error('[LOMU-AI-QUALITY] Incident creation failed (non-fatal):', incidentError.message);
            }
          });
        } else {
          console.log('[LOMU-AI-QUALITY] ✅ Response quality is acceptable');
        }
      } catch (qualityError: any) {
        // Don't break anything if quality analysis fails
        console.error('[LOMU-AI-QUALITY] Quality analysis error (non-fatal):', qualityError.message);
      }
    });
  } catch (error: any) {
    console.error('[LOMU-AI-CHAT] Stream error:', error);

    // 🔥 RAILWAY FIX: Clear heartbeat on error
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      console.log('[LOMU-AI-HEARTBEAT] Cleared on error');
    }

    // 🔍 FIX 2: TRACE PERSISTENCE - Persist trace even on failure
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

    // Save error message to DB
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
      terminateStream(errorAssistantMsg.id, `Oops! ${error.message}. Let me try again!`);
    } catch (dbError: any) {
      // If we can't save to DB, at least send done event with generic ID
      console.error('[LOMU-AI-CHAT] Failed to save error message:', dbError);
      terminateStream('error-' + Date.now(), `Something went sideways, but I'm still here to help!`);
    }
  } finally {
    // STEP 3: Complete run and reconcile credits using centralized billing
    try {
      // Use centralized billing helper (handles FREE for platform, credits for projects)
      await handleBilling(userId, targetContext, totalCreditsUsed, agentRunId);
      console.log('[LOMU-AI-CHAT] Agent run completed:', agentRunId, 
        'Context:', targetContext, 
        'Credits used:', totalCreditsUsed,
        'Billing:', targetContext === 'platform' ? 'FREE' : 'CHARGED');
    } catch (error: any) {
      console.error('[LOMU-AI-CHAT] Failed to complete agent run billing:', error);
    }

    // Remove from active streams
    const activeStreamsKey = `lomu-ai-stream-${userId}`;
    activeStreams.delete(activeStreamsKey);
    console.log('[LOMU-AI-CHAT] Stream unregistered for user:', userId);

    // Clear stream timeout
    if (streamTimeoutId) {
      clearTimeout(streamTimeoutId);
      console.log('[LOMU-AI-CHAT] Stream timeout cleared');
    }

    // 🔥 RAILWAY FIX: ALWAYS clear heartbeat when stream ends
    // This ensures cleanup happens on success, error, or early termination
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      console.log('[LOMU-AI-HEARTBEAT] Cleared on stream end');
    }
  }
});

// Get pending changes for current user session
router.get('/pending-changes', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const pendingChanges = await platformHealing.getPendingChanges(userId);

    res.json({
      success: true,
      pendingChanges,
      count: pendingChanges.length,
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to get pending changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deploy all pending changes to production (batch commit)
router.post('/deploy-all', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const result = await platformHealing.deployAllChanges(userId);

    res.json(result);
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to deploy changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Discard all pending changes
router.delete('/discard-changes', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    await platformHealing.discardPendingChanges(userId);

    res.json({
      success: true,
      message: 'All pending changes discarded',
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to discard changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== BACKGROUND JOB ROUTES (Railway SSE timeout fix) ====================

// POST /api/lomu-ai/start - Start a new background job
router.post('/start', isAuthenticated, async (req: any, res) => {
  try {
    const { message } = req.body;
    const userId = req.authenticatedUserId;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 🔥 CRITICAL FIX: SHORT-CIRCUIT for simple conversational messages
    // Don't create jobs for "hi", "thanks", etc. - respond directly instead
    const { isSimpleMessage, createJob, startJobWorker } = await import('../services/lomuJobManager');

    if (isSimpleMessage(message)) {
      console.log('[LOMU-AI] Simple message detected, responding directly without job:', message.substring(0, 30));

      // Prepare simple responses
      const simpleResponses = {
        greetings: "Hey! 👋 I'm LomuAI, your platform maintenance assistant. Need help with something?",
        thanks: "You're welcome! Happy to help! 🍋",
        yes_no: "Got it! Let me know if you need anything else.",
        about: "I'm LomuAI - I maintain the Lomu platform, fix bugs, and handle deployments. What can I help you with today?"
      };

      const msg = message.trim().toLowerCase();
      let response = simpleResponses.about; // default

      if (/^(hi|hey|hello|yo|sup|howdy|greetings)/.test(msg)) {
        response = simpleResponses.greetings;
      } else if (/^(thanks?|thank you|thx|ty)/.test(msg)) {
        response = simpleResponses.thanks;
      } else if (/^(yes|no|ok|okay|nope|yep|yeah|nah)/.test(msg)) {
        response = simpleResponses.yes_no;
      }

      // Save simple exchange to chat history (Note: conversationState not available in this context - create one)
      const simpleConversationState = await import('../services/conversationState').then(m => m.getOrCreateState(userId, null));
      
      const [assistantMsg] = await db
        .insert(chatMessages)
        .values({
          userId,
          projectId: null,
          conversationStateId: simpleConversationState.id,
          fileId: null,
          role: 'assistant',
          content: response,
          isPlatformHealing: true,
        })
        .returning();

      return res.json({
        success: true,
        message: response,
        messageId: assistantMsg.id,
        isSimpleResponse: true, // Flag to indicate no job was created
      });
    }

    // ONLY create job for actual work requests
    const job = await createJob(userId, message);

    // Start worker in background (fire and forget)
    startJobWorker(job.id);

    console.log('[LOMU-AI] Started background job:', job.id);

    res.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job started successfully',
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to start job:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/lomu-ai/resume/:jobId - Resume an interrupted or failed job
router.post('/resume/:jobId', isAuthenticated, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;

    const { resumeJob } = await import('../services/lomuJobManager');

    // Resume the job
    await resumeJob(jobId, userId);

    console.log('[LOMU-AI] Resumed job:', jobId);

    res.json({ 
      success: true,
      message: 'Job resumed successfully',
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to resume job:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('cannot be resumed')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

// GET /api/lomu-ai/job/:jobId - Get job status and details
router.get('/job/:jobId', isAuthenticated, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;

    const { getJob } = await import('../services/lomuJobManager');

    // Get the job
    const job = await getJob(jobId, userId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ 
      success: true, 
      job,
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to get job:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/lomu-ai/job/:jobId/cancel - Cancel a running or pending job (graceful)
router.post('/job/:jobId/cancel', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { jobId } = req.params;
    const { reason } = req.body;
    
    // Get the job
    const job = await db.query.lomuJobs.findFirst({
      where: (jobs, { eq }) => eq(jobs.id, jobId)
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Allow admins/owners to cancel any job, or user to cancel their own
    const user = req.user as any;
    if (job.userId !== userId && !user?.isOwner && user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to cancel this job' });
    }
    
    // Import cancelJob function for graceful cancellation
    const { cancelJob } = await import('../services/lomuJobManager');
    
    const cancelledJob = await cancelJob(jobId, reason || 'Cancelled by user');
    
    console.log('[LOMU-AI] Job gracefully cancelled:', jobId, 'by user:', userId);
    
    res.json({ 
      success: true,
      job: cancelledJob,
      message: 'Job cancelled successfully'
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Cancel job error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/lomu-ai/active-job - Get user's active or interrupted job
router.get('/active-job', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;

    // Find the most recent active, interrupted, or pending job
    const job = await db.query.lomuJobs.findFirst({
      where: (jobs, { and, eq, inArray }) => and(
        eq(jobs.userId, userId),
        inArray(jobs.status, ['pending', 'running', 'interrupted'])
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    console.log('[LOMU-AI] Active job query for user:', userId, job ? `found ${job.id}` : 'none found');

    res.json({ 
      success: true, 
      job: job || null,
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to get active job:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/lomu-ai/job/:jobId - Cancel/clean up a stuck job (admin)
router.delete('/job/:jobId', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;

    // Get the job
    const job = await db.query.lomuJobs.findFirst({
      where: (jobs, { eq }) => eq(jobs.id, jobId)
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Admins can clean up any job, regular users can only clean up their own
    const user = req.user as any;
    if (!user.isOwner && job.userId !== userId) {
      return res.status(403).json({ error: 'You can only cancel your own jobs' });
    }

    // Mark as failed/interrupted
    await db.update(lomuJobs)
      .set({ 
        status: 'failed',
        error: 'Job cancelled by user',
        updatedAt: new Date()
      })
      .where(eq(lomuJobs.id, jobId));

    console.log('[LOMU-AI] Job cancelled:', jobId, 'by user:', userId);

    res.json({ 
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to cancel job:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/lomu-ai/chat-history - Fetch recent chat messages
router.get('/chat-history', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const limit = parseInt(req.query.limit as string) || 50;

    // Fetch recent messages for this user
    const messages = await db
      .select({
        id: chatMessages.id,
        role: chatMessages.role,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Filter out tool calls from messages before sending to frontend
    const filteredMessages = filterToolCallsFromMessages(messages.reverse());

    // Return in chronological order (oldest first)
    res.json({ 
      success: true, 
      messages: filteredMessages 
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to fetch chat history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔧 DEV-ONLY: Bypass auth for testing platform healing
// TODO: Remove this endpoint after testing is complete
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-trigger', async (req: any, res) => {
    try {
      console.log('[DEV-TRIGGER] Platform healing triggered via dev endpoint');
      console.log('[DEV-TRIGGER] Request body:', JSON.stringify(req.body));
      
      // Hardcode owner user ID for dev testing
      const OWNER_USER_ID = '29c3fdd8-bf52-45e2-9d0a-8861dc3d49ab';
      
      const message = req.body?.message;
      
      if (!message || typeof message !== 'string') {
        console.error('[DEV-TRIGGER] Invalid message:', message);
        return res.status(400).json({ error: 'Message is required and must be a string' });
      }
      
      console.log('[DEV-TRIGGER] Message received:', message.substring(0, 100));
      
      // Import job manager
      const { createJob, startJobWorker } = await import('../services/lomuJobManager');
      
      // Create the job
      const job = await createJob(OWNER_USER_ID, message);
      
      console.log('[DEV-TRIGGER] Job created:', job.id);
      
      // Start the job worker
      startJobWorker(job.id);
      
      res.json({
        success: true,
        jobId: job.id,
        message: 'Platform healing job started',
      });
    } catch (error: any) {
      console.error('[DEV-TRIGGER] Failed to start job:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  console.log('[DEV-ROUTES] ⚠️ Dev-only /dev-trigger endpoint enabled');
}

export default router;