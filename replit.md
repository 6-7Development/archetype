# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring the autonomous AI coding agent LomuAI and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. LomuAI's key capability is autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging. The business vision is to provide a comprehensive, AI-driven platform that simplifies web development, making it accessible and efficient for a wide range of users.

## Recent Fixes (Nov 22, 2025)
**✅ COMPLETE: Backend & Frontend Modularization**:
- **Mission**: Transform monolithic files into focused modules to dramatically improve LomuAI's self-healing capability by reducing file sizes below the 3-read anti-paralysis limit

**Backend Modularization (3 Major Refactorings):**
1. **lomuChat.ts** - Streaming handler modularization
   - Reduced from 5,020 → 1,063 lines (79% reduction)
   - Extracted 9 focused modules: orchestrator.ts, types.ts, request-validation.ts, billing-setup.ts, session-bootstrap.ts, context-preparation.ts, stream-emitter.ts, iteration-controller.ts, error-cleanup.ts
   - All critical functionality preserved: tool execution, token management, approval workflow, billing settlement
   - Single settlement path in orchestrator.ts finally block eliminates double-charging risk

2. **lomuSuperCore.ts** - Prompt builder modularization
   - Restructured from 1,268 lines into 5 focused modules
   - Modules: config.ts (18 lines), promptSections.ts (247 lines), promptBuilder.ts (87 lines), tooling.ts (63 lines), architectPrompt.ts (92 lines)
   - Clean index.ts orchestrator with centralized exports
   - Separated I AM Architect prompt building (architectPrompt.ts) from LomuAI prompt building (promptBuilder.ts)

3. **Type Safety & Integration**
   - All discriminated unions for SSE events, tool operations, persistence operations
   - Comprehensive interfaces for type safety across all modules
   - Zero LSP diagnostics after full modularization

**Frontend Modularization (1 Major Refactoring):**
1. **universal-chat.tsx** - Chat UI component extraction
   - Reduced from 2,293 → 1,790 lines (22% reduction, 503 lines removed)
   - Extracted 5 focused components:
     - `useStreamEvents.ts` (145 lines): SSE event handling hook with runStateReducer
     - `ChatMessages.tsx` (330 lines): Complete message rendering with overlays, checkpoints, scratchpad, WebSocket status
     - `ChatInput.tsx` (108 lines): Input area with image uploads and toolbar
     - `StatusBar.tsx` (33 lines): Progress status display
     - `ChatDialogs.tsx` (368 lines): All 10 dialogs/drawers consolidated
   - Feature parity achieved: All overlays, checkpoints, scratchpad, streaming indicators, WebSocket status, billing controls preserved
   - Architect-reviewed PASS: Zero functionality loss, clean component composition

**Impact on Anti-Paralysis System:**
- ✅ lomuChat.ts: Now 1,063 lines (was 5,020) - LomuAI can read entire orchestrator in 1 pass
- ✅ lomuSuperCore modules: Largest is 247 lines - all fit in 1 read
- ✅ universal-chat.tsx: Now 1,790 lines (was 2,293) - Still large but 22% improvement
- ✅ **Result**: LomuAI can now efficiently self-heal backend streaming logic and prompt building without hitting 3-read limit

**Previous Fixes (Nov 21, 2025):**
**✅ Fixed: SSE Streaming Bug**:
- **Issue**: Chat UI showed "Thinking..." with no streamed text, then entire response appeared at once
- **Root Cause**: onChunk handler buffered ALL text as "thinking blocks", never emitting `content` events
- **Fix Applied**: Modified `server/routes/lomuChat.ts` (lines 1900-1943) to emit content chunks IMMEDIATELY for real-time word-by-word streaming, while still detecting thinking patterns in parallel
- **Result**: Text now streams word-by-word like ChatGPT/Replit Agent ✅

