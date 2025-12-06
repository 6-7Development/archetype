# Complete Stripe Setup Guide - Archetype Platform
## All Products, Pricing, Tax, and Overage Configuration

---

## 🎯 TAX INFORMATION (Read First!)

### **Do You Need to Collect Tax?**

**SaaS IS taxable** in many jurisdictions:
- **US States**: 23+ states tax SaaS (varies by state)
- **EU**: 20% VAT required for EU customers
- **Canada**: GST/HST applies
- **UK**: 20% VAT applies

### **Stripe Tax (Recommended Setup)**

Stripe Tax automatically calculates and collects sales tax worldwide.

**How to Enable:**
1. In Stripe Dashboard, go to **"Tax"** (left sidebar)
2. Click **"Get started"** or **"Set up"**
3. Choose your business location
4. Enable automatic tax collection
5. **Cost**: $0.50 per invoice + 0.5% of transaction (worth it for compliance!)

**Then for each product:**
- Set Tax behavior: **"Inclusive"** or **"Exclusive"** (see below)
- Set Product tax code: **"Software as a Service (SaaS)"** - Code: `txcd_10000000`

### **Tax Behavior Options:**

**Exclusive (Recommended):**
- Price shown: $49/mo
- Customer pays: $49 + applicable tax
- Example: California customer pays $49 + $4.68 tax = $53.68

**Inclusive:**
- Price shown: $49/mo
- Tax is already included in $49
- You receive less after tax deduction

👉 **Use "Exclusive"** - customers expect to pay tax on top of advertised price

---

## 📦 PRODUCT 1: STARTER TIER

### **Basic Information:**
```
Product name: Archetype Starter
Description: 250,000 AI tokens per month - Perfect for solo developers and small projects. Includes SySop autonomous coding agent, file management, and live preview.
```

### **Pricing:**
Scroll up in the form to set:
```
Price: $49.00
Currency: USD
Billing period: Monthly (recurring every 1 month)
Free trial: (Leave unchecked - we handle trials in code)
```

