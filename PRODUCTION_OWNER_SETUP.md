# 🔧 Production Owner Setup Guide

## Problem
Meta-SySop doesn't work on Render production because:
- ❌ No user is marked as `is_owner = true` in production database
- ❌ `OWNER_USER_ID` environment variable is not set on Render

## Solution (Choose One)

---

### ✅ **Option 1: Database Update** (Recommended - Permanent)

This approach permanently marks a user as owner in the production database.

#### Steps:

1. **Access Render Database**
   - Go to: https://dashboard.render.com
   - Navigate to your PostgreSQL database
   - Click "Connect" → "External Connection"

2. **Run the SQL Script**
   ```bash
   # Use the provided production-owner-setup.sql
   psql <YOUR_RENDER_DATABASE_URL> -f production-owner-setup.sql
   ```

   Or manually run this SQL:
   ```sql
   -- Check current admin users
   SELECT id, email, role, is_owner FROM users WHERE role = 'admin';
   
   -- Mark your account as owner (update email to match yours!)
   UPDATE users 
   SET is_owner = true 
   WHERE email = 'root@getdc360.com'
   RETURNING id, email, role, is_owner;
   ```

3. **Verify**
   ```sql
   SELECT email, is_owner FROM users WHERE is_owner = true;
   ```

4. **Restart Render Service**
   - Go to your web service on Render
   - Click "Manual Deploy" → "Deploy latest commit"
   - Or just wait for next auto-deploy

---

### ✅ **Option 2: Environment Variable** (Quick - Session-based)

This approach uses an environment variable to identify the owner.

#### Steps:

1. **Get Your User ID from Production**
   - Connect to Render database console
   - Run: `SELECT id FROM users WHERE email = 'root@getdc360.com';`
   - Copy the ID (e.g., `45133179-3386-4368-8f03-bd1e1e269991`)

2. **Add Environment Variable on Render**
   - Go to: https://dashboard.render.com
   - Open your web service
   - Go to "Environment" tab
   - Click "Add Environment Variable"
   - **Key:** `OWNER_USER_ID`
   - **Value:** `<your-user-id-from-step-1>`
   - Save changes

3. **Render Auto-Redeploys**
   - Service will automatically restart with new env var
   - Meta-SySop will now work for that user ID

---

## 🧪 Testing

After setup, verify Meta-SySop works:

1. **Log in to production:**
   ```
   https://archetype-production-url.onrender.com
   ```

2. **Navigate to Platform Healing:**
   - Should see "Platform Healing" in sidebar (wrench icon 🔧)
   - Click to open Meta-SySop chat

3. **Send test message:**
   ```
   Add a console.log to server/index.ts that says "✅ Owner access verified"
   ```

4. **Verify on GitHub:**
   - Check https://github.com/6-7Development/archetype/commits/main
   - Should see new commit from Meta-SySop

---

## 📊 Comparison

| Approach | Pros | Cons |
|----------|------|------|
| **Database Update** | ✅ Permanent<br>✅ Works for all deployments<br>✅ No env var needed | ❌ Requires DB access<br>❌ One-time manual step |
| **Environment Variable** | ✅ Quick setup<br>✅ No DB access needed<br>✅ Easy to change | ❌ Per-environment setup<br>❌ Lost if env vars cleared |

---

## 🎯 Recommended Approach

**Use BOTH for maximum reliability:**

1. ✅ Mark user as owner in database (permanent)
2. ✅ Set OWNER_USER_ID env var (backup/explicit reference)

This ensures Meta-SySop works even if:
- Database is migrated/restored
- Environment variables are reset
- Multiple environments exist (staging, production, etc.)

---

## 🔍 Troubleshooting

### "Platform Healing" not showing in sidebar?
- Check you're logged in as the owner account
- Verify `is_owner = true` in database
- Clear browser cache and reload

### Meta-SySop returns "Unauthorized"?
- Check `OWNER_USER_ID` matches your actual user ID
- Verify user exists in production database
- Check Render logs for auth errors

### Changes not deploying to production?
- Verify `GITHUB_TOKEN` is set on Render
- Check `GITHUB_REPO` is correct
- Look for GitHub API errors in Render logs

---

## 📝 Current Status

**Development (Replit):**
- ✅ Owner configured: `root@getdc360.com`, `sysop@test.local`
- ✅ Meta-SySop fully functional
- ⚠️ No `OWNER_USER_ID` env var (not needed)

**Production (Render):**
- ❌ No owner configured in database
- ❌ No `OWNER_USER_ID` env var set
- ❌ Meta-SySop currently non-functional

**Action Required:**
Run the production setup (Option 1 or 2 above) to enable Meta-SySop on Render!