**✅ Fixed: Missing Tools**:
- **Issue**: LomuAI only had 5 tools, missing critical search/file operations
- **Fix Applied**: Replaced hard-coded tool array with centralized `LOMU_CORE_TOOLS` from `tools/tool-distributions.ts`
- **Final Tool Count**: 18 tools (optimized for Google's 10-20 recommendation)
- **Tools Included**: read, write, search_codebase, grep_tool, ls, smart_read_file, get_auto_context, extract_function, create_task_list, update_task, read_task_list, perform_diagnosis, architect_consult, bash, refresh_all_logs, glob, web_search
- **Result**: LomuAI uses efficient search instead of reading entire 5312-line files ✅

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

LomuAI's thought process is displayed inline with responses using the `EnhancedMessageDisplay` component. Progress messages streamed during execution are captured and persisted with each assistant message, then rendered as collapsible, color-coded blocks: Purple for thinking, Blue for tool calls, and Green for results. This organized, unified view mirrors Replit Agent's inline `<thinking>` tags.

The system includes a Replit Agent-style Testing UI with a collapsible `TestingPanel` component for live browser previews, AI narration streaming, and step progress tracking, all powered by SSE events.

### System Design Choices
LomuAI acts as the autonomous worker, committing changes through a strict 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT). I AM Architect is a **manually-triggered premium consultant** providing guidance without committing code - it does NOT automatically heal the platform. The system supports parallel subagent execution, real-time streaming, usage-based billing, and self-testing. LomuAI incorporates efficiency rules within its system prompt, such as SEARCH BEFORE CODING, COPY DON'T REINVENT, VERIFY THE TASK, and ITERATION BUDGET AWARENESS.

**Platform Healing Architecture**:
- **LomuAI**: Autonomous worker that executes changes (Gemini 2.5 Flash)
- **I AM Architect**: Owner-triggered consultant for strategic guidance (Claude Sonnet 4)
  - **Manual activation only** - Owner must trigger via UI
  - **Consultative role** - Analyzes, recommends, but doesn't auto-fix
  - **Requires approval** - All changes need owner confirmation
- **HealOrchestrator**: Monitors health incidents, can auto-trigger workflows for critical issues
- **Incident System**: Logs failures → Owner reviews → Manually triggers I AM Architect if needed

A centralized session management system (`server/services/lomuAIBrain.ts`) consolidates all session logic into a hybrid architecture with in-memory registry and database durability. The access model provides owner-only access for platform healing, usage-based credit billing for regular LomuAI, and premium consulting for I AM Architect.

**Key Features:**
- **Optimized Tool Distribution Architecture**: LomuAI (18 tools), Sub-Agents (12 tools), I AM Architect (23 tools), with automatic tool count validation.
- **GitHub Integration**: Full version control.
- **Environment Variables Management**: Project-level secrets.
- **Code Intelligence System**: AST-based code understanding.
- **Platform Healing System**: Owner-only two-tier incident resolution.
- **Replit Agent Parity**: Matches complex task handling with increased limits, including auto-commit and auto-push with TypeScript validation.
- **Inline Thinking Display**: Unified progress visualization with collapsible, color-coded blocks showing LomuAI's reasoning, tool use, and results inline with responses.
- **Credit-Based Billing System**: Production-ready monetization with Stripe.
- **Monetization Infrastructure**: Lead capture, subscriptions, template marketplace.
- **Security & Production Readiness**: Authentication/authorization, protected APIs, RCE prevention.
- **Vision Analysis**: LomuAI can analyze images and screenshots.
- **Strict Function Calling**: Transport-layer enforcement of JSON function calling for Gemini.
- **Production-Ready Code Validation System**: 3-layer validation architecture (pre-write, pre-commit) to prevent broken code. Includes JSON healing and validation caching.
- **Telemetry System**: Tracks healing attempts, successes, failures with detailed statistics.
- **Reflection and Structured Retry Mandate**: LomuAI analyzes tool failures, states root cause, and proposes alternative strategies before retrying.
- **Anti-Paralysis System**: Three-layer defense (system prompt, diagnosis tool, runtime enforcement) to prevent repeated reading of large files, ensuring efficient execution.
- **Priority 1 Safety Mechanisms**: Auto-rollback on validation failure, server startup integration tests, and GitHub API retry with exponential backoff.
- **Phase 1 Multi-User Safety**: Workspace isolation using FIFO file locking, stale session cleanup, and crash recovery with metadata persistence and transactional file operations.

The platform prioritizes native JSON function calling for AI streaming due to superior speed, reliability, and type safety, integrating utilities for validation, retry logic, and file change tracking.

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