# Lomu - "When Code Throws You Lemons"

## Overview
**Tagline**: "When code throws you lemons, you get Lomu"  
**Mission**: The SaaS platform made to make life sweet

Lomu is an AI-powered platform for rapid web development, featuring an AI coding agent (SySop) for autonomous code generation and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features with a fresh, optimistic aesthetic. Lomu aims for production readiness with fully portable deployment, incorporating monetization infrastructure, a template marketplace, and professional development services. A key feature is LomuAI, an autonomous system for platform self-healing, bug fixes, and UI/UX improvements to its own source code, complete with rollback and audit logging.

**Mascot**: Lumo the Lemon - An animated pixel art lemon with red goggles and a tech aesthetic, serving as your cheerful AI coding buddy with 9 emotional states (happy, excited, thinking, working, success, error, worried, sad, idle).

## User Preferences
### API Configuration
- Using Claude 3.5 Sonnet (Anthropic) for AI code generation
- API key configured via ANTHROPIC_API_KEY environment variable
- Model: claude-sonnet-4-20250514 (latest Sonnet 4)
- Superior code quality compared to GPT-4

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

### Dual-Version Architecture (Lomu + Lomu5)
The platform uses a unified codebase to support two distinct user experiences: Lomu (Desktop) with a 4-panel layout, and Lomu5 (Mobile) with bottom tab navigation. Both versions share backend APIs, WebSocket connections, authentication, and database access.

### UI/UX Decisions
The user interface features a tab-based workspace (Overview, Build, Files, Preview, Activity, Versions) providing an IDE-like experience, primarily through a command console and real-time live preview. The design emphasizes a fresh, optimistic aesthetic with a citrus-inspired color palette (Sparkling Lemon, Fresh Mint, Citrus Bloom), card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces feature Lumo the Lemon mascot as an AI companion with natural sprite animations and emotional expressions. Loading states use the signature lemonade jar animation with liquid fill, bubbles, and ice cubes. New additions include a visible image attachment toolbar in the AI chat interface, Resume/Cancel controls for LomuAI jobs, and the animated Lumo avatar system. A real-time deployment status widget tracks GitHub commits and LomuAI's autonomous updates.

### Technical Implementations
- **AI Architecture**: SySop (AI Coding Agent) follows a 12-step workflow with Architect consultation, real-time streaming, and usage-based billing, optimized for full-stack web and professional games.
- **Replit Agent-Style Task Management**: Live, interactive task lists with real-time status updates are displayed via a TaskBoard UI component, driven by WebSocket updates.
- **Autonomous AI System**: SySop integrates self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), architectural guidance (I AM), and an automatic reflection/self-correction loop. LomuAI includes enhanced tools like `architect_consult`, `web_search`, and `commit_to_github`.
- **LomuAI Autonomous Deployment**: LomuAI diagnoses issues, consults I AM for approval, implements fixes, and automatically commits changes to GitHub, triggering auto-deployment. It operates in an action-oriented manner, prioritizing tool execution and code writing, with mechanisms to prevent analysis paralysis.
- **LomuAI Background Job System**: Implemented a PostgreSQL-backed job queue for indefinite asynchronous execution, overcoming SSE timeout issues. Features include WebSocket broadcasting for real-time UI, resume capability for interrupted sessions, and complete checkpointing.
- **LomuAI Token Optimization** (Oct 29, 2025): Aggressive token reduction to prevent excessive API costs and 200K token limit errors. Chat history reduced from 100→10 messages (~40K tokens saved), ultra-condensed platform knowledge (~2K saved), minimal memory summaries (~3K saved), deployment awareness removed (~2K saved). **Total savings: ~47K tokens per request**, making LomuAI sustainable for production use. System now maintains conversation context efficiently while staying well under Anthropic's limits.
- **LomuAI Intimate Platform Knowledge System** (Oct 28, 2025): Complete context awareness combining bounded conversation history (10 messages optimized for tokens), condensed platform architecture knowledge, comprehensive bug/fix tracking, and conversational personality. LomuAI has intimate understanding of:
    - Recent conversation with user (goals, issues, fixes, completed work)
    - Complete Lomu platform architecture (SySop, healing system, database, deployment)
    - Recent bugs fixed and features built
    - Technical implementation details and file structure
    - **Full replit.md access**: Can read/write platform documentation using readPlatformFile/writePlatformFile tools
  System uses aggressive token optimization (10 messages + ultra-condensed prompts) preventing API failures while maintaining essential context. LomuAI references knowledge naturally: "I remember when..." or "Let me check the platform healing system...".
