/**
 * AI Model Configuration
 * 
 * Easy switching between Claude Sonnet 4 (expensive, reliable) and Gemini 2.5 Flash (cheap, fast)
 * 
 * To switch models, set AI_MODEL_PROVIDER environment variable:
 * - "claude" (default) - Claude Sonnet 4 ($3/$15 per 1M tokens)
 * - "gemini" - Gemini 2.5 Flash ($0.075/$0.30 per 1M tokens - 40x cheaper!)
 */

export type AIModelProvider = 'claude' | 'gemini';

export interface AIModelConfig {
  provider: AIModelProvider;
  model: string;
  maxTokens: {
    simple: number;
    complex: number;
  };
  costPer1MTokens: {
    input: number;
    output: number;
  };
}

/**
 * Get the active AI model configuration from environment
 */
export function getAIModelConfig(): AIModelConfig {
  const provider = (process.env.AI_MODEL_PROVIDER || 'claude').toLowerCase() as AIModelProvider;
  
  const configs: Record<AIModelProvider, AIModelConfig> = {
    claude: {
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
      maxTokens: {
        simple: 4000,
        complex: 8000,
      },
      costPer1MTokens: {
        input: 3.00,
        output: 15.00,
      },
    },
    gemini: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      maxTokens: {
        simple: 4000,
        complex: 8000,
      },
      costPer1MTokens: {
        input: 0.075,
        output: 0.30,
      },
    },
  };
  
  return configs[provider] || configs.claude;
}

/**
 * Log current AI model configuration on startup
 */
export function logAIModelConfig() {
  const config = getAIModelConfig();
  console.log(`[AI-CONFIG] Using ${config.provider.toUpperCase()}`);
  console.log(`[AI-CONFIG] Model: ${config.model}`);
  console.log(`[AI-CONFIG] Cost: $${config.costPer1MTokens.input}/$${config.costPer1MTokens.output} per 1M tokens`);
  console.log(`[AI-CONFIG] To switch: Set AI_MODEL_PROVIDER=claude or AI_MODEL_PROVIDER=gemini`);
}
