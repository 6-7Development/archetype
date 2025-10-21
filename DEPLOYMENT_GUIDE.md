# Archetype Deployment Guide

## How to Deploy Updates to Render

### **Automatic Deployment (Recommended)**

Render automatically deploys your application when you push to GitHub. Here's how it works:

#### Step 1: Commit Your Changes
```bash
git add .
git commit -m "Your update message (e.g., Fixed Meta-SySop authentication)"
```

#### Step 2: Push to GitHub
```bash
git push origin main
```

#### Step 3: Render Detects & Deploys
- **Render automatically detects the push via webhook**
- **Starts building your application**
- **Deploys with zero downtime**
- **Your site at https://archetype-x8b5.onrender.com will update automatically**

---

### **How to Know When Deployment is Complete**

#### Method 1: Check Your Website Footer
✅ **Visit https://archetype-x8b5.onrender.com**

The homepage footer now shows:
- **Commit Hash**: Short git commit ID (e.g., `9a9f480`)
- **Last Updated**: Time since last deployment (e.g., "Updated 2 hours ago")
- **Status Badge**: "Live" indicator for production

#### Method 2: Render Dashboard
1. Go to https://dashboard.render.com
2. Find your "Archetype" service
3. Check the "Events" tab
4. Look for "Deploy live" status

#### Method 3: Check Deploy Logs
```bash
# View recent deployments
git log --oneline -5

# Check if your commit is the latest
git rev-parse HEAD
```

---

### **Typical Deployment Timeline**

| Stage | Duration | What's Happening |
|-------|----------|------------------|
| **Push to GitHub** | Instant | Code uploaded to repository |
| **Webhook Trigger** | ~30 seconds | Render detects the push |
| **Build Phase** | 3-5 minutes | npm install, npm run build |
| **Deploy Phase** | 1-2 minutes | Starting server, health checks |
| **Live** | Total: 5-8 min | Site updated! |

---

### **Deployment Verification Checklist**

After pushing updates, verify deployment with these steps:

#### 1. **Check Footer on Homepage**
- [ ] Visit https://archetype-x8b5.onrender.com
- [ ] Scroll to footer
- [ ] Verify commit hash matches your latest commit
- [ ] Confirm "Updated X ago" shows recent time
- [ ] See "Live" badge

#### 2. **Test Meta-SySop Features**
- [ ] Login as admin
- [ ] Navigate to `/platform-healing`
- [ ] Verify page loads without errors
- [ ] Check platform status shows current data

#### 3. **Verify 12-Step AI Workflow**
The 12-step (actually 14-step) AI workflow is working! It includes:

✅ **Step 1-3**: Deep understanding of user requirements
✅ **Step 4-7**: Intelligent code generation with context
✅ **Step 8-10**: Rigorous self-testing (browser + API tests)
✅ **Step 11-12**: Iterative refinement and fixes
✅ **Step 13**: Architect consultation (if stuck after 3 failures)
✅ **Step 14**: Final delivery with complete code

**How to Verify:**
1. Create a new project in `/builder`
2. Submit a complex command (e.g., "Create a todo app with authentication")
3. Watch the progress updates showing each step
4. Confirm SySop uses tools: `browser_test`, `web_search`, `architect_consult`

---

### **User Satisfaction Tracking**

#### How Users Can Provide Feedback

**NEW FEATURE**: Users can now rate their experience!

**API Endpoint**: `POST /api/satisfaction-survey`

**Request Body**:
```json
{
  "rating": 5,
  "category": "ai_quality",
  "feedback": "SySop generated perfect code!",
  "wouldRecommend": true,
  "featureRequests": "Add more templates"
}
```

**Categories**:
- `ai_quality` - Code generation quality
- `platform_ux` - User interface experience
- `performance` - Speed and reliability
- `support` - Customer support
- `overall` - General satisfaction

#### Admin Dashboard for Satisfaction Stats

Admins can view analytics at: `GET /api/admin/satisfaction-stats`

**Response includes**:
- Total surveys (last 30 days)
- Average rating
- Category breakdown
- Rating distribution (1-5 stars)

---

### **Troubleshooting Deployments**

#### Problem: Deployment Takes Too Long (>10 minutes)

**Solution**:
1. Check Render dashboard for build logs
2. Look for errors in the "Logs" tab
3. Verify all environment variables are set:
   - `DATABASE_URL`
   - `ANTHROPIC_API_KEY`
   - `SESSION_SECRET`
   - `STRIPE_SECRET_KEY` (optional)

#### Problem: Site Shows Old Code After Deployment

**Solution**:
1. Hard refresh your browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Check the footer commit hash matches your latest commit
3. Clear browser cache if needed

#### Problem: Deployment Failed

**Solution**:
1. Check Render "Events" tab for error message
2. Review build logs for specific errors
3. Common issues:
   - **TypeScript errors**: Fix LSP errors before pushing
   - **Missing dependencies**: Verify `package.json` is committed
   - **Database schema changes**: Run `npm run db:push --force` locally first

---

### **Advanced: Manual Deploy Trigger**

If you need to force a deployment without code changes:

#### Method 1: Empty Commit
```bash
git commit --allow-empty -m "Trigger deployment"
git push origin main
```

#### Method 2: Render Dashboard
1. Go to https://dashboard.render.com
2. Select your "Archetype" service
3. Click "Manual Deploy" → "Deploy latest commit"

---

### **GitHub Repository**

**Your repo**: https://github.com/6-7Development/archetype

**Branches**:
- `main` - Production (auto-deploys to Render)
- Create feature branches for testing: `git checkout -b feature/my-feature`

---

### **Environment Variables on Render**

**Set in Render Dashboard > Environment**:

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection | ✅ Yes |
| `ANTHROPIC_API_KEY` | Claude AI API | ✅ Yes |
| `SESSION_SECRET` | Auth security | ✅ Yes |
| `STRIPE_SECRET_KEY` | Payments | Optional |
| `NODE_ENV` | Set to `production` | ✅ Yes |

---

### **Quick Reference: Git Commands**

```bash
# Check current status
git status

# See recent commits
git log --oneline -10

# View remote repository
git remote -v

# Get latest commit info
git log -1 --format="%H|%ai|%s"

# Push to production
git push origin main

# Create and push new branch
git checkout -b feature/my-feature
git push -u origin feature/my-feature
```

---

### **Deployment Best Practices**

1. **Test locally first**: Run `npm run dev` and test changes before deploying
2. **Small, frequent deploys**: Deploy often with small changes (easier to debug)
3. **Descriptive commit messages**: Use clear messages like "Fixed admin authentication bug"
4. **Check logs**: Always verify deployment succeeded in Render dashboard
5. **Monitor performance**: Use the `/health` endpoint to check system status

---

### **Health Check Endpoint**

**URL**: https://archetype-x8b5.onrender.com/health

**Response**:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "checks": {
    "database": "ok",
    "ai_generation": "ok",
    "web_search": "ok",
    "stripe": "ok"
  }
}
```

Use this to verify all systems are operational after deployment.

---

## Summary

**To deploy updates:**
1. `git add .`
2. `git commit -m "Your update message"`
3. `git push origin main`
4. Wait 5-8 minutes
5. Check footer on homepage for updated commit hash
6. Verify features work as expected

**Your live site**: https://archetype-x8b5.onrender.com

**Deployment tracking**: Now visible on every page footer!
