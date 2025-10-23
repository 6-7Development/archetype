# Archetype - AI-Powered Website Builder Platform

## Overview
Archetype is an AI-powered platform for rapid web development, featuring an AI coding agent (SySop) for autonomous code generation and an IDE Workspace. It offers a console-first interface, real-time preview, and a tab-based workspace. The platform includes comprehensive monetization infrastructure with subscription tiers, usage-based billing, a template marketplace, and professional development services. A subsidiary of Drill Consulting 360 LLC, Archetype targets Fortune 500 production readiness and fully portable deployment to any cloud platform. It also features Meta-SySop for autonomous platform self-healing, bug fixes, and UI/UX improvements to its own source code on Render production, with built-in rollback and audit logging.

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

## Recent Changes
### Performance Optimizations (October 2025)
- **Critical Performance Fixes**: Eliminated extreme lag issues through comprehensive optimizations
  - **LRU Caching Layer**: In-memory cache (max 1000 entries) for users, projects, subscriptions, and API responses with configurable TTLs (5-300s)
  - **System Prompt Caching**: Moved 4,602-char base prompt to module level, saving ~4KB per AI request
  - **Response Compression**: Gzip middleware reduces response sizes by 70-80%
  - **WebSocket Memory Leak Fix**: Added error handlers, ping/pong heartbeat (30s), and periodic cleanup of dead connections
  - **Response Caching Middleware**: 5-second cache on hot endpoints (/api/auth/user) with proper cache invalidation
  - All optimizations architect-reviewed and production-ready

### Production Bug Fixes (October 2025)
- **Chat Progress Indicators**: Implemented real-time WebSocket broadcasting to show what SySop is doing during chat conversations
  - Progress messages display tool execution ("Reading file...", "Updating file...", "Modified 3 files")
  - Clear error handling and progress cleanup on completion/failure
  - Tested with Playwright - all tests passing
- **Platform Modification Guardrails**: Added production safety checks for Meta-SySop platform healing
  - **CRITICAL**: Platform file modifications are DISABLED in production (Render)
  - Render uses ephemeral containers - file changes are lost on restart
  - Clear error messages guide users to use local development for platform modifications
  - Reading platform files still works in production for diagnostics
- **Image Upload Directory Creation**: Fixed ENOENT errors by ensuring `attached_assets/chat_images/` directory exists with recursive mkdir before writing files
- **Robust JSON Parsing Pipeline**: Implemented string-aware brace tracking to handle SySop responses with emoji prefixes (🧠🔨✅), literal braces in strings, and stray closing braces in preamble
  - 3-tier extraction: Code fences → String-aware brace tracking → Fallback regex
  - Edge cases handled: Escaped quotes, negative depth guard, largest object selection
  - All edge cases tested and architect-approved
- **Max Tokens Optimization**: Clarified Claude Sonnet 4 already at API maximum (8192 output tokens) for optimal response generation

### Multi-Agent Task Management System (October 23, 2025)
- **Replit Agent-Style Capabilities**: Built foundation for autonomous task breakdown, sub-agent delegation, and architect reviews
  - **Database Schema**: New tables for task_lists, tasks, sub_agents, architect_reviews
  - **Six New SySop Tools**: 
    - `create_task_list` - Break down complex requests into structured tasks
    - `update_task` - Track progress and mark tasks complete
    - `read_task_list` - Query task status and details
    - `spawn_sub_agent` - Delegate specialized work to sub-agents
    - `check_sub_agent_status` - Monitor sub-agent progress
    - `request_architect_review` - Get proactive improvement suggestions
  - **Production-Grade Security**: 4 rounds of architect review iterations
    - Cross-tenant isolation with joined ownership queries
    - Project/task/taskList ownership verification on all operations
    - Schema validation with Drizzle Zod
    - Enum validation for status/agentType fields
    - Transactional safety with graceful error handling
  - **Remaining Integration**: API endpoints, frontend components, WebSocket broadcasting, system prompt updates, and end-to-end testing

### Mobile & Diagnostics Enhancements (October 23, 2025)
- **Mobile-Responsive File Explorer**: Implemented Sheet overlay for mobile devices
  - File explorer hidden by default on mobile (<768px viewport)
  - Hamburger menu button in workspace header toggles overlay
  - Auto-closes on file selection for seamless mobile UX
  - Desktop view unchanged (sidebar always visible)
- **Enhanced SySop Diagnostic Tool**: Added comprehensive `perform_diagnosis` capability
  - **Security-first implementation**: Multiple architect review cycles to eliminate command injection vulnerabilities
  - **Path validation**: Rejects absolute paths, shell metacharacters, protects sensitive files (.env, .git, database/)
  - **Evidence-based analysis**: Reads actual file content, counts lines, detects patterns
  - **Diagnostic targets**: Performance (sync ops, large files), Memory (leak detection), Database (N+1 queries), Security (hardcoded secrets, SQL injection)
  - **Safe Node.js APIs**: Uses fs.readFile, fs.stat instead of shell commands
  - **Workspace boundary enforcement**: Proper directory separation checks prevent path traversal

## System Architecture
The platform is built with a React frontend, an Express.js backend, and PostgreSQL for data persistence.

