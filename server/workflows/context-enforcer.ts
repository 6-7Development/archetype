/**
 * CONTEXT ENFORCER - GAP #3 FIX
 * Prevents context window overflow by enforcing hard limits
 * Triggers emergency preservation when approaching limit
 */

import { WORKFLOW_CONFIG } from './workflow-config.ts';

export class ContextEnforcer {
  private static readonly MAX_TOTAL_TOKENS = WORKFLOW_CONFIG.contextWindow.maxTotalTokens;
  private static readonly WARNING_THRESHOLD = WORKFLOW_CONFIG.contextWindow.warningThreshold;
  private static readonly EMERGENCY_PRESERVE = WORKFLOW_CONFIG.contextWindow.emergencyPreserve;

  /**
   * Check if adding new tokens would exceed limit
   * @param currentTokens - Current tokens used
   * @param newTokens - Tokens about to be added
   * @returns { allowed, percentage, warning, emergencyMode }
   */
  static checkLimit(currentTokens: number, newTokens: number = 0): {
    allowed: boolean;
    percentage: number;
    warning: boolean;
    emergencyMode: boolean;
    tokensAvailable: number;
    tokensNeeded: number;
  } {
    const totalAfter = currentTokens + newTokens;
    const percentage = (totalAfter / this.MAX_TOTAL_TOKENS) * 100;
    const tokensAvailable = this.MAX_TOTAL_TOKENS - currentTokens;

    const warning = percentage >= this.WARNING_THRESHOLD;
    const emergencyMode = percentage >= 90;
    const allowed = totalAfter <= this.MAX_TOTAL_TOKENS;

    console.log(`📊 [CONTEXT-ENFORCER] Usage: ${totalAfter}/${this.MAX_TOTAL_TOKENS} tokens (${percentage.toFixed(1)}%)`);

    if (warning) {
      console.warn(`⚠️ [CONTEXT-ENFORCER] WARNING: Approaching context limit (${percentage.toFixed(1)}%)`);
    }

    if (emergencyMode) {
      console.error(`🚨 [CONTEXT-ENFORCER] EMERGENCY: Context limit critical (${percentage.toFixed(1)}%)`);
    }

    return {
      allowed,
      percentage,
      warning,
      emergencyMode,
      tokensAvailable,
      tokensNeeded: newTokens,
    };
  }

  /**
   * Determine if emergency output truncation should be triggered
   */
  static shouldTriggerEmergency(currentTokens: number): boolean {
    const percentage = (currentTokens / this.MAX_TOTAL_TOKENS) * 100;
    return percentage >= 90;
  }

  /**
   * Calculate emergency preservation strategy
   * @param currentTokens - Current tokens used
   * @returns Preservation strategy
   */
  static getEmergencyStrategy(currentTokens: number): {
    maxOutputTokens: number;
    truncateToolResults: boolean;
    skipThinking: boolean;
    actions: string[];
  } {
    const remaining = this.MAX_TOTAL_TOKENS - currentTokens;
    const strategies: string[] = [];

    let maxOutputTokens = Math.min(1000, remaining / 2);
    let truncateToolResults = false;
    let skipThinking = false;

    if (remaining < this.EMERGENCY_PRESERVE) {
      strategies.push('truncate-all-outputs');
      maxOutputTokens = Math.min(500, remaining / 2);
      truncateToolResults = true;
      skipThinking = true;
    } else if (remaining < this.EMERGENCY_PRESERVE * 2) {
      strategies.push('aggressive-truncation');
      maxOutputTokens = Math.min(800, remaining / 2);
      truncateToolResults = true;
    }

    console.log(`🚨 [CONTEXT-ENFORCER] Emergency strategy:`, {
      remaining,
      maxOutputTokens,
      strategies,
    });

    return {
      maxOutputTokens,
      truncateToolResults,
      skipThinking,
      actions: strategies,
    };
  }

  /**
   * Compress conversation history when context threshold exceeded (GAP #6 FIX)
   * Summarizes older messages to preserve context while freeing tokens
   */
  static async compress(messages: any[], currentTokens: number): Promise<{
    compressed: boolean;
    messages: any[];
    tokensSaved: number;
    summary?: string;
  }> {
    const { percentage } = this.checkLimit(currentTokens);
    
    // Only compress if above warning threshold (80%)
    if (percentage < this.WARNING_THRESHOLD) {
      return { compressed: false, messages, tokensSaved: 0 };
    }

    console.log(`🗜️ [CONTEXT-ENFORCER] Compressing context (${percentage.toFixed(1)}% used)`);

    // Preserve recent messages (last 10) and summarize the rest
    const preserveCount = Math.min(10, messages.length);
    const oldMessages = messages.slice(0, -preserveCount);
    const recentMessages = messages.slice(-preserveCount);

    if (oldMessages.length === 0) {
      return { compressed: false, messages, tokensSaved: 0 };
    }

    // Create summary of old messages
    const summary = this.summarizeMessages(oldMessages);
    const estimatedOldTokens = oldMessages.reduce((sum, m) => 
      sum + Math.ceil((m.content?.length || 0) / 4), 0);
    const estimatedSummaryTokens = Math.ceil(summary.length / 4);
    const tokensSaved = Math.max(0, estimatedOldTokens - estimatedSummaryTokens);

    // Create compressed message array
    const compressedMessages = [
      {
        role: 'system',
        content: `[Context Summary - ${oldMessages.length} messages compressed]\n${summary}`,
      },
      ...recentMessages,
    ];

    console.log(`🗜️ [CONTEXT-ENFORCER] Compressed ${oldMessages.length} messages → summary (saved ~${tokensSaved} tokens)`);

    return {
      compressed: true,
      messages: compressedMessages,
      tokensSaved,
      summary,
    };
  }

  /**
   * Simple message summarization (for compression)
   */
  private static summarizeMessages(messages: any[]): string {
    const summaries: string[] = [];
    
    for (const msg of messages) {
      const role = msg.role || 'unknown';
      const content = msg.content || '';
      
      // Extract key information based on role
      if (role === 'assistant' && content.includes('tool')) {
        summaries.push(`- AI used tools to make changes`);
      } else if (role === 'user') {
        const truncated = content.slice(0, 100);
        summaries.push(`- User: ${truncated}${content.length > 100 ? '...' : ''}`);
      } else if (role === 'assistant') {
        const truncated = content.slice(0, 100);
        summaries.push(`- AI: ${truncated}${content.length > 100 ? '...' : ''}`);
      }
    }

    return summaries.slice(-10).join('\n'); // Keep last 10 summary points
  }
}
