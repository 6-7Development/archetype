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

**Gemini Resilience Engineering (Production-Ready Function Calling):**
Comprehensive fixes for Gemini's function calling quirks ensure production-grade reliability:

1.  **Stuck Detection Threshold (Recovery Time)**
    -   `noProgressCount >= 4` (increased from 2) for no-tool-call detection
    -   `MAX_READ_ONLY_ITERATIONS: 20` for read-only iterations
    -   **Purpose**: Gives LomuAI 3-5 reasoning steps to fail, diagnose, retry, and recover from I AM Architect guidance

2.  **Intent-Sensitive Mode Control (Smart Function Calling)**
    -   **Implementation**: Dynamic mode selection based on user intent and tool availability
    -   **Logic**: `mode: 'ANY'` for fix/build requests + retries, `mode: 'AUTO'` for casual questions
    -   **Safety Guards**:
        - Falls back to AUTO when `forceFunctionCall=true` but no tools available
        - Aggregates function names from ALL tool entries (not just first)
        - Prevents API rejection from empty `allowedFunctionNames`
    -   **Behavior**:
        - Fix/build requests → forces tool calling (mode: ANY)
        - Casual questions → allows natural responses (mode: AUTO)
        - Retry logic → `forceFunctionCall=true` overrides to ANY
    -   **Location**: `server/gemini.ts` lines 546-578
    -   **Frontend**: Added "progress" event handler to display workflow failures

3.  **Response Parsing Fallback (Hybrid Parser - The Missing Link)**
    -   **Step 1**: Check `part.functionCall` (correct API format)
    -   **Step 2**: Aggressive regex scan of `part.text` for JSON if function_calls empty
    -   **Features**: String-aware balanced brace parser, markdown fence stripping, incremental offset tracking
    -   **Purpose**: Bypasses Gemini bug where function calls appear in text field instead of functionCall field
    -   **Location**: `server/gemini.ts` lines 624-744

4.  **Fortified Retry Handler (Self-Correction)**
    -   **Instruction**: "🛑 SYSTEM ERROR: The last output was malformed. You must not use Python syntax. You must IMMEDIATELY RETRY the tool call using ONLY the JSON structure. Do not add any explanatory text or commentary."
    -   **Mechanism**: On `MALFORMED_FUNCTION_CALL`, inserts disciplined corrective instruction + forces `mode: 'ANY'` with specific function
    -   **Purpose**: Directs agent's attention to syntax error and forces disciplined recovery attempt
    -   **Integration**: Works with intent-sensitive mode to ensure retries use forced tool calling

**Result**: Production-grade Gemini function calling with automatic recovery, hybrid parsing, intent-based mode selection, and comprehensive safety guards. Zero-mutation failures eliminated while preserving natural conversation capabilities.

