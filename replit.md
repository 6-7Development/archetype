# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform designed for rapid web development, featuring an AI coding agent (SySop) for autonomous code generation and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with fully portable deployment, monetization infrastructure, a template marketplace, and professional development services. A core capability is LomuAI, an autonomous system for platform self-healing, bug fixes, and UI/UX improvements to its own source code, complete with rollback and audit logging.

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

### Dual-Version Architecture
The platform utilizes a unified codebase to support two distinct user experiences: Lomu (Desktop) with a 4-panel layout, and Lomu5 (Mobile) with bottom tab navigation. Both versions share backend APIs, WebSocket connections, authentication, and database access.

### UI/UX Decisions
The user interface features a tab-based workspace providing an IDE-like experience, primarily through a command console and real-time live preview. The design emphasizes a fresh, optimistic aesthetic with a citrus-inspired color palette, card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces feature Lumo the Lemon mascot as an AI companion with natural sprite animations and emotional expressions. Loading states use a signature lemonade jar animation. The layout includes a Replit-style task manager, a full-width chat, and a floating recent deployments widget. An animated billboard banner showcases key features.

### Technical Implementations
- **AI Architecture**: SySop (AI Coding Agent) follows a 12-step workflow with Architect consultation, real-time streaming, and usage-based billing. It integrates self-testing (Playwright), web search (Tavily API), vision analysis (Claude Vision), architectural guidance (I AM), and an automatic reflection/self-correction loop.
- **Autonomous AI System (LomuAI)**: LomuAI diagnoses issues, consults I AM for approval, implements fixes, and automatically commits changes to GitHub, triggering auto-deployment. It operates in an action-oriented manner, prioritizing tool execution and code writing, with mechanisms to prevent analysis paralysis. LomuAI uses a PostgreSQL-backed job queue for indefinite asynchronous execution, with WebSocket broadcasting and checkpointing. Token optimization aggressively reduces context to prevent API cost overruns and limits, while maintaining platform knowledge and conversational context. An intelligent coordination system prevents infinite loops, unnecessary task creation, and ensures proper conversation completion through message detection, completion logic, and iteration limits.
- **Lumo Avatar System**: An animated lemon mascot with 9 emotion states using sprite sheet animations, appearing in SySop and LomuAI chat interfaces. **Stability Fix (Oct 30, 2025)**: Removed horizontal sway and vertical displacement animations; Lumo now stays in a fixed, centered position with only subtle 1% breathing scale. Added `flex-shrink-0` and explicit min/max dimensions to prevent container compression. **Asset Fix (Oct 30, 2025)**: Moved sprite sheets to `client/public/lumo-sprites/` to resolve Vite security restrictions that blocked images outside the client root.
- **Lemonade Jar Loader**: An SVG-based loading animation with animated lemonade fill, bubbles, ice cubes, and garnishes, used throughout the platform.
- **Platform Healing System**: Real-time system monitoring with WebSocket-based metrics broadcasting, a theme-aware UI, and auto-commit/auto-push toggles.
- **Command System**: Natural language commands processed by Anthropic Claude 3.5 Sonnet to generate JSON project structures.
- **File Management**: Generated files stored in PostgreSQL, editable via Monaco editor, with real-time WebSocket synchronization.
- **Preview System**: Uses `esbuild` for in-memory React/TypeScript compilation to show applications in an iframe with real-time status and auto-refresh.
- **Performance Optimizations**: Includes LRU caching, system prompt caching, Gzip compression, and WebSocket memory leak fixes.
- **Multi-Agent Task Management System**: Foundation for autonomous task breakdown with database tables and SySop tools, supporting sub-agents, message queues, autonomy controls, and dynamic intelligence.

### Feature Specifications
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Management of deployments, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access and invitations.
- **API Key Management**: Secure system for Pro+ users with hashing, usage tracking, and validation.
- **Support Ticketing**: Complete system with subject, description, priority, status, and plan-based SLA.
- **AI Request Management**: Priority processing queue with concurrent limits, real-time cost preview, usage dashboard, and token-based pricing.
- **Advanced AI Development Features**: Includes Sub-Agent/Task Runner System, Message Queue, Autonomy Controls, AI Image Generation, Dynamic Intelligence, Plan Mode, Design Mode, Workflows, Agents & Automations, and a General Agent Mode.

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