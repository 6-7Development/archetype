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

### Universal RBAC System
A dynamic role-based access control system (`shared/rbac.ts`) serves as a single source of truth for permissions, supporting 'user', 'admin', 'owner' roles, five resources (platform, projects, healing, admin, billing, team), and five actions (read, write, delete, execute, manage). It offers zero configuration, immediate application of permission matrix changes, and frontend hooks for permission checks.

### UI/UX Decisions
The UI features a tab-based workspace with a command console and real-time live preview, adhering to a professional swarm/hive theme with honey-gold and mint-teal accents. It uses card-based layouts, warm shadows, smooth transitions, and ADA/WCAG accessibility. Chat interfaces utilize semantic theme tokens for consistent messaging and display LomuAI's thought process inline with responses using `EnhancedMessageDisplay` and collapsible, color-coded blocks for thinking, tool calls, and results. A comprehensive Agent Chatroom interface includes real-time progress tracking via SSE events, managed by a `UniversalChat` component. A Replit Agent-style Testing UI with a `TestingPanel` provides live browser previews, AI narration, and step progress tracking.

### System Design Choices
LomuAI operates as an autonomous worker using a 7-phase workflow (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT). I AM Architect is a manually-triggered premium consultant, providing strategic guidance without committing code. The system supports parallel subagent execution, real-time streaming, usage-based billing, and self-testing. LomuAI incorporates efficiency rules like SEARCH BEFORE CODING and ITERATION BUDGET AWARENESS.

**Platform Healing Architecture**:
-   **LomuAI**: Autonomous worker executing changes (Gemini 2.5 Flash).
-   **I AM Architect**: Owner-triggered consultant for strategic guidance (Claude Sonnet 4), requiring manual activation and owner approval for changes.
-   **Autonomous Healing Button**: One-click background healing process with toast notifications and incident count updates.
-   **HealOrchestrator**: Monitors health incidents and can auto-trigger workflows.
-   **Incident System**: Logs failures for owner review and manual I AM Architect triggering.

A centralized session management system (`server/services/lomuAIBrain.ts`) combines in-memory and database persistence. The access model provides owner-only access for platform healing, usage-based billing for LomuAI, and premium consulting for I AM Architect.

Key features include optimized tool distribution, universal RBAC, GitHub integration, environment variable management, AST-based code intelligence, production-ready monetization with Stripe, robust security measures (RCE prevention, protected APIs), vision analysis (image/screenshot analysis), strict JSON function calling, a 3-layer code validation system, telemetry, reflection and structured retry mechanisms, an anti-paralysis system, and priority safety mechanisms like auto-rollback and server startup integration tests. Phase 1 multi-user safety includes workspace isolation, stale session cleanup, and crash recovery. All API calls include `credentials: 'include'` for proper session cookie authentication.

### Configuration System
The platform uses a centralized configuration approach:
-   **`app.config.ts`**: Global settings including branding, themes, APIs, chat, UI constants, feature flags, and environment detection.
-   **`constants.ts`**: Defines application routes, API endpoints, UI constants, validation rules, status enums, and accessibility labels.
-   **`classNameHelper.ts`**: Reusable Tailwind CSS class builders.
-   **`api-utils.ts`**: Centralized API utilities for building URLs, fetch wrappers, and React Query key generation, now with `credentials` support.
-   **`useAppConfig.ts`**: React hook for type-safe configuration access.
-   **`ConfigProvider.tsx`**: Context provider for application-wide configuration access.
-   **`shared/rbac.ts`**: Universal RBAC system.

### Modularization
The system is highly modularized for maintainability and self-healing:
-   **Backend**: `lomuChat.ts` and `lomuSuperCore.ts` significantly reduced in size by extracting focused modules.
-   **Frontend**: `universal-chat.tsx` refactored into focused components.
-   **Universal Workspace Layout System**: Provides a Replit-style IDE layout with a `WorkspaceLayout` component, `WorkspaceContainer`, `useWorkspaceConfig` hook for various modes, and built-in RBAC for role-based visibility.

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

## Recent Session Progress (November 24, 2025)
### Layout Architecture & Code Cleanup
- ✅ **Layout Double-Wrapping Bug Fixed**: Removed `AppLayout` wrapper from `/builder` routes
  - Builder page now displays proper Replit-style layout with projects sidebar
  - Fixed conflict where custom full-screen layouts were nested inside AppLayout's sidebar
- ✅ **Comprehensive Layout Audit**: Documented which pages should/shouldn't use AppLayout wrapper
  - Full-screen workspace pages: Builder, Workspace, DashboardWorkspace, AdminWorkspace, PlatformHealing, LomuChat
  - Standard pages with navigation: Dashboard, Marketplace, Analytics, Account, Team, etc.
- ✅ **Code Cleanup**: Deleted orphaned `ide.tsx` page (no route, legacy code)
  - Modern alternatives exist: Builder (Replit-style) and Workspace (5-panel layout)
  - Reduced code duplication and maintenance burden

### Server Startup & Authentication Fixes (November 23, 2025)
- ✅ **CRITICAL FIX**: Created `server/routes/index.ts` - centralized route registration system
- ✅ Fixed ES module imports (replaced CommonJS `require()` with dynamic `import()`)
- ✅ Fixed WebSocket Server constructor import (changed from `WebSocket.Server` to `WebSocketServer`)
- ✅ Fixed import paths in `server/lomuChat.ts` (converted `../` to `./` with `.js` extensions)
- ✅ Fixed async middleware bug in `server/middleware/creditValidation.ts` (removed `async` from factory function)
- ✅ Fixed WebSocket server passing to healing routes (pass `server.wss` instead of `server`)
- ✅ **AUTHENTICATION FIX**: Added `setupAuth()` call BEFORE route registration in `server/index.ts`
  - Passport strategies (local, OIDC) now properly initialized before routes need them
  - Fixed "Unknown authentication strategy 'local'" error
  - Login functionality fully restored
- ✅ Server now starts successfully - all routes registered and operational
- ✅ Platform healing orchestrator running and ready for use
- ✅ LomuAI router mounted successfully at `/api/lomu-ai` with no errors