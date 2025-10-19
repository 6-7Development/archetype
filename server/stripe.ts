import Stripe from "stripe";

// Initialize Stripe with secret key (will be undefined if not set)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY not set. Stripe payments will not work.');
}

export const stripe = STRIPE_SECRET_KEY 
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-09-30.clover",
    })
  : null;

// Stripe Price IDs for each plan (these should be set in environment variables)
// Get these from https://dashboard.stripe.com/products
export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ID_STARTER,
  pro: process.env.STRIPE_PRICE_ID_PRO,
  business: process.env.STRIPE_PRICE_ID_BUSINESS,
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE,
};

// Check if Stripe is configured
export function isStripeConfigured(): boolean {
  return stripe !== null;
}

// Get price ID for a plan
export function getPriceIdForPlan(plan: string): string | undefined {
  return STRIPE_PRICE_IDS[plan as keyof typeof STRIPE_PRICE_IDS];
}

// Webhook signing secret (must be set for webhook signature verification)
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Map Stripe price IDs to plan names
export function getPlanNameFromPriceId(priceId: string): string | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS)) {
    if (id === priceId) {
      return plan;
    }
  }
  return null;
}
