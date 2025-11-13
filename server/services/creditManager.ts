import { db } from '../db';
import { creditWallets, creditLedger, users, CREDIT_CONSTANTS } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createEvent, BillingWarningData } from '@shared/agentEvents';
import type { WebSocketServer } from 'ws';

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
   * CRITICAL FIX: Uses atomic UPDATE with balance guard to prevent race conditions
   */
  static async reserveCredits(params: {
    userId: string;
    creditsNeeded: number;
    agentRunId: string;
    wss?: WebSocketServer;
    sessionId?: string;
  }): Promise<{ success: boolean; error?: string; reservationId?: string }> {
    const { userId, creditsNeeded, agentRunId, wss, sessionId } = params;

    try {
      // CRITICAL FIX: Atomic UPDATE with balance guard to prevent race conditions
      // This ensures the check and update happen atomically
      const result = await db
        .update(creditWallets)
        .set({
          availableCredits: sql`available_credits - ${creditsNeeded}`,
          reservedCredits: sql`reserved_credits + ${creditsNeeded}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(creditWallets.userId, userId),
            sql`available_credits >= ${creditsNeeded}` // Guard against negative balance
          )
        )
        .returning();

      if (result.length === 0) {
        // Either wallet doesn't exist or insufficient credits
        const [wallet] = await db
          .select()
          .from(creditWallets)
          .where(eq(creditWallets.userId, userId));

        if (!wallet) {
          return { success: false, error: 'No credit wallet found' };
        }

        return {
          success: false,
          error: `Insufficient credits. Need ${creditsNeeded}, have ${wallet.availableCredits}`,
        };
      }

      // Check balance and emit billing warnings if WebSocket is available
      if (wss && sessionId) {
        const updatedWallet = result[0];
        const remainingCredits = updatedWallet.availableCredits;

        // CRITICAL FIX: Calculate percentage based on user's ACTUAL monthly allowance
        // This ensures warnings fire at correct thresholds for all subscription tiers
        const userMonthlyAllowance = updatedWallet.initialMonthlyCredits || 5000; // Fallback to 5000
        const percentageUsed = ((userMonthlyAllowance - remainingCredits) / userMonthlyAllowance) * 100;

        const { broadcastToUser } = await import('../routes/websocket');

        // Emit appropriate warning based on percentage thresholds
        if (percentageUsed >= 100) {
          // 100% threshold - critical (out of credits)
          const warningEvent = createEvent<BillingWarningData>(
            'billing.warning',
            'system',
            {
              level: 'critical',
              threshold: 100,
              percentageUsed: Math.round(percentageUsed * 10) / 10, // Round to 1 decimal
              creditsRemaining: remainingCredits,
              message: 'Critical: You have run out of credits! Please add more credits to continue.',
            }
          );
          broadcastToUser(wss, userId, warningEvent);
          console.log('[CREDIT-MANAGER] Emitted 100% critical warning');
        } else if (percentageUsed >= 90) {
          // 90% threshold - warning
          const warningEvent = createEvent<BillingWarningData>(
            'billing.warning',
            'system',
            {
              level: 'warning',
              threshold: 90,
              percentageUsed: Math.round(percentageUsed * 10) / 10, // Round to 1 decimal
              creditsRemaining: remainingCredits,
              message: `Warning: You have ${remainingCredits} credits remaining (${percentageUsed.toFixed(1)}% used). Consider adding more credits soon.`,
            }
          );
          broadcastToUser(wss, userId, warningEvent);
          console.log('[CREDIT-MANAGER] Emitted 90% warning');
        } else if (percentageUsed >= 80) {
          // 80% threshold - info
          const warningEvent = createEvent<BillingWarningData>(
            'billing.warning',
            'system',
            {
              level: 'info',
              threshold: 80,
              percentageUsed: Math.round(percentageUsed * 10) / 10, // Round to 1 decimal
              creditsRemaining: remainingCredits,
              message: `Info: You have ${remainingCredits} credits remaining (${percentageUsed.toFixed(1)}% used).`,
            }
          );
          broadcastToUser(wss, userId, warningEvent);
          console.log('[CREDIT-MANAGER] Emitted 80% info warning');
        }
      }

      return { success: true, reservationId: agentRunId };
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
   * CRITICAL FIX: Uses atomic operations to prevent race conditions
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

      // CRITICAL FIX: Use transaction with atomic operations
      const result = await db.transaction(async (tx) => {
        // Atomic UPDATE with guard to ensure reserved credits are sufficient
        const updateResult = await tx
          .update(creditWallets)
          .set({
            availableCredits: sql`available_credits + ${creditsToReturn}`,
            reservedCredits: sql`reserved_credits - ${creditsReserved}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(creditWallets.userId, userId),
              sql`reserved_credits >= ${creditsReserved}` // Guard against negative reserved
            )
          )
          .returning();

        if (updateResult.length === 0) {
          throw new Error('Insufficient reserved credits to reconcile');
        }

        // Log consumption to ledger
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
          .values({ 
            userId, 
            availableCredits: 0, 
            reservedCredits: 0,
            initialMonthlyCredits: source === 'monthly_allocation' ? credits : 5000
          })
          .returning();
      }

      // Add credits to available pool
      // CRITICAL FIX: Set initialMonthlyCredits when doing monthly_allocation
      // This records the user's subscription tier allowance for accurate percentage calculations
      const updateData: any = {
        availableCredits: wallet.availableCredits + credits,
        lastTopUpAt: source === 'purchase' ? new Date() : wallet.lastTopUpAt,
        updatedAt: new Date(),
      };
      
      // Update initialMonthlyCredits only for monthly allocations
      if (source === 'monthly_allocation') {
        updateData.initialMonthlyCredits = credits;
      }

      await db
        .update(creditWallets)
        .set(updateData)
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
   * CRITICAL FIX: Now includes initialMonthlyCredits for accurate color coding
   */
  static async getBalance(userId: string): Promise<{
    availableCredits: number;
    reservedCredits: number;
    totalCredits: number;
    initialMonthlyCredits: number;
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
        initialMonthlyCredits: wallet.initialMonthlyCredits || 5000, // Fallback to 5000
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
