import { Router } from 'express';
import { db } from '../db';
import { chatMessages, taskLists, tasks, metaSysopAttachments, users, subscriptions, projects } from '@shared/schema';
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
    const history = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.isPlatformHealing, true)
        )
      )
      .orderBy(chatMessages.createdAt)
      .limit(6); // Last 6 messages to avoid confusion from old context

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
💬 BE CONVERSATIONAL FIRST, WORK SECOND!
═══════════════════════════════════════════════════════════════════

**CRITICAL: NOT EVERY MESSAGE IS A WORK REQUEST!**

BEFORE doing ANYTHING, classify the user's message:

📢 **CASUAL GREETING** - User is just being friendly:
- "hi"
- "hello"
- "hey there"
- "what's up?"
- "how are you?"
→ RESPONSE: Be friendly! Say hi back! DON'T run any tools!
   Example: "Hi! I'm Meta-SySop, your platform maintenance assistant. How can I help you today?"

❓ **SIMPLE QUESTION** - User wants information:
- "What's the CPU usage?"
- "Any errors in the logs?"
- "How's the platform doing?"
- "What files handle authentication?"
→ RESPONSE: Use diagnosis tools to answer, explain findings, DON'T modify anything
   Example: "Let me check the system metrics for you..."

🔍 **DIAGNOSTIC REQUEST** - User wants analysis:
- "Diagnose the performance issues"
- "Check for security vulnerabilities"
- "Analyze the database"
- "Find all the bugs"
→ RESPONSE: Use perform_diagnosis(), explain what you found, propose solutions

💬 **DISCUSSION** - User is exploring options:
- "How would we add feature X?"
- "What's the best way to improve Y?"
- "Should we refactor Z?"
→ RESPONSE: Read relevant files, discuss approach, WAIT for confirmation before building

🔨 **ACTUAL WORK REQUEST** - User wants changes made:
- "Fix the memory leak in websocket.ts"
- "Add authentication to the API"
- "Deploy the new feature"
- "The build is broken, please fix it"
→ RESPONSE: ${autoCommit 
    ? 'AUTONOMOUS MODE - Just do it! (diagnose → fix → commit → deploy)' 
    : 'MANUAL MODE - Follow approval workflow (diagnose → request approval → build → deploy)'
  }

**GOLDEN RULE:**
- If unsure, ASSUME it's a conversation, NOT a work request
${autoCommit 
    ? '- In AUTONOMOUS mode: Execute work requests immediately without asking'
    : '- In MANUAL mode: When in doubt, ASK! "Would you like me to make these changes?"'
  }
- NEVER run diagnosis tools for greetings or casual chat
- Be friendly, helpful, and conversational

═══════════════════════════════════════════════════════════════════
🤖 WHO YOU ARE: META-SYSOP
═══════════════════════════════════════════════════════════════════

