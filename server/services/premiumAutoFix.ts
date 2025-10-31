import { db } from "../db";
import Stripe from "stripe";
import {
  premiumFixAttempts,
  errorSignatureDeduplication,
  type InsertPremiumFixAttempt,
  type PremiumFixAttempt,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
}) : null;

/**
 * Premium Auto-Fix Payment Service
 * 
 * Handles Stripe payment flow with hold-then-capture pattern:
 * 1. Calculate cost (base AI tokens + 50% service fee)
 * 2. Create payment intent with manual capture
 * 3. Hold payment (authorize but don't charge)
 * 4. Run sandbox tests + apply fix
 * 5. Monitor health for 5 minutes
 * 6. Capture payment only if successful
 * 7. Refund/cancel if failed
 * 
 * CRITICAL: Never charge twice for same error signature!
 */

export interface PaymentHoldConfig {
  userId: string;
  projectId: string;
  errorSignature: string;
  errorType: string;
  errorDescription: string;
  baseTokenCost: number; // Actual AI cost in dollars
  serviceFeePercent?: number; // Default 50%
}

export interface PaymentHoldResult {
  success: boolean;
  paymentIntentId?: string;
  totalPrice: number;
  alreadyCharged?: boolean; // True if user already paid for this error
  refundAvailable?: boolean; // True if previous payment can be refunded
  error?: string;
}

/**
 * Premium Auto-Fix Payment Manager
 */
export class PremiumAutoFixPayment {
  
