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
import { 
  getSystemPrompt, 
  ERROR_MESSAGES, 
  PROGRESS_MESSAGES, 
  TOOL_DESCRIPTIONS 
} from './config/prompts';

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
      return res.status(503).json({ error: ERROR_MESSAGES.anthropicKeyMissing() });
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
      sendEvent('progress', { message: PROGRESS_MESSAGES.backupCreated() });
    } catch (backupError: any) {
      console.warn('[LOMUAI-CHAT] Backup creation failed (non-critical):', backupError.message);
      sendEvent('progress', { message: 'Working without backup (we\'re in production mode)' });
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

    // Use the new friendly system prompts from config
    const systemPrompt = getSystemPrompt(message, isSimpleTask);

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
                toolResult = `I'll skip reading ${typedInput.path} since it's not relevant to what you asked`;
                sendEvent('progress', { message: `Skipping ${typedInput.path} (not needed for this)` });
              } else {
                sendEvent('progress', { message: PROGRESS_MESSAGES.readingFile(typedInput.path) });
                toolResult = await platformHealing.readPlatformFile(typedInput.path);
              }
            } else if (name === 'writePlatformFile') {
              const typedInput = input as { path: string; content: string };
              const normalizedPath = normalizePath(typedInput.path);
              
              // For simple tasks, skip I AM approval requirement
              if (isSimpleTask) {
                console.log(`[LOMUAI] Simple task - writing ${normalizedPath} without I AM approval`);
                sendEvent('progress', { message: PROGRESS_MESSAGES.writingFile(normalizedPath) });
                await platformHealing.writePlatformFile(normalizedPath, typedInput.content);
                
                fileChanges.push({ 
                  path: normalizedPath, 
                  operation: 'modify', 
                  contentAfter: typedInput.content 
                });
                
                sendEvent('file_change', { file: { path: normalizedPath, operation: 'modify' } });
                toolResult = `✅ ${normalizedPath} updated! That should do it.`;
              } else {
                // CRITICAL ENFORCEMENT: Check per-file approval for complex tasks
                const approval = approvedFiles.get(normalizedPath);
                
                if (!approval) {
                  toolResult = ERROR_MESSAGES.noArchitectApproval(normalizedPath);
                  console.error(`[LOMUAI] Blocked writePlatformFile for ${normalizedPath} - no approval found`);
                  sendEvent('error', { message: `Hold on - I need approval for ${normalizedPath} first` });
                } else if (!approval.approved) {
                  toolResult = ERROR_MESSAGES.architectRejection(`Changes to "${normalizedPath}" weren't approved`);
                  console.error(`[LOMUAI] Blocked writePlatformFile for ${normalizedPath} - approval was rejected`);
                  sendEvent('error', { message: `Can't modify ${normalizedPath} - it was rejected` });
                } else {
                  console.log(`[LOMUAI] writePlatformFile called for: ${normalizedPath}`);
                  
                  sendEvent('progress', { message: PROGRESS_MESSAGES.writingFile(normalizedPath) });
                  await platformHealing.writePlatformFile(normalizedPath, typedInput.content);
                  
                  fileChanges.push({ 
                    path: normalizedPath, 
                    operation: 'modify', 
                    contentAfter: typedInput.content 
                  });
                  
                  sendEvent('file_change', { file: { path: normalizedPath, operation: 'modify' } });
                  toolResult = `✅ Updated ${normalizedPath} successfully! (I AM gave the green light at ${new Date(approval.timestamp).toLocaleTimeString()})`;
                }
              }
            } else if (name === 'listPlatformFiles') {
              const typedInput = input as { directory: string };
              sendEvent('progress', { message: `📂 Looking around ${typedInput.directory}...` });
              const files = await platformHealing.listPlatformFiles(typedInput.directory);
              toolResult = files.join('\n');
            } else if (name === 'architect_consult') {
              const typedInput = input as { 
                problem: string; 
                context: string; 
                proposedSolution: string;
                affectedFiles: string[];
              };
              sendEvent('progress', { message: PROGRESS_MESSAGES.consultingArchitect() });
              
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
                
                sendEvent('progress', { message: PROGRESS_MESSAGES.architectApproved() });
                toolResult = `✅ Great news! I AM approved my approach.\n\n${architectResult.guidance}\n\nThey also suggested:\n${architectResult.recommendations.join('\n')}\n\nI can now modify these files:\n${normalizedFiles.map(f => `- ${f}`).join('\n')}\n\nLet me get to work!`;
              } else {
                // Mark these files as rejected - DON'T overwrite existing approvals
                const normalizedFiles = typedInput.affectedFiles.map(normalizePath);
                normalizedFiles.forEach(filePath => {
                  approvedFiles.set(filePath, { approved: false, timestamp });
                });
                
                sendEvent('error', { message: `I AM had concerns about my approach` });
                toolResult = ERROR_MESSAGES.architectRejection(architectResult.error || 'Unknown issue') + `\n\nAffected files:\n${normalizedFiles.map(f => `- ${f}`).join('\n')}\n\nNo worries! I'll rethink this and come up with a better solution.`;
              }
            } else if (name === 'web_search') {
              const typedInput = input as { query: string; maxResults?: number };
              sendEvent('progress', { message: `🔍 Searching the web for "${typedInput.query}"...` });
              
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
                toolResult = `Hmm, there's nothing to commit yet. I need to make some file changes first.`;
                sendEvent('error', { message: 'No changes to commit yet' });
              } else {
                sendEvent('progress', { message: PROGRESS_MESSAGES.committingChanges() });
                
                try {
                  // Check if GitHub service is configured
                  const hasToken = !!process.env.GITHUB_TOKEN;
                  const hasRepo = !!process.env.GITHUB_REPO;
                  
                  if (!hasToken || !hasRepo) {
                    toolResult = `Oops! GitHub isn't set up yet. I need GITHUB_TOKEN and GITHUB_REPO environment variables to push changes.`;
                    sendEvent('error', { message: 'GitHub needs configuration' });
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
                    
                    sendEvent('progress', { message: `✅ Changes committed! (${result.commitHash.slice(0, 7)})` });
                    sendEvent('progress', { message: PROGRESS_MESSAGES.pushing() });
                    
                    toolResult = `🎉 Perfect! I committed ${fileChanges.length} file(s) to GitHub successfully!\n\n` +
                      `Commit: ${result.commitHash}\n` +
                      `View it here: ${result.commitUrl}\n\n` +
                      `${PROGRESS_MESSAGES.deployed()}\n\n` +
                      `Files I changed:\n${filesToCommit.map(f => `✓ ${f.path}`).join('\n')}`;
                  }
                } catch (error: any) {
                  toolResult = ERROR_MESSAGES.commitFailed(error.message);
                  sendEvent('error', { message: `Commit didn't work: ${error.message}` });
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
      sendEvent('progress', { message: '🔒 Running safety checks to make sure everything looks good...' });
      const safety = await platformHealing.validateSafety();
      
      if (!safety.safe) {
        if (backup?.id) {
          await platformHealing.rollback(backup.id);
          sendEvent('error', { 
            message: `Whoa, safety check caught some issues: ${safety.issues.join(', ')}. I rolled everything back to be safe.` 
          });
        } else {
          sendEvent('error', { 
            message: `Safety check found problems: ${safety.issues.join(', ')}. Unfortunately there's no backup to roll back to.` 
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