- **Lumo Avatar System** (Oct 30, 2025): Animated lemon mascot with 9 emotion states using sprite sheet animations (1024×1024 PNG files, 4×2 grid, 256×256 frames). Features natural breathing animation with continuous sine wave, varied frame timing for organic feel, pre-rendered frame buffers to prevent sprite bleed, animated background with pulsing glow and orbiting particles, and rotating outer ring border effect. Appears in SySop and LomuAI chat interfaces as a coding companion.
- **Lemonade Jar Loader** (Oct 30, 2025): SVG-based loading animation featuring a glass jar with animated yellow lemonade fill (0-100%), floating bubble particles with varied animation timing, rotating ice cubes that appear at >20% progress, lemon slice garnish at >50%, glass shine effects, red bendy straw decoration, and celebratory sparkles at 100% completion. Used throughout the platform for loading states.
- **Platform Healing System**: Real-time system monitoring with WebSocket-based metrics broadcasting (CPU, memory, health, incidents, uptime, git status), a theme-aware UI, and auto-commit/auto-push toggles.
- **Advanced AI Capabilities**: SySop can build complex marketplace platforms, 2D/3D games, implement usage-based billing, generate test data, simulate user behavior, and create functional chatbots/automation agents.
- **Command System**: Natural language commands are processed by Anthropic Claude 3.5 Sonnet to generate JSON project structures.
- **File Management**: Generated files are stored in PostgreSQL, editable via Monaco editor, with real-time WebSocket synchronization.
- **Conversational AI**: AI assistant clarifies questions and explains design decisions with automatic summarization.
- **Preview System**: Uses `esbuild` for in-memory React/TypeScript compilation to show applications in an iframe with real-time status and auto-refresh.
- **Performance Optimizations**: Includes LRU caching, system prompt caching, Gzip compression, WebSocket memory leak fixes, and response caching.
- **Robust JSON Parsing Pipeline**: A 3-tier extraction method for complex JSON structures from AI responses.
- **Multi-Agent Task Management System**: Foundation for autonomous task breakdown with database tables and SySop tools.
- **SySop Diagnostic Tool**: Enhanced `perform_diagnosis` for security-first, evidence-based diagnostics.

### Feature Specifications
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Publishing page with mobile-responsive design, database migration detection, deployment management, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access, invitations, and shared project access.
- **API Key Management**: Secure API key system for Pro+ users with hashing, usage tracking, and validation.
- **Support Ticketing**: Complete system with subject, description, priority, status, and plan-based SLA.
- **AI Request Management**: Priority processing queue with concurrent limits, real-time cost preview, usage dashboard, and token-based pricing.
- **Replit Agent-Style Features**: Full implementation of advanced AI development features including:
    - **Sub-Agent/Task Runner System**: Parallel task execution with worker pool management.
    - **Message Queue**: Smart request queueing for follow-up tasks.
    - **Autonomy Controls**: Four-tier autonomy system controlling AI agent permissions.
    - **AI Image Generation**: Integration with OpenAI's gpt-image-1.
    - **Dynamic Intelligence**: Extended thinking mode for complex problems.
    - **Plan Mode**: Brainstorming and planning without code modification.
    - **Design Mode**: Visual prototyping and design system builder.
    - **Workflows**: Parallel and sequential command execution engine.
    - **Agents & Automations**: Template marketplace for bots, scheduled tasks, and webhooks.
    - **General Agent Mode**: Multi-project-type support beyond web apps.
    - **Agent Features Dashboard**: Unified `/agent-features` page with multiple feature tabs.

### System Design Choices
- **Database Architecture**: Comprehensive PostgreSQL schema.
- **Team Collaboration System**: Role-based access control with an invitation system.
- **API Key Infrastructure**: Secure key generation with bcrypt hashing and usage tracking.
- **Support Ticketing System**: Complete ticket lifecycle with priority levels and plan-based SLAs.
- **AI Priority Queue**: EventEmitter-based queue with priority scoring and concurrent request limits.
- **Usage Tracking & Billing**: 100% cost coverage for AI tokens, storage, deployment bandwidth, and infrastructure, with Stripe metered billing.
- **Monetization Infrastructure**: Lead capture, Stripe subscription system, webhooks, granular usage billing, and template marketplace commission model.
- **Security & Production Readiness**: Full authentication/authorization (Replit Auth, PostgreSQL sessions), protected API routes, rate limiting, and bcrypt-hashed API keys.
- **Deployment & Hosting System**: Supports public hosting of deployed projects under unique subdomains.
- **LomuAI Security**: Robust authentication/authorization, dedicated LomuAI identity for git operations.
- **Production Owner Access**: LomuAI requires owner designation via `is_owner = true` or `OWNER_USER_ID` environment variable.

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