/**
 * PLATFORM MANIFEST - Self-Aware File Index for HexadAI
 * 
 * This file documents the entire platform structure so HexadAI knows exactly
 * where files are and what they do. It eliminates guessing and investigation.
 * 
 * HexadAI injects this into its system prompt for instant awareness.
 */

export const PLATFORM_STRUCTURE = {
  description: "Hexad AI Platform - Full Stack Architecture",
  
  // Backend Structure
  server: {
    core: {
      "server/index.ts": "Main server entry point, Express setup, database initialization",
      "server/db.ts": "Drizzle ORM database connection and migrations",
      "server/vite.ts": "Vite dev server integration, static file serving",
    },
    
    services: {
      "server/services/lomuAIBrain.ts": "Central HexadAI session management, state persistence, memory registry",
      "server/services/codeValidator.ts": "TypeScript pre-write validation, compilation checks, prevents broken commits",
      "server/services/performanceMonitor.ts": "System health monitoring, CPU/memory tracking, incident detection",
      "server/services/platformManifest.ts": "THIS FILE - Platform structure index for HexadAI awareness",
    },

    routes: {
      "server/routes/lomuChat.ts": "Main HexadAI chat endpoint, 5020 lines, SSE streaming, core orchestration",
      "server/routes/terminal.ts": "Terminal WebSocket route, shell execution, command history",
      "server/routes/websocket.ts": "Main WebSocket server, heartbeat/cleanup, project subscriptions, security checks",
      "server/routes/deployment.ts": "Deployment webhooks, Railway integration, build status",
      "server/routes/git.ts": "GitHub integration, version control, commits, branch management",
      "server/routes/auth.ts": "Authentication (Replit OAuth, local login), session management",
      "server/routes/credits.ts": "Billing system, credit tracking, usage-based charges",
      "server/routes/architect.ts": "I AM Architect consultation endpoint, premium guidance service",
    },

    tools: {
      "server/tools/index.ts": "Tool registry and distribution system",
      "server/tools/tool-distributions.ts": "LOMU_CORE_TOOLS (18), SUBAGENT_TOOLS (12), ARCHITECT_TOOLS (23)",
      "server/tools/file-operations.ts": "read/write/glob file tools, grep search, smart file reading",
      "server/tools/diagnosis.ts": "Automated diagnostic tool, identifies platform issues, security/perf/db checks",
      "server/tools/architect-consult.ts": "Calls I AM Architect (Claude Sonnet 4) for strategic guidance",
      "server/tools/sub-agent.ts": "Spawns parallel sub-agents for complex tasks",
      "server/tools/github-tools.ts": "Git operations, commits, branch operations, file changes",
      "server/tools/web-search.ts": "Tavily API integration, real-time web search",
      "server/tools/task-management.ts": "Task list creation/updates, progress tracking",
    },

    config: {
      "server/config/lomuLimits.ts": "Rate limiting, safety thresholds, anti-paralysis settings",
      "server/config/modelConfig.ts": "AI model configuration (Gemini 2.5 Flash, Claude Sonnet 4)",
    },

    workflows: {
      "server/routes/lomuChat/streaming.ts": "SSE event streaming, real-time response streaming",
      "server/routes/lomuChat/billing.ts": "Credit estimation, token counting, charge calculation",
      "server/routes/lomuChat/tools.ts": "Tool execution, Gemini function calling wrapper",
    },

    storage: {
      "server/storage.ts": "IStorage interface, database abstraction layer",
    },
  },

  // Frontend Structure
  client: {
    pages: {
      "client/src/pages/dashboard.tsx": "Main dashboard, workspace overview",
      "client/src/pages/editor.tsx": "Code editor, Monaco integration, split view",
      "client/src/pages/hexad-ai-chat.tsx": "HexadAI chat interface, main interaction point",
    },

    components: {
      "client/src/components/universal-chat.tsx": "2293 lines, SSE event handlers, real-time progress display",
      "client/src/components/enhanced-message-display.tsx": "Displays HexadAI thinking blocks, tool calls, results inline",
      "client/src/components/agent-progress-display.tsx": "Real-time task/phase progress visualization",
      "client/src/components/run-progress-table.tsx": "Task execution table with status tracking",
      "client/src/components/ai-model-selector.tsx": "Choose Gemini (fast) vs Claude (smart) AI",
      "client/src/components/testing-panel.tsx": "Browser testing UI, Playwright integration",
      "client/src/components/changes-panel.tsx": "File changes preview, git diff visualization",
    },

    hooks: {
      "client/src/hooks/use-websocket-stream.ts": "WebSocket SSE stream handling, real-time event parsing",
      "client/src/hooks/useAuth.ts": "Authentication state, user session",
    },

    lib: {
      "client/src/lib/queryClient.ts": "TanStack Query setup, API request wrapper",
      "client/src/lib/message-parser.ts": "Parse AI responses, extract code/metadata",
    },
  },

  // Shared Types
  shared: {
    "shared/schema.ts": "Drizzle table definitions, Zod schemas, types",
    "shared/agentEvents.ts": "SSE event types, run states, task definitions",
  },

  // Key Files by Purpose
  keyFilesForHexadAI: {
    "Self-Reference": {
      file: "server/services/platformManifest.ts",
      purpose: "THIS FILE - Know your own structure",
    },
    "Chat/Streaming": {
      files: ["server/routes/lomuChat.ts", "client/src/components/universal-chat.tsx"],
      purpose: "Where HexadAI chats happen - modify if chat isn't working",
    },
    "File Operations": {
      files: ["server/tools/file-operations.ts", "server/services/codeValidator.ts"],
      purpose: "How files are read/written - modify for new file operations",
    },
    "Diagnosis": {
      file: "server/tools/diagnosis.ts",
      purpose: "Diagnostic tool that identifies issues - REFERENCE THIS before guessing",
    },
    "Database": {
      files: ["server/db.ts", "shared/schema.ts"],
      purpose: "All database tables and connections",
    },
    "WebSocket/Real-time": {
      files: ["server/routes/websocket.ts", "server/routes/terminal.ts"],
      purpose: "Real-time connections - web sockets are here, NOT in lomuChat",
    },
    "Session Management": {
      file: "server/services/lomuAIBrain.ts",
      purpose: "Where HexadAI sessions are tracked and managed",
    },
    "Billing": {
      file: "server/routes/lomuChat/billing.ts",
      purpose: "How credits are charged and calculated",
    },
  },

  // CRITICAL ANTIPATTERNS - Things HexadAI Got Wrong
  antipatterns: {
    "Don't look for WebSocket handlers in lomuChat.ts": {
      reason: "WebSocket handling is in server/routes/websocket.ts and terminal.ts",
      correct_file: "server/routes/websocket.ts",
    },
    "Don't diagnose lomuSuperCore.ts multiple times": {
      reason: "It's for system prompt generation, not WebSocket/DB",
      actual_purpose: "HexadLearningSystem for conversation memory",
    },
    "Don't assume errors without diagnosis": {
      reason: "Use diagnosis.ts tool to identify real issues first",
      action: "Call diagnosis tool before investigating specific files",
    },
  },

  // File Sizes (to avoid anti-paralysis blocks)
  fileSizes: {
    "server/routes/lomuChat.ts": "5020 lines - LARGE file, use grep/search before reading",
    "server/lomuSuperCore.ts": "1263 lines - MEDIUM file, read carefully",
    "client/src/components/universal-chat.tsx": "2293 lines - LARGE file, search before reading",
    "server/services/codeValidator.ts": "~400 lines - OK to read directly",
  },

  // Hot Spots - Files Most Likely to Need Fixes
  hotSpots: {
    "Real-time Streaming Issues": "server/routes/lomuChat/streaming.ts + client/src/components/universal-chat.tsx",
    "Database Connection Issues": "server/db.ts + server/storage.ts",
    "WebSocket Problems": "server/routes/websocket.ts (NOT lomuChat.ts)",
    "Session Management": "server/services/lomuAIBrain.ts",
    "Billing/Credits": "server/routes/lomuChat/billing.ts",
    "Type/Validation Issues": "shared/schema.ts + server/services/codeValidator.ts",
  },
};

