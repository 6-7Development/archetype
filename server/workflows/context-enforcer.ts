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
}
