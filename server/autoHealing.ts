import { platformHealing } from './platformHealing';
import { platformAudit } from './platformAudit';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
  private readonly ERROR_THRESHOLD = 5;
  private readonly BUFFER_TIME = 10000;
  private healingTimer: NodeJS.Timeout | null = null;
  private knowledgeBase: Map<string, string> = new Map();

  async reportError(error: ErrorLog): Promise<void> {
    console.log('[AUTO-HEAL] Error detected:', error.type, error.message);
    
    this.errorBuffer.push(error);
    
    const knownFix = this.getKnownFix(error);
    if (knownFix) {
      console.log('[AUTO-HEAL] Known fix found, applying immediately...');
      await this.applyKnownFix(error, knownFix);
      return;
    }

    if (this.healingTimer) {
      clearTimeout(this.healingTimer);
    }

    this.healingTimer = setTimeout(() => {
      this.triggerAutoHealing();
    }, this.BUFFER_TIME);
  }

  private getKnownFix(error: ErrorLog): string | null {
    const errorSignature = this.getErrorSignature(error);
    return this.knowledgeBase.get(errorSignature) || null;
  }

  private getErrorSignature(error: ErrorLog): string {
    const messageKey = error.message
      .replace(/\d+/g, 'N')
      .replace(/['\"]/g, '')
      .slice(0, 100);
    
    return `${error.type}:${error.file || 'unknown'}:${messageKey}`;
  }

  private learnFix(error: ErrorLog, fix: string): void {
    const signature = this.getErrorSignature(error);
    this.knowledgeBase.set(signature, fix);
    console.log('[AUTO-HEAL] Learned new fix:', signature);
  }

  private async applyKnownFix(error: ErrorLog, fix: string): Promise<void> {
    try {
      console.log('[AUTO-HEAL] Applying known fix...');
      
      const backup = await platformHealing.createBackup('Auto-heal: Known fix');
      
      const fixData = JSON.parse(fix);
      await platformHealing.writePlatformFile(fixData.path, fixData.content);
      
      const safety = await platformHealing.validateSafety();
      if (!safety.safe) {
        await platformHealing.rollback(backup.id);
        console.error('[AUTO-HEAL] Known fix failed safety check, rolled back');
        return;
      }
      
      await platformHealing.commitChanges(
        `Auto-heal: Known fix for ${error.type} error`,
        [{ path: fixData.path, operation: 'modify' as const }]
      );
      
      console.log('[AUTO-HEAL] Known fix applied and committed successfully');
      this.errorBuffer = [];
      
    } catch (error) {
      console.error('[AUTO-HEAL] Failed to apply known fix:', error);
    }
  }

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
      const errorSummary = this.errorBuffer
        .map(e => `[${e.type}] ${e.file}:${e.line} - ${e.message}`)
        .join('\n');

      const issue = `Automatic healing triggered by errors:\n${errorSummary}`;

      await this.executeHealing(issue);

      this.errorBuffer = [];
    } catch (error) {
      console.error('[AUTO-HEAL] Automatic healing failed:', error);
    } finally {
      this.isHealing = false;
    }
  }

  private async executeHealing(issue: string): Promise<void> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error('[AUTO-HEAL] Gemini API key not configured');
      return;
    }

    try {
      const backup = await platformHealing.createBackup(`Auto-heal: ${issue.slice(0, 50)}`);
      console.log('[AUTO-HEAL] Backup created:', backup.id);

      const platformFiles = await platformHealing.listPlatformFiles('.');
      const relevantFiles = platformFiles
        .filter(f => 
          f.endsWith('.ts') || 
          f.endsWith('.tsx') || 
          f.endsWith('.js') || 
          f.endsWith('.jsx')
        )
        .slice(0, 15);

      const genai = new GoogleGenerativeAI(geminiKey);

      const systemPrompt = `You are Hexad's AUTO-HEALING module. You fix platform errors automatically.

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

      const tools = [{
        functionDeclarations: [
          {
            name: 'readPlatformFile',
            description: 'Read a platform source file',
            parameters: {
              type: 'OBJECT' as const,
              properties: {
                path: { type: 'STRING' as const, description: 'Path to the file' },
              },
              required: ['path'],
            },
          },
          {
            name: 'writePlatformFile',
            description: 'Write content to a platform file',
            parameters: {
              type: 'OBJECT' as const,
              properties: {
                path: { type: 'STRING' as const, description: 'Path to the file' },
                content: { type: 'STRING' as const, description: 'New file content' },
              },
              required: ['path', 'content'],
            },
          },
          {
            name: 'listPlatformFiles',
            description: 'List files in a directory',
            parameters: {
              type: 'OBJECT' as const,
              properties: {
                directory: { type: 'STRING' as const, description: 'Directory path' },
              },
              required: ['directory'],
            },
          },
        ]
      }];

      const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });

      const chat = model.startChat({
        tools,
        generationConfig: {
          maxOutputTokens: 8000,
        }
      });

      let changes: Array<{ path: string; content: string }> = [];
      let continueLoop = true;
      let iterationCount = 0;
      const MAX_ITERATIONS = 3;

      let response = await chat.sendMessage(issue);

      while (continueLoop && iterationCount < MAX_ITERATIONS) {
        iterationCount++;

        const result = response.response;
        const candidates = result.candidates || [];
        const parts = candidates[0]?.content?.parts || [];
        
        const functionCalls = parts.filter((p: any) => p.functionCall);
        
        if (functionCalls.length === 0) {
          continueLoop = false;
          break;
        }

        const functionResponses = [];
        
        for (const part of functionCalls) {
          const call = (part as any).functionCall;
          const name = call.name;
          const args = call.args;

          try {
            let toolResult: any = null;

            if (name === 'readPlatformFile') {
              toolResult = await platformHealing.readPlatformFile(args.path);
            } else if (name === 'writePlatformFile') {
              await platformHealing.writePlatformFile(args.path, args.content);
              changes.push({ path: args.path, content: args.content });
              toolResult = 'File written successfully';
            } else if (name === 'listPlatformFiles') {
              const files = await platformHealing.listPlatformFiles(args.directory);
              toolResult = files.join('\n');
            }

            functionResponses.push({
              functionResponse: {
                name: name,
                response: { result: toolResult || 'Success' }
              }
            });
          } catch (error: any) {
            functionResponses.push({
              functionResponse: {
                name: name,
                response: { error: error.message }
              }
            });
          }
        }

        if (functionResponses.length > 0) {
          response = await chat.sendMessage(functionResponses);
        } else {
          continueLoop = false;
        }
      }

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

      if (changes.length > 0) {
        const commitHash = await platformHealing.commitChanges(
          `Auto-heal: ${issue.slice(0, 50)}`,
          changes.map(c => ({ path: c.path, operation: 'modify' as const }))
        );

        console.log('[AUTO-HEAL] Fix committed:', commitHash);

        if (this.errorBuffer.length > 0 && changes.length > 0) {
          const primaryError = this.errorBuffer[0];
          const fixData = JSON.stringify({
            path: changes[0].path,
            content: changes[0].content,
            issue: issue.slice(0, 200),
          });
          this.learnFix(primaryError, fixData);
          console.log('[AUTO-HEAL] Learned fix for future use:', this.getErrorSignature(primaryError));
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

  exportKnowledge(): Record<string, string> {
    return Object.fromEntries(this.knowledgeBase);
  }

  importKnowledge(knowledge: Record<string, string>): void {
    this.knowledgeBase = new Map(Object.entries(knowledge));
    console.log('[AUTO-HEAL] Imported', this.knowledgeBase.size, 'known fixes');
  }
}

export const autoHealing = new AutoHealingService();

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
