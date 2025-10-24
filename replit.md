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

## System Architecture
The platform is built with a React frontend, an Express.js backend, and PostgreSQL for data persistence.

### UI/UX Decisions
The user interface features a tab-based workspace (Overview, Build, Files, Preview, Activity, Versions) providing an IDE-like experience. Interaction is primarily through a command console, complemented by a real-time live preview. The design adopts a professional, corporate aesthetic with a navy/slate color palette, card-based layouts, and smooth transitions, ensuring responsiveness and ADA/WCAG accessibility with `prefers-reduced-motion` support. The chat interface is redesigned with a clean, minimal aesthetic, including enhanced progress displays with individual animated progress bars and completion summaries. Mobile responsiveness for the file explorer is implemented with a Sheet overlay for smaller viewports.

### Technical Implementations
- **AI Architecture**: SySop (AI Coding Agent) uses a 12-step workflow with built-in Architect consultation. It includes real-time AI streaming with abort capability and comprehensive billing for AI usage. The SySop system prompt is optimized for quality and expertise in full-stack web, professional games, self-testing, and Orb usage-based billing. SySop uses teaching emojis (🧠🔨✅), an "explain like I'm 5" approach, step-by-step updates, and transparent issue reporting.
- **Replit Agent-Style Task Management**: SySop now displays live, interactive task lists (1-12 tasks) with real-time status updates, matching Replit Agent's UX exactly. Tasks show checkmarks (✓) for completed, spinning circles (⊙) for in-progress, and empty circles (○) for pending states. TaskBoard UI component displays tasks prominently above chat with progress tracking, sub-agent indicators, and WebSocket-driven live updates. Server-side robust JSON parser extracts task plans from Claude responses using balanced-brace matching and fenced code block detection.
- **Autonomous AI System**: SySop is equipped with self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), and architectural guidance via I AM (The Architect). It features an automatic reflection loop, a server-side self-correction protocol, and autonomous troubleshooting. Human intervention points are defined for API keys, ambiguous requirements, and after failed fix attempts.
- **Meta-SySop Enhanced Tools**: Meta-SySop now has access to architect_consult (I AM code reviews), web_search (documentation lookup), in addition to platform file operations. This prevents broken commits by requiring architectural approval before platform modifications.
- **Platform Modification Guardrails**: Platform file modifications are disabled in production (Render) due to ephemeral containers. For platform self-healing, Meta-SySop can commit changes to GitHub, triggering auto-deployment, enabled by owner-controlled maintenance mode and specific environment variables.
- **Secrets Management**: Zero-knowledge credential handling for API keys.
- **Advanced AI Capabilities**: SySop can build complex marketplace platforms, professional-grade 2D/3D games, implement Orb usage-based billing, self-test, search documentation, and analyze visuals.
- **Test Data Generation & User Simulation**: SySop can generate realistic test data using faker.js (realistic names, emails, dates) and simulate user behavior with Playwright scripts. It creates seed data for databases, simulates user flows (signup → login → purchase), generates analytics events with proper timestamps, and tests tracking systems with realistic interaction patterns. Supports E2E testing with multiple concurrent simulated users.
- **Bot & Agent Generation**: SySop can create functional chatbots and automation agents for user projects including: AI-powered chatbots for web applications (OpenAI, Anthropic), platform-specific bots (Discord.js, Slack Bolt, Telegram), automation agents (cron jobs, webhooks, data scraping), and background workers. Emphasizes API key security, rate limiting, error handling, and production best practices.
- **Command System**: Natural language commands are processed by Anthropic Claude 3.5 Sonnet to generate project structures as JSON.
- **File Management**: Generated files are stored in PostgreSQL, viewable and editable via a file browser and Monaco editor. Files auto-refresh every 5 seconds with WebSocket push updates for real-time synchronization. Comprehensive console logging tracks file selection, content loading, and editor updates for debugging.
- **Conversational AI**: An AI assistant powered by Claude 3.5 Sonnet clarifies questions and explains design decisions, with automatic conversation summarization.
- **Preview System**: Uses `esbuild` for in-memory React/TypeScript compilation to show compiled applications in an iframe, with real-time status and auto-refresh. Preview endpoint includes comprehensive logging for compilation time tracking, entry point detection, and error diagnosis. Supports both public preview sharing and authenticated project viewing.
- **Monolithic Routes Refactoring**: The server routes were modularized to improve performance, reducing `routes.ts` significantly and creating dedicated modules for auth, projects, files, chat, subscriptions, admin, and websocket. Common middleware and utilities were extracted.
- **Performance Optimizations**: Implemented LRU caching, system prompt caching, Gzip compression, WebSocket memory leak fixes (heartbeat, cleanup), and response caching middleware for hot endpoints.
- **Robust JSON Parsing Pipeline**: Developed a 3-tier extraction method for AI responses to handle complex JSON structures, including emojis and braces in strings.
- **Multi-Agent Task Management System**: Foundation for autonomous task breakdown with new database tables and six SySop tools for task list creation, updates, sub-agent delegation, and architect reviews, all with robust security and ownership verification.
- **SySop Diagnostic Tool**: Enhanced `perform_diagnosis` capability with security-first implementation, path validation, and evidence-based analysis for performance, memory, database, and security diagnostics.

### Feature Specifications
- **Workspace Features**: Tab-based navigation (Overview, Build, Files, Preview, Activity, Versions), unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Publishing page with mobile-responsive design, database migration detection, deployment management, logs, and analytics.
- **Team Workspaces**: Collaboration infrastructure with role-based access, member invitations, and shared project access.
- **API Key Management**: Secure API key system for Pro+ users with bcrypt hashing, usage tracking, and validation middleware.
- **Support Ticketing**: Complete support ticket system with subject, description, priority levels, status tracking, and plan-based SLA response times.
- **AI Request Management**: Priority processing queue with concurrent request limits, real-time cost preview, usage dashboard, and token-based pricing model.

### System Design Choices
- **Database Architecture**: Comprehensive PostgreSQL schema for projects, commands, files, subscriptions, usage logs, templates, version control, team workspaces, API keys, and support tickets.
- **Team Collaboration System**: Role-based access control with invitation system.
- **API Key Infrastructure**: Secure key generation with bcrypt hashing and usage tracking.
- **Support Ticketing System**: Complete ticket lifecycle with priority levels and plan-based SLAs.
- **AI Priority Queue**: EventEmitter-based queue with priority scoring and concurrent request limits.
- **Usage Tracking & Billing**: 100% cost coverage tracking AI tokens, storage, deployment bandwidth, and infrastructure, with Stripe metered billing for overages.
- **Monetization Infrastructure**: Lead capture, Stripe subscription system, webhook handling, granular usage billing, and a template marketplace commission model.
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