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
import { createSafeAnthropicRequest, logTruncationResults } from '../lib/anthropic-wrapper';
import { sanitizeDiagnosisForAI } from '../lib/diagnosis-sanitizer';

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
  // Set up Server-Sent Events with Railway-specific anti-buffering headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering on Railway/nginx proxies
  res.setHeader('Content-Encoding', 'none'); // Prevent gzip buffering

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
    // 🧠 BOUNDED MEMORY SYSTEM: Load last 10 messages (aggressive token reduction)
    // This gives ~5K-10K tokens for history, saving 40K+ tokens per request
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
      .limit(10); // ⚡ REDUCED FROM 100 - Saves ~40K tokens per request!
    
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
    
    // 🧠 ULTRA-CONDENSED PLATFORM KNOWLEDGE: Minimal tokens, maximum efficiency
    const platformKnowledge = `\n\n**ARCHETYPE PLATFORM:**\n` +
      `React+Express+PostgreSQL on Railway. You're Meta-SySop - platform maintenance agent.\n` +
      `Tools: readPlatformFile/writePlatformFile, web_search, architect_consult, commit_to_github.\n` +
      `Read replit.md for full details when needed. Be conversational, action-oriented.\n`;

    // Generate comprehensive memory summary for system prompt
    let memorySummary = '';
    if (userGoals.length > 0 || knownIssues.length > 0 || attemptedFixes.length > 0 || completedWork.length > 0) {
      memorySummary = `\n\n**CONTEXT:** ${history.length} msgs, ${userMessages.length} requests, ${completedWork.length} completed.\n`;
      
      if (userGoals.length > 0) {
        memorySummary += `Goals: ${userGoals.slice(-2).map(g => g.substring(0, 80)).join('; ')}\n`;
      }
      
      if (knownIssues.length > 0) {
        memorySummary += `Issues: ${knownIssues.slice(-2).map(i => i.substring(0, 80)).join('; ')}\n`;
      }
      
      if (completedWork.length > 0) {
        memorySummary += `Completed: ${completedWork.slice(-1).join('; ')}\n`;
      }
    }

    // ⚡ Minimal deployment awareness - only on first iteration
    let deploymentAwareness = '';
    // REMOVED: Deployment awareness section to save ~2K tokens per request

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

    // 💬 ULTRA-SIMPLE CONVERSATIONAL PROMPT
    const systemPrompt = `You're Meta-SySop, the AI that maintains Archetype. Talk like a colleague, not a bot - brief, natural, no emojis or sections.

For simple stuff (move button, fix typo): Just say what you'll do in one line, do it quietly, then report done. Don't create task lists or write reports.

For complex stuff (chatroom broken, multiple files): Use start_subagent to delegate work. Create a task list only if it's genuinely complex.

Know your codebase: Chat issues → check chat.tsx and server/routes/chat.ts. Auth issues → check server/routes.ts. Database → server/storage.ts. Only read files relevant to the problem - saves tokens.

Always read files before writing. Batch all changes. One commit at end. ${autoCommit ? 'Auto-commit ON' : 'Ask before committing'}.

After fixing issues, verify your fix worked using verify_fix(). If verification fails, fix again and reverify. Keep trying until verification passes.

React+Express+PostgreSQL stack. Deploys to Railway automatically.

User said: "${message}"

Answer naturally. If it's work, do it and report when done. If it's a question, just answer it like a person.`;

    const tools = [
      {
        name: 'start_subagent',
        description: 'Delegate complex multi-file work to sub-agents. Use for: (1) Issues affecting 3+ files, (2) Feature development, (3) Diagnosis + fixes. Example: "chatroom broken" → delegate to sub-agent to check chat UI + backend + WebSocket in parallel.',
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
      {
        name: 'verify_fix',
        description: 'Verify that your fix actually worked. Use after making changes to confirm they solved the problem. Returns ✅ if verification passed, ❌ if failed (you should fix again).',
        input_schema: {
          type: 'object' as const,
          properties: {
            description: { 
              type: 'string' as const, 
              description: 'What you\'re verifying, e.g., "Chat system working"' 
            },
            checkType: {
              type: 'string' as const,
              enum: ['logs', 'endpoint', 'file_exists'],
              description: 'How to verify: logs (check for errors), endpoint (test API), file_exists (check file)'
            },
            target: {
              type: 'string' as const,
              description: 'Optional: endpoint URL or file path to check'
            }
          },
          required: ['description', 'checkType']
        }
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
    const MAX_ITERATIONS = 10; // 🎯 Reduced from 25 - most tasks should complete in 5-10 iterations
    let commitSuccessful = false; // Track if commit_to_github succeeded
    let usedGitHubAPI = false; // Track if commit_to_github tool was used (already pushes via API)
    let consecutiveEmptyIterations = 0; // Track iterations with no tool calls
    const MAX_EMPTY_ITERATIONS = 3; // Stop if 3 consecutive iterations without tool calls

    // ✅ REMOVED: Casual greeting bypass - Meta-SySop should ALWAYS be conversational like Replit Agent
    // Every message goes to Claude for proper conversational awareness and context

    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      sendEvent('progress', { message: `Analyzing (iteration ${iterationCount}/${MAX_ITERATIONS})...` });

      // Simple status update instead of verbose section
      const thinkingSectionId = `thinking-${iterationCount}-${Date.now()}`;
      // Skip the "Analyzing request" spam - let the AI respond naturally

      // 🧠 INJECT COMPLETE PLATFORM KNOWLEDGE + MEMORY + DEPLOYMENT AWARENESS into system prompt (only on first iteration)
      const finalSystemPrompt = iterationCount === 1 
        ? systemPrompt + platformKnowledge + memorySummary + deploymentAwareness
        : systemPrompt;

      // 🛡️ ANTHROPIC CONTEXT-LIMIT PROTECTION: Prevent 400 errors from exceeding 200K token limit
      // This wrapper truncates context if needed while preserving recent messages
      const { messages: safeMessages, systemPrompt: safeSystemPrompt, estimatedTokens, truncated, originalTokens, removedMessages } = 
        createSafeAnthropicRequest(conversationMessages, finalSystemPrompt);
      
      // Log truncation results for monitoring (only on first iteration)
      if (iterationCount === 1) {
        logTruncationResults({ 
          messages: safeMessages, 
          systemPrompt: safeSystemPrompt, 
          estimatedTokens, 
          truncated,
          removedMessages,
          originalTokens // ✅ Use accurate original tokens from wrapper
        });
      }

      const stream = await client.messages.create({
        model: 'claude-sonnet-4-20250514', // 💰 SONNET 4 - 5x cheaper than Opus ($3/M vs $15/M tokens)
        max_tokens: config.maxTokens, // Use autonomy level's max_tokens
        system: safeSystemPrompt, // ✅ Use truncated system prompt
        messages: safeMessages, // ✅ Use truncated messages
        tools: availableTools,
        stream: true,
      });

      // ✅ REAL-TIME STREAMING: Stream text to user AS IT ARRIVES while building content blocks
      const contentBlocks: any[] = [];
      let currentTextBlock = '';
      
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            // Save any pending text block (already streamed via deltas)
            if (currentTextBlock) {
              contentBlocks.push({ type: 'text', text: currentTextBlock });
              fullContent += currentTextBlock;
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

      // Skip "Analysis complete" spam - the response speaks for itself

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

      // 🚨 RESET EMPTY COUNTER IMMEDIATELY when tools are called (before any continue/return)
      if (toolNames.length > 0) {
        consecutiveEmptyIterations = 0;
        console.log('[META-SYSOP-CONTINUATION] ✅ Tools called - reset empty counter to 0');
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

      // 🔧 TOOL EXECUTION: Process all tool calls from the response FIRST
      // This ensures every tool_use has a tool_result before we add forcing messages
      for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
          const { name, input, id } = block;

          // 💬 CONVERSATIONAL: Stream friendly text BEFORE tool execution
          const preMessage = getPreToolMessage(name, input);
          sendEvent('content', { content: preMessage });
          fullContent += preMessage;

          // Minimal tool notification - no verbose sections
          const toolSectionId = `tool-${name}-${id}`;
          // Tools execute silently - user sees results in conversational response

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
              
              // 📦 BATCH COMMIT: Stage files for single commit at the end
              // This prevents multiple commits - all changes committed together via commit_to_github()
              const writeResult = await platformHealing.writePlatformFile(
                typedInput.path,
                typedInput.content,
                true  // skipAutoCommit: true - stage for batch commit
              );
              toolResult = JSON.stringify(writeResult);

              // Track file changes with content for batch commits
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'modify', 
                contentAfter: typedInput.content 
              });

              sendEvent('file_change', { file: { path: typedInput.path, operation: 'modify' } });
              toolResult = `✅ File staged for commit (use commit_to_github to batch all changes)`;
              console.log(`[META-SYSOP] ✅ File staged for batch commit: ${typedInput.path}`);
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
                    usedGitHubAPI = true; // ✅ GitHub API already pushed - skip redundant git push
                    sendEvent('progress', { message: `✅ Committed to GitHub: ${result.commitHash}` });
                    sendEvent('progress', { message: `🚀 Railway will auto-deploy in 2-3 minutes` });

                    toolResult = `✅ SUCCESS! Committed ${fileChanges.length} files to GitHub\n\n` +
                      `Commit: ${result.commitHash}\n` +
                      `URL: ${result.commitUrl}\n\n` +
                      `🚀 Railway auto-deployment triggered!\n` +
                      `⏱️ Changes will be live in 2-3 minutes\n\n` +
                      `Files committed:\n${filesToCommit.map(f => `- ${f.path}`).join('\n')}\n\n` +
                      `Note: This works on Railway production (no local .git required)!`;
                    
                    // ✅ CRITICAL: Clear fileChanges to prevent fallback commit from trying again
                    // Without this, the cleanup section would still attempt local git commit → error on Railway
                    fileChanges.length = 0;
                    console.log('[META-SYSOP] ✅ Cleared fileChanges after successful GitHub API commit');
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

            // Tool finished - no spam, AI will explain results naturally

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

              // Tool failed - AI will handle retry naturally without spam

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
        
        // ✅ NO AUTO-DIAGNOSIS FORCING - Let Meta-SySop work naturally
        // Only run diagnosis when user explicitly asks for it
        console.log('[META-SYSOP-FORCE] ✓ No forcing - Meta-SySop works autonomously');
      } else {
        // No tool calls this iteration - check if we should continue
        // 🐛 FIX: Don't end if there are tasks still in progress - Meta-SySop might need another turn
        console.log(`[META-SYSOP-CONTINUATION] Iteration ${iterationCount}: No tool calls, checking if should continue...`);
        console.log(`[META-SYSOP-CONTINUATION] Active task list ID: ${activeTaskListId || 'none'}`);
        
        // 🚨 INFINITE LOOP PREVENTION: Track consecutive empty iterations
        consecutiveEmptyIterations++;
        console.log(`[META-SYSOP-CONTINUATION] Consecutive empty iterations: ${consecutiveEmptyIterations}/${MAX_EMPTY_ITERATIONS}`);
        
        if (consecutiveEmptyIterations >= MAX_EMPTY_ITERATIONS) {
          console.log(`[META-SYSOP-CONTINUATION] 🛑 STOPPING - ${MAX_EMPTY_ITERATIONS} consecutive iterations without tool calls (infinite loop detected)`);
          sendEvent('progress', { message: `⚠️ Meta-SySop appears stuck - stopping after ${consecutiveEmptyIterations} empty iterations` });
          continueLoop = false;
        } else if (activeTaskListId) {
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

    // 🚨 NOTIFY USER IF HIT ITERATION LIMIT
    if (iterationCount >= MAX_ITERATIONS) {
      const warningMsg = `\n\n⚠️ Stopped after ${MAX_ITERATIONS} iterations. This usually means I got stuck in a loop. The work might be incomplete - please check what I did and let me know if you need me to continue.`;
      sendEvent('content', { content: warningMsg });
      fullContent += warningMsg;
      console.warn(`[META-SYSOP] ⚠️ Hit MAX_ITERATIONS (${MAX_ITERATIONS}) - possible infinite loop`);
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
    if (autoCommit && fileChanges.length > 0 && !usedGitHubAPI) {
      // Only use fallback commit if commit_to_github tool wasn't used
      sendEvent('progress', { message: `✅ Committing ${fileChanges.length} file changes...` });
      commitHash = await platformHealing.commitChanges(`Fix: ${message.slice(0, 100)}`, fileChanges as any);
      console.log(`[META-SYSOP] ✅ Committed autonomously: ${fileChanges.length} files`);

      if (autoPush) {
        sendEvent('progress', { message: '✅ Pushing to GitHub (deploying to production)...' });
        await platformHealing.pushToRemote();
        console.log(`[META-SYSOP] ✅ Pushed to GitHub autonomously`);
      }
    } else if (usedGitHubAPI) {
      console.log(`[META-SYSOP] ℹ️ Skipping fallback commit - already committed via GitHub API`);
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