### UI/UX Decisions
The user interface features a tab-based workspace (Overview, Build, Files, Preview, Activity, Versions) providing an IDE-like experience. Interaction is primarily through a command console, complemented by a real-time live preview. The design adopts a professional, corporate aesthetic with a navy/slate color palette, card-based layouts, and smooth transitions, ensuring responsiveness and ADA/WCAG accessibility with `prefers-reduced-motion` support. The chat interface is redesigned with a clean, minimal aesthetic, including enhanced progress displays with individual animated progress bars and completion summaries.

### Technical Implementations
- **AI Architecture**: SySop (AI Coding Agent) uses a 12-step workflow with built-in Architect consultation for architectural validation. It includes real-time AI streaming with abort capability and comprehensive billing for AI usage.
- **Enhanced SySop System Prompt**: Optimized for high quality through a 14-step workflow, improved JSON formatting, and expertise in full-stack web, professional games, self-testing, and Orb usage-based billing.
- **Professional Communication**: SySop uses teaching emojis (🧠🔨✅), an "explain like I'm 5" approach, step-by-step updates, and transparent issue reporting, with a human and conversational personality.
- **Autonomous AI System**: SySop is equipped with self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), and architectural guidance. It features an automatic reflection loop, a server-side self-correction protocol, and autonomous troubleshooting. Human intervention points are defined for API keys, ambiguous requirements, and after failed fix attempts.
- **GitHub Integration for Platform Modifications**: Owner-controlled maintenance mode allows SySop to commit platform changes directly to GitHub on production. When enabled, platform file modifications create GitHub commits that trigger Render auto-deployment, solving ephemeral filesystem limitations. Requires GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH environment variables and owner authentication.
- **Secrets Management**: Zero-knowledge credential handling for API keys.
- **Advanced AI Capabilities**: SySop can build complex marketplace platforms, professional-grade 2D/3D games, implement Orb usage-based billing, self-test, search documentation, and analyze visuals (including pasted screenshots).
- **Command System**: Natural language commands are processed by Anthropic Claude 3.5 Sonnet to generate project structures as JSON.
- **File Management**: Generated files are stored in PostgreSQL, viewable and editable via a file browser and Monaco editor.
- **Conversational AI**: An AI assistant powered by Claude 3.5 Sonnet clarifies questions and explains design decisions, with automatic conversation summarization for memory optimization.
- **Preview System**: Uses `esbuild` for in-memory React/TypeScript compilation to show actual compiled/running applications in an iframe, with real-time status and auto-refresh.

### Feature Specifications
- **Tab-Based Workspace**: Navigation with Overview, Build, Files, Preview, Activity, and Versions tabs.
- **Unified Talk & Build Interface**: Combines AI chat and command execution with split-pane layout showing chat and files simultaneously.
- **Monaco Editor**: Integrated for code preview and editing, with a compact mode for inline viewing.
- **Project Download**: Full project ZIP export.
- **Publishing/Deployment System**: Full Publishing page with mobile-responsive design, database migration detection, deployment management, logs, and analytics.
- **Team Workspaces**: Collaboration infrastructure with role-based access, member invitations, and shared project access.
- **API Key Management**: Secure API key system for Pro+ users with bcrypt hashing, usage tracking, and validation middleware.
- **Support Ticketing**: Complete support ticket system with subject, description, priority levels, status tracking, and plan-based SLA response times.
- **Priority Processing Queue**: AI request prioritization system with concurrent request limits.
- **Real-Time Cost Preview**: Estimated tokens and cost displayed before generation with automatic complexity detection.
- **Usage Dashboard**: Real-time token usage tracking with detailed breakdowns and overage alerts.
- **Token-Based Pricing Model**: V3.0 sustainable pricing with competitive overage rates and transparent cost structure.

### System Design Choices
- **Database Architecture**: Comprehensive PostgreSQL schema for projects, commands, files, subscriptions, usage logs, templates, version control, team workspaces, API keys, and support tickets.
- **Team Collaboration System**: Role-based access control with invitation system.
- **API Key Infrastructure**: Secure key generation with bcrypt hashing and usage tracking.
- **Support Ticketing System**: Complete ticket lifecycle with priority levels and plan-based SLAs.
- **AI Priority Queue**: EventEmitter-based queue with priority scoring and concurrent request limits.
- **Usage Tracking & Billing**: 100% cost coverage tracking AI tokens, storage, deployment bandwidth, and infrastructure, with Stripe metered billing for overages.
- **Monetization Infrastructure**: Includes lead capture, Stripe subscription system, webhook handling, granular usage billing, and a template marketplace commission model.
- **Security & Production Readiness**: Full authentication/authorization with Replit Auth, PostgreSQL sessions, protected API routes, rate limiting, and bcrypt-hashed API keys.
- **Deployment & Hosting System**: Supports public hosting of deployed projects under unique subdomains with status and visit tracking.
- **Meta-SySop Security**: Robust authentication/authorization, git operations with dedicated Meta-SySop identity, and comprehensive security measures to prevent shell injection, path traversal, and protect sensitive files during autonomous platform healing.

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI, next-themes
- **Backend**: Express.js, PostgreSQL (Neon), WebSocket, esbuild
- **Database ORM**: Drizzle ORM
- **AI**: Anthropic Claude 3.5 Sonnet
- **Deployment**: Render.com, Railway, or Docker
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API
```