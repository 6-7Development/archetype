# Archetype - AI-Powered Website Builder Platform

## Overview
Archetype is an AI-powered platform for rapid web development, featuring an AI coding agent (SySop) for autonomous code generation and dual-version IDE Workspaces. The platform includes **Archetype** (desktop-optimized) and **Archetype5** (mobile-optimized) versions that share backend resources while providing tailored UX. Both versions offer a console-first interface, real-time preview, and comprehensive workspace features. Archetype targets Fortune 500 production readiness and fully portable deployment to any cloud platform, incorporating monetization infrastructure, a template marketplace, and professional development services. It also features Meta-SySop for autonomous platform self-healing, bug fixes, and UI/UX improvements to its own source code, with built-in rollback and audit logging.

## User Preferences
### API Configuration
- Using Claude 3.5 Sonnet (Anthropic) for AI code generation
- API key configured via ANTHROPIC_API_KEY environment variable
- Model: claude-sonnet-4-20250514 (latest Sonnet 4)
- Superior code quality compared to GPT-4

### Design Preferences
- Fortune 500 corporate aesthetic
- Professional enterprise design system
- Navy blue and slate gray color palette
- Card-based layouts with sophisticated shadows and elevation
- Clean, minimalist interface with generous spacing
- Professional Inter font family for UI
- Dark mode with enterprise-grade polish
- Subtle micro-interactions and hover effects

## System Architecture
The platform is built with a React frontend, an Express.js backend, and PostgreSQL for data persistence.

### Dual-Version Architecture (Archetype + Archetype5)
The platform implements a unified codebase with two distinct user experiences: Archetype (Desktop) with a 4-panel layout, and Archetype5 (Mobile) with bottom tab navigation, optimized for touch. Both versions share a single codebase, backend APIs, WebSocket connections, authentication, and database access, with runtime detection for version switching.

### UI/UX Decisions
The user interface features a tab-based workspace (Overview, Build, Files, Preview, Activity, Versions) providing an IDE-like experience, primarily through a command console and real-time live preview. The design adopts a professional, corporate aesthetic with a navy/slate color palette, card-based layouts, smooth transitions, and ADA/WCAG accessibility. Chat interfaces are clean, minimal, with enhanced progress displays, fixed mobile layout issues, and proper scroll behavior. Collapsible preview panels and enlarged chat input areas improve usability.

**Chat Input Enhancements** (Oct 28, 2025): Added visible image attachment toolbar to AI chat interface. Previously, image upload was only available via paste (Ctrl+V), with no visible UI button. Now includes ChatInputToolbar component with image icon button positioned inside textarea (bottom-right corner), supporting multi-file selection, format validation (JPG/PNG/GIF/WebP), and 5MB size limit per image. Meta-SySop chat intentionally excludes image upload as it focuses on platform maintenance tasks.

### Technical Implementations
- **AI Architecture**: SySop (AI Coding Agent) employs a 12-step workflow with Architect consultation, real-time streaming, and comprehensive billing. It's optimized for full-stack web, professional games, self-testing, and usage-based billing.
- **Replit Agent-Style Task Management**: Live, interactive task lists with real-time status updates are displayed via a TaskBoard UI component, driven by WebSocket updates and robust JSON parsing.
- **Autonomous AI System**: SySop integrates self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), architectural guidance (I AM), and an automatic reflection/self-correction loop. Meta-SySop has enhanced tools including `architect_consult`, `web_search`, and `commit_to_github`.
- **Meta-SySop Autonomous Deployment**: Meta-SySop operates with full autonomy – it diagnoses issues, consults I AM for approval, implements fixes, and automatically commits changes to GitHub triggering Railway auto-deployment. Changes are pushed via GitHub API from Replit development environment.
- **Meta-SySop Action-Oriented Design** (Oct 28, 2025): Meta-SySop rebuilt to work EXACTLY like Replit Agent - action-oriented (tools first, explanations second), with zero blocking validations, natural workflow, and full autonomy. System prompt emphasizes immediate tool execution over conversation, preventing "Let me..." talk without actual work. All anti-lying validations, out-of-order task blocking, and micromanagement forcing messages removed for true autonomous operation.
- **Meta-SySop Background Job System** (Oct 28, 2025): FIXED Railway SSE timeout issue by implementing complete background job architecture. Replaced 2-minute SSE connection limit with unlimited async execution using PostgreSQL-backed job queue. Jobs run indefinitely without HTTP timeout, with conversation state persisted every 2 iterations to `metaSysopJobs` table. Features: (1) WebSocket broadcasting for real-time UI updates, (2) Resume capability for interrupted sessions, (3) Single job per user enforcement, (4) Complete checkpoint system with taskListId tracking, (5) Production-ready with proper auth (authenticated users only). Frontend polls for active jobs and displays resume button for interrupted sessions. Backend endpoints: POST /start (create job), POST /resume/:jobId (continue from checkpoint), GET /job/:jobId (status), GET /active-job (find resumable job).
- **Platform Healing System**: Real-time system monitoring with WebSocket-based metrics broadcasting (5-second intervals), featuring theme-aware UI with full light/dark mode support, RunCard progress tracking, step visualization, auto-commit/auto-push toggles, live CPU/memory monitoring, and full mobile responsiveness. All colors use semantic Tailwind tokens (bg-card, bg-muted, text-foreground, text-muted-foreground) for proper contrast in both themes. Metrics include CPU usage, memory usage, overall health, active incidents, uptime, and git status. Frontend at `/platform-healing` with backend services in `server/services/platformMetricsBroadcaster.ts` and API routes in `server/platformRoutes.ts`.
- **Advanced AI Capabilities**: SySop can build complex marketplace platforms, 2D/3D games, implement usage-based billing, generate test data, simulate user behavior, and create functional chatbots/automation agents.
- **Command System**: Natural language commands processed by Anthropic Claude 3.5 Sonnet to generate JSON project structures.
- **File Management**: Generated files stored in PostgreSQL, editable via Monaco editor, with real-time synchronization via WebSockets.
- **Conversational AI**: AI assistant clarifies questions and explains design decisions with automatic summarization.
- **Preview System**: Uses `esbuild` for in-memory React/TypeScript compilation to show applications in an iframe with real-time status and auto-refresh.
- **Performance Optimizations**: Includes LRU caching, system prompt caching, Gzip compression, WebSocket memory leak fixes, and response caching.
- **Robust JSON Parsing Pipeline**: 3-tier extraction method for complex JSON structures from AI responses.
- **Multi-Agent Task Management System**: Foundation for autonomous task breakdown with database tables and SySop tools for task list creation, updates, and reviews.
- **SySop Diagnostic Tool**: Enhanced `perform_diagnosis` for security-first, evidence-based performance, memory, database, and security diagnostics.

