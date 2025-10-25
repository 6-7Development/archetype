# Archetype Project ZIP Contents

This ZIP file contains the complete Archetype platform source code for review.

## ✅ INCLUDED

### Source Code
- `/client` - React/TypeScript frontend
- `/server` - Express.js backend
- `/shared` - Shared TypeScript schemas (Drizzle ORM)
- `/docs` - Documentation files
- `/public` - Static assets (logos, favicon)

### Configuration Files
- `package.json` - Node.js dependencies
- `package-lock.json` - Locked dependency versions
- `.env.example` - Environment variables template (NO SECRETS)
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `drizzle.config.ts` - Drizzle ORM configuration

### Deployment Files
- `render.yaml` - Render.com deployment configuration
- `Dockerfile` - Docker containerization (alternative deployment)
- `docker-compose.yml` - Docker Compose setup

### Database Files
- `shared/schema.ts` - Complete Drizzle ORM schema (PostgreSQL)
- `production-owner-setup.sql` - Owner user setup for Meta-SySop
- `PRODUCTION_CLEAR_TASKS.sql` - Task cleanup utility

### Documentation
- `README.md` - Project overview
- `replit.md` - Complete architecture and technical documentation
- `RENDER_DEPLOYMENT_NOTES.md` - **Deployment guide and troubleshooting**
- `PRODUCTION_OWNER_SETUP.md` - Owner configuration guide
- `/docs` folder - Additional technical documentation

## ❌ EXCLUDED (Can be restored from lockfiles)
- `node_modules/` - Dependencies (run `npm install`)
- `.venv/` - Python virtual env (if any)
- `.cache/` - Build cache
- `.next/` - Next.js build output
- `dist/` - Production build output
- `build/` - Build artifacts
- `.turbo/` - Turborepo cache
- `.pnpm-store/` - pnpm store
- `coverage/` - Test coverage reports
- `*.log` - Log files
- `.git/` - Git history
- `.local/` - Local state
- `*.png` - Screenshots (kept project small)

## 🔑 Key Files to Review

### For Architecture Understanding
1. **`RENDER_DEPLOYMENT_NOTES.md`** - Start here for deployment overview
2. **`replit.md`** - Complete technical architecture
3. **`shared/schema.ts`** - Database schema (all tables)
4. **`render.yaml`** - Deployment configuration

### For Meta-SySop Implementation
5. **`server/routes/metaSysopChat.ts`** - Main Meta-SySop logic
6. **`server/tools/task-management.ts`** - Task management system
7. **`server/githubService.ts`** - GitHub integration for auto-commits
8. **`client/src/components/meta-sysop-chat.tsx`** - Frontend UI
9. **`client/src/components/task-board.tsx`** - Real-time task display

### For Frontend Architecture
10. **`client/src/App.tsx`** - Main app structure
11. **`client/src/pages/`** - All page components
12. **`client/src/components/`** - Reusable UI components

## 📊 Project Stats
- **Type**: Full-stack TypeScript (React + Express)
- **Database**: PostgreSQL (Drizzle ORM)
- **AI**: Anthropic Claude 3.5 Sonnet
- **Auth**: Replit Auth + PostgreSQL sessions
- **Deployment**: Render.com (auto-deploy from GitHub)
- **ZIP Size**: ~36 MB (without node_modules)
- **Uncompressed**: ~150 MB source code

## 🚀 Quick Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run development server
npm run dev

# Build for production
npm run build
npm run start
```

## 📚 Environment Variables

See `.env.example` for complete list. Critical ones:

```
DATABASE_URL=postgresql://...       # PostgreSQL connection
SESSION_SECRET=random-secret-here   # Session encryption
ANTHROPIC_API_KEY=sk-ant-...       # Claude API
GITHUB_TOKEN=ghp_...               # For Meta-SySop commits
GITHUB_REPO=owner/repo-name        # Your repo
```

## 🎯 What to Look For

### Recent Critical Fix (Oct 25, 2024)
**Commit**: 3f62a0e73f853bcb24f45aedbe5fffe2eede086b

**Problem**: Tasks remained stuck when Meta-SySop exited early

**Solution**: 
- Session-scoped cleanup (tracks activeTaskListId)
- Runs AFTER safety check passes
- Auto-marks incomplete tasks with warning
- See `server/routes/metaSysopChat.ts` lines ~818-867

### Anti-Lying Enforcement System
5-layer system prevents Meta-SySop from claiming success prematurely:
1. Text suppression when tool calls present
2. Task dependency validation  
3. Commit success tracking
4. Session-end validation
5. Honest final messages

See `RENDER_DEPLOYMENT_NOTES.md` for details.

## 🔍 Architecture Highlights

- **Dual-Version UI**: Archetype (desktop) + Archetype5 (mobile)
- **WebSocket**: Real-time task updates
- **Autonomous AI**: Meta-SySop self-heals production issues
- **GitHub Integration**: Auto-commits fixes to trigger Render deploy
- **Enterprise Auth**: Replit Auth + PostgreSQL sessions
- **Usage Tracking**: Comprehensive billing/metering system

## 📧 Questions?

Review these docs in order:
1. RENDER_DEPLOYMENT_NOTES.md (deployment guide)
2. replit.md (complete architecture)
3. shared/schema.ts (database structure)
4. server/routes/metaSysopChat.ts (Meta-SySop implementation)

All code is TypeScript with comprehensive comments.
