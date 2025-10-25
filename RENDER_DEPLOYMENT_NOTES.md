# Render Deployment Notes for Archetype

## Production Environment
- **URL**: https://archetype-platform.onrender.com
- **Repository**: https://github.com/6-7Development/archetype
- **Branch**: main (auto-deploys on push)
- **Database**: PostgreSQL (Neon-backed on Render)

## What SHOULD Happen

### Deployment Flow
1. Push commits to GitHub main branch
2. Render detects changes via webhook
3. Render runs build process:
   - `npm install` (installs dependencies)
   - `npm run build` (builds frontend with Vite)
4. Render starts the service:
   - `npm run start` (runs production server)
5. Application becomes available at production URL

### Expected Functionality
- **Meta-SySop**: Autonomous AI agent for platform self-healing
  - Accepts requests from owner users (is_owner = true in database)
  - Creates task lists with real-time updates via WebSocket
  - Auto-commits fixes to GitHub when requested
  - Tasks should complete properly and clear when session ends
  
- **Task Management**: 
  - Tasks display in real-time with status indicators
  - Completed tasks show checkmarks
  - In-progress tasks show spinning circles
  - Tasks should NOT get stuck in "active" state

- **Authentication**: Replit Auth + PostgreSQL sessions
- **Database**: Full schema with tables for projects, users, tasks, billing, etc.

## What ACTUALLY Happens (Current Issues)

### Recent Fixes Deployed
✅ **Oct 25, 2024** - Meta-SySop Task Cleanup Fix
- **Commit**: 3f62a0e73f853bcb24f45aedbe5fffe2eede086b
- **Fix**: Prevents tasks from getting stuck when Meta-SySop exits early
- **Changes**:
  - Session-scoped cleanup (uses tracked activeTaskListId)
  - Runs AFTER safety check passes
  - Uses updateTask() helper for consistent state
  - Auto-marks incomplete tasks as "⚠️ Auto-completed (session ended early)"

### Known Issues Before Latest Fix
1. **Stuck Tasks**: Tasks remained in "active" status indefinitely when Meta-SySop exited early (timeout/crash)
   - **Impact**: Frontend showed incomplete task lists that never cleared
   - **Status**: FIXED in commit 3f62a0e73f853bcb24f45aedbe5fffe2eede086b

2. **Frontend WebSocket Timeout**: Sometimes frontend shows timeout even when backend succeeds
   - **Impact**: User sees error but operation actually completed
   - **Workaround**: Refresh page to see actual status

### Database Requirements

#### Owner Configuration (CRITICAL)
Meta-SySop requires owner designation for access:
```sql
-- Set owner in production database
UPDATE users 
SET is_owner = true 
WHERE email = 'your-email@example.com';
```

OR set environment variable:
```
OWNER_USER_ID=<user_id>
```

**Files**: See `production-owner-setup.sql` and `PRODUCTION_OWNER_SETUP.md`

#### Clear Stuck Tasks (After Fix Deployment)
If tasks are stuck from before the fix:
```sql
-- Clear stuck task lists
UPDATE task_lists 
SET status = 'completed' 
WHERE status = 'active';

-- Clear stuck tasks
UPDATE tasks 
SET status = 'completed',
    result = '⚠️ Cleared during cleanup (pre-fix)'
WHERE status IN ('in_progress', 'pending');
```

**File**: See `PRODUCTION_CLEAR_TASKS.sql`

## Environment Variables Required

### Critical (App won't start without these)
```
DATABASE_URL=postgresql://...  # Render PostgreSQL
SESSION_SECRET=<random-secret>
ANTHROPIC_API_KEY=sk-ant-...   # Claude API
```

### GitHub Integration (For Meta-SySop)
```
GITHUB_TOKEN=ghp_...            # Fine-grained PAT with repo access
GITHUB_REPO=6-7Development/archetype
GITHUB_BRANCH=main              # Optional, defaults to main
```

### Optional
```
OWNER_USER_ID=<uuid>           # Alternatively set owner in DB
OPENAI_API_KEY=sk-...          # If using OpenAI (we use Claude)
STRIPE_SECRET_KEY=sk_...       # For payments (not yet implemented)
```

See `.env.example` for complete list.

## Build Configuration

### render.yaml
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Node Version**: 20.x (specified in package.json engines)

### Dockerfile
Alternative deployment option (not currently used on Render)

## Logs to Check

### Application Startup
Look for:
```
[db] Environment: NODE_ENV=production
✅ Database connected successfully
✅ GitHub integration configured successfully
💡 Auto-healing system DISABLED (development mode - use manual healing)
```

### Meta-SySop Session
Look for:
```
[META-SYSOP] Starting Meta-SySop session for user: <id>
[META-SYSOP-CLEANUP] Post-loop cleanup: checking for incomplete tasks...
[META-SYSOP-CLEANUP] ✅ Task list marked as completed (cleanup)
```

### Anti-Lying Enforcement
Look for (5 times per session):
```
[META-SYSOP-STREAM] 🔇 Text suppression active (tool calls present)
```

## Testing After Deployment

1. **Verify Owner Access**:
   - Log in as owner user
   - Navigate to Meta-SySop chat
   - Should see interface (not "Unauthorized")

2. **Test Task Cleanup**:
   - Send simple request: "Check platform health"
   - Watch task board for real-time updates
   - Tasks should complete and clear properly

3. **Check Logs**:
   - Render Dashboard → Service → Logs
   - Look for cleanup messages
   - Verify no stuck tasks reported

## Troubleshooting

### Tasks Still Stuck After Fix
- Run SQL cleanup queries (see PRODUCTION_CLEAR_TASKS.sql)
- Verify fix was deployed (check commit hash in logs)

### "Unauthorized" for Meta-SySop
- Check owner designation in database
- Verify OWNER_USER_ID env var (if using)

### GitHub Commits Failing
- Verify GITHUB_TOKEN has repo write access
- Check token hasn't expired
- Verify GITHUB_REPO format: "owner/repo-name"

### Database Connection Issues
- Check DATABASE_URL format
- Verify SSL settings for Neon
- Check Render database instance status

## Architecture Notes

### Anti-Lying System (5 Layers)
1. Text suppression when tool calls present
2. Task dependency validation
3. Commit success tracking
4. Session-end validation
5. Honest final messages

### Task Management
- Tasks stored in PostgreSQL (task_lists + tasks tables)
- Real-time updates via WebSocket
- Session-scoped cleanup on exit

### Deployment Flow
Replit Dev → GitHub → Render Production
- GitHubService commits from Replit
- Render auto-deploys on GitHub webhook
- No manual deployment needed
