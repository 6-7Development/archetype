# Environment Variables for Railway Deployment

This file lists all environment variables needed for deploying Archetype with Meta-SySop on Railway.

## Required Variables

### Database (Auto-configured by Railway)
```bash
DATABASE_URL=postgresql://user:pass@host:5432/railway
```
*Railway automatically provisions and configures this when you add a PostgreSQL service.*

### Anthropic AI (Required for Meta-SySop)
```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
**How to get:**
1. Go to https://console.anthropic.com/
2. Sign up or login
3. Go to API Keys section
4. Create a new key
5. Copy and paste here

### GitHub Integration (Required for Meta-SySop auto-deploy)
```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=6-7Development/archetype
GITHUB_BRANCH=main
```

**How to get GITHUB_TOKEN:**
1. Go to https://github.com/settings/tokens/new
2. Token name: `Meta-SySop Railway Access`
3. Expiration: Choose your preference (recommend: 90 days or no expiration)
4. Select scopes:
   - ✅ **repo** (Full control of private repositories)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again!)

**GITHUB_REPO format:** `owner/repository-name`
- Example: `6-7Development/archetype`
- Must match your actual GitHub repository

**GITHUB_BRANCH:** Usually `main` or `master`

## Optional Variables

### Application Settings
```bash
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-random-secret-string-at-least-32-chars
```

### Stripe Integration (if using paid features)
```bash
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### OpenAI (Legacy, optional)
```bash
OPENAI_API_KEY=sk-xxxxx
```
*Only needed if you want to use OpenAI in addition to Anthropic*

### Tavily Search (for Meta-SySop web search)
```bash
TAVILY_API_KEY=tvly-xxxxx
```
**How to get:**
1. Go to https://tavily.com/
2. Sign up for an account
3. Get your API key from dashboard

### Build Metadata (Optional, auto-set by Railway)
```bash
COMMIT_SHA=abc123def456
BUILD_TIMESTAMP=2025-10-29T00:00:00Z
```
*Railway can auto-inject these during build*

### Feature Flags
```bash
# Enable PR preview workflow (useful for testing)
ENABLE_PR_WORKFLOW=false

# Enable verbose logging
LOG_LEVEL=info
```

## Railway Configuration Steps

### 1. Add PostgreSQL Service
1. In Railway project dashboard
2. Click "New" → "Database" → "PostgreSQL"
3. Railway auto-configures `DATABASE_URL`

### 2. Add Environment Variables
1. Click on your web service
2. Go to "Variables" tab
3. Click "New Variable"
4. Add each variable from above
5. Click "Deploy" to apply changes

### 3. Set Up Domains (Optional)
1. Go to "Settings" tab
2. Click "Generate Domain" for a Railway subdomain
3. Or add your custom domain

## Verification

After setting environment variables:

### Option 1: Check Railway Logs
Look for these messages in deployment logs:
```
[GITHUB-SERVICE] Initialized for 6-7Development/archetype on branch main
✅ All services initialized successfully
```

### Option 2: Use Setup Script (locally)
```bash
# Clone repo
git clone https://github.com/6-7Development/archetype.git
cd archetype

# Set environment variables locally (copy from Railway)
export GITHUB_TOKEN="ghp_xxxx"
export GITHUB_REPO="6-7Development/archetype"
export GITHUB_BRANCH="main"
export ANTHROPIC_API_KEY="sk-ant-xxxx"
export DATABASE_URL="postgresql://..." # From Railway

# Run verification
npm run meta:check
```

Expected output:
```
✅ Passed: 7
❌ Failed: 0
⚠️  Warnings: 0

🎉 All checks passed! Meta-SySop is ready to use.
```

### Option 3: Test in Production
1. Go to your deployed app: `https://your-app.railway.app`
2. Login as platform owner
3. Navigate to `/platform-healing`
4. Type: "Check GitHub configuration"
5. Meta-SySop should confirm everything is set up

## Common Issues

### "GitHub service not configured"
**Missing:** `GITHUB_TOKEN` or `GITHUB_REPO`
**Fix:** Add both variables in Railway and redeploy

### "Anthropic API key missing"
**Missing:** `ANTHROPIC_API_KEY`
**Fix:** Get key from console.anthropic.com and add to Railway

### "Database connection failed"
**Issue:** `DATABASE_URL` not set or PostgreSQL service not added
**Fix:** Add PostgreSQL service in Railway

### Meta-SySop can't commit changes
**Issue:** GitHub token lacks permissions
**Fix:** Regenerate token with `repo` scope enabled

### Railway build fails
**Check:** 
- All required variables are set
- No typos in variable names
- Build logs for specific error messages

## Security Notes

### Sensitive Variables
These should **NEVER** be committed to git:
- `DATABASE_URL`
- `GITHUB_TOKEN`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `SESSION_SECRET`

Always set them only in Railway's Variables panel.

### Token Permissions
GitHub token needs:
- ✅ `repo` scope - To read/write repository files
- ❌ No admin access needed
- ❌ No workflow access needed

### Best Practices
1. Use separate tokens for production vs development
2. Rotate tokens periodically (every 90 days)
3. Use Railway's "Secrets" for sensitive values
4. Never log sensitive values in code
5. Use environment-specific configs (dev/staging/prod)

## Updates

When updating environment variables:
1. Update in Railway Variables panel
2. Click "Deploy" or wait for auto-redeploy
3. Changes take effect in 2-3 minutes
4. Verify with setup check or production test

## Backups

Railway automatically backs up:
- Database snapshots (PostgreSQL)
- Environment variables (in project settings)
- Deployment history

To backup locally:
```bash
# Export variables from Railway
railway variables --export > .env.railway

# Store securely (DO NOT commit to git!)
```

## Getting Help

### Docs
- [Railway Docs](https://docs.railway.app/)
- [Meta-SySop Workflow](META_SYSOP_WORKFLOW.md)
- [Quick Start Guide](META_SYSOP_QUICKSTART.md)

### Support
- Railway Discord: https://discord.gg/railway
- GitHub Issues: https://github.com/6-7Development/archetype/issues
- Meta-SySop Help: Ask Meta-SySop directly at `/platform-healing`

---

**Ready?** Copy variables to Railway, click Deploy, and you're live! 🚀
