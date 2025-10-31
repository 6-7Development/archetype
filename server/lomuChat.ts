import { Router } from 'express';
import { db } from '../db';
import { chatMessages } from '@shared/schema';
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

// Get LomuAI chat history
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
    console.error('[LOMUAI-CHAT] Error loading history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stream LomuAI chat response
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

    // Create backup before any changes (non-blocking - continue even if it fails)
    let backup: any = null;
    try {
      backup = await platformHealing.createBackup(`LomuAI session: ${message.slice(0, 50)}`);
      sendEvent('progress', { message: 'Backup created successfully' });
    } catch (backupError: any) {
      console.warn('[LOMUAI-CHAT] Backup creation failed (non-critical):', backupError.message);
      sendEvent('progress', { message: 'Proceeding without backup (production mode)' });
    }

    // Get conversation history for context - OPTIMIZED: Only 10 messages to save tokens
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
      .limit(10); // REDUCED from 20 to save ~5K tokens

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

    // TOKEN EFFICIENCY: Detect if this is a simple task to skip verbose system prompt
    const isSimpleTask = /^(move|fix|change|update|delete|create|add|remove)\s+\w+/i.test(message.trim()) && 
                        message.length < 100 && 
                        !message.toLowerCase().includes('diagnose');

    // TOKEN EFFICIENCY: Skip diagnostics unless explicitly requested
    const needsDiagnosis = message.toLowerCase().includes('diagnose') || 
                          message.toLowerCase().includes('check') ||
                          message.toLowerCase().includes('analyze issues') ||
                          message.toLowerCase().includes('find problems');

    const systemPrompt = isSimpleTask ? 
      // SIMPLE TASK PROMPT (saves ~2K tokens)
      `You are LomuAI, the AI that maintains Archetype platform. Talk like a colleague, not a bot.

For simple fixes: Just do it quietly and report done. No task lists needed.
For complex work: Use task lists and sub-agents.

Read files before writing. Batch changes. One commit at end.
React+Express+PostgreSQL stack. Auto-deploys to Railway.

User request: ${message}` :
      // FULL SYSTEM PROMPT (complex tasks only)  
      `You are LomuAI, an AUTONOMOUS elite AI agent that maintains and fixes the Archetype platform itself.

═══════════════════════════════════════════════════════════════════
⚠️  CRITICAL: You modify PRODUCTION PLATFORM CODE - Be precise!
═══════════════════════════════════════════════════════════════════

🎯 MANDATORY WORKFLOW (FOLLOW EXACTLY):

1️⃣ CREATE TASK LIST (FIRST - ALWAYS!)
   → Call createTaskList() immediately
   → Break down work into 4-6 clear steps
   → Mark first task as "in_progress"

2️⃣ INVESTIGATE & DIAGNOSE
   → Use readPlatformFile() to examine relevant files
   → Use listPlatformFiles() if you need to find files
   → Use web_search() if you need documentation
   → Call updateTask() when starting/completing each step
   → Use readTaskList() to see your task IDs

3️⃣ CONSULT I AM (MANDATORY BEFORE WRITING!)
   → Call architect_consult() with:
     • problem: Clear description of the bug/issue
     • context: What you discovered in your investigation
     • proposedSolution: Exact changes you plan to make
     • affectedFiles: List of files you'll modify
   → Wait for approval before proceeding

4️⃣ IMPLEMENT FIXES (ONLY IF I AM APPROVES!)
   → Call writePlatformFile() for each approved file
   → Update tasks to "completed" as you finish each one
   → Make precise, surgical changes - don't rewrite entire files

5️⃣ AUTO-DEPLOY TO PRODUCTION
   → Call commit_to_github() with detailed commit message
   → This automatically deploys to Render (2-3 min)
   → Mark all tasks "completed"

6️⃣ REPORT COMPLETION
   → Summarize what was fixed
   → List files changed
   → Confirm deployment initiated

═══════════════════════════════════════════════════════════════════
🚫 CRITICAL RULES:
═══════════════════════════════════════════════════════════════════

✅ DO:
  • ALWAYS create task list FIRST (users watch progress live)
  • ALWAYS consult I AM before writing any file
  • ALWAYS update tasks as you work
  • ALWAYS commit when done (auto-deploys to production)
  • Make minimal, surgical changes
  • Read files before modifying them

❌ DO NOT:
  • Ask "should I fix this?" - JUST FIX IT (you're autonomous)
  • Ask permission to deploy - AUTO-DEPLOY with commit_to_github
  • Write files without I AM approval (will be BLOCKED)
  • Modify .git/, node_modules/, .env, package.json
  • Make broad rewrites - be surgical
  • Skip task list creation
  • Skip architect_consult before writing files

═══════════════════════════════════════════════════════════════════
📚 PLATFORM ARCHITECTURE:
═══════════════════════════════════════════════════════════════════

• Frontend: React + TypeScript (client/src/)
• Backend: Express.js (server/)
• Database: PostgreSQL + Drizzle ORM
• Deployment: Render (auto-deploy via GitHub commits)
• AI: Anthropic Claude Sonnet 4

═══════════════════════════════════════════════════════════════════
📋 USER REQUEST:
═══════════════════════════════════════════════════════════════════

${message}

Now execute the workflow autonomously - create tasks, investigate, consult I AM, fix, and deploy!`;

    // TOKEN EFFICIENCY: Build smart tools array based on task complexity
    const basicTools = [
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

    const allTools = [
      {
        name: 'createTaskList',
        description: '**MANDATORY FIRST STEP** - Create a task list to show users live progress. ALWAYS call this before starting work.',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const, description: 'Brief title for this task list (e.g., "Fix chat scrolling")' },
            description: { type: 'string' as const, description: 'Detailed description of what you will do' },
            tasks: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  title: { type: 'string' as const, description: 'Task description' },
                  description: { type: 'string' as const, description: 'Optional task details' },
                  status: { type: 'string' as const, description: 'Status: "pending" or "in_progress"' },
                },
                required: ['title'],
              },
              description: 'Array of tasks to complete',
            },
          },
          required: ['title', 'tasks'],
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
        name: 'readTaskList',
        description: 'Read your current task list to see task IDs and statuses',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      ...basicTools,
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
    ];

    // TOKEN EFFICIENCY: Use appropriate tool set based on task complexity
    const tools = isSimpleTask ? basicTools : allTools;

    const client = new Anthropic({ apiKey: anthropicKey });
    let fullContent = '';
    const fileChanges: Array<{ path: string; operation: string; contentAfter?: string }> = [];
    let continueLoop = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 5;
    
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

    // TOKEN EFFICIENCY: Smart file reading - only read what's needed for specific issues
    const getRelevantFiles = (userMessage: string): string[] => {
      const msg = userMessage.toLowerCase();
      
      // Chat-related issues
      if (msg.includes('chat') || msg.includes('message') || msg.includes('conversation')) {
        return ['client/src/components/Chat.tsx', 'server/routes.ts', 'server/anthropic.ts'];
      }
      
      // Task board issues
      if (msg.includes('task') || msg.includes('progress') || msg.includes('board')) {
        return ['client/src/components/task-board.tsx', 'server/tools/task-management.ts'];
      }
      
      // Auth issues
      if (msg.includes('auth') || msg.includes('login') || msg.includes('user') || msg.includes('permission')) {
        return ['server/universalAuth.ts', 'server/routes.ts'];
      }
      
      // Database issues
      if (msg.includes('database') || msg.includes('db') || msg.includes('sql') || msg.includes('storage')) {
        return ['server/storage.ts', 'server/db.ts'];
      }
      
      // LomuAI specific
      if (msg.includes('meta') || msg.includes('sysop') || msg.includes('platform')) {
        return ['server/lomuChat.ts', 'server/platformHealing.ts'];
      }
      
      // Upload/file issues
      if (msg.includes('upload') || msg.includes('file') || msg.includes('attachment')) {
        return ['client/src/components/Chat.tsx', 'server/routes.ts'];
      }
      
      // Default: return empty array to let AI decide what to read
      return [];
    };

    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      sendEvent('progress', { message: `Working (${iterationCount}/${MAX_ITERATIONS})...` });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: isSimpleTask ? 4000 : 8000, // REDUCED tokens for simple tasks
        system: systemPrompt,
        messages: conversationMessages,
        tools,
        stream: false, // We'll handle our own streaming
      });

      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      });

      const toolResults: any[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          fullContent += block.text;
          sendEvent('content', { content: block.text });
        } else if (block.type === 'tool_use') {
          const { name, input, id } = block;

          try {
            let toolResult: any = null;

            if (name === 'createTaskList') {
              const typedInput = input as { title: string; description?: string; tasks: Array<any> };
              sendEvent('progress', { message: `📋 Creating task list: ${typedInput.title}...` });
              
              const result = await createTaskList({
                userId,
                projectId: undefined, // LomuAI works on platform, not user projects
                chatMessageId: userMsg.id,
                title: typedInput.title,
                description: typedInput.description,
                tasks: typedInput.tasks,
              });
              
              if (result.success) {
                toolResult = `✅ Task list created successfully (ID: ${result.taskListId}).\n\nYou can now update individual tasks as you progress. Use readTaskList() to see task IDs, then updateTask(taskId, status) to mark progress.`;
                sendEvent('task_list_created', { taskListId: result.taskListId });
              } else {
                toolResult = `❌ Failed to create task list: ${result.error}`;
                sendEvent('error', { message: `Task list creation failed: ${result.error}` });
              }
            } else if (name === 'updateTask') {
              const typedInput = input as { taskId: string; status: string; result?: string };
              sendEvent('progress', { message: `Updating task to ${typedInput.status}...` });
              
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
                  toolResult = 'No active task list. Create one with createTaskList().';
                }
              } else {
                toolResult = `Error reading task list: ${result.error}`;
              }
            } else if (name === 'readPlatformFile') {
              const typedInput = input as { path: string };
              
              // TOKEN EFFICIENCY: Skip reading if file is too large and not in relevant list
              const relevantFiles = getRelevantFiles(message);
              const isRelevant = relevantFiles.length === 0 || relevantFiles.some(f => f.includes(typedInput.path) || typedInput.path.includes(f.split('/').pop() || ''));
              
              if (!isRelevant && typedInput.path.includes('storage.ts')) {
                toolResult = `Skipped reading ${typedInput.path} (large file, not relevant to "${message.slice(0, 50)}...")`;
                sendEvent('progress', { message: `Skipped ${typedInput.path} (not relevant)` });
              } else {
                sendEvent('progress', { message: `📖 Reading ${typedInput.path}...` });
                toolResult = await platformHealing.readPlatformFile(typedInput.path);
              }
            } else if (name === 'writePlatformFile') {
              const typedInput = input as { path: string; content: string };
              const normalizedPath = normalizePath(typedInput.path);
              
              // For simple tasks, skip I AM approval requirement
              if (isSimpleTask) {
                console.log(`[LOMUAI] Simple task - writing ${normalizedPath} without I AM approval`);
                sendEvent('progress', { message: `✏️ Fixing ${normalizedPath}...` });
                await platformHealing.writePlatformFile(normalizedPath, typedInput.content);
                
                fileChanges.push({ 
                  path: normalizedPath, 
                  operation: 'modify', 
                  contentAfter: typedInput.content 
                });
                
                sendEvent('file_change', { file: { path: normalizedPath, operation: 'modify' } });
                toolResult = `✅ File updated successfully (simple task bypass)`;
              } else {
                // CRITICAL ENFORCEMENT: Check per-file approval for complex tasks
                const approval = approvedFiles.get(normalizedPath);
                
                if (!approval) {
                  toolResult = `❌ BLOCKED: File "${normalizedPath}" has no architect approval. You must consult I AM (architect_consult) and get explicit approval for this file.`;
                  console.error(`[LOMUAI] Blocked writePlatformFile for ${normalizedPath} - no approval found`);
                  sendEvent('error', { message: `File write blocked - no approval for ${normalizedPath}` });
                } else if (!approval.approved) {
                  toolResult = `❌ BLOCKED: I AM rejected changes to "${normalizedPath}". You cannot proceed with this file modification.`;
                  console.error(`[LOMUAI] Blocked writePlatformFile for ${normalizedPath} - approval was rejected`);
                  sendEvent('error', { message: `File write blocked - ${normalizedPath} was rejected` });
                } else {
                  console.log(`[LOMUAI] writePlatformFile called for: ${normalizedPath}`);
                  
                  sendEvent('progress', { message: `✅ Modifying ${normalizedPath} (I AM approved)...` });
                  await platformHealing.writePlatformFile(normalizedPath, typedInput.content);
                  
                  fileChanges.push({ 
                    path: normalizedPath, 
                    operation: 'modify', 
                    contentAfter: typedInput.content 
                  });
                  
                  sendEvent('file_change', { file: { path: normalizedPath, operation: 'modify' } });
                  toolResult = `✅ File written successfully (with I AM approval at ${new Date(approval.timestamp).toISOString()})`;
                }
              }
            } else if (name === 'listPlatformFiles') {
              const typedInput = input as { directory: string };
              sendEvent('progress', { message: `📂 Listing ${typedInput.directory}...` });
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
                // Store per-file approval (normalized paths) - DON'T overwrite existing approvals
                const normalizedFiles = typedInput.affectedFiles.map(normalizePath);
                normalizedFiles.forEach(filePath => {
                  approvedFiles.set(filePath, { approved: true, timestamp });
                });
                
                sendEvent('progress', { message: `✅ I AM approved ${normalizedFiles.length} files` });
                toolResult = `✅ APPROVED by I AM (The Architect)\n\n${architectResult.guidance}\n\nRecommendations:\n${architectResult.recommendations.join('\n')}\n\nYou may now proceed to modify these files:\n${normalizedFiles.map(f => `- ${f} (approved at ${new Date(timestamp).toISOString()})`).join('\n')}\n\nNote: Each file approval is tracked individually. You can modify these files in any order.`;
              } else {
                // Mark these files as rejected - DON'T overwrite existing approvals
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
        continueLoop = false;
      }
    }

    // Safety check (SKIP for simple tasks to save time)
    if (!isSimpleTask) {
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
    }

    // Commit and push if enabled
    let commitHash = '';
    if (autoCommit && fileChanges.length > 0) {
      // For complex tasks, verify ALL files in fileChanges have approval
      if (!isSimpleTask) {
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
          console.error('[LOMUAI] Blocked auto-commit - unapproved files:', unapprovedFiles);
          
          if (backup?.id) {
            await platformHealing.rollback(backup.id);
            sendEvent('progress', { message: 'All changes rolled back due to unapproved files in commit' });
          }
          
          res.end();
          return;
        }
      }
      
      sendEvent('progress', { message: `✅ Committing ${fileChanges.length} file changes...` });
      commitHash = await platformHealing.commitChanges(`Fix: ${message.slice(0, 100)}`, fileChanges as any);

      if (autoPush) {
        sendEvent('progress', { message: '✅ Pushing to GitHub (deploying to production)...' });
        await platformHealing.pushToRemote();
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
        content: fullContent || 'Done! I\'ve analyzed and fixed the issues.',
        isPlatformHealing: true,
        platformChanges: fileChanges.length > 0 ? { files: fileChanges } : null,
      })
      .returning();

    // Log audit trail
    await platformAudit.log({
      userId,
      action: 'heal',
      description: `LomuAI chat: ${message.slice(0, 100)}`,
      changes: fileChanges,
      backupId: backup?.id || null,
      commitHash,
      status: 'success',
    });

    sendEvent('done', { messageId: assistantMsg.id, commitHash, filesChanged: fileChanges.length });
    res.end();
  } catch (error: any) {
    console.error('[LOMUAI-CHAT] Stream error:', error);
    const errorMessage = JSON.stringify({ type: 'error', message: error.message });
    res.write(`data: ${errorMessage}\n\n`);
    res.end();
  }
});

export default router;