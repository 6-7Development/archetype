# Archetype - AI-Powered Website Builder Platform

## Overview
Archetype is an AI-powered platform for rapid web development, featuring both a command-based project generator and a professional IDE Workspace. Its core is SySop, an advanced AI coding agent with architect-level consultation capabilities, providing an enterprise-grade tool for autonomous code generation with built-in quality validation. The platform offers a console-first interface, real-time preview, and a tab-based workspace. Archetype includes comprehensive monetization infrastructure with subscription tiers, usage-based billing, a template marketplace with creator revenue sharing, and professional development services. A subsidiary of Drill Consulting 360 LLC, it targets Fortune 500 production readiness and fully portable deployment to any cloud platform.

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
- **Real-Time AI Streaming**: Production-grade streaming with Anthropic's API and WebSocket broadcasting.
- **AI Billing**: Comprehensive billing for all AI usage, including effort-based and conversational checkpoint pricing, with auto-fix capabilities.
- **Enhanced SySop System Prompt**: Optimized prompt emphasizing high quality through a 14-step workflow, improved JSON formatting, and expertise in full-stack web, professional games, self-testing, and Orb usage-based billing.
- **Professional Communication**: SySop communicates with emojis, "explain like I'm 5" approach, step-by-step progress updates, and transparent issue reporting.
- **Enhanced Progress Display**: Visual collapsible task sections with live progress, progress bars, work metrics, and real-time token/cost tracking.
- **Autonomous AI System**: SySop is equipped with self-testing, self-correction, and architectural guidance capabilities:
  - **Core Autonomous Tools**: Browser Testing (Playwright), Web Search (Tavily API), Vision Analysis (Claude Vision), Architect Consult.
  - **Automatic Reflection Loop**: MANDATORY after every code generation; frontend/UI code verified with `browser_test`, backend/API code tested with sample requests.
  - **Self-Correction Protocol**: If tests find issues, SySop fixes and retests; if it fails 3+ times, it invokes `architect_consult`.
  - **Autonomous Troubleshooting**: Proactively diagnoses issues using `browser_test`, searches for solutions, fixes, and verifies.
  - **Human Intervention Points**: SySop requests external API keys/credentials, clarifies ambiguous requirements, and invokes `architect_consult` after 3+ failed fix attempts.
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

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, PostgreSQL (Neon), WebSocket
- **Database ORM**: Drizzle ORM
- **AI**: Anthropic Claude 3.5 Sonnet
- **Deployment**: Render.com, Railway, or Docker
- **Payment Processing**: Stripe
- **Authentication**: Passport.js (local strategy), bcrypt, `connect-pg-simple`
- **Charting**: Recharts