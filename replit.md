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
- **Brand Identity**: Professional swarm/hive intelligence theme with collaborative AI energy
- **Color Palette (Hive Theme)**:
  - Honey (40 97% 50% / #F7B500) - Primary warm golden
  - Nectar (48 100% 65% / #FFD34D) - Accent light golden
  - Mint (171 100% 42% / #00D4B3) - Success fresh teal
  - Charcoal (216 9% 7% / #101113) - Deep backgrounds
  - Graphite (216 11% 12% / #1B1D21) - Professional text
  - Cream (47 100% 95% / #FFF8E6) - Soft warm backgrounds
- **Visual Language**:
  - Professional, collaborative interfaces with hive intelligence
  - Card-based layouts with warm shadows
  - Clean, modern design with generous spacing
  - Inter font family for UI text, JetBrains Mono for code
  - Light mode primary with dark mode support
  - Smooth animations for loading and transitions
- **Swarm/Hive Elements**:
  - Honeycomb patterns for organizational structures
  - Warm golden accents throughout the UI
  - Collaborative AI agent indicators
  - Interconnected network visualizations

## System Architecture
The platform is built with a React frontend, an Express.js backend, and PostgreSQL for data persistence.

### Dual-Version Architecture
The platform uses a unified codebase for Lomu (Desktop, 4-panel layout) and Lomu5 (Mobile, bottom tab navigation), sharing backend APIs, WebSockets, authentication, and database access.

### UI/UX Decisions
The user interface features a tab-based workspace with a command console and real-time live preview. The design uses a professional swarm/hive theme with honey-gold and mint-teal accents, utilizing card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces use semantic theme tokens for consistent, polished appearance with modern message bubbles and smooth transitions. Loading states feature smooth animations.

**Agent Chatroom UX (100% Replit Agent Parity):**
The platform implements a comprehensive Agent Chatroom interface with real-time progress tracking:
- **StatusStrip**: Live phase indicator showing current agent state (🤔 thinking → 📝 planning → 🛠️ working → 🧪 verifying → ✅ complete)
- **TaskPane**: Kanban-style task board with columns (Backlog → In Progress → Verifying → Done → Blocked)
- **ToolCallCard**: Transparent tool execution display showing function calls, parameters, and results
- **ArtifactsDrawer**: File changes tracker showing modified files, generated URLs, and test reports with copy-to-clipboard
- **Event System**: 16 structured event types (thinking, planning, task_update, tool_call, artifact_created, etc.) streamed via Server-Sent Events (SSE)
- **Mobile + Desktop**: Fully responsive across both Lomu (desktop) and Lomu5 (mobile) interfaces

**Clean 2-Chat Architecture:**
The platform uses exactly **2 active chat components** for clean separation of concerns:
1. **`client/src/components/ai-chat.tsx`** - Regular user project builds (all authenticated users, usage-based billing)
2. **`client/src/pages/platform-healing.tsx`** - Platform healing (root/owner only, FREE for platform self-correction)

Both chats share identical Agent Chatroom UX components and event streaming infrastructure, ensuring consistent user experience across regular development and platform maintenance workflows. The dual-chat architecture enables clear access control while maintaining code reusability through shared components.

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
- **Strict Function Calling**: Transport-layer enforcement of JSON function calling for Gemini, ensuring "application/json" responseMimeType, "ANY" mode for forced tool calls, explicit `allowedFunctionNames`, and `temperature: 0.0` for determinism. **Full compliance documentation:** See `docs/GEMINI_INTEGRATION.md` for comprehensive implementation details proving 100% adherence to industry best practices.

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