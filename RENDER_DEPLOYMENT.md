# 🚀 Archetype Deployment Guide for Render.com

**Professional-Grade Deployment** - Zero Replit dependencies, 100% portable

---

## 📋 Pre-Deployment Checklist

Before deploying to Render, ensure you have:

- ✅ GitHub repository with your Archetype codebase
- ✅ Anthropic API key (`ANTHROPIC_API_KEY`)
- ✅ Stripe account (optional - for billing features)
- ✅ Tavily API key (optional - for web search features)
- ✅ Render account ([render.com](https://render.com))

---

## 🎯 Quick Start (5 Minutes)

### Option 1: One-Click Deploy (Recommended)

1. **Fork/Push your repository to GitHub**
2. **Connect Render to GitHub** at [dashboard.render.com](https://dashboard.render.com)
3. **Click "New +" → "Blueprint"**
4. **Point to your repository** containing `render.yaml`
5. **Set environment variables** (see below)
6. **Deploy!** 🚀

### Option 2: Manual Setup

Follow the step-by-step guide below for full control.

---

## 📦 Step-by-Step Manual Deployment

### Step 1: Create PostgreSQL Database

1. **Go to Render Dashboard** → [dashboard.render.com](https://dashboard.render.com)
2. **Click "New +"** → **"PostgreSQL"**
3. **Configure**:
   - **Name**: `archetype-db`
   - **Database**: `archetype`
   - **User**: `archetype_user`
   - **Region**: Select closest to your users (e.g., Oregon USA, Frankfurt EU)
   - **Plan**: Start with **Free** (0GB storage) or **Starter** ($7/mo - 1GB storage)
4. **Create Database**
5. **Copy the Internal Database URL** (starts with `postgresql://`)
   - Found in database details → "Internal Database URL"
   - Example: `postgresql://archetype_user:xxx@dpg-xxx.oregon-postgres.render.com/archetype`

---

### Step 2: Create Web Service

1. **Click "New +"** → **"Web Service"**
2. **Connect your GitHub repository**
3. **Configure Service**:

   **Basic Settings:**
   - **Name**: `archetype` (or your preferred name)
   - **Region**: Same as database (e.g., Oregon)
   - **Branch**: `main`
   - **Root Directory**: Leave blank
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

   **Advanced Settings:**
   - **Plan**: Free (512MB RAM) or Starter ($7/mo - 512MB RAM)
   - **Auto-Deploy**: ✅ Yes (redeploy on git push)

4. **Click "Create Web Service"** (don't deploy yet - add env vars first)

---

### Step 3: Configure Environment Variables

In your Web Service settings, go to **"Environment"** tab and add:

#### 🔐 Required Variables

```bash
# Database (copy from Step 1)
DATABASE_URL=postgresql://archetype_user:password@dpg-xxx.oregon-postgres.render.com/archetype

# Session Security (generate a random string)
SESSION_SECRET=your-super-secret-random-string-here-min-32-chars

# Anthropic AI (get from console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx

# Application URL (your Render URL)
APP_URL=https://archetype.onrender.com

# Admin Access (create your own secret)
ADMIN_SECRET_KEY=your-admin-secret-key-here

# Node Environment
NODE_ENV=production
```

#### 🔧 Optional Variables (Add if using features)

```bash
# Stripe Payments (get from dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_PRICE_ID_STARTER=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_PRO=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_BUSINESS=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_ENTERPRISE=price_xxxxxxxxxxxxx

# Tavily Web Search (get from tavily.com)
TAVILY_API_KEY=tvly-xxxxxxxxxxxxx

# OpenAI (get from platform.openai.com - optional)
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Orb Usage-Based Billing (get from withorb.com - optional)
ORB_API_KEY=orb_xxxxxxxxxxxxx
```

#### 🔑 How to Generate Secrets

**SESSION_SECRET** (32+ random characters):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**ADMIN_SECRET_KEY** (any secure string):
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

### Step 4: Initialize Database Schema

After your Web Service deploys successfully:

1. **Open Render Shell** (Web Service → "Shell" tab)
2. **Run migration**:
   ```bash
   npm run db:push
   ```
3. **Verify tables created**:
   - You should see: "✅ Pushing schema to database..."

**Alternative**: Use a local terminal with Render's DATABASE_URL:
```bash
DATABASE_URL="postgresql://..." npm run db:push
```

---

### Step 5: Configure Custom Domain (Optional)

1. **Go to your Web Service** → **"Settings"** → **"Custom Domain"**
2. **Add your domain**: `archetype.yourdomain.com`
3. **Follow DNS instructions** (add CNAME record)
4. **Update APP_URL** environment variable to your custom domain
5. **Update Stripe webhooks** if using billing

---

### Step 6: Setup Stripe Webhooks (If Using Billing)

1. **Go to Stripe Dashboard** → [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. **Click "Add endpoint"**
3. **Endpoint URL**: `https://archetype.onrender.com/api/webhooks/stripe`
4. **Events to listen for**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. **Copy Webhook Signing Secret** (starts with `whsec_`)
6. **Add to Render** as `STRIPE_WEBHOOK_SECRET`

---

## 🧪 Verify Deployment

### Health Check

Visit: `https://archetype.onrender.com/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T...",
  "uptime": 123.456,
  "responseTime": 12,
  "checks": {
    "database": "ok",
    "ai_generation": "ok",
    "web_search": "ok",
    "browser_test": "ok",
    "stripe": "ok"
  },
  "version": "1.0.0"
}
```

### Admin Diagnostics

Visit: `https://archetype.onrender.com/admin/emergency`
**Header**: `X-Admin-Secret: your-admin-secret-key`

**Expected Response:**
```json
{
  "timestamp": "...",
  "server": { "uptime": 123, "memory": {...}, ... },
  "environment": {
    "hasDatabase": true,
    "hasAnthropicKey": true,
    "hasTavilyKey": true,
    "hasStripeKey": true,
    "hasSessionSecret": true
  },
  "features": {...},
  "database": { "status": "connected", ... }
}
```

### Test Key Features

1. ✅ **Registration/Login** → `https://archetype.onrender.com/auth`
2. ✅ **Create Project** → `https://archetype.onrender.com/projects`
3. ✅ **AI Generation** → Test SySop in Builder tab
4. ✅ **File Editor** → Monaco editor loads correctly
5. ✅ **Live Preview** → Real-time preview works
6. ✅ **Billing** → Subscription checkout (if enabled)

---

## 🐛 Troubleshooting

### Database Connection Errors

**Error**: `Database connection failed`

**Solutions**:
1. Verify `DATABASE_URL` is correct (copy from Render PostgreSQL dashboard)
2. Ensure database is in **same region** as Web Service
3. Check database is not suspended (Free tier suspends after 90 days inactivity)
4. Run `npm run db:push` to create tables

### Build Failures

**Error**: `Build failed`

**Solutions**:
1. **Check logs** in Render Dashboard → Logs tab
2. **Verify Node version**: Render uses Node 20 by default (compatible)
3. **Clear cache**: Render → Settings → "Clear build cache & deploy"
4. **Check package.json**: Ensure all dependencies are listed

### WebSocket Connection Issues

**Error**: `WebSocket failed to connect`

**Solutions**:
1. Render supports WebSockets by default ✅
2. Check browser console for errors
3. Verify `wss://` protocol (not `ws://`) in production
4. Ensure no firewall blocking port 443

### Stripe Webhook Failures

**Error**: `Webhook signature verification failed`

**Solutions**:
1. Verify `STRIPE_WEBHOOK_SECRET` is correct
2. Check Stripe Dashboard → Webhooks → "Recent events"
3. Ensure endpoint URL is correct: `https://your-domain.onrender.com/api/webhooks/stripe`
4. Verify webhook is in **Live mode** (not Test mode)

### High Memory Usage (Free Tier Limits)

**Issue**: Service crashes due to memory limits (512MB)

**Solutions**:
1. **Upgrade to Starter plan** ($7/mo) for more RAM
2. **Optimize queries**: Add database indexes
3. **Limit concurrent AI requests**: Already implemented via priority queue
4. **Monitor usage**: Render Dashboard → Metrics tab

---

## 📊 Performance Optimization

### Database Indexes (Already Implemented)

Ensure these indexes exist (run `npm run db:push`):
- `projects.userId` (faster user project lookups)
- `files.projectId` (faster file queries)
- `chatMessages.projectId` (faster chat history)
- `commands.projectId` (faster command history)

### Caching Strategy

**Already Implemented**:
- PostgreSQL session store (fast authentication)
- In-memory AI request queue (prevents overload)

**Future Optimization**:
- Add Redis for caching (Render Redis $10/mo)
- Implement CDN for static assets

### Monitoring

**Render Built-in**:
- CPU/Memory metrics (free)
- Request logs (free)
- Uptime monitoring (free)

**External Tools**:
- [UptimeRobot](https://uptimerobot.com) - Free uptime monitoring
- [Sentry](https://sentry.io) - Error tracking (free tier)
- [LogRocket](https://logrocket.com) - Session replay

---

## 💰 Cost Estimation

### Render Pricing (Monthly)

| Service | Free Tier | Starter | Pro |
|---------|-----------|---------|-----|
| **Web Service** | 750 hours/mo | $7/mo (512MB RAM) | $25/mo (2GB RAM) |
| **PostgreSQL** | 1GB storage | $7/mo (10GB) | $20/mo (100GB) |
| **Total** | **$0** | **$14/mo** | **$45/mo** |

### External API Costs

| Service | Free Tier | Pay-As-You-Go |
|---------|-----------|---------------|
| **Anthropic Claude** | None | ~$3/$15 per 1M tokens (input/output) |
| **Tavily Search** | 1,000 searches/mo | $0.10 per search |
| **Stripe** | Free | 2.9% + $0.30 per transaction |
| **Playwright** | Free | Included ✅ |

### Estimated Monthly Total

**Minimal Setup** (Free tier + Anthropic):
- Render: $0 (750 hours free)
- Anthropic: ~$50-100 (depending on usage)
- **Total**: **$50-100/mo**

**Production Setup** (Starter + All features):
- Render: $14/mo
- Anthropic: ~$100/mo
- Tavily: ~$10/mo
- **Total**: **$124/mo**

---

## 🔒 Security Best Practices

### Environment Variables

✅ **DO**:
- Use Render's environment variable system (encrypted at rest)
- Generate strong random secrets (32+ characters)
- Rotate secrets periodically

❌ **DON'T**:
- Commit secrets to Git
- Share secrets in plain text
- Use weak/predictable secrets

### Database Security

✅ **DO**:
- Use internal database URL (not public)
- Enable SSL connections (Render default)
- Limit database access to Web Service only

❌ **DON'T**:
- Expose database URL publicly
- Use weak database passwords
- Allow public database connections

### Session Security

✅ **DO**:
- Use `secure: true` cookies in production (auto-enabled)
- Set `httpOnly: true` (already configured)
- Use strong SESSION_SECRET (32+ chars)

### Rate Limiting

✅ **Already Implemented**:
- API rate limiting (100 requests/15min per IP)
- Auth rate limiting (5 login attempts/15min)
- Webhook rate limiting (100 requests/15min)

---

## 🔄 Continuous Deployment

### Auto-Deploy on Git Push

**Already Configured**: Render auto-deploys when you push to `main` branch

**Workflow**:
1. Make code changes locally
2. `git add . && git commit -m "Update feature"`
3. `git push origin main`
4. Render automatically builds and deploys ✅

### Manual Deploy

**Render Dashboard**:
1. Go to your Web Service
2. Click "Manual Deploy" → "Deploy latest commit"

---

## 📚 Additional Resources

### Documentation
- [Render Node.js Guide](https://render.com/docs/deploy-node-express-app)
- [Render PostgreSQL Guide](https://render.com/docs/databases)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

### Support
- **Render Support**: [render.com/support](https://render.com/support)
- **Archetype GitHub Issues**: [your-repo/issues](https://github.com/your-username/archetype/issues)

---

## ✅ Post-Deployment Checklist

After successful deployment:

- [ ] Health check passes (`/health`)
- [ ] Admin diagnostics accessible (`/admin/emergency`)
- [ ] Database tables created (`npm run db:push`)
- [ ] User registration works
- [ ] AI generation works (SySop responds)
- [ ] File editor loads (Monaco)
- [ ] Live preview works
- [ ] Stripe checkout works (if enabled)
- [ ] Webhooks configured (if using Stripe)
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active (auto via Render)
- [ ] Monitoring setup (UptimeRobot, Sentry)

---

## 🎉 Success!

Your Archetype platform is now live on Render! 🚀

**Next Steps**:
1. Share your app URL: `https://archetype.onrender.com`
2. Monitor performance in Render Dashboard
3. Set up uptime monitoring
4. Configure custom domain (optional)
5. Invite users and start building!

**SySop is ready** to build features, maintain code, and handle future development - all without Replit agent fees! 💰

---

## 📞 Need Help?

If you encounter issues, check the [Troubleshooting](#-troubleshooting) section or open a GitHub issue.

**Happy Building!** 🛠️
