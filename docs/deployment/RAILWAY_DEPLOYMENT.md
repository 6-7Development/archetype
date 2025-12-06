# Railway Deployment Checklist

## ✅ Pre-Deployment Complete

### Core Features
- ✅ Autonomous healing loop (detect → diagnose → patch → verify → commit → deploy)
- ✅ AI Knowledge Base with confidence scoring (PostgreSQL)
- ✅ Conversation state manager (prevents AI rambling)
- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Auto-healing guardrails (kill-switch, rate limits)
- ✅ Lumo avatar integration with emotion states
- ✅ Natural conversation tone
- ✅ Complete branding (Lomu/LomuAI)

### Database & Storage
- ✅ PostgreSQL schema fully migrated
- ✅ All tables created: users, projects, files, deployments, apiKeys, platformHealAttempts, aiKnowledgeBase, aiFixAttempts, conversationStates
- ✅ Drizzle ORM configured
- ✅ Connection pooling enabled

### Security
- ✅ Webhook signature verification (prevents spoofing)
- ✅ Bcrypt password hashing
- ✅ Session management with PostgreSQL
- ✅ API key hashing and validation
- ✅ Rate limiting on AI requests
- ✅ Authentication/authorization on all routes

### Build & Deployment
- ✅ TypeScript compilation passes (no errors)
- ✅ Vite production build configured
- ✅ Express server setup
- ✅ Railway configuration files ready
- ✅ Health check endpoint: `/api/health`
- ✅ Graceful restart policies

## 🔧 Required Environment Variables on Railway

### Required (MUST SET)
```bash
DATABASE_URL=<neon-postgresql-url>
SESSION_SECRET=<generate-with-openssl-rand-hex-32>
ANTHROPIC_API_KEY=<your-anthropic-key>
GITHUB_TOKEN=<your-github-token>
GITHUB_REPO=<owner/repo>
STRIPE_SECRET_KEY=<your-stripe-key>

# NEW - Critical for webhook security (MUST GENERATE YOUR OWN)
WEBHOOK_SECRET=<generate-with-openssl-rand-hex-32>
```

### Optional (Recommended)
```bash
# Auto-healing control
ENABLE_AUTO_HEALING=true  # Enable in production
ENABLE_AUTO_COMMIT=true   # Auto-commit fixes
ENABLE_AUTO_PUSH=true     # Auto-push to GitHub

# GitHub integration
GITHUB_BRANCH=main
OWNER_USER_ID=<your-user-id>  # For maintenance mode access

# OpenAI (for image generation if needed)
OPENAI_API_KEY=<your-openai-key>

# Stripe public key
VITE_STRIPE_PUBLIC_KEY=<your-stripe-public-key>

# Deployment metadata
NODE_ENV=production
PORT=5000
```

## 🚀 Deployment Steps

### 1. Set Up Railway Project
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to project
railway link
```

### 2. Configure Environment Variables
- Go to Railway dashboard
- Navigate to your service
- Add all required environment variables from above
- **IMPORTANT**: Generate a new `WEBHOOK_SECRET` using:
  ```bash
  openssl rand -hex 32
  ```
  Then add it to Railway environment variables

### 3. Configure Database
- Add Neon PostgreSQL plugin in Railway
- Copy `DATABASE_URL` to environment variables
- Schema will auto-migrate on first deploy

### 4. Deploy
```bash
# Deploy to Railway
railway up

# Or push to GitHub (if connected)
git push origin main
```

### 5. Configure Webhooks
**Railway Webhook Configuration:**
1. Generate webhook secret: `openssl rand -hex 32`
2. Add `WEBHOOK_SECRET` to Railway environment variables
3. Go to Railway dashboard → Settings → Webhooks
4. Add webhook URL: `https://your-domain.railway.app/api/webhooks/deployment`
5. Add custom header: `x-webhook-signature` with the SAME secret value
6. **CRITICAL**: The secret MUST match in both Railway env vars and webhook config