### Feature Specifications
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Publishing page with mobile-responsive design, database migration detection, deployment management, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access, invitations, and shared project access.
- **API Key Management**: Secure API key system for Pro+ users with hashing, usage tracking, and validation.
- **Support Ticketing**: Complete system with subject, description, priority, status, and plan-based SLA.
- **AI Request Management**: Priority processing queue with concurrent limits, real-time cost preview, usage dashboard, and token-based pricing.
- **Replit Agent-Style Features**: Full implementation of advanced AI development features achieving 100% Replit Agent feature parity with backend services + frontend UIs. This includes:
    - **Sub-Agent/Task Runner System**: Parallel task execution with worker pool management, supporting parallel/sequential/background modes, with database-backed real-time status.
    - **Message Queue**: Smart request queueing for follow-up tasks with priority-based processing.
    - **Autonomy Controls**: Four-tier autonomy system (Low/Medium/High/Max) controlling AI agent permissions.
    - **AI Image Generation**: Integration with OpenAI's gpt-image-1 model for generating images from prompts.
    - **Dynamic Intelligence**: Extended thinking mode for complex problems, supporting standard and high-power modes.
    - **Plan Mode**: Brainstorming and planning without code modification, with full session management UI.
    - **Design Mode**: Visual prototyping and design system builder with prototype gallery and screen composer.
    - **Workflows**: Parallel and sequential command execution engine with creation forms, execution dashboard, and run history. Enabled by default in development, requires ENABLE_WORKFLOWS env var for production.
    - **Agents & Automations**: Template marketplace for bots, scheduled tasks, and webhooks.
    - **General Agent Mode**: Multi-project-type support beyond web apps (games, mobile apps, CLI tools, APIs, automations).
    - **Visual Editor**: Direct UI element editing in live preview (future implementation).
    - **Agent Features Dashboard**: Unified `/agent-features` page with 6 feature tabs.

### System Design Choices
- **Database Architecture**: Comprehensive PostgreSQL schema for all platform data.
- **Team Collaboration System**: Role-based access control with an invitation system.
- **API Key Infrastructure**: Secure key generation with bcrypt hashing and usage tracking.
- **Support Ticketing System**: Complete ticket lifecycle with priority levels and plan-based SLAs.
- **AI Priority Queue**: EventEmitter-based queue with priority scoring and concurrent request limits.
- **Usage Tracking & Billing**: 100% cost coverage for AI tokens, storage, deployment bandwidth, and infrastructure, with Stripe metered billing.
- **Monetization Infrastructure**: Lead capture, Stripe subscription system, webhooks, granular usage billing, and template marketplace commission model.
- **Security & Production Readiness**: Full authentication/authorization (Replit Auth, PostgreSQL sessions), protected API routes, rate limiting, and bcrypt-hashed API keys.
- **Deployment & Hosting System**: Supports public hosting of deployed projects under unique subdomains.
- **Meta-SySop Security**: Robust authentication/authorization, dedicated Meta-SySop identity for git operations, and comprehensive security measures.
- **Production Owner Access**: Meta-SySop requires owner designation via `is_owner = true` or `OWNER_USER_ID` environment variable.

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI, next-themes
- **Backend**: Express.js, PostgreSQL (Neon), WebSocket, esbuild
- **Database ORM**: Drizzle ORM
- **AI**: Anthropic Claude 3.5 Sonnet, OpenAI (gpt-image-1)
- **Deployment**: Render.com, Railway
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API