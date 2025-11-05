# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring an AI coding agent (LomuAI) for autonomous code generation and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A core capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging.

## User Preferences
### API Configuration
**Claude Sonnet 4 Unified Strategy (Nov 5, 2025)**:
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
- **Platform Healing System**: Complete self-healing infrastructure with 3-tier intelligent routing for incident resolution: Tier 1 (Knowledge Base Auto-Fix), Tier 2 (LomuAI v2.0/Claude Sonnet 4), and Tier 3 (I AM Architect/Claude Sonnet 4). Automatic response quality monitoring triggers I AM Architect for autonomous diagnosis and fixes when quality is low. Platform Healing chat interface uses Claude with 3 tools (read/write/search platform files).
- **LomuAI v2.0 Workflow Enforcement**: Achieves Replit Agent behavioral parity through dual-layer enforcement: an enhanced system prompt with strict 7-phase workflow rules and a WorkflowValidator State Machine for programmatic runtime enforcement.
- **Real-Time Enforcement System**: A 6-layer real-time enforcement system fully integrated into lomuJobManager validates LomuAI responses and triggers I AM Architect guidance when violations occur.
- **Real-Time LomuAI + I AM Teamwork**: I AM Architect intervenes during active LomuAI sessions when workflow rules are violated, injecting corrective guidance. A "3-Strikes Escalation" policy automatically escalates jobs to I AM Architect for complete takeover after three failed guidance attempts.
- **Critical Files Protection System**: Implemented read-before-write enforcement for 8 core infrastructure files (server/index.ts, server/routes.ts, server/db.ts, server/vite.ts, package.json, drizzle.config.ts, vite.config.ts, shared/schema.ts) with file size change detection to prevent accidental overwrites.
- **Critical Bug Chain Resolution (Nov 5, 2025)**: Fixed 3 interconnected bugs preventing LomuAI from functioning:
  1. **Tool Name Mismatch** ([commit 463990f](https://github.com/6-7Development/archetype/commit/463990f36efcd03de2cf6e01e8c2e7bc0234bab1)): System prompt told LomuAI to call `createTaskList()` (camelCase) but actual tool was `create_task_list()` (snake_case) → silent failures → no task lists created. Fixed in server/lomuSuperCore.ts.
  2. **Phase Transition Blocking** ([commit 39bc896](https://github.com/6-7Development/archetype/commit/39bc896cebb3aa44aedb927e20bb81cd63a47162)): Two competing WorkflowValidator classes used different case (lowercase 'plan' vs uppercase 'PLAN') → ALL phase transitions failed → tools blocked → zero mutations → token waste. Fixed case mismatch in server/services/lomuJobManager.ts by converting detected phases to uppercase.
  3. **Raw HTML in Chat UI**: Enhanced frontend filter in client/src/pages/platform-healing.tsx to remove leaked HTML/JSX tags, escaped newlines, and JSON fragments from chat responses.
  
  **Combined Impact**: Task lists now work, phase transitions succeed, tools execute properly, and chat UI is clean with no raw code leaking.
- **Claude Migration (Nov 5, 2025)**: Switched ALL AI operations from Gemini to Claude Sonnet 4 for reliable tool execution:
  - ✅ **LomuAI Chat**: Migrated from Gemini to Claude in server/routes/lomuChat.ts (line 1362)
  - ✅ **Platform Healing**: Migrated from Gemini to Claude in server/routes/healing.ts (lines 161, 238, 443)
  - ✅ **Platform Healing UI Fix**: Added metadata filter to hide internal tool messages (client/src/pages/platform-healing.tsx line 665)
  - Gemini was hallucinating Python syntax when calling tools: `print(default_api.create_task_list(...))` - Claude provides reliable JSON tool execution
- **🎯 TRUE Replit Agent Parity Achieved (Nov 5, 2025)**: LomuAI now matches Replit Agent's 30+ iteration complex task handling capability:
  - **Extended Iteration Limits**: Intent-based limits increased to production-grade levels:
    - BUILD: 35 iterations (up from 25) - Full feature development with testing and refinement
    - FIX: 30 iterations (up from 20) - Thorough debugging, fixes, and verification
    - DIAGNOSTIC: 30 iterations (up from 15) - Deep investigation and comprehensive analysis
    - CASUAL: 5 iterations - Don't waste tokens on small talk
  - **Removed Artificial Stopping**: Set MAX_READ_ONLY_ITERATIONS to 999 (was 20) - no more premature "investigation-only loop" halting
  - **Multi-Pass Scoring System**: Weighted scoring across all intent categories with flexible pattern matching
  - **Token Explosion Prevention**: Intelligent tool output truncation (max 50KB per tool result) with smart summarization
  - **Context Management**: Aggressive warnings at 80/90% token limits with automatic truncation integration
  - **Build-First Defaults**: Unknown requests default to BUILD (35 iterations) instead of DIAGNOSTIC to prevent throttling
  - **Priority Tie-Breaking**: When scores are equal, prefer build > fix > diagnostic > casual
  - **Applied Universally**: Both Platform Healing (lomuChat.ts) and regular LomuAI (lomuJobManager.ts) use identical limits
  - **Verified Persistence**: System now handles 30+ step tasks without crashing or giving up prematurely
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
- **AI**: Anthropic Claude Sonnet 4 (primary), OpenAI (gpt-image-1), Google Gemini 2.5 Flash (deprecated until tool reliability fixed)
- **Deployment**: Render.com, Railway
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API