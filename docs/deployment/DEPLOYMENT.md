# Deployment Guide

## Production-Grade Resilience Features

Your Archetype platform includes comprehensive safety mechanisms to handle failures gracefully and recover automatically.

---

## 🏥 Health Monitoring

### Health Check Endpoint
```bash
curl https://your-platform.com/health
```

**Response (healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T10:00:00.000Z",
  "uptime": 3600.5,
  "responseTime": 15,
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

**Response (degraded):**
```json
{
  "status": "degraded",
  "checks": {
    "database": "error",
    "ai_generation": "disabled"
  }
}
```

**Use cases:**
- External monitoring (UptimeRobot, Pingdom, DataDog)
- Load balancer health checks (Render, Railway)
- CI/CD deployment verification

---

## 🔧 Admin Emergency Access

When the platform is experiencing issues, use the emergency endpoint to gather diagnostics.

### Emergency Diagnostics
```bash
curl -H "x-admin-secret: YOUR_ADMIN_SECRET_KEY" \
  https://your-platform.com/admin/emergency
```

**Response:**
```json
{
  "timestamp": "2025-10-18T10:00:00.000Z",
  "server": {
    "uptime": 3600.5,
    "memory": {
      "rss": 150994944,
      "heapTotal": 67108864,
      "heapUsed": 45678912
    },
    "pid": 1234,
    "platform": "linux",
    "nodeVersion": "v20.x.x"
  },
  "environment": {
    "NODE_ENV": "production",
    "PORT": "5000",
    "hasDatabase": true,
    "hasAnthropicKey": true,
    "hasTavilyKey": false,
    "hasStripeKey": true,
    "hasSessionSecret": true,
    "hasAdminKey": true
  },
  "features": {
    "AI_GENERATION": true,
    "WEB_SEARCH": false,
    "BROWSER_TEST": true,
    "STRIPE_BILLING": true
  },
  "database": {
    "status": "connected",
    "tableCount": 15
  }
}
```

**Security:**
- Requires `ADMIN_SECRET_KEY` environment variable
- Send as header: `x-admin-secret: YOUR_KEY`
- Returns comprehensive system diagnostics
- Use when platform is unresponsive or behaving unexpectedly

---

## 🛡️ Graceful Degradation

The platform uses **feature flags** to continue operating even when some services are unavailable.

### Feature Flags
```typescript
FEATURES = {
  AI_GENERATION: true,      // Requires ANTHROPIC_API_KEY
  WEB_SEARCH: false,        // Requires TAVILY_API_KEY (optional)
  BROWSER_TEST: true,       // Always available
  VISION_ANALYSIS: true,    // Requires ANTHROPIC_API_KEY
  STRIPE_BILLING: true      // Requires STRIPE_SECRET_KEY
}
```

**Behavior:**
- **Missing API key**: Feature returns 503 error with clear message
- **Database down**: Platform starts in degraded mode, health check reports status
- **Partial failure**: Platform continues serving working features

**Example:** If TAVILY_API_KEY is not set:
- ❌ Web search tool returns: `"Web search temporarily unavailable"`
- ✅ AI generation, browser testing, vision analysis still work
- ✅ Platform remains operational

---

## 🔄 Database Connection Retry

The platform automatically retries database connections with **exponential backoff**.

### Retry Logic
```javascript
Attempt 1: Wait 1 second   (1000ms)
Attempt 2: Wait 2 seconds  (2000ms)
Attempt 3: Wait 4 seconds  (4000ms)
Attempt 4: Wait 8 seconds  (8000ms)
Attempt 5: Wait 16 seconds (16000ms)
```

**Startup behavior:**
1. Server tests database connection on startup
2. If connection fails, retries up to 5 times with exponential backoff
3. If all retries fail, server starts in degraded mode
4. Requests requiring database return appropriate errors
5. `/health` endpoint reports database status

**Logs:**
```
🔍 Testing database connection...
⚠️ Retry attempt 1/5 failed. Retrying in 1000ms...
⚠️ Retry attempt 2/5 failed. Retrying in 2000ms...
✅ Database connected successfully
```

---

## 🚀 PM2 Process Monitoring (Production)

Use PM2 for auto-restart on crashes and zero-downtime deployments.

### Installation
```bash
npm install -g pm2
```

### Start with PM2
```bash
# Start application
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs archetype

# Restart
pm2 restart archetype

# Stop
pm2 stop archetype

# Delete from PM2
pm2 delete archetype
```

### Auto-Restart Features
- ✅ **Crash recovery**: Restarts automatically on crashes
- ✅ **Memory limits**: Restarts if memory exceeds 1GB
- ✅ **Max restarts**: Prevents infinite restart loops (max 10)
- ✅ **Min uptime**: Only considers stable if running >10 seconds
- ✅ **Exponential backoff**: Waits 100ms → 200ms → 400ms between restarts

### PM2 Configuration
See `ecosystem.config.js`:
```javascript
{
  name: 'archetype',
  script: 'npm run dev',
  instances: 1,
  autorestart: true,
  max_memory_restart: '1G',
  exp_backoff_restart_delay: 100,
  max_restarts: 10,
  min_uptime: '10s'
}
```

### PM2 + Startup Script
Make PM2 start on server reboot:
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

---

## 🌐 External Hosting (Render, Railway, etc.)

### Required Environment Variables
```bash
# Core
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://...
SESSION_SECRET=random-secret-here
ADMIN_SECRET_KEY=admin-secret-here

# Optional (for full features)
TAVILY_API_KEY=tvly-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLIC_KEY=pk_live_...
```

### Deployment Steps

**1. Git Version Control**
```bash
# Commit before each deploy
git add .
git commit -m "Deploy: description of changes"
git push origin main
```

**2. Enable Database Backups**
- **Render**: Database → Backups → Enable automated backups
- **Railway**: PostgreSQL → Backups → Configure retention

**3. Configure Health Check**
- **Render**: Settings → Health Check Path: `/health`
- **Railway**: Settings → Health Check: `GET /health`

**4. Set Up Process Manager**
```bash
# In production environment
npm install pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**5. Monitor Health**
Use external monitoring service:
- **UptimeRobot** (free): Monitor `/health` every 5 minutes
- **Pingdom**: Advanced monitoring with alerts
- **DataDog**: Full observability stack

---

## 🚨 Recovery Procedures

### Scenario 1: Platform Crashes
**Automatic:** PM2 restarts automatically (if configured)

**Manual (if not using PM2):**
```bash
# On Render/Railway - trigger manual deployment
# Or restart the service through their dashboard
```

### Scenario 2: Database Connection Lost
**Automatic:** Platform retries connection with exponential backoff

**Manual check:**
```bash
curl https://your-platform.com/health
# Check "database" status in response
```

### Scenario 3: Platform Unresponsive
**Step 1:** Check health endpoint
```bash
curl https://your-platform.com/health
```

**Step 2:** Get diagnostics
```bash
curl -H "x-admin-secret: YOUR_KEY" \
  https://your-platform.com/admin/emergency
```

**Step 3:** Check logs
- **Render**: Logs tab in dashboard
- **Railway**: Deployments → View logs

**Step 4:** Rollback
- **Replit**: Use automatic checkpoint rollback
- **Git**: Rollback to last working commit
```bash
git log --oneline
git checkout <working-commit>
git push --force origin main
```

### Scenario 4: API Key Issues
**Check feature availability:**
```bash
curl https://your-platform.com/health
# Inspect "checks" section
```

**Fix:**
1. Add missing API key to environment variables
2. Restart service
3. Verify with `/health` endpoint

---

## 📊 Monitoring Best Practices

### 1. External Uptime Monitoring
Set up alerts for:
- `/health` endpoint down
- `/health` returns status: "degraded"
- Response time > 5 seconds

### 2. Log Monitoring
Monitor for patterns:
- `❌ Database connection failed`
- `⚠️ Retry attempt`
- `503 Service Unavailable`

### 3. Resource Monitoring
Track:
- Memory usage (alert if >80% of limit)
- CPU usage (alert if >90%)
- Database connections (alert if approaching limit)

### 4. Feature Availability
Regularly check `/health` for:
- `"ai_generation": "disabled"`
- `"database": "error"`

---

## 🎯 Production Checklist

Before going live:
- [ ] Set all required environment variables
- [ ] Enable database automated backups
- [ ] Configure health check endpoint (`/health`)
- [ ] Set up external monitoring (UptimeRobot, etc.)
- [ ] Install and configure PM2 (or equivalent process manager)
- [ ] Test emergency admin endpoint with ADMIN_SECRET_KEY
- [ ] Document rollback procedure
- [ ] Set up log aggregation (optional: Papertrail, Logtail)
- [ ] Configure alerts for downtime/errors
- [ ] Test graceful degradation (remove API key, restart, verify)

---

## 🆘 Emergency Contacts

**When platform is down:**
1. Check `/health` endpoint
2. Use `/admin/emergency` for diagnostics
3. Review logs in hosting dashboard
4. Rollback to last working commit if needed
5. Restore database from backup if corrupted

**Admin Access:**
```bash
# Emergency diagnostics
curl -H "x-admin-secret: YOUR_ADMIN_SECRET_KEY" \
  https://your-platform.com/admin/emergency

# Health check
curl https://your-platform.com/health
```

Your platform is production-ready with multiple layers of safety! 🚀
