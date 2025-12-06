# Archetype Platform - Production Deployment Guide

## 📦 Package Contents
This ZIP contains the complete Archetype platform with all latest fixes:

### ✅ Fixed Issues (October 21, 2025)
1. **SySop Identity** - SySop now knows he's "THE CODER for Archetype platform" (not a chatbot)
2. **Platform Self-Healing** - LomuAI capabilities enabled - can fix Archetype itself
3. **Conversational Builds** - 100% emoji-based messages (🧠🔨✅), zero technical jargon
4. **Preview System** - Smart React detection + DOMContentLoaded wrapper (no more blank pages)
5. **TypeScript Errors** - All LSP diagnostics cleared
6. **Build Messaging** - WebSocket and UI cleaned of all technical messages

### 🎯 System Relationship
- **Archetype** = The Platform (AI-powered web development SaaS)
- **SySop** = THE CODER (autonomous AI coding agent)
- **I AM / Architect** = Consultant (helps when SySop is stuck)

## 🚀 Deploy to Render

### Step 1: Upload to Render
1. Go to https://render.com
2. Create new **Web Service**
3. Connect to GitHub repo OR upload this ZIP
4. Set **Build Command**: `npm install && npm run build`
5. Set **Start Command**: `npm start`

### Step 2: Configure Environment Variables
Add these to Render environment:

```bash
# Required Secrets (YOU MUST ADD THESE)
ANTHROPIC_API_KEY=your_anthropic_key_here
SESSION_SECRET=generate_random_64_char_string
DATABASE_URL=your_neon_postgres_url

# Render provides these automatically (don't add manually)
PORT=5000
NODE_ENV=production
```

### Step 3: Database Setup (Neon PostgreSQL)
1. Go to https://neon.tech
2. Create new project
3. Copy connection string to `DATABASE_URL`
4. Run migrations: `npm run db:push` (Render will do this on deploy)

### Step 4: Admin Account
After first deployment, create admin account:
```sql
-- Connect to your Neon database
INSERT INTO users (id, email, password_hash, is_admin)
VALUES (
  gen_random_uuid(),
  'admin@yourcompany.com',
  '$2b$10$your_bcrypt_hash_here', -- Use bcrypt to hash password
  true
);
```

Or use the auto-created admin account:
- Email: `root@getdc360.com`
- Password: `Admin123@*`

## 🔑 Get API Keys

### Anthropic Claude API
1. Go to https://console.anthropic.com
2. Create account
3. Add payment method
4. Generate API key
5. Copy to `ANTHROPIC_API_KEY`

### Session Secret (Generate)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📋 Post-Deployment Checklist
- [ ] App loads at https://your-app.onrender.com
- [ ] Login page works
- [ ] Admin can sign in
- [ ] SySop chat responds (test: "Who are you?")
- [ ] SySop says "I'm SySop - THE CODER for Archetype"
- [ ] Build system works (test: "build a todo app")
- [ ] Preview shows generated apps (not blank)

## 🧪 Test SySop Identity
After deployment, login and chat with SySop:

**Test 1: Identity**
- Ask: "Who are you?"
- Expected: "I'm SySop - THE CODER for Archetype platform"
- ✅ Should NOT say "chatbot" or "assistant"

**Test 2: Self-Healing**
- Ask: "Can you fix bugs in Archetype itself?"
- Expected: "Yes, I can fix platform code" (mentions LomuAI or platform-healing)
- ✅ Should NOT say "I can't edit my own platform"

**Test 3: Build**
- Request: "build a simple todo app"
- Expected: Shows conversational messages (🧠🔨✅), NOT technical JSON
- ✅ Preview should show working app (not blank page)

## 🛠️ Troubleshooting

### SySop says he can't fix platform
- ✅ Fixed in this version - system prompts updated

### Preview shows blank page
- ✅ Fixed with smart React detection + DOMContentLoaded wrapper

### Build messages show technical jargon
- ✅ Fixed - all WebSocket and UI messages now conversational

### TypeScript errors in console
- ✅ Fixed - all LSP diagnostics cleared

## 📞 Support
For issues with Archetype platform itself, use the **Platform Healing** feature:
1. Login as admin
2. Go to `/platform-healing`
3. Describe the issue
4. SySop will analyze and fix the platform code

## 🎉 Ready to Self-Heal!
Archetype can now fix and improve itself autonomously through LomuAI. When users report platform bugs, SySop can read, analyze, and modify Archetype's own source code to fix issues.

**Relationship:**
- Users interact with Archetype (the platform)
- SySop is THE CODER (builds user projects AND fixes platform)
- Architect (I AM) consults when SySop needs strategic guidance

---

**Version:** October 21, 2025 - Production Ready
**All Fixes:** Identity, Self-Healing, Conversational Messaging, Preview, TypeScript
**Architect Approved:** ✅ Pass - Ready for deployment
