# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform designed for rapid web development, featuring LomuAI, an autonomous AI coding agent, and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A key capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging.

**CRITICAL ARCHITECTURE**: LomuAI is the sole autonomous worker that commits changes. I AM Architect is a user-summoned consultant only (paid usage), never automatically invoked.

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
- **AI Architecture**: LomuAI v2.0 follows a strict 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT) with programmatic enforcement. It includes real-time streaming, usage-based billing, self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), and an automatic reflection/self-correction loop.
- **Autonomous AI System (LomuAI v2.0)**: LomuAI is the PRIMARY autonomous worker that diagnoses issues, implements fixes, and automatically commits changes to GitHub, triggering auto-deployment. Works independently without requiring architect approval.
- **I AM Architect Role**: Optional expert consultant (premium paid feature) that users can explicitly summon for complex architectural decisions. NEVER auto-triggered - user-summoned only. Provides guidance but does not commit code.
- **LomuAI ↔ I AM Architect Relationship**:
  - **LomuAI**: Primary autonomous worker, commits code, handles all standard development tasks
  - **I AM Architect**: Senior overseer, provides strategic guidance when LomuAI consults (premium paid feature)
  - **Consultation Pattern**: LomuAI decides when to ask (after failed attempts or architectural risk), not automatic
  - **I AM Deliverables**: Structured guidance with Analysis, Recommendations, Risk Assessment, Acceptance Criteria, and Testing Strategy
  - **Implementation**: LomuAI implements I AM's recommendations; I AM provides strategy only
  - **Telemetry**: All consultations logged to `architect_consultations` table with timestamp, question, rationale, guidance, tokens used, and billed to user
  - **Tool**: `consult_architect` tool available to LomuAI with required fields: question, context, rationale, optional relevant_files
  - **Rate Limiting**: Soft limit to prevent overuse of premium feature
- **Developer Tools**: LomuAI includes 62+ tools covering core operations, deployment, secrets management, database, design, integrations, and file operations, all with security sandboxing and WebSocket event streaming.
- **Code Intelligence System** (Implemented Nov 6, 2025): AST-based code understanding that rivals Cursor/Windsurf:
  - **CodeIndexer Service**: Parses JavaScript/TypeScript files with Babel AST to extract imports, exports, functions, classes, types, and build dependency graphs. Stores metadata in `fileIndex` table for instant retrieval.
  - **FileRelevanceDetector**: Auto-detects related files when user mentions code - includes direct dependencies, dependents, test files, schemas, and siblings with priority scoring (0-10). Reduces manual file specification.
  - **SmartChunker**: Token-efficient code retrieval - extracts only relevant functions/classes instead of entire files. Provides file summaries (imports + exports + signatures) without reading full content. Saves 70-80% tokens.
  - **Smart Tools**: 6 new intelligence tools - `indexFile`, `smartReadFile`, `getRelatedFiles`, `extractFunction`, `getAutoContext`, `getFileSummary`
  - **Natural Language File Detection**: Extracts file paths from user messages automatically
  - **Database**: `file_index` table with comprehensive metadata (imports, exports, functions, classes, complexity, dependencies)
- **Platform Healing System**: A self-healing infrastructure with **2-tier intelligent routing** for incident resolution: TIER 1 (Knowledge Base) → TIER 2 (LomuAI v2.0). I AM Architect removed from auto-routing - user can manually request architect consultation if needed.
- **LomuAI v2.0 Workflow Enforcement**: Dual-layer enforcement via enhanced system prompts and a WorkflowValidator State Machine.
- **Critical Files Protection System**: Read-before-write enforcement for 8 core infrastructure files to prevent accidental overwrites.
- **Replit Agent Parity**: LomuAI matches Replit Agent's complex task handling with production-optimized configuration (as of Nov 6, 2025):
  - **Token Management**: 8,000 tokens/action (up from 3,500) - utilizes Claude's 200K context for complex reasoning
  - **Iteration Limits**: 35 iterations for build tasks, 30 for fix/diagnostic, 5 for casual conversations
  - **Self-Correction**: 3-level reflection depth (up from 2) for robust autonomous fixes
  - **Concurrency**: 3 concurrent AI requests, 2 parallel subagents/user (with 120MB memory budget)
  - **Timeouts**: 8min AI requests, 5min streaming, 10min WebSocket - optimized for complex multi-step tasks
  - **Auto-Commits**: Automatic GitHub integration with Railway deployment triggers
  - **Note**: Further concurrency increases require runtime memory monitoring and auto-throttling
