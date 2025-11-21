# Lomu - "When Code Throws You Lemons"

## Overview
Lomu is an AI-powered platform for rapid web development, featuring the autonomous AI coding agent LomuAI and dual-version IDE Workspaces (Lomu for desktop, Lomu5 for mobile). It offers a console-first interface, real-time preview, and comprehensive workspace features. The platform aims for production readiness with portable deployment, monetization infrastructure, a template marketplace, and professional development services. LomuAI's key capability is autonomous self-healing, bug fixing, and UI/UX improvements to its own source code, complete with rollback and audit logging. The business vision is to provide a comprehensive, AI-driven platform that simplifies web development, making it accessible and efficient for a wide range of users.

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

**Inline Thinking Display**: LomuAI's thought process is displayed inline with responses using the `EnhancedMessageDisplay` component. Progress messages streamed during execution are captured and persisted with each assistant message, then rendered as collapsible, color-coded blocks:
- **Purple blocks**: Thinking (analyzing, planning, evaluating)
- **Blue blocks**: Tool calls (reading, writing, modifying files)
- **Green blocks**: Results (completed tasks, successful operations)

This organized, unified view mirrors Replit Agent's inline `<thinking>` tags, showing the AI's work process alongside the final response. Progress messages persist with message history, maintaining transparency across sessions.

**Replit Agent-Style Testing UI** (Nov 21, 2025):
- **Full Testing UI Parity**: Complete Replit Agent-style testing interface with:
  - **TestingPanel Component** (`client/src/components/testing-panel.tsx`) - Collapsible panel with browser preview iframe, real-time narration display, and step-by-step progress tracking
  - **Live Browser Preview** - Real-time iframe showing test execution with screenshots
  - **AI Narration Streaming** - Real-time updates like "I'm heading to the app URL..." matching Replit Agent's style
  - **Step Progress Tracking** - Color-coded status indicators (running, passed, failed) with detailed step descriptions
  - **SSE Event System** - 6 new event types: test.started, test.narration, test.step_update, test.screenshot, test.completed, test.failed
  - **Screenshot Persistence** - Latest screenshot persists after step completion, resets on new session
  - **Auto-hide on Completion** - Panel automatically closes 5 seconds after test completion
- **Backend Integration** (`server/tools/browser-test.ts`) - Emits real-time narration and step updates during Playwright testing
- **Tool Wiring** (`server/routes/lomuChat.ts`) - browser_test tool handler passes sendEvent callback for live streaming

**Recent Fixes (Nov 21, 2025)**:
- **Casual Conversation Streaming Fix**: Eliminated 3-second delay and missing responses for simple greetings:
  - **Updated casual system prompt**: Explicitly prohibits thinking/analysis blocks for instant responses
  - **Smart buffering logic**: Only buffers text starting with `**` (thinking pattern), sends everything else immediately
  - **Stream completion flush**: Force-flushes any remaining buffered content when stream ends
  - Result: "hello" → instant "Hello there! How can I help you today?" with smooth word-by-word streaming
- **SSE Format Mismatch Fix** (Nov 19): Fixed critical bug where backend was spreading data directly into SSE events instead of wrapping in `{ type, data }` envelope. Frontend expects `eventData.data.content` but was receiving `eventData.content`, causing ALL events to be discarded. Fixed by:
  - Backend `sendEvent()` now wraps: `{ type, data }` instead of `{ type, ...data }`
  - Frontend extracts: `const payload = eventData.data || {}` then accesses `payload.content`
  - Updated ALL 16+ event handlers to use `payload.x` pattern
  - This fix restores text streaming, run/task updates, and progress display
- **React State Mutation Fix** (Nov 19): Changed from direct `.push()` mutation to immutable spread operator (`[...(array || []), newItem]`), ensuring React detects state changes
- **Dual Transport Fix** (Nov 19): RunStateManager now broadcasts via BOTH WebSocket AND SSE by accepting `sendEvent` callback, ensuring run/task events reach task panel

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
- **Auto-Commit & Auto-Push**: Full Replit Agent parity with TypeScript validation gate.
- **Inline Thinking Display**: Unified progress visualization with collapsible, color-coded blocks showing LomuAI's reasoning, tool use, and results inline with responses.
- **Credit-Based Billing System**: Production-ready monetization with Stripe.
- **Monetization Infrastructure**: Lead capture, subscriptions, template marketplace.
- **Security & Production Readiness**: Authentication/authorization, protected APIs, RCE prevention.
- **Vision Analysis**: LomuAI can analyze images and screenshots.
- **Strict Function Calling**: Transport-layer enforcement of JSON function calling for Gemini.
- **Production-Ready Code Validation System**: 3-layer validation architecture (pre-write, pre-commit) to prevent broken code. Includes JSON healing and validation caching.
- **Telemetry System**: Tracks healing attempts, successes, failures with detailed statistics.
- **Reflection and Structured Retry Mandate**: LomuAI analyzes tool failures, states root cause, and proposes alternative strategies before retrying.
- **Priority 1 Safety Mechanisms** (Production-Ready ✅):
  - **P1-GAP-1: Auto-Rollback on Validation Failure** - Mandatory backup creation before execution; automatic rollback with workflow state cleanup (`fileChangeTracker.clear()`) if validation fails
  - **P1-GAP-2: Server Startup Integration Test** - Real `server/index.ts` smoke test in production mode (skips Vite); waits for "serving on port" signal + HTTP health probe to catch middleware/config/runtime regressions
  - **P1-GAP-3: GitHub API Retry with Exponential Backoff** - Enhanced retry logic with `exponentialBackoffWithJitter` for 429/503 rate limit errors
- **Phase 1 Multi-User Safety** (Production-Ready ✅, Architect-Approved):
  - **BRAIN-GAP-1: Workspace Isolation** - Simplified FIFO file locking with centralized state management, per-request timeouts, queue deadlock prevention, expired lock cleanup. 37% simpler architecture (300 vs 479 lines)
  - **BRAIN-GAP-2: Stale Session Cleanup** - Active schedulers (30s stale detection + 10min cleanup), timeout-protected lock release (5s limit), try/finally pattern guarantees registry cleanup, heartbeat mechanism via `touchSession()`
  - **BRAIN-GAP-3: Crash Recovery** - Async init pattern with readiness guards, startup crash recovery sweep, metadata persistence on ALL state changes, transaction-like file operations with `.temp/` backups, automatic 24h retention
  - **Production Guarantees**: Multi-user isolation (no file clobbering), resource cleanup (no zombie sessions/orphaned locks), crash recovery (never reverses legitimate operations), no hanging promises (all resolve/reject exactly once)
  - **Comprehensive Testing**: 12/12 integration tests passing (3.22s) with fake timers for deterministic validation - FIFO ordering, timeout handling, concurrent requests, session lifecycle

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