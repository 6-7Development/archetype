/**
 * Dynamic configuration system for HexadAI limits
 * Centralized location for all hardcoded limits that were scattered throughout lomuChat.ts
 * Can be adjusted without code changes via environment or dynamic reload
 */

export const LOMU_LIMITS = {
  // Iteration controls
  ITERATION: {
    MAX_BY_INTENT: {
      casual: 1,
      search: 3,
      analysis: 5,
      fix: 10,
      refactor: 15,
      default: 10,
    } as Record<string, number>,
    MAX_EMPTY: 3, // Stop if 3 consecutive iterations without tool calls
    TIMEOUT_MS: 180000, // 3 minutes per iteration
    MAX_CONSECUTIVE_EMPTY: 3,
  },

  // Token and API limits
  API: {
    MAX_GEMINI_TOKENS: 200000, // Conservative limit for Gemini (200K tokens)
    MAX_CONTEXT_TOKENS: 500000, // Hard limit for conversation memory
    MAX_API_CALLS_PER_SESSION: process.env.MAX_API_CALLS ? parseInt(process.env.MAX_API_CALLS) : 200,
    RATE_LIMIT_TOKENS: 900000, // Token bucket refill
  },

  // Tool execution limits
  TOOL: {
    MAX_PER_ITERATION: 5, // Max tools per iteration
    MAX_PER_SESSION: process.env.MAX_TOOL_CALLS ? parseInt(process.env.MAX_TOOL_CALLS) : 500,
    TIMEOUT_MS: 30000, // 30 seconds per tool
  },

  // File operations
  FILE: {
    MAX_READ_ITERATIONS: 5, // Max consecutive read-only iterations before forcing writes
    READ_CACHE_SIZE: 1000, // Cache up to 1000 file reads
    DEFIBRILLATOR_READ_LIMIT: 0, // Override mode: no read limit
  },

  // Memory and cleanup
  MEMORY: {
    CHAT_HISTORY_RETENTION_DAYS: 30,
    INACTIVE_SESSION_CLEANUP_HOURS: 24,
    MAX_CONCURRENT_STREAMS_PER_USER: 1,
  },

  // Thinking blocks
  THINKING: {
    MAX_CONSECUTIVE_BLOCKS: 5,
    EMIT_THRESHOLD_LENGTH: 50, // Min chars to emit a thinking block
  },
};

/**
 * Get max iterations for a given intent
 */
export function getMaxIterationsForIntent(intent: string): number {
  const limit = LOMU_LIMITS.ITERATION.MAX_BY_INTENT[intent];
  return limit || LOMU_LIMITS.ITERATION.MAX_BY_INTENT.default;
}

/**
 * Override a limit dynamically (useful for testing or temporary adjustments)
 */
export function setLimitOverride(path: string, value: any): void {
  const keys = path.split('.');
  let obj: any = LOMU_LIMITS;
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  console.log(`[CONFIG] Override applied: ${path} = ${value}`);
}

/**
 * Get current limit (useful for logging and debugging)
 */
export function getLimit(path: string): any {
  const keys = path.split('.');
  let obj: any = LOMU_LIMITS;
  for (const key of keys) {
    obj = obj[key];
  }
  return obj;
}
