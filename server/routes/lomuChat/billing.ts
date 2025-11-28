/**
 * Billing module for Hexad
 * Handles token estimation, credit reservation, and usage tracking
 * Extracted from massive lomuChat.ts for maintainability
 */

import { db } from '../../db';
import { chatMessages } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { performanceMonitor } from '../../services/performanceMonitor';

/**
 * Estimate tokens from raw text
 * Using rough approximation: 1 char ≈ 4 tokens (works for English)
 */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens from conversation history
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>
): number {
  return messages.reduce((sum, msg) => {
    const contentTokens = estimateTokensFromText(msg.content);
    const roleTokens = 5; // Role field overhead
    return sum + contentTokens + roleTokens;
  }, 0);
}

/**
 * Fetch recent conversation for token estimation
 */
export async function fetchRecentConversation(
  userId: string,
  isPlatformHealing: boolean,
  limit: number = 5
): Promise<Array<{ role: string; content: string }>> {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.isPlatformHealing, isPlatformHealing)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Calculate estimated input/output tokens for a request
 */
export async function calculateTokenEstimate(
  userId: string,
  userMessage: string,
  isPlatformHealing: boolean
): Promise<{ inputTokens: number; outputTokens: number }> {
  const promptTokens = estimateTokensFromText(userMessage);

  const recentMessages = await fetchRecentConversation(userId, isPlatformHealing, 5);
  const conversationTokens = estimateConversationTokens(recentMessages);

  const estimatedInputTokens = conversationTokens + promptTokens;
  const estimatedOutputTokens = Math.max(1000, estimatedInputTokens * 0.5); // Conservative

  console.log(
    `[BILLING] Token estimates - Input: ${estimatedInputTokens}, Output: ${estimatedOutputTokens}`
  );

  return {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
  };
}

/**
 * Record actual token usage after stream completes
 */
export async function recordTokenUsage(
  userId: string,
  sessionId: string,
  actualInputTokens: number,
  actualOutputTokens: number,
  success: boolean
): Promise<void> {
  const totalTokens = actualInputTokens + actualOutputTokens;

  performanceMonitor.recordMetric({
    timestamp: Date.now(),
    duration: 0, // Will be filled by caller
    tokensUsed: totalTokens,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    success,
  });

  console.log(
    `[BILLING] Recorded usage - Input: ${actualInputTokens}, Output: ${actualOutputTokens}, Total: ${totalTokens}`
  );
}

/**
 * Format billing info for user display
 */
export function formatBillingInfo(inputTokens: number, outputTokens: number, costPerToken: number = 0.05): string {
  const totalTokens = inputTokens + outputTokens;
  const estimatedCost = (totalTokens / 1000) * costPerToken;

  return `📊 Token usage estimate:\n- Input: ${inputTokens.toLocaleString()}\n- Output: ${outputTokens.toLocaleString()}\n- Total: ${totalTokens.toLocaleString()}\n- Estimated cost: $${estimatedCost.toFixed(4)}`;
}

/**
 * Check if user has sufficient credits (non-atomic read-only check)
 * 
 * ⚠️ WARNING: This function only READS credits without reserving them.
 * Use `reserveCreditsAtomic()` for actual credit reservation with transaction safety.
 * 
 * @param userId - User ID to check credits for
 * @param requiredCredits - Number of credits required for operation
 * @returns Object with availability status and optional reason
 */
export async function checkCreditsAvailable(
  userId: string,
  requiredCredits: number
): Promise<{ available: boolean; reason?: string }> {
  try {
    const { creditWallets } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // Fetch user's credit wallet
    const [wallet] = await db.select().from(creditWallets).where(eq(creditWallets.userId, userId));
    
    if (!wallet) {
      console.warn(`[BILLING] No credit wallet found for user ${userId}`);
      return { 
        available: false, 
        reason: 'No credit wallet found. Please contact support.' 
      };
    }
    
    // Calculate truly available credits (available - reserved for active runs)
    const reservedCredits = wallet.reservedCredits || 0;
    const trulyAvailable = wallet.availableCredits - reservedCredits;
    const hasEnoughCredits = trulyAvailable >= requiredCredits;
    
    if (!hasEnoughCredits) {
      console.log(
        `[BILLING] Insufficient credits - User ${userId}: available ${wallet.availableCredits}, reserved ${reservedCredits}, truly available ${trulyAvailable}, needs ${requiredCredits}`
      );
      return { 
        available: false, 
        reason: `Insufficient credits. You have ${trulyAvailable} available credits (${wallet.availableCredits} - ${reservedCredits} reserved) but need ${requiredCredits}.` 
      };
    }
    
    console.log(
      `[BILLING] Credit check passed - User ${userId}: truly available ${trulyAvailable}, needs ${requiredCredits}`
    );
    
    return { available: true };
  } catch (error: any) {
    console.error('[BILLING] Error checking credits:', error);
    // Fail closed: deny access if we can't verify credits
    return { 
      available: false, 
      reason: 'Error verifying credits. Please try again.' 
    };
  }
}

/**
 * 🔒 ATOMIC CREDIT RESERVATION WITH TRANSACTION
 * 
 * Atomically reserves credits using database transaction with row-level locking.
 * Prevents race conditions where concurrent sessions could overspend credits.
 * 
 * LIFECYCLE DOCUMENTATION:
 * 1. reserveCreditsAtomic() - Increments reservedCredits (transaction locked)
 * 2. Agent runs and consumes credits
 * 3. releaseReservedCredits() - Decrements reservedCredits, updates availableCredits
 * 
 * TRANSACTION GUARANTEES:
 * - SELECT FOR UPDATE locks the row until transaction completes
 * - Other concurrent transactions wait for lock to be released
 * - Ensures atomic read-modify-write operation
 * - No two sessions can reserve the same credits
 * 
 * @param userId - User ID to reserve credits for
 * @param creditsToReserve - Number of credits to reserve
 * @returns Success status with optional error reason
 */
export async function reserveCreditsAtomic(
  userId: string,
  creditsToReserve: number
): Promise<{ success: boolean; reason?: string }> {
  const { creditWallets } = await import('@shared/schema');
  const { eq, sql } = await import('drizzle-orm');
  
  try {
    // Start transaction with row-level locking
    const result = await db.transaction(async (tx) => {
      // STEP 1: SELECT FOR UPDATE - Lock the row to prevent concurrent modifications
      const [wallet] = await tx
        .select()
        .from(creditWallets)
        .where(eq(creditWallets.userId, userId))
        .for('update'); // 🔒 ROW-LEVEL LOCK - other transactions will wait here
      
      if (!wallet) {
        console.warn(`[BILLING-ATOMIC] No credit wallet found for user ${userId}`);
        return { 
          success: false, 
          reason: 'No credit wallet found. Please contact support.' 
        };
      }
      
      // STEP 2: Check if sufficient credits are available
      const reservedCredits = wallet.reservedCredits || 0;
      const trulyAvailable = wallet.availableCredits - reservedCredits;
      
      if (trulyAvailable < creditsToReserve) {
        console.log(
          `[BILLING-ATOMIC] ❌ Insufficient credits - User ${userId}: ` +
          `available ${wallet.availableCredits}, reserved ${reservedCredits}, ` +
          `truly available ${trulyAvailable}, needs ${creditsToReserve}`
        );
        return { 
          success: false, 
          reason: `Insufficient credits. You have ${trulyAvailable} available but need ${creditsToReserve}.` 
        };
      }
      
      // STEP 3: Atomically reserve credits by incrementing reservedCredits
      await tx
        .update(creditWallets)
        .set({ 
          reservedCredits: sql`${creditWallets.reservedCredits} + ${creditsToReserve}`,
          updatedAt: sql`NOW()`
        })
        .where(eq(creditWallets.userId, userId));
      
      console.log(
        `[BILLING-ATOMIC] ✅ Reserved ${creditsToReserve} credits for user ${userId} ` +
        `(previously reserved: ${reservedCredits}, now reserved: ${reservedCredits + creditsToReserve})`
      );
      
      return { success: true };
    });
    
    return result;
  } catch (error: any) {
    console.error('[BILLING-ATOMIC] Transaction error:', error);
    return { 
      success: false, 
      reason: 'Failed to reserve credits. Please try again.' 
    };
  }
}

/**
 * 🔓 RELEASE RESERVED CREDITS
 * 
 * Decrements reservedCredits and deducts actual consumption from availableCredits.
 * Called after agent run completes (success or failure).
 * 
 * @param userId - User ID to release credits for
 * @param reservedAmount - Amount that was originally reserved
 * @param actualConsumed - Actual credits consumed (may be less than reserved)
 * @returns Success status
 */
export async function releaseReservedCredits(
  userId: string,
  reservedAmount: number,
  actualConsumed: number
): Promise<{ success: boolean; reason?: string }> {
  const { creditWallets } = await import('@shared/schema');
  const { eq, sql } = await import('drizzle-orm');
  
  try {
    await db.transaction(async (tx) => {
      // Lock row and release reservation
      const [wallet] = await tx
        .select()
        .from(creditWallets)
        .where(eq(creditWallets.userId, userId))
        .for('update');
      
      if (!wallet) {
        console.warn(`[BILLING-RELEASE] No wallet found for user ${userId}`);
        return { success: false, reason: 'Wallet not found' };
      }
      
      // Calculate final values
      const newReserved = Math.max(0, (wallet.reservedCredits || 0) - reservedAmount);
      const newAvailable = Math.max(0, wallet.availableCredits - actualConsumed);
      
      // Update wallet
      await tx
        .update(creditWallets)
        .set({
          reservedCredits: newReserved,
          availableCredits: newAvailable,
          updatedAt: sql`NOW()`
        })
        .where(eq(creditWallets.userId, userId));
      
      console.log(
        `[BILLING-RELEASE] ✅ Released ${reservedAmount} reserved, consumed ${actualConsumed} actual ` +
        `for user ${userId} (available: ${wallet.availableCredits} → ${newAvailable}, ` +
        `reserved: ${wallet.reservedCredits} → ${newReserved})`
      );
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[BILLING-RELEASE] Error releasing credits:', error);
    return { 
      success: false, 
      reason: 'Failed to release credits' 
    };
  }
}
