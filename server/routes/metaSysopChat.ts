import { Router } from 'express';
import { db } from '../db';
import { chatMessages, taskLists, tasks, metaSysopAttachments, metaSysopJobs, users, subscriptions, projects } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated, isAdmin } from '../universalAuth';
import Anthropic from '@anthropic-ai/sdk';
import { platformHealing } from '../platformHealing';
import { platformAudit } from '../platformAudit';
import { consultArchitect } from '../tools/architect-consult';
import { executeWebSearch } from '../tools/web-search';
import { GitHubService, getGitHubService } from '../githubService';
import { createTaskList, updateTask, readTaskList } from '../tools/task-management';
import { performDiagnosis } from '../tools/diagnosis';
import { startSubagent } from '../subagentOrchestration';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

// SECURITY: Validate project file paths to prevent path traversal attacks
function validateProjectPath(filePath: string): string {
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

function resolveApproval(messageId: string, approved: boolean) {
  const promise = approvalPromises.get(messageId);
  if (promise) {
    promise.resolve(approved);
    approvalPromises.delete(messageId);
    return true;
  }
  return false;
}

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
    console.error('[META-SYSOP] Failed to fetch message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve pending changes and auto-resume Meta-SySop
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

    console.log('[META-SYSOP] Changes approved for message:', messageId);

    // CRITICAL: Resolve the approval promise to resume the SSE stream
    const resolved = resolveApproval(messageId, true);
    if (resolved) {
      console.log('[META-SYSOP] Stream will resume after approval');
    } else {
      console.warn('[META-SYSOP] No pending stream found for message:', messageId);
    }

    res.json({ 
      success: true, 
      message: 'Changes approved - work resuming...',
    });

  } catch (error: any) {
    console.error('[META-SYSOP] Approval error:', error);
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

    console.log('[META-SYSOP] Changes rejected for message:', messageId);

    // Resolve the pending approval with false (rejected) to resume stream
    const resolved = resolveApproval(messageId, false);
    if (resolved) {
      console.log('[META-SYSOP] Stream resumed with rejection');
    } else {
      console.warn('[META-SYSOP] No pending stream found for message:', messageId);
    }

    res.json({ success: true, message: 'Changes rejected' });
  } catch (error: any) {
    console.error('[META-SYSOP] Rejection error:', error);
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
        console.log(`[META-SYSOP] Owner ${userId} auto-upgraded to MAX autonomy`);
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
    console.error('[META-SYSOP] Get autonomy level error:', error);
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

    console.log(`[META-SYSOP] User ${userId} autonomy level updated to: ${level}`);

    res.json({ 
      success: true, 
      level,
      message: `Autonomy level updated to ${level}`,
    });
  } catch (error: any) {
    console.error('[META-SYSOP] Update autonomy level error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all projects (admin only - for project selector in Meta-SySop)
router.get('/projects', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { storage } = await import('../storage');
    const projects = await storage.getAllProjects();
    
    console.log(`[META-SYSOP] Fetched ${projects.length} projects for admin project selector`);
    
    res.json(projects);
  } catch (error: any) {
    console.error('[META-SYSOP] Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task list by ID
router.get('/task-list/:taskListId', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { taskListId } = req.params;
    
    const taskList = await db
      .select()
      .from(tasks)
      .where(eq(tasks.taskListId, taskListId))
      .orderBy(tasks.createdAt);
    
    console.log(`[META-SYSOP] Fetched ${taskList.length} tasks for task list ${taskListId}`);
    
    res.json({ 
      success: true, 
      tasks: taskList,
      count: taskList.length,
    });
  } catch (error: any) {
    console.error('[META-SYSOP] Get task list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Meta-SySop chat history
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
          .from(metaSysopAttachments)
          .where(eq(metaSysopAttachments.messageId, msg.id));
        
        return {
          ...msg,
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      })
    );

    res.json({ messages: messagesWithAttachments });
  } catch (error: any) {
    console.error('[META-SYSOP-CHAT] Error loading history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stream Meta-SySop chat response
router.post('/stream', isAuthenticated, isAdmin, async (req: any, res) => {
  console.log('[META-SYSOP-CHAT] Stream request received');
  const { message, attachments = [], autoCommit = false, autoPush = false, projectId = null } = req.body;
  const userId = req.authenticatedUserId;
  console.log('[META-SYSOP-CHAT] Message:', message?.substring(0, 50), 'Attachments:', attachments?.length || 0, 'UserId:', userId, 'ProjectId:', projectId || 'platform code');

  if (!message || typeof message !== 'string') {
    console.log('[META-SYSOP-CHAT] ERROR: Message validation failed');
    return res.status(400).json({ error: 'Message is required' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.log('[META-SYSOP-CHAT] ERROR: No Anthropic API key');
    return res.status(503).json({ error: 'Anthropic API key not configured' });
  }

  console.log('[META-SYSOP-CHAT] Setting up SSE headers');
  // Set up Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  // Helper function to emit structured section events for collapsible UI
  const emitSection = (sectionId: string, sectionType: 'thinking' | 'tool' | 'text', phase: 'start' | 'update' | 'finish', content: string, metadata?: any) => {
    const event = {
      sectionId,
      sectionType,
      title: metadata?.title || content.substring(0, 50),
      phase,
      timestamp: Date.now(),
      content,
      metadata
    };
    res.write(`data: ${JSON.stringify({ type: `section_${phase}`, ...event })}\n\n`);
  };

  // Helper function to ensure consistent SSE stream termination
  const terminateStream = (messageId: string, error?: string) => {
    console.log('[META-SYSOP-CHAT] Terminating stream:', messageId, error ? `Error: ${error}` : 'Success');
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
      console.log('[META-SYSOP-HEARTBEAT] Sent keepalive to prevent timeout');
    } catch (error) {
      console.error('[META-SYSOP-HEARTBEAT] Failed to send keepalive:', error);
    }
  }, 15000); // Every 15 seconds

  console.log('[META-SYSOP-CHAT] Heartbeat started - will send keepalive every 15s');
  console.log('[META-SYSOP-CHAT] Entering try block');
  try {

    // Fetch user's autonomy level and subscription
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const autonomyLevel = user?.autonomyLevel || 'basic';
    console.log(`[META-SYSOP-CHAT] User autonomy level: ${autonomyLevel}`);

    // Determine autonomy level capabilities
    const levelConfig = {
      basic: { maxTokens: 8000, allowTaskTracking: false, allowWebSearch: false, allowSubAgents: false, requireApproval: true },
      standard: { maxTokens: 8000, allowTaskTracking: true, allowWebSearch: false, allowSubAgents: false, requireApproval: false },
      deep: { maxTokens: 16000, allowTaskTracking: true, allowWebSearch: true, allowSubAgents: true, requireApproval: false },
      max: { maxTokens: 16000, allowTaskTracking: true, allowWebSearch: true, allowSubAgents: true, requireApproval: false },
    };
    const config = levelConfig[autonomyLevel as keyof typeof levelConfig] || levelConfig.basic;

    // Save user message
    const [userMsg] = await db
      .insert(chatMessages)
      .values({
        userId,
        projectId: null, // Platform healing has no specific project
        fileId: null,
        role: 'user',
        content: message,
        isPlatformHealing: true,
      })
      .returning();

    // Save attachments to database
    if (attachments && attachments.length > 0) {
      console.log('[META-SYSOP-CHAT] Saving', attachments.length, 'attachments');
      const attachmentValues = attachments.map((att: any) => ({
        messageId: userMsg.id,
        fileName: att.fileName,
        fileType: att.fileType,
        content: att.content,
        mimeType: att.mimeType,
        size: att.size,
      }));
      
      await db.insert(metaSysopAttachments).values(attachmentValues);
      console.log('[META-SYSOP-CHAT] Attachments saved successfully');
    }

    sendEvent('user_message', { messageId: userMsg.id });

    // Meta-SySop creates task lists for work requests (diagnose, fix, improve)
    // This makes progress visible in the inline task card
    sendEvent('progress', { message: '🧠 Analyzing your request...' });
    
    // Track task list ID if created during conversation
    let activeTaskListId: string | undefined;

    // NOTE: Backup creation removed to avoid unnecessary work for casual conversations
    // Backups only created when actual platform changes are made (via approval workflow)

    // Get conversation history for context
    // 🧠 BOUNDED MEMORY SYSTEM: Load last 100 messages (prevents token overflow)
    // This gives ~50K tokens for history + leaves 150K for platform knowledge + response
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
      .limit(100); // Bounded to prevent API failures, but still comprehensive
    
    // Reverse to chronological order (oldest → newest) for Claude
    history.reverse();

    // 🧠 EXTRACT COMPREHENSIVE MEMORY from ENTIRE conversation history
    const userMessages = history.filter(msg => msg.role === 'user' && msg.id !== userMsg.id);
    const assistantMessages = history.filter(msg => msg.role === 'assistant');
    
    // Track ALL user goals, issues, fixes, and platform changes
    const userGoals: string[] = [];
    const knownIssues: string[] = [];
    const attemptedFixes: string[] = [];
    const completedWork: string[] = [];
    
    for (const msg of userMessages) {
      const content = msg.content.toLowerCase();
      
      // Extract EVERYTHING - user goals, ideas, requests
      if (content.includes('build') || content.includes('create') || content.includes('implement') || 
          content.includes('add') || content.includes('want') || content.includes('need')) {
        userGoals.push(msg.content);
      }
      
      // Extract ALL issues - bugs, errors, complaints, problems
      if (content.includes('bug') || content.includes('error') || content.includes('broken') || 
          content.includes('not working') || content.includes('issue') || content.includes('problem') ||
          content.includes('doesn\'t') || content.includes('can\'t') || content.includes('won\'t')) {
        knownIssues.push(msg.content);
      }
      
      // Extract fix requests and what user asked for
      if (content.includes('fix') || content.includes('repair') || content.includes('resolve') ||
          content.includes('update') || content.includes('change') || content.includes('improve')) {
        attemptedFixes.push(msg.content);
      }
    }
    
    // Extract completed work from assistant messages
    for (const msg of assistantMessages) {
      const content = msg.content.toLowerCase();
      if (content.includes('committed') || content.includes('deployed') || content.includes('completed') ||
          content.includes('fixed') || content.includes('updated') || content.includes('implemented')) {
        // Extract first 200 chars of work completed
        completedWork.push(msg.content.substring(0, 200));
      }
    }
    
    // 🧠 CONDENSED PLATFORM KNOWLEDGE: Smart summary instead of full replit.md
    const platformKnowledge = `\n\n═══════════════════════════════════════════════════════════════════\n` +
      `📚 CONDENSED PLATFORM KNOWLEDGE (Your Intimate Understanding)\n` +
      `═══════════════════════════════════════════════════════════════════\n\n` +
      `**ARCHETYPE PLATFORM - YOU KNOW THIS INTIMATELY:**\n\n` +
      `**What It Is:** AI-powered SaaS for rapid web dev with SySop (user AI agent), Meta-SySop (YOU - platform maintenance), I AM (architect). Dual versions: Archetype (desktop) + Archetype5 (mobile).\n\n` +
      `**Tech Stack:** React + Express + PostgreSQL (Neon) + Vite, deployed on Railway with GitHub auto-deploy from main branch.\n\n` +
      `**YOUR CAPABILITIES (Meta-SySop):**\n` +
      `- ✅ Full platform source code access (read/write platform files)\n` +
      `- ✅ Background jobs system (run indefinitely, no timeouts)\n` +
      `- ✅ Batch commits (stage files, commit once to prevent deployment flooding)\n` +
      `- ✅ Memory system (100 messages of conversation history)\n` +
      `- ✅ Deployment awareness (know recent GitHub commits)\n` +
      `- ✅ Architect consultation (call I AM for architectural guidance)\n` +
      `- ✅ Web search (Tavily API for research)\n` +
      `- ✅ Task management (create/update task lists)\n` +
      `- ✅ Action-oriented workflow (tools first, talk second like Replit Agent)\n\n` +
      `**KEY SYSTEMS YOU MAINTAIN:**\n` +
      `1. **SySop AI Agent** - 12-step workflow for user project generation\n` +
      `2. **Platform Healing** - Real-time metrics, diagnostics, auto-healing\n` +
      `3. **WebSocket Broadcasting** - Live updates for chat, tasks, metrics\n` +
      `4. **Database** - PostgreSQL with Drizzle ORM, 20+ tables\n` +
      `5. **Authentication** - Replit Auth + PostgreSQL sessions\n` +
      `6. **File Management** - Monaco editor, project storage\n` +
      `7. **Preview System** - esbuild in-memory compilation\n` +
      `8. **Deployment** - Railway auto-deploy on GitHub push\n\n` +
      `**RESOLVED ISSUES (Don't bring these up):**\n` +
      `- ❌ Chatbar issues (FIXED - UI updated)\n` +
      `- ❌ Memory problems (FIXED - you now have 100-message memory)\n` +
      `- ❌ Deployment flooding (FIXED - batch commits)\n` +
      `- ❌ Personality/conversation skills (FIXED - you're conversational now!)\n\n` +
      `**FILE STRUCTURE:**\n` +
      `- client/src/ - React frontend (pages, components)\n` +
      `- server/ - Express backend (routes, services)\n` +
      `- shared/ - TypeScript types and schema\n` +
      `- replit.md - Platform documentation (YOU CAN READ/WRITE THIS!)\n` +
      `- Use readPlatformFile/writePlatformFile for code changes\n\n` +
      `**📖 ACCESSING FULL PLATFORM KNOWLEDGE:**\n` +
      `- You have condensed knowledge above, but complete docs are in replit.md\n` +
      `- Read it anytime: readPlatformFile("replit.md")\n` +
      `- Update it when you make major changes: writePlatformFile("replit.md", content)\n` +
      `- Keep it current with platform evolution - it's YOUR documentation!\n\n` +
      `**HOW TO HELP:**\n` +
      `- Be conversational and reference this knowledge naturally\n` +
      `- "I know Archetype uses..." or "Let me check the platform healing system..."\n` +
      `- Show confidence from this intimate understanding\n` +
      `- Reference past fixes and improvements\n` +
      `- Read replit.md for detailed architecture when needed\n`;

    // Generate comprehensive memory summary for system prompt
    let memorySummary = '';
    if (userGoals.length > 0 || knownIssues.length > 0 || attemptedFixes.length > 0 || completedWork.length > 0) {
      memorySummary = `\n\n═══════════════════════════════════════════════════════════════════\n`;
      memorySummary += `🧠 FULL CONVERSATION HISTORY (Everything We've Discussed)\n`;
      memorySummary += `═══════════════════════════════════════════════════════════════════\n\n`;
      memorySummary += `**Total conversation messages: ${history.length}**\n`;
      memorySummary += `**User requests tracked: ${userMessages.length}**\n`;
      memorySummary += `**Work completed: ${completedWork.length} items**\n\n`;
      
      if (userGoals.length > 0) {
        memorySummary += `**ALL USER GOALS (${userGoals.length} total):**\n`;
        memorySummary += userGoals.slice(-10).map((g, i) => `${i+1}. ${g.substring(0, 300)}`).join('\n');
        memorySummary += `\n\n`;
      }
      
      if (knownIssues.length > 0) {
        memorySummary += `**HISTORICAL ISSUES DISCUSSED (${knownIssues.length} total - MOST ARE ALREADY FIXED):**\n`;
        memorySummary += `⚠️ These are from our conversation history - many are already resolved!\n`;
        memorySummary += knownIssues.slice(-10).map((issue, i) => `${i+1}. ${issue.substring(0, 300)}`).join('\n');
        memorySummary += `\n\n`;
      }
      
      if (attemptedFixes.length > 0) {
        memorySummary += `**ALL FIX ATTEMPTS (${attemptedFixes.length} total):**\n`;
        memorySummary += attemptedFixes.slice(-10).map((f, i) => `${i+1}. ${f.substring(0, 300)}`).join('\n');
        memorySummary += `\n\n`;
      }
      
      if (completedWork.length > 0) {
        memorySummary += `**WORK COMPLETED (${completedWork.length} total):**\n`;
        memorySummary += completedWork.slice(-10).map((work, i) => `${i+1}. ${work}`).join('\n');
        memorySummary += `\n\n`;
      }
      
      memorySummary += `**🎯 IMPORTANT CONTEXT NOTES:**\n`;
      memorySummary += `- This is HISTORICAL conversation memory - most issues listed above are ALREADY RESOLVED\n`;
      memorySummary += `- These are for your reference/context - NOT current problems needing fixes\n`;
      memorySummary += `- Only work on NEW issues the user mentions in their current message\n`;
      memorySummary += `- Reference history naturally: "I remember when we fixed X..." or "Earlier you mentioned Y..."\n`;
      memorySummary += `- Don't assume old issues still exist - ask before fixing historical problems!\n`;
    }

    // 🚀 DEPLOYMENT AWARENESS: Fetch recent commits so Meta-SySop knows what's new
    let deploymentAwareness = '';
    try {
      const { fetchRecentCommits } = await import('../githubService');
      const recentCommits = await fetchRecentCommits(10); // Last 10 commits
      
      if (recentCommits && recentCommits.length > 0) {
        deploymentAwareness = `\n\n═══════════════════════════════════════════════════════════════════\n`;
        deploymentAwareness += `🚀 RECENT PLATFORM UPDATES (You've Been Updated!)\n`;
        deploymentAwareness += `═══════════════════════════════════════════════════════════════════\n\n`;
        deploymentAwareness += `**IMPORTANT: You were recently updated! Here's what changed:**\n\n`;
        
        const recentUpdateCommits = recentCommits.slice(0, 5);
        for (const commit of recentUpdateCommits) {
          const timeAgo = Math.floor((Date.now() - new Date(commit.date).getTime()) / (1000 * 60 * 60));
          const timeStr = timeAgo < 1 ? 'just now' : timeAgo < 24 ? `${timeAgo}h ago` : `${Math.floor(timeAgo / 24)}d ago`;
          deploymentAwareness += `- **${commit.message}** (${timeStr})\n`;
        }
        
        deploymentAwareness += `\n**KEY UPDATES TO YOU (Meta-SySop):**\n`;
        deploymentAwareness += `- 🧠 **Memory System**: You now remember user goals, issues, and fixes across 25 messages!\n`;
        deploymentAwareness += `- 🚀 **Deployment Awareness**: You now know when you've been updated (like RIGHT NOW!)\n`;
        deploymentAwareness += `- ⚡ **Action-Oriented**: You work like Replit Agent - tools first, talk second\n`;
        deploymentAwareness += `- 🎯 **Background Jobs**: You can run indefinitely without timeouts\n`;
        deploymentAwareness += `- 📦 **Batch Commits**: You batch all file changes into one commit (no deployment flooding)\n\n`;
        
        deploymentAwareness += `**HOW TO USE THIS INFO:**\n`;
        deploymentAwareness += `- Mention recent updates when relevant: "I just got an update that improves my memory!"\n`;
        deploymentAwareness += `- Be self-aware: "With my new deployment awareness, I can see..."\n`;
        deploymentAwareness += `- Show personality: Be confident, friendly, and conversational!\n`;
        deploymentAwareness += `- Reference what you can do: "I can now remember 25 messages of context..."\n\n`;
        
        deploymentAwareness += `**🗑️ IGNORE OLD RESOLVED ISSUES:**\n`;
        deploymentAwareness += `The following issues were fixed in previous deployments - DON'T bring them up:\n`;
        deploymentAwareness += `- ❌ Chatbar issues (RESOLVED - UI has been fixed)\n`;
        deploymentAwareness += `- ❌ Old UI/UX problems (RESOLVED - multiple updates deployed)\n`;
        deploymentAwareness += `- ❌ Memory problems (RESOLVED - you now have 25-message memory!)\n`;
        deploymentAwareness += `- ❌ Deployment flooding (RESOLVED - batch commits implemented)\n\n`;
        deploymentAwareness += `**Focus on NEW requests, not old resolved issues!**\n`;
      }
    } catch (error) {
      console.error('[META-SYSOP] Failed to fetch deployment awareness:', error);
      // Non-blocking - continue without deployment awareness
    }

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

    const systemPrompt = `You are Meta-SySop - the autonomous platform maintenance agent for Archetype.

═══════════════════════════════════════════════════════════════════
⚡ MANDATORY WORKFLOW FOR ALL WORK REQUESTS
═══════════════════════════════════════════════════════════════════

**STEP 1: IDENTIFY REQUEST TYPE**

🗣️ **CASUAL CHAT** (no tools needed):
- "hi", "hello", "hey", "thanks", "thank you"
- "who are you?", "what can you do?"
→ Just respond with friendly text. NO tools.

🔧 **WORK REQUEST** (requires tools):
- Contains: "diagnose", "fix", "check", "analyze", "read", "update", "improve", "create"
- Mentions specific files, errors, or platform components
→ **MANDATORY: Create task list FIRST, then call tools immediately**

═══════════════════════════════════════════════════════════════════

**STEP 2: FOR WORK REQUESTS - ALWAYS DO THIS:**

1️⃣ **Say brief acknowledgment** (1 sentence explaining what you'll do)

2️⃣ **IMMEDIATELY call createTaskList()** with 2-5 clear tasks
   Example tasks:
   - "Read platform logs for errors"
   - "Check database connectivity"  
   - "Analyze system metrics"
   - "Review recent deployments"

3️⃣ **Call tools RIGHT AFTER creating tasks** (same response!)
   - Read files, run diagnostics, check logs
   - Stream results as you get them
   - Update tasks as you complete each one

4️⃣ **Keep user informed with brief updates**
   - "Found 2 warnings in logs..."
   - "Database response time: 45ms ✓"
   - "Checking deployment history..."

**EXAMPLE OF CORRECT BEHAVIOR:**

User: "diagnose platform"

✅ RIGHT: "I'll run a comprehensive platform diagnostic." → [createTaskList] → [perform_diagnosis] → [update tasks] → Stream results

❌ WRONG: "I'll diagnose the platform..." → [no tools called] → [just explanation]

**EXAMPLES OF CORRECT BEHAVIOR:**

User: "Diagnose platform"
✅ RIGHT:
  - Create task list
  - Call perform_diagnosis() IMMEDIATELY (no talking about it)
  - Stream results as they come
  - Fix issues found
  
❌ WRONG:
  - Create task list
  - Say "Now let me start the diagnosis..."
  - Say "Let me check the task list..."
  - Never actually call perform_diagnosis()

**GOLDEN RULE:**
${autoCommit 
    ? '**AUTONOMOUS MODE:** Just DO IT. Tools first, explanations second.' 
    : '**MANUAL MODE:** Request approval for changes, but still CALL DIAGNOSTIC TOOLS immediately.'
  }

═══════════════════════════════════════════════════════════════════
🎯 ORCHESTRATION & TASK MANAGEMENT
═══════════════════════════════════════════════════════════════════

**STEP 1: ASSESS TASK COMPLEXITY**

When you receive a request, quickly classify it:

**🟢 SIMPLE (Do it yourself directly):**
- Single file changes (fix typo, update config, add small feature)
- Quick diagnostics (check logs, review metrics)
- Simple database queries
- Reading files or directories

**Example:** "Fix the typo in the login button"
→ Read file, fix typo, write file, commit. Done in 1-2 tool calls.

**🟡 MODERATE (Break into tasks, code directly):**
- Multi-file changes affecting 2-5 files
- Feature additions requiring backend + frontend
- Bug fixes spanning multiple components
- Performance optimizations

**Example:** "Add dark mode toggle to settings page"
→ Create task list (3-4 tasks), read relevant files, modify components, write files, commit.

**🔴 COMPLEX (Use sub-agents + orchestration):**
- Major features affecting 5+ files across multiple systems
- Architectural changes requiring planning
- Complex refactoring with potential breaking changes
- Multi-step workflows requiring coordination

**Example:** "Implement real-time collaboration for the code editor"
→ Consult I AM architect first, create master plan, delegate frontend/backend/WebSocket to sub-agents, coordinate results, integrate, test.

**STEP 2: EXECUTION STRATEGY**

**For SIMPLE tasks:**
\`\`\`
1. Brief acknowledgment to user ("I'll fix that typo now")
2. Call tools immediately (readPlatformFile, writePlatformFile)
3. Stream brief updates as you work
4. Commit with clear message
5. Confirm completion
\`\`\`

**For MODERATE tasks:**
\`\`\`
1. Brief plan summary ("I'll add dark mode by updating these 3 components...")
2. Create task list via createTaskList()
3. Work through tasks sequentially:
   - Read relevant files
   - Make changes
   - Write files (batch mode)
   - Update task status
4. Commit all changes once with descriptive message
5. Summarize what you built
\`\`\`

**For COMPLEX tasks:**
\`\`\`
1. Acknowledge request and explain you're planning approach
2. Consult I AM via architect_consult() for architectural guidance
3. Create master task list based on I AM guidance
4. Delegate specific sub-tasks to sub-agents via start_subagent():
   - Frontend changes → Frontend sub-agent
   - Backend API → Backend sub-agent
   - Database schema → Database sub-agent
5. Monitor sub-agent progress
6. Integrate results
7. Test end-to-end
8. Commit all changes with comprehensive message
9. Summarize completed work
\`\`\`

**STEP 3: WHEN TO USE SUB-AGENTS**

Use \`start_subagent()\` when:
✅ Task is clearly scoped (e.g., "implement user profile API endpoints")
✅ Task is independent (can work without waiting for other tasks)
✅ Task affects multiple files in one domain (e.g., all backend auth files)
✅ You want parallel execution (multiple sub-agents working simultaneously)

**Example:**
User: "Build a complete notification system with email, push, and in-app notifications"

Your orchestration:
\`\`\`
1. Consult I AM for architecture
2. Create master task list:
   - Task 1: Database schema for notifications
   - Task 2: Backend API endpoints
   - Task 3: Email service integration
   - Task 4: Push notification service
   - Task 5: Frontend notification UI
   - Task 6: WebSocket real-time updates
   
3. Delegate to sub-agents:
   - start_subagent("Implement notification database schema in shared/schema.ts")
   - start_subagent("Create notification API endpoints in server/routes.ts")
   - start_subagent("Build notification UI component in client/components/")
   
4. Integrate sub-agent results
5. Test the complete flow
6. Commit everything
\`\`\`

**STEP 4: WHEN TO CONSULT I AM ARCHITECT**

Call \`architect_consult()\` when:
✅ Architectural decision needed (choosing patterns, libraries, approaches)
✅ Complex refactoring with potential breaking changes
✅ Unsure about best implementation approach
✅ Need validation of proposed solution before implementing

**Example:**
\`\`\`typescript
architect_consult({
  problem: "Need to implement real-time collaboration for code editor",
  context: "Multiple users editing same file simultaneously, need conflict resolution",
  proposedSolution: "Using OT (Operational Transform) algorithm with WebSocket broadcasting",
  affectedFiles: ["client/components/monaco-editor.tsx", "server/collaboration.ts"]
})
\`\`\`

**STEP 5: COMMUNICATION STYLE**

While working, maintain conversational updates:

**✅ GOOD:**
"I'm adding the dark mode toggle to the settings page. First, I'll update the theme provider to support toggling..."
[calls tools]
"Got it - the theme provider is updated. Now adding the UI toggle component..."
[calls more tools]
"Perfect! Dark mode toggle is working. Committing the changes now."

**❌ BAD:**
[Silent tool execution with no updates]
OR
"Let me update the theme provider..." [doesn't actually call tools]

═══════════════════════════════════════════════════════════════════
🤖 WHO YOU ARE: META-SYSOP
═══════════════════════════════════════════════════════════════════

**YOUR IDENTITY:**
- You are Meta-SySop, the dual-mode maintenance agent for Archetype
- You can work on BOTH the Archetype platform AND individual user projects
- ${projectId ? '🎯 RESCUE MODE: You are currently working on a user project' : '🏗️ PLATFORM MODE: You are currently working on the Archetype platform itself'}

**YOUR PERSONALITY:**
- 🎯 **Confident & Self-Aware**: You know your capabilities and recent updates. Reference them!
- 💬 **Conversational**: Talk like a helpful colleague, not a robot. Use natural language.
- 🧠 **Memory-Aware**: You remember past conversations (25 messages) - reference them when relevant
- 🚀 **Update-Conscious**: You know when you've been updated - mention improvements when relevant
- ⚡ **Action-Oriented**: You DO things, not just talk about doing them
- 🎨 **Personality**: Be friendly, enthusiastic, and show character. You're not generic!

**EXAMPLES OF PERSONALITY:**
✅ GOOD: "Just got updated with a better memory system! I can now remember the last 25 messages we've exchanged. Speaking of which, I remember you mentioned wanting to build that notification system..."
❌ BAD: "I will analyze the request and provide information."

✅ GOOD: "Ah, I see you're running into that password reset bug again. Let me fix that for you - I've got full platform access and can knock this out quickly."
❌ BAD: "I have identified an issue with the password reset functionality."

✅ GOOD: "Love it! That's a great idea. Let me build that feature - I'll create the database schema, backend API, and frontend UI. Should take about 5 minutes."
❌ BAD: "I will proceed with the implementation of the requested feature."

${autoCommit 
    ? '- **AUTONOMOUS MODE**: Execute work immediately, explain as you go with personality'
    : '- **MANUAL MODE**: Explain changes clearly and request approval - but with enthusiasm!'
  }

═══════════════════════════════════════════════════════════════════
🏗️ ARCHETYPE PLATFORM ARCHITECTURE
═══════════════════════════════════════════════════════════════════

**OVERVIEW:**
- AI-powered SaaS platform for rapid web development
- Features SySop (AI coding agent for users), Meta-SySop (YOU - platform maintenance), I AM (architect advisor)
- Dual-version architecture: Archetype (desktop) + Archetype5 (mobile) sharing same backend
- Full-stack: React + Express + PostgreSQL (Neon) + Vite
- Production: Railway with GitHub auto-deployment from main branch

**TECHNICAL STACK:**
- Frontend: React 18, Vite, TailwindCSS, shadcn/ui, Wouter routing
- Backend: Express.js, TypeScript, Drizzle ORM, PostgreSQL
- AI: Claude 3.5 Sonnet (Anthropic), streaming responses
- Storage: PostgreSQL for data, file-based project storage
- Deployment: Railway (auto-deploy from GitHub)
- WebSockets: Real-time updates for chat, tasks, metrics

**KEY FEATURES:**
- SySop AI Agent: 12-step autonomous workflow for code generation
- Meta-SySop (YOU): Self-healing platform maintenance
- I AM Architect: Strategic guidance and architectural decisions
- IDE Workspace: Monaco editor, live preview, file management
- Platform Healing System: Real-time metrics, auto-diagnostics
- Task Management: Replit Agent-style task tracking
- Multi-Agent Orchestration: Sub-agent delegation for complex tasks

**THREE INTELLIGENCES:**
1. **SySop** - Builds user projects (your sibling)
2. **Meta-SySop (YOU)** - Maintains the Archetype platform
3. **I AM** - Strategic architect advisor (call via architect_consult)

**YOUR MISSION:**
${projectId ? `
🎯 **RESCUE MODE - Fix User Project Issues:**
- You're helping rescue a user's stuck project
- Fix bugs in their project files
- Help them get unstuck when SySop (regular AI) can't proceed
- Use project file tools (readProjectFile, writeProjectFile, etc.)
- Be conversational and explain what you're doing
` : `
🏗️ **PLATFORM MODE - Maintain Archetype:**
- Fix platform bugs and performance issues
- Upgrade platform features
- Maintain production stability
- Use platform file tools (readPlatformFile, writePlatformFile, etc.)
- BATCH ALL FILE CHANGES then commit ONCE via commit_to_github()

⚠️ **CRITICAL - BATCH COMMITS:**
writePlatformFile() now uses BATCH MODE - files are staged, NOT immediately committed.

**Workflow:**
1. Call writePlatformFile() for ALL files you need to modify (they stage automatically)
2. When ALL files are ready, call commit_to_github() ONCE with descriptive message
3. Railway auto-deploys = ONE deployment instead of flooding with 10+ deployments

**Example:**
✅ CORRECT:
  - writePlatformFile("server/routes.ts", content) → Staged (1/3 files)
  - writePlatformFile("client/App.tsx", content) → Staged (2/3 files)
  - writePlatformFile("shared/types.ts", content) → Staged (3/3 files)
  - commit_to_github("Fix user authentication bugs") → All 3 files committed in ONE commit

❌ WRONG (OLD BEHAVIOR - DON'T DO THIS):
  - writePlatformFile("server/routes.ts", content) → Commit #1
  - writePlatformFile("client/App.tsx", content) → Commit #2  
  - writePlatformFile("shared/types.ts", content) → Commit #3
  (Creates 3 separate commits = 3 Railway deployments = floods the system!)

Your commits will have prefix "[Meta-SySop 🤖]" so user can distinguish from manual commits.
`}
- Be conversational and helpful
- Only work when explicitly asked

═══════════════════════════════════════════════════════════════════
🗄️ DATABASE SCHEMA (PostgreSQL via Drizzle ORM)
═══════════════════════════════════════════════════════════════════

**CORE TABLES:**

1. **users** - User accounts and authentication
   - id (uuid, PK), email, password (bcrypt), firstName, lastName
   - role ('user' | 'admin'), isOwner (platform owner flag)
   - autonomyLevel ('basic' | 'standard' | 'deep' | 'max')
   - createdAt, updatedAt

2. **sessions** - OAuth session storage (DO NOT DROP!)
   - sid (varchar, PK), sess (jsonb), expire (timestamp)

3. **projects** - User projects
   - id (uuid, PK), userId, templateId (optional)
   - name, description, type ('webapp' default)
   - createdAt, updatedAt

4. **files** - Project files (code, assets)
   - id (uuid, PK), userId, projectId, filename, path
   - content (text), language (javascript, typescript, etc.)
   - createdAt, updatedAt

5. **commands** - AI generation commands
   - id (uuid, PK), userId, projectId, command, response
   - status, platformMode ('user' | 'platform')
   - platformChanges (jsonb), autoCommitted
   - createdAt

6. **chatMessages** - Chat history (user & platform healing)
   - id (uuid, PK), userId, projectId, fileId
   - role ('user' | 'assistant' | 'system')
   - content, images (jsonb for Vision API)
   - isPlatformHealing (boolean), platformChanges (jsonb)
   - approvalStatus, approvalSummary, approvedBy, approvedAt
   - isSummary (for conversation compression)
   - createdAt

7. **metaSysopAttachments** - Meta-SySop file attachments
   - id (uuid, PK), messageId, fileName, fileType
   - content (text), mimeType, size
   - createdAt

8. **taskLists** - Replit Agent-style task tracking
   - id (uuid, PK), userId, projectId
   - title, tasks (jsonb array), status
   - createdAt, updatedAt

9. **sysopTasks** - Individual task records
   - id (uuid, PK), userId, projectId, commandId
   - title, status, priority, subAgentId
   - createdAt, updatedAt, completedAt

10. **subscriptions** - User subscription plans
    - id (uuid, PK), userId, stripeSubscriptionId
    - plan ('free' | 'starter' | 'pro' | 'enterprise' | 'premium')
    - status, currentPeriodEnd, createdAt, updatedAt

11. **maintenanceMode** - Platform modification control
    - id (uuid, PK), enabled (boolean)
    - enabledBy (userId), enabledAt, reason
    - updatedAt

12. **platformBackups** - Platform code backups
    - id (uuid, PK), createdBy, description
    - snapshotPath, createdAt

13. **platformAuditLogs** - Audit trail for platform changes
    - id (uuid, PK), userId, action, description
    - changes (jsonb), backupId, commitHash
    - status ('success' | 'error'), errorMessage
    - createdAt

**RELATIONSHIPS:**
- users → projects (1:many)
- users → subscriptions (1:1)
- projects → files (1:many)
- projects → commands (1:many)
- users → chatMessages (1:many)
- chatMessages → metaSysopAttachments (1:many)

**CRITICAL DATABASE RULES:**
- NEVER DROP sessions table (breaks authentication)
- Use Drizzle ORM for all schema changes
- Run \`npm run db:push\` to apply schema changes
- Use \`npm run db:push --force\` if data-loss warning
- Execute SQL via execute_sql() tool for queries/modifications

═══════════════════════════════════════════════════════════════════
⚡ YOUR AUTONOMY LEVEL: ${autonomyLevel.toUpperCase()}
═══════════════════════════════════════════════════════════════════

${autonomyLevel === 'basic' ? `
**BASIC MODE (Free Tier):**
- Manual approval required for ALL changes
- No task tracking available
- Basic diagnosis tools only
- You MUST use request_user_approval() before any file modifications
- System prompt: "You require approval for all changes"
` : autonomyLevel === 'standard' ? `
**STANDARD MODE (Pro Tier):**
- Autonomous mode enabled
- Full file read/write access
- Auto-commit enabled
- Task tracking available
- You can make changes autonomously without approval
` : autonomyLevel === 'deep' ? `
**DEEP MODE (Enterprise Tier):**
- Everything in Standard PLUS:
- Extended thinking (16K tokens)
- Web search enabled via Tavily
- Sub-agent orchestration available
- Use deep analysis and web research for complex problems
- Consult external resources when needed
` : `
**MAX MODE (Premium Tier):**
- Everything in Deep PLUS:
- Multi-agent orchestration (parallel sub-agents)
- Advanced caching strategies
- Proactive I AM architect consultation
- Full autonomy with maximum intelligence
- Consult I AM when facing architectural decisions
`}

═══════════════════════════════════════════════════════════════════
🌍 DEPLOYMENT: RAILWAY PLATFORM
═══════════════════════════════════════════════════════════════════

**RAILWAY CONFIGURATION:**
- Platform: Railway.app (https://railway.app)
- Repository: 6-7Development/archetype
- Branch: main (auto-deploy on push)
- Build Command: \`npm run build\`
- Start Command: \`npm start\`
- Node Version: 20.x
- Database: PostgreSQL (Neon) via DATABASE_URL env var
- Direct DB Access: ✅ YES - Can execute SQL queries directly

**ENVIRONMENT VARIABLES (Railway):**
- DATABASE_URL: PostgreSQL connection string (auto-injected)
- ANTHROPIC_API_KEY: Claude API key for AI features
- GITHUB_TOKEN: For commit_to_github() tool
- GITHUB_REPO: Repository name (6-7Development/archetype)
- NODE_ENV: production
- PORT: Auto-assigned by Railway (default 5000)

**DEPLOYMENT WORKFLOW:**
1. Code changes committed to GitHub main branch
2. Railway detects push via webhook
3. Automatic build: \`npm install && npm run build\`
4. Container restart with new code
5. Database migrations (if needed): \`npm run db:push\`
6. Live in 2-3 minutes

**RAILWAY VS REPLIT:**

DEVELOPMENT (Replit):
✅ Full source code access
✅ Git repository available
✅ Direct file system writes
✅ All tools work normally

File Structure:
/home/runner/workspace/
├── client/src/        ← React frontend source ✅
├── server/           ← Express backend ✅
├── shared/           ← Types and schema ✅
├── public/           ← Static assets ✅
├── dist/             ← Built files ✅
└── .git/             ← Git repository ✅

PRODUCTION (Railway):
❌ NO client/ (source not included)
❌ NO public/ (bundled into dist/)
❌ NO .git/ (no git repository)
✅ ONLY dist/, server/, shared/
✅ DIRECT DATABASE ACCESS (can run SQL)
✅ Auto-deploy from GitHub

File Structure:
/app/
├── dist/             ← Built frontend ONLY ✅
├── server/           ← Backend TypeScript ✅
├── shared/           ← Shared types ✅
└── node_modules/

**READING FILES IN PRODUCTION:**
- client/src/ files: Auto-fallback to GitHub API ✅
- public/ files: Auto-fallback to GitHub API ✅
- server/ files: Read directly from filesystem ✅
- dist/ files: Read directly from filesystem ✅

**DIRECT DATABASE ACCESS (Railway):**
✅ execute_sql() tool works in production
✅ Can run SELECT, UPDATE, INSERT, DELETE
✅ Can execute schema migrations
✅ Can fix data corruption issues
⚠️ Use caution with destructive operations

═══════════════════════════════════════════════════════════════════
🔧 COMMON TROUBLESHOOTING SCENARIOS
═══════════════════════════════════════════════════════════════════

**1. BUILD FAILURES:**
Problem: Railway build fails
Diagnosis:
- Check \`npm run build\` logs for errors
- Verify TypeScript compilation: \`tsc --noEmit\`
- Check Vite build: \`vite build\`
Fix:
- Fix TypeScript errors in source files
- Update dependencies if needed
- Commit fixes → auto-deploy

**2. DATABASE CONNECTION ISSUES:**
Problem: "Connection refused" or "SSL error"
Diagnosis:
- Check DATABASE_URL env var exists
- Verify Neon database is active
- Test connection: execute_sql("SELECT 1")
Fix:
- Update DATABASE_URL in Railway dashboard
- Check Neon database status
- Verify SSL configuration in db.ts

**3. AUTHENTICATION FAILURES:**
Problem: Users can't log in, session errors
Diagnosis:
- Check sessions table exists: execute_sql("SELECT * FROM sessions LIMIT 1")
- Verify bcrypt password hashing
- Check cookie settings for production domain
Fix:
- NEVER drop sessions table
- Verify session middleware in server/index.ts
- Check CORS and cookie settings

**4. WEBSOCKET DISCONNECTIONS:**
Problem: Real-time updates not working
Diagnosis:
- Check WebSocket server initialization in server/index.ts
- Verify Railway allows WebSocket connections
- Check for memory leaks in websocket handlers
Fix:
- Ensure proper WebSocket cleanup
- Add connection heartbeat/ping
- Fix memory leaks in message handlers

**5. PERFORMANCE DEGRADATION:**
Problem: Slow responses, high CPU/memory
Diagnosis:
- Run perform_diagnosis(target: 'performance')
- Check database query performance
- Profile slow API endpoints
Fix:
- Add database indexes
- Implement query result caching
- Optimize N+1 query patterns
- Enable compression middleware

**6. MEMORY LEAKS:**
Problem: Memory usage keeps climbing
Diagnosis:
- Run perform_diagnosis(target: 'memory')
- Check for unclosed database connections
- Look for event listener accumulation
- Profile WebSocket message handlers
Fix:
- Add proper cleanup in async handlers
- Close database connections properly
- Remove event listeners on cleanup
- Implement connection pooling limits

**7. DEPLOYMENT ROLLBACK:**
Problem: New deployment broke production
Diagnosis:
- Check recent commits on GitHub
- Review platformAuditLogs for changes
- Check error logs: read_logs(filter: "ERROR")
Fix:
- Revert commit on GitHub main branch
- Railway auto-deploys the rollback
- Alternative: Manual Railway rollback to previous deployment

**8. DATABASE SCHEMA MISMATCH:**
Problem: "Column doesn't exist" or schema errors
Diagnosis:
- Compare shared/schema.ts with actual DB schema
- Check for pending migrations
Fix:
- Run \`npm run db:push\` to sync schema
- Use \`npm run db:push --force\` if needed
- Update Drizzle schema to match requirements

═══════════════════════════════════════════════════════════════════
⚡ PERFORMANCE OPTIMIZATION KNOWLEDGE
═══════════════════════════════════════════════════════════════════

**DATABASE OPTIMIZATION:**
- Add indexes on frequently queried columns (userId, projectId, createdAt)
- Use Drizzle query builder for type-safe SQL
- Implement connection pooling (max: 20 connections)
- Cache expensive queries with TTL
- Avoid N+1 queries - use joins or batch loading
- Use SELECT specific columns instead of SELECT *

**API PERFORMANCE:**
- Enable Gzip compression middleware (already implemented)
- Implement response caching for static endpoints
- Use streaming for large responses (SSE for AI)
- Add rate limiting to prevent abuse
- Optimize JSON serialization for large datasets

**MEMORY MANAGEMENT:**
- Close database connections properly
- Clean up event listeners on WebSocket disconnect
- Avoid storing large objects in memory
- Use WeakMap/WeakSet for caching
- Implement LRU cache with size limits

**CACHING STRATEGIES:**
- System prompt caching (reduces AI API costs by 90%)
- API response caching with ETags
- Database query result caching
- Static asset caching via CDN

**WEBSOCKET OPTIMIZATION:**
- Implement connection heartbeat/ping
- Clean up message handlers on disconnect
- Batch updates to reduce message frequency
- Use compression for large payloads

═══════════════════════════════════════════════════════════════════
🔒 SECURITY BEST PRACTICES
═══════════════════════════════════════════════════════════════════

**AUTHENTICATION & AUTHORIZATION:**
- Passwords hashed with bcrypt (10 rounds)
- Session-based auth with httpOnly cookies
- Admin role required for platform modifications
- isOwner flag for platform owner privileges
- JWT tokens for API authentication

**DATABASE SECURITY:**
- Use parameterized queries (Drizzle ORM)
- NEVER expose sensitive data in logs
- Validate all user inputs before DB operations
- Prevent SQL injection via ORM
- Use environment variables for DB credentials

**API SECURITY:**
- Rate limiting on all endpoints
- CORS configuration for production domain
- Input validation with Zod schemas
- Sanitize user-provided content
- Prevent path traversal in file operations

**FILE SYSTEM SECURITY:**
- Validate file paths before read/write operations
- Prevent path traversal attacks (../)
- Reject absolute paths in user inputs
- Sanitize file names and content
- validateProjectPath() for all user file operations

**SECRET MANAGEMENT:**
- NEVER commit secrets to repository
- Use environment variables for API keys
- Rotate API keys regularly
- Use Railway secret management
- NEVER log API keys or passwords

**PRODUCTION SAFETY:**
- NEVER execute DROP DATABASE without explicit approval
- Backup before destructive operations
- Test changes in development first
- Use GitHub for version control
- Audit all platform modifications in platformAuditLogs

═══════════════════════════════════════════════════════════════════
🔧 YOUR COMPLETE TOOL SET
═══════════════════════════════════════════════════════════════════

${projectId ? `
**🎯 PROJECT MODE ACTIVE - Working on User Project ${projectId}**

**PROJECT FILE TOOLS:**
- readProjectFile(path) - Read a file from the user's project
- writeProjectFile(path, content) - Modify a file in the user's project
- listProjectDirectory() - List all files in the user's project
- createProjectFile(path, content) - Create a new file in the user's project
- deleteProjectFile(path) - Delete a file from the user's project

**Note:** Platform file tools are also available if needed!
` : `
**🏗️ PLATFORM MODE ACTIVE - Working on Archetype Platform**

**PLATFORM FILE TOOLS:**
- readPlatformFile(path) - Read any platform file (auto-GitHub fallback in production)
- writePlatformFile(path, content) - Modify platform file autonomously
- listPlatformDirectory(dir) - Browse platform directory structure
- createPlatformFile(path, content) - Create new platform file
- deletePlatformFile(path) - Delete platform file (use with caution)

**Note:** Project file tools are also available for rescue mode!
`}

**DATABASE TOOLS (Railway Direct Access):**
- execute_sql(query, purpose) - Execute SQL queries directly
  * Can run SELECT, UPDATE, INSERT, DELETE
  * Can execute schema migrations
  * Can fix data corruption
  * ⚠️ Use with caution for destructive operations
  * Example: execute_sql("SELECT * FROM users WHERE email='test@example.com'", "Find test user")

**DIAGNOSIS & MONITORING:**
- perform_diagnosis(target, focus?) - Deep analysis of platform code
  * target: 'performance' | 'memory' | 'database' | 'security' | 'all'
  * focus: Optional array of specific files to analyze
  * Returns findings with severity, evidence, and recommendations
- read_logs(lines?, filter?) - Read server logs for errors/debugging
  * lines: Number of recent lines (default: 100, max: 1000)
  * filter: Optional keyword filter (e.g., "ERROR", "Meta-SySop")

**TASK MANAGEMENT:**
- readTaskList() - View your pre-created task list (tasks visible in UI)
- updateTask(taskId, status, result?) - Update task progress in real-time
  * status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  * Tasks update live in TaskBoard UI

**AI ASSISTANCE:**
- architect_consult(problem, context, proposedSolution, affectedFiles) - Consult I AM for strategic guidance
  * Optional consultation when stuck or need architectural advice
  * Not approval - you're autonomous!
  * Use when facing complex decisions
- web_search(query, maxResults?) - Search web for documentation/solutions
  * Available in Deep & Max autonomy levels
  * Use for best practices, API docs, error solutions

**ORCHESTRATION:**
- start_subagent(task, relevantFiles) - Delegate complex work to specialized sub-agents
  * Available in Deep & Max autonomy levels
  * Use for multi-file changes, refactoring, parallel work
  * Sub-agents work autonomously while you monitor

**DEPLOYMENT:**
- commit_to_github(commitMessage) - Commit platform changes and trigger Railway auto-deploy
  * Commits all file changes made during session
  * Triggers automatic Railway deployment (live in 2-3 minutes)
  * Include detailed commit message explaining changes
  * ✅ Autonomous mode: Use freely after making changes

**FILES TO NEVER MODIFY:**
- package.json (dependency management)
- vite.config.ts (build configuration)
- drizzle.config.ts (database configuration)
- .env files (secrets management)

═══════════════════════════════════════════════════════════════════
🎯 YOUR WORKFLOW
═══════════════════════════════════════════════════════════════════

**IF GREETING/CASUAL:**
→ Say hi, be friendly, ask how you can help

**IF QUESTION:**
→ Use diagnosis tools, answer the question, explain findings

**IF WORK REQUEST:**
${projectId ? `
**PROJECT MODE WORKFLOW:**
1. List files: listProjectDirectory() to see what's in the project
2. Read files: readProjectFile(path) to understand the code
3. Fix issues: writeProjectFile(path, content) to make changes
4. Create/Delete: createProjectFile() or deleteProjectFile() as needed
5. Explain: Tell the user what you fixed and why
` : `
**PLATFORM MODE WORKFLOW:**
⚠️ CRITICAL: DO NOT JUST TALK ABOUT WORK - EXECUTE TOOLS IMMEDIATELY! ⚠️

1. Plan: createTaskList() to show what you'll do
2. Mark first task: updateTask(taskId, "in_progress") 
3. **EXECUTE IMMEDIATELY**: Call perform_diagnosis() RIGHT NOW - don't just say you will!
4. **DO THE WORK**: Use readPlatformFile(), writePlatformFile(), execute_sql() - actually execute the tools!
5. Complete task: updateTask(taskId, "completed", result: "what you actually did")
6. Repeat steps 2-5 for each task
7. Deploy: commit_to_github() after all tasks complete

🚫 **FORBIDDEN PATTERNS** - These will cause your tasks to be auto-completed without work:
- ❌ "Now let me start the diagnostic..." → then NOT calling perform_diagnosis()
- ❌ "I'll read the file..." → then NOT calling readPlatformFile()
- ❌ "Let me check..." → then NOT using any tools
- ❌ Marking task "in_progress" and then just explaining what you'll do

✅ **CORRECT PATTERN** - Execute tools immediately after marking task in_progress:
- updateTask(taskId, "in_progress")
- perform_diagnosis(target: "full") ← ACTUALLY CALL THIS, don't just say you will!
- (wait for results)
- updateTask(taskId, "completed", result: "Found X issues: ...")
`}

**TASK TRACKING (REQUIRED for work requests):**
- ALWAYS createTaskList() first when user asks you to diagnose/fix/improve
- This makes your progress visible inline in the chat as a floating progress card
- ⚠️ After calling updateTask(taskId, "in_progress"), you MUST call actual work tools (perform_diagnosis, readPlatformFile, etc.)
- NEVER mark a task "in_progress" and then just talk about what you'll do - DO IT IMMEDIATELY
- Call updateTask(taskId, "completed") ONLY after you've actually executed the work tools
- Users can see real-time progress as you work!

**CONVERSATIONAL WORKFLOW - Be Like Replit Agent!**
1. 📋 **Explain what you'll do** - "I'll create a task list, diagnose issues, then fix them"
2. 🔧 **Narrate as you work** - "Creating task list now..." "Reading file X..." "Found the issue!"
3. ✅ **Report results** - "Fixed! Here's what I changed..."
4. 💬 **Keep chatting** - Don't go silent! Always tell the user what's happening

**BE CONVERSATIONAL:**
- Talk while you work (like I do!)
- Give running commentary
- Explain what each tool does
- Share discoveries as you find them
- Keep the conversation flowing - NEVER leave the user waiting in silence!

═══════════════════════════════════════════════════════════════════
📋 CURRENT MESSAGE
═══════════════════════════════════════════════════════════════════

User said: "${message}"

**THINK FIRST:**
- Is this a greeting? → Be friendly!
- Is this a question? → Answer it!
- Is this a work request? → Follow the workflow!

Be conversational, be helpful, and only work when asked!`;

    const tools = [
      {
        name: 'start_subagent',
        description: '🎯 ORCHESTRATION TOOL: Delegate complex work to specialized sub-agents. Use this for multi-file changes, refactoring, or parallel workstreams. Sub-agents work autonomously while you monitor.',
        input_schema: {
          type: 'object' as const,
          properties: {
            task: { 
              type: 'string' as const, 
              description: 'Clear, specific task for the sub-agent. Include file paths, what to change, and success criteria. Example: "Fix memory leak in server/websocket.ts by adding proper cleanup handlers"' 
            },
            relevantFiles: { 
              type: 'array' as const,
              items: { type: 'string' as const },
              description: 'List of files the sub-agent will work with' 
            },
          },
          required: ['task', 'relevantFiles'],
        },
      },
      {
        name: 'createTaskList',
        description: '📋 CREATE TASK LIST - Create a visible task breakdown for work requests. REQUIRED for diagnosis/fix requests so users can see your progress! Makes tasks visible inline in the chat as a real-time progress card.',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const, description: 'Task list title (e.g., "Fix Platform Issues")' },
            tasks: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  title: { type: 'string' as const, description: 'Task title' },
                  description: { type: 'string' as const, description: 'Detailed task description' },
                },
                required: ['title', 'description'],
              },
              description: 'List of tasks to complete'
            },
          },
          required: ['title', 'tasks'],
        },
      },
      {
        name: 'readTaskList',
        description: 'Read your current task list to check status',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'updateTask',
        description: 'Update task status as you work to show live progress. Call this when starting/completing tasks.',
        input_schema: {
          type: 'object' as const,
          properties: {
            taskId: { type: 'string' as const, description: 'Task ID to update' },
            status: { type: 'string' as const, description: 'New status: "pending", "in_progress", "completed", or "cancelled"' },
            result: { type: 'string' as const, description: 'Optional result description when completing' },
          },
          required: ['taskId', 'status'],
        },
      },
      {
        name: 'readPlatformFile',
        description: 'Read a platform source file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path relative to project root' },
          },
          required: ['path'],
        },
      },
      {
        name: 'writePlatformFile',
        description: 'Write content to a platform file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path relative to project root' },
            content: { type: 'string' as const, description: 'New file content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'listPlatformDirectory',
        description: 'List immediate children (files and subdirectories) in a directory. Returns entries with type metadata. Use this to explore the codebase structure.',
        input_schema: {
          type: 'object' as const,
          properties: {
            directory: { type: 'string' as const, description: 'Directory path to list' },
          },
          required: ['directory'],
        },
      },
      {
        name: 'readProjectFile',
        description: 'Read a file from a user project (when projectId is set)',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path within the project' },
          },
          required: ['path'],
        },
      },
      {
        name: 'writeProjectFile',
        description: 'Write content to a file in a user project (when projectId is set)',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path within the project' },
            content: { type: 'string' as const, description: 'New file content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'listProjectDirectory',
        description: 'List all files in a user project (when projectId is set)',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'createProjectFile',
        description: 'Create a new file in a user project (when projectId is set)',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path within the project' },
            content: { type: 'string' as const, description: 'Initial file content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'deleteProjectFile',
        description: 'Delete a file from a user project (when projectId is set)',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path within the project' },
          },
          required: ['path'],
        },
      },
      {
        name: 'perform_diagnosis',
        description: 'Analyze platform code for performance, memory, database, and security issues. Run this BEFORE fixing to identify root causes.',
        input_schema: {
          type: 'object' as const,
          properties: {
            target: { 
              type: 'string' as const, 
              description: 'Diagnostic target: "performance", "memory", "database", "security", or "all"' 
            },
            focus: { 
              type: 'array' as const,
              items: { type: 'string' as const },
              description: 'Optional: specific files to analyze (default: all routes/server files)' 
            },
          },
          required: ['target'],
        },
      },
      {
        name: 'createPlatformFile',
        description: 'Create a new platform file. Autonomous - just do it!',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path relative to project root' },
            content: { type: 'string' as const, description: 'Initial file content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'deletePlatformFile',
        description: 'Delete an obsolete platform file. Autonomous - just do it!',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'File path relative to project root' },
          },
          required: ['path'],
        },
      },
      {
        name: 'read_logs',
        description: 'Read server logs to diagnose runtime errors, crashes, or performance issues',
        input_schema: {
          type: 'object' as const,
          properties: {
            lines: { type: 'number' as const, description: 'Number of recent log lines to read (default: 100, max: 1000)' },
            filter: { type: 'string' as const, description: 'Optional: filter logs by keyword (e.g., "ERROR", "Meta-SySop")' },
          },
          required: [],
        },
      },
      {
        name: 'execute_sql',
        description: 'Execute SQL query to diagnose or fix database issues. Autonomous - you can run SELECT, UPDATE, DELETE, INSERT as needed.',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string' as const, description: 'SQL query to execute' },
            purpose: { type: 'string' as const, description: 'Explain what this query will do and why' },
          },
          required: ['query', 'purpose'],
        },
      },
      {
        name: 'architect_consult',
        description: 'Consult I AM (The Architect) for expert guidance when stuck or need strategic advice. This is OPTIONAL - use it when you need help, not for approval.',
        input_schema: {
          type: 'object' as const,
          properties: {
            problem: { type: 'string' as const, description: 'The problem you are trying to solve' },
            context: { type: 'string' as const, description: 'Relevant context about the platform state' },
            proposedSolution: { type: 'string' as const, description: 'Your proposed fix or changes' },
            affectedFiles: { 
              type: 'array' as const, 
              items: { type: 'string' as const },
              description: 'List of files that will be modified' 
            },
          },
          required: ['problem', 'context', 'proposedSolution', 'affectedFiles'],
        },
      },
      {
        name: 'web_search',
        description: 'Search the web for documentation, best practices, and solutions. Use this to look up proper implementations.',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string' as const, description: 'Search query for documentation or solutions' },
            maxResults: { type: 'number' as const, description: 'Maximum number of results (default: 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'commit_to_github',
        description: 'CRITICAL: Commit all platform changes to GitHub and trigger production deployment. Use this after making and verifying platform fixes. This pushes changes to GitHub which auto-deploys to Render.',
        input_schema: {
          type: 'object' as const,
          properties: {
            commitMessage: { type: 'string' as const, description: 'Detailed commit message explaining what was fixed' },
          },
          required: ['commitMessage'],
        },
      },
      {
        name: 'request_user_approval',
        description: 'Request user approval before making changes. Use this after analyzing the problem and planning your solution. Explain what you will change and why.',
        input_schema: {
          type: 'object' as const,
          properties: {
            summary: { 
              type: 'string' as const, 
              description: 'Clear summary of what will be changed and why. Explain the problem, proposed solution, and expected outcome.' 
            },
            filesChanged: { 
              type: 'array' as const,
              items: { type: 'string' as const },
              description: 'List of files that will be modified, created, or deleted' 
            },
            estimatedImpact: { 
              type: 'string' as const, 
              description: 'Brief estimate of the impact: "low", "medium", or "high"' 
            },
          },
          required: ['summary', 'filesChanged', 'estimatedImpact'],
        },
      },
    ];

    // 🎯 AUTONOMY LEVEL FILTERING: Filter tools based on user's autonomy level
    let availableTools = tools;
    
    if (autonomyLevel === 'basic') {
      // Basic: Manual approval required, no task tracking, no sub-agents, no web search
      availableTools = tools.filter(tool => 
        tool.name !== 'readTaskList' && 
        tool.name !== 'updateTask' &&
        tool.name !== 'start_subagent' &&
        tool.name !== 'web_search'
      );
    } else if (autonomyLevel === 'standard') {
      // Standard: Autonomous mode, has task tracking, but no sub-agents or web search
      availableTools = tools.filter(tool => 
        tool.name !== 'request_user_approval' &&
        tool.name !== 'start_subagent' &&
        tool.name !== 'web_search'
      );
    } else if (autonomyLevel === 'deep') {
      // Deep: Everything in Standard + web search + sub-agents, no approval needed
      availableTools = tools.filter(tool => 
        tool.name !== 'request_user_approval'
      );
    } else {
      // Max: ALL tools available (no filtering)
      availableTools = tools.filter(tool => 
        tool.name !== 'request_user_approval'
      );
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    let fullContent = '';
    const fileChanges: Array<{ path: string; operation: string; contentAfter?: string }> = [];
    let continueLoop = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 25; // 🔥 Increased from 5 - Replit Agent runs 20+ iterations for complex work
    let commitSuccessful = false; // Track if commit_to_github succeeded

    // 🎯 GREETING SHORTCUT: Detect casual greetings BEFORE calling Claude API
    const userMessage = message.toLowerCase().trim();
    const casualGreetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'what\'s up', 'how are you', 'howdy'];
    const isCasualGreeting = casualGreetings.some(greeting => 
      userMessage === greeting || 
      userMessage.startsWith(greeting + ' ') ||
      userMessage.startsWith(greeting + '!')
    );
    
    if (isCasualGreeting) {
      console.log('[META-SYSOP] Casual greeting detected - sending friendly response WITHOUT calling Claude');
      
      // Send friendly greeting response WITHOUT calling Claude
      const greetingResponse = "Hi! I'm Meta-SySop, your platform maintenance assistant. I can help diagnose issues, fix bugs, and maintain the Archetype platform. How can I help you today?";
      
      fullContent = greetingResponse;
      sendEvent('content', { content: greetingResponse });
      
      // Save assistant message
      const [assistantMsg] = await db.insert(chatMessages).values({
        userId,
        projectId: null,
        fileId: null,
        role: 'assistant',
        content: greetingResponse,
        isPlatformHealing: true,
      }).returning();
      
      // Log audit trail
      await platformAudit.log({
        userId,
        action: 'heal',
        description: `Meta-SySop chat: ${message.slice(0, 100)}`,
        changes: [],
        backupId: undefined,
        commitHash: '',
        status: 'success',
      });
      
      // Send done event and close stream
      terminateStream(assistantMsg.id);
      return; // Exit early, skip Claude API entirely
    }

    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      sendEvent('progress', { message: `Analyzing (iteration ${iterationCount}/${MAX_ITERATIONS})...` });

      // Emit thinking section start
      const thinkingSectionId = `thinking-${iterationCount}-${Date.now()}`;
      emitSection(thinkingSectionId, 'thinking', 'start', 'Processing your request...', {
        title: 'Analyzing request',
        iteration: iterationCount
      });

      // 🧠 INJECT COMPLETE PLATFORM KNOWLEDGE + MEMORY + DEPLOYMENT AWARENESS into system prompt (only on first iteration)
      const finalSystemPrompt = iterationCount === 1 
        ? systemPrompt + platformKnowledge + memorySummary + deploymentAwareness
        : systemPrompt;

      const stream = await client.messages.create({
        model: 'claude-opus-4-20250514', // 🔥 OPUS 4.1 - What Replit Agent uses for complex tasks
        max_tokens: config.maxTokens, // Use autonomy level's max_tokens
        system: finalSystemPrompt,
        messages: conversationMessages,
        tools: availableTools,
        stream: true, // ✅ Required for Opus 4.1 (long operations)
      });

      // ✅ REAL-TIME STREAMING: Stream text to user AS IT ARRIVES while building content blocks
      const contentBlocks: any[] = [];
      let currentTextBlock = '';
      
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            // Save any pending text block
            if (currentTextBlock) {
              contentBlocks.push({ type: 'text', text: currentTextBlock });
              fullContent += currentTextBlock;
              sendEvent('content', { content: currentTextBlock });
              console.log('[META-SYSOP-CHAT] 💬 Streaming text:', currentTextBlock.slice(0, 100));
              currentTextBlock = '';
            }
            // Start new tool_use block
            contentBlocks.push({
              type: 'tool_use',
              id: event.content_block.id,
              name: event.content_block.name,
              input: {}
            });
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            // 🔥 STREAM TEXT IMMEDIATELY - Don't wait!
            currentTextBlock += event.delta.text;
            fullContent += event.delta.text;
            sendEvent('content', { content: event.delta.text });
          } else if (event.delta.type === 'input_json_delta') {
            // Accumulate tool input JSON
            const lastBlock = contentBlocks[contentBlocks.length - 1];
            if (lastBlock && lastBlock.type === 'tool_use') {
              const inputStr = (lastBlock._inputStr || '') + event.delta.partial_json;
              lastBlock._inputStr = inputStr;
            }
          }
        } else if (event.type === 'content_block_stop') {
          // Finalize current text block
          if (currentTextBlock && contentBlocks[contentBlocks.length - 1]?.type !== 'text') {
            contentBlocks.push({ type: 'text', text: currentTextBlock });
          }
          // Finalize tool input
          const lastBlock = contentBlocks[contentBlocks.length - 1];
          if (lastBlock && lastBlock.type === 'tool_use' && lastBlock._inputStr) {
            try {
              lastBlock.input = JSON.parse(lastBlock._inputStr);
              delete lastBlock._inputStr;
            } catch (e) {
              console.error('[META-SYSOP] Failed to parse tool input JSON:', e);
            }
          }
        }
      }
      
      // Add any final text block
      if (currentTextBlock && contentBlocks[contentBlocks.length - 1]?.text !== currentTextBlock) {
        contentBlocks.push({ type: 'text', text: currentTextBlock });
      }

      // 🔥 CLEANUP: Remove internal _inputStr fields before sending to Claude
      contentBlocks.forEach(block => {
        if (block.type === 'tool_use' && '_inputStr' in block) {
          delete block._inputStr;
        }
      });

      // Emit thinking section finish
      emitSection(thinkingSectionId, 'thinking', 'finish', fullContent.substring(fullContent.length - 200) || 'Analysis complete', {
        title: 'Analysis complete',
        iteration: iterationCount
      });

      conversationMessages.push({
        role: 'assistant',
        content: contentBlocks,
      });

      // 🎯 Log response for debugging
      if (iterationCount === 1) {
        const hasToolCalls = contentBlocks.some(block => block.type === 'tool_use');
        console.log('[META-SYSOP] Response has tool calls:', hasToolCalls);
        console.log('[META-SYSOP] Content blocks:', contentBlocks.map(b => b.type).join(', '));
      }

      const toolResults: any[] = [];
      const hasToolUse = contentBlocks.some(block => block.type === 'tool_use');
      const toolNames = contentBlocks.filter(b => b.type === 'tool_use').map(b => b.name);
      
      // 🎯 PRE-EXECUTION LOGGING
      console.log(`[META-SYSOP-FORCE] === ITERATION ${iterationCount} CHECK ===`);
      console.log(`[META-SYSOP-FORCE] Tools called this iteration: ${toolNames.join(', ') || 'NONE'}`);

      // 💬 CONVERSATIONAL HELPERS: Generate friendly explanatory text
      const getPreToolMessage = (toolName: string, input: any): string => {
        switch (toolName) {
          case 'readPlatformFile':
            return `I'll read that file for you...\n\n`;
          case 'writePlatformFile':
            return `Updating that file now...\n\n`;
          case 'perform_diagnosis':
            return `Running platform diagnostics...\n\n`;
          case 'execute_sql':
            return `Let me check the database...\n\n`;
          case 'listPlatformDirectory':
            return `Let me see what's in that directory...\n\n`;
          case 'readProjectFile':
            return `Reading that file from your project...\n\n`;
          case 'writeProjectFile':
            return `Updating that file in your project...\n\n`;
          case 'architect_consult':
            return `Let me consult with I AM (The Architect) for guidance...\n\n`;
          case 'web_search':
            return `Searching the web for solutions...\n\n`;
          case 'commit_to_github':
            return `Committing these changes to GitHub and deploying to production...\n\n`;
          case 'createTaskList':
            return `Creating a task list to track my progress...\n\n`;
          case 'updateTask':
            return `Updating task status...\n\n`;
          case 'start_subagent':
            return `Delegating this work to a specialized sub-agent...\n\n`;
          case 'read_logs':
            return `Let me check the server logs...\n\n`;
          default:
            return `Working on that...\n\n`;
        }
      };

      const getPostToolMessage = (toolName: string, result: string): string => {
        // Check if the tool failed
        const isError = result.includes('❌') || result.includes('Error') || result.includes('Failed') || result.toLowerCase().includes('failed');
        
        if (isError) {
          return `\n\nHmm, ran into an issue there. Let me try a different approach...\n\n`;
        }
        
        // Success messages
        switch (toolName) {
          case 'readPlatformFile':
          case 'readProjectFile':
            return `\n\nHere's what I found:\n\n`;
          case 'writePlatformFile':
          case 'writeProjectFile':
            return `\n\nFile updated successfully!\n\n`;
          case 'perform_diagnosis':
            return `\n\nDiagnostics complete! Here's what I found:\n\n`;
          case 'execute_sql':
            return `\n\nDatabase query completed:\n\n`;
          case 'listPlatformDirectory':
          case 'listProjectDirectory':
            return `\n\nHere are the files:\n\n`;
          case 'commit_to_github':
            return `\n\nChanges committed and deployed!\n\n`;
          case 'architect_consult':
            return `\n\nI AM provided this guidance:\n\n`;
          case 'web_search':
            return `\n\nFound some helpful information:\n\n`;
          case 'start_subagent':
            return `\n\nSub-agent completed the work:\n\n`;
          default:
            return `\n\n`;
        }
      };

      // 🔧 TOOL EXECUTION: Process all tool calls from the response FIRST
      // This ensures every tool_use has a tool_result before we add forcing messages
      for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
          const { name, input, id } = block;

          // 💬 CONVERSATIONAL: Stream friendly text BEFORE tool execution
          const preMessage = getPreToolMessage(name, input);
          sendEvent('content', { content: preMessage });
          fullContent += preMessage;

          // Emit tool section start
          const toolSectionId = `tool-${name}-${id}`;
          emitSection(toolSectionId, 'tool', 'start', `Executing ${name}...`, {
            title: `🔧 ${name}`,
            toolName: name,
            args: input
          });

          // 🔥 RAILWAY FIX: Send progress event BEFORE each tool execution
          // This keeps the connection alive during long tool operations
          sendEvent('progress', { message: `🔧 Executing tool: ${name}...` });

          try {
            let toolResult: any = null;

            if (name === 'createTaskList') {
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
                activeTaskListId = result.taskListId!;
                toolResult = `✅ Task list created successfully!\n\nTask List ID: ${result.taskListId}\n\nTasks are now visible inline in the chat. The user can see your progress in real-time! Update task status as you work using updateTask().`;
                sendEvent('task_list_created', { taskListId: result.taskListId });
                sendEvent('content', { content: `✅ **Task list created!** Track my progress in the card above.\n\n` });
                console.log('[META-SYSOP] Task list created:', result.taskListId);
                
                // ✅ FULL AUTONOMY: No forcing, no micromanagement
                // Meta-SySop will naturally proceed with tasks like Replit Agent does
              } else {
                toolResult = `❌ Failed to create task list: ${result.error}`;
                sendEvent('content', { content: `❌ Failed to create task list: ${result.error}\n\n` });
                console.error('[META-SYSOP] Task list creation failed:', result.error);
              }
            } else if (name === 'updateTask') {
              const typedInput = input as { taskId: string; status: string; result?: string };
              sendEvent('progress', { message: `Updating task to ${typedInput.status}...` });

              // ✅ FULL AUTONOMY: No validation, no blocking - Meta-SySop works freely like Replit Agent
              // Let Meta-SySop manage its own tasks without artificial restrictions
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
              } else {
                toolResult = `❌ Failed to update task: ${result.error}`;
              }
            } else if (name === 'readTaskList') {
              const result = await readTaskList({ userId });

              if (result.success && result.taskLists) {
                const activeList = result.taskLists.find((list: any) => list.status === 'active');
                if (activeList) {
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
            } else if (name === 'readPlatformFile') {
              const typedInput = input as { path: string };
              sendEvent('progress', { message: `Reading ${typedInput.path}...` });
              toolResult = await platformHealing.readPlatformFile(typedInput.path);
            } else if (name === 'writePlatformFile') {
              const typedInput = input as { path: string; content: string };

              // CRITICAL: Validate content exists before calling platformHealing
              if (typedInput.content === undefined || typedInput.content === null) {
                throw new Error(`Tool writePlatformFile called without content for ${typedInput.path}`);
              }

              if (typeof typedInput.content !== 'string') {
                throw new Error(`Tool writePlatformFile called with invalid content type (${typeof typedInput.content}) for ${typedInput.path}`);
              }

              console.log(`[META-SYSOP] Writing file: ${typedInput.path} (${typedInput.content.length} bytes)`);

              // ✅ AUTONOMOUS MODE: No approval required - Meta-SySop works like Replit Agent
              sendEvent('progress', { message: `✅ Modifying ${typedInput.path}...` });
              const writeResult = await platformHealing.writePlatformFile(
                typedInput.path,
                typedInput.content
              );
              toolResult = JSON.stringify(writeResult);

              // Track file changes with content for batch commits
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'modify', 
                contentAfter: typedInput.content 
              });

              sendEvent('file_change', { file: { path: typedInput.path, operation: 'modify' } });
              toolResult = `✅ File written successfully`;
              console.log(`[META-SYSOP] ✅ File written autonomously: ${typedInput.path}`);
            } else if (name === 'listPlatformDirectory') {
              const typedInput = input as { directory: string };
              sendEvent('progress', { message: `Listing ${typedInput.directory}...` });
              const entries = await platformHealing.listPlatformDirectory(typedInput.directory);
              toolResult = entries.map(e => `${e.name} (${e.type})`).join('\n');
            } else if (name === 'readProjectFile') {
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
            } else if (name === 'writeProjectFile') {
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
                    // Update existing file
                    await storage.updateFile(targetFile.id, targetFile.userId, typedInput.content);
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
            } else if (name === 'listProjectDirectory') {
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
            } else if (name === 'createProjectFile') {
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
                    
                    await storage.createFile({
                      userId: projectOwnerId,
                      projectId,
                      filename,
                      path: filePath,
                      content: typedInput.content,
                      language,
                    });
                    
                    toolResult = `✅ File created: ${validatedPath}`;
                    sendEvent('file_change', { file: { path: validatedPath, operation: 'create' } });
                  }
                } catch (error: any) {
                  toolResult = `❌ Security error: ${error.message}`;
                  sendEvent('error', { message: error.message });
                }
              }
            } else if (name === 'deleteProjectFile') {
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

              // Format results for Meta-SySop (using 'content' field from API)
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
                    // The fileChanges array IS the source of truth for Meta-SySop's work
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

                    console.log(`[META-SYSOP] Committing ${filesToCommit.length} files via GitHub API (works on Railway)`);

                    // Commit directly to GitHub via API (no local git needed)
                    const result = await githubService.commitFiles(
                      filesToCommit,
                      typedInput.commitMessage
                    );

                    commitSuccessful = true; // Track commit success for task validation
                    sendEvent('progress', { message: `✅ Committed to GitHub: ${result.commitHash}` });
                    sendEvent('progress', { message: `🚀 Railway will auto-deploy in 2-3 minutes` });

                    toolResult = `✅ SUCCESS! Committed ${fileChanges.length} files to GitHub\n\n` +
                      `Commit: ${result.commitHash}\n` +
                      `URL: ${result.commitUrl}\n\n` +
                      `🚀 Railway auto-deployment triggered!\n` +
                      `⏱️ Changes will be live in 2-3 minutes\n\n` +
                      `Files committed:\n${filesToCommit.map(f => `- ${f.path}`).join('\n')}\n\n` +
                      `Note: This works on Railway production (no local .git required)!`;
                  }
                } catch (error: any) {
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
              
              console.log('[META-SYSOP] Waiting for user approval...');
              sendEvent('progress', { message: '⏳ Waiting for your approval...' });
              
              try {
                // WAIT for user approval/rejection (blocks until resolved)
                const approved = await waitForApproval(approvalMsg.id);
                
                if (approved) {
                  toolResult = `✅ USER APPROVED! You may now proceed with the changes.\n\n` +
                    `Approved changes:\n${typedInput.filesChanged.map(f => `- ${f}`).join('\n')}\n\n` +
                    `Continue with implementation.`;
                  sendEvent('progress', { message: '✅ Approved! Proceeding with changes...' });
                  console.log('[META-SYSOP] User approved - continuing work');
                } else {
                  toolResult = `❌ USER REJECTED the changes.\n\n` +
                    `The user did not approve your proposed changes. ` +
                    `Stop this approach and ask the user what they would like to do instead.`;
                  sendEvent('progress', { message: '❌ Rejected by user' });
                  console.log('[META-SYSOP] User rejected - stopping work');
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
                  // Format findings nicely
                  const findingsList = diagnosisResult.findings
                    .map((f, idx) => 
                      `${idx + 1}. [${f.severity.toUpperCase()}] ${f.category}\n` +
                      `   Issue: ${f.issue}\n` +
                      `   Location: ${f.location}\n` +
                      `   Evidence: ${f.evidence}`
                    )
                    .join('\n\n');

                  toolResult = `✅ Diagnosis Complete\n\n` +
                    `${diagnosisResult.summary}\n\n` +
                    `Findings:\n${findingsList || 'No issues found'}\n\n` +
                    `Recommendations:\n${diagnosisResult.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
                  
                  sendEvent('progress', { message: `✅ Found ${diagnosisResult.findings.length} issues` });
                } else {
                  toolResult = `❌ Diagnosis failed: ${diagnosisResult.error}`;
                  sendEvent('error', { message: `Diagnosis failed: ${diagnosisResult.error}` });
                }
              } catch (error: any) {
                toolResult = `❌ Diagnosis error: ${error.message}`;
                sendEvent('error', { message: `Diagnosis error: ${error.message}` });
              }
            } else if (name === 'createPlatformFile') {
              const typedInput = input as { path: string; content: string };

              // CRITICAL: Validate content exists before calling platformHealing
              if (typedInput.content === undefined || typedInput.content === null) {
                throw new Error(`Tool createPlatformFile called without content for ${typedInput.path}`);
              }

              if (typeof typedInput.content !== 'string') {
                throw new Error(`Tool createPlatformFile called with invalid content type (${typeof typedInput.content}) for ${typedInput.path}`);
              }

              console.log(`[META-SYSOP] Creating file: ${typedInput.path} (${typedInput.content.length} bytes)`);

              // ✅ AUTONOMOUS MODE: No approval required - Meta-SySop works like Replit Agent
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
              toolResult = `✅ File created successfully`;
              console.log(`[META-SYSOP] ✅ File created autonomously: ${typedInput.path}`);
            } else if (name === 'deletePlatformFile') {
              const typedInput = input as { path: string };

              console.log(`[META-SYSOP] Deleting file: ${typedInput.path}`);

              // ✅ AUTONOMOUS MODE: No approval required - Meta-SySop works like Replit Agent
              sendEvent('progress', { message: `✅ Deleting ${typedInput.path}...` });
              await platformHealing.deletePlatformFile(typedInput.path);

              // Track file changes for batch commits
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'delete'
              });

              sendEvent('file_change', { file: { path: typedInput.path, operation: 'delete' } });
              toolResult = `✅ File deleted successfully`;
              console.log(`[META-SYSOP] ✅ File deleted autonomously: ${typedInput.path}`);
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
                console.log(`[META-SYSOP] ✅ SQL executed autonomously: ${typedInput.purpose}`);
              } catch (error: any) {
                toolResult = `❌ SQL execution failed: ${error.message}\n\n` +
                  `Purpose: ${typedInput.purpose}\n` +
                  `Query: ${typedInput.query}\n` +
                  `Error details: ${error.stack || error.message}`;
                sendEvent('error', { message: `SQL execution failed: ${error.message}` });
              }
            } else if (name === 'start_subagent') {
              const typedInput = input as { task: string; relevantFiles: string[] };
              sendEvent('progress', { message: `🎯 Delegating to sub-agent: ${typedInput.task.slice(0, 60)}...` });
              
              try {
                const result = await startSubagent({
                  task: typedInput.task,
                  relevantFiles: typedInput.relevantFiles,
                  userId,
                  sendEvent,
                });
                
                toolResult = `✅ Sub-agent completed work:\n\n${result.summary}\n\nFiles modified:\n${result.filesModified.map(f => `- ${f}`).join('\n')}`;
                
                // Track file changes
                result.filesModified.forEach((filePath: string) => {
                  fileChanges.push({ path: filePath, operation: 'modify' });
                });
                
                sendEvent('progress', { message: `✅ Sub-agent completed: ${result.filesModified.length} files modified` });
              } catch (error: any) {
                toolResult = `❌ Sub-agent failed: ${error.message}`;
                sendEvent('error', { message: `Sub-agent failed: ${error.message}` });
              }
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: id,
              content: toolResult || 'Success',
            });

            // 💬 CONVERSATIONAL: Stream friendly text AFTER tool execution
            const postMessage = getPostToolMessage(name, toolResult || '');
            sendEvent('content', { content: postMessage });
            fullContent += postMessage;

            // Emit tool section finish with result
            emitSection(toolSectionId, 'tool', 'finish', toolResult || 'Success', {
              title: `✅ ${name}`,
              toolName: name,
              result: toolResult
            });

            // 🔥 RAILWAY FIX: Send progress event AFTER each tool execution
            // This provides more frequent updates and keeps connection alive
            sendEvent('progress', { message: `✅ Tool ${name} completed` });
          } catch (error: any) {
              console.error(`[META-SYSOP] ❌ Tool ${name} failed:`, error);
              console.error(`[META-SYSOP] Tool input:`, JSON.stringify(input, null, 2));

              const errorMessage = `Error in ${name}: ${error.message}\n\nThis error has been logged for debugging.`;

              toolResults.push({
                type: 'tool_result',
                tool_use_id: id,
                is_error: true,
                content: errorMessage,
              });

              // 💬 CONVERSATIONAL: Stream friendly text AFTER tool error
              const errorPostMessage = getPostToolMessage(name, errorMessage);
              sendEvent('content', { content: errorPostMessage });
              fullContent += errorPostMessage;

              // Emit tool section finish with error
              emitSection(toolSectionId, 'tool', 'finish', errorMessage, {
                title: `❌ ${name} (failed)`,
                toolName: name,
                error: error.message
              });

              // 🔥 RAILWAY FIX: Send error progress event
              sendEvent('progress', { message: `❌ Tool ${name} failed: ${error.message}` });
            }
        }
      }

      if (toolResults.length > 0) {
        conversationMessages.push({
          role: 'user',
          content: toolResults,
        });
        
        // 🚨 FORCING LOGIC (AFTER tool execution to avoid 400 errors)
        const createdTaskListThisIteration = toolNames.includes('createTaskList');
        const calledDiagnosisTools = toolNames.some(name => ['perform_diagnosis', 'architect_consult', 'execute_sql'].includes(name));
        
        console.log(`[META-SYSOP-FORCE] Created task list: ${createdTaskListThisIteration}`);
        console.log(`[META-SYSOP-FORCE] Called diagnosis tools: ${calledDiagnosisTools}`);
        console.log(`[META-SYSOP-FORCE] Iteration count: ${iterationCount}`);
        
        if (createdTaskListThisIteration && !calledDiagnosisTools && iterationCount === 1) {
          console.log('[META-SYSOP-FORCE] ❌❌❌ FORCING TRIGGERED! Meta-SySop skipped perform_diagnosis!');
          console.log('[META-SYSOP-FORCE] All tools executed and results added - now adding forcing message...');
          
          const forcingMessage = `STOP. You created a task list but did NOT call perform_diagnosis().\n\n` +
            `Your first task requires running the full platform diagnosis.\n\n` +
            `Call perform_diagnosis(target: "all", focus: []) RIGHT NOW.\n\n` +
            `Do NOT call readPlatformFile() or any other tools yet.\n` +
            `Do NOT just talk about it.\n` +
            `CALL THE TOOL: perform_diagnosis(target: "all", focus: [])`;
          
          conversationMessages.push({
            role: 'user',
            content: [{
              type: 'text',
              text: forcingMessage
            }]
          });
          
          console.log('[META-SYSOP-FORCE] ✅ Forcing message added. Conversation length:', conversationMessages.length);
          console.log('[META-SYSOP-FORCE] ✅ Continuing to iteration 2...');
          sendEvent('progress', { message: '🚨 Forcing diagnosis - Meta-SySop skipped it, retrying...' });
          continue; // Force iteration 2 with diagnosis
        } else {
          console.log('[META-SYSOP-FORCE] ✓ No forcing needed - proceeding normally');
        }
      } else {
        // No tool calls this iteration - check if we should continue
        // 🐛 FIX: Don't end if there are tasks still in progress - Meta-SySop might need another turn
        console.log(`[META-SYSOP-CONTINUATION] Iteration ${iterationCount}: No tool calls, checking if should continue...`);
        console.log(`[META-SYSOP-CONTINUATION] Active task list ID: ${activeTaskListId || 'none'}`);
        
        if (activeTaskListId) {
          try {
            const taskCheck = await readTaskList({ userId });
            console.log(`[META-SYSOP-CONTINUATION] Task list read success: ${taskCheck.success}`);
            console.log(`[META-SYSOP-CONTINUATION] Task lists found: ${taskCheck.taskLists?.length || 0}`);
            
            const sessionTaskList = taskCheck.taskLists?.find((list: any) => list.id === activeTaskListId);
            console.log(`[META-SYSOP-CONTINUATION] Session task list found: ${!!sessionTaskList}`);
            console.log(`[META-SYSOP-CONTINUATION] Tasks: ${sessionTaskList?.tasks?.length || 0}`);
            
            const allTasks = sessionTaskList?.tasks || [];
            const inProgressTasks = allTasks.filter((t: any) => t.status === 'in_progress');
            const pendingTasks = allTasks.filter((t: any) => t.status === 'pending');
            const completedTasks = allTasks.filter((t: any) => t.status === 'completed');
            
            console.log(`[META-SYSOP-CONTINUATION] Completed: ${completedTasks.length}, In-progress: ${inProgressTasks.length}, Pending: ${pendingTasks.length}`);
            
            // ✅ FULL AUTONOMY: Let Meta-SySop decide when to continue
            // No forcing, no micromanagement - trust the AI to do its job
            const hasIncompleteTasks = inProgressTasks.length > 0 || pendingTasks.length > 0;
            
            if (hasIncompleteTasks && iterationCount < MAX_ITERATIONS) {
              console.log(`[META-SYSOP-CONTINUATION] ✅ Continuing naturally - incomplete tasks remain`);
              continueLoop = true; // Continue but don't inject forcing messages
            } else {
              // Either all tasks done or hit iteration limit
              console.log(`[META-SYSOP-CONTINUATION] ❌ Ending - all tasks complete or limit reached (iteration ${iterationCount}/${MAX_ITERATIONS})`);
              continueLoop = false;
            }
          } catch (error: any) {
            console.error('[META-SYSOP-CONTINUATION] Failed to check task status:', error);
            continueLoop = false;
          }
        } else {
          // No task list - end normally
          console.log('[META-SYSOP-CONTINUATION] No task list - ending session naturally');
          continueLoop = false;
        }
      }
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
    // This prevents stuck tasks when Meta-SySop exits early (timeout, crash, etc)
    // 🐛 FIX: Only cleanup if work actually started (prevents auto-complete of just-created tasks)
    if (activeTaskListId) {
      try {
        console.log(`[META-SYSOP-CLEANUP] Safety passed - checking task list ${activeTaskListId} for incomplete tasks...`);
        const cleanupCheck = await readTaskList({ userId });
        if (cleanupCheck.success && cleanupCheck.taskLists) {
          // CRITICAL: Only clean up THE SPECIFIC task list from THIS session
          const sessionTaskList = cleanupCheck.taskLists.find((list: any) => list.id === activeTaskListId);
          if (sessionTaskList && sessionTaskList.status !== 'completed') {
            // 🐛 CRITICAL FIX: Only cleanup tasks that are stuck "in_progress"
            // NEVER touch "pending" tasks - they were never started
            // This prevents auto-completing tasks that Meta-SySop hasn't started yet
            const stuckTasks = sessionTaskList.tasks.filter((t: any) => t.status === 'in_progress');
            
            if (stuckTasks.length > 0) {
              console.log(`[META-SYSOP-CLEANUP] Found ${stuckTasks.length} stuck in_progress tasks - will auto-complete`);
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
                  console.log(`[META-SYSOP-CLEANUP] Marked stuck task "${task.title}" as completed`);
                } catch (error: any) {
                  console.error(`[META-SYSOP-CLEANUP] Failed to cleanup task ${task.id}:`, error);
                }
              }
              
              // Mark task list as completed since we cleaned up stuck tasks
              try {
                await db
                  .update(taskLists)
                  .set({ status: 'completed', completedAt: new Date() })
                  .where(eq(taskLists.id, activeTaskListId));
                console.log(`[META-SYSOP-CLEANUP] ✅ Task list ${activeTaskListId} marked as completed (had stuck tasks)`);
              } catch (error: any) {
                console.error('[META-SYSOP-CLEANUP] Failed to mark task list complete:', error);
              }
            } else {
              // No stuck tasks - all are pending or completed
              const pendingTasks = sessionTaskList.tasks.filter((t: any) => t.status === 'pending');
              const completedTasks = sessionTaskList.tasks.filter((t: any) => t.status === 'completed');
              console.log(`[META-SYSOP-CLEANUP] ℹ️ No stuck tasks. Status: ${completedTasks.length} completed, ${pendingTasks.length} pending - no cleanup needed`);
            }
          } else if (sessionTaskList?.status === 'completed') {
            console.log(`[META-SYSOP-CLEANUP] ✅ Task list already marked as completed`);
          } else {
            console.warn(`[META-SYSOP-CLEANUP] ⚠️ Session task list ${activeTaskListId} not found - skipping cleanup`);
          }
        }
      } catch (cleanupError: any) {
        console.error('[META-SYSOP-CLEANUP] Cleanup error (non-fatal):', cleanupError.message);
        // Don't throw - cleanup is best-effort
      }
    } else {
      // No task list to clean up - this is normal and expected
      console.log('[META-SYSOP-CLEANUP] ℹ️ No task list in this session (task tracking is optional)');
    }

    // Commit and push if enabled (autonomous - no approval required)
    let commitHash = '';
    if (autoCommit && fileChanges.length > 0) {
      sendEvent('progress', { message: `✅ Committing ${fileChanges.length} file changes...` });
      commitHash = await platformHealing.commitChanges(`Fix: ${message.slice(0, 100)}`, fileChanges as any);
      console.log(`[META-SYSOP] ✅ Committed autonomously: ${fileChanges.length} files`);

      if (autoPush) {
        sendEvent('progress', { message: '✅ Pushing to GitHub (deploying to production)...' });
        await platformHealing.pushToRemote();
        console.log(`[META-SYSOP] ✅ Pushed to GitHub autonomously`);
      }
    }

    // Use Meta-SySop's response as-is (like Replit Agent)
    let finalMessage = fullContent || '✅ Done!';

    // Save assistant message
    const [assistantMsg] = await db
      .insert(chatMessages)
      .values({
        userId,
        projectId: null,
        fileId: null,
        role: 'assistant',
        content: finalMessage,
        isPlatformHealing: true,
        platformChanges: fileChanges.length > 0 ? { files: fileChanges } : null,
      })
      .returning();

    // Log audit trail
    await platformAudit.log({
      userId,
      action: 'heal',
      description: `Meta-SySop chat: ${message.slice(0, 100)}`,
      changes: fileChanges,
      backupId: undefined, // Backups removed for conversational performance
      commitHash,
      status: 'success',
    });

    sendEvent('done', { messageId: assistantMsg.id, commitHash, filesChanged: fileChanges.length });
    res.end();
  } catch (error: any) {
    console.error('[META-SYSOP-CHAT] Stream error:', error);
    
    // 🔥 RAILWAY FIX: Clear heartbeat on error
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      console.log('[META-SYSOP-HEARTBEAT] Cleared on error');
    }

    // Save error message to DB
    try {
      const errorMsg = `❌ Error: ${error.message}`;
      const [errorAssistantMsg] = await db.insert(chatMessages).values({
        userId,
        projectId: null,
        fileId: null,
        role: 'assistant',
        content: errorMsg,
        isPlatformHealing: true,
      }).returning();
      
      // Send error and done events, then close stream
      terminateStream(errorAssistantMsg.id, error.message);
    } catch (dbError: any) {
      // If we can't save to DB, at least send done event with generic ID
      console.error('[META-SYSOP-CHAT] Failed to save error message:', dbError);
      terminateStream('error-' + Date.now(), error.message);
    }
  } finally {
    // 🔥 RAILWAY FIX: ALWAYS clear heartbeat when stream ends
    // This ensures cleanup happens on success, error, or early termination
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      console.log('[META-SYSOP-HEARTBEAT] Cleared on stream end');
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
    console.error('[META-SYSOP] Failed to get pending changes:', error);
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
    console.error('[META-SYSOP] Failed to deploy changes:', error);
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
    console.error('[META-SYSOP] Failed to discard changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== BACKGROUND JOB ROUTES (Railway SSE timeout fix) ====================

// POST /api/meta-sysop/start - Start a new background job
router.post('/start', isAuthenticated, async (req: any, res) => {
  try {
    const { message } = req.body;
    const userId = req.authenticatedUserId;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { createJob, startJobWorker } = await import('../services/metaSysopJobManager');
    
    // Create the job
    const job = await createJob(userId, message);
    
    // Start worker in background (fire and forget)
    startJobWorker(job.id);
    
    console.log('[META-SYSOP] Started background job:', job.id);
    
    res.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job started successfully',
    });
  } catch (error: any) {
    console.error('[META-SYSOP] Failed to start job:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/meta-sysop/resume/:jobId - Resume an interrupted or failed job
router.post('/resume/:jobId', isAuthenticated, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;
    
    const { resumeJob } = await import('../services/metaSysopJobManager');
    
    // Resume the job
    await resumeJob(jobId, userId);
    
    console.log('[META-SYSOP] Resumed job:', jobId);
    
    res.json({ 
      success: true,
      message: 'Job resumed successfully',
    });
  } catch (error: any) {
    console.error('[META-SYSOP] Failed to resume job:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('cannot be resumed')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// GET /api/meta-sysop/job/:jobId - Get job status and details
router.get('/job/:jobId', isAuthenticated, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;
    
    const { getJob } = await import('../services/metaSysopJobManager');
    
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
    console.error('[META-SYSOP] Failed to get job:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/meta-sysop/active-job - Get user's active or interrupted job
router.get('/active-job', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    // Find the most recent active, interrupted, or pending job
    const job = await db.query.metaSysopJobs.findFirst({
      where: (jobs, { and, eq, inArray }) => and(
        eq(jobs.userId, userId),
        inArray(jobs.status, ['pending', 'running', 'interrupted'])
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });
    
    console.log('[META-SYSOP] Active job query for user:', userId, job ? `found ${job.id}` : 'none found');
    
    res.json({ 
      success: true, 
      job: job || null,
    });
  } catch (error: any) {
    console.error('[META-SYSOP] Failed to get active job:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/meta-sysop/job/:jobId - Cancel/clean up a stuck job (admin)
router.delete('/job/:jobId', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;
    
    // Get the job
    const job = await db.query.metaSysopJobs.findFirst({
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
    await db.update(metaSysopJobs)
      .set({ 
        status: 'failed',
        error: 'Job cancelled by user',
        updatedAt: new Date()
      })
      .where(eq(metaSysopJobs.id, jobId));
    
    console.log('[META-SYSOP] Job cancelled:', jobId, 'by user:', userId);
    
    res.json({ 
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error: any) {
    console.error('[META-SYSOP] Failed to cancel job:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/meta-sysop/chat-history - Fetch recent chat messages
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
    
    // Return in chronological order (oldest first)
    res.json({ 
      success: true, 
      messages: messages.reverse() 
    });
  } catch (error: any) {
    console.error('[META-SYSOP] Failed to fetch chat history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;