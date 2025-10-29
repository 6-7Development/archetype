# Meta-SySop Quick Start for Platform Owners

This guide helps you get Meta-SySop working on Railway in under 5 minutes.

## Prerequisites

- Platform owner access
- GitHub repository access
- Railway project access

## Step 1: Set Up GitHub Integration (2 minutes)

### 1.1 Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens/new
2. Token name: `Meta-SySop Railway Access`
3. Expiration: `No expiration` (or your preference)
4. Select scopes:
   - ✅ **repo** (Full control of private repositories)
5. Click "Generate token"
6. **COPY THE TOKEN** - you won't see it again!

### 1.2 Add Environment Variables to Railway

1. Open your Railway project: https://railway.app
2. Click on your service (usually "web")
3. Go to **Variables** tab
4. Add these variables:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=6-7Development/archetype
GITHUB_BRANCH=main
```

**Important:** Replace the values with your actual token and repository!

4. Click **Deploy** to apply the changes
5. Wait ~2 minutes for Railway to redeploy

## Step 2: Verify Setup (1 minute)

### Option A: Use the Setup Script (Recommended)

```bash
# Clone the repo locally (if you haven't)
git clone https://github.com/6-7Development/archetype.git
cd archetype

# Install dependencies
npm install

# Run setup checker
npm run meta:setup
```

You should see:
```
✅ Passed: 7
❌ Failed: 0
⚠️  Warnings: 0

🎉 All checks passed! Meta-SySop is ready to use.
```

### Option B: Manual Verification

1. Check Railway logs for this message:
   ```
   [GITHUB-SERVICE] Initialized for 6-7Development/archetype on branch main
   ```

2. Verify environment variables are set:
   - Go to Railway → Variables tab
   - Confirm GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH are visible

## Step 3: Enable Meta-SySop (1 minute)

### 3.1 Login as Platform Owner

1. Go to your deployed site: `https://your-app.railway.app`
2. Login with owner account (the one marked as `isOwner: true`)

### 3.2 Enable Maintenance Mode

**Via Admin Dashboard (if UI exists):**
1. Navigate to `/admin` or settings
2. Toggle "Maintenance Mode" ON
3. Add reason: "Testing Meta-SySop setup"

**Via API (if no UI):**
```bash
# Replace YOUR_DOMAIN with your Railway URL
curl -X POST https://YOUR_DOMAIN.railway.app/api/maintenance-mode/enable \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"reason": "Meta-SySop platform updates"}'
```

**Via Meta-SySop Chat:**
1. Go to `/platform-healing`
2. Type: "Enable maintenance mode"
3. Meta-SySop will enable it

## Step 4: Test Meta-SySop (1 minute)

### First Test: Simple Read

1. Go to `/platform-healing`
2. Type: **"Read the README.md file"**
3. Meta-SySop should display the README content

### Second Test: Simple Write

1. Type: **"Create a file called TEST.md with content 'Meta-SySop is working!'"**
2. Meta-SySop will:
   - Create the file
   - Stage it for commit
   - Ask for confirmation
3. Type: **"Yes, commit it"**
4. Meta-SySop will:
   - Commit to GitHub
   - Show the commit URL
5. Check GitHub - you should see the new commit and file!

### Third Test: Railway Auto-Deploy

1. Wait 2-3 minutes
2. Check Railway dashboard - you should see a new deployment
3. The TEST.md file should now exist on your Railway instance

## Step 5: Make Real Changes

Now you can ask Meta-SySop to:

### Fix Bugs
```
"The mobile menu is broken - fix it"
"Login form validation isn't working"
"Dashboard shows wrong user count"
```

### Add Features
```
"Add a dark mode toggle to the settings page"
"Create an export to CSV feature for the analytics"
"Add pagination to the users list"
```

### Refactor Code
```
"Refactor the authentication code to use modern patterns"
"Convert callback-based code in dashboard.ts to async/await"
"Optimize the database queries in the reports section"
```

## Workflow Summary

```
1. Enable maintenance mode (production only)
   ↓
2. Ask Meta-SySop to make changes
   ↓
3. Meta-SySop reads/writes files (batched)
   ↓
4. Review the changes
   ↓
5. Confirm: "Yes, commit it"
   ↓
6. Meta-SySop commits to GitHub
   ↓
7. Railway auto-deploys (2-3 min)
   ↓
8. Changes are live! ✨
```

## Troubleshooting

### "GitHub service not configured"
**Fix:** Set GITHUB_TOKEN and GITHUB_REPO in Railway variables, then redeploy

### "Maintenance mode disabled"
**Fix:** Enable maintenance mode first (see Step 3.2)

### "No file changes to commit"
**Issue:** Meta-SySop tried to commit before making changes
**Fix:** Ask Meta-SySop to make the changes first, then commit

### Changes not showing in production
**Check:** 
- Railway deployment status (should be "Active")
- Wait 2-3 minutes for build to complete
- Check Railway logs for errors

### Meta-SySop not responding
**Check:**
- ANTHROPIC_API_KEY is set in Railway
- Railway logs for API errors
- Meta-SySop chat connection (check browser console)

## Environment Variables Reference

Required for Meta-SySop to work:

```bash
# GitHub Integration (REQUIRED)
GITHUB_TOKEN=ghp_xxxx     # From github.com/settings/tokens
GITHUB_REPO=owner/repo    # Your repository
GITHUB_BRANCH=main        # Target branch

# AI Functionality (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-xxxx  # From console.anthropic.com

# Database (Already set by Railway)
DATABASE_URL=postgresql://...

# Optional
NODE_ENV=production
PORT=5000
```

## Advanced Configuration

### Custom Instructions

Edit `.meta-sysop/config.json` to customize Meta-SySop behavior:

```json
{
  "coreInstructions": [
    {
      "id": "custom_001",
      "priority": 10,
      "active": true,
      "instruction": "Always test changes locally before committing",
      "scope": "platform",
      "category": "quality"
    }
  ]
}
```

### Autonomy Levels

Control how autonomous Meta-SySop is:
- `basic` - Asks for approval on every change
- `standard` - Autonomous within tasks
- `deep` - Full autonomy with web search
- `max` - Maximum capabilities

### Safety Features

Meta-SySop **cannot** modify:
- `.env` files
- `package.json`
- Git internals
- Node modules
- Build configs

## Getting Help

### Documentation
- Full guide: `META_SYSOP_WORKFLOW.md`
- Implementation details: `META_SYSOP_IMPLEMENTATION_COMPLETE.md`
- Features: `SYSOP_FEATURES.md`

### Ask Meta-SySop
Meta-SySop can help with its own usage:
```
"How do I enable maintenance mode?"
"Show me how to commit changes"
"What files can you modify?"
```

### Consult the Architect
For complex issues:
```
"Consult the architect about database optimization"
```

Meta-SySop will call the I AM architect for expert guidance.

## Success Checklist

- [ ] GitHub token created and added to Railway
- [ ] GITHUB_REPO and GITHUB_BRANCH set in Railway
- [ ] Railway redeployed with new variables
- [ ] Setup script shows all green checks
- [ ] Maintenance mode can be enabled
- [ ] Test file created and committed successfully
- [ ] Railway auto-deployed the test commit
- [ ] Ready to use Meta-SySop for real work! 🎉

## Next Steps

1. **Disable maintenance mode** when not actively making changes
2. **Create a backup branch** before major refactors
3. **Monitor Railway deployments** after commits
4. **Review Meta-SySop's changes** before approving commits

Meta-SySop is now ready to maintain your platform! 🤖✨
