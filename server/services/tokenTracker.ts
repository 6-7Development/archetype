import { db } from '../db';
import { tokenLedger, CREDIT_CONSTANTS } from '@shared/schema';
import { CreditManager } from './creditManager';

interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

interface BillingContext {
  userId: string;
  modelUsed: string;
  requestType: string;
  targetContext: 'platform' | 'project';
  projectId?: string;
  agentRunId?: string;
}

/**
 * TokenTracker - Thin adapter for Gemini API usage tracking
 * 
 * Architecture (per Architect guidance):
 * - Captures Gemini usage_metadata (tokens consumed)
 * - Delegates ALL wallet operations to CreditManager (authoritative billing engine)
 * - Logs analytics to tokenLedger
 * - Uses CREDIT_CONSTANTS for all conversions (1 credit = 1000 tokens = $0.50)
 */
export class TokenTracker {
  // Gemini API pricing (per 1M tokens) - for cost analytics only
  private static readonly PRICING: Record<string, { input: number; output: number }> = {
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.5-pro': { input: 3.00, output: 15.00 }
  };

  /**
   * Calculate provider cost (for analytics/profit tracking)
   * NOTE: This is NOT used for billing! Billing is token-based via CreditManager.
   */
  private static calculateProviderCost(usage: TokenUsage, modelUsed: string): number {
    const pricing = this.PRICING[modelUsed] || this.PRICING['gemini-2.5-flash'];
    
    const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.candidatesTokens / 1_000_000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Log token usage to ledger (analytics only - no wallet mutations)
   * 
   * Platform healing: Logs with 0 credits charged
   * Project work: creditsCharged must be provided by caller (from CreditManager)
   */
  static async logUsage(
    usage: TokenUsage, 
    context: BillingContext,
    creditsCharged: number = 0
  ): Promise<void> {
    const providerCost = this.calculateProviderCost(usage, context.modelUsed);
    
    console.log(
      `[TOKEN-TRACKER] Logging: ${usage.totalTokens} tokens, ` +
      `${creditsCharged} credits, provider cost $${providerCost.toFixed(6)}, ` +
      `context=${context.targetContext}`
    );

    // Log to analytics ledger (no wallet mutations here!)
    await db.insert(tokenLedger).values({
      userId: context.userId,
      totalTokens: usage.totalTokens,
      promptTokens: usage.promptTokens,
      candidatesTokens: usage.candidatesTokens,
      modelUsed: context.modelUsed,
      requestType: context.requestType,
      costUsd: providerCost.toFixed(6),
      creditsCharged,
      agentRunId: context.agentRunId,
      targetContext: context.targetContext,
      projectId: context.projectId,
    });
  }

  /**
   * Calculate credits for token usage
   * Delegates to CreditManager for consistency
   */
  static calculateCredits(promptTokens: number, candidatesTokens: number): number {
    return CreditManager.calculateCreditsForTokens(promptTokens, candidatesTokens);
  }

  /**
   * Pre-execution credit check
   * Delegates to CreditManager for wallet balance checks
   */
  static async checkLimit(
    userId: string, 
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    targetContext: 'platform' | 'project'
  ): Promise<{ allowed: boolean; reason?: string; creditsNeeded?: number; currentBalance?: number }> {
    // Platform healing = FREE (always allowed)
    if (targetContext === 'platform') {
      return { allowed: true };
    }

    // Calculate credits needed using authoritative formula
    const creditsNeeded = CreditManager.calculateCreditsForTokens(
      estimatedInputTokens,
      estimatedOutputTokens
    );

    // Check balance via CreditManager
    const balance = await CreditManager.getBalance(userId);

    // No wallet = 0 credits
    if (!balance) {
      return {
        allowed: false,
        reason: `No credit wallet found. Required: ${creditsNeeded}, Available: 0`,
        creditsNeeded,
        currentBalance: 0
      };
    }

    if (balance.availableCredits < creditsNeeded) {
      return {
        allowed: false,
        reason: `Insufficient credits. Required: ${creditsNeeded}, Available: ${balance.availableCredits}`,
        creditsNeeded,
        currentBalance: balance.availableCredits
      };
    }

    return { 
      allowed: true, 
      creditsNeeded,
      currentBalance: balance.availableCredits 
    };
  }
}
