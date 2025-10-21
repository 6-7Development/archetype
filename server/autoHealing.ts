import { platformHealing } from './platformHealing';
import { platformAudit } from './platformAudit';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Automatic Self-Healing System
 * Like rml CLI tool - detects errors and automatically fixes them
 */

interface ErrorLog {
  timestamp: Date;
  type: 'compile' | 'runtime' | 'test' | 'lsp';
  message: string;
  stack?: string;
  file?: string;
  line?: number;
}

class AutoHealingService {
  private errorBuffer: ErrorLog[] = [];
  private isHealing = false;
  private readonly ERROR_THRESHOLD = 3; // Number of errors before auto-healing
  private readonly BUFFER_TIME = 5000; // Wait 5s to collect related errors
  private healingTimer: NodeJS.Timeout | null = null;
  private knowledgeBase: Map<string, string> = new Map(); // Store learned fixes

  /**
   * Report an error for potential auto-healing
   */
  async reportError(error: ErrorLog): Promise<void> {
    console.log('[AUTO-HEAL] Error detected:', error.type, error.message);
    
    this.errorBuffer.push(error);
    
    // Check if we've seen this error before and have a fix
    const knownFix = this.getKnownFix(error);
    if (knownFix) {
      console.log('[AUTO-HEAL] Known fix found, applying immediately...');
      await this.applyKnownFix(error, knownFix);
      return;
    }

    // Clear existing timer
    if (this.healingTimer) {
      clearTimeout(this.healingTimer);
    }

    // Set new timer to trigger healing
    this.healingTimer = setTimeout(() => {
      this.triggerAutoHealing();
    }, this.BUFFER_TIME);
  }

  /**
   * Check knowledge base for known fixes
   */
  private getKnownFix(error: ErrorLog): string | null {
    const errorSignature = this.getErrorSignature(error);
    return this.knowledgeBase.get(errorSignature) || null;
  }

  /**
   * Create unique signature for error to match against knowledge base
   */
  private getErrorSignature(error: ErrorLog): string {
    // Use error type, file, and key parts of message
    const messageKey = error.message
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/['"]/g, '') // Remove quotes
      .slice(0, 100);
    
    return `${error.type}:${error.file || 'unknown'}:${messageKey}`;
  }

  /**
   * Store a successful fix in knowledge base
   */
  private learnFix(error: ErrorLog, fix: string): void {
    const signature = this.getErrorSignature(error);
    this.knowledgeBase.set(signature, fix);
    console.log('[AUTO-HEAL] Learned new fix:', signature);
  }

  /**
   * Apply a known fix from knowledge base
   */
  private async applyKnownFix(error: ErrorLog, fix: string): Promise<void> {
    try {
      console.log('[AUTO-HEAL] Applying known fix...');
      
      // Create backup
      const backup = await platformHealing.createBackup('Auto-heal: Known fix');
      
      // Apply fix (fix contains the file path and content to write)
      const fixData = JSON.parse(fix);
      await platformHealing.writePlatformFile(fixData.path, fixData.content);
      
      // Validate safety
      const safety = await platformHealing.validateSafety();
      if (!safety.safe) {
        await platformHealing.rollback(backup.id);
        console.error('[AUTO-HEAL] Known fix failed safety check, rolled back');
        return;
      }
      
      console.log('[AUTO-HEAL] Known fix applied successfully');
      this.errorBuffer = []; // Clear buffer
      
    } catch (error) {
      console.error('[AUTO-HEAL] Failed to apply known fix:', error);
    }
  }

  /**
   * Trigger automatic healing process
   */
  private async triggerAutoHealing(): Promise<void> {
    if (this.isHealing) {
      console.log('[AUTO-HEAL] Already healing, skipping...');
      return;
    }

    if (this.errorBuffer.length < this.ERROR_THRESHOLD) {
      console.log('[AUTO-HEAL] Not enough errors to trigger healing');
      this.errorBuffer = [];
      return;
    }

    this.isHealing = true;
    console.log('[AUTO-HEAL] Triggering automatic healing for', this.errorBuffer.length, 'errors');

    try {
      // Aggregate error information
      const errorSummary = this.errorBuffer
        .map(e => `[${e.type}] ${e.file}:${e.line} - ${e.message}`)
        .join('\n');

      const issue = `Automatic healing triggered by errors:\n${errorSummary}`;

      // Use Meta-SySop to fix
      await this.executeHealing(issue);

      // Learn from this fix
      if (this.errorBuffer.length > 0) {
        // Store the pattern for future use
        const primaryError = this.errorBuffer[0];
        // We'll store the fix pattern after successful healing
      }

      this.errorBuffer = [];
    } catch (error) {
      console.error('[AUTO-HEAL] Automatic healing failed:', error);
    } finally {
      this.isHealing = false;
    }
  }

  /**
   * Execute healing using Meta-SySop
   */
  private async executeHealing(issue: string): Promise<void> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error('[AUTO-HEAL] Anthropic API key not configured');
      return;
    }

