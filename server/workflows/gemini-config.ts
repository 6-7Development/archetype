/**
 * GEMINI CONFIG - TIER 2 GAP #2 FIX
 * Centralized Gemini configuration extracted from hardcoded values
 * Enables easy testing, feature flags, and per-request customization
 */

export const GEMINI_CONFIG = {
  // Model selection
  model: {
    default: 'gemini-2.5-flash',
    extended: 'gemini-2.0-flash-exp',
    quality: 'gemini-pro',
    fallback: 'gemini-2.5-flash',
  },

  // Token/generation limits
  tokens: {
    maxOutput: 4096,
    maxInput: 1000000, // 1M context window
    warningThreshold: 80000, // 80k tokens = warning
  },

  // Retry strategy
  retry: {
    maxAttempts: 2,
    backoffMs: 1000,
    timeoutMs: 30000,
  },

  // Tool execution
  tools: {
    maxParallel: 4,
    timeoutMs: 5000,
    maxPerRequest: 18, // Google recommends 10-20
  },

  // Function calling
  functionCalling: {
    mode: 'AUTO', // AUTO | ANY | NONE
    forceStructuredOutput: true,
    jsonRepairEnabled: true,
  },

  // Streaming
  streaming: {
    enabled: true,
    chunkSize: 1024,
    timeoutMs: 60000,
  },

  // Safety & moderation
  safety: {
    blockedThreshold: 'MEDIUM',
    harrassmentThreshold: 'MEDIUM',
    hateSpeechThreshold: 'MEDIUM',
    sexualContentThreshold: 'MEDIUM',
  },

  // Performance tuning
  performance: {
    enableCaching: true,
    cacheTtlSeconds: 300,
    enableCompressionForResponses: true,
  },

  // Feature flags
  features: {
    enableThinking: true,
    enableVision: true,
    enableSearch: true,
    enableTools: true,
  },
};

/**
 * Get model for specific intent
 */
export function getModelForIntent(intent?: 'fix' | 'build' | 'question' | 'casual' | 'diagnostic'): string {
  switch (intent) {
    case 'fix':
    case 'diagnostic':
      return GEMINI_CONFIG.model.extended; // More capable for complex fixes
    case 'build':
      return GEMINI_CONFIG.model.default; // Fast for building
    case 'question':
    case 'casual':
    default:
      return GEMINI_CONFIG.model.default; // Standard
  }
}

/**
 * Get safety settings from config
 */
export function getSafetySettings(): any[] {
  return [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: GEMINI_CONFIG.safety.harrassmentThreshold,
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: GEMINI_CONFIG.safety.hateSpeechThreshold,
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: GEMINI_CONFIG.safety.sexualContentThreshold,
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: GEMINI_CONFIG.safety.blockedThreshold,
    },
  ];
}

/**
 * Validate token usage against limits
 */
export function validateTokenUsage(inputTokens: number, outputTokens: number): {
  valid: boolean;
  warning: boolean;
  message: string;
} {
  const total = inputTokens + outputTokens;

  if (total > GEMINI_CONFIG.tokens.maxInput) {
    return {
      valid: false,
      warning: false,
      message: `Token limit exceeded: ${total} > ${GEMINI_CONFIG.tokens.maxInput}`,
    };
  }

  if (total > GEMINI_CONFIG.tokens.warningThreshold) {
    return {
      valid: true,
      warning: true,
      message: `⚠️ Token usage high: ${total} tokens (${((total / GEMINI_CONFIG.tokens.maxInput) * 100).toFixed(1)}%)`,
    };
  }

  return {
    valid: true,
    warning: false,
    message: `Token usage OK: ${total} tokens`,
  };
}
