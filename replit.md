# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring LomuAI, an autonomous AI coding agent, and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A key capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging.

## Recent Updates (Nov 7, 2025)
- ✅ **CRITICAL FIX - Platform Healing Tool Parity Achieved** (Nov 7, 2025): Platform Healing was severely crippled with only 9 tools vs Regular LomuAI's 38 tools. Added ALL 29 missing tools to achieve 100% parity:
  - **Tool Count**: 9 → 38 tools (subagent, bash, edit, grep, search_codebase, LSP diagnostics, packager_tool, restart_workflow, read_logs, execute_sql, architect_consult, web_search, run_test, verify_fix, perform_diagnosis, knowledge_store/search/recall, code_search, list/create/delete platform files)
  - **Implementation**: Added 366 lines of tool handlers to server/routes/healing.ts (copied from lomuChat.ts)
  - **Parity Requirement**: Both chats now have IDENTICAL tools/logic - updates to one require updates to both (like desktop/mobile parity)
  - **Deployed**: Successfully deployed to Railway with zero TypeScript errors
- ✅ **Frontend Rebuild Completed**: Removed Lumo avatar from Platform Healing, added upload button to chat input (deployed to Railway)
- ✅ **LomuAI Efficiency Phase 1**: Added 4 efficiency rules to system prompt (deployed to Railway)
- ✅ **LomuAI Conversational Updates**: Added conversational progress updates - LomuAI now shares work status naturally without wasting tokens
- ✅ **Enhanced Self-Awareness**: LomuAI now understands its role as the platform's autonomous coding agent, relationship with I AM Architect (premium consultant), and its identity
- ✅ **Platform Identity**: Changed all "Archetype" references to "Lomu" platform
- ✅ **Platform Healing Prompt Fix**: Fixed LomuAI spending too much time explaining instead of working - now starts immediately with brief updates AS it works (no more long upfront explanations)
- ✅ **Platform Healing Commit Tools Added**: Platform Healing now has commit_to_github and validate_before_commit tools - can deploy changes to Railway just like regular LomuAI
- ✅ **Platform Healing Efficiency Rules**: Added same 4 efficiency rules to Platform Healing (search before coding, copy don't reinvent, verify task, iteration budget)

## User Preferences
### API Configuration
**Claude Sonnet 4 Unified Strategy**:
- **ALL AI Operations Use Claude Sonnet 4** via ANTHROPIC_API_KEY
  - Model: claude-sonnet-4-20250514
  - Cost: $3.00 input / $15.00 output per 1M tokens
  - 200K token context window
  - Used for: LomuAI Chat (38 tools), Platform Healing (38 tools - IDENTICAL), I AM Architect
  
**Why Claude-Only?**
- ✅ Reliable tool execution (no hallucinated Python syntax like Gemini)
- ✅ Better token control (prevents token waste)
- ✅ Consistent behavior across all AI operations
- ✅ Costs more but provides full internal control
- ⚠️ Gemini temporarily disabled until tool reliability issues are resolved

### Design Preferences
- **Brand Identity**: Fresh, optimistic, citrus-inspired theme
- **Color Palette**:
  - Sparkling Lemon (50 98% 58%) - Primary vibrant yellow
  - Fresh Mint (145 60% 45%) - Success green
  - Citrus Bloom (32 94% 62%) - Warning orange
  - Slate Professional (210 14% 24%) - Text and contrast
  - Cream Base (48 46% 96%) - Soft backgrounds
- **Visual Language**:
  - Bright, welcoming interfaces with playful professionalism
  - Card-based layouts with warm shadows
  - Clean, approachable design with generous spacing
  - Inter font family for UI text, JetBrains Mono for code
  - Light mode primary with dark mode support
  - Organic animations (Lumo breathing, lemonade filling)
- **Illustration Elements**:
  - Lemonade jar loading animations (SVG with animated fill and bubbles)
  - Lumo mascot with natural sprite animations
  - Subtle lemon motifs and citrus accents
  - Ice cubes, bubbles, and fresh visual flourishes

## System Architecture
The platform is built with a React frontend, an Express.js backend, and PostgreSQL for data persistence.

### Dual-Version Architecture
The platform utilizes a unified codebase to support two distinct user experiences: Lomu (Desktop) with a 4-panel layout, and Lomu5 (Mobile) with bottom tab navigation. Both versions share backend APIs, WebSocket connections, authentication, and database access.

### UI/UX Decisions
The user interface features a tab-based workspace providing an IDE-like experience, primarily through a command console and real-time live preview. The design emphasizes a fresh, optimistic aesthetic with a citrus-inspired color palette, card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces use semantic theme tokens for consistent, polished appearance with modern message bubbles, proper contrast, and smooth transitions. The chat UI features clean inline aesthetics matching professional AI assistants. Loading states use a signature lemonade jar animation.

### System Design Choices
LomuAI is the sole autonomous worker that commits changes, operating independently with a strict 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT). I AM Architect is a user-summoned consultant only (premium feature), providing guidance without committing code. The system supports parallel subagent execution, real-time streaming, usage-based billing, and self-testing.

