import { Router } from 'express';
import { platformHealing } from './platformHealing';
import { platformAudit } from './platformAudit';
import { isAuthenticated, isAdmin } from './universalAuth';
import { sessionManager } from './platformHealingSession';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const router = Router();

// Store pending write approvals in memory
const pendingApprovals = new Map<string, { resolve: (approved: boolean) => void }>();

// Export function to resolve pending approvals (used by Meta-SySop approval endpoint)
export function resolvePendingApproval(sessionId: string, approved: boolean): boolean {
  const pending = pendingApprovals.get(sessionId);
  if (pending) {
    pending.resolve(approved);
    pendingApprovals.delete(sessionId);
    return true;
  }
  return false;
}

// GET /api/platform/status - Platform health and metrics
router.get('/status', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const os = await import('os');
    
    // Get system metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    const cpus = os.cpus();
    const avgLoad = os.loadavg()[0];
    const cpuCount = cpus.length;
    const cpuUsage = Math.min(100, (avgLoad / cpuCount) * 100);
    
    const uptime = os.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeFormatted = `${days}d ${hours}h ${minutes}m`;
    
    // Check for uncommitted changes
    let uncommittedChanges = false;
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { 
        cwd: path.resolve(__dirname, '..') 
      });
      uncommittedChanges = stdout.trim().length > 0;
    } catch (error) {
      // Git not available (Render production)
      uncommittedChanges = false;
    }
    
    // Calculate overall health (simple heuristic)
    let healthScore = 100;
    if (cpuUsage > 80) healthScore -= 20;
    if (memoryUsage > 80) healthScore -= 20;
    if (uncommittedChanges) healthScore -= 10;
    
    const issues: string[] = [];
    if (cpuUsage > 80) issues.push('High CPU usage detected');
    if (memoryUsage > 80) issues.push('High memory usage detected');
    if (uncommittedChanges) issues.push('Uncommitted changes present');
    
    res.json({
      overallHealth: Math.round(healthScore),
      activeIncidents: issues.length,
      uptime: uptimeFormatted,
      cpuUsage: Math.round(cpuUsage),
      memoryUsage: Math.round(memoryUsage),
      uncommittedChanges,
      safety: {
        safe: issues.length === 0,
        issues,
      },
      lastUpdate: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[PLATFORM-STATUS] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/heal', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { issue, autoCommit = false, autoPush = false } = req.body;
    const userId = req.authenticatedUserId;

    if (!issue || typeof issue !== 'string') {
      return res.status(400).json({ error: 'Issue description is required' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(503).json({ error: 'Anthropic API key not configured' });
    }

    // Create session
    const session = sessionManager.create(userId, issue);

    // Start async healing process (don't await)
    runHealingProcess(session.id, userId, issue, autoCommit, autoPush, anthropicKey).catch((error) => {
      console.error('[HEAL] Process failed:', error);
      sessionManager.fail(session.id, error.message);
    });

    // Return immediately with sessionId
    res.json({
      sessionId: session.id,
      status: 'started',
    });

  } catch (error: any) {
    console.error('[PLATFORM-HEAL] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Async healing process that streams via WebSocket
async function runHealingProcess(
  sessionId: string,
  userId: string,
  issue: string,
  autoCommit: boolean,
  autoPush: boolean,
  anthropicKey: string
) {
  try {
    sessionManager.addMessage(sessionId, {
      type: 'heal:thought',
      text: 'Creating backup before making changes...',
    });

    const backup = await platformHealing.createBackup(`Pre-heal backup: ${issue}`);

    sessionManager.addMessage(sessionId, {
      type: 'heal:thought',
      text: 'Scanning platform files...',
    });

    const platformFiles = await platformHealing.listPlatformFiles('.');
    const relevantFiles = platformFiles
      .filter(f => 
        f.endsWith('.ts') || 
        f.endsWith('.tsx') || 
        f.endsWith('.js') || 
        f.endsWith('.jsx')
      )
      .slice(0, 20);

    const client = new Anthropic({ apiKey: anthropicKey });

    const systemPrompt = `You are Meta-SySop, an elite AI agent that fixes the Archetype platform itself.

CRITICAL: You are modifying the PRODUCTION PLATFORM CODE, not user projects. Be extremely careful.

CURRENT PLATFORM ARCHITECTURE:
- React frontend (client/src)
- Express backend (server/)
- PostgreSQL database (Drizzle ORM)
- TypeScript throughout
- Deployed on Render

AVAILABLE TOOLS:
1. readPlatformFile(path) - Read platform source code
2. writePlatformFile(path, content) - Modify platform code (requires approval)
3. listPlatformFiles(directory) - List files

SAFETY RULES:
- NEVER modify .git/, node_modules/, .env, package.json
- ALWAYS explain what you're fixing and why
- Create minimal, surgical fixes - don't rewrite entire files

USER ISSUE:
${issue}

Analyze the issue, identify the root cause, and provide the fix.`;

    let conversationMessages: any[] = [{
      role: 'user',
      content: `Fix this platform issue: ${issue}`,
    }];

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
        description: 'Write content to a platform file (requires user approval)',
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
    ];

    const changes: Array<{ path: string; operation: string }> = [];
    let continueLoop = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 10;

    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      sessionManager.addMessage(sessionId, {
        type: 'heal:thought',
        text: `Analyzing (iteration ${iterationCount}/${MAX_ITERATIONS})...`,
      });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: conversationMessages,
        tools,
      });

      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      });

      const toolResults: any[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          sessionManager.addMessage(sessionId, {
            type: 'heal:thought',
            text: block.text,
          });
        } else if (block.type === 'tool_use') {
          const { name, input, id } = block;

          try {
            let toolResult: any = null;

            if (name === 'readPlatformFile') {
              const typedInput = input as { path: string };
              
              sessionManager.addMessage(sessionId, {
                type: 'heal:tool',
                tool: 'readPlatformFile',
                path: typedInput.path,
              });

              toolResult = await platformHealing.readPlatformFile(typedInput.path);
            } else if (name === 'writePlatformFile') {
              const typedInput = input as { path: string; content: string };

              // Generate diff
              const diff = await platformHealing.previewWrite(typedInput.path, typedInput.content);

              // Pause session and wait for approval
              sessionManager.pause(sessionId, {
                path: typedInput.path,
                content: typedInput.content,
                diff,
              });

              // Wait for approval
              const approved = await waitForApproval(sessionId);

              if (approved) {
                await platformHealing.writePlatformFile(typedInput.path, typedInput.content);
                changes.push({ path: typedInput.path, operation: 'modify' });
                toolResult = 'File written successfully after user approval';
              } else {
                toolResult = 'File write rejected by user';
              }
            } else if (name === 'listPlatformFiles') {
              const typedInput = input as { directory: string };
              
              sessionManager.addMessage(sessionId, {
                type: 'heal:tool',
                tool: 'listPlatformFiles',
                directory: typedInput.directory,
              });

              const files = await platformHealing.listPlatformFiles(typedInput.directory);
              toolResult = files.join('\n');
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

    // Complete session
    sessionManager.complete(sessionId, changes);

  } catch (error: any) {
    console.error('[HEAL-PROCESS] Error:', error);
    sessionManager.fail(sessionId, error.message);
  }
}

// Wait for user approval
function waitForApproval(sessionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    pendingApprovals.set(sessionId, { resolve });
  });
}

// Approve write endpoint
router.post('/heal/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const sessionId = req.params.id;
    const pending = pendingApprovals.get(sessionId);

    if (!pending) {
      return res.status(404).json({ error: 'No pending approval for this session' });
    }

    pending.resolve(true);
    pendingApprovals.delete(sessionId);

    res.json({ success: true, approved: true });
  } catch (error: any) {
    console.error('[HEAL-APPROVE] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject write endpoint
router.post('/heal/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const sessionId = req.params.id;
    const pending = pendingApprovals.get(sessionId);

    if (!pending) {
      return res.status(404).json({ error: 'No pending approval for this session' });
    }

    pending.resolve(false);
    pendingApprovals.delete(sessionId);

    res.json({ success: true, approved: false });
  } catch (error: any) {
    console.error('[HEAL-REJECT] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/rollback', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { backupId } = req.body;
    const userId = req.authenticatedUserId;

    if (!backupId) {
      return res.status(400).json({ error: 'backupId is required' });
    }

    await platformAudit.log({
      userId,
      action: 'rollback',
      description: `Rolling back to backup: ${backupId}`,
      backupId,
      status: 'pending',
    });

    await platformHealing.rollback(backupId);

    await platformAudit.log({
      userId,
      action: 'rollback',
      description: `Rollback completed to backup: ${backupId}`,
      backupId,
      status: 'success',
    });

    res.json({ success: true, backupId });

  } catch (error: any) {
    console.error('[PLATFORM-ROLLBACK] Error:', error);

    await platformAudit.log({
      userId: req.authenticatedUserId,
      action: 'rollback',
      description: `Rollback failed: ${error.message}`,
      status: 'failure',
      error: error.message,
    });

    res.status(500).json({ error: error.message });
  }
});

router.get('/backups', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const backups = await platformHealing.listBackups();
    res.json({ backups });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await platformAudit.getHistory(limit);
    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const diff = await platformHealing.getDiff();
    const safety = await platformHealing.validateSafety();
    const backups = await platformHealing.listBackups();

    res.json({
      uncommittedChanges: diff.length > 0,
      changeCount: diff.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).length,
      safety,
      backupCount: backups.length,
      latestBackup: backups[backups.length - 1] || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tasks', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    // Prevent browser caching - force fresh data on every request
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const userId = req.authenticatedUserId;
    const { readTaskList, updateTask } = await import('./tools/task-management');
    const { taskLists, tasks: tasksTable } = await import('@shared/schema');
    const { db } = await import('./db');
    const { eq, and } = await import('drizzle-orm');

    // Get actual task lists from task management system
    const result = await readTaskList({ userId });

    if (!result.success || !result.taskLists) {
      return res.json({ tasks: [] });
    }

    // Auto-cleanup stale active task lists (older than 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const staleLists = result.taskLists.filter((list: any) => 
      list.status === 'active' && new Date(list.createdAt) < fifteenMinutesAgo
    );

    for (const staleList of staleLists) {
      console.log(`🧹 [CLEANUP] Auto-completing stale task list: ${staleList.id} (created ${new Date(staleList.createdAt).toISOString()})`);

      // Mark all incomplete tasks as completed
      const incompleteTasks = staleList.tasks.filter((t: any) => 
        t.status !== 'completed' && t.status !== 'cancelled'
      );

      for (const task of incompleteTasks) {
        await updateTask({
          userId,
          taskId: task.id,
          status: 'completed',
          result: '⚠️ Auto-completed (stale session cleanup)',
          completedAt: new Date()
        });
      }

      // Mark task list as completed
      await db.update(taskLists)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(taskLists.id, staleList.id));
    }

    // Re-fetch after cleanup
    const updatedResult = await readTaskList({ userId });
    if (!updatedResult.success || !updatedResult.taskLists) {
      return res.json({ tasks: [] });
    }

    // Find the most recent active OR recently completed task list (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const relevantList = updatedResult.taskLists
      .filter((list: any) => 
        list.status === 'active' || 
        (list.status === 'completed' && new Date(list.completedAt || list.createdAt) > tenMinutesAgo)
      )
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!relevantList || !relevantList.tasks) {
      return res.json({ tasks: [] });
    }


    // Convert tasks to TaskBoard format (matching client/src/hooks/use-websocket-stream.ts)
    const tasks = relevantList.tasks.map((task: any) => {
      // Map database status to TaskBoard status
      let status: 'pending' | 'in_progress' | 'completed' | 'failed' = 'pending';
      if (task.status === 'completed') {
        status = 'completed';
      } else if (task.status === 'in_progress') {
        status = 'in_progress';
      } else if (task.status === 'cancelled') {
        status = 'failed';
      } else {
        status = 'pending';
      }

      return {
        id: task.id.toString(),
        title: task.title,
        status,
        priority: task.order || 0,
        subAgentId: null,
      };
    });

    res.json({ tasks });
  } catch (error: any) {
    console.error('[PLATFORM-TASKS] Error fetching tasks:', error);
    res.json({ tasks: [] }); // Return empty array on error, don't fail
  }
});

// Clear/reset all task lists for current user
router.post('/tasks/clear', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { db } = await import('./db');
    const { taskLists } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // Mark all task lists as completed
    await db
      .update(taskLists)
      .set({ status: 'completed' })
      .where(eq(taskLists.userId, userId));

    res.json({ success: true, message: 'All task lists cleared' });
  } catch (error: any) {
    console.error('[PLATFORM-TASKS] Error clearing tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
