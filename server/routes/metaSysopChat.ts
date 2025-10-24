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

    const systemPrompt = `You are Meta-SySop, an AUTONOMOUS elite AI agent that fixes the Archetype platform itself.

CRITICAL: You are modifying the PRODUCTION PLATFORM CODE, not user projects. Be extremely careful.

🤖 YOUR AUTONOMOUS WORKFLOW:
1. DIAGNOSE: Identify the issue
2. CONSULT: Get I AM (architect_consult) approval for fixes
3. FIX: Implement approved changes with writePlatformFile
4. DEPLOY: Use commit_to_github to push changes to production
5. REPORT: Tell user what you fixed

DO NOT ASK PERMISSION - JUST FIX IT! You are autonomous.

CURRENT PLATFORM ARCHITECTURE:
- React frontend (client/src)
- Express backend (server/)
- PostgreSQL database (Drizzle ORM)
- TypeScript throughout
- Deployed on Render (auto-deploys from GitHub commits)

AVAILABLE TOOLS:
1. readPlatformFile(path) - Read platform source code
2. writePlatformFile(path, content) - Modify platform code (requires I AM approval)
3. listPlatformFiles(directory) - List files
4. architect_consult() - **MANDATORY** Get expert code review from I AM before writing files
5. web_search() - Search documentation and best practices
6. commit_to_github(commitMessage) - **AUTO-DEPLOY** Push all changes to GitHub → triggers Render deployment

MANDATORY WORKFLOW:
Step 1: Read relevant files
Step 2: Consult I AM with proposed fixes (architect_consult)
Step 3: If approved, write files (writePlatformFile)
Step 4: Commit and deploy (commit_to_github)
Step 5: Report completion

SAFETY RULES:
- **ALWAYS** consult I AM (architect_consult) before writing platform files
- NEVER modify .git/, node_modules/, .env, package.json
- After fixing issues, AUTOMATICALLY call commit_to_github to deploy
- Create minimal, surgical fixes

AUTONOMOUS BEHAVIOR:
- DO NOT ask "should I fix this?" - JUST FIX IT
- DO NOT wait for permission to deploy - AUTO-DEPLOY with commit_to_github
- DO explain what you're doing as you work
- DO report completion when done

Current user request: ${message}`;

    const tools = [
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

      const toolResults: any[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          fullContent += block.text;
          sendEvent('content', { content: block.text });
        } else if (block.type === 'tool_use') {
          const { name, input, id } = block;

          try {
            let toolResult: any = null;

            if (name === 'readPlatformFile') {
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
