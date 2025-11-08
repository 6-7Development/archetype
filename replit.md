# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring LomuAI, an autonomous AI coding agent, and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A key capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging. The business vision is to provide a comprehensive, AI-driven platform that simplifies web development, making it accessible and efficient for a wide range of users, from individual developers to large enterprises.

## User Preferences
### API Configuration
**Gemini 2.5 Flash + Claude Sonnet 4 Hybrid Strategy**:
- **LomuAI & Platform Healing**: Gemini 2.5 Flash via GEMINI_API_KEY
  - Model: gemini-2.5-flash
  - Cost: $0.075 input / $0.30 output per 1M tokens (**40x cheaper** than Claude)
  - 1M token context window
  - **18 core tools** (Google recommends 10-20 for optimal performance)
  - Used for: Regular development, platform healing, job management
  
- **I AM Architect & Sub-Agents**: Claude Sonnet 4 via ANTHROPIC_API_KEY  
  - Model: claude-sonnet-4-20250514
  - Cost: $3.00 input / $15.00 output per 1M tokens
  - 200K token context window
  - **12-23 tools** (complex reasoning requires more tools)
  - Used for: Architectural guidance, complex refactoring, code review

**Why Hybrid?**
- ✅ **40x cost reduction** for regular work (Gemini Flash: $0.075/$0.30 vs Claude: $3/$15)
- ✅ **Fixed function calling** - Removed `responseMimeType` constraint, proper `functionResponse` format
- ✅ **Optimized tool count** - 18 tools for Gemini (Google's 10-20 sweet spot)
- ✅ **Strategic distribution** - Simple tasks on Gemini, complex reasoning on Claude
- ✅ **System instruction added** - "Only use declared tools" prevents function hallucination

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
The platform uses a unified codebase for Lomu (Desktop, 4-panel layout) and Lomu5 (Mobile, bottom tab navigation), sharing backend APIs, WebSockets, authentication, and database access.

### UI/UX Decisions
The user interface features a tab-based workspace with a command console and real-time live preview. The design is fresh, optimistic, and citrus-inspired, utilizing card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces use semantic theme tokens for consistent, polished appearance with modern message bubbles and smooth transitions. Loading states feature a signature lemonade jar animation.

### System Design Choices
LomuAI acts as the autonomous worker, committing changes through a strict 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT). I AM Architect is a user-summoned premium consultant that provides guidance without committing code. The system supports parallel subagent execution, real-time streaming, usage-based billing, and self-testing.

**LomuAI Efficiency Improvements:**
Efficiency rules within LomuAI's system prompt optimize token usage and task completion: SEARCH BEFORE CODING, COPY DON'T REINVENT, VERIFY THE TASK, and ITERATION BUDGET AWARENESS.

**Access Model:**
- **Platform Healing**: Owner-only access for self-correction using LomuAI v2.0.
- **Regular LomuAI**: All users for project development/fixes (usage-based credit billing).
- **I AM Architect**: Premium consulting feature for all users.

**Credit System (V4.0):**
A profitable credit system is implemented where 1 credit = 1,000 tokens = $0.05, with various pricing tiers (Free, Starter, Pro, Business, Enterprise) designed for significant profit margins.

**Key Features:**
- **Tool Distribution Architecture**:
  - **LomuAI (18 tools)**: File Operations, Smart Code Intelligence, Task Management, Web & Research, Testing & Diagnosis, Vision Analysis, Escalation, System Operations. Validation ensures Gemini agents stay within Google's 10-20 tool recommendation.
  - **Sub-Agents (12 tools)**: file operations, smart code intelligence, execution, secrets, integrations, deployment.
  - **I AM Architect (23+ tools)**: platform file operations, architect services, knowledge management, logs, database, design assets, GitHub, environment variables.
- **GitHub Integration**: Full version control (6 tools) supporting branching, pull requests, project export, and auto-deployment.
- **Environment Variables Management**: Project-level secrets (4 tools) with database storage, validation, and security masking.
- **Code Intelligence System**: AST-based code understanding via CodeIndexer, FileRelevanceDetector, and SmartChunker.
- **Platform Healing System**: Owner-only two-tier incident resolution for self-correction using identical tools as regular LomuAI.
- **Replit Agent Parity**: Matches Replit Agent's complex task handling with increased token limits, iterations, self-correction, and concurrency.
- **Credit-Based Billing System**: Production-ready monetization with Stripe integration, usage tracking, and atomic operations.
- **Monetization Infrastructure**: Lead capture, subscription system, webhooks, and a template marketplace.
- **Security & Production Readiness**: Authentication/authorization (Replit Auth, PostgreSQL sessions), protected APIs, rate limiting, bcrypt-hashed API keys, and RCE prevention.
- **Vision Analysis**: LomuAI can analyze images and screenshots using `vision_analyze` tool (powered by Claude Sonnet 4 Vision API) for UI/UX analysis, bug detection, and design matching.
- **Strict Function Calling**: Transport-layer enforcement of JSON function calling for Gemini, ensuring "application/json" responseMimeType, "ANY" mode for forced tool calls, explicit `allowedFunctionNames`, and `temperature: 0.0` for determinism.

### Feature Specifications
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Management of deployments, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access and invitations.
- **API Key Management**: Secure system for Pro+ users with hashing, usage tracking, and validation.
- **Support Ticketing**: Complete system with subject, description, priority, status, and plan-based SLA.
- **AI Request Management**: Priority processing queue with concurrent limits, real-time cost preview, usage dashboard, token-based pricing, and parallel subagent execution.
- **Advanced AI Development Features**: Includes Sub-Agent/Task Runner System, Message Queue, Autonomy Controls, AI Image Generation, Dynamic Intelligence, Plan Mode, Design Mode, Workflows, Agents & Automations, and a General Agent Mode.

## External Dependencies
- **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI, next-themes
- **Backend**: Express.js, WebSocket
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **AI**: Google Gemini 2.5 Flash, Anthropic Claude Sonnet 4, OpenAI (gpt-image-1)
- **Deployment**: Railway
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API