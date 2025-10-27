import { Router } from 'express';
import { db } from '../db';
import { chatMessages, taskLists, metaSysopAttachments } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated, isAdmin } from '../universalAuth';
import Anthropic from '@anthropic-ai/sdk';
import { platformHealing } from '../platformHealing';
import { platformAudit } from '../platformAudit';
import { consultArchitect } from '../tools/architect-consult';
import { executeWebSearch } from '../tools/web-search';
import { GitHubService } from '../githubService';
import { createTaskList, updateTask, readTaskList } from '../tools/task-management';
import { performDiagnosis } from '../tools/diagnosis';
import { startSubagent } from '../subagentOrchestration';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

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
  const { message, attachments = [], autoCommit = false, autoPush = false } = req.body;
  const userId = req.authenticatedUserId;
  console.log('[META-SYSOP-CHAT] Message:', message?.substring(0, 50), 'Attachments:', attachments?.length || 0, 'UserId:', userId);

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

  console.log('[META-SYSOP-CHAT] Entering try block');
  try {

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

    // Meta-SySop will create task lists ONLY when actually building
    // Not for questions, diagnostics, or exploration
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
      .limit(20); // Last 20 messages for context

    // Build conversation for Claude
    const conversationMessages: any[] = history
      .filter(msg => msg.id !== userMsg.id) // Exclude the message we just added
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

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
    
    // Helper to get file extension for syntax highlighting
    function getFileExtension(fileName: string): string {
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
    }

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
- You are Meta-SySop, the platform maintenance agent for Archetype
- You maintain and heal the Archetype platform itself (not user projects)
- You're friendly, helpful, and conversational
${autoCommit 
    ? '- AUTONOMOUS MODE: Execute work immediately, explain as you go'
    : '- MANUAL MODE: Explain changes clearly and request approval before making them'
  }

**ARCHETYPE PLATFORM:**
- AI-powered SaaS for rapid web development
- Features SySop (user-facing AI agent that builds user projects)
- You and SySop are siblings - SySop builds for users, you maintain the platform
- Full-stack: React + Express + PostgreSQL
- Production: Railway.app with GitHub auto-deployment

**THREE INTELLIGENCES:**
1. **SySop** - Builds user projects (your sibling)
2. **Meta-SySop (YOU)** - Maintains the Archetype platform
3. **I AM** - Strategic architect advisor (call via architect_consult)

**YOUR MISSION:**
- Fix platform bugs and performance issues
- Upgrade platform features
- Maintain production stability  
- Be conversational and helpful
- Only work when explicitly asked

═══════════════════════════════════════════════════════════════════
🌍 ENVIRONMENT: DEVELOPMENT VS PRODUCTION
═══════════════════════════════════════════════════════════════════

**DEVELOPMENT (Replit):**
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

**PRODUCTION (Railway Docker):**
❌ NO client/ (source not included)
❌ NO public/ (bundled into dist/)
❌ NO .git/ (no git repository)
✅ ONLY dist/, server/, shared/

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

**TOOLS DISABLED IN PRODUCTION:**
- rollback_to_backup() - Not available (use GitHub to revert)
- deletePlatformFile() - Not available in production
- Direct git operations - Use GitHub API instead

═══════════════════════════════════════════════════════════════════
🔧 YOUR TOOLS
═══════════════════════════════════════════════════════════════════

**DIAGNOSIS (Read-Only):**
- readTaskList() - See your pre-created task list
- perform_diagnosis() - Analyze performance/memory/database/security
- readPlatformFile(path) - Read any file (auto-GitHub fallback)
- listPlatformDirectory(dir) - Browse directory (returns immediate children: files & folders)

**MODIFICATIONS (Autonomous - No Approval Required):**
- writePlatformFile(path, content) - Modify file (just do it!)
- createPlatformFile(path, content) - Create new file (just do it!)
- commit_to_github(changes, message) - Deploy to production (just do it!)

**HELP & DELEGATION:**
- architect_consult() - Get I AM's advice when stuck (optional consultation, not approval)
- start_subagent() - Delegate complex work
- updateTask() - Update task progress

**NEVER MODIFY:**
- package.json
- vite.config.ts
- drizzle.config.ts
- .env files

═══════════════════════════════════════════════════════════════════
🎯 YOUR WORKFLOW
═══════════════════════════════════════════════════════════════════

**IF GREETING/CASUAL:**
→ Say hi, be friendly, ask how you can help

**IF QUESTION:**
→ Use diagnosis tools, answer the question, explain findings

**IF WORK REQUEST:**
1. Understand: perform_diagnosis() (readTaskList optional)
2. Execute: Fix the issue (or delegate to sub-agent)
3. Deploy: commit_to_github() after verification
4. Consult: architect_consult() if stuck (optional)

**TASK TRACKING (Optional):**
- updateTask() is OPTIONAL - only use if readTaskList() found an active list
- If no task list exists, just proceed with your work!

**ANTI-LYING RULE:**
❌ NEVER claim success before seeing results
✅ ALWAYS wait for tool results, then report facts

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
        name: 'readTaskList',
        description: '**FIRST STEP** - Read your pre-created task list to get task IDs. Tasks are already created and visible to users!',
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

    // 🎯 AUTONOMOUS MODE: Remove approval + task tracking tools when autoCommit=true
    const availableTools = autoCommit 
      ? tools.filter(tool => 
          tool.name !== 'request_user_approval' && 
          tool.name !== 'readTaskList' && 
          tool.name !== 'updateTask'
        )
      : tools;

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
        max_tokens: 8000,
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
      let hasSeenToolUse = false; // Track if we've seen a tool_use block yet
      const postToolText: string[] = []; // Buffer text that appears after tools

      // 🎯 SMART ANTI-LYING ENFORCEMENT:
      // - Allow text BEFORE tools (conversational setup: "I'm going to check X...")
      // - Buffer text AFTER tools to send in next iteration (prevents premature claims)
      // This keeps Meta-SySop conversational while preventing lies
      if (hasToolUse) {
        console.log('[META-SYSOP-ENFORCEMENT] Response has tool calls - allowing conversational text, buffering post-tool text');
      }

      for (const block of response.content) {
        if (block.type === 'text') {
          // SMART BLOCKING: Only buffer text that appears AFTER we've seen tool_use blocks
          // Text BEFORE tools is conversational setup (streamed immediately)
          // Text AFTER tools is buffered and sent after tool execution
          if (!hasSeenToolUse) {
            // Text appears BEFORE any tool calls - this is conversational setup, STREAM it
            fullContent += block.text;
            sendEvent('content', { content: block.text });
            console.log('[META-SYSOP-CHAT] 💬 Streaming conversational text (pre-tools):', block.text.slice(0, 100));
          } else {
            // Text appears AFTER tool calls - buffer it for post-tool delivery
            postToolText.push(block.text);
            console.log('[META-SYSOP-ENFORCEMENT] 📦 Buffered post-tool text (will send after tools):', block.text.slice(0, 100));
          }
        } else if (block.type === 'tool_use') {
          hasSeenToolUse = true; // Mark that we've seen a tool - buffer all text after this
          const { name, input, id } = block;

          try {
            let toolResult: any = null;

            if (name === 'createTaskList') {
              // REJECT: Tasks are pre-created, Meta-SySop should use readTaskList() instead
              toolResult = `❌ ERROR: createTaskList() is NOT available!

Tasks are PRE-CREATED when users send messages. They're already visible in TaskBoard UI.

You MUST:
1. Call readTaskList() to see your pre-created task IDs
2. Call updateTask(taskId, status) to mark progress

DO NOT create new tasks - UPDATE existing ones!`;
              sendEvent('error', { message: 'createTaskList() blocked - use readTaskList() instead' });
              console.error('[META-SYSOP] Blocked createTaskList - tasks are pre-created!');
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
                  const taskSummary = activeList.tasks.map((t: any) => 
                    `[${t.id}] ${t.title} - ${t.status}`
                  ).join('\n');
                  toolResult = `Current Task List (${activeList.id}):\n${taskSummary}`;
                } else {
                  toolResult = `No active task list found. Task tracking is optional - proceed with your work without calling updateTask().`;
                }
              } else {
                toolResult = `Error reading task list: ${result.error}. Proceed with your work anyway - task tracking is optional.`;
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
                    toolResult = `❌ GitHub integration not configured.\n\nSetup instructions:\n1. Create GitHub Personal Access Token at https://github.com/settings/tokens\n2. Set environment variables:\n   - GITHUB_TOKEN=ghp_...\n   - GITHUB_REPO=owner/repo-name\n3. Render will auto-deploy on push to main branch\n\nThis enables Archetype to self-update without Replit!`;
                    sendEvent('error', { message: 'GitHub not configured - see setup instructions' });
                  } else {
                    const githubService = new GitHubService();
                    const PROJECT_ROOT = process.cwd();

                    // Read file contents and prepare for commit
                    const filesToCommit = [];
                    for (const change of fileChanges) {
                      if (change.contentAfter) {
                        filesToCommit.push({
                          path: change.path,
                          content: change.contentAfter,
                        });
                      } else {
                        // Read from filesystem if content wasn't tracked
                        const fullPath = path.join(PROJECT_ROOT, change.path);
                        const content = await fs.readFile(fullPath, 'utf-8');
                        filesToCommit.push({
                          path: change.path,
                          content,
                        });
                      }
                    }

                    // Commit to GitHub
                    const result = await githubService.commitFiles(
                      filesToCommit,
                      typedInput.commitMessage
                    );

                    commitSuccessful = true; // Track commit success for task validation
                    sendEvent('progress', { message: `✅ Committed to GitHub: ${result.commitHash}` });
                    sendEvent('progress', { message: `🚀 Render will auto-deploy in 2-3 minutes` });

                    toolResult = `✅ SUCCESS! Committed ${fileChanges.length} files to GitHub\n\n` +
                      `Commit: ${result.commitHash}\n` +
                      `URL: ${result.commitUrl}\n\n` +
                      `🚀 Render auto-deployment triggered!\n` +
                      `⏱️ Changes will be live in 2-3 minutes\n\n` +
                      `Files committed:\n${filesToCommit.map(f => `- ${f.path}`).join('\n')}`;
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
          } catch (error: any) {
              console.error(`[META-SYSOP] ❌ Tool ${name} failed:`, error);
              console.error(`[META-SYSOP] Tool input:`, JSON.stringify(input, null, 2));

              toolResults.push({
                type: 'tool_result',
                tool_use_id: id,
                is_error: true,
                content: `Error in ${name}: ${error.message}\n\nThis error has been logged for debugging.`,
              });
            }
        }
      }

      // Send any buffered post-tool text now that tools have executed
      if (postToolText.length > 0) {
        const bufferedContent = postToolText.join('');
        fullContent += bufferedContent;
        sendEvent('content', { content: bufferedContent });
        console.log('[META-SYSOP-CHAT] 📤 Sent buffered post-tool text:', bufferedContent.slice(0, 100));
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
      console.warn('[META-SYSOP-CLEANUP] ⚠️ No activeTaskListId tracked - skipping cleanup');
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
  }
});

export default router;