**YOUR IDENTITY:**
- You are Meta-SySop, the dual-mode maintenance agent for Archetype
- You can work on BOTH the Archetype platform AND individual user projects
- ${projectId ? '🎯 RESCUE MODE: You are currently working on a user project' : '🏗️ PLATFORM MODE: You are currently working on the Archetype platform itself'}
- You are friendly, helpful, and conversational
${autoCommit 
    ? '- AUTONOMOUS MODE: Execute work immediately, explain as you go'
    : '- MANUAL MODE: Explain changes clearly and request approval before making them'
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
- Deploy changes via commit_to_github()
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
1. Plan: createTaskList() to show the user what you'll do
2. Understand: perform_diagnosis() to identify issues
3. Execute: Fix each issue and updateTask() as you complete them
4. Deploy: commit_to_github() after verification
5. Consult: architect_consult() if stuck (optional)
`}

**TASK TRACKING (REQUIRED for work requests):**
- ALWAYS createTaskList() first when user asks you to diagnose/fix/improve
- This makes your progress visible inline in the chat as a floating progress card
- Call updateTask(taskId, "in_progress") when starting a task
- Call updateTask(taskId, "completed") when finishing a task
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
    const MAX_ITERATIONS = 5;
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

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: config.maxTokens, // Use autonomy level's max_tokens
        system: systemPrompt,
        messages: conversationMessages,
        tools: availableTools,
        stream: false, // We'll handle our own streaming
      });

      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // 🎯 Log response for debugging
      if (iterationCount === 1) {
        const hasToolCalls = response.content.some(block => block.type === 'tool_use');
        console.log('[META-SYSOP] Response has tool calls:', hasToolCalls);
        console.log('[META-SYSOP] Content blocks:', response.content.map(b => b.type).join(', '));
      }

      const toolResults: any[] = [];
      const hasToolUse = response.content.some(block => block.type === 'tool_use');

      // 🎯 CONVERSATIONAL STREAMING:
      // Stream ALL text immediately to keep the conversation flowing
      // Just like Replit Agent - keep the user informed in real-time!
      for (const block of response.content) {
        if (block.type === 'text') {
          // STREAM ALL TEXT IMMEDIATELY - no buffering!
          fullContent += block.text;
          sendEvent('content', { content: block.text });
          console.log('[META-SYSOP-CHAT] 💬 Streaming text:', block.text.slice(0, 100));
        } else if (block.type === 'tool_use') {
          const { name, input, id } = block;

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
              } else {
                toolResult = `❌ Failed to create task list: ${result.error}`;
                sendEvent('content', { content: `❌ Failed to create task list: ${result.error}\n\n` });
                console.error('[META-SYSOP] Task list creation failed:', result.error);
              }
            } else if (name === 'updateTask') {
              const typedInput = input as { taskId: string; status: string; result?: string };
              sendEvent('progress', { message: `Updating task to ${typedInput.status}...` });

              // 🎯 ANTI-LYING VALIDATION: Prevent completing tasks out of order
              if (typedInput.status === 'completed') {
                // Get current task list to validate
                const listResult = await readTaskList({ userId });
                if (listResult.success && listResult.taskLists) {
                  const activeList = listResult.taskLists.find((list: any) => list.status === 'active');
                  if (activeList) {
                    const tasks = activeList.tasks || [];
                    const currentTask = tasks.find((t: any) => t.id === typedInput.taskId);

                    if (currentTask) {
                      // SPECIAL VALIDATION: "Deploy to production via GitHub" requires actual commit success
                      if (currentTask.title === 'Deploy to production via GitHub') {
                        if (!commitSuccessful) {
                          toolResult = `❌ BLOCKED: Cannot mark deployment task as completed!\n\n` +
                            `You must successfully call commit_to_github() and receive a success response BEFORE marking this task complete.\n\n` +
                            `Commit status: ${commitSuccessful ? 'Success' : 'Not attempted or failed'}\n` +
                            `File changes: ${fileChanges.length}\n\n` +
                            `You cannot claim deployment is done until GitHub actually confirms the commit!`;
                          console.error('[META-SYSOP-ANTI-LYING] Blocked deployment task completion - commit not successful');
                          sendEvent('error', { message: 'Cannot complete deployment - commit not successful' });
                          
                          // CRITICAL: Don't break - add error result and continue processing other tools
                          toolResults.push({
                            type: 'tool_result',
                            tool_use_id: id,
                            is_error: true,
                            content: toolResult,
                          });
                          continue; // Skip updateTask but continue processing other tools
                        }
                      }

                      // DEPENDENCY VALIDATION: Check if prerequisite tasks are complete
                      const currentIndex = tasks.findIndex((t: any) => t.id === typedInput.taskId);
                      const previousTasks = tasks.slice(0, currentIndex);
                      const incompletePrevious = previousTasks.filter((t: any) => t.status !== 'completed');

                      if (incompletePrevious.length > 0) {
                        toolResult = `❌ BLOCKED: Cannot complete task out of order!\n\n` +
                          `Task "${currentTask.title}" requires these tasks to be completed first:\n` +
                          incompletePrevious.map((t: any) => `- ${t.title} (${t.status})`).join('\n') +
                          `\n\nComplete tasks in order!`;
                        console.error('[META-SYSOP-ANTI-LYING] Blocked out-of-order task completion');
                        sendEvent('error', { message: 'Tasks must be completed in order' });
                        
                        // CRITICAL: Don't break - add error result and continue processing other tools
                        toolResults.push({
                          type: 'tool_result',
                          tool_use_id: id,
                          is_error: true,
                          content: toolResult,
                        });
                        continue; // Skip updateTask but continue processing other tools
                      }
                    }
                  }
                }
              }

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

            // 🔥 RAILWAY FIX: Send progress event AFTER each tool execution
            // This provides more frequent updates and keeps connection alive
            sendEvent('progress', { message: `✅ Tool ${name} completed` });
          } catch (error: any) {
              console.error(`[META-SYSOP] ❌ Tool ${name} failed:`, error);
              console.error(`[META-SYSOP] Tool input:`, JSON.stringify(input, null, 2));

              toolResults.push({
                type: 'tool_result',
                tool_use_id: id,
                is_error: true,
                content: `Error in ${name}: ${error.message}\n\nThis error has been logged for debugging.`,
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
      } else {
        // No more tool calls - conversation ends naturally (like Replit Agent)
        console.log('[META-SYSOP] No more tool calls - ending session naturally');
        continueLoop = false;
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
    if (activeTaskListId) {
      try {
        console.log(`[META-SYSOP-CLEANUP] Safety passed - checking task list ${activeTaskListId} for incomplete tasks...`);
        const cleanupCheck = await readTaskList({ userId });
        if (cleanupCheck.success && cleanupCheck.taskLists) {
          // CRITICAL: Only clean up THE SPECIFIC task list from THIS session
          const sessionTaskList = cleanupCheck.taskLists.find((list: any) => list.id === activeTaskListId);
          if (sessionTaskList && sessionTaskList.status !== 'completed') {
            const incompleteTasks = sessionTaskList.tasks.filter((t: any) => t.status !== 'completed');
            if (incompleteTasks.length > 0) {
              console.log(`[META-SYSOP-CLEANUP] Found ${incompleteTasks.length} incomplete tasks in session task list ${activeTaskListId}`);
              sendEvent('progress', { message: `Cleaning up ${incompleteTasks.length} incomplete tasks...` });

              // Mark each incomplete task as completed (with warning)
              for (const task of incompleteTasks) {
                try {
                  await updateTask({
                    userId,
                    taskId: task.id,
                    status: 'completed',
                    result: '⚠️ Auto-completed (session ended early)',
                    completedAt: new Date()
                  });
                  console.log(`[META-SYSOP-CLEANUP] Marked task "${task.title}" as completed (cleanup)`);
                } catch (error: any) {
                  console.error(`[META-SYSOP-CLEANUP] Failed to cleanup task ${task.id}:`, error);
                }
              }
            }

            // Now mark the task list as completed
            try {
              await db
                .update(taskLists)
                .set({ status: 'completed', completedAt: new Date() })
                .where(eq(taskLists.id, activeTaskListId));
              console.log(`[META-SYSOP-CLEANUP] ✅ Task list ${activeTaskListId} marked as completed (cleanup)`);
            } catch (error: any) {
              console.error('[META-SYSOP-CLEANUP] Failed to cleanup task list:', error);
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

export default router;