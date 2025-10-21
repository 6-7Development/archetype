# Archetype - AI-Powered Website Builder Platform

## Overview
Archetype is an AI-powered platform for rapid web development, featuring both a command-based project generator and a professional IDE Workspace. Its core is SySop, an advanced AI coding agent with architect-level consultation capabilities, providing an enterprise-grade tool for autonomous code generation with built-in quality validation. The platform offers a console-first interface, real-time preview, and a tab-based workspace. Archetype includes comprehensive monetization infrastructure with subscription tiers, usage-based billing, a template marketplace with creator revenue sharing, and professional development services. A subsidiary of Drill Consulting 360 LLC, it targets Fortune 500 production readiness and fully portable deployment to any cloud platform.

**Meta-SySop (Platform Self-Healing):** Archetype features autonomous platform self-healing through Meta-SySop, which allows SySop to fix bugs, improve UI/UX, and modify Archetype's own source code on Render production. This system includes automatic git backups before changes, rollback capability, comprehensive audit logging, and admin-only access controls. Admins can submit platform issues via `/platform-healing` and SySop will autonomously diagnose, fix, test, and optionally auto-commit/push changes to production.

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
The user interface features a tab-based workspace (Overview, Build, Files, Preview, Activity, Versions) providing an IDE-like experience. Interaction is primarily through a command console, complemented by a real-time live preview. The design adopts a professional, corporate aesthetic with a navy/slate color palette, card-based layouts, and smooth transitions, ensuring responsiveness and ADA/WCAG accessibility with `prefers-reduced-motion` support.

### Technical Implementations
- **AI Architecture**: SySop (AI Coding Agent) uses a 12-step workflow with built-in Architect consultation for architectural validation.
- **Real-Time AI Streaming**: Production-grade streaming with Anthropic's API and WebSocket broadcasting with abort capability.
- **Stop/Abort System**: Users can stop AI generation mid-process with server-side AbortController integration (POST /api/commands/abort).
- **AI Billing**: Comprehensive billing for all AI usage, including effort-based and conversational checkpoint pricing, with auto-fix capabilities.
- **Enhanced SySop System Prompt**: Optimized prompt emphasizing high quality through a 14-step workflow, improved JSON formatting, and expertise in full-stack web, professional games, self-testing, and Orb usage-based billing.
- **Professional Communication**: SySop uses teaching emojis (🧠🔨✅) for beginner-friendly progress, "explain like I'm 5" approach, step-by-step updates, and transparent issue reporting.
- **Enhanced Progress Display**: Visual collapsible task sections with live progress, progress bars, work metrics, and real-time token/cost tracking.
- **Autonomous AI System**: SySop is equipped with self-testing, self-correction, and architectural guidance capabilities:
  - **Core Autonomous Tools**: Browser Testing (Playwright), Web Search (Tavily API), Vision Analysis (Claude Vision), Architect Consult.
  - **Automatic Reflection Loop**: Server-enforced after every code generation; frontend/UI code verified with `browser_test`, backend/API code tested with sample requests.
  - **Self-Correction Protocol**: Server-side retry loop - if tests find issues, SySop fixes and retests automatically; after 3 failed attempts, server automatically invokes `architect_consult`.
  - **Autonomous Troubleshooting**: Proactively diagnoses issues using `browser_test`, searches for solutions, fixes, and verifies.
  - **Human Intervention Points**: SySop requests external API keys/credentials, clarifies ambiguous requirements, and server escalates to `architect_consult` after 3+ failed fix attempts.
- **Secrets Management**: Zero-knowledge credential handling for API keys.
- **Advanced AI Capabilities**: SySop can build complex marketplace platforms, professional-grade 2D/3D games, implement Orb usage-based billing, and can self-test, search docs, and analyze visuals.
- **Command System**: Natural language commands processed by Anthropic Claude 3.5 Sonnet generate project structures as JSON.
- **File Management**: Generated files stored in PostgreSQL, viewable and editable via a file browser and Monaco editor.
- **Conversational AI**: An AI assistant powered by Claude 3.5 Sonnet clarifies questions and explains design decisions.

### Feature Specifications
- **Tab-Based Workspace**: Navigation with Overview, Build, Files, Preview, Activity, and Versions tabs.
- **Unified Talk & Build Interface**: Combines AI chat and command execution.
- **Monaco Editor**: Integrated for code preview and editing.
- **Project Download**: Full project ZIP export.
- **Split-View Live Preview**: Real-time project preview.
- **Publishing/Deployment System**: Full Publishing page with mobile-responsive design, database migration detection, deployment management, logs, and analytics.
- **Team Workspaces**: Collaboration infrastructure with role-based access, member invitations, and shared project access.
- **API Key Management**: Secure API key system for Pro+ users with bcrypt hashing, usage tracking, and validation middleware.
- **Support Ticketing**: Complete support ticket system with subject, description, priority levels, status tracking, and plan-based SLA response times.
- **Priority Processing Queue**: AI request prioritization system with concurrent request limits.
- **Real-Time Cost Preview**: Estimated tokens and cost displayed before generation with automatic complexity detection.
- **Complexity Detection Fallback**: Allows users to retry analysis or proceed without preview if detection fails.
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

## Recent Changes
### Replit Agent 3-Style Enhancements (October 21, 2025)
Complete overhaul of chat interface and AI behavior to match Replit Agent's professional UX:

