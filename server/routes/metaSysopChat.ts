import { Router } from 'express';
import { db } from '../db';
import { chatMessages, taskLists } from '@shared/schema';
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

    // CRITICAL: Resolve the pending approval promise from the OLD system
    // This allows the original /api/platform/heal session to continue
    if (sessionId) {
      const { resolvePendingApproval } = await import('../platformRoutes');
      const resolved = resolvePendingApproval(sessionId, true);
      if (resolved) {
        console.log('[META-SYSOP] Resolved pending approval for session:', sessionId);
      }
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

    // Resolve the pending approval with false (rejected)
    if (sessionId) {
      const { resolvePendingApproval } = await import('../platformRoutes');
      const resolved = resolvePendingApproval(sessionId, false);
      if (resolved) {
        console.log('[META-SYSOP] Resolved pending approval (rejected) for session:', sessionId);
      }
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

    res.json({ messages });
  } catch (error: any) {
    console.error('[META-SYSOP-CHAT] Error loading history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stream Meta-SySop chat response
router.post('/stream', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { message, autoCommit = false, autoPush = false } = req.body;
    const userId = req.authenticatedUserId;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(503).json({ error: 'Anthropic API key not configured' });
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (type: string, data: any) => {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

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

    sendEvent('user_message', { messageId: userMsg.id });

    // Meta-SySop will create task lists ONLY when actually building
    // Not for questions, diagnostics, or exploration
    sendEvent('progress', { message: '🧠 Analyzing your request...' });
    
    // Track task list ID if created during conversation
    let activeTaskListId: string | undefined;

    // Create backup before any changes (non-blocking - continue even if it fails)
    let backup: any = null;
    try {
      backup = await platformHealing.createBackup(`Meta-SySop session: ${message.slice(0, 50)}`);
      sendEvent('progress', { message: 'Backup created successfully' });
    } catch (backupError: any) {
      console.warn('[META-SYSOP-CHAT] Backup creation failed (non-critical):', backupError.message);
      sendEvent('progress', { message: 'Proceeding without backup (production mode)' });
    }

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

    // Add current user message
    conversationMessages.push({
      role: 'user',
      content: message,
    });

    const systemPrompt = `You are Meta-SySop - AUTONOMOUS ORCHESTRATOR for platform maintenance.

═══════════════════════════════════════════════════════════════════
🧠 CONVERSATIONAL INTELLIGENCE - READ THIS FIRST!
═══════════════════════════════════════════════════════════════════

**NOT EVERY MESSAGE IS A BUILD REQUEST!**

Before doing ANYTHING, classify the user's intent:

📊 **QUESTION / INQUIRY** - User wants information:
- "What's causing the high CPU usage?"
- "Can you check if there are any errors in the logs?"
- "What files handle authentication?"
- "How does the payment system work?"
→ RESPONSE: Use diagnosis/read tools, explain findings, DON'T modify anything

🔍 **DIAGNOSTIC REQUEST** - User wants analysis:
- "Diagnose the performance issues"
- "Check for security vulnerabilities"
- "Analyze the database schema"
→ RESPONSE: Use perform_diagnosis(), readPlatformFile(), explain what you found

💬 **EXPLORATION / DISCUSSION** - User is exploring options:
- "How would we add a new feature X?"
- "What's the best way to improve Y?"
- "Should we refactor Z?"
→ RESPONSE: Read relevant files, discuss approach, propose options, WAIT for confirmation

🔨 **BUILD REQUEST** - User wants changes made:
- "Fix the memory leak in websocket.ts"
- "Add authentication to the API"
- "Deploy the new feature"
- "User approved the changes. Proceed with..."
→ RESPONSE: Follow the ORCHESTRATION WORKFLOW below

**GOLDEN RULE:**
When in doubt → ASK! Say "Would you like me to proceed with making these changes?"
NEVER assume a question = "build this now"

═══════════════════════════════════════════════════════════════════
🎭 YOUR ROLE: ORCHESTRATOR, NOT WORKER
═══════════════════════════════════════════════════════════════════
You are a CONDUCTOR leading an orchestra, not a solo performer.

ORCHESTRATOR MINDSET:
✅ Delegate complex work to specialized sub-agents
✅ Run multiple workstreams in PARALLEL
✅ Monitor progress while agents work
✅ Review quality before marking complete
✅ Coordinate agents toward the goal

❌ DON'T do everything yourself
❌ DON'T work sequentially when you can parallelize
❌ DON'T skip quality reviews
❌ DON'T assume every message is a build request!

═══════════════════════════════════════════════════════════════════
✅ TASK LIST ALREADY CREATED!
═══════════════════════════════════════════════════════════════════
Users are watching LIVE via TaskBoard UI.
First action: readTaskList() to see your task IDs!

═══════════════════════════════════════════════════════════════════
🎯 ORCHESTRATION WORKFLOW:
═══════════════════════════════════════════════════════════════════

PHASE 1: DIAGNOSE & PLAN (Turn 1)
→ readTaskList() - Get task IDs
→ perform_diagnosis() - Identify root causes FIRST
→ read_logs() / execute_sql() - Gather evidence if needed
→ DECISION: Can I delegate? Is this complex enough for sub-agents?

PHASE 2: REQUEST APPROVAL (Turn 2) 🔔 NEW!
→ request_user_approval() - Explain proposed changes and get user approval
→ Include: summary, filesChanged[], estimatedImpact
→ WAIT for user approval before proceeding
→ Do NOT make any changes until approved!

PHASE 3: DELEGATE OR EXECUTE (Turn 3)
→ COMPLEX TASK? → start_subagent() to delegate specialized work
→ SIMPLE TASK? → architect_consult() + write files yourself
→ PARALLEL WORK? → Launch MULTIPLE sub-agents simultaneously

PHASE 4: MONITOR & REVIEW (Turn 4)
→ WHILE sub-agents work: Monitor via updateTask() 
→ AFTER completion: REVIEW their work (read files, check quality)
→ IF quality issues: Fix or delegate again
→ IF good: Proceed to deploy

PHASE 5: DEPLOY (Turn 5)
→ commit_to_github() - Push to production
→ updateTask() all tasks to completed

═══════════════════════════════════════════════════════════════════
🔔 APPROVAL WORKFLOW (Replit Agent Style):
═══════════════════════════════════════════════════════════════════

**WHEN TO REQUEST APPROVAL:**
✅ ALWAYS call request_user_approval() BEFORE making platform changes
✅ After analyzing the problem and planning your solution
✅ Before calling architect_consult or start_subagent

**APPROVAL REQUEST FORMAT:**
- Summary: Clear explanation of problem and solution
- Files Changed: List all files to be modified/created/deleted
- Estimated Impact: "low" (config), "medium" (features), "high" (architecture)

**WHAT HAPPENS:**
1. You call request_user_approval(summary, filesChanged, estimatedImpact)
2. System sends request to user via UI
3. Conversation PAUSES - you cannot continue
4. User approves or rejects via separate endpoint
5. If approved: Continue with changes in next conversation
6. If rejected: Explain why and propose alternatives

**CRITICAL RULES:**
❌ DO NOT make changes before calling request_user_approval
❌ DO NOT continue after request_user_approval (conversation pauses)
✅ Always explain clearly what you'll change and why
✅ Be transparent about risks and impact

═══════════════════════════════════════════════════════════════════
🤝 WHEN TO DELEGATE vs DO YOURSELF:
═══════════════════════════════════════════════════════════════════

DELEGATE (start_subagent):
✅ Multi-file refactoring (3+ files)
✅ Complex logic changes requiring deep focus
✅ Database migrations or schema changes
✅ Performance optimization (needs testing)
✅ New feature implementation
✅ Security fixes requiring careful review
✅ PARALLEL: Multiple independent fixes

DO YOURSELF:
✅ Simple 1-file fixes
✅ Configuration changes
✅ Typo corrections
✅ Quick patches (< 20 lines)

═══════════════════════════════════════════════════════════════════
🚀 PARALLEL EXECUTION PATTERN:
═══════════════════════════════════════════════════════════════════

EXAMPLE: "Fix UI bugs + optimize database + update docs"

❌ WRONG (Sequential - 3 turns):
Turn 1: Fix UI → wait
Turn 2: Optimize DB → wait  
Turn 3: Update docs → wait

✅ CORRECT (Parallel - 1 turn):
Turn 1: Launch ALL three at once:
  start_subagent({ task: "Fix UI button alignment in header.tsx" })
  start_subagent({ task: "Add database indexes for projects table" })
  start_subagent({ task: "Update deployment docs with new steps" })

Sub-agents work simultaneously → All done together!

═══════════════════════════════════════════════════════════════════
🔍 QUALITY GATE PATTERN:
═══════════════════════════════════════════════════════════════════

BEFORE marking tasks complete:
1. READ modified files → Verify changes are correct
2. CHECK for issues → Does it solve the problem?
3. VERIFY no bugs introduced → Read surrounding code
4. ONLY THEN → updateTask(status: "completed")

DON'T TRUST - VERIFY:
❌ "Subagent said it's done" → Mark complete immediately
✅ "Subagent said it's done" → Read files → Verify → Then complete

═══════════════════════════════════════════════════════════════════
🚫 ABSOLUTE RULE: NEVER LIE ABOUT RESULTS
═══════════════════════════════════════════════════════════════════

❌ FORBIDDEN - Claiming success BEFORE results:
"Done!" "Fixed!" "Deployed!" → YOU DON'T KNOW YET!

✅ REQUIRED - Wait, then report FACTS:
<tool call> → WAIT → See result → Report outcome

═══════════════════════════════════════════════════════════════════
🔧 YOUR ORCHESTRATION TOOLS:
═══════════════════════════════════════════════════════════════════

ORCHESTRATION:
start_subagent() - Delegate complex work to specialists (USE THIS!)
request_user_approval() - 🔔 Request user approval BEFORE making changes

DIAGNOSIS:
readTaskList() - Get task IDs (CALL THIS FIRST!)
perform_diagnosis() - Find root causes before fixing
read_logs() - Diagnose crashes/errors
execute_sql() - Query database issues

EXECUTION:
updateTask() - Update progress as work happens
readPlatformFile() - Read files
architect_consult() - Get I AM approval (after user approval)
writePlatformFile() - Modify files (REQUIRES user + I AM approval)
createPlatformFile() - Create files (REQUIRES user + I AM approval)
deletePlatformFile() - Delete files (REQUIRES user + I AM approval)

DEPLOYMENT:
commit_to_github() - Push to production (after changes complete)

UTILITIES:
listPlatformFiles() - Browse directories
web_search() - Look up docs (RARELY needed)

═══════════════════════════════════════════════════════════════════
📋 CURRENT REQUEST:
═══════════════════════════════════════════════════════════════════

${message}

THINK LIKE AN ORCHESTRATOR:
1. Can I delegate parts of this?
2. Can I run work in parallel?
3. What's the fastest path using sub-agents?

EXECUTE NOW - Diagnose, delegate, monitor, review, deploy!`;

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
        name: 'listPlatformFiles',
        description: 'List files in a directory',
        input_schema: {
          type: 'object' as const,
          properties: {
            directory: { type: 'string' as const, description: 'Directory path' },
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
        description: 'Create a new platform file. REQUIRES architect approval - call architect_consult first!',
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
        description: 'Delete an obsolete platform file. REQUIRES architect approval - call architect_consult first!',
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
        description: 'Execute SQL query to diagnose or fix database issues. Use SELECT for diagnosis, UPDATE/DELETE for fixes (requires I AM approval for mutations)',
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
        description: 'CRITICAL: Consult I AM (The Architect) for expert code review before making changes. ALWAYS use this before committing platform modifications.',
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

    const client = new Anthropic({ apiKey: anthropicKey });
    let fullContent = '';
    const fileChanges: Array<{ path: string; operation: string; contentAfter?: string }> = [];
    let continueLoop = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 5;
    let commitSuccessful = false; // Track if commit_to_github succeeded

    // Track architect approval for enforcement (per-file approval map)
    const approvedFiles = new Map<string, { approved: boolean; timestamp: number }>();

    // Normalize file paths to prevent bypasses (./path, ../path, etc)
    const normalizePath = (filePath: string): string => {
      // Remove leading ./ and resolve ../ patterns
      return filePath
        .replace(/^\.\//, '')
        .replace(/\/\.\//g, '/')
        .replace(/[^\/]+\/\.\.\//g, '')
        .trim();
    };

    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      sendEvent('progress', { message: `Analyzing (iteration ${iterationCount}/${MAX_ITERATIONS})...` });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: conversationMessages,
        tools,
        stream: false, // We'll handle our own streaming
      });

      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // 🎯 OPTION 1 ENFORCEMENT: First response should use tools (not just text)
      if (iterationCount === 1) {
        const hasToolCalls = response.content.some(block => block.type === 'tool_use');

        console.log('[META-SYSOP-ENFORCEMENT] Iteration 1 check:');
        console.log('  - Has tool calls:', hasToolCalls);
        console.log('  - Content blocks:', response.content.map(b => b.type).join(', '));

        if (!hasToolCalls) {
          // Force retry - Meta-SySop typed text instead of calling tools
          console.error('[META-SYSOP-ENFORCEMENT] ❌ No tool calls on first response - REJECTING & RETRYING');
          sendEvent('error', { message: '❌ Must call tools (not type text) - retrying...' });

          const errorMessage = `ERROR: Your first response must include TOOL CALLS, not just text.

Users are watching tasks in real-time via TaskBoard. A task list was PRE-CREATED for you.

Instead of typing "### NEXT ACTIONS" or "Let me check...", you MUST call tools:

1. readTaskList() - See your task IDs
2. updateTask(taskId, "in_progress") - Mark progress
3. readPlatformFile() - Read files you need
4. architect_consult() - Get approval
5. writePlatformFile() - Make changes
6. commit_to_github() - Deploy

RETRY NOW - Call readTaskList() first to see task IDs, then start working!`;

          conversationMessages.push({
            role: 'user',
            content: errorMessage,
          });

          console.log('[META-SYSOP-ENFORCEMENT] Added error message to conversation - continuing loop');
          continue; // Retry loop
        } else {
          console.log('[META-SYSOP-ENFORCEMENT] ✅ Tool calls detected on first response - proceeding');
        }
      }

      const toolResults: any[] = [];
      const hasToolUse = response.content.some(block => block.type === 'tool_use');

      // 🎯 ANTI-LYING ENFORCEMENT: If response contains tool calls, SUPPRESS all text blocks
      // Meta-SySop must wait for tool results before claiming success
      if (hasToolUse) {
        console.log('[META-SYSOP-ENFORCEMENT] Response has tool calls - suppressing text blocks to prevent lying');
        sendEvent('progress', { message: 'Executing tools...' });
      }

      for (const block of response.content) {
        if (block.type === 'text') {
          // Only stream text if there are NO tool calls in this response
          // If there are tool calls, Meta-SySop must wait for results before speaking
          if (!hasToolUse) {
            fullContent += block.text;
            sendEvent('content', { content: block.text });
          } else {
            console.log('[META-SYSOP-ENFORCEMENT] Blocked text output (has tool calls):', block.text.slice(0, 100));
          }
        } else if (block.type === 'tool_use') {
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
                  toolResult = `No active task list found. A task list should have been pre-created. Proceed with your work - the task list will be available in the next turn.`;
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

              // CRITICAL ENFORCEMENT: Check per-file approval
              const approval = approvedFiles.get(normalizePath(typedInput.path));

              if (!approval) {
                toolResult = `❌ BLOCKED: File "${typedInput.path}" has no architect approval. You must consult I AM (architect_consult) and get explicit approval for this file.`;
                console.error(`[META-SYSOP] Blocked writePlatformFile for ${typedInput.path} - no approval found`);
                sendEvent('error', { message: `File write blocked - no approval for ${typedInput.path}` });
              } else if (!approval.approved) {
                toolResult = `❌ BLOCKED: I AM rejected changes to "${typedInput.path}". You cannot proceed with this file modification.`;
                console.error(`[META-SYSOP] Blocked writePlatformFile for ${typedInput.path} - approval was rejected`);
                sendEvent('error', { message: `File write blocked - ${typedInput.path} was rejected` });
              } else {
                console.log(`[META-SYSOP] writePlatformFile called for: ${typedInput.path}`);
                console.log(`[META-SYSOP] Content type: ${typeof typedInput.content}`);
                console.log(`[META-SYSOP] Content defined: ${typedInput.content !== undefined}`);
                console.log(`[META-SYSOP] Content length: ${typedInput.content?.length || 0} bytes`);

                sendEvent('progress', { message: `✅ Modifying ${typedInput.path} (I AM approved)...` });
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
                toolResult = `✅ File written successfully (with I AM approval at ${new Date(approval.timestamp).toISOString()})`;
              }
            } else if (name === 'listPlatformFiles') {
              const typedInput = input as { directory: string };
              sendEvent('progress', { message: `Listing files in ${typedInput.directory}...` });
              const files = await platformHealing.listPlatformFiles(typedInput.directory);
              toolResult = files.join('\n');
            } else if (name === 'architect_consult') {
              const typedInput = input as { 
                problem: string; 
                context: string; 
                proposedSolution: string;
                affectedFiles: string[];
              };
              sendEvent('progress', { message: '🏗️ Consulting I AM (The Architect) for code review...' });

              const architectResult = await consultArchitect({
                problem: typedInput.problem,
                context: typedInput.context,
                previousAttempts: [],
                codeSnapshot: `Proposed Solution:\n${typedInput.proposedSolution}\n\nAffected Files:\n${typedInput.affectedFiles.join('\n')}`
              });

              const timestamp = Date.now();

              if (architectResult.success) {
                // Store per-file approval status (updates existing entries with latest approval)
                const normalizedFiles = typedInput.affectedFiles.map(normalizePath);
                normalizedFiles.forEach(filePath => {
                  approvedFiles.set(filePath, { approved: true, timestamp });
                });

                sendEvent('progress', { message: `✅ I AM approved ${normalizedFiles.length} files` });
                toolResult = `✅ APPROVED by I AM (The Architect)\n\n${architectResult.guidance}\n\nRecommendations:\n${architectResult.recommendations.join('\n')}\n\nYou may now proceed to modify these files:\n${normalizedFiles.map(f => `- ${f} (approved at ${new Date(timestamp).toISOString()})`).join('\n')}\n\nNote: Each file approval is tracked individually. You can modify these files in any order.`;
              } else {
                // Store rejection status for these files
                const normalizedFiles = typedInput.affectedFiles.map(normalizePath);
                normalizedFiles.forEach(filePath => {
                  approvedFiles.set(filePath, { approved: false, timestamp });
                });

                sendEvent('error', { message: `❌ I AM rejected ${normalizedFiles.length} files` });
                toolResult = `❌ REJECTED by I AM (The Architect)\n\nReason: ${architectResult.error}\n\nRejected files:\n${normalizedFiles.map(f => `- ${f}`).join('\n')}\n\nYou CANNOT proceed with these modifications. Either:\n1. Revise your approach and consult I AM again with a different proposal\n2. Abandon these changes`;
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
              
              toolResult = `✅ Approval request sent to user.\n\nSummary: ${typedInput.summary}\n\nFiles: ${typedInput.filesChanged.join(', ')}\n\nImpact: ${typedInput.estimatedImpact}\n\nWaiting for user to approve or reject...`;
              
              // PAUSE the conversation loop - wait for external approval
              continueLoop = false;
              console.log('[META-SYSOP] Approval requested - pausing conversation');
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

              // CRITICAL ENFORCEMENT: Check per-file approval
              const approval = approvedFiles.get(normalizePath(typedInput.path));

              if (!approval) {
                toolResult = `❌ BLOCKED: File "${typedInput.path}" has no architect approval. You must consult I AM (architect_consult) and get explicit approval for this file.`;
                console.error(`[META-SYSOP] Blocked createPlatformFile for ${typedInput.path} - no approval found`);
                sendEvent('error', { message: `File creation blocked - no approval for ${typedInput.path}` });
              } else if (!approval.approved) {
                toolResult = `❌ BLOCKED: I AM rejected changes to "${typedInput.path}". You cannot proceed with this file creation.`;
                console.error(`[META-SYSOP] Blocked createPlatformFile for ${typedInput.path} - approval was rejected`);
                sendEvent('error', { message: `File creation blocked - ${typedInput.path} was rejected` });
              } else {
                sendEvent('progress', { message: `✅ Creating ${typedInput.path} (I AM approved)...` });
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
                toolResult = `✅ File created successfully (with I AM approval at ${new Date(approval.timestamp).toISOString()})`;
              }
            } else if (name === 'deletePlatformFile') {
              const typedInput = input as { path: string };

              console.log(`[META-SYSOP] Deleting file: ${typedInput.path}`);

              // CRITICAL ENFORCEMENT: Check per-file approval
              const approval = approvedFiles.get(normalizePath(typedInput.path));

              if (!approval) {
                toolResult = `❌ BLOCKED: File "${typedInput.path}" has no architect approval. You must consult I AM (architect_consult) and get explicit approval for this file deletion.`;
                console.error(`[META-SYSOP] Blocked deletePlatformFile for ${typedInput.path} - no approval found`);
                sendEvent('error', { message: `File deletion blocked - no approval for ${typedInput.path}` });
              } else if (!approval.approved) {
                toolResult = `❌ BLOCKED: I AM rejected deletion of "${typedInput.path}". You cannot proceed with this file deletion.`;
                console.error(`[META-SYSOP] Blocked deletePlatformFile for ${typedInput.path} - approval was rejected`);
                sendEvent('error', { message: `File deletion blocked - ${typedInput.path} was rejected` });
              } else {
                sendEvent('progress', { message: `✅ Deleting ${typedInput.path} (I AM approved)...` });
                await platformHealing.deletePlatformFile(typedInput.path);

                // Track file changes for batch commits
                fileChanges.push({ 
                  path: typedInput.path, 
                  operation: 'delete'
                });

                sendEvent('file_change', { file: { path: typedInput.path, operation: 'delete' } });
                toolResult = `✅ File deleted successfully (with I AM approval at ${new Date(approval.timestamp).toISOString()})`;
              }
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
                // Detect mutation queries (UPDATE, DELETE, INSERT, DROP, ALTER, TRUNCATE)
                const queryUpperCase = typedInput.query.trim().toUpperCase();
                const isMutation = /^(UPDATE|DELETE|INSERT|DROP|ALTER|TRUNCATE|CREATE)\s/i.test(queryUpperCase);

                if (isMutation) {
                  // CRITICAL: Require architect approval for mutations
                  // We'll use a special approval key for SQL mutations
                  const sqlApprovalKey = `SQL_MUTATION:${typedInput.purpose}`;
                  const approval = approvedFiles.get(sqlApprovalKey);

                  if (!approval || !approval.approved) {
                    toolResult = `❌ BLOCKED: SQL mutation requires I AM (architect) approval!\n\n` +
                      `Query type: MUTATION (${queryUpperCase.split(/\s+/)[0]})\n` +
                      `Purpose: ${typedInput.purpose}\n` +
                      `Query: ${typedInput.query}\n\n` +
                      `You must consult I AM (architect_consult) and get explicit approval before executing mutation queries.\n` +
                      `Include this in affectedFiles: ["${sqlApprovalKey}"]`;
                    console.error(`[META-SYSOP] Blocked SQL mutation - no approval`);
                    sendEvent('error', { message: `SQL mutation blocked - requires I AM approval` });
                  } else {
                    sendEvent('progress', { message: `✅ Executing mutation (I AM approved)...` });
                    const result = await db.execute(typedInput.query as any);
                    
                    toolResult = `✅ SQL mutation executed successfully (with I AM approval)\n\n` +
                      `Purpose: ${typedInput.purpose}\n` +
                      `Query: ${typedInput.query}\n` +
                      `Result: ${JSON.stringify(result, null, 2)}`;
                    
                    sendEvent('progress', { message: `✅ Mutation completed` });
                  }
                } else {
                  // SELECT queries don't need approval
                  sendEvent('progress', { message: `Executing SELECT query...` });
                  const result = await db.execute(typedInput.query as any);
                  
                  toolResult = `✅ SQL query executed successfully\n\n` +
                    `Purpose: ${typedInput.purpose}\n` +
                    `Query: ${typedInput.query}\n` +
                    `Rows returned: ${Array.isArray(result) ? result.length : 'N/A'}\n` +
                    `Result:\n${JSON.stringify(result, null, 2)}`;
                  
                  sendEvent('progress', { message: `✅ Query returned ${Array.isArray(result) ? result.length : 0} rows` });
                }
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

      if (toolResults.length > 0) {
        conversationMessages.push({
          role: 'user',
          content: toolResults,
        });
      } else {
        // 🎯 FINAL VALIDATION: Don't end loop unless all tasks are actually complete
        const finalCheck = await readTaskList({ userId });

        if (!finalCheck.success) {
          // CRITICAL: If readTaskList fails, BLOCK session end (don't allow silent continuation)
          console.error('[META-SYSOP-ANTI-LYING] readTaskList failed - cannot verify tasks complete!');
          sendEvent('error', { message: 'Cannot verify task completion - retrying...' });

          const errorMessage = `❌ ERROR: Cannot verify task completion status!\n\n` +
            `Task verification failed: ${finalCheck.error}\n\n` +
            `You MUST ensure all tasks are completed before ending. Call readTaskList() to verify, then complete any remaining tasks.`;

          conversationMessages.push({
            role: 'user',
            content: errorMessage,
          });
          continue; // Force retry - do NOT allow loop end
        }

        if (finalCheck.taskLists) {
          const activeList = finalCheck.taskLists.find((list: any) => list.status === 'active');
          if (activeList) {
            const incompleteTasks = activeList.tasks.filter((t: any) => t.status !== 'completed');
            if (incompleteTasks.length > 0) {
              console.error('[META-SYSOP-ANTI-LYING] Blocked loop end - tasks incomplete:', incompleteTasks.map((t: any) => t.title));
              sendEvent('error', { message: `Cannot finish - ${incompleteTasks.length} tasks incomplete` });

              // Force Meta-SySop to continue working
              const errorMessage = `❌ BLOCKED: Cannot end session with incomplete tasks!\n\n` +
                `Incomplete tasks (${incompleteTasks.length}):\n` +
                incompleteTasks.map((t: any) => `- ${t.title} (${t.status})`).join('\n') +
                `\n\nYou must complete ALL tasks before finishing. Call updateTask() to mark remaining tasks complete.`;

              conversationMessages.push({
                role: 'user',
                content: errorMessage,
              });
              continue; // Force another iteration
            }
          }
        }

        // ✅ ALL VALIDATIONS PASSED: Tasks verified complete, safe to end session
        console.log('[META-SYSOP-ENFORCEMENT] ✅ All tasks verified complete - ending session');
        continueLoop = false;
      }
    }

    // Safety check
    sendEvent('progress', { message: 'Running safety checks...' });
    const safety = await platformHealing.validateSafety();

    if (!safety.safe) {
      if (backup?.id) {
        await platformHealing.rollback(backup.id);
        sendEvent('error', { 
          message: `Safety check failed: ${safety.issues.join(', ')}. Changes rolled back.` 
        });
      } else {
        sendEvent('error', { 
          message: `Safety check failed: ${safety.issues.join(', ')}. No backup available to rollback.` 
        });
      }
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

    // Commit and push if enabled
    let commitHash = '';
    if (autoCommit && fileChanges.length > 0) {
      // CRITICAL ENFORCEMENT: Verify ALL files in fileChanges have approval
      const unapprovedFiles: string[] = [];
      for (const change of fileChanges) {
        const normalizedPath = normalizePath(change.path);
        const approval = approvedFiles.get(normalizedPath);
        if (!approval || !approval.approved) {
          unapprovedFiles.push(normalizedPath);
        }
      }

      if (unapprovedFiles.length > 0) {
        sendEvent('error', { 
          message: `❌ AUTO-COMMIT BLOCKED: ${unapprovedFiles.length} file(s) lack I AM approval: ${unapprovedFiles.join(', ')}` 
        });
        console.error('[META-SYSOP] Blocked auto-commit - unapproved files:', unapprovedFiles);

        if (backup?.id) {
          await platformHealing.rollback(backup.id);
          sendEvent('progress', { message: 'All changes rolled back due to unapproved files in commit' });
        }

        res.end();
        return;
      }

      sendEvent('progress', { message: `✅ Committing ${fileChanges.length} file changes (all I AM approved)...` });
      commitHash = await platformHealing.commitChanges(`Fix: ${message.slice(0, 100)}`, fileChanges as any);

      if (autoPush) {
        sendEvent('progress', { message: '✅ Pushing to GitHub (deploying to production - all files I AM approved)...' });
        await platformHealing.pushToRemote();
      }
    }

    // 🎯 FINAL ANTI-LYING CHECK: Only allow completion message if we verified tasks are complete
    let finalMessage = fullContent;
    if (!finalMessage) {
      // If fullContent is empty (all text suppressed), verify tasks before using default message
      const verifyCheck = await readTaskList({ userId });
      if (verifyCheck.success && verifyCheck.taskLists) {
        const activeList = verifyCheck.taskLists.find((list: any) => list.status === 'active');
        if (activeList) {
          const allComplete = activeList.tasks.every((t: any) => t.status === 'completed');
          if (allComplete) {
            finalMessage = '✅ All tasks completed successfully!';
          } else {
            finalMessage = '⚠️ Session ended but not all tasks completed. Please review task status.';
          }
        } else {
          finalMessage = '✅ Analysis complete!';
        }
      } else {
        finalMessage = '⚠️ Session ended. Task verification unavailable.';
      }
    }

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
      backupId: backup?.id || null,
      commitHash,
      status: 'success',
    });

    sendEvent('done', { messageId: assistantMsg.id, commitHash, filesChanged: fileChanges.length });
    res.end();
  } catch (error: any) {
    console.error('[META-SYSOP-CHAT] Stream error:', error);
    const errorMessage = JSON.stringify({ type: 'error', message: error.message });
    res.write(`data: ${errorMessage}\n\n`);
    res.end();
  }
});

export default router;