import { Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { isAuthenticated } from '../universalAuth';
import { CreditManager } from '../services/creditManager';
import { CREDIT_CONSTANTS } from '@shared/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover' as any,
});

// Credit packages
const CREDIT_PACKAGES = {
  small: { credits: 5000, usd: 2.50, name: '5K Credits' },
  medium: { credits: 25000, usd: 11.25, name: '25K Credits' },
  large: { credits: 100000, usd: 40.00, name: '100K Credits' },
  xlarge: { credits: 500000, usd: 187.50, name: '500K Credits' },
};

// Get user credit wallet (simplified for billing meter)
router.get('/wallet', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const balance = await CreditManager.getBalance(userId);

    if (!balance) {
      return res.status(404).json({ error: 'Credit wallet not found' });
    }

    res.json({
      credits: balance.availableCredits,
      initialMonthlyCredits: balance.initialMonthlyCredits,
    });
  } catch (error: any) {
    console.error('[CREDITS] Error getting wallet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user credit balance
// CRITICAL FIX: Now includes initialMonthlyCredits for accurate color coding on first render
router.get('/balance', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const balance = await CreditManager.getBalance(userId);

    if (!balance) {
      return res.status(404).json({ error: 'Credit wallet not found' });
    }

    res.json({
      success: true,
      balance: {
        available: balance.availableCredits,
        reserved: balance.reservedCredits,
        total: balance.totalCredits,
        initialMonthlyCredits: balance.initialMonthlyCredits, // ✅ Added for accurate color coding
      },
      usdValue: CreditManager.calculateUSDForCredits(balance.totalCredits),
    });
  } catch (error: any) {
    console.error('[CREDITS] Error getting balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available credit packages
router.get('/packages', isAuthenticated, async (req: any, res) => {
  try {
    res.json({
      success: true,
      packages: Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => ({
        id,
        ...pkg,
      })),
      constants: CREDIT_CONSTANTS,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Purchase credits
router.post('/purchase', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { packageId } = req.body;

    const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    // Get user with Stripe customer ID
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pkg.usd * 100), // Convert to cents
      currency: 'usd',
      customer: user.stripeCustomerId,
      payment_method: user.defaultPaymentMethodId || undefined,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        userId,
        packageId,
        credits: pkg.credits.toString(),
      },
      description: `${pkg.name} - ${pkg.credits.toLocaleString()} credits`,
    });

    if (paymentIntent.status === 'succeeded') {
      // Add credits to wallet
      await CreditManager.addCredits({
        userId,
        credits: pkg.credits,
        usdAmount: pkg.usd,
        source: 'purchase',
        referenceId: paymentIntent.id,
        metadata: {
          package: packageId,
          paymentIntentId: paymentIntent.id,
        },
      });

      res.json({
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
        },
        creditsAdded: pkg.credits,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment failed',
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
        },
      });
    }
  } catch (error: any) {
    console.error('[CREDITS] Error purchasing credits:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
