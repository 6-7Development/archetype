/**
 * LOMU SUPER CORE Configuration Module
 * Central configuration and constants for Hexad system prompt
 */

export interface LomuCoreConfig {
  mode: 'dev' | 'prod';
  maxTokensPerAction: number;
  maxReflectDepth: number;
  chatTone: 'calm_minimalist' | 'detailed';
  debugResponses: boolean;
  autoPlanReview: boolean;
}

export const LOMU_CORE_CONFIG: LomuCoreConfig = {
  mode: (process.env.LOMU_MODE as 'dev' | 'prod') || 'prod',
  maxTokensPerAction: parseInt(process.env.MAX_TOKENS_PER_ACTION || '8000'),
  maxReflectDepth: parseInt(process.env.MAX_REFLECT_DEPTH || '3'),
  chatTone: (process.env.CHAT_TONE as 'calm_minimalist' | 'detailed') || 'calm_minimalist',
  debugResponses: process.env.DEBUG_RESPONSES === 'true',
  autoPlanReview: process.env.AUTO_PLAN_REVIEW !== 'false',
};

// Model configuration
export const MODEL_CONFIG = {
  DEFAULT_MODEL: 'gemini-2.5-flash',
  ARCHITECT_MODEL: 'claude-sonnet-4-20250514',
  MAX_CONTEXT: 1000000, // 1M tokens for Gemini
  MAX_TOKENS_OUTPUT: 16000,
} as const;

export const API_CONFIG = {
  RATE_LIMIT: {
    tokensPerMinute: 900000,
    requestsPerMinute: 60,
  },
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
} as const;
