# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring LomuAI, an autonomous AI coding agent, and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. A key capability is LomuAI's autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging. The business vision is to provide a comprehensive, AI-driven platform that simplifies web development, making it accessible and efficient for a wide range of users, from individual developers to large enterprises.

## Recent Changes
### Production-Ready Code Validation System (2025-11-14)
Implemented 3-layer validation architecture to prevent LomuAI from committing broken code with syntax errors:

**Layer 1: Gemini Response Validation** (`server/gemini.ts` lines 843-895):
- Smart escape detection in function call arguments
- Only flags LomuAI's specific bug patterns: `.join('\\n')`, `.replace(x, '\\n')`, `}\n}`
- Recursive object inspection without false positives from JSON encoding
- Throws MALFORMED_FUNCTION_CALL error to trigger retry logic

**Layer 2: Pre-Write Validation** (`server/platformHealing.ts` lines 577-586):
- Quick validation before file write using `codeValidator.validateSingleFile()`
- Catches malformed escape sequences before they reach the filesystem

**Layer 3: Pre-Commit Validation** (`server/platformHealing.ts`):
- Development: Lines 750-770 - Full validation before local Git commit
- Production: Lines 714-728 - Validation before GitHub push
- Checks: TypeScript compilation (tsc --noEmit), ESLint, escape patterns, git diff sanity

**Code Validator Service** (`server/services/codeValidator.ts`):
- Smart pattern detection avoiding false positives
- Non-global regex to prevent lastIndex issues
- Comprehensive error reporting with actionable hints

**System Prompt Updates** (`server/lomuSuperCore.ts` lines 500-504):
- Added CODE QUALITY GATES section warning about validation blocks

**JSON Healing System** (`server/gemini.ts`):
- Installed `jsonrepair` library to fix truncated Gemini API responses
- Lines 53-77: `robustExtractAndHeal()` function repairs missing closing braces
- Lines 671-715: Integrated into streaming parser (replaced 140-line balanced-brace parser)
- Fixes "Connection lost" / "No tool calls" errors caused by incomplete JSON
- Retry protocol when healing fails

**Production-Ready Enhancements (2025-11-15)**:

**1. Enhanced JSON Healing with Smart Brace Counting** (`server/gemini.ts`):
- String-aware brace/bracket counting (ignores braces in quoted strings)
- Detects and closes incomplete strings before adding closing braces
- Counts and adds missing `}` and `]` for nested structures
- Aggressive pre-repair before jsonrepair fallback
- Exported for integration testing
- Success rate: 90% in production tests (9/10 attempts)

**2. Telemetry System** (`server/services/healingTelemetry.ts` - NEW):
- Tracks healing attempts, successes, failures with detailed statistics
- Auto-logs stats every 5 minutes in production (uses `unref()` to prevent process hanging)
- Lifecycle methods: `startAutoLogging()`, `stopAutoLogging()`
- Only runs in production (`NODE_ENV !== 'test'`)
- Provides `getStats()` for real-time monitoring

**3. Reflection and Structured Retry Mandate** (`server/lomuSuperCore.ts`):
- Added "REFLECTION AND STRUCTURED RETRY MANDATE" section to system prompt
- Requires LomuAI to pause and analyze tool failures before attempting fixes
- Must state root cause explicitly before retrying
- Mandates 2-3 alternative strategies before asking for help
- Special handling for JSON truncation errors with corrective prompts

**4. Integration Tests** (`server/__tests__/jsonHealing.test.ts` - NEW):
- 17 comprehensive tests using Vitest framework
- Tests import real production code (no duplication)
- Coverage: basic truncation, complex arguments, edge cases, telemetry integration
- 100% pass rate (17/17 tests)
- Proper exit codes (0 on success, 1 on failure)
- Run with: `./test.sh` or `npx vitest run`

**5. Validation Caching** (`server/services/codeValidator.ts`):
- SHA-256 hash-based caching for TypeScript/ESLint validation results
- 5-minute TTL to balance freshness and performance
- Auto-cleanup of stale cache entries
- Reduces validation overhead on repeated file checks

**6. Test Automation** (`test.sh` - NEW):
- Executable script runs complete test suite
- Exits 0 on success, 1 on failure (CI/CD compatible)
- Usage: `./test.sh` (all tests), `./test.sh --watch` (watch mode), `./test.sh --ui` (UI mode)
- **IMPORTANT**: Run before committing changes to JSON healing system

**Impact:** 
- Prevents the double-escape bug (commit 8ab2e16) and other syntax errors from being committed during platform self-healing
- Fixes Gemini JSON truncation issue that caused LomuAI to appear "disconnected" in chat
- Ensures reliable tool execution even when Gemini sends incomplete function call JSON
- LomuAI now self-corrects when tool calls fail (reflection mandate)
- Comprehensive test coverage prevents regressions
- Intelligent caching speeds up validation workflow
- Real-time telemetry provides visibility into healing success rates

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

2.  **Core Incompatibility Fix (Forced Function Calling)**
    -   `mode: 'ANY'` with `allowed_function_names` array in `toolConfig`
    -   **Implementation**: Custom `toolConfig` parameter in `StreamOptions` interface
    -   **Purpose**: Forces Gemini to use proper JSON function calling instead of Python-like syntax
    -   **Location**: `server/gemini.ts` lines 505-528

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
    -   **Location**: `server/gemini.ts` lines 497-547

**Result**: Production-grade Gemini function calling with automatic recovery, hybrid parsing, and forced tool use modes.

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