**LomuAI Efficiency Improvements (Phase 1 - Nov 2025):**
- **Problem**: LomuAI was completing simple tasks in 30+ iterations (60K tokens, $2.70 cost) vs Replit Agent's 2-5 iterations (6K tokens, $0.27 cost)
- **Root Cause**: No pre-flight file search, reinventing features instead of copying, no task verification
- **Solution**: Enhanced system prompt with 4 efficiency rules:
  1. **SEARCH BEFORE CODING** - Forces codebase search to find target files and existing implementations before coding
  2. **COPY, DON'T REINVENT** - Instructs to copy working code instead of reimplementing from scratch
  3. **VERIFY THE TASK** - Post-change checklist to ensure correct file was modified and exact request was completed
  4. **ITERATION BUDGET AWARENESS** - Clear limits: 5 iterations (simple), 10 (medium), 20 (complex)
- **Expected Impact**: 90% token savings (30 iterations → 3 iterations), 87% faster completion (15 min → 2 min)
- **Status**: Phase 1 (system prompt updates) deployed; Phase 2-4 pending (job manager verification, iteration tracking, smart copy-paste detection)
- **Implementation**: server/config/prompts.ts - Added efficiency rules to both simple and complex task prompts

**Access Model:**
- **Platform Healing**: Owner-only access to fix the platform itself using LomuAI v2.0 (free for owner)
- **Regular LomuAI**: All users build/fix their own projects (usage-based credit billing)
- **I AM Architect**: Premium consulting feature available to all users (deducts credits)
- **Owner Privileges**: Unlimited free usage of all platform features

**Credit System (V4.0 - Profitable 1:1 Ratio):**
- 1 credit = 1,000 tokens = $0.05 (retail pricing)
- Match industry standard: $1 paid = $1 in credits (Cursor/Replit parity)
- Pricing tiers:
  - Free: 50 credits ($2.50 value, 50K tokens) - 14-day trial
  - Starter: 980 credits ($49 value, 980K tokens) - ~12 LomuAI projects/month
  - Pro: 2,580 credits ($129 value, 2.58M tokens) - ~31 LomuAI projects/month
  - Business: 5,980 credits ($299 value, 5.98M tokens) - ~72 LomuAI projects/month
  - Enterprise: 17,980 credits ($899 value, 17.98M tokens) - ~217 LomuAI projects/month
- Profit margins: 55-66% after all costs (AI + infrastructure + storage)
- Overage rates: $0.03-0.06/1K tokens (60-80% margin on overages)
- Atomic reserve → consume → refund operations
- Credit wallet with available/reserved tracking
- Stripe integration for purchases and subscriptions

Key features include:
- **GitHub Integration**: Full version control with 6 tools, supporting branching, pull requests, and project export, triggering auto-deployment.
- **Environment Variables Management**: Project-level secrets with 4 tools, database storage, validation, and security masking.
- **Code Intelligence System**: AST-based code understanding via CodeIndexer, FileRelevanceDetector, and SmartChunker for efficient code retrieval and dependency graphing.
- **Platform Healing System**: Owner-only two-tier incident resolution (Knowledge Base → LomuAI v2.0) for fixing the platform itself. Platform Healing has IDENTICAL 38 tools to regular LomuAI (100% parity requirement - updates to one must be mirrored to both).
- **Replit Agent Parity**: Matches Replit Agent's complex task handling with increased token limits, iterations, self-correction, and concurrency.
- **Credit-Based Billing System**: Production-ready monetization with usage-based credits (1 credit = 1K tokens = $0.05), atomic operations, pause/resume flow, and Stripe integration.
- **Monetization Infrastructure**: Lead capture, Stripe subscription system, webhooks, granular usage billing, and template marketplace commission model.
- **Security & Production Readiness**: Authentication/authorization (Replit Auth, PostgreSQL sessions), protected API routes, rate limiting, bcrypt-hashed API keys, and comprehensive RCE prevention including terminal security and resource caps.

### Feature Specifications
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Management of deployments, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access and invitations.
- **API Key Management**: Secure system for Pro+ users with hashing, usage tracking, and validation.
- **Support Ticketing**: Complete system with subject, description, priority, status, and plan-based SLA.
- **AI Request Management**: Priority processing queue with concurrent limits, real-time cost preview, usage dashboard, token-based pricing, and parallel subagent execution.
- **Advanced AI Development Features**: Includes Sub-Agent/Task Runner System, Message Queue, Autonomy Controls, AI Image Generation, Dynamic Intelligence, Plan Mode, Design Mode, Workflows, Agents & Automations, and a General Agent Mode.

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI, next-themes
- **Backend**: Express.js, WebSocket
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **AI**: Anthropic Claude Sonnet 4, OpenAI (gpt-image-1)
- **Deployment**: Railway (auto-migration on deploy via railway-db-setup.cjs)
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API