- **Command System**: Natural language commands processed by Anthropic Claude 3.5 Sonnet to generate JSON project structures.
- **File Management**: Generated files are stored in PostgreSQL, editable via Monaco editor, with real-time WebSocket synchronization.
- **Preview System**: Uses `esbuild` for in-memory React/TypeScript compilation for live application previews.
- **Multi-Agent Task Management System**: Foundation for autonomous task breakdown with database tables and LomuAI tools, supporting sub-agents, message queues, autonomy controls, and dynamic intelligence.

### Feature Specifications
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Management of deployments, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access and invitations.
- **API Key Management**: Secure system for Pro+ users with hashing, usage tracking, and validation.
- **Support Ticketing**: Complete system with subject, description, priority, status, and plan-based SLA.
- **AI Request Management**: Priority processing queue with concurrent limits, real-time cost preview, usage dashboard, token-based pricing, and parallel subagent execution.
- **Advanced AI Development Features**: Includes Sub-Agent/Task Runner System, Message Queue, Autonomy Controls, AI Image Generation, Dynamic Intelligence, Plan Mode, Design Mode, Workflows, Agents & Automations, and a General Agent Mode.
- **Credit-Based Billing System**: Production-ready monetization with usage-based credits (implemented Nov 6, 2025):
  - **Credit Economics**: 1 credit = 1,000 tokens = $0.05 (72% margin covers API costs + infrastructure)
  - **Credit Packages**: 5K ($2.50), 25K ($11.25), 100K ($40), 500K ($187.50)
  - **Enforcement**: Card-on-file required for agent usage (402 response if missing), middleware validates payment before agent starts
  - **Atomic Operations**: Reserve/reconcile credits with SQL guards prevent race conditions and credit leaks
  - **Pause/Resume Flow**: Agents pause mid-stream when credits depleted, save full context (messages, tasks, files) to database, auto or manual resume after credit purchase
  - **Owner Privileges**: Platform owner gets FREE I AM Architect for platform healing and owner projects (creditsReserved = 0), usage logged with owner_exempt metadata
  - **AI Model Selection**: Users choose between Claude Sonnet 4 ($3.00/$15.00 per 1M tokens) and Gemini 2.5 Flash (cheaper alternative when available)
  - **Frontend Components**: Global credit balance widget in header (all pages), credit purchase modal with Stripe integration, agent paused banner with resume button
  - **Backend Services**: CreditManager (reserve/reconcile/add/balance), AgentExecutor (startRun/pauseRun/resumeRun/completeRun), credit purchase API
  - **Database Schema**: creditWallets (availableCredits, reservedCredits), creditLedger (immutable transaction log), agentRuns (pause/resume state with context JSONB)
  - **Error Recovery**: Credits properly reconciled even on agent crashes or errors (catch/finally blocks in streaming loop)
  - **Real-Time Updates**: Credit balance refreshes every 10 seconds, low credit warnings (< 1000 credits), SSE events for pause notifications

### System Design Choices
- **Database Architecture**: Comprehensive PostgreSQL schema with Drizzle ORM.
- **Team Collaboration System**: Role-based access control with an invitation system.
- **API Key Infrastructure**: Secure key generation with bcrypt hashing and usage tracking.
- **Support Ticketing System**: Complete ticket lifecycle with priority levels and plan-based SLAs.
- **AI Priority Queue**: EventEmitter-based queue with priority scoring and concurrent request limits.
- **Usage Tracking & Billing**: 100% cost coverage for AI tokens, storage, deployment bandwidth, and infrastructure, with Stripe metered billing and model-aware pricing.
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
- **AI**: Anthropic Claude Sonnet 4, OpenAI (gpt-image-1)
- **Deployment**: Render.com, Railway
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API