### Design Preferences
-   **Brand Identity**: Professional swarm/hive intelligence theme with collaborative AI energy
-   **Color Palette (Hive Theme)**:
    -   Honey (40 97% 50% / #F7B500) - Primary warm golden
    -   Nectar (48 100% 65% / #FFD34D) - Accent light golden
    -   Mint (171 100% 42% / #00D4B3) - Success fresh teal
    -   Charcoal (216 9% 7% / #101113) - Deep backgrounds
    -   Graphite (216 11% 12% / #1B1D21) - Professional text
    -   Cream (47 100% 95% / #FFF8E6) - Soft warm backgrounds
-   **Visual Language**:
    -   Professional, collaborative interfaces with hive intelligence
    -   Card-based layouts with warm shadows
    -   Clean, modern design with generous spacing
    -   Inter font family for UI text, JetBrains Mono for code
    -   Light mode primary with dark mode support
    -   Smooth animations for loading and transitions
-   **Swarm/Hive Elements**:
    -   Honeycomb patterns for organizational structures
    -   Warm golden accents throughout the UI
    -   Collaborative AI agent indicators
    -   Interconnected network visualizations

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

**Universal Chat Architecture:**
The platform uses a **single UniversalChat component** (`client/src/components/universal-chat.tsx`) as the foundation for all chat interactions, providing platform healing and user project support with context-aware access control, smart billing, and WebSocket isolation, leading to significant code reduction and identical Agent Chatroom UX across contexts.

**Unified LomuAI Brain:**
The platform features a **centralized session management system** (`server/services/lomuAIBrain.ts`) that consolidates all scattered session logic into a hybrid architecture with in-memory registry and database durability. It ensures session isolation, comprehensive tracking of conversation, execution, billing, and transport, with auto-cleanup and duplicate prevention mechanisms.

### System Design Choices
LomuAI acts as the autonomous worker, committing changes through a strict 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT). I AM Architect is a user-summoned premium consultant that provides guidance without committing code. The system supports parallel subagent execution, real-time streaming, usage-based billing, and self-testing.
LomuAI incorporates efficiency rules within its system prompt, such as SEARCH BEFORE CODING, COPY DON'T REINVENT, VERIFY THE TASK, and ITERATION BUDGET AWARENESS.
The access model provides owner-only access for platform healing, usage-based credit billing for regular LomuAI, and premium consulting for I AM Architect. A competitive credit system leverages Gemini 2.5 Flash's cost advantage for billing, with multiple subscription tiers.

**Key Features:**
- **Optimized Tool Distribution Architecture**: LomuAI (18 tools), Sub-Agents (12 tools), I AM Architect (23 tools), with automatic tool count validation.
- **GitHub Integration**: Full version control.
- **Environment Variables Management**: Project-level secrets.
- **Code Intelligence System**: AST-based code understanding.
- **Platform Healing System**: Owner-only two-tier incident resolution.
- **Replit Agent Parity**: Matches complex task handling with increased limits.
- **Credit-Based Billing System**: Production-ready monetization with Stripe.
- **Monetization Infrastructure**: Lead capture, subscriptions, template marketplace.
- **Security & Production Readiness**: Authentication/authorization, protected APIs, RCE prevention.
- **Vision Analysis**: LomuAI can analyze images and screenshots.
- **Strict Function Calling**: Transport-layer enforcement of JSON function calling for Gemini.
- **Production-Ready Code Validation System**: Implemented a 3-layer validation architecture for Gemini's responses, pre-write, and pre-commit to prevent broken code from being committed. Includes JSON healing and validation caching.
- **Telemetry System**: Tracks healing attempts, successes, failures with detailed statistics.
- **Reflection and Structured Retry Mandate**: LomuAI is mandated to analyze tool failures, state root cause, and propose alternative strategies before retrying.

**Enhanced JSON Healing System**:
1. **Robust JSON Healing** (`server/gemini.ts`): Smart brace/bracket counting, incomplete string closure, missing bracket completion, aggressive pre-repair.
2. **Healing Telemetry Service** (`server/services/healingTelemetry.ts`): Tracks attempts, successes, failures; auto-logs stats in production.
3. **Reflection & Retry Mandate** (`server/lomuSuperCore.ts`): Requires explicit root cause analysis and alternative strategies for failed tool calls.
4. **Validation Caching** (`server/services/codeValidator.ts`): SHA-256 hash-based caching for TypeScript/ESLint validation results with 5-minute TTL.
5. **Integration Testing**: 17 comprehensive tests using Vitest covering truncation, arguments, and edge cases.

### Streaming Architecture
The platform prioritizes native JSON function calling for AI streaming due to superior speed, reliability, and type safety, integrating utilities for validation, retry logic, and file change tracking.

### Feature Specifications
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Management of deployments, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access.
- **API Key Management**: Secure system for Pro+ users.
- **Support Ticketing**: Complete system with plan-based SLA.
- **AI Request Management**: Priority processing queue, real-time cost preview, usage dashboard, token-based pricing, parallel subagent execution.
- **Advanced AI Development Features**: Sub-Agent/Task Runner System, Message Queue, Autonomy Controls, AI Image Generation, Dynamic Intelligence, Plan Mode, Design Mode, Workflows, Agents & Automations, and General Agent Mode.

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