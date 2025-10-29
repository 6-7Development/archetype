# Meta-SySop Platform Editing Workflow

## Overview
Meta-SySop is Archetype's autonomous AI agent that can read, edit, and deploy platform code changes directly to production via GitHub and Railway. This guide explains how to use Meta-SySop to effectively maintain and update the platform.

## Quick Start (3 Steps)

### 1️⃣ Enable Maintenance Mode
**Required for production deployments only. Skip in development.**

```bash
# Via API (if owner authenticated):
POST /api/maintenance-mode/enable
{
  "reason": "Meta-SySop platform updates"
}

# Or via Meta-SySop chat (if implemented):
"Enable maintenance mode for platform updates"
```

### 2️⃣ Ask Meta-SySop to Make Changes
Open Meta-SySop chat at `/platform-healing` and describe what you need:

**Examples:**
- "Fix the mobile navigation menu styling"
- "Add a new API endpoint for user preferences"
- "Update the landing page hero section"
- "Optimize the database query in dashboard.ts"

### 3️⃣ Review and Deploy
Meta-SySop will:
1. Read relevant files
2. Make necessary changes
3. Stage files for commit
4. Ask for your confirmation
5. Commit to GitHub via `commit_to_github()` tool
6. Railway auto-deploys in 2-3 minutes ✨

## How It Works

### Architecture
```
User Request → Meta-SySop Chat → Platform Healing Service
                                         ↓
                            Read/Write Platform Files
                                         ↓
                              GitHub Service (API)
                                         ↓
                              GitHub Repository
                                         ↓
                          Railway Auto-Deployment
                                         ↓
                            Production Updated! 🚀
```

### Meta-SySop Tools

#### File Operations
- `readPlatformFile(path)` - Read any platform file
- `writePlatformFile(path, content)` - Modify platform files (batch mode)
- `listPlatformDirectory(directory)` - Browse directories
- `commit_to_github(commitMessage)` - Commit all changes at once

#### Analysis Tools
- `perform_diagnosis()` - Analyze platform health and issues
- `architect_consult()` - Get expert guidance on complex problems
- `web_search()` - Research solutions and documentation

#### Task Management
- `createTaskList()` - Break down complex work into tasks
- `updateTask()` - Track progress on individual tasks
- `readTaskList()` - Check current task status

## Environment Variables (Required)

Meta-SySop needs these environment variables to work properly:

### Required for GitHub Integration
```bash
# GitHub Personal Access Token (with repo permissions)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Repository in format "owner/repo-name"
GITHUB_REPO=6-7Development/archetype

# Target branch (usually "main")
GITHUB_BRANCH=main

# Anthropic API key for Claude AI
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### How to Set Up

#### 1. Create GitHub Token
1. Go to https://github.com/settings/tokens/new
2. Select scopes: `repo` (full control of private repositories)
3. Generate token and copy it

#### 2. Set Environment Variables in Railway
1. Open Railway project dashboard
2. Go to your service → Variables
3. Add the variables listed above
4. Click "Deploy" to apply changes

#### 3. Verify Configuration
```bash
# Check Meta-SySop can access GitHub
# In Meta-SySop chat:
"Check GitHub configuration"

# Expected response:
# ✅ GITHUB_TOKEN is set
# ✅ GITHUB_REPO is set (6-7Development/archetype)
# ✅ GITHUB_BRANCH is set (main)
```

## Maintenance Mode

### What is Maintenance Mode?
A safety feature that prevents accidental platform modifications in production. When enabled, Meta-SySop can commit changes to GitHub which Railway auto-deploys.

### Why It's Required in Production
- **Render/Railway use ephemeral containers** - Direct file changes are lost on restart
- **Changes must go through GitHub** - Only way to persist modifications
- **Prevents accidents** - Explicit opt-in for platform modifications

### Enable/Disable Maintenance Mode

#### Via Admin UI (Recommended)
1. Login as platform owner
2. Navigate to admin dashboard
3. Toggle "Maintenance Mode" switch

#### Via API
```bash
# Enable
curl -X POST https://your-domain.com/api/maintenance-mode/enable \
  -H "Content-Type: application/json" \
  -d '{"reason": "Meta-SySop platform updates"}'

# Disable
curl -X POST https://your-domain.com/api/maintenance-mode/disable

