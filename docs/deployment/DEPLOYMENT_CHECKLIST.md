# 🚀 Render Deployment Checklist

Use this checklist to ensure a smooth deployment to Render.com.

---

## Pre-Deployment

- [ ] **GitHub Repository**
  - [ ] Code pushed to GitHub
  - [ ] `.env` is in `.gitignore` (never commit secrets!)
  - [ ] `render.yaml` is in repository root
  - [ ] `RENDER_DEPLOYMENT.md` available for reference

- [ ] **API Keys Ready**
  - [ ] Anthropic API key (`ANTHROPIC_API_KEY`)
  - [ ] Session secret generated (32+ chars)
  - [ ] Admin secret generated (16+ chars)
  - [ ] Stripe keys (if using billing) - Test mode first
  - [ ] Tavily API key (optional - for web search)

- [ ] **Accounts Created**
  - [ ] Render account at [render.com](https://render.com)
  - [ ] Stripe account (if using billing)
  - [ ] Domain registered (optional - for custom domain)

---

## Render Setup

### Database

- [ ] **Create PostgreSQL Database**
  - [ ] Name: `archetype-db`
  - [ ] Region: Oregon (or preferred)
  - [ ] Plan: Starter ($7/mo) or Free
  - [ ] Copy Internal Database URL

### Web Service

- [ ] **Create Web Service**
  - [ ] Connected to GitHub repository
  - [ ] Name: `archetype` (or preferred)
  - [ ] Same region as database
  - [ ] Build command: `npm install && npm run build`
  - [ ] Start command: `npm start`
  - [ ] Plan: Starter ($7/mo) or Free

### Environment Variables

- [ ] **Required Variables Set**
  - [ ] `DATABASE_URL` (from database)
  - [ ] `SESSION_SECRET` (generated)
  - [ ] `ANTHROPIC_API_KEY` (from Anthropic)
  - [ ] `APP_URL` (Render URL)
  - [ ] `ADMIN_SECRET_KEY` (generated)
  - [ ] `NODE_ENV=production`

- [ ] **Optional Variables (if using)**
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `STRIPE_PRICE_ID_*` (all tiers)
  - [ ] `TAVILY_API_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `ORB_API_KEY`

---

## First Deployment

- [ ] **Initial Deploy**
  - [ ] Click "Create Web Service"
  - [ ] Wait for build to complete (~3-5 minutes)
  - [ ] Check logs for errors
  - [ ] Verify "Deployed" status

- [ ] **Database Initialization**
  - [ ] Open Render Shell
  - [ ] Run: `npm run db:push`
  - [ ] Verify tables created successfully

- [ ] **Health Check**
  - [ ] Visit: `https://archetype.onrender.com/health`
  - [ ] Verify `"status": "healthy"`
  - [ ] Check all feature flags are `"ok"`

---

## Post-Deployment Configuration

### Stripe Webhooks (If Using Billing)

- [ ] **Setup Webhook Endpoint**
  - [ ] Go to Stripe Dashboard → Webhooks
  - [ ] Add endpoint: `https://archetype.onrender.com/api/webhooks/stripe`
  - [ ] Select events:
    - [ ] `checkout.session.completed`
    - [ ] `customer.subscription.created`
    - [ ] `customer.subscription.updated`
    - [ ] `customer.subscription.deleted`
    - [ ] `invoice.payment_succeeded`
    - [ ] `invoice.payment_failed`
  - [ ] Copy webhook signing secret
  - [ ] Add `STRIPE_WEBHOOK_SECRET` to Render environment

### Custom Domain (Optional)

- [ ] **Configure Domain**
  - [ ] Add custom domain in Render Settings
  - [ ] Update DNS CNAME record
  - [ ] Wait for SSL certificate (auto-provisioned)
  - [ ] Update `APP_URL` to custom domain
  - [ ] Update Stripe webhook URL (if applicable)

---

## Verification Tests

### Core Features

- [ ] **Authentication**
  - [ ] Registration works
  - [ ] Login works
  - [ ] Session persists
  - [ ] Logout works

- [ ] **Project Creation**
  - [ ] Create new project
  - [ ] Project appears in list
  - [ ] Can access project

- [ ] **AI Generation (SySop)**
  - [ ] SySop responds to commands
  - [ ] Code generation works
  - [ ] Files are created
  - [ ] WebSocket streaming works
  - [ ] Progress updates display

- [ ] **File Management**
  - [ ] Monaco editor loads
  - [ ] Can edit files
  - [ ] Changes save correctly
  - [ ] File download works

- [ ] **Live Preview**
  - [ ] Preview loads
  - [ ] Real-time updates work
  - [ ] Split-view functions

### Optional Features

- [ ] **Billing (if enabled)**
  - [ ] Pricing page loads
  - [ ] Checkout redirects to Stripe
  - [ ] Test payment succeeds
  - [ ] Webhook receives event
  - [ ] Subscription updates in database

- [ ] **Web Search (if enabled)**
  - [ ] SySop can search docs
  - [ ] Results appear in responses

- [ ] **Browser Testing (if enabled)**
  - [ ] Playwright tests run
  - [ ] Screenshots captured

---

## Monitoring Setup

- [ ] **Uptime Monitoring**
  - [ ] Add site to [UptimeRobot](https://uptimerobot.com)
  - [ ] Monitor: `https://archetype.onrender.com/health`
  - [ ] Alert email configured

- [ ] **Error Tracking (Optional)**
  - [ ] [Sentry](https://sentry.io) configured
  - [ ] Test error reporting

- [ ] **Performance Monitoring**
  - [ ] Check Render Metrics tab
  - [ ] Verify CPU/Memory usage is healthy
  - [ ] No frequent restarts

---

## Production Readiness

- [ ] **Security**
  - [ ] All secrets properly set
  - [ ] HTTPS enabled (auto via Render)
  - [ ] Rate limiting active
  - [ ] Admin secret working

- [ ] **Performance**
  - [ ] Database indexes created
  - [ ] Response times < 500ms
  - [ ] No memory leaks
  - [ ] WebSocket connections stable

- [ ] **Backups**
  - [ ] Database backups enabled (Render auto-backup)
  - [ ] Code in GitHub (version control)
  - [ ] Environment variables documented

---

## Launch

- [ ] **Final Checks**
  - [ ] All tests passing
  - [ ] No console errors
  - [ ] Documentation updated
  - [ ] Support contact set up

- [ ] **Go Live**
  - [ ] Announce launch
  - [ ] Share URL with users
  - [ ] Monitor for issues
  - [ ] Celebrate! 🎉

---

## Troubleshooting Reference

**Issue**: Database connection failed
→ **Solution**: Verify `DATABASE_URL` in environment, run `npm run db:push`

**Issue**: Build failed
→ **Solution**: Check logs, clear build cache, verify Node version

**Issue**: WebSocket errors
→ **Solution**: Check browser console, verify `wss://` protocol

**Issue**: Stripe webhook failures
→ **Solution**: Verify `STRIPE_WEBHOOK_SECRET`, check endpoint URL

**Issue**: High memory usage
→ **Solution**: Upgrade to Starter plan, optimize queries

**Full Troubleshooting**: See `RENDER_DEPLOYMENT.md` → Troubleshooting section

---

## Support

- **Deployment Guide**: `RENDER_DEPLOYMENT.md`
- **Render Docs**: [render.com/docs](https://render.com/docs)
- **GitHub Issues**: [your-repo/issues](https://github.com/your-username/archetype/issues)

---

**Last Updated**: October 18, 2025
**Status**: ✅ Deployment-Ready
