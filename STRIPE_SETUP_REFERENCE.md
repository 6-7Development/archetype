# Stripe Setup Reference - Archetype Platform

## Product Configuration Template

Use this exact configuration when creating products in Stripe:

---

### **Product 1: Starter Tier**
```
Name: Archetype Starter
Description: 250,000 tokens per month. Perfect for solo developers and small projects.
Statement descriptor: ARCHETYPE STARTER
Unit label: (leave blank)

Pricing:
  Model: Flat rate
  Price: $49.00 USD
  Billing period: Monthly (recurring every 1 month)
  
Tax code: Software as a Service (SaaS) - txcd_10000000
```

**After saving, copy:** `STRIPE_PRICE_ID_STARTER=price_xxxxxxxxxx`

---

### **Product 2: Pro Tier**
```
Name: Archetype Pro
Description: 750,000 tokens per month. For professional developers building production apps.
Statement descriptor: ARCHETYPE PRO
Unit label: (leave blank)

Pricing:
  Model: Flat rate
  Price: $129.00 USD
  Billing period: Monthly (recurring every 1 month)
  
Tax code: Software as a Service (SaaS) - txcd_10000000
```

**After saving, copy:** `STRIPE_PRICE_ID_PRO=price_xxxxxxxxxx`

---

### **Product 3: Business Tier**
```
Name: Archetype Business
Description: 2,000,000 tokens per month. Team collaboration and priority support.
Statement descriptor: ARCHETYPE BIZ
Unit label: (leave blank)

Pricing:
  Model: Flat rate
  Price: $299.00 USD
  Billing period: Monthly (recurring every 1 month)
  
Tax code: Software as a Service (SaaS) - txcd_10000000
```

**After saving, copy:** `STRIPE_PRICE_ID_BUSINESS=price_xxxxxxxxxx`

---

### **Product 4: Enterprise Tier**
```
Name: Archetype Enterprise
Description: 6,000,000 tokens per month. Unlimited team members and dedicated support.
Statement descriptor: ARCHETYPE ENT
Unit label: (leave blank)

Pricing:
  Model: Flat rate
  Price: $899.00 USD
  Billing period: Monthly (recurring every 1 month)
  
Tax code: Software as a Service (SaaS) - txcd_10000000
```

**After saving, copy:** `STRIPE_PRICE_ID_ENTERPRISE=price_xxxxxxxxxx`

---

## API Keys Location

1. Go to: **Developers** → **API Keys**
2. Copy these two keys:

```bash
# Publishable Key (safe to expose in frontend)
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx

# Secret Key (NEVER expose - backend only)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```

---

## Webhook Setup (Do After Render Deployment)

1. Go to: **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Configure:
   ```
   Endpoint URL: https://your-app.onrender.com/api/webhooks/stripe
   Description: Archetype subscription events
   
   Events to send:
   ✓ checkout.session.completed
   ✓ customer.subscription.created
   ✓ customer.subscription.updated
   ✓ customer.subscription.deleted
   ✓ invoice.payment_succeeded
   ✓ invoice.payment_failed
   ```
4. Copy webhook signing secret: `STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx`

---

## Complete Environment Variable List

After completing Stripe setup, you'll have these 6 variables for Render:

```bash
# API Keys (from Developers → API Keys)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx

# Price IDs (from Products page)
STRIPE_PRICE_ID_STARTER=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_PRO=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_BUSINESS=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_ENTERPRISE=price_xxxxxxxxxxxxx
```

**Webhook Secret (add after deployment):**
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

---

## Testing Your Setup

### Test Card Numbers

Use these in **Test Mode**:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`

Any future expiry date, any CVC, any ZIP code.

### Test the Flow

1. Deploy to Render with test keys
2. Visit your app → Account page
3. Click "Upgrade to Starter"
4. Use test card `4242 4242 4242 4242`
5. Should redirect to success page
6. Check Stripe dashboard → Customers (you should see test customer)

---

## Switching to Live Mode

When ready for production:

1. In Stripe, toggle to **Live Mode** (top right)
2. Create same 4 products in Live Mode
3. Copy new **Live** API keys (`sk_live_`, `pk_live_`)
4. Copy new **Live** Price IDs
5. Update Render environment variables
6. Set up Live webhook endpoint

**Important**: Test Mode and Live Mode are completely separate!

---

## Common Issues

### "No such price"
- **Problem**: Wrong Price ID or using Test ID in Live Mode
- **Fix**: Verify you're in correct mode, copy Price ID again

### "Invalid API Key"
- **Problem**: Using test key in live mode or vice versa
- **Fix**: Match key type to Stripe mode

### Webhook signature verification failed
- **Problem**: Wrong webhook secret
- **Fix**: Copy signing secret from webhook endpoint details

---

## Pricing Summary Reference

Your configured Archetype V3.0 pricing:

| Tier | Price/Month | Tokens Included | Overage Rate |
|------|-------------|-----------------|--------------|
| Free | $0 | 50,000 | None (must upgrade) |
| Starter | $49 | 250,000 | $0.10/1K tokens |
| Pro | $129 | 750,000 | $0.08/1K tokens |
| Business | $299 | 2,000,000 | $0.06/1K tokens |
| Enterprise | $899 | 6,000,000 | $0.05/1K tokens |

Overages are automatically calculated and billed by your platform code.
