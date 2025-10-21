import { Router } from 'express';
import { platformHealing } from './platformHealing';
import { platformAudit } from './platformAudit';
import { isAuthenticated, isAdmin } from './universalAuth';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

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

    await platformAudit.log({
      userId,
      action: 'heal',
      description: `Starting platform heal: ${issue}`,
      status: 'pending',
    });

    const backup = await platformHealing.createBackup(`Pre-heal backup: ${issue}`);

    const platformFiles = await platformHealing.listPlatformFiles('.');

    const fileContents: Record<string, string> = {};
    const relevantFiles = platformFiles
      .filter(f => 
        f.endsWith('.ts') || 
        f.endsWith('.tsx') || 
        f.endsWith('.js') || 
        f.endsWith('.jsx')
      )
      .slice(0, 20);

    for (const file of relevantFiles) {
      try {
        fileContents[file] = await platformHealing.readPlatformFile(file);
      } catch (error) {
      }
    }

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
2. writePlatformFile(path, content) - Modify platform code
3. deletePlatformFile(path) - Remove files
4. listPlatformFiles(directory) - List files

SAFETY RULES:
- NEVER modify .git/, node_modules/, .env, package.json
- ALWAYS test changes before committing
- ALWAYS explain what you're fixing and why
- Create minimal, surgical fixes - don't rewrite entire files
- If unsure, ask for clarification

USER ISSUE:
${issue}

CURRENT FILES (first 20):
${Object.keys(fileContents).map(f => `- ${f}`).join('\n')}

Analyze the issue, identify the root cause, and provide the fix.`;

    let conversationMessages: any[] = [{
      role: 'user',
      content: `Fix this platform issue: ${issue}\n\nAvailable files:\n${Object.entries(fileContents).slice(0, 3).map(([path, content]) => `\n=== ${path} ===\n${content.slice(0, 1000)}`).join('\n')}`,
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
    ];

    const changes: Array<{ path: string; operation: string }> = [];
    let fixDescription = '';
    let continueLoop = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 5;

    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

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
          fixDescription += block.text;
        } else if (block.type === 'tool_use') {
          const { name, input, id } = block;

          try {
            let toolResult: any = null;

            if (name === 'readPlatformFile') {
              const typedInput = input as { path: string };
              toolResult = await platformHealing.readPlatformFile(typedInput.path);
            } else if (name === 'writePlatformFile') {
              const typedInput = input as { path: string; content: string };
              await platformHealing.writePlatformFile(typedInput.path, typedInput.content);
              changes.push({ path: typedInput.path, operation: 'modify' });
              toolResult = 'File written successfully';
            } else if (name === 'listPlatformFiles') {
              const typedInput = input as { directory: string };
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

    const safety = await platformHealing.validateSafety();
    if (!safety.safe) {
      await platformHealing.rollback(backup.id);
      
      await platformAudit.log({
        userId,
        action: 'heal',
        description: `Platform heal aborted - safety check failed: ${safety.issues.join(', ')}`,
        backupId: backup.id,
        status: 'failure',
        error: safety.issues.join('; '),
      });

      return res.status(400).json({
        error: 'Healing aborted - safety check failed',
        issues: safety.issues,
        rolledBack: true,
      });
    }

    let commitHash = '';
    if (autoCommit && changes.length > 0) {
      commitHash = await platformHealing.commitChanges(`Fix: ${issue}`, changes as any);

      if (autoPush) {
        await platformHealing.pushToRemote();
      }
    }

    await platformAudit.log({
      userId,
      action: 'heal',
      description: `Platform heal completed: ${issue}`,
      changes,
      backupId: backup.id,
      commitHash,
      status: 'success',
    });

    res.json({
      success: true,
      backup: backup.id,
      changes,
      fix: fixDescription,
      committed: autoCommit,
      pushed: autoPush,
      commitHash,
    });

  } catch (error: any) {
    console.error('[PLATFORM-HEAL] Error:', error);

    await platformAudit.log({
      userId: req.authenticatedUserId,
      action: 'heal',
      description: `Platform heal failed: ${error.message}`,
      status: 'failure',
      error: error.message,
    });

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

export default router;