    try {
      // Create backup
      const backup = await platformHealing.createBackup(`Auto-heal: ${issue.slice(0, 50)}`);
      console.log('[AUTO-HEAL] Backup created:', backup.id);

      // Get platform files
      const platformFiles = await platformHealing.listPlatformFiles('.');
      const relevantFiles = platformFiles
        .filter(f => 
          f.endsWith('.ts') || 
          f.endsWith('.tsx') || 
          f.endsWith('.js') || 
          f.endsWith('.jsx')
        )
        .slice(0, 15);

      const client = new Anthropic({ apiKey: anthropicKey });

      const systemPrompt = `You are Meta-SySop's AUTO-HEALING module. You fix platform errors automatically.

CRITICAL: This is AUTOMATIC healing - be conservative and surgical. Only fix what's broken.

AVAILABLE TOOLS:
1. readPlatformFile(path) - Read source code
2. writePlatformFile(path, content) - Fix code
3. listPlatformFiles(directory) - List files

HEALING STRATEGY:
1. Analyze error messages
2. Identify root cause
3. Apply minimal fix
4. Verify safety
5. Test the fix

ERRORS TO FIX:
${issue}

Fix these errors with minimal changes. Explain each fix clearly.`;

      let conversationMessages: any[] = [{
        role: 'user',
        content: issue,
      }];

      const tools = [
        {
          name: 'readPlatformFile',
          description: 'Read a platform source file',
          input_schema: {
            type: 'object' as const,
            properties: {
              path: { type: 'string' as const },
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
              path: { type: 'string' as const },
              content: { type: 'string' as const },
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
              directory: { type: 'string' as const },
            },
            required: ['directory'],
          },
        },
      ];

      const changes: Array<{ path: string; content: string }> = [];
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
          if (block.type === 'tool_use') {
            const { name, input, id } = block;

            try {
              let toolResult: any = null;

              if (name === 'readPlatformFile') {
                const typedInput = input as { path: string };
                toolResult = await platformHealing.readPlatformFile(typedInput.path);
              } else if (name === 'writePlatformFile') {
                const typedInput = input as { path: string; content: string };
                await platformHealing.writePlatformFile(typedInput.path, typedInput.content);
                changes.push({ path: typedInput.path, content: typedInput.content });
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

      // Validate safety
      const safety = await platformHealing.validateSafety();
      if (!safety.safe) {
        await platformHealing.rollback(backup.id);
        console.error('[AUTO-HEAL] Safety check failed, rolled back');
        
        await platformAudit.log({
          userId: 'system',
          action: 'heal',
          description: `Auto-heal aborted - safety check failed`,
          backupId: backup.id,
          status: 'failure',
          error: safety.issues.join('; '),
        });
        return;
      }

      // Auto-commit the fix
      if (changes.length > 0) {
        const commitHash = await platformHealing.commitChanges(
          `Auto-heal: ${issue.slice(0, 50)}`,
          changes.map(c => ({ path: c.path, operation: 'modify' as const }))
        );

        console.log('[AUTO-HEAL] Fix committed:', commitHash);

        // Learn this fix for future use
        if (this.errorBuffer.length > 0 && changes.length > 0) {
          const primaryError = this.errorBuffer[0];
          const fixData = JSON.stringify(changes[0]); // Store first change as the fix
          this.learnFix(primaryError, fixData);
        }

        await platformAudit.log({
          userId: 'system',
          action: 'heal',
          description: `Auto-heal completed: ${changes.length} files fixed`,
          changes: changes.map(c => ({ path: c.path, operation: 'modify' })),
          backupId: backup.id,
          commitHash,
          status: 'success',
        });
      }

    } catch (error: any) {
      console.error('[AUTO-HEAL] Healing failed:', error);
      
      await platformAudit.log({
        userId: 'system',
        action: 'heal',
        description: `Auto-heal failed: ${error.message}`,
        status: 'failure',
        error: error.message,
      });
    }
  }

  /**
   * Export knowledge base (for persistence)
   */
  exportKnowledge(): Record<string, string> {
    return Object.fromEntries(this.knowledgeBase);
  }

  /**
   * Import knowledge base (from persistence)
   */
  importKnowledge(knowledge: Record<string, string>): void {
    this.knowledgeBase = new Map(Object.entries(knowledge));
    console.log('[AUTO-HEAL] Imported', this.knowledgeBase.size, 'known fixes');
  }
}

export const autoHealing = new AutoHealingService();

// Global error handlers for automatic healing
if (process.env.NODE_ENV === 'production') {
  process.on('uncaughtException', (error) => {
    autoHealing.reportError({
      timestamp: new Date(),
      type: 'runtime',
      message: error.message,
      stack: error.stack,
    });
  });

  process.on('unhandledRejection', (reason: any) => {
    autoHealing.reportError({
      timestamp: new Date(),
      type: 'runtime',
      message: reason?.message || String(reason),
      stack: reason?.stack,
    });
  });
}