/**
 * INJECT THIS INTO LOMU AI SYSTEM PROMPT
 * HexadAI should reference this structure to know where files are
 */
export function getPlatformAwarenessPrompt(): string {
  return `
🗺️ **PLATFORM STRUCTURE AWARENESS** - Know Exactly Where Things Are

You are working on the Hexad AI platform. Here is the exact structure:

**BACKEND CORE:**
- server/index.ts: Server entry point
- server/db.ts: Database (Drizzle ORM)
- server/services/lomuAIBrain.ts: Your session management
- server/services/codeValidator.ts: Prevents broken code commits
- server/services/platformManifest.ts: THIS STRUCTURE INDEX

**CHAT & STREAMING:**
- server/routes/lomuChat.ts (5020 lines): Your main chat endpoint
- server/routes/lomuChat/streaming.ts: SSE streaming logic
- client/src/components/universal-chat.tsx (2293 lines): Frontend chat

**WEBSOCKET (NOT in lomuChat!):**
- server/routes/websocket.ts: Main WS server, heartbeat, project subscriptions
- server/routes/terminal.ts: Terminal WS with error handlers already present

**FILES & TOOLS:**
- server/tools/file-operations.ts: read/write/grep tools
- server/tools/diagnosis.ts: Identifies issues (USE THIS FIRST!)
- server/tools/tool-distributions.ts: Your 18 core tools

**CRITICAL ANTIPATTERNS TO AVOID:**
❌ DON'T look for WebSocket handlers in lomuChat.ts - they're in websocket.ts
❌ DON'T read lomuSuperCore.ts multiple times - it's for prompts, not WebSocket/DB
❌ DON'T diagnose without using the diagnosis.ts tool first
✅ DO use grep/search_codebase before reading large files (>1000 lines)
✅ DO reference server/tools/diagnosis.ts to identify REAL issues
✅ DO check this platform manifest before investigating files

**WORKFLOW:**
1. User reports issue → Use diagnosis.ts tool (not guess)
2. Diagnosis identifies files → Reference this manifest to understand purpose
3. Read ONLY the files actually mentioned by diagnosis
4. Fix systematically with validation

Remember: You have 18 tools. Use them efficiently. Reference this structure, don't guess.
`;
}

export function getPlatformContextForHexadAI(): string {
  return `
## Your Platform Structure (Fast Reference)

**The key insight:** Each file has a specific purpose. Reference the manifest, don't guess.

**When investigating issues, START HERE:**
1. What's the issue? → Use diagnosis.ts
2. What files does diagnosis mention? → Cross-reference this manifest
3. Read ONLY those files (use grep for large files)
4. Don't waste iterations on speculation

**File Quick-Reference:**
- lomuChat.ts: Your chat orchestration (large - 5020 lines)
- websocket.ts: WebSocket handling (separate from chat)
- lomuAIBrain.ts: Your session state
- codeValidator.ts: Pre-write validation
- universal-chat.tsx: Frontend rendering
- diagnosis.ts: Issue identification

**Anti-paralysis zones:**
- lomuSuperCore.ts: NOT for WebSocket issues (it's for prompts)
- lomuChat.ts: WebSocket handlers are elsewhere
- Use diagnosis tool to confirm before investigating

You are self-aware. You know the platform. Act decisively.
`;
}
