# 🚀 Archetype - Render Deployment Quickstart Guide

**Ready to deploy in 30 minutes!** Follow these steps exactly.

---

## 📋 What You'll Need

Before starting, gather these items:

1. **Render Account** (free) - Sign up at [render.com](https://render.com)
2. **GitHub Account** - For code hosting
3. **Anthropic API Key** - Get from [console.anthropic.com](https://console.anthropic.com)
4. **Stripe Keys** (optional, for billing):
   - Secret Key
   - Webhook Secret
   - Price IDs for each tier

**Time Required**: 30-45 minutes (including database setup)

---

## 🎯 Step-by-Step Deployment

### **STEP 1: Push Code to GitHub** (5 minutes)

If you haven't already, push your code to GitHub:

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Ready for Render deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/archetype.git
git branch -M main
git push -u origin main
```

✅ **Checkpoint**: Your code is now on GitHub

---

### **STEP 2: Create Render Account** (2 minutes)

1. Go to [render.com](https://render.com)
2. Click **"Get Started"** (top right)
3. Sign up with GitHub (recommended for easy integration)
4. Verify your email

✅ **Checkpoint**: You're logged into Render Dashboard

---

### **STEP 3: Create PostgreSQL Database** (3 minutes)

1. In Render Dashboard, click **"New +"** (top right)
2. Select **"PostgreSQL"**
3. Configure database:

   **Settings:**
   ```
   Name: archetype-db
   Database: archetype
   User: archetype_user
   Region: Oregon (US West) - choose closest to your users
   ```

   **Plan:**
   - **Free**: 1GB storage, expires after 90 days (good for testing)
   - **Starter**: $7/mo, 10GB storage (recommended for production)

4. Click **"Create Database"**
5. **Wait 2-3 minutes** for database to provision

6. **Copy Database URL**:
   - Click on your new database
   - Find **"Internal Database URL"**
   - Click the copy icon (📋)
   - **Save this URL** - you'll need it soon!

   Example: `postgresql://archetype_user:abc123...@dpg-xxx.oregon-postgres.render.com/archetype`

✅ **Checkpoint**: Database is running, URL copied

---

### **STEP 4: Create Web Service** (5 minutes)

1. Click **"New +"** → **"Web Service"**
2. Select **"Build and deploy from a Git repository"**
3. Click **"Connect a repository"**
4. Find and select your **archetype** repository
5. Configure service:

   **Basic Settings:**
   ```
   Name: archetype (or your preferred name)
   Region: Oregon (same as database!)
   Branch: main
   Root Directory: (leave blank)
   Runtime: Node
   ```

   **Build Settings:**
   ```
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

   **Plan:**
   - **Free**: 512MB RAM, 750 hours/mo (good for testing)
   - **Starter**: $7/mo, 512MB RAM (recommended for production)

6. **DON'T CLICK "Create Web Service" YET!**
7. Scroll down to **"Environment Variables"** section...

---

### **STEP 5: Configure Environment Variables** (10 minutes)

Still on the web service creation page, click **"Add Environment Variable"** for each:

#### **Required Variables (Add These):**

| Key | Value | Where to Get It |
|-----|-------|----------------|
| `DATABASE_URL` | Paste the URL from Step 3 | Your PostgreSQL database |
| `NODE_ENV` | `production` | Type this exactly |
| `SESSION_SECRET` | Generate below ⬇️ | Run command below |
| `ANTHROPIC_API_KEY` | Your Claude API key | [console.anthropic.com](https://console.anthropic.com) |
| `APP_URL` | Will be updated later | Leave blank for now |
| `ADMIN_SECRET_KEY` | Generate below ⬇️ | Run command below |

#### **Generate Secrets:**

Open your terminal and run these commands to generate secure random strings:

**For SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste as `SESSION_SECRET` value.

**For ADMIN_SECRET_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```
Copy the output and paste as `ADMIN_SECRET_KEY` value.

#### **Optional Variables (For Billing):**

If you want to enable subscriptions and billing, add these **Stripe** keys:

| Key | Value | Where to Get It |
|-----|-------|----------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) |
| `VITE_STRIPE_PUBLIC_KEY` | `pk_live_...` or `pk_test_...` | Same Stripe page |
| `STRIPE_PRICE_ID_STARTER` | `price_...` | [dashboard.stripe.com/products](https://dashboard.stripe.com/products) |
| `STRIPE_PRICE_ID_PRO` | `price_...` | Same Stripe page |
| `STRIPE_PRICE_ID_BUSINESS` | `price_...` | Same Stripe page |
| `STRIPE_PRICE_ID_ENTERPRISE` | `price_...` | Same Stripe page |

> **Note**: You can add Stripe keys later. The platform works without billing features.

8. After adding all variables, scroll down and click **"Create Web Service"**

✅ **Checkpoint**: Service is deploying (this takes 5-10 minutes)

---

### **STEP 6: Monitor Deployment** (10 minutes)

1. You'll see a **build log** screen
2. Watch for these stages:
   - ✅ "Downloading repository..."
   - ✅ "Running build command..."
   - ✅ "npm install" (takes 3-5 minutes)
   - ✅ "npm run build" (takes 2-3 minutes)
   - ✅ "Starting server..."
   - ✅ **"Your service is live!"** 🎉

3. **If build fails:**
   - Check the error message
   - Common issues:
     - Missing environment variable
     - Node version mismatch (should auto-detect Node 20)
     - Build timeout (increase timeout in Settings)

4. **When successful**, you'll see:
   ```
   ==> Your service is live at https://archetype-xxx.onrender.com
   ```

5. **Copy your Render URL** (e.g., `https://archetype-xxx.onrender.com`)

6. **Update APP_URL**:
   - Go to your service → **Environment** tab
   - Find `APP_URL`
   - Update value to your Render URL
   - Click **"Save Changes"**
   - Service will auto-redeploy (takes 1-2 minutes)

✅ **Checkpoint**: Application is live!

---

### **STEP 7: Initialize Database** (3 minutes)

Your database needs tables created. Do this:

1. In Render Dashboard, go to your **archetype** web service
2. Click **"Shell"** tab (top navigation)
3. Wait for shell to connect
4. Run this command:

   ```bash
   npm run db:push
   ```

5. You should see:
   ```
   ✅ Pushing schema to database...
   ✅ Tables created successfully!
   ```

6. Type `exit` to close the shell

**Alternative Method** (if shell doesn't work):

Use your local terminal:
```bash
# Set the Render database URL
export DATABASE_URL="postgresql://archetype_user:..."

# Run migration
npm run db:push
```

✅ **Checkpoint**: Database tables created

---

### **STEP 8: Verify Deployment** (5 minutes)

Test that everything works:

#### **1. Health Check:**

Visit: `https://your-app.onrender.com/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T...",
  "uptime": 123.456,
  "checks": {
    "database": "ok",
    "ai_generation": "ok"
  }
}
```

If you see this, **deployment is successful!** ✅

#### **2. Test the App:**

1. Visit: `https://your-app.onrender.com`
2. Click **"Get Started"** or **"Sign Up"**
3. Create an account
4. Navigate to **Builder** tab
5. Enter a test command: `"Create a simple hello world page"`
6. Watch SySop generate code!

#### **3. Test Mobile View:**

1. Open your app URL on your phone
2. Interface should adapt (hamburger menu, icon-only nav)
3. All features work (AI chat, file browser, preview)

✅ **Checkpoint**: App works on desktop and mobile!

---

### **STEP 9: Configure Stripe Webhooks** (Optional, 5 minutes)

**Only if you added Stripe keys in Step 5:**

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. **Endpoint URL**: `https://your-app.onrender.com/api/webhooks/stripe`
4. **Events to send**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **"Add endpoint"**
6. **Copy Webhook Signing Secret** (starts with `whsec_`)
7. In Render Dashboard:
   - Go to your service → **Environment** tab
   - Find `STRIPE_WEBHOOK_SECRET`
   - Paste the webhook secret
   - Click **"Save Changes"**

✅ **Checkpoint**: Billing system is live!

---

## 🎉 Success! You're Live!

Your Archetype platform is now deployed on Render!

**Your Production URLs:**
- **App**: `https://your-app.onrender.com`
- **Health**: `https://your-app.onrender.com/health`
- **Admin**: `https://your-app.onrender.com/admin/emergency`

---

## 📊 Quick Reference

### **Environment Variables Summary:**

**Required:**
- `DATABASE_URL` - Auto-provided by Render
- `NODE_ENV` - Set to `production`
- `SESSION_SECRET` - Random 32+ char string
- `ANTHROPIC_API_KEY` - Claude API key
- `APP_URL` - Your Render URL
- `ADMIN_SECRET_KEY` - Random 16+ char string

**Optional (Billing):**
- `STRIPE_SECRET_KEY`
- `VITE_STRIPE_PUBLIC_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_*` (4 price IDs)

---

## 🔧 Common Issues & Fixes

### **Build Failed**
- **Check**: Node version (should be Node 20)
- **Fix**: Render auto-detects, but you can set `NODE_VERSION=20` in env vars

### **Database Connection Error**
- **Check**: `DATABASE_URL` is correct
- **Fix**: Copy "Internal Database URL" from your PostgreSQL service
- **Check**: Database and web service are in **same region**

### **"ANTHROPIC_API_KEY not found"**
- **Check**: You added the key to environment variables
- **Fix**: Add it in Environment tab, service will auto-redeploy

### **Health Check Returns Error**
- **Check**: Database tables created (`npm run db:push`)
- **Check**: All required env vars are set
- **Fix**: Review logs in Dashboard → Logs tab

### **Stripe Webhook Fails**
- **Check**: `STRIPE_WEBHOOK_SECRET` is correct
- **Check**: Webhook URL matches your Render URL
- **Fix**: Verify webhook events in Stripe dashboard

---

## 📈 Next Steps

1. **Custom Domain** (optional):
   - Go to Settings → Custom Domain
   - Add your domain (e.g., `app.yourdomain.com`)
   - Update DNS records as shown
   - Update `APP_URL` env var

2. **Monitoring**:
   - Set up uptime monitoring: [uptimerobot.com](https://uptimerobot.com)
   - Enable email alerts in Render Settings

3. **Scaling**:
   - Monitor usage in Render Dashboard
   - Upgrade to **Starter** or **Pro** plan when needed
   - Database will auto-scale with plan

4. **Maintenance**:
   - Render auto-deploys when you push to `main` branch
   - View logs in Dashboard → Logs tab
   - Database backups in PostgreSQL → Backups tab

---

## 💰 Cost Breakdown

### **Free Tier (Testing):**
- Web Service: Free (750 hours/mo)
- PostgreSQL: Free (1GB, 90 day limit)
- **Total**: $0/mo

### **Production (Recommended):**
- Web Service: $7/mo (Starter)
- PostgreSQL: $7/mo (Starter, 10GB)
- Anthropic API: ~$50-100/mo (usage-based)
- **Total**: ~$64-114/mo

---

## 🆘 Need Help?

- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Render Support**: [render.com/support](https://render.com/support)
- **Full Guide**: See `RENDER_DEPLOYMENT.md` in your codebase

---

**Congratulations!** 🎉 

Your Archetype platform is now live and accessible worldwide!
