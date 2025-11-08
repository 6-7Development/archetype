# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring LomuAI, an autonomous AI coding agent, and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A key capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging.

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
- ✅ **Optimized tool count** - 13 tools for Gemini (Google's 10-20 sweet spot)
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
The platform utilizes a unified codebase to support two distinct user experiences: Lomu (Desktop) with a 4-panel layout, and Lomu5 (Mobile) with bottom tab navigation. Both versions share backend APIs, WebSocket connections, authentication, and database access.

### UI/UX Decisions
The user interface features a tab-based workspace providing an IDE-like experience, primarily through a command console and real-time live preview. The design emphasizes a fresh, optimistic aesthetic with a citrus-inspired color palette, card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces use semantic theme tokens for consistent, polished appearance with modern message bubbles, proper contrast, and smooth transitions. The chat UI features clean inline aesthetics matching professional AI assistants. Loading states use a signature lemonade jar animation.

### System Design Choices
LomuAI is the sole autonomous worker that commits changes, operating independently with a strict 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT). I AM Architect is a user-summoned consultant only (premium feature), providing guidance without committing code. The system supports parallel subagent execution, real-time streaming, usage-based billing, and self-testing.

**LomuAI Efficiency Improvements:**
The system incorporates efficiency rules within the LomuAI's system prompt to optimize token usage and task completion speed, inspired by Replit Agent's performance. These rules include: SEARCH BEFORE CODING, COPY DON'T REINVENT, VERIFY THE TASK, and ITERATION BUDGET AWARENESS.

**Access Model:**
- **Platform Healing**: Owner-only access to fix the platform itself using LomuAI v2.0.
- **Regular LomuAI**: All users build/fix their own projects (usage-based credit billing).
- **I AM Architect**: Premium consulting feature available to all users.

**Credit System (V4.0):**
A profitable credit system is implemented with 1 credit = 1,000 tokens = $0.05, matching industry standards. Various pricing tiers are available (Free, Starter, Pro, Business, Enterprise) with significant profit margins.

**Key Features:**
- **Tool Distribution Architecture** (Google Gemini Optimization):
  - **LomuAI (18 tools)**: file operations (read/write/list), task management (create/read/update), code intelligence (search_codebase/grep), execution (bash), diagnostics (perform_diagnosis/read_logs), testing (run_test), web search, integrations, sub-agent delegation
  - **Sub-Agents (12 tools)**: file operations, smart code intelligence, bash, testing, secrets, integrations, deployment
  - **I AM Architect (23+ tools)**: platform file operations, architect services, knowledge management, logs, database, design assets, GitHub, environment variables
  - **Validation**: Startup checks ensure Gemini agents stay within Google's 10-20 tool recommendation
- **GitHub Integration**: Full version control with 6 tools, supporting branching, pull requests, project export, and auto-deployment.
- **Environment Variables Management**: Project-level secrets with 4 tools, database storage, validation, and security masking.
- **Code Intelligence System**: AST-based code understanding via CodeIndexer, FileRelevanceDetector, and SmartChunker.
- **Platform Healing System**: Owner-only two-tier incident resolution for self-correction of the platform, using identical 13 core tools as regular LomuAI.
- **Replit Agent Parity**: Matches Replit Agent's complex task handling with increased token limits, iterations, self-correction, and concurrency.
- **Credit-Based Billing System**: Production-ready monetization with Stripe integration, usage tracking, and atomic operations.
- **Monetization Infrastructure**: Lead capture, subscription system, webhooks, and a template marketplace.
- **Security & Production Readiness**: Authentication/authorization (Replit Auth, PostgreSQL sessions), protected APIs, rate limiting, bcrypt-hashed API keys, and RCE prevention.

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
- **AI**: Google Gemini 2.5 Flash (primary), Anthropic Claude Sonnet 4 (architect), OpenAI (gpt-image-1)
- **Deployment**: Railway
- **Payment Processing**: Stripe
- **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
- **Charting**: Recharts
- **Browser Automation**: Playwright
- **Web Search**: Tavily API

## Recent Changes
### Gemini Silent Work + Inline Progress (November 8, 2025)
**Fixed FIVE CRITICAL issues to achieve Replit Agent UX parity:**

1. **Storage Import Bug (server/routes/lomuChat.ts)**:
   - ✅ Added missing `import { storage }` - fixed 50+ "ReferenceError: storage is not defined" errors
   - Scratchpad functionality restored for all LomuAI tasks
   - Impact: Scratchpad writes now work correctly

2. **Username Display (client/src/components/working-auth.tsx)**:
   - ✅ Updated welcome message to show actual username (e.g., "Brigido") instead of hardcoded "owner"
   - Uses `user.name` from authenticated user context
   - Impact: Personalized greetings for all users

3. **Inline Progress Display (client/src/hooks/use-websocket-stream.ts, client/src/pages/platform-healing.tsx)**:
   - ✅ Modified WebSocket handler to add ai-thought/ai-action to `progressMessages` array
   - ✅ Updated platform-healing.tsx to render progress inline (without gray boxes)
   - Examples: "🔍 Searching code...", "📖 Reading files...", "✏️ Editing files..."
   - Impact: Clean Replit Agent-style inline indicators

4. **TypeScript Errors (server/gemini.ts)**:
   - ✅ Added `GeminiPart` interface with `thoughtSignature?: string` property
   - ✅ Cast `content.parts as GeminiPart[]` to access thoughtSignature
   - Impact: Zero LSP diagnostics, TypeScript compilation clean

5. **Natural Conversational AI (server/lomuSuperCore.ts)**:
   - ✅ Added 🌟 section: "BE NATURAL, CONVERSATIONAL, AND ALIVE - LIKE REPLIT AGENT"
   - ✅ Philosophy: Gemini is cheap - use tokens to feel HUMAN and NATURAL, not robotic
   - ✅ Conversation flow: Confirm understanding → Execute with inline progress → Deliver results
   - ✅ Examples: Casual responses ("Oh let me check..."), confirmation step ("Ok I hear you - you want X, right?"), natural summaries
   - ✅ Personality: Friendly engineer, shows inline progress (🔍📖✏️), precise but conversational
   - Impact: AI feels alive and interactive while maintaining systematic execution with visible progress

**Result**: LomuAI now matches Replit Agent UX:
- ✅ Natural, conversational tone (feels alive, not robotic)
- ✅ Confirms understanding before executing (user verification step)
- ✅ Inline emoji progress indicators show work in real-time (🔍📖✏️⚙️)
- ✅ Responds to casual questions naturally
- ✅ Personalized welcome messages
- ✅ Working scratchpad system
- ✅ Smart token usage (conversational but not verbose)