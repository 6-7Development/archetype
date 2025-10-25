# Archetype - AI-Powered Website Builder Platform

## Overview
Archetype is an AI-powered platform for rapid web development, featuring an AI coding agent (SySop) for autonomous code generation and dual-version IDE Workspaces. The platform includes **Archetype** (desktop-optimized) and **Archetype5** (mobile-optimized) versions that share all backend resources while providing tailored UX for each platform. Both versions offer a console-first interface, real-time preview, and comprehensive workspace features. The platform includes monetization infrastructure with subscription tiers, usage-based billing, a template marketplace, and professional development services. A subsidiary of Drill Consulting 360 LLC, Archetype targets Fortune 500 production readiness and fully portable deployment to any cloud platform. It also features Meta-SySop for autonomous platform self-healing, bug fixes, and UI/UX improvements to its own source code on Render production, with built-in rollback and audit logging.

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
The platform implements a unified codebase with two distinct user experiences: Archetype (Desktop) with a 4-panel layout, and Archetype5 (Mobile) with bottom tab navigation, optimized for touch. Both versions share a single codebase, backend APIs, WebSocket connections, authentication, and database access, with runtime detection for version switching based on viewport size, user agent, and touch capabilities.

### UI/UX Decisions
The user interface features a tab-based workspace (Overview, Build, Files, Preview, Activity, Versions) providing an IDE-like experience, primarily through a command console and real-time live preview. The design adopts a professional, corporate aesthetic with a navy/slate color palette, card-based layouts, smooth transitions, and ADA/WCAG accessibility. Chat interfaces are clean, minimal, with enhanced progress displays, fixed mobile layout issues (input boxes remain anchored), and proper scroll behavior. Collapsible preview panels and enlarged chat input areas improve usability.

### Technical Implementations
- **AI Architecture**: SySop (AI Coding Agent) employs a 12-step workflow with Architect consultation, real-time streaming, and comprehensive billing. It's optimized for full-stack web, professional games, self-testing, and Orb usage-based billing, providing transparent updates and issue reporting.
- **Replit Agent-Style Task Management**: Live, interactive task lists with real-time status updates (checkmarks, spinning circles, empty circles) are displayed via a TaskBoard UI component, driven by WebSocket updates and robust JSON parsing for task plans.
- **Autonomous AI System**: SySop integrates self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), architectural guidance (I AM), and an automatic reflection/self-correction loop. Meta-SySop has enhanced tools including `architect_consult`, `web_search`, and `commit_to_github`.
- **Meta-SySop Autonomous Deployment**: Meta-SySop operates with full autonomy - it diagnoses issues, consults I AM for approval, implements fixes, and automatically commits changes to GitHub triggering Render auto-deployment. No manual intervention required. Workflow: Diagnose → Consult I AM → Fix → Auto-Deploy → Report. Changes are pushed via GitHub API (GitHubService) from Replit development environment, bypassing git command restrictions.
- **Meta-SySop Anti-Lying Enforcement (Oct 2025)**: Five-layer bulletproof system prevents Meta-SySop from claiming success before actual completion: (1) Text suppression - blocks all text output when tool calls are present, forcing "Executing tools..." instead of premature "Done!" messages; (2) Task dependency validation - prevents completing tasks out of order, enforces sequential completion; (3) Commit success tracking - deployment task cannot complete unless GitHub commit actually succeeds via commitSuccessful flag; (4) Session-end validation - hardened readTaskList() check blocks session end if verification fails OR tasks incomplete, forces retry; (5) Honest final messages - removed default "Done!" message, replaced with verified status based on actual task completion. All five layers work together to eliminate lying vectors.
- **Secrets Management**: Zero-knowledge credential handling for API keys.
- **Advanced AI Capabilities**: SySop can build complex marketplace platforms, 2D/3D games, implement usage-based billing, generate test data (faker.js), simulate user behavior (Playwright), and create functional chatbots/automation agents.
- **Command System**: Natural language commands processed by Anthropic Claude 3.5 Sonnet to generate JSON project structures.
- **File Management**: Generated files stored in PostgreSQL, editable via Monaco editor, with real-time synchronization via WebSockets.
- **Conversational AI**: AI assistant (Claude 3.5 Sonnet) clarifies questions and explains design decisions with automatic summarization.
- **Preview System**: Uses `esbuild` for in-memory React/TypeScript compilation to show applications in an iframe with real-time status and auto-refresh.
- **Monolithic Routes Refactoring**: Server routes modularized into dedicated modules for improved performance.
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

### System Design Choices
- **Database Architecture**: Comprehensive PostgreSQL schema for all platform data (projects, users, usage, billing, etc.).
- **Team Collaboration System**: Role-based access control with an invitation system.
- **API Key Infrastructure**: Secure key generation with bcrypt hashing and usage tracking.
- **Support Ticketing System**: Complete ticket lifecycle with priority levels and plan-based SLAs.
- **AI Priority Queue**: EventEmitter-based queue with priority scoring and concurrent request limits.
- **Usage Tracking & Billing**: 100% cost coverage for AI tokens, storage, deployment bandwidth, and infrastructure, with Stripe metered billing.
- **Monetization Infrastructure**: Lead capture, Stripe subscription system, webhooks, granular usage billing, and template marketplace commission model.
- **Security & Production Readiness**: Full authentication/authorization (Replit Auth, PostgreSQL sessions), protected API routes, rate limiting, and bcrypt-hashed API keys.
- **Deployment & Hosting System**: Supports public hosting of deployed projects under unique subdomains with status and visit tracking.
- **Meta-SySop Security**: Robust authentication/authorization, dedicated Meta-SySop identity for git operations, and comprehensive security measures to prevent shell injection, path traversal, and protect sensitive files.
- **Production Owner Access (Oct 2025)**: Meta-SySop requires owner designation via `is_owner = true` in database or `OWNER_USER_ID` environment variable. Development (Replit) and production (Render) databases must be configured separately. Setup scripts provided in `production-owner-setup.sql` and `PRODUCTION_OWNER_SETUP.md` for Render deployment.

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