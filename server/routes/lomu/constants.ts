// Emergency limits and constants for LomuAI Chat

export const EMERGENCY_LIMITS = {
  MAX_WALL_CLOCK_TIME: 10 * 60 * 1000, // 10 minutes
  MAX_SESSION_TOKENS: 500_000, // 500K tokens per conversation
  MAX_TOOL_CALLS_PER_ITERATION: 5, // Max 5 tools per iteration
  MAX_API_CALLS_PER_SESSION: 50, // Max 50 API calls total
  SESSION_IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes idle = new session
};

export const MAX_CONSECUTIVE_THINKING = 3; // Maximum consecutive thinking iterations before forcing action