**Chat UI Redesign**
- Redesigned chat interface with clean, minimal Replit Agent aesthetic
- Component: `client/src/components/ai-chat.tsx` - Simplified message cards with subtle backgrounds (bg-muted/50), smaller avatars (w-6 h-6), tighter spacing
- Updated `client/src/components/agent-progress.tsx` - Collapsible task sections with checkbox system:
  - Shows progress counter (e.g., "7 / 8 tasks")
  - Three checkbox states: completed (filled with checkmark), in-progress (animated pulse border), pending (empty)
  - Metrics footer with tokens and line changes
  - Stop button integrated in footer
- Removed heavy cards and excessive borders for professional, enterprise feel

**Image Paste/Upload Support**
- Users can paste screenshots directly into chat (Cmd+V / Ctrl+V)
- Backend endpoint: POST `/api/chat/upload-image` (server/routes.ts)
- Image storage: `attached_assets/chat_images/{userId}_{timestamp}.{ext}`
- Vision API integration - Claude analyzes screenshots and provides intelligent debugging
- Database schema: Added `images` JSONB field to chatMessages table
- Frontend: Paste handler, thumbnail previews, click-to-zoom modal in ai-chat.tsx
- File validation: jpg, png, gif, webp with 5MB size limit

**Preview System with esbuild Compilation**
- **FIXED**: Preview now shows actual compiled/running applications instead of raw HTML code
- Component: `client/src/components/live-preview.tsx` - Changed from manual HTML injection to iframe with `/api/preview/:projectId`
- Backend endpoint: GET `/api/preview/:projectId` (server/routes.ts)
- Uses **esbuild** for in-memory React/TypeScript compilation:
  - Supports JSX/TSX automatic transformation
  - Handles module resolution from virtual file system
  - Auto-detects entry points (index.tsx, App.tsx, main.tsx, index.html)
  - Returns compiled HTML with bundled JavaScript
  - Loads React from CDN for external dependencies
- Real-time compilation status (Loading → Compiling → Ready/Error)
- Open in new tab support
- Auto-refresh when project changes

**Memory Optimization**
- Automatic conversation summarization for chats >10 messages (saves 70-80% tokens)
- Keeps last 5 messages intact, stores summary as system message with isSummary flag
- Implementation in server/routes.ts AI chat conversation endpoint

**React Hook Error Fix**
- **FIXED**: "TypeError: Cannot read properties of null (reading 'useState')" breaking entire app
- Replaced custom ThemeProvider with battle-tested `next-themes` package
- Component: `client/src/components/theme-provider.tsx`
- Fixed ReactNode import (was using React.ReactNode without importing)
- Cleared Vite caches (node_modules/.vite, dist) to force fresh dependency optimization
- App now loads successfully without hook errors

**SySop Behavior Updates**
- Intelligent questioning - asks if request makes sense with project context (like Replit Agent 3)
- Simple emoji communication: 🧠 (thinking), 📝 (editing), ✅ (done), 🔨 (building)
- Memory-efficient conversation handling
- Professional, beginner-friendly communication style
- **Ultra-concise greeting**: "Hey! I'm SySop. What are we building?" (no long paragraphs)
- **Action-first**: Builds immediately when request is clear, only asks questions when genuinely confused
- **Platform Healing**: When users report platform issues, SySop directs them to /platform-healing for Meta-SySop self-repair

**Status**: All features tested and verified production-ready via E2E testing

### Meta-SySop Production Fixes (October 2025)
All Meta-SySop platform healing features are now production-ready with comprehensive security hardening:

**Authentication & Authorization**
- Fixed broken isAdmin middleware in `server/platformRoutes.ts` - replaced custom DB async query with proper `universalAuth.isAdmin`
- Fixed AdminGuard component (`client/src/components/admin-guard.tsx`):
  - Corrected API endpoint from `/api/user` to `/api/auth/me`
  - Fixed response parsing to extract `data?.user` instead of direct `data`
  - Moved redirect logic to `useEffect` to eliminate React render warnings
- All platform endpoints (`/heal`, `/rollback`, `/backups`, `/audit`, `/status`) now properly enforce admin-only access

**Git Operations**
- Configured git identity for Meta-SySop commits using inline config flags
- Both `createBackup()` and `commitChanges()` now use: `-c user.name=Meta-SySop -c user.email=meta-sysop@archetype.platform`
- Eliminates "unable to auto-detect email address" failures
- All commits attributed to Meta-SySop service identity

**Security**
- All git commands use `execFileAsync` with argument arrays (prevents shell injection)
- Path traversal protection via `path.resolve()` with `startsWith()` validation
- Dangerous file patterns blocked: `.git/`, `node_modules/`, `.env`, `package.json`, `vite.config.ts`, `server/vite.ts`, `drizzle.config.ts`
- Absolute paths rejected in all file operations
- Safety validation runs before auto-commit/push with automatic rollback on failure

**Status**: PASS from Architect Review - all fixes verified production-ready

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, PostgreSQL (Neon), WebSocket
- **Database ORM**: Drizzle ORM
- **AI**: Anthropic Claude 3.5 Sonnet
- **Deployment**: Render.com, Railway, or Docker
- **Payment Processing**: Stripe
- **Authentication**: Passport.js (local strategy), bcrypt, `connect-pg-simple`
- **Charting**: Recharts