import { platformHealing } from './platformHealing';
import { platformAudit } from './platformAudit';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Automatic Self-Healing System
 * Like rml CLI tool - detects errors and automatically fixes them
 * OPTIMIZED: CPU-efficient version to prevent high CPU usage
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
  private readonly ERROR_THRESHOLD = 5; // Increased to reduce false triggers
  private readonly BUFFER_TIME = 10000; // Increased to 10s to reduce CPU load
  private readonly MAX_ERRORS_PER_MINUTE = 20; // Rate limiting
  private healingTimer: NodeJS.Timeout | null = null;
  private knowledgeBase: Map<string, string> = new Map();
  private cpuMonitor = {
    lastCheck: Date.now(),
    errorCount: 0,
    healingCount: 0
  };

  /**
   * Report an error for potential auto-healing (CPU-optimized)
   */
  async reportError(error: ErrorLog): Promise<void> {
    // CPU PROTECTION: Rate limiting to prevent excessive processing
    const now = Date.now();
    if (now - this.cpuMonitor.lastCheck < 60000) {
      this.cpuMonitor.errorCount++;
      if (this.cpuMonitor.errorCount > this.MAX_ERRORS_PER_MINUTE) {
        console.warn('[AUTO-HEAL] Rate limit exceeded, ignoring error');
        return;
      }
    } else {
      // Reset counter every minute
      this.cpuMonitor.lastCheck = now;
      this.cpuMonitor.errorCount = 1;
    }

    // Only log significant errors to reduce console spam
    if (error.type === 'compile' || error.message.includes('FATAL')) {
      console.log('[AUTO-HEAL] Critical error detected:', error.type, error.message.slice(0, 100));
    }
    
    this.errorBuffer.push(error);
    
    // Limit buffer size to prevent memory issues
    if (this.errorBuffer.length > 50) {
      this.errorBuffer = this.errorBuffer.slice(-25); // Keep only recent errors
    }
    
    // Check for known fixes (quick lookup)
    const knownFix = this.getKnownFix(error);
    if (knownFix) {
      console.log('[AUTO-HEAL] Known fix found, scheduling application...');
      // Don't apply immediately to prevent CPU spikes
      setTimeout(() => this.applyKnownFix(error, knownFix), 1000);
      return;
    }

    // CPU PROTECTION: Don't restart timer if already set
    if (this.healingTimer) {
      return; // Timer already running, don't create new ones
    }

    // Set timer with longer delay to reduce CPU usage
    this.healingTimer = setTimeout(() => {
      this.healingTimer = null; // Clear reference first
      this.triggerAutoHealing();
    }, this.BUFFER_TIME);
  }

  /**
   * Check knowledge base for known fixes (optimized lookup)
   */
  private getKnownFix(error: ErrorLog): string | null {
    const errorSignature = this.getErrorSignature(error);
    return this.knowledgeBase.get(errorSignature) || null;
  }

  /**
   * Create unique signature for error (CPU-optimized)
   */
  private getErrorSignature(error: ErrorLog): string {
    // Simplified signature generation to reduce CPU
    const messageKey = error.message
      .replace(/\d+/g, 'N')
      .slice(0, 50); // Reduced from 100 to save CPU
    
    return `${error.type}:${messageKey}`;
  }

  /**
   * Store a successful fix in knowledge base
   */
  private learnFix(error: ErrorLog, fix: string): void {
    const signature = this.getErrorSignature(error);
    this.knowledgeBase.set(signature, fix);
    
    // Limit knowledge base size to prevent memory bloat
    if (this.knowledgeBase.size > 100) {
      const keys = Array.from(this.knowledgeBase.keys());
      const oldestKey = keys[0];
      this.knowledgeBase.delete(oldestKey);
    }
    
    console.log('[AUTO-HEAL] Learned fix (KB size:', this.knowledgeBase.size, ')');
  }

  /**
   * Apply a known fix (CPU-optimized)
   */
  private async applyKnownFix(error: ErrorLog, fix: string): Promise<void> {
    if (this.isHealing) {
      console.log('[AUTO-HEAL] Already healing, skipping known fix');
      return;
    }

    this.isHealing = true;
    
    try {
      const backup = await platformHealing.createBackup('Auto-heal: Known fix');
      const fixData = JSON.parse(fix);
      
      await platformHealing.writePlatformFile(fixData.path, fixData.content);
      
      const safety = await platformHealing.validateSafety();
      if (!safety.safe) {
        await platformHealing.rollback(backup.id);
        console.error('[AUTO-HEAL] Known fix failed safety, rolled back');
        return;
      }
      
      await platformHealing.commitChanges(
        `Auto-heal: Known fix for ${error.type}`,
        [{ path: fixData.path, operation: 'modify' as const }]
      );
      
      this.errorBuffer = []; // Clear buffer on success
      
    } catch (error) {
      console.error('[AUTO-HEAL] Known fix failed:', error);
    } finally {
      this.isHealing = false;
    }
  }

  /**
   * Trigger automatic healing (CPU-optimized)
   */
  private async triggerAutoHealing(): Promise<void> {
    if (this.isHealing) {
      console.log('[AUTO-HEAL] Already healing, skipping');
      return;
    }

    // CPU PROTECTION: Check healing frequency
    if (this.cpuMonitor.healingCount > 3) {
      console.warn('[AUTO-HEAL] Too many healing attempts, pausing for 5 minutes');
      setTimeout(() => {
        this.cpuMonitor.healingCount = 0;
      }, 300000); // 5 minutes
      return;
    }

    if (this.errorBuffer.length < this.ERROR_THRESHOLD) {
      console.log('[AUTO-HEAL] Not enough errors (', this.errorBuffer.length, '/', this.ERROR_THRESHOLD, ')');
      this.errorBuffer = [];
      return;
    }

    this.isHealing = true;
    this.cpuMonitor.healingCount++;
    
    console.log('[AUTO-HEAL] Starting healing for', this.errorBuffer.length, 'errors');

    try {
      // Limit error summary to prevent excessive string processing
      const recentErrors = this.errorBuffer.slice(-5); // Only process last 5 errors
      const errorSummary = recentErrors
        .map(e => `[${e.type}] ${e.message.slice(0, 100)}`)
        .join('\n');

      const issue = `CPU-optimized auto-healing for ${recentErrors.length} errors:\n${errorSummary}`;

      await this.executeHealing(issue);
      this.errorBuffer = [];
      
    } catch (error) {
      console.error('[AUTO-HEAL] Healing failed:', error);
    } finally {
      this.isHealing = false;
    }
  }

  /**
   * Execute healing (performance-optimized)
   */
  private async executeHealing(issue: string): Promise<void> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error('[AUTO-HEAL] No Anthropic key configured');
      return;
    }

    try {
      const backup = await platformHealing.createBackup(`Auto-heal: ${issue.slice(0, 30)}`);
      const client = new Anthropic({ apiKey: anthropicKey });

      // Reduced system prompt to save tokens and CPU
      const systemPrompt = `Auto-healing module. Fix these errors with minimal changes:
${issue}

Use these tools:
- readPlatformFile(path) 
- writePlatformFile(path, content)
- listPlatformFiles(directory)

Be surgical. Fix only what's broken.`;

      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307', // Faster model to reduce CPU load
        max_tokens: 4000, // Reduced from 8000
        system: systemPrompt,
        messages: [{ role: 'user', content: issue.slice(0, 500) }], // Limit input size
        tools: [
          {
            name: 'readPlatformFile',
            description: 'Read file',
            input_schema: {
              type: 'object' as const,
              properties: { path: { type: 'string' as const } },
              required: ['path'],
            },
          },
          {
            name: 'writePlatformFile', 
            description: 'Write file',
            input_schema: {
              type: 'object' as const,
              properties: { 
                path: { type: 'string' as const },
                content: { type: 'string' as const }
              },
              required: ['path', 'content'],
            },
          }
        ],
      });

      // Process only first tool use to reduce CPU load
      const changes: Array<{ path: string; content: string }> = [];
      
      for (const block of response.content.slice(0, 3)) { // Limit processing
        if (block.type === 'tool_use' && block.name === 'writePlatformFile') {
          const input = block.input as { path: string; content: string };
          await platformHealing.writePlatformFile(input.path, input.content);
          changes.push(input);
          break; // Only process first write to reduce CPU
        }
      }

      if (changes.length > 0) {
        const safety = await platformHealing.validateSafety();
        if (safety.safe) {
          const commitHash = await platformHealing.commitChanges(
            `Auto-heal: CPU optimized fix`,
            changes.map(c => ({ path: c.path, operation: 'modify' as const }))
          );
          console.log('[AUTO-HEAL] Committed:', commitHash);
        } else {
          await platformHealing.rollback(backup.id);
          console.error('[AUTO-HEAL] Safety failed, rolled back');
        }
      }

    } catch (error: any) {
      console.error('[AUTO-HEAL] Execution failed:', error.message.slice(0, 100));
    }
  }

  /**
   * Export knowledge base
   */
  exportKnowledge(): Record<string, string> {
    return Object.fromEntries(this.knowledgeBase);
  }

  /**
   * Import knowledge base
   */
  importKnowledge(knowledge: Record<string, string>): void {
    this.knowledgeBase = new Map(Object.entries(knowledge).slice(0, 50)); // Limit size
    console.log('[AUTO-HEAL] Imported', this.knowledgeBase.size, 'fixes');
  }

  /**
   * Get CPU monitoring stats
   */
  getCpuStats() {
    return {
      errorCount: this.cpuMonitor.errorCount,
      healingCount: this.cpuMonitor.healingCount,
      isHealing: this.isHealing,
      bufferSize: this.errorBuffer.length,
      knowledgeBaseSize: this.knowledgeBase.size
    };
  }
}

export const autoHealing = new AutoHealingService();

// CPU-OPTIMIZED: Only attach handlers in production and with throttling
if (process.env.NODE_ENV === 'production') {
  let lastErrorTime = 0;
  const ERROR_THROTTLE = 5000; // Only report errors every 5 seconds max

  process.on('uncaughtException', (error) => {
    const now = Date.now();
    if (now - lastErrorTime > ERROR_THROTTLE) {
      lastErrorTime = now;
      autoHealing.reportError({
        timestamp: new Date(),
        type: 'runtime',
        message: error.message,
        stack: error.stack,
      });
    }
  });

  process.on('unhandledRejection', (reason: any) => {
    const now = Date.now();
    if (now - lastErrorTime > ERROR_THROTTLE) {
      lastErrorTime = now;
      autoHealing.reportError({
        timestamp: new Date(),
        type: 'runtime',
        message: reason?.message || String(reason).slice(0, 200),
        stack: reason?.stack,
      });
    }
  });
}