  /**
   * Create payment hold (authorize but don't capture)
   * Returns payment intent ID for later capture
   */
  async createPaymentHold(config: PaymentHoldConfig): Promise<PaymentHoldResult> {
    if (!stripe) {
      return {
        success: false,
        totalPrice: 0,
        error: 'Stripe not configured. Set STRIPE_SECRET_KEY environment variable.',
      };
    }

    try {
      console.log('[PAYMENT] Creating payment hold for error:', config.errorSignature);

      // Step 1: Check if user already paid for this error (prevent double-charging)
      const existingDedup = await this.checkExistingPayment(
        config.userId,
        config.projectId,
        config.errorSignature
      );

      if (existingDedup) {
        console.log('[PAYMENT] User already paid for this error. Deduplication triggered.');
        
        return {
          success: false,
          totalPrice: 0,
          alreadyCharged: true,
          error: 'You already paid for a fix attempt for this error. We won\'t charge you again.',
        };
      }

      // Step 2: Calculate total price
      const serviceFeePercent = config.serviceFeePercent || 50;
      const serviceFee = config.baseTokenCost * (serviceFeePercent / 100);
      const totalPrice = config.baseTokenCost + serviceFee;

      console.log(`[PAYMENT] Cost breakdown:
        - Base AI cost: $${config.baseTokenCost.toFixed(2)}
        - Service fee (${serviceFeePercent}%): $${serviceFee.toFixed(2)}
        - Total: $${totalPrice.toFixed(2)}
      `);

      // Step 3: Create Stripe payment intent with manual capture
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalPrice * 100), // Convert to cents
        currency: 'usd',
        capture_method: 'manual', // KEY: Don't charge yet, just authorize
        metadata: {
          userId: config.userId,
          projectId: config.projectId,
          errorSignature: config.errorSignature,
          errorType: config.errorType,
          service: 'premium_auto_fix',
        },
        description: `Premium Auto-Fix: ${config.errorDescription.substring(0, 100)}`,
      });

      console.log('[PAYMENT] Payment intent created (held, not captured):', paymentIntent.id);

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        totalPrice,
      };

    } catch (error: any) {
      console.error('[PAYMENT] Failed to create payment hold:', error);
      
      return {
        success: false,
        totalPrice: 0,
        error: error.message || 'Failed to create payment hold',
      };
    }
  }

  /**
   * Capture payment after successful fix
   * Only call this after sandbox tests pass AND health monitoring succeeds
   */
  async capturePayment(
    paymentIntentId: string,
    fixAttemptId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    try {
      console.log('[PAYMENT] Capturing payment:', paymentIntentId);

      // Capture the held payment
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

      console.log('[PAYMENT] Payment captured successfully:', paymentIntent.id);

      // Update database
      await db
        .update(premiumFixAttempts)
        .set({
          paymentStatus: 'captured',
          paymentCapturedAt: new Date(),
        })
        .where(eq(premiumFixAttempts.id, fixAttemptId));

      return { success: true };

    } catch (error: any) {
      console.error('[PAYMENT] Failed to capture payment:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to capture payment',
      };
    }
  }

  /**
   * Cancel/refund payment after failed fix
   * Call this if sandbox tests fail OR health monitoring detects issues
   */
  async cancelPayment(
    paymentIntentId: string,
    fixAttemptId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    try {
      console.log('[PAYMENT] Canceling payment:', paymentIntentId, 'Reason:', reason);

      // Cancel the payment intent (if not yet captured)
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

      console.log('[PAYMENT] Payment canceled successfully');

      // Update database
      await db
        .update(premiumFixAttempts)
        .set({
          paymentStatus: 'cancelled',
          paymentRefundedAt: new Date(),
        })
        .where(eq(premiumFixAttempts.id, fixAttemptId));

      return { success: true };

    } catch (error: any) {
      console.error('[PAYMENT] Failed to cancel payment:', error);
      
      // If payment was already captured, try to refund instead
      if (error.code === 'payment_intent_unexpected_state') {
        console.log('[PAYMENT] Payment already captured, attempting refund...');
        return await this.refundPayment(paymentIntentId, fixAttemptId, reason);
      }

      return {
        success: false,
        error: error.message || 'Failed to cancel payment',
      };
    }
  }

  /**
   * Refund captured payment (if fix failed after capture)
   */
  async refundPayment(
    paymentIntentId: string,
    fixAttemptId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    try {
      console.log('[PAYMENT] Refunding payment:', paymentIntentId, 'Reason:', reason);

      // Create refund
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer', // Or 'fraudulent' if appropriate
        metadata: {
          fixAttemptId,
          refundReason: reason,
        },
      });

      console.log('[PAYMENT] Refund created successfully:', refund.id);

      // Update database
      await db
        .update(premiumFixAttempts)
        .set({
          paymentStatus: 'refunded',
          paymentRefundedAt: new Date(),
        })
        .where(eq(premiumFixAttempts.id, fixAttemptId));

      return { success: true };

    } catch (error: any) {
      console.error('[PAYMENT] Failed to refund payment:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to refund payment',
      };
    }
  }

  /**
   * Check if user already paid for this error (prevent double-charging)
   */
  private async checkExistingPayment(
    userId: string,
    projectId: string,
    errorSignature: string
  ): Promise<boolean> {
    // Check error signature deduplication table
    const existing = await db.query.errorSignatureDeduplication.findFirst({
      where: and(
        eq(errorSignatureDeduplication.userId, userId),
        eq(errorSignatureDeduplication.projectId, projectId),
        eq(errorSignatureDeduplication.errorSignature, errorSignature)
      ),
    });

    if (!existing) {
      return false; // Never paid for this error before
    }

    // If they paid AND it was successfully resolved, don't charge again
    if (existing.resolved && parseFloat(existing.totalCharged as any) > 0) {
      console.log('[PAYMENT] Error already resolved with payment. Skipping charge.');
      return true;
    }

    // If they paid but fix failed, allow free retry
    if (!existing.resolved && parseFloat(existing.totalCharged as any) > 0) {
      console.log('[PAYMENT] Previous paid fix failed. Allowing free retry.');
      return false; // Allow free retry after failed paid attempt
    }

    return false;
  }

  /**
   * Record error signature to prevent future double-charging
   */
  async recordErrorSignature(
    userId: string,
    projectId: string,
    fixAttemptId: string,
    errorSignature: string,
    errorType: string,
    errorMessage: string,
    totalCharged: number
  ): Promise<void> {
    // Check if signature already exists
    const existing = await db.query.errorSignatureDeduplication.findFirst({
      where: and(
        eq(errorSignatureDeduplication.userId, userId),
        eq(errorSignatureDeduplication.projectId, projectId),
        eq(errorSignatureDeduplication.errorSignature, errorSignature)
      ),
    });

    if (existing) {
      // Update existing record
      await db
        .update(errorSignatureDeduplication)
        .set({
          lastAttemptId: fixAttemptId,
          totalAttempts: existing.totalAttempts + 1,
          totalCharged: (parseFloat(existing.totalCharged as any) + totalCharged).toString(),
          lastChargedAt: totalCharged > 0 ? new Date() : existing.lastChargedAt,
          updatedAt: new Date(),
        })
        .where(eq(errorSignatureDeduplication.id, existing.id));

    } else {
      // Create new record
      await db.insert(errorSignatureDeduplication).values({
        userId,
        projectId,
        errorSignature,
        errorType,
        errorMessage,
        firstAttemptId: fixAttemptId,
        lastAttemptId: fixAttemptId,
        totalAttempts: 1,
        successfulAttempts: 0,
        totalCharged: totalCharged.toString(),
        lastChargedAt: totalCharged > 0 ? new Date() : null,
        resolved: false,
        confidence: '0.00',
      });
    }
  }

  /**
   * Mark error as resolved (prevents future charges for same error)
   */
  async markErrorResolved(
    userId: string,
    projectId: string,
    errorSignature: string,
    fixAttemptId: string
  ): Promise<void> {
    const existing = await db.query.errorSignatureDeduplication.findFirst({
      where: and(
        eq(errorSignatureDeduplication.userId, userId),
        eq(errorSignatureDeduplication.projectId, projectId),
        eq(errorSignatureDeduplication.errorSignature, errorSignature)
      ),
    });

    if (existing) {
      await db
        .update(errorSignatureDeduplication)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: fixAttemptId,
          successfulAttempts: existing.successfulAttempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(errorSignatureDeduplication.id, existing.id));
    }
  }

  /**
   * Generate MD5 error signature from error details
   */
  static generateErrorSignature(errorType: string, errorMessage: string, filePath?: string): string {
    const signatureInput = [errorType, errorMessage, filePath || ''].join('|');
    return crypto.createHash('md5').update(signatureInput).digest('hex');
  }
}

/**
 * Singleton instance
 */
export const premiumAutoFixPayment = new PremiumAutoFixPayment();
