import { Router } from 'express';
import { db } from '../db.ts';
import { storage } from '../storage.ts';
import { chatMessages, taskLists, tasks, lomuAttachments, lomuJobs, users, subscriptions, projects, conversationStates, platformIncidents, tokenLedger } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated, isAdmin } from '../universalAuth.ts';
import { aiLimiter } from '../rateLimiting';
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
import { broadcastToUser, broadcastToProject } from './websocket.ts';
import { getOrCreateState, formatStateForPrompt, updateCodeScratchpad, getCodeScratchpad, clearCodeScratchpad, clearState, estimateConversationTokens, summarizeOldMessages } from '../services/conversationState.ts';
import { agentFailureDetector } from '../services/agentFailureDetector.ts';
import { classifyUserIntent, type UserIntent } from '../shared/chatConfig.ts';
import { validateFileChanges, validateAllChanges, FileChangeTracker, type ValidationResult } from '../services/validationHelpers.ts';
import { PhaseOrchestrator } from '../services/PhaseOrchestrator.ts';
import { RunStateManager } from '../services/RunStateManager.ts';
import { traceLogger } from '../services/traceLogger.ts';
import { nanoid } from 'nanoid';
// Import extracted utilities and constants
import { MAX_CONSECUTIVE_THINKING } from './lomu/constants.ts';
import { LOMU_CORE_TOOLS } from '../tools/tool-distributions.ts';
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

// 🆕 Import modular components from refactored architecture
import { LOMU_LIMITS, getMaxIterationsForIntent } from '../config/lomuLimits.ts';
import { performanceMonitor } from '../services/performanceMonitor.ts';
import {
  configureSSEHeaders,
  sendInitialHeartbeat,
  createEventSender,
  setupHeartbeat,
  setupStreamTimeout,
  setupSocketKeepAlive,
  terminateStream,
  emitSection
} from './lomuChat/streaming.ts';
import {
  estimateTokensFromText,
  calculateTokenEstimate,
  recordTokenUsage,
  formatBillingInfo
} from './lomuChat/billing.ts';
import {
  validateToolExecution,
  formatToolResult,
  recordToolMetric,
  shouldTriggerAntiParalysis,
  getToolTimeout
} from './lomuChat/tools.ts';

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
router.post('/stream', isAuthenticated, aiLimiter, async (req: any, res) => {
  const { handleStreamRequest } = await import('./lomuChat/stream/orchestrator.ts');
  return handleStreamRequest(req, res, wss, activeStreams);
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