**Render Webhook Configuration (if using):**
1. Use the SAME `WEBHOOK_SECRET` value from Railway environment
2. Go to Render dashboard → Settings → Webhooks
3. Add webhook URL: `https://your-domain.onrender.com/api/webhooks/deployment`
4. Add custom header: `render-signature` with the secret value
5. **CRITICAL**: The secret MUST be identical across all platforms

### 6. Verify Deployment
```bash
# Check health endpoint
curl https://your-domain.railway.app/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-31T04:30:00.000Z",
  "database": "connected",
  "uptime": 1234
}
```

### 7. Create Owner Account
```bash
# SSH into Railway container or use Railway CLI
railway run bash

# Run owner setup script
npm run setup:owner
```

## 📊 Post-Deployment Verification

### Test Core Features
- [ ] Login/authentication works
- [ ] Create a new project
- [ ] Chat with LomuAI works
- [ ] File editing and Monaco editor loads
- [ ] Preview system works
- [ ] Platform Healing UI accessible
- [ ] Deployment logs showing
- [ ] WebSocket connections stable

### Test Healing System
- [ ] Trigger a test incident
- [ ] Verify AI diagnosis runs
- [ ] Check confidence score calculated
- [ ] Confirm webhook received from Railway/Render
- [ ] Validate deployment status updated
- [ ] Review audit trail in database

### Monitor Performance
- [ ] Check Railway logs for errors
- [ ] Verify database connections stable
- [ ] Monitor API response times
- [ ] Check WebSocket connection count
- [ ] Review Stripe webhooks working

## 🛟 Troubleshooting

### Database Connection Issues
```bash
# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:pass@host/db?sslmode=require

# Test connection
npm run db:push
```

### Webhook Verification Failing
```bash
# Verify WEBHOOK_SECRET is set
railway variables

# Check webhook logs
railway logs

# Look for: [WEBHOOK-SECURITY] Invalid signature
```

### Build Failures
```bash
# Check TypeScript compilation
npm run build

# Verify all dependencies installed
npm install

# Check Railway build logs
railway logs --deployment
```

### Auto-Healing Not Running
```bash
# Verify environment variables
echo $ENABLE_AUTO_HEALING  # Should be: true
echo $ANTHROPIC_API_KEY    # Should be: sk-ant-...
echo $GITHUB_TOKEN         # Should be set

# Check healing orchestrator logs
railway logs | grep "HEAL-ORCHESTRATOR"
```

## 📈 Production Readiness Status

**Current Status**: ~70% Production Ready

### ✅ Completed (Tier 1 & 2)
- Autonomous healing with deployment tracking
- AI knowledge base & confidence scoring
- Conversation state management
- Webhook signature verification
- Auto-healing safety guardrails
- Natural conversation UX

### ⏳ Remaining (Optional Enhancements)
- Uptime monitoring/alerting
- Centralized error tracking (Sentry)
- Automated database backups
- Secret rotation policy
- Load testing benchmarks
- Enhanced RCA (UI→API→DB tracing)
- Automated test generation
- AI Architect mode
- Predictive cost analysis

## 🎯 Next Steps After Deployment

1. **Monitor First Week**
   - Watch Railway logs for errors
   - Monitor database performance
   - Track healing success rate
   - Review confidence scores

2. **Gather Metrics**
   - Healing success rate
   - AI token usage
   - User engagement
   - System uptime

3. **Iterate Based on Data**
   - Fine-tune confidence thresholds
   - Optimize prompts
   - Add more error patterns to knowledge base
   - Improve verification logic

## 🔗 Useful Commands

```bash
# View live logs
railway logs --follow

# Run migrations
railway run npm run db:push

# Check environment
railway variables

# Restart service
railway restart

# Connect to database
railway run npm run db:studio

# Deploy specific branch
railway up --branch main
```

## 📞 Support

If issues occur:
1. Check Railway logs: `railway logs`
2. Verify environment variables: `railway variables`
3. Review health endpoint: `curl https://your-domain/api/health`
4. Check database connection: `railway run npm run db:push`
5. Review webhook logs for signature failures

---

**Generated**: 2025-10-31  
**Platform**: LomuAI Self-Healing Development Platform  
**Railway Config**: railway.toml, railway.json  
**Health Check**: /api/health
