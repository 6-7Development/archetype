import type { Express } from "express";
import type Stripe from "stripe";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import { webhookLimiter } from "../rateLimiting";
import { stripe, isStripeConfigured, getPriceIdForPlan, STRIPE_WEBHOOK_SECRET, getPlanNameFromPriceId } from "../stripe";
import { upgradeSubscriptionSchema } from "@shared/schema";

export function registerSubscriptionRoutes(app: Express) {
  // Stripe webhook endpoint (raw body parser applied in server/index.ts)
  app.post(
    '/api/webhooks/stripe',
    webhookLimiter,
    async (req, res) => {
      if (!stripe || !STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json({ 
          error: 'Stripe webhooks not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.' 
        });
      }

      const sig = req.headers['stripe-signature'];
      if (!sig) {
        return res.status(400).json({ error: 'No signature header' });
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      // Handle the event
      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as any;
            const userId = session.client_reference_id;
            const customerId = session.customer;
            
            if (userId && customerId) {
              // Update subscription with Stripe customer ID (if not already set)
              const subscription = await storage.getSubscription(userId);
              if (subscription && !subscription.stripeCustomerId) {
                await storage.updateStripeCustomerId(userId, customerId);
              }
            }
            break;
          }

          case 'customer.subscription.created':
          case 'customer.subscription.updated': {
            const subscription = event.data.object as any;
            const customerId = subscription.customer;
            
            // Find user by Stripe customer ID
            const userSubscription = await storage.getSubscriptionByStripeCustomerId(customerId);
            if (userSubscription) {
              const priceId = subscription.items.data[0]?.price.id;
              const planName = priceId ? getPlanNameFromPriceId(priceId) : null;
              
              if (planName) {
                console.log(`✅ Webhook: Updating subscription for user ${userSubscription.userId} to plan ${planName}`);
                await storage.updateSubscription(userSubscription.userId, planName);
              } else {
                console.warn(`⚠️ Webhook: Unknown price ID ${priceId} for customer ${customerId}`);
              }
            } else {
              console.warn(`⚠️ Webhook: No subscription found for Stripe customer ${customerId}`);
            }
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as any;
            const customerId = subscription.customer;
            
            // Find user and cancel subscription
            const userSubscription = await storage.getSubscriptionByStripeCustomerId(customerId);
            if (userSubscription) {
              console.log(`✅ Webhook: Cancelling subscription for user ${userSubscription.userId}`);
              await storage.cancelSubscription(userSubscription.userId);
            } else {
              console.warn(`⚠️ Webhook: No subscription found for Stripe customer ${customerId} (already deleted?)`);
            }
            break;
          }

          case 'invoice.payment_succeeded': {
            // Handle successful recurring payment
            console.log('Invoice payment succeeded:', event.data.object);
            break;
          }

          case 'invoice.payment_failed': {
            // Handle failed recurring payment
            console.log('Invoice payment failed:', event.data.object);
            break;
          }

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (error: any) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

  // POST /api/create-checkout-session - Create Stripe checkout session
  app.post("/api/create-checkout-session", isAuthenticated, async (req, res) => {
    try {
      const { priceId, planName } = req.body;
      const userId = (req as any).authenticatedUserId;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate required fields
      if (!priceId || !planName) {
        return res.status(400).json({ error: "priceId and planName are required" });
      }

      // Check if Stripe is configured
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable." });
      }

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(404).json({ error: "User not found or email missing" });
      }
      
      const userEmail = user.email;

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        client_reference_id: userId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.APP_URL || 'http://localhost:5000'}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/pricing`,
        metadata: {
          userId,
          planName,
        },
      });

      console.log(`✅ Checkout session created for user ${userId}, plan: ${planName}`);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Checkout session error:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  });

  // POST /api/create-template-checkout - Create Stripe checkout for template purchase
  app.post("/api/create-template-checkout", isAuthenticated, async (req, res) => {
    try {
      const { templateId } = req.body;
      const userId = (req as any).authenticatedUserId;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!templateId) {
        return res.status(400).json({ error: "templateId is required" });
      }

      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable." });
      }

      // Fetch template server-side to get authoritative price
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Verify it's a premium template
      if (!template.isPremium || Number(template.price) <= 0) {
        return res.status(400).json({ error: "This template is free" });
      }

      // Check if already purchased
      const alreadyPurchased = await storage.hasUserPurchasedTemplate(userId, templateId);
      if (alreadyPurchased) {
        return res.status(400).json({ error: "You already own this template" });
      }

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(404).json({ error: "User not found or email missing" });
      }

      const userEmail = user.email;
      const price = Number(template.price);

      // Create one-time payment Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        client_reference_id: userId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Template: ${template.name}`,
                description: 'Premium template for Archetype',
              },
              unit_amount: Math.round(price * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:5000'}/marketplace?template=${templateId}&purchased=true`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/marketplace?template=${templateId}`,
        metadata: {
          userId,
          templateId,
          type: 'template_purchase',
        },
      });

      console.log(`✅ Template checkout session created for user ${userId}, template: ${templateId}`);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Template checkout error:', error);
      res.status(500).json({ error: error.message || 'Failed to create template checkout' });
    }
  });

  // GET /api/subscriptions/:userId - Get user subscription
  app.get("/api/subscriptions/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.authenticatedUserId;

      // Users can only view their own subscription
      if (userId !== authenticatedUserId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const subscription = await storage.getSubscription(userId);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      res.json(subscription);
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch subscription' });
    }
  });

  // POST /api/subscriptions/upgrade - Upgrade subscription plan
  app.post("/api/subscriptions/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const validated = upgradeSubscriptionSchema.parse(req.body);
      
      await storage.updateSubscription(userId, validated.plan);
      const subscription = await storage.getSubscription(userId);
      
      res.json(subscription);
    } catch (error: any) {
      console.error('Error upgrading subscription:', error);
      res.status(400).json({ error: error.message || 'Failed to upgrade subscription' });
    }
  });

  // POST /api/subscriptions/cancel - Cancel subscription
  app.post("/api/subscriptions/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      
      await storage.cancelSubscription(userId);
      const subscription = await storage.getSubscription(userId);
      
      res.json(subscription);
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
    }
  });
}