### **Statement Descriptor:**
```
ARCHETYPE STARTER
```
*(15 chars max - appears on customer's credit card statement)*

### **Unit Label:**
```
(Leave blank)
```
*(Only for per-unit pricing like "seats" - not needed for flat subscriptions)*

### **Tax Configuration:**
```
Product tax code: Software as a Service (SaaS)
Tax behavior: Exclusive (customer pays tax on top)
```

### **Metadata** (Optional but useful):
```
Key: tier
Value: starter

Key: tokens_included
Value: 250000

Key: overage_rate
Value: 0.10
```

### **Marketing Feature List:**
Add these features (visible to customers):
```
✓ 250,000 AI tokens per month
✓ SySop autonomous coding agent
✓ Real-time code generation
✓ File browser & Monaco editor
✓ Live project preview
✓ Basic support
```

**Click "Add product"** → **COPY THE PRICE ID** (starts with `price_`)

---

## 📦 PRODUCT 2: PRO TIER

### **Basic Information:**
```
Product name: Archetype Pro
Description: 750,000 AI tokens per month - For professional developers building production applications. Includes priority support and advanced features.
```

### **Pricing:**
```
Price: $129.00
Currency: USD
Billing period: Monthly (recurring every 1 month)
```

### **Statement Descriptor:**
```
ARCHETYPE PRO
```

### **Unit Label:**
```
(Leave blank)
```

### **Tax Configuration:**
```
Product tax code: Software as a Service (SaaS)
Tax behavior: Exclusive
```

### **Metadata:**
```
Key: tier
Value: pro

Key: tokens_included
Value: 750000

Key: overage_rate
Value: 0.08
```

### **Marketing Feature List:**
```
✓ 750,000 AI tokens per month
✓ Everything in Starter, plus:
✓ Priority AI processing
✓ Advanced debugging tools
✓ Custom domain support
✓ Priority support (24hr response)
✓ Team collaboration (up to 3 members)
```

**Click "Add product"** → **COPY THE PRICE ID**

---

## 📦 PRODUCT 3: BUSINESS TIER

### **Basic Information:**
```
Product name: Archetype Business
Description: 2,000,000 AI tokens per month - For teams and agencies. Includes unlimited team members, advanced analytics, and dedicated support.
```

### **Pricing:**
```
Price: $299.00
Currency: USD
Billing period: Monthly (recurring every 1 month)
```

### **Statement Descriptor:**
```
ARCHETYPE BIZ
```

### **Unit Label:**
```
(Leave blank)
```

### **Tax Configuration:**
```
Product tax code: Software as a Service (SaaS)
Tax behavior: Exclusive
```

### **Metadata:**
```
Key: tier
Value: business

Key: tokens_included
Value: 2000000

Key: overage_rate
Value: 0.06
```

### **Marketing Feature List:**
```
✓ 2,000,000 AI tokens per month
✓ Everything in Pro, plus:
✓ Unlimited team members
✓ Advanced usage analytics
✓ Custom branding
✓ API access (Pro+ users)
✓ Dedicated account manager
✓ Priority support (4hr response)
```

**Click "Add product"** → **COPY THE PRICE ID**

---

## 📦 PRODUCT 4: ENTERPRISE TIER

### **Basic Information:**
```
Product name: Archetype Enterprise
Description: 6,000,000 AI tokens per month - For large organizations. Includes everything plus custom integrations, SLA guarantees, and white-glove support.
```

### **Pricing:**
```
Price: $899.00
Currency: USD
Billing period: Monthly (recurring every 1 month)
```

### **Statement Descriptor:**
```
ARCHETYPE ENT
```

### **Unit Label:**
```
(Leave blank)
```

### **Tax Configuration:**
```
Product tax code: Software as a Service (SaaS)
Tax behavior: Exclusive
```

### **Metadata:**
```
Key: tier
Value: enterprise

Key: tokens_included
Value: 6000000

Key: overage_rate
Value: 0.05
```

### **Marketing Feature List:**
```
✓ 6,000,000 AI tokens per month
✓ Everything in Business, plus:
✓ Custom AI model fine-tuning
✓ Private deployment options
✓ SSO/SAML authentication
✓ 99.9% uptime SLA
✓ Custom integrations
✓ White-glove onboarding
✓ Dedicated support (1hr response)
```

**Click "Add product"** → **COPY THE PRICE ID**

---

## 💰 OVERAGE CHARGES - HOW THEY WORK

### **Important: Overages are NOT Stripe products!**

Your platform code (already implemented) handles overage billing:

1. **User subscribes to Starter** ($49/mo via Stripe)
2. **They use 300K tokens** (50K over their 250K limit)
3. **Archetype tracks overage**: 50K tokens × $0.10/1K = $5.00
4. **Overage stored in database** (usage_logs table)
5. **Monthly billing**: Next invoice = $49 + $5 overage = $54

### **Overage Rates (Already Configured in Code):**
```
Starter: $0.10 per 1,000 tokens
Pro: $0.08 per 1,000 tokens
Business: $0.06 per 1,000 tokens
Enterprise: $0.05 per 1,000 tokens
```

### **How Overage Billing Works:**

**Option 1: Automatic (Recommended - Already Coded)**
- Archetype calculates overage at end of billing cycle
- Creates Stripe invoice item for overage charge
- Stripe adds it to next subscription invoice
- Customer pays subscription + overage in one charge

**Option 2: Manual Reporting**
- You review overage reports monthly
- Manually create invoices for large overage amounts
- More control, more work

👉 **Your platform uses Option 1** - it's already coded in `server/usage-tracking.ts` and `server/stripe.ts`

### **No Additional Stripe Setup Needed for Overages!**

The subscription products you create are just the base plans. Overage billing happens automatically through:
- `usage_logs` table (tracks token usage)
- `checkUsageLimits()` function (calculates overages)
- Stripe API calls (creates invoice items)

---

## 🔑 API KEYS - WHERE TO FIND THEM

After creating all 4 products:

### **Step 1: Get API Keys**
1. In Stripe sidebar, click **"Developers"**
2. Click **"API keys"**
3. You'll see:

   **Publishable key** (safe for frontend):
   ```
   pk_test_xxxxxxxxxxxxx (Test Mode)
   pk_live_xxxxxxxxxxxxx (Live Mode)
   ```
   
   **Secret key** (backend only - NEVER expose):
   ```
   Click "Reveal test key token" → sk_test_xxxxxxxxxxxxx
   Click "Reveal live key token" → sk_live_xxxxxxxxxxxxx
   ```

### **Step 2: Copy All Values**

You'll have **6 values total**:

```bash
# API Keys (from Developers → API keys)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx

# Price IDs (from each product page)
STRIPE_PRICE_ID_STARTER=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_PRO=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_BUSINESS=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_ENTERPRISE=price_xxxxxxxxxxxxx
```

---

## 🌐 WEBHOOK SETUP (After Render Deployment)

Webhooks notify your app when payments succeed/fail.

### **Setup Steps:**
1. Deploy to Render first (get your app URL)
2. In Stripe, go to **"Developers"** → **"Webhooks"**
3. Click **"Add endpoint"**
4. Configure:

```
Endpoint URL: https://your-app.onrender.com/api/webhooks/stripe

Description: Archetype subscription and payment events

Events to send (select these):
✓ checkout.session.completed
✓ customer.subscription.created
✓ customer.subscription.updated
✓ customer.subscription.deleted
✓ invoice.payment_succeeded
✓ invoice.payment_failed
✓ invoice.finalized (for overage billing)
```

5. Click **"Add endpoint"**
6. **Copy Webhook Signing Secret**: `whsec_xxxxxxxxxxxxx`
7. Add to Render as: `STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx`

---

## ✅ FINAL CHECKLIST

### **In Stripe:**
- [ ] Created 4 products (Starter, Pro, Business, Enterprise)
- [ ] Copied all 4 Price IDs
- [ ] Enabled Stripe Tax (optional but recommended)
- [ ] Set tax behavior to "Exclusive" on all products
- [ ] Set product tax code to "SaaS" on all products
- [ ] Copied API keys (Secret & Publishable)
- [ ] Noted: Webhook setup comes after Render deployment

### **For Render Deployment:**
- [ ] Have all 6 values ready:
  - STRIPE_SECRET_KEY
  - VITE_STRIPE_PUBLIC_KEY
  - STRIPE_PRICE_ID_STARTER
  - STRIPE_PRICE_ID_PRO
  - STRIPE_PRICE_ID_BUSINESS
  - STRIPE_PRICE_ID_ENTERPRISE

### **After Render Deployment:**
- [ ] Create webhook endpoint
- [ ] Copy webhook secret
- [ ] Add STRIPE_WEBHOOK_SECRET to Render

---

## 🧪 TESTING YOUR SETUP

### **Test Mode Cards:**
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184

Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any ZIP code (e.g., 10001)
```

### **Test Flow:**
1. Deploy to Render with test keys
2. Visit your app → Sign up
3. Go to Account page → "Upgrade to Starter"
4. Enter test card `4242 4242 4242 4242`
5. Complete checkout
6. Check Stripe Dashboard → Customers (should see your test customer)
7. Check Stripe Dashboard → Payments (should see $49 charge)

---

## 💡 PRO TIPS

### **Tax Compliance:**
- **Enable Stripe Tax** if selling globally - worth the $0.50/invoice
- Stripe handles all nexus calculations and tax remittance
- Reduces audit risk significantly

### **Test Mode vs Live Mode:**
- Start in **Test Mode** (keys start with `sk_test_`, `pk_test_`)
- Switch to **Live Mode** when ready to accept real payments
- You'll need to recreate products and copy new Price IDs in Live Mode

### **Overage Billing:**
- Already implemented in your platform code
- No additional Stripe setup needed
- Automatically creates invoice items each month
- Customers see one combined charge (subscription + overages)

### **Monitoring:**
- Check Stripe Dashboard → Payments (daily)
- Check Stripe Dashboard → Subscriptions (for active customers)
- Check Stripe Dashboard → Invoices (for overage charges)

---

## 📊 PRICING SUMMARY REFERENCE

| Tier | Price/Mo | Tokens Included | Overage Rate | Approx Projects/Mo |
|------|----------|-----------------|--------------|-------------------|
| Free | $0 | 50,000 | Must upgrade | 5-10 |
| Starter | $49 | 250,000 | $0.10/1K | 25-50 |
| Pro | $129 | 750,000 | $0.08/1K | 75-150 |
| Business | $299 | 2,000,000 | $0.06/1K | 200-400 |
| Enterprise | $899 | 6,000,000 | $0.05/1K | 600-1200 |

**Platform margins: 82-90% (after AI costs)**

---

## 🆘 COMMON QUESTIONS

**Q: Do I need to create separate products for overages?**
A: No! Your platform code handles overage billing automatically.

**Q: Should I use Test Mode or Live Mode first?**
A: Start with Test Mode. Switch to Live when ready for real customers.

**Q: Is SaaS taxable?**
A: Yes, in many jurisdictions. Enable Stripe Tax for automatic compliance.

**Q: What if a customer uses more than their limit?**
A: Depends on their tier:
- Free: Blocked at limit (must upgrade)
- Paid without card: Blocked at limit (must add payment method)
- Paid with card: Charged for overages automatically

**Q: How do customers see their usage?**
A: In your platform's Usage Dashboard (already built!)

---

**You're ready to set up Stripe!** Follow the 4 product configurations above, then come back with your 6 values for Render deployment.
