import { platformHealing } from './platformHealing';
import { platformAudit } from './platformAudit';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Automatic Self-Healing System
 * Like rml CLI tool - detects errors and automatically fixes them
 * OPTIMIZED: CPU-efficient version to prevent high CPU usage
 * MEMORY SAFETY: Added memory leak prevention and cleanup
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
  private readonly BUFFER_TIME = 15000; // Increased to 15s for memory safety
  private readonly MAX_ERRORS_PER_MINUTE = 15; // Reduced to prevent memory buildup
  private healingTimer: NodeJS.Timeout | null = null;
  private knowledgeBase: Map<string, string> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private cpuMonitor = {
    lastCheck: Date.now(),
    errorCount: 0,
    healingCount: 0
  };

  constructor() {
    // Start periodic memory cleanup
    this.startMemoryCleanup();
  }

  /**
   * Start periodic memory cleanup to prevent leaks
   */
  private startMemoryCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      // Clear old error buffer entries (older than 5 minutes)
      const fiveMinutesAgo = Date.now() - 300000;
      this.errorBuffer = this.errorBuffer.filter(
        error => error.timestamp.getTime() > fiveMinutesAgo
      );

      // Clean up knowledge base if it gets too large
      if (this.knowledgeBase.size > 50) {
        const entries = Array.from(this.knowledgeBase.entries());
        const recentEntries = entries.slice(-25); // Keep only 25 most recent
        this.knowledgeBase.clear();
        recentEntries.forEach(([key, value]) => this.knowledgeBase.set(key, value));
      }

      // Reset CPU monitoring counters periodically
      if (Date.now() - this.cpuMonitor.lastCheck > 300000) { // 5 minutes
        this.cpuMonitor.errorCount = 0;
        this.cpuMonitor.healingCount = 0;
        this.cpuMonitor.lastCheck = Date.now();
      }

    }, 60000); // Run cleanup every minute
  }

  /**
   * Stop memory cleanup timer
   */
  private stopMemoryCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Report an error for potential auto-healing (Memory-optimized)
   */
  async reportError(error: ErrorLog): Promise<void> {
    // MEMORY PROTECTION: Rate limiting to prevent excessive memory usage
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
    
    // MEMORY SAFETY: Strict buffer size limit
    if (this.errorBuffer.length > 25) {
      this.errorBuffer = this.errorBuffer.slice(-15); // Keep only 15 most recent
    }
    
    // Check for known fixes (quick lookup)
    const knownFix = this.getKnownFix(error);
    if (knownFix) {
      console.log('[AUTO-HEAL] Known fix found, scheduling application...');
      // Don't apply immediately to prevent CPU spikes
      setTimeout(() => this.applyKnownFix(error, knownFix), 2000);
      return;
    }

    // MEMORY PROTECTION: Don't restart timer if already set
    if (this.healingTimer) {
      return; // Timer already running, don't create new ones
    }

    // Set timer with longer delay to reduce memory pressure
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
   * Create unique signature for error (Memory-optimized)
   */
  private getErrorSignature(error: ErrorLog): string {
    // Simplified signature generation to reduce memory
    const messageKey = error.message
      .replace(/\d+/g, 'N')
      .replace(/[^\w\s]/g, '') // Remove special chars
      .slice(0, 30); // Further reduced to save memory
    
    return `${error.type}:${messageKey}`;
  }

  /**
   * Store a successful fix in knowledge base
   */
  private learnFix(error: ErrorLog, fix: string): void {
    const signature = this.getErrorSignature(error);
    this.knowledgeBase.set(signature, fix);
    
    // MEMORY SAFETY: Strict limit on knowledge base size
    if (this.knowledgeBase.size > 30) {
      const keys = Array.from(this.knowledgeBase.keys());
      const oldestKey = keys[0];
      this.knowledgeBase.delete(oldestKey);
    }
    
    console.log('[AUTO-HEAL] Learned fix (KB size:', this.knowledgeBase.size, ')');
  }

  /**
   * Apply a known fix (Memory-optimized)
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
   * Trigger automatic healing (Memory-optimized)
   */
  private async triggerAutoHealing(): Promise<void> {
    if (this.isHealing) {
      console.log('[AUTO-HEAL] Already healing, skipping');
      return;
    }

    // MEMORY PROTECTION: Check healing frequency
    if (this.cpuMonitor.healingCount > 2) {
      console.warn('[AUTO-HEAL] Too many healing attempts, pausing for 10 minutes');
      setTimeout(() => {
        this.cpuMonitor.healingCount = 0;
      }, 600000); // 10 minutes instead of 5
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
      // MEMORY SAFETY: Limit error summary to prevent excessive memory usage
      const recentErrors = this.errorBuffer.slice(-3); // Only process last 3 errors
      const errorSummary = recentErrors
        .map(e => `[${e.type}] ${e.message.slice(0, 80)}`)
        .join('\n');

      const issue = `Memory-optimized auto-healing for ${recentErrors.length} errors:\n${errorSummary}`;

      await this.executeHealing(issue);
      this.errorBuffer = [];
      
    } catch (error) {
      console.error('[AUTO-HEAL] Healing failed:', error);
    } finally {
      this.isHealing = false;
    }
  }

  /**
   * Execute healing (Memory-optimized)
   */
  private async executeHealing(issue: string): Promise<void> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error('[AUTO-HEAL] No Anthropic key configured');
      return;
    }

    try {
      const backup = await platformHealing.createBackup(`Auto-heal: ${issue.slice(0, 20)}`);
      const client = new Anthropic({ apiKey: anthropicKey });

      // MEMORY SAFETY: Reduced system prompt to save memory
      const systemPrompt = `Auto-healing module. Fix errors with minimal changes:
${issue.slice(0, 300)}

Tools: readPlatformFile, writePlatformFile, listPlatformFiles
Be surgical. Fix only what's broken.`;

      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307', // Faster model to reduce memory load
        max_tokens: 2000, // Further reduced from 4000
        system: systemPrompt,
        messages: [{ role: 'user', content: issue.slice(0, 300) }], // Reduced input size
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

      // MEMORY SAFETY: Process only first tool use to reduce memory
      const changes: Array<{ path: string; content: string }> = [];
      
      for (const block of response.content.slice(0, 1)) { // Only first block
        if (block.type === 'tool_use' && block.name === 'writePlatformFile') {
          const input = block.input as { path: string; content: string };
          await platformHealing.writePlatformFile(input.path, input.content);
          changes.push(input);
          break;
        }
      }

      if (changes.length > 0) {
        const safety = await platformHealing.validateSafety();
        if (safety.safe) {
          const commitHash = await platformHealing.commitChanges(
            `Auto-heal: Memory optimized fix`,
            changes.map(c => ({ path: c.path, operation: 'modify' as const }))
          );
          console.log('[AUTO-HEAL] Committed:', commitHash);
        } else {
          await platformHealing.rollback(backup.id);
          console.error('[AUTO-HEAL] Safety failed, rolled back');
        }
      }

    } catch (error: any) {
      console.error('[AUTO-HEAL] Execution failed:', error.message.slice(0, 80));
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
    this.knowledgeBase = new Map(Object.entries(knowledge).slice(0, 30)); // Strict limit
    console.log('[AUTO-HEAL] Imported', this.knowledgeBase.size, 'fixes');
  }

  /**
   * Get memory and CPU monitoring stats
   */
  getCpuStats() {
    return {
      errorCount: this.cpuMonitor.errorCount,
      healingCount: this.cpuMonitor.healingCount,
      isHealing: this.isHealing,
      bufferSize: this.errorBuffer.length,
      knowledgeBaseSize: this.knowledgeBase.size,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.stopMemoryCleanup();
    if (this.healingTimer) {
      clearTimeout(this.healingTimer);
      this.healingTimer = null;
    }
    this.errorBuffer = [];
    this.knowledgeBase.clear();
    console.log('[AUTO-HEAL] Resources cleaned up');
  }
}

export const autoHealing = new AutoHealingService();

// MEMORY-OPTIMIZED: Only attach handlers in production with strict throttling
if (process.env.NODE_ENV === 'production') {
  let lastErrorTime = 0;
  const ERROR_THROTTLE = 10000; // Only report errors every 10 seconds max

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
        message: reason?.message || String(reason).slice(0, 150),
        stack: reason?.stack,
      });
    }
  });

  // Clean up on process exit
  process.on('SIGTERM', () => {
    autoHealing.cleanup();
  });

  process.on('SIGINT', () => {
    autoHealing.cleanup();
  });
}