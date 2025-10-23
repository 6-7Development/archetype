╔═══════════════════════════════════════════════════════════════════════════╗
║                    ARCHETYPE PLATFORM - COMPLETE SOURCE                   ║
║                      AI-Powered SaaS Platform v1.0.0                      ║
╚═══════════════════════════════════════════════════════════════════════════╝

📦 FILE: archetype-platform-complete.zip
📏 SIZE: 257 MB
📅 DATE: October 23, 2025

═══════════════════════════════════════════════════════════════════════════

✅ WHAT'S INCLUDED:

✓ Complete source code (client + server + shared)
✓ All dependencies listed in package.json
✓ Database schema (Drizzle ORM)
✓ Authentication system (Replit OAuth + Passport.js)
✓ AI integration (Claude Sonnet 4)
✓ Payment processing (Stripe)
✓ Deployment configurations
✓ Documentation files
✓ Design guidelines
✓ Environment templates

❌ EXCLUDED (for size/security):

✗ node_modules/ (run npm install to restore)
✗ .git/ (version control history)
✗ dist/ (build artifacts)
✗ .cache/ and temp files
✗ Chat images and uploads
✗ Log files

═══════════════════════════════════════════════════════════════════════════

🚀 QUICK START:

1. EXTRACT THE ZIP
   unzip archetype-platform-complete.zip -d archetype-platform

2. INSTALL DEPENDENCIES
   cd archetype-platform
   npm install

3. SETUP ENVIRONMENT
   cp .env.example .env
   # Edit .env and add:
   - DATABASE_URL (PostgreSQL connection)
   - ANTHROPIC_API_KEY (Claude AI)
   - SESSION_SECRET (random string)
   - STRIPE_SECRET_KEY (optional)
   - TAVILY_API_KEY (optional)

4. INITIALIZE DATABASE
   npm run db:push

5. START DEVELOPMENT SERVER
   npm run dev
   # Server runs on http://localhost:5000

═══════════════════════════════════════════════════════════════════════════

🏗️ TECH STACK:

Frontend:
  • React 18 + TypeScript
  • Vite (build tool)
  • Tailwind CSS + Shadcn UI
  • Wouter (routing)
  • TanStack Query (data fetching)

Backend:
  • Node.js + Express.js
  • PostgreSQL + Drizzle ORM
  • WebSocket (real-time)
  • Passport.js (authentication)

AI & Testing:
  • Anthropic Claude Sonnet 4
  • Playwright (browser automation)
  • Tavily API (web search)

Payments & Hosting:
  • Stripe (subscriptions + marketplace)
  • Render.com (recommended)
  • Docker support included

═══════════════════════════════════════════════════════════════════════════

🎯 KEY FEATURES:

✓ SySop AI Agent - Autonomous code generation with 11 tools
✓ Live Preview - In-browser compilation with esbuild
✓ Chat Interface - Markdown rendering + syntax highlighting
✓ Vision API - Screenshot paste support
✓ Project Management - Multi-project workspace
✓ File Editor - Monaco editor integration
✓ Version Control - Project snapshots/restore
✓ Billing System - Stripe subscriptions + usage tracking
✓ Template Marketplace - Buy/sell project templates
✓ Team Workspaces - Multi-user collaboration
✓ Platform Self-Healing - Meta-SySop auto-fixes bugs
✓ Deployment System - One-click publish to production

═══════════════════════════════════════════════════════════════════════════

📚 DOCUMENTATION:

Main Files:
  • README.md - Project overview
  • replit.md - Architecture & preferences
  • DEPLOYMENT_GUIDE.md - Production deployment
  • design_guidelines.md - UI/UX standards

Deployment:
  • RENDER_DEPLOYMENT.md - Deploy to Render.com
  • render.yaml - Auto-deployment config
  • ecosystem.config.js - PM2 process management

Business:
  • MONETIZATION_GUIDE.md - Revenue strategies
  • PRICING_MODEL_V2.md - Subscription tiers
  • STRIPE_COMPLETE_SETUP.md - Payment setup

═══════════════════════════════════════════════════════════════════════════

🔐 REQUIRED ENVIRONMENT VARIABLES:

MUST HAVE:
  DATABASE_URL - PostgreSQL connection string
  ANTHROPIC_API_KEY - Claude AI API key
  SESSION_SECRET - Random 32+ character string

OPTIONAL:
  STRIPE_SECRET_KEY - For payment processing
  STRIPE_WEBHOOK_SECRET - For Stripe webhooks
  TAVILY_API_KEY - For web search capability
  ADMIN_SECRET_KEY - For admin promotion
  VITE_STRIPE_PUBLIC_KEY - Frontend Stripe key

═══════════════════════════════════════════════════════════════════════════

🎓 SYSOP AI AGENT:

SySop is the autonomous AI coder that powers Archetype. Features:

✓ 11 Tools Available:
  - list/read/write/delete project files
  - list/read/write platform files
  - browser_test (Playwright)
  - web_search (Tavily)
  - vision_analyze (Claude Vision)
  - architect_consult (Quality review)

✓ Self-Editing:
  - Can modify own system prompt
  - Location: server/routes.ts line ~2924-3100

✓ Memory System:
  - Conversations saved to database
  - Auto-summarization after 10+ messages

✓ Identity:
  - "THE CODER" who lives in Archetype
  - Reports to "I AM" (The Architect)
  - Mirrors Replit's Agent 3 ↔ Architect relationship

═══════════════════════════════════════════════════════════════════════════

🐛 TROUBLESHOOTING:

Port Already in Use:
  killall node
  npm run dev

Database Connection Failed:
  - Check DATABASE_URL is valid PostgreSQL connection
  - Ensure database exists
  - Run: npm run db:push

Missing Dependencies:
  rm -rf node_modules package-lock.json
  npm install

Build Errors:
  npm run build
  # Check for TypeScript errors

SySop Not Responding:
  - Check ANTHROPIC_API_KEY is valid
  - Check server logs for errors
  - Verify /api/ai-chat-conversation endpoint

═══════════════════════════════════════════════════════════════════════════

📞 SUPPORT:

Project: Archetype AI Platform
Company: Drill Consulting 360 LLC
Target: Fortune 500 Production Readiness
Status: Development Complete ✅

For issues:
  1. Check documentation files
  2. Review server logs
  3. Inspect browser console
  4. Test with fresh database

═══════════════════════════════════════════════════════════════════════════

🎉 READY TO DEPLOY!

This ZIP contains everything needed to:
  ✓ Deploy to production (Render, Railway, Docker)
  ✓ Accept payments (Stripe integration ready)
  ✓ Scale to thousands of users
  ✓ Monetize with subscriptions + marketplace

See DEPLOYMENT_GUIDE.md for production deployment steps.

Good luck! 🚀

═══════════════════════════════════════════════════════════════════════════