# Check Status
curl https://your-domain.com/api/maintenance-mode/status
```

#### Via Meta-SySop Chat
```
"Enable maintenance mode"
"Disable maintenance mode"
"Check maintenance mode status"
```

## Development vs Production

### Development (Local)
- Maintenance mode **NOT required**
- Changes written directly to filesystem
- No GitHub commits needed
- Use `npm run dev` to test

### Production (Railway)
- Maintenance mode **REQUIRED**
- Changes committed to GitHub via API
- Railway auto-deploys from GitHub
- Changes take 2-3 minutes to go live

## Best Practices

### 1. Clear, Specific Requests
❌ Bad: "Fix the dashboard"
✅ Good: "Fix the dashboard mobile layout where the sidebar overlaps the main content on screens smaller than 768px"

### 2. Let Meta-SySop Break Down Work
Meta-SySop automatically creates task lists for complex work:
```
1. Read current dashboard layout code
2. Identify mobile breakpoint issues
3. Update CSS with proper media queries
4. Test changes
5. Commit to GitHub
```

### 3. Review Before Deploying
Meta-SySop shows you what it changed. Always review:
- Files modified
- Code diffs
- Commit message
Then approve the `commit_to_github()` operation.

### 4. Batch Related Changes
Meta-SySop batches all file changes into a single commit:
```
- writePlatformFile("client/src/dashboard.tsx", ...)
- writePlatformFile("client/src/styles/dashboard.css", ...)
- writePlatformFile("server/routes/dashboard.ts", ...)
- commit_to_github("Fix dashboard mobile layout") ← One commit for all
```

### 5. Monitor Deployments
After Meta-SySop commits:
1. Check Railway deployment logs
2. Wait 2-3 minutes for build
3. Verify changes in production
4. Disable maintenance mode if done

## Common Workflows

### Fix a Bug
```
You: "The login form is broken on mobile - the submit button is cut off"

Meta-SySop:
1. Reads client/src/components/LoginForm.tsx
2. Identifies CSS issue
3. Updates the file
4. Commits to GitHub
5. Railway deploys fix

Result: Bug fixed in production in ~3 minutes
```

### Add a Feature
```
You: "Add a dark mode toggle to the settings page"

Meta-SySop:
1. Creates task list (add toggle UI, implement theme switching, persist preference)
2. Updates settings page component
3. Adds theme context provider
4. Updates database schema if needed
5. Commits all changes
6. Railway deploys

Result: Feature live in production
```

### Refactor Code
```
You: "Refactor the dashboard API to use async/await instead of callbacks"

Meta-SySop:
1. Reads server/routes/dashboard.ts
2. Rewrites callback code to async/await
3. Updates error handling
4. Ensures no breaking changes
5. Commits refactor
6. Railway deploys

Result: Cleaner code in production
```

## Troubleshooting

### "GitHub service not configured"
**Solution:** Set GITHUB_TOKEN and GITHUB_REPO environment variables (see above)

### "Maintenance mode disabled"
**Solution:** Enable maintenance mode before making production changes

### "No file changes to commit"
**Issue:** Called `commit_to_github()` before making changes
**Solution:** Meta-SySop should call `writePlatformFile()` first to stage changes

### "Railway deployment failed"
**Check:**
1. Railway deployment logs for errors
2. Build errors in Railway dashboard
3. Environment variables are set correctly

### "Changes not appearing in production"
**Wait:** Railway deployments take 2-3 minutes
**Check:** Railway deployment status in dashboard

## Security Notes

### What Meta-SySop CAN'T Modify
For safety, Meta-SySop cannot modify:
- `.env` files (secrets)
- `package.json` (dependencies)
- `package-lock.json` (lockfile)
- `.git/` directory (git internals)
- `node_modules/` (dependencies)
- `vite.config.ts` (build config)
- `drizzle.config.ts` (DB config)

### What Meta-SySop CAN Modify
- All source code files (`.ts`, `.tsx`, `.js`, `.jsx`)
- Stylesheets (`.css`, `.scss`)
- Configuration files (most)
- Documentation (`.md`)
- Assets and static files

### Path Traversal Protection
All file paths are validated to prevent attacks:
- No `..` in paths
- No absolute paths
- Must be within project root

## Advanced Usage

### Autonomy Levels
Meta-SySop supports different autonomy levels:

- **Basic:** Manual approval required for every change
- **Standard:** Autonomous within tasks, shows progress
- **Deep:** Full autonomy, uses web search and sub-agents
- **Max:** All tools available, maximum capabilities

Configure in `.meta-sysop/config.json`

### Custom Instructions
Add project-specific instructions in `.meta-sysop/config.json`:
```json
{
  "coreInstructions": [
    {
      "id": "custom_001",
      "priority": 10,
      "active": true,
      "instruction": "Always run tests before committing",
      "scope": "platform",
      "category": "quality"
    }
  ]
}
```

### Integration with CI/CD
Meta-SySop commits trigger:
1. GitHub Actions (if configured)
2. Railway deployment
3. Automated tests (if set up)
4. Health checks

## Support

### Get Help
- **Meta-SySop Chat:** Ask Meta-SySop directly: "How do I...?"
- **Architect Consult:** Meta-SySop can call the I AM architect for expert guidance
- **Documentation:** Check `docs/` directory for detailed guides

### Report Issues
If Meta-SySop isn't working correctly:
1. Check maintenance mode status
2. Verify GitHub environment variables
3. Review Railway deployment logs
4. Check Meta-SySop chat history for errors

## Summary

Meta-SySop makes platform maintenance effortless:
1. **Enable maintenance mode** (production only)
2. **Describe what you need** in natural language
3. **Review changes** Meta-SySop made
4. **Approve commit** to GitHub
5. **Railway auto-deploys** in minutes

No need to:
- Clone the repository locally
- Set up development environment
- Manually commit and push
- Monitor deployments

Meta-SySop handles everything! 🤖✨
