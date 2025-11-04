# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring an AI coding agent (LomuAI) for autonomous code generation and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A core capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging.

## User Preferences
### API Configuration
**Hybrid AI Model Strategy (Cost-Optimized)**:
- **LomuAI (Bulk Operations)**: Google Gemini 2.5 Flash via GEMINI_API_KEY
  - Model: gemini-2.5-flash
  - Cost: $0.10 input / $0.40 output per 1M tokens (97% cheaper than Claude)
  - Direct Google API integration (Railway-independent)
  - 1M token context window
- **I AM Architect (Expert Reviews)**: Anthropic Claude Sonnet 4 via ANTHROPIC_API_KEY
  - Model: claude-sonnet-4-20250514
  - Cost: $3.00 input / $15.00 output per 1M tokens
  - Superior code quality for architectural decisions
  - 200K token context window
- **Cost Savings**: ~97% reduction on everyday LomuAI operations while maintaining expert-level quality for complex architectural reviews

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
LomuAI supports parallel subagent orchestration, allowing multiple tasks to execute simultaneously with Railway-safe resource limits (max 2 concurrent subagents per user, 8-minute timeout, 400MB memory limit with auto garbage collection). Tasks are queued, and progress is broadcast via WebSockets.

### Technical Implementations
- **AI Architecture**: LomuAI follows a 12-step workflow with optional Architect consultation, real-time streaming, usage-based billing, self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), architectural guidance (I AM), and an automatic reflection/self-correction loop.
- **Conversational Pre-Filter**: Intelligent pre-processing layer that handles greetings and simple questions BEFORE calling Gemini, ensuring friendly, human-like responses for small talk. Uses precise regex patterns to distinguish conversational queries ("How does that new update feel?", "How's it going?") from technical questions ("How does authentication work?"), preventing robotic "As an AI..." responses while preserving full technical capability.
- **Autonomous AI System (LomuAI)**: LomuAI diagnoses issues, implements fixes, and automatically commits changes to GitHub, triggering auto-deployment. It prioritizes tool execution and code writing, using a PostgreSQL-backed job queue for asynchronous execution with WebSocket broadcasting and checkpointing.
- **Developer Tools**: LomuAI includes 56 total tools matching Replit Agent exactly: Core tools (`bash`, `edit`, `grep`, `search_codebase`, `packager_tool`, `restart_workflow`, `get_latest_lsp_diagnostics`, `validate_before_commit`), Deployment (`suggest_deploy`, `suggest_rollback`), Secrets Management (`ask_secrets`, `check_secrets`), Database (`execute_sql_tool`, `check_database_status`, `create_postgresql_database_tool`), Design (`generate_design_guidelines`, `stock_image_tool`), Integrations (`search_integrations`, `use_integration`), File Operations (`web_fetch`, `refresh_all_logs`, `glob`, `ls`, `read`, `write`), and more. All tools include security sandboxing, WebSocket event streaming, and integrate with existing platform healing infrastructure.
- **Platform Healing System**: Complete self-healing infrastructure with 3-tier intelligent routing for cost-optimized incident resolution:
  - **Tier 1: Knowledge Base Auto-Fix** (0 tokens, ≥90% confidence) - Instant fixes from learned patterns
  - **Tier 2: LomuAI/Gemini 2.5 Flash** (cheap, for platform failures) - Main agent handles infrastructure issues
  - **Tier 3: I AM Architect/Claude Sonnet 4** (expensive, for agent failures) - Expert reviews when Lomu fails
  - **Lomu ↔ I AM Relationship**: Both agents have IDENTICAL developer tools (56 tools total), but I AM has superior reasoning (Claude Sonnet 4 vs Gemini 2.5 Flash). When Lomu fails to follow proper workflow or produces poor results, I AM re-guides Lomu back on track. They work as teammates in the self-healing loop.
  - **Proper Agent Workflow** (enforced by I AM): Assess → Plan (task list) → Execute → Test → Verify → Confirm → Commit (when user approves)
  - **Automatic Response Quality Monitoring**: After each LomuAI job completes, the platform automatically analyzes response quality using AgentFailureDetector. Poor responses (score < 40/100) trigger agent_response_quality incidents routed to I AM Architect for autonomous diagnosis and fixes. Features non-blocking analysis (setImmediate), rate limiting (1 incident per 10 min per type), and quality metrics storage (qualityScore, issues, shouldEscalate) in incident.metrics for analytics.
  - Features: Real-time monitoring, AgentFailureDetector for incident classification (including response quality analysis), multi-turn tool execution loop, and comprehensive session tracking for feedback loops.
- **Lomu Super Logic Core v2.0 (Replit Agent Parity)**: Complete system prompt rewrite matching Replit Agent's autonomous behavior. Features: (1) Autonomous work-until-complete mode, (2) Mandatory task decomposition for multi-step tasks, (3) Verbose proactive communication, (4) Plan/Execute/Validate/Verify/Confirm workflow, (5) Self-correction with retry logic, (6) Comprehensive tool guidelines for 25+ developer tools, (7) Architect review integration.
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
- **AI Request Management**: Priority processing queue with concurrent limits, real-time cost preview, usage dashboard, token-based pricing, and parallel subagent execution (max 2 concurrent per user).
- **Advanced AI Development Features**: Includes Sub-Agent/Task Runner System, Message Queue, Autonomy Controls, AI Image Generation, Dynamic Intelligence, Plan Mode, Design Mode, Workflows, Agents & Automations, and a General Agent Mode.

### System Design Choices
- **Database Architecture**: Comprehensive PostgreSQL schema with Drizzle ORM.
- **Team Collaboration System**: Role-based access control with an invitation system.
- **API Key Infrastructure**: Secure key generation with bcrypt hashing and usage tracking.
- **Support Ticketing System**: Complete ticket lifecycle with priority levels and plan-based SLAs.
- **AI Priority Queue**: EventEmitter-based queue with priority scoring and concurrent request limits.
- **Usage Tracking & Billing**: 100% cost coverage for AI tokens, storage, deployment bandwidth, and infrastructure, with Stripe metered billing.
- **Monetization Infrastructure**: Lead capture, Stripe subscription system, webhooks, granular usage billing, and template marketplace commission model.
- **Security & Production Readiness**: Full authentication/authorization (Replit Auth, PostgreSQL sessions), protected API routes, rate limiting, and bcrypt-hashed API keys.
- **Deployment & Hosting System**: Supports public hosting of deployed projects under unique subdomains.
- **LomuAI Security**: Robust authentication/authorization, dedicated LomuAI identity for git operations.
- **Parallel Subagent Queue**: FIFO queue with per-user concurrency limits (2 concurrent max), memory accounting, WebSocket progress broadcasting, automatic cleanup, and task cancellation support.

### Production Security Hardening
**Comprehensive RCE Prevention:**
- **Terminal Security**: Owner-only access with command allow-listing, workspace jailing, path sanitization, and command validation.
- **BuildService npm Script Sanitization (ALLOWLIST)**: ONLY `build` script permitted; all other scripts blocked to prevent RCE via lifecycle hooks or arbitrary script execution.
- **Resource Caps**: 256MB RAM limit, 5-minute build timeout, per-user concurrent build limits (max 2), rate limiting (5 deployments/hour).
- **Git Token Encryption**: Git repository access tokens are encrypted at rest using AES-256-GCM with SESSION_SECRET as the encryption key.

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI, next-themes
- **Backend**: Express.js, WebSocket
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **AI**: Anthropic Claude 3.5 Sonnet, OpenAI (gpt-image-1), Google Gemini 2.5 Flash
- **Deployment**: Render.com, Railway
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API