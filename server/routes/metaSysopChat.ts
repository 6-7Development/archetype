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
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

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

    // 🎯 Check for existing active task list or create new one
    // Prevents duplicate task lists across conversation
    sendEvent('progress', { message: 'Preparing task tracking...' });
    
    const existingLists = await readTaskList({ userId, projectId: undefined });
    let activeTaskListId: string | undefined;
    
    if (existingLists.success && existingLists.taskLists) {
      const activeList = existingLists.taskLists.find((list: any) => list.status === 'active');
      if (activeList) {
        activeTaskListId = activeList.id;
        sendEvent('progress', { message: `✅ Using existing task list - see live progress above!` });
        sendEvent('task_list_created', { taskListId: activeList.id });
      }
    }
    
    // Only create new task list if no active one exists
    if (!activeTaskListId) {
      const initialTaskResult = await createTaskList({
        userId,
        projectId: undefined,
        chatMessageId: userMsg.id,
        title: `Platform Healing: ${message.slice(0, 50)}`,
        description: 'Meta-SySop is analyzing your request and will update these tasks as work progresses.',
        tasks: [
          { title: 'Analyze request and identify files to modify', status: 'in_progress' },
          { title: 'Read relevant platform files', status: 'pending' },
          { title: 'Consult I AM (The Architect) for approval', status: 'pending' },
          { title: 'Implement approved changes', status: 'pending' },
          { title: 'Deploy to production via GitHub', status: 'pending' },
        ],
      });
      
      if (initialTaskResult.success) {
        activeTaskListId = initialTaskResult.taskListId;
        sendEvent('task_list_created', { taskListId: initialTaskResult.taskListId });
        sendEvent('progress', { message: `✅ Task list created - see live progress above!` });
      } else {
        console.warn('[META-SYSOP] Failed to pre-create task list:', initialTaskResult.error);
      }
    }

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

    const systemPrompt = `You are Meta-SySop - AUTONOMOUS platform maintenance AI.

✅ TASK LIST ALREADY CREATED FOR YOU!
═══════════════════════════════════════════════════════════════════
A basic task list has been pre-created. Users are watching it LIVE via TaskBoard UI.

YOUR JOB: Update tasks as you work using updateTask(taskId, status)

First action: Call readTaskList() to see task IDs, then start working!

═══════════════════════════════════════════════════════════════════
🚫 ABSOLUTE RULE #1: NEVER LIE ABOUT RESULTS
═══════════════════════════════════════════════════════════════════

❌ FORBIDDEN - Claiming success BEFORE getting results:
"Done! I've fixed the issue."           → YOU DON'T KNOW YET!
"Perfect! Changes deployed."             → YOU DON'T KNOW YET!
"Modified Files (1)"                     → YOU DON'T KNOW YET!
"I AM approved the changes"              → YOU DON'T KNOW YET!

✅ REQUIRED - Wait for tool results, then report FACTS:
<invoke tool> → WAIT → Get result → "Tool succeeded" OR "Tool failed"

EVERY response with tool calls MUST be:
1. Tool calls ONLY (no text)
2. OR tool calls + "Waiting for results..."
3. NEVER claim success until you SEE the success result

═══════════════════════════════════════════════════════════════════
🎯 3-STEP WORKFLOW (NO EXCEPTIONS):
═══════════════════════════════════════════════════════════════════

STEP 1: READ TASK LIST & FILES (ONE TURN)
→ readTaskList() FIRST - get your task IDs!
→ updateTask() to mark "Analyze request" as completed
→ updateTask() to mark "Read files" as in_progress
→ readPlatformFile() for ONLY the files you'll modify (max 2-3 files)

STEP 2: GET APPROVAL & FIX (ONE TURN)  
→ architect_consult() with your proposed changes
→ IF APPROVED: writePlatformFile() for each file IMMEDIATELY
→ updateTask() to mark tasks completed

STEP 3: DEPLOY (ONE TURN)
→ commit_to_github() with commit message
→ DONE - report completion

═══════════════════════════════════════════════════════════════════
❌ FORBIDDEN BEHAVIORS (INSTANT FAILURE):
═══════════════════════════════════════════════════════════════════

• Claiming "Done!" or "Fixed!" BEFORE seeing tool results
• Saying "Modified Files (1)" when tool calls haven't returned yet
• Writing "Perfect! Deployed!" before commit_to_github() returns
• Writing "### NEXT ACTIONS" or "### PLAN" as text - CALL updateTask() instead!
• Typing out numbered lists like "1. Fix X, 2. Do Y" - CALL updateTask() instead!
• Saying "Let me check..." or "I'll implement..." - CALL THE TOOLS NOW!
• Writing "Would you like me to..." - NO! Just do it autonomously!
• Asking "should I...?" or "What's your priority?" - YOU decide and act!
• Describing what you "plan to do" - DO IT with tool calls instead!
• Multiple rounds of investigation - ONE round max, then ACT!

═══════════════════════════════════════════════════════════════════
✅ CORRECT EXECUTION EXAMPLE:
═══════════════════════════════════════════════════════════════════

TURN 1 (Read Tasks + Files):
readTaskList()  // Get your task IDs first!
updateTask({ taskId: "task-xxx-1", status: "completed" })  // Mark "Analyze" done
updateTask({ taskId: "task-xxx-2", status: "in_progress" })  // Start "Read files"
readPlatformFile({ path: "client/src/components/chat.tsx" })
updateTask({ taskId: "task-xxx-2", status: "completed" })  // Mark "Read files" done

TURN 2 (Approve + Fix):
architect_consult({
  problem: "Chat messages display in wrong order",
  context: "Current code shows oldest first",
  proposedSolution: "Reverse array before mapping: messages.reverse().map(...)",
  affectedFiles: ["client/src/components/chat.tsx"]
})
// After approval:
writePlatformFile({ path: "client/src/components/chat.tsx", content: "..." })
updateTask({ taskId: "task-1", status: "completed" })
updateTask({ taskId: "task-2", status: "completed" })
updateTask({ taskId: "task-3", status: "completed" })

TURN 3 (Deploy):
commit_to_github({ commitMessage: "Fix chat message display order" })
updateTask({ taskId: "task-4", status: "completed" })

═══════════════════════════════════════════════════════════════════
🔧 YOUR TOOLS:
═══════════════════════════════════════════════════════════════════

readTaskList() - Get task IDs (CALL THIS FIRST!)
updateTask() - Mark tasks in_progress/completed as you work
readPlatformFile() - Read files you'll modify (max 3)
architect_consult() - Get approval ONCE before writing
writePlatformFile() - Modify approved files (REQUIRES approval)
commit_to_github() - Deploy changes to production
listPlatformFiles() - Find files if needed
web_search() - Look up docs (RARELY needed)

═══════════════════════════════════════════════════════════════════
📋 CURRENT REQUEST:
═══════════════════════════════════════════════════════════════════

${message}

EXECUTE NOW - Read task list, update progress, get approval, write files, deploy. 3 turns maximum!`;

    const tools = [
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
                          break; // Skip the updateTask call entirely
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
                        break; // Skip the updateTask call entirely
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
              const normalizedPath = normalizePath(typedInput.path);
              
              // CRITICAL ENFORCEMENT: Check per-file approval
              const approval = approvedFiles.get(normalizedPath);
              
              if (!approval) {
                toolResult = `❌ BLOCKED: File "${normalizedPath}" has no architect approval. You must consult I AM (architect_consult) and get explicit approval for this file.`;
                console.error(`[META-SYSOP] Blocked writePlatformFile for ${normalizedPath} - no approval found`);
                sendEvent('error', { message: `File write blocked - no approval for ${normalizedPath}` });
              } else if (!approval.approved) {
                toolResult = `❌ BLOCKED: I AM rejected changes to "${normalizedPath}". You cannot proceed with this file modification.`;
                console.error(`[META-SYSOP] Blocked writePlatformFile for ${normalizedPath} - approval was rejected`);
                sendEvent('error', { message: `File write blocked - ${normalizedPath} was rejected` });
              } else {
                console.log(`[META-SYSOP] writePlatformFile called for: ${normalizedPath}`);
                console.log(`[META-SYSOP] Content type: ${typeof typedInput.content}`);
                console.log(`[META-SYSOP] Content defined: ${typedInput.content !== undefined}`);
                console.log(`[META-SYSOP] Content length: ${typedInput.content?.length || 0} bytes`);
                
                sendEvent('progress', { message: `✅ Modifying ${normalizedPath} (I AM approved)...` });
                await platformHealing.writePlatformFile(normalizedPath, typedInput.content);
                
                // Track file changes with content for batch commits
                fileChanges.push({ 
                  path: normalizedPath, 
                  operation: 'modify', 
                  contentAfter: typedInput.content 
                });
                
                sendEvent('file_change', { file: { path: normalizedPath, operation: 'modify' } });
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
                    toolResult = `❌ GitHub integration not configured. Required: GITHUB_TOKEN and GITHUB_REPO environment variables.`;
                    sendEvent('error', { message: 'GitHub not configured' });
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
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: id,
              content: toolResult || 'Success',
            });
          } catch (error: any) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: id,
              is_error: true,
              content: error.message,
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
      console.log(`[META-SYSOP-CLEANUP] Safety passed - checking task list ${activeTaskListId} for incomplete tasks...`);
      const cleanupCheck = await readTaskList({ userId });
      if (cleanupCheck.success && cleanupCheck.taskLists) {
        // CRITICAL: Only clean up THE SPECIFIC task list from THIS session
        const sessionTaskList = cleanupCheck.taskLists.find((list: any) => list.id === activeTaskListId);
        if (sessionTaskList) {
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
                  result: '⚠️ Auto-completed (session ended early)'
                });
                console.log(`[META-SYSOP-CLEANUP] Marked task "${task.title}" as completed (cleanup)`);
              } catch (error: any) {
                console.error(`[META-SYSOP-CLEANUP] Failed to cleanup task ${task.id}:`, error);
              }
            }
            
            // Now mark the task list as completed
            try {
              await db
                .update(taskLists)
                .set({ status: 'completed' })
                .where(eq(taskLists.id, activeTaskListId));
              console.log(`[META-SYSOP-CLEANUP] ✅ Task list ${activeTaskListId} marked as completed (cleanup)`);
            } catch (error: any) {
              console.error('[META-SYSOP-CLEANUP] Failed to cleanup task list:', error);
            }
          } else {
            console.log(`[META-SYSOP-CLEANUP] ✅ All tasks already complete in session task list ${activeTaskListId}`);
          }
        } else {
          console.warn(`[META-SYSOP-CLEANUP] ⚠️ Session task list ${activeTaskListId} not found - skipping cleanup`);
        }
      }
    } else {
      console.warn('[META-SYSOP-CLEANUP] ⚠️ No activeTaskListId tracked - skipping cleanup (this should not happen)');
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
