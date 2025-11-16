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

5.  **Production-Grade Rate Limit Protection (429 Error Handling)**
    
    **Phase 1: Token Bucket Rate Limiter** (`server/services/rateLimiter.ts`)
    -   **Capacity**: 900K tokens/min (90% of 1M Gemini API limit)
    -   **Refill Rate**: 15K tokens/sec for smooth distribution
    -   **Overflow Guard**: Rejects requests exceeding capacity with clear error message
    -   **Queue**: FIFO processing for graceful request handling
    -   **Backoff Helper**: Exponential backoff with jitter (baseDelay × 2^attempt + random jitter)
    -   **Token Estimation**: 1 token ≈ 4 characters for request sizing
    
    **Phase 2: Gemini API Integration** (`server/gemini.ts`)
    -   **Pre-Request Acquisition**: Checks token availability before stream start
    -   **Full Retry Loop**: Wraps entire stream with 3 retry attempts
    -   **Mid-Stream Detection**: Catches 429 errors during active streaming
    -   **Promise-Safe Callbacks**: `await Promise.resolve().then()` isolates onComplete errors from retry logic
    -   **Exponential Backoff**: Uses rate limiter's backoff helper with max 60s delay cap
    -   **API Delay Extraction**: Parses retry-after from Gemini error responses
    -   **User-Friendly Messages**: Clear explanations with actionable guidance
    
    **Phase 3: Frontend Graceful Degradation** (`client/src/components/universal-chat.tsx`)
    -   **Rate Limit Detection**: Monitors progress messages for rate limit indicators
    -   **Toast Notifications**: Non-destructive alerts with retry information (no emojis)
    -   **Clear Communication**: User-friendly messages explaining wait times
    
    **Benefits**:
    - ✅ Prevents request bursts that trigger 429 errors
    - ✅ Automatic retry with exponential backoff when limits hit
    - ✅ Callback errors isolated from retry loop (no infinite retries)
    - ✅ User-friendly error handling with actionable guidance
    - ✅ Production-ready monitoring and telemetry

**Result**: Production-grade Gemini function calling with automatic recovery, hybrid parsing, intent-based mode selection, comprehensive safety guards, and bulletproof rate limit protection. Zero-mutation failures eliminated while preserving natural conversation capabilities.

### Testing Infrastructure
**Production-Ready LomuAI Testing System** - Completed and verified via comprehensive Playwright tests:

**Billing Bypass Options:**
1. **Owner Account (Primary)** - `scripts/create-root-account.ts`
   - Account: root@getdc360.com / admin123@*
   - Auto-bypasses billing via `isOwner=true` flag
   - Redirects to `/platform-healing` for free platform fixes
   - Script idempotently updates/creates owner account
   
2. **Dev Bypass Flag (Backup)** - `server/middleware/creditValidation.ts`
   - Environment variable: `LOMU_BILLING_BYPASS=true`
   - Dev-only flag for testing without owner privileges
   - **OPS NOTE**: Never set in production - dev/staging only
   - Preserves normal billing flow when unset
   - Security-safe (doesn't grant owner privileges)

**Playwright Test Results** (Comprehensive):
- ✅ Authentication flow: /auth login works correctly
- ✅ Owner redirect: Auto-redirects to /platform-healing
- ✅ Chat functionality: Message send/receive verified
- ✅ LomuAI streaming: Gemini 2.5 Flash responds correctly
- ✅ Rate limit protection: No 429 errors, graceful handling
- ✅ No crashes or fatal errors
- ⚠️ Minor WebSocket reconnects (non-critical, auto-recovers)

**Authentication Routes:**
- Login page: `/auth` (not `/login`)
- Test IDs: `input-login-email`, `input-login-password`, `button-login`
- Owner redirect: `/platform-healing` (free access)
- Regular user redirect: `/dashboard` (credit-based billing)

**Monitoring Notes:**
- WebSocket reconnects occasionally occur but recover gracefully
- "Connection lost" banner may appear briefly during reconnection
- No impact on core functionality - monitored for staging/production

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
The platform is built with a React frontend, an Express.js backend, and PostgreSQL for data persistence. It uses a unified codebase for Lomu (Desktop, 4-panel layout) and Lomu5 (Mobile, bottom tab navigation), sharing backend APIs, WebSockets, authentication, and database access.

### UI/UX Decisions
The user interface features a tab-based workspace with a command console and real-time live preview. The design uses a professional swarm/hive theme with honey-gold and mint-teal accents, utilizing card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces use semantic theme tokens for consistent, polished appearance with modern message bubbles and smooth transitions. Loading states feature smooth animations.

The platform implements a comprehensive Agent Chatroom interface with real-time progress tracking, including a StatusStrip, TaskPane, ToolCallCard, and ArtifactsDrawer, all driven by 16 structured event types streamed via Server-Sent Events (SSE). A single `UniversalChat` component (`client/src/components/universal-chat.tsx`) handles all chat interactions.

### System Design Choices
LomuAI acts as the autonomous worker, committing changes through a strict 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT). I AM Architect is a user-summoned premium consultant providing guidance without committing code. The system supports parallel subagent execution, real-time streaming, usage-based billing, and self-testing. LomuAI incorporates efficiency rules within its system prompt, such as SEARCH BEFORE CODING, COPY DON'T REINVENT, VERIFY THE TASK, and ITERATION BUDGET AWARENESS.

A centralized session management system (`server/services/lomuAIBrain.ts`) consolidates all session logic into a hybrid architecture with in-memory registry and database durability. The access model provides owner-only access for platform healing, usage-based credit billing for regular LomuAI, and premium consulting for I AM Architect.

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
- **Production-Ready Code Validation System**: 3-layer validation architecture (pre-write, pre-commit) to prevent broken code. Includes JSON healing and validation caching.
- **Telemetry System**: Tracks healing attempts, successes, failures with detailed statistics.
- **Reflection and Structured Retry Mandate**: LomuAI analyzes tool failures, states root cause, and proposes alternative strategies before retrying.

The platform prioritizes native JSON function calling for AI streaming due to superior speed, reliability, and type safety, integrating utilities for validation, retry logic, and file change tracking.

**Feature Specifications:**
- **Workspace Features**: Tab-based navigation, unified talk & build interface, Monaco editor, full project ZIP export.
- **Publishing/Deployment System**: Management of deployments, logs, and analytics.
- **Team Workspaces**: Collaboration with role-based access.
- **API Key Management**: Secure system for Pro+ users.
- **Support Ticketing**: Complete system with plan-based SLA.
- **AI Request Management**: Priority processing queue, real-time cost preview, usage dashboard, token-based pricing, parallel subagent execution.
- **Advanced AI Development Features**: Sub-Agent/Task Runner System, Message Queue, Autonomy Controls, AI Image Generation, Dynamic Intelligence, Plan Mode, Design Mode, Workflows, Agents & Automations, and General Agent Mode.

## External Dependencies
-   **Frontend**: React, TypeScript, Monaco Editor, Tailwind CSS, Shadcn UI, next-themes
-   **Backend**: Express.js, WebSocket
-   **Database**: PostgreSQL (Neon), Drizzle ORM
-   **AI**: Google Gemini 2.5 Flash, Anthropic Claude Sonnet 4, OpenAI (gpt-image-1)
-   **Deployment**: Railway
-   **Payment Processing**: Stripe
-   **Authentication**: Passport.js, bcrypt, `connect-pg-simple`
-   **Charting**: Recharts
-   **Browser Automation**: Playwright
-   **Web Search**: Tavily API