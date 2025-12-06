# 🎫 Stripe Setup Guide for Archetype

## Quick Setup (15 minutes)

### Step 1: Create Stripe Account
1. Go to https://stripe.com
2. Sign up for a new account
3. Complete business verification

### Step 2: Get API Keys
1. Go to: https://dashboard.stripe.com/test/apikeys (for testing) or https://dashboard.stripe.com/apikeys (for live)
2. Copy **Secret key** → Save as `STRIPE_SECRET_KEY`
3. Copy **Publishable key** → Save as `VITE_STRIPE_PUBLIC_KEY`

### Step 3: Create Products & Prices
1. Go to: https://dashboard.stripe.com/products
2. Click **+ Add product** for each plan:

#### Starter Plan ($39/month)
- Name: "Archetype Starter"
- Description: "12 projects per month + overages"
- Price: $39.00 USD
- Billing: Recurring monthly
- Copy the **Price ID** (starts with `price_...`) → Save as `STRIPE_PRICE_ID_STARTER`

#### Pro Plan ($99/month)
- Name: "Archetype Pro"
- Description: "30 projects per month + API keys"
- Price: $99.00 USD
- Billing: Recurring monthly
- Copy the **Price ID** → Save as `STRIPE_PRICE_ID_PRO`

#### Business Plan ($249/month)
- Name: "Archetype Business"
- Description: "75 projects + team collaboration"
- Price: $249.00 USD
- Billing: Recurring monthly
- Copy the **Price ID** → Save as `STRIPE_PRICE_ID_BUSINESS`

#### Enterprise Plan ($799/month)
- Name: "Archetype Enterprise"
- Description: "250 projects + priority support"
- Price: $799.00 USD
- Billing: Recurring monthly
- Copy the **Price ID** → Save as `STRIPE_PRICE_ID_ENTERPRISE`

### Step 4: Configure Webhook
1. Go to: https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. **Endpoint URL:** `https://your-replit-domain.replit.dev/api/stripe-webhook`
4. **Select events to listen to:**
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Click **Add endpoint**
6. Click **Reveal** on Signing secret → Copy → Save as `STRIPE_WEBHOOK_SECRET`

### Step 5: Add to Replit Secrets
1. In Replit, go to **Tools** → **Secrets**
2. Add each variable:

```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
VITE_STRIPE_PUBLIC_KEY=pk_test_... (or pk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_BUSINESS=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...
```

3. **Restart the application** (it will auto-restart after adding secrets)

### Step 6: Test the Integration
1. Visit `/pricing` on your app
2. Click **Get Started** on any paid plan
3. You should be redirected to Stripe checkout
4. Use test card: `4242 4242 4242 4242` (any future date, any CVC)
5. Complete checkout
6. Verify subscription appears in your dashboard

---

## Test Mode vs Live Mode

### Test Mode (Development)
- Use test API keys (start with `sk_test_` and `pk_test_`)
- Test card: `4242 4242 4242 4242`
- No real charges
- Good for development and testing

### Live Mode (Production)
- Use live API keys (start with `sk_live_` and `pk_live_`)
- Real credit cards only
- Real charges to customers
- Use only after thorough testing

---

## Troubleshooting

### "Stripe is not configured" error
- Check if `STRIPE_SECRET_KEY` is set in Replit Secrets
- Restart the application after adding secrets

### Webhook not receiving events
- Verify webhook URL matches your deployed domain
- Check webhook signature secret is correct
- Review webhook logs in Stripe dashboard

### Wrong price displayed
- Verify price IDs match exactly (case-sensitive)
- Check price IDs are from the correct Stripe account

### Subscription not activating
- Check webhook events are configured correctly
- Verify webhook signature verification is passing
- Review application logs for errors

---

## Security Checklist

- [ ] Never commit API keys to version control
- [ ] Use test mode for development
- [ ] Verify webhook signatures (already implemented)
- [ ] Use HTTPS for production webhooks
- [ ] Rotate keys if ever exposed
- [ ] Monitor Stripe dashboard for suspicious activity

---

## Quick Reference

**Stripe Dashboard:** https://dashboard.stripe.com  
**Webhook Endpoint:** `/api/stripe-webhook`  
**Test Cards:** https://stripe.com/docs/testing  

**Need Help?**
- Stripe Docs: https://stripe.com/docs
- Support: Create ticket at `/support`
