# Lomu - "When Code Throws You Lemons"

## Recent Changes

### Task List Support for Platform Healing Chat (Nov 5, 2025)
**CRITICAL FIX - Restored Task Management System:**
- **Issue:** Platform Healing chat was "quiet" - no task lists showing, just silent execution
- **Root Cause:** Platform Healing had only 4 tools (read/write/search/cancel_job) but **no task management tools**
- **Solution:** Added 3 task management tools to Platform Healing chat:
  - `create_task_list()` - Creates visible task breakdown (REQUIRED for all work)
  - `read_task_list()` - Checks current task status  
  - `update_task()` - Updates task progress (pending → in_progress → completed)
- **Impact:** Platform Healing now matches regular LomuAI behavior with visible task lists and progress tracking
- **Files Modified:**
  - `server/routes/healing.ts` - Added task tools, handlers, and updated system prompt with workflow example
  - Uses same task management implementation as regular LomuAI from `../tools/task-management.ts`
- **User Experience:** Users now see task lists in Platform Healing chat showing what AI is doing step-by-step

## Overview
Lomu is an AI-powered platform for rapid web development. It features LomuAI, an AI coding agent for autonomous code generation, and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). Key capabilities include a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A core capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging.

## User Preferences
### API Configuration
**Claude Sonnet 4 Unified Strategy**:
- **ALL AI Operations Use Claude Sonnet 4** via ANTHROPIC_API_KEY
  - Model: claude-sonnet-4-20250514
  - Cost: $3.00 input / $15.00 output per 1M tokens
  - 200K token context window
  - Used for: LomuAI Chat (37 tools), Platform Healing (3 tools), I AM Architect
  
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
The user interface features a tab-based workspace providing an IDE-like experience, primarily through a command console and real-time live preview. The design emphasizes a fresh, optimistic aesthetic with a citrus-inspired color palette, card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces feature Lumo the Lemon mascot as an AI companion with natural sprite animations and emotional expressions. Loading states use a signature lemonade jar animation.

### Parallel Subagent Execution
LomuAI supports parallel subagent orchestration, allowing multiple tasks to execute simultaneously with Railway-safe resource limits. Tasks are queued, and progress is broadcast via WebSockets.

### Technical Implementations
- **AI Architecture**: LomuAI v2.0 follows a strict 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT) with programmatic enforcement via WorkflowValidator. Features include real-time streaming, usage-based billing, self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), architectural guidance (I AM Architect), and an automatic reflection/self-correction loop.
- **Autonomous AI System (LomuAI v2.0)**: LomuAI diagnoses issues, implements fixes, and automatically commits changes to GitHub, triggering auto-deployment. It prioritizes tool execution and code writing, using a PostgreSQL-backed job queue for asynchronous execution with WebSocket broadcasting and checkpointing.
- **Developer Tools**: LomuAI includes 56 tools covering core operations, deployment, secrets management, database, design, integrations, and file operations. All tools include security sandboxing, WebSocket event streaming, and integrate with existing platform healing infrastructure.
- **Platform Healing System**: Complete self-healing infrastructure with 3-tier intelligent routing for incident resolution: Tier 1 (Knowledge Base Auto-Fix), Tier 2 (LomuAI v2.0/Claude Sonnet 4), and Tier 3 (I AM Architect/Claude Sonnet 4). Automatic response quality monitoring triggers I AM Architect for autonomous diagnosis and fixes when quality is low.
- **Real-Time Enforcement System**: A 6-layer real-time enforcement system validates LomuAI responses and triggers I AM Architect guidance when violations occur.
- **Real-Time LomuAI + I AM Teamwork**: I AM Architect intervenes during active LomuAI sessions when workflow rules are violated, injecting corrective guidance. A "3-Strikes Escalation" policy automatically escalates jobs to I AM Architect for complete takeover after three failed guidance attempts.
- **Critical Files Protection System**: Implemented read-before-write enforcement for 8 core infrastructure files (server/index.ts, server/routes.ts, server/db.ts, server/vite.ts, package.json, drizzle.config.ts, vite.config.ts, shared/schema.ts) with file size change detection to prevent accidental overwrites.
- **Replit Agent Parity**: LomuAI now matches Replit Agent's complex task handling capability with extended iteration limits for different intents (BUILD, FIX, DIAGNOSTIC, CASUAL) and intelligent token/context management.
- **Command System**: Natural language commands processed by Anthropic Claude 3.5 Sonnet to generate JSON project structures.
- **File Management**: Generated files are stored in PostgreSQL, editable via Monaco editor, with real-time WebSocket synchronization.
- **Preview System**: Uses `esbuild` for in-memory React/TypeScript compilation for live application previews in an iframe.
- **Multi-Agent Task Management System**: Foundation for autonomous task breakdown with database tables and LomuAI tools, supporting sub-agents, message queues, autonomy controls, and dynamic intelligence.

### Feature Specifications
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Management of deployments, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access and invitations.
- **API Key Management**: Secure system for Pro+ users with hashing, usage tracking, and validation.
- **Support Ticketing**: Complete system with subject, description, priority, status, and plan-based SLA.
- **AI Request Management**: Priority processing queue with concurrent limits, real-time cost preview, usage dashboard, token-based pricing, and parallel subagent execution.
- **Advanced AI Development Features**: Includes Sub-Agent/Task Runner System, Message Queue, Autonomy Controls, AI Image Generation, Dynamic Intelligence, Plan Mode, Design Mode, Workflows, Agents & Automations, and a General Agent Mode.

### System Design Choices
- **Database Architecture**: Comprehensive PostgreSQL schema with Drizzle ORM.
- **Team Collaboration System**: Role-based access control with an invitation system.
- **API Key Infrastructure**: Secure key generation with bcrypt hashing and usage tracking.
- **Support Ticketing System**: Complete ticket lifecycle with priority levels and plan-based SLAs.
- **AI Priority Queue**: EventEmitter-based queue with priority scoring and concurrent request limits.
- **Usage Tracking & Billing**: 100% cost coverage for AI tokens, storage, deployment bandwidth, and infrastructure, with Stripe metered billing. Comprehensive token tracking attributes costs to the correct organization/user with model-aware pricing.
- **Monetization Infrastructure**: Lead capture, Stripe subscription system, webhooks, granular usage billing, and template marketplace commission model.
- **Security & Production Readiness**: Full authentication/authorization (Replit Auth, PostgreSQL sessions), protected API routes, rate limiting, and bcrypt-hashed API keys.
- **Deployment & Hosting System**: Supports public hosting of deployed projects under unique subdomains.
- **LomuAI Security**: Robust authentication/authorization, dedicated LomuAI identity for git operations.
- **Parallel Subagent Queue**: FIFO queue with per-user concurrency limits, memory accounting, WebSocket progress broadcasting, automatic cleanup, and task cancellation support.

### Production Security Hardening
**Comprehensive RCE Prevention:**
- **Terminal Security**: Owner-only access with command allow-listing, workspace jailing, path sanitization, and command validation.
- **BuildService npm Script Sanitization**: ONLY `build` script permitted; all other scripts blocked.
- **Resource Caps**: 256MB RAM limit, 5-minute build timeout, per-user concurrent build limits (max 2), rate limiting (5 deployments/hour).
- **Git Token Encryption**: Git repository access tokens are encrypted at rest using AES-256-GCM.

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI, next-themes
- **Backend**: Express.js, WebSocket
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **AI**: Anthropic Claude Sonnet 4 (primary), OpenAI (gpt-image-1)
- **Deployment**: Render.com, Railway
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API