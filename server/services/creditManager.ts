import { db } from '../db';
import { creditWallets, creditLedger, users, CREDIT_CONSTANTS } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class CreditManager {
  /**
   * Calculate credits required for token usage
   * Formula: creditsRequired = ceil((inputTokens + outputTokens) / TOKENS_PER_CREDIT)
   */
  static calculateCreditsForTokens(inputTokens: number, outputTokens: number): number {
    const totalTokens = inputTokens + outputTokens;
    return Math.ceil(totalTokens / CREDIT_CONSTANTS.TOKENS_PER_CREDIT);
  }

  /**
   * Calculate USD cost for credits
   * Formula: usdCost = credits * CREDIT_DOLLAR_VALUE
   */
  static calculateUSDForCredits(credits: number): number {
    return credits * CREDIT_CONSTANTS.CREDIT_DOLLAR_VALUE;
  }

  /**
   * Reserve credits for an agent run
   * - Checks if user has enough available credits
   * - Moves credits from available to reserved
   * - Returns reservation ID for reconciliation
   */
  static async reserveCredits(params: {
    userId: string;
    creditsNeeded: number;
    agentRunId: string;
  }): Promise<{ success: boolean; error?: string; reservationId?: string }> {
    const { userId, creditsNeeded, agentRunId } = params;

    try {
      const result = await db.transaction(async (tx) => {
        const [wallet] = await tx
          .select()
          .from(creditWallets)
          .where(eq(creditWallets.userId, userId));

        if (!wallet) {
          throw new Error('No credit wallet found');
        }

        if (wallet.availableCredits < creditsNeeded) {
          throw new Error(`Insufficient credits. Need ${creditsNeeded}, have ${wallet.availableCredits}`);
        }

        await tx
          .update(creditWallets)
          .set({
            availableCredits: wallet.availableCredits - creditsNeeded,
            reservedCredits: wallet.reservedCredits + creditsNeeded,
            updatedAt: new Date(),
          })
          .where(eq(creditWallets.userId, userId));

        return { success: true, reservationId: agentRunId };
      });

      return result;
    } catch (error: any) {
      console.error('[CREDIT-MANAGER] Error reserving credits:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reconcile credits after agent run completes
   * - Consumes actual credits used
   * - Returns unused reserved credits to available pool
   * - Logs transaction to credit ledger
   */
  static async reconcileCredits(params: {
    userId: string;
    agentRunId: string;
    creditsReserved: number;
    creditsActuallyUsed: number;
    source: 'lomu_chat' | 'architect_consultation';
    metadata?: any;
  }): Promise<{ success: boolean; error?: string }> {
    const { userId, agentRunId, creditsReserved, creditsActuallyUsed, source, metadata } = params;

    try {
      const creditsToReturn = creditsReserved - creditsActuallyUsed;

      const result = await db.transaction(async (tx) => {
        const [wallet] = await tx
          .select()
          .from(creditWallets)
          .where(eq(creditWallets.userId, userId));

        if (!wallet) {
          throw new Error('No credit wallet found');
        }

        await tx
          .update(creditWallets)
          .set({
            availableCredits: wallet.availableCredits + creditsToReturn,
            reservedCredits: wallet.reservedCredits - creditsReserved,
            updatedAt: new Date(),
          })
          .where(eq(creditWallets.userId, userId));

        await tx.insert(creditLedger).values({
          userId,
          deltaCredits: -creditsActuallyUsed,
          usdAmount: null,
          source,
          referenceId: agentRunId,
          metadata: {
            ...metadata,
            creditsReserved,
            creditsReturned: creditsToReturn,
          },
        });

        return { success: true };
      });

      return result;
    } catch (error: any) {
      console.error('[CREDIT-MANAGER] Error reconciling credits:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add credits to user's wallet (purchase, allocation, refund)
   */
  static async addCredits(params: {
    userId: string;
    credits: number;
    usdAmount?: number;
    source: 'monthly_allocation' | 'purchase' | 'refund' | 'adjustment';
    referenceId?: string;
    metadata?: any;
  }): Promise<{ success: boolean; error?: string }> {
    const { userId, credits, usdAmount, source, referenceId, metadata } = params;

    try {
      // Get or create wallet
      let [wallet] = await db
        .select()
        .from(creditWallets)
        .where(eq(creditWallets.userId, userId));

      if (!wallet) {
        [wallet] = await db
          .insert(creditWallets)
          .values({ userId, availableCredits: 0, reservedCredits: 0 })
          .returning();
      }

      // Add credits to available pool
      await db
        .update(creditWallets)
        .set({
          availableCredits: wallet.availableCredits + credits,
          lastTopUpAt: source === 'purchase' ? new Date() : wallet.lastTopUpAt,
          updatedAt: new Date(),
        })
        .where(eq(creditWallets.userId, userId));

      // Log to ledger (positive delta)
      await db.insert(creditLedger).values({
        userId,
        deltaCredits: credits,
        usdAmount: usdAmount !== undefined ? String(usdAmount) : null,
        source,
        referenceId: referenceId || null,
        metadata: metadata || null,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[CREDIT-MANAGER] Error adding credits:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's current credit balance
   */
  static async getBalance(userId: string): Promise<{
    availableCredits: number;
    reservedCredits: number;
    totalCredits: number;
  } | null> {
    try {
      const [wallet] = await db
        .select()
        .from(creditWallets)
        .where(eq(creditWallets.userId, userId));

      if (!wallet) {
        return null;
      }

      return {
        availableCredits: wallet.availableCredits,
        reservedCredits: wallet.reservedCredits,
        totalCredits: wallet.availableCredits + wallet.reservedCredits,
      };
    } catch (error: any) {
      console.error('[CREDIT-MANAGER] Error getting balance:', error);
      return null;
    }
  }

  /**
   * Check if user is platform owner (gets free credits for certain operations)
   */
  static async isOwner(userId: string): Promise<boolean> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      return user?.isOwner || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Determine if user should be charged for operation
   * Owner gets FREE credits for:
   * - Platform healing (projectId === null)
   * - Their own uploaded projects (future: check project ownership)
   */
  static async shouldChargeUser(userId: string, projectId?: string | null): Promise<boolean> {
    const isOwner = await this.isOwner(userId);
    
    if (!isOwner) {
      return true; // Regular users always get charged
    }
    
    // Owner gets free credits for platform healing (projectId === null)
    // and for their own uploaded projects
    if (!projectId) {
      return false; // Platform healing = FREE for owner
    }
    
    // Check if project belongs to owner
    // (You can add additional logic here to check project ownership)
    return true; // Charge for other users' projects
  }
}
