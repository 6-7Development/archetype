import { Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
});

/**
 * Middleware to validate user has valid payment method on file
 * Blocks agent requests with 402 Payment Required if no card
 */
export async function requirePaymentMethod(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.authenticatedUserId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 🧪 DEV-ONLY BILLING BYPASS: Allow free testing without granting owner privileges
    if (process.env.NODE_ENV === 'development' && process.env.LOMU_BILLING_BYPASS === 'true') {
      console.log('[BILLING-BYPASS] ⚠️  Payment validation skipped (dev mode)');
      return next();
    }

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is owner (bypass payment requirement)
    if (user.isOwner) {
      req.isOwner = true;
      return next();
    }

    // Check billing status
    if (user.billingStatus === 'suspended') {
      return res.status(402).json({
        error: 'Billing suspended. Please update your payment method.',
        requiresPaymentSetup: true,
      });
    }

    // Check if user has payment method on file
    if (!user.defaultPaymentMethodId) {
      return res.status(402).json({
        error: 'Payment method required. Please add a card to use AI agents.',
        requiresPaymentSetup: true,
      });
    }

    // Verify payment method is still valid with Stripe
    if (user.stripeCustomerId) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(user.defaultPaymentMethodId);
        
        if (!paymentMethod || paymentMethod.customer !== user.stripeCustomerId) {
          // Payment method invalid or detached
          await db
            .update(users)
            .set({ defaultPaymentMethodId: null, billingStatus: 'suspended' })
            .where(eq(users.id, userId));

          return res.status(402).json({
            error: 'Payment method invalid. Please update your payment method.',
            requiresPaymentSetup: true,
          });
        }
      } catch (stripeError: any) {
        console.error('[PAYMENT-VALIDATION] Stripe error:', stripeError.message);
        // Continue if Stripe is temporarily down (fail open for existing customers)
      }
    }

    // All checks passed
    next();
  } catch (error: any) {
    console.error('[PAYMENT-VALIDATION] Error:', error);
    res.status(500).json({ error: 'Payment validation failed' });
  }
}

/**
 * Middleware to check if user has sufficient credits
 * Estimates credits needed and validates availability
 */
export async function requireSufficientCredits(estimatedCredits: number = 100) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.authenticatedUserId;

      // 🧪 DEV-ONLY BILLING BYPASS: Allow free testing without granting owner privileges
      if (process.env.NODE_ENV === 'development' && process.env.LOMU_BILLING_BYPASS === 'true') {
        console.log('[BILLING-BYPASS] ⚠️  Credit validation skipped (dev mode)');
        return next();
      }

      // Owner bypass
      if (req.isOwner) {
        return next();
      }

      const CreditManager = (await import('../services/creditManager')).CreditManager;
      const balance = await CreditManager.getBalance(userId);

      if (!balance) {
        return res.status(500).json({ error: 'Could not retrieve credit balance' });
      }

      if (balance.availableCredits < estimatedCredits) {
        return res.status(402).json({
          error: `Insufficient credits. Need at least ${estimatedCredits} credits. You have ${balance.availableCredits}.`,
          creditsNeeded: estimatedCredits,
          creditsAvailable: balance.availableCredits,
          requiresCreditPurchase: true,
        });
      }

      next();
    } catch (error: any) {
      console.error('[CREDIT-VALIDATION] Error:', error);
      res.status(500).json({ error: 'Credit validation failed' });
    }
  };
}
