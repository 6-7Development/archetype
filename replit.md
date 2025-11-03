# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring an AI coding agent (LomuAI) for autonomous code generation and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features, aiming for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A core capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging.

## Recent Changes
- **100% Replit Agent Feature Parity (2024-11-03):** Added search_codebase tool for semantic code search and validate_before_commit for comprehensive pre-commit validation (TypeScript + database tables + critical files). LomuAI now has ALL Replit Agent features plus advantages (Platform Healing, I AM Architect, Railway portability, 97% cost savings).
- **LomuAI Codebase Awareness (2024-11-03):** Auto-inject replit.md into every LomuAI conversation for complete project knowledge. LomuAI now knows files, routes, and architecture automatically without manual search. Enhanced system prompt with file discovery workflow examples (grep, read, ls patterns).
- **Railway Logging Optimization (2024-11-03):** Reduced healing chat logging verbosity in production to prevent Railway log limit issues. File search results limited to 100 max, debug logs silenced in production (NODE_ENV=production), keeping only essential logs (writes, errors).

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
- **Autonomous AI System (LomuAI)**: LomuAI diagnoses issues, implements fixes, and automatically commits changes to GitHub, triggering auto-deployment. It prioritizes tool execution and code writing, using a PostgreSQL-backed job queue for asynchronous execution with WebSocket broadcasting and checkpointing. Token optimization reduces context to prevent API cost overruns.
- **Developer Tools (100% Replit Agent Parity)**: LomuAI includes 8 critical developer tools: `bash`, `edit`, `grep`, `search_codebase` (semantic code search), `packager_tool`, `restart_workflow`, `get_latest_lsp_diagnostics`, and `validate_before_commit` (comprehensive pre-commit validation). All tools include security sandboxing, WebSocket event streaming, and integrate with existing platform healing infrastructure.
- **Lumo Avatar System**: An HTML5 canvas-based animated lemon mascot with subtle breathing, blinking, leaf sway, and vertical bounce animations. It displays facial expressions according to emotion.
- **Platform Healing System**: Complete self-healing infrastructure with real-time monitoring and an AI-powered chat (Gemini 2.5 Flash) for platform owners to diagnose and fix LomuAI issues. Features multi-turn tool execution loop with read/write/search capabilities. Claude reserved for emergency architect consultations only.
- **Lomu Super Logic Core v1.0**: Advanced AI personality system combining cost-awareness, tool capabilities, and self-optimization. It features a 9-step cognitive workflow, token budget enforcement, failsafe logic, and a learning/adaptation system.
- **Railway Production Hardening**: Production-grade deployment safety for Railway's 512MB memory constraint, including timeout protection (3-minute AI requests, 5-minute streams, 10-minute WebSockets), memory monitoring (auto garbage collection at 450MB), graceful shutdown, and concurrency limits.
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
- **Parallel Subagent Queue**: FIFO queue with per-user concurrency limits (2 concurrent max), memory accounting (400MB total), WebSocket progress broadcasting, automatic cleanup, and task cancellation support.

### Production Security Hardening
**Comprehensive RCE Prevention (2024-11-02):**
- **Terminal Security**: Owner-only access with command allow-listing (approved commands only), workspace jailing, path sanitization, and command validation. Prevents unauthorized shell execution.
- **BuildService npm Script Sanitization (ALLOWLIST)**: ALL npm scripts removed except `build` script required for Vite. Prevents RCE via lifecycle hooks (install, prepare, publish), custom pre/post scripts (prebuild, postbuild), and arbitrary script execution. Blocklist approach was insufficient as npm runs pre/post variants of ANY script name.
- **Resource Caps**: 256MB RAM limit via NODE_OPTIONS, 5-minute build timeout, per-user concurrent build limits (max 2), rate limiting (5 deployments/hour).
- **Detailed Logging**: Build logs show script sanitization results (kept vs. removed scripts) for transparency.
- **Defense-in-Depth**: Multiple layers (authorization, allowlisting, resource limits, rate limiting) ensure production safety even if one layer fails.

#### npm Script Allowlist Policy - Detailed Documentation

**Current Policy (Updated 2024-11-02):**
- **ONLY PERMITTED**: `build` script (required for Vite/Webpack build process)
- **ALL OTHER SCRIPTS BLOCKED**: This includes lifecycle hooks (install, postinstall, prepare, prepublish) and custom scripts (prebuild, postbuild, etc.)

**Security Trade-off:**
This strict allowlist policy prioritizes security over compatibility. It may break legitimate packages that rely on:
- `prebuild`/`postbuild` scripts for code generation
- `prepare` scripts for TypeScript compilation
- `install`/`postinstall` scripts for native module compilation (node-gyp, etc.)

**Handling Incompatible Packages:**
If a user project requires a package with additional npm scripts:

1. **Security Review Process:**
   - Review the package's package.json scripts section
   - Inspect the actual script commands for malicious code
   - Check for shell execution, network calls, or file system modifications
   - Verify the package is from a trusted source (npm verified, high download count, active maintenance)

2. **If Safe, Update Allowlist:**
   - Edit `server/services/buildService.ts`
   - Add the script to `ALLOWED_NPM_SCRIPTS` array with a justification comment
   - Example: `'postbuild',  // Required for @example/package - reviewed 2024-11-02`

3. **Testing Protocol:**
   - Test in isolated development environment first
   - Monitor build logs for unexpected behavior
   - Verify no unauthorized network/file access occurs

4. **Documentation:**
   - Update this section in replit.md with the new allowed script
   - Document the package name, script purpose, and review date
   - Include link to security review discussion/ticket if applicable

**Example Safe Scripts to Consider:**
- `postbuild`: Often used for minification or asset optimization (review carefully)
- `prepare`: Used by TypeScript packages for compilation (common in dev dependencies)

**Example Dangerous Scripts to ALWAYS BLOCK:**
- `preinstall`/`install`/`postinstall`: Can execute arbitrary code during npm install
- `prepublish`: Can run unexpected code before package publish
- Custom scripts with shell execution (`sh -c`, `bash`, etc.)

**Reference Implementation:**
See `server/services/buildService.ts` lines 30-71 for the complete allowlist implementation and inline documentation.

**Git Token Encryption:**
Git repository access tokens are encrypted at rest using AES-256-GCM with SESSION_SECRET as the encryption key. See `server/storage.ts` lines 124-203 for implementation details.

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI, next-themes
- **Backend**: Express.js, WebSocket
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **AI**: Anthropic Claude 3.5 Sonnet, OpenAI (gpt-image-1)
- **Deployment**: Render.com, Railway
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API