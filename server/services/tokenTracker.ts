import { db } from '../db';
import { tokenLedger, users, creditWallets } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

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

export class TokenTracker {
  // Pricing (per 1M tokens)
  private static readonly PRICING: Record<string, { input: number; output: number }> = {
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.5-pro': { input: 3.00, output: 15.00 }
  };

  /**
   * Calculate cost based on token usage and model
   */
  private static calculateCost(usage: TokenUsage, modelUsed: string): number {
    const pricing = this.PRICING[modelUsed] || this.PRICING['gemini-2.5-flash'];
    
    // Calculate actual costs based on prompt and candidates tokens
    const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.candidatesTokens / 1_000_000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Convert USD cost to credits
   * NOTE: In our system, 1 credit = $1.00 (not $0.0005)
   * This aligns with the creditWallets table which stores dollar-equivalent credits
   */
  private static costToCredits(costUsd: number): number {
    // Simply return the USD amount as credits (1:1 ratio)
    return Math.ceil(costUsd * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Log token usage and deduct credits
   */
  static async logAndDeduct(usage: TokenUsage, context: BillingContext): Promise<void> {
    // Platform healing = FREE (skip billing)
    if (context.targetContext === 'platform') {
      console.log('[TOKEN-TRACKER] Platform healing - FREE access, no charges');
      
      // Still log for analytics (with 0 cost)
      await db.insert(tokenLedger).values({
        userId: context.userId,
        totalTokens: usage.totalTokens,
        promptTokens: usage.promptTokens,
        candidatesTokens: usage.candidatesTokens,
        modelUsed: context.modelUsed,
        requestType: context.requestType,
        costUsd: '0.00',
        creditsCharged: 0,
        agentRunId: context.agentRunId,
        targetContext: context.targetContext,
        projectId: context.projectId,
      });
      
      return;
    }

    // Calculate cost
    const costUsd = this.calculateCost(usage, context.modelUsed);
    const creditsToCharge = this.costToCredits(costUsd);

    console.log(`[TOKEN-TRACKER] Billing: ${usage.totalTokens} tokens = ${creditsToCharge} credits ($${costUsd.toFixed(6)})`);

    // Deduct credits atomically
    await db.transaction(async (tx) => {
      // 1. Get or create credit wallet
      let [userCredits] = await tx
        .select()
        .from(creditWallets)
        .where(eq(creditWallets.userId, context.userId))
        .limit(1);

      // Create wallet if missing (with 0 balance)
      if (!userCredits) {
        console.log(`[TOKEN-TRACKER] Creating credit wallet for user ${context.userId}`);
        [userCredits] = await tx
          .insert(creditWallets)
          .values({
            userId: context.userId,
            availableCredits: 0,
            reservedCredits: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
      }

      // 2. Check balance
      if (userCredits.availableCredits < creditsToCharge) {
        throw new Error(`Insufficient credits. Required: ${creditsToCharge}, Available: ${userCredits.availableCredits}`);
      }

      // 3. Deduct credits
      await tx
        .update(creditWallets)
        .set({
          availableCredits: sql`${creditWallets.availableCredits} - ${creditsToCharge}`,
          updatedAt: new Date(),
        })
        .where(eq(creditWallets.userId, context.userId));

      // 4. Log to ledger
      await tx.insert(tokenLedger).values({
        userId: context.userId,
        totalTokens: usage.totalTokens,
        promptTokens: usage.promptTokens,
        candidatesTokens: usage.candidatesTokens,
        modelUsed: context.modelUsed,
        requestType: context.requestType,
        costUsd: costUsd.toFixed(6),
        creditsCharged: creditsToCharge,
        agentRunId: context.agentRunId,
        targetContext: context.targetContext,
        projectId: context.projectId,
      });
    });

    console.log(`[TOKEN-TRACKER] ✅ Charged ${creditsToCharge} credits to user ${context.userId}`);
  }

  /**
   * Pre-execution limit check
   */
  static async checkLimit(userId: string, estimatedTokens: number, targetContext: 'platform' | 'project'): Promise<{ allowed: boolean; reason?: string; currentBalance?: number }> {
    // Platform healing = FREE (always allowed)
    if (targetContext === 'platform') {
      return { allowed: true };
    }

    // Estimate credits needed
    const creditsNeeded = Math.ceil(estimatedTokens / 1000);

    // Check balance
    const [userCredits] = await db
      .select()
      .from(creditWallets)
      .where(eq(creditWallets.userId, userId))
      .limit(1);

    const currentBalance = userCredits?.availableCredits || 0;

    if (currentBalance < creditsNeeded) {
      return {
        allowed: false,
        reason: `Insufficient credits. Required: ${creditsNeeded}, Available: ${currentBalance}`,
        currentBalance
      };
    }

    return { allowed: true, currentBalance };
  }
}
