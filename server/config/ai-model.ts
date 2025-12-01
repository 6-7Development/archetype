/**
 * AI Model Configuration
 * 
 * Comprehensive model catalogue supporting multiple providers:
 * - Google Gemini (Flash/Pro)
 * - OpenAI (GPT-4o, GPT-4)
 * - Anthropic Claude (Sonnet, Opus)
 * 
 * Model selection is user-configurable per session
 */

export type AIProvider = 'google' | 'openai' | 'anthropic';

export interface AIModelConfig {
  id: string;
  provider: AIProvider;
  displayName: string;
  description: string;
  model: string; // Actual API model identifier
  contextWindow: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  costPer1MTokens: {
    input: number;
    output: number;
  };
  speedRating: number; // 1-10, higher = faster
  qualityRating: number; // 1-10, higher = better
  isPremium: boolean;
  isEnabled: boolean;
}

// Full model catalogue
export const AI_MODEL_CATALOGUE: AIModelConfig[] = [
  // Google Gemini Models
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    displayName: 'Gemini 2.5 Flash',
    description: 'Fast and cost-effective. Best for most tasks.',
    model: 'gemini-2.5-flash',
    contextWindow: 1000000,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    costPer1MTokens: { input: 0.075, output: 0.30 },
    speedRating: 9,
    qualityRating: 7,
    isPremium: false,
    isEnabled: true,
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    displayName: 'Gemini 2.5 Pro',
    description: 'Advanced reasoning. Best for complex architecture.',
    model: 'gemini-2.5-pro',
    contextWindow: 2000000,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    costPer1MTokens: { input: 1.50, output: 6.00 },
    speedRating: 6,
    qualityRating: 9,
    isPremium: true,
    isEnabled: true,
  },
  // OpenAI Models
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    description: 'OpenAI flagship. Multimodal excellence.',
    model: 'gpt-4o',
    contextWindow: 128000,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    costPer1MTokens: { input: 5.00, output: 15.00 },
    speedRating: 7,
    qualityRating: 9,
    isPremium: true,
    isEnabled: true,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    description: 'Cost-effective GPT-4. Good balance.',
    model: 'gpt-4o-mini',
    contextWindow: 128000,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    costPer1MTokens: { input: 0.15, output: 0.60 },
    speedRating: 8,
    qualityRating: 7,
    isPremium: false,
    isEnabled: true,
  },
  // Anthropic Claude Models
  {
    id: 'claude-sonnet-4',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    description: 'Anthropic balanced. Great for coding.',
    model: 'claude-sonnet-4-20250514',
    contextWindow: 200000,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    costPer1MTokens: { input: 3.00, output: 15.00 },
    speedRating: 7,
    qualityRating: 9,
    isPremium: true,
    isEnabled: true,
  },
  {
    id: 'claude-haiku',
    provider: 'anthropic',
    displayName: 'Claude Haiku',
    description: 'Fast Anthropic model. Quick responses.',
    model: 'claude-3-haiku-20240307',
    contextWindow: 200000,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    costPer1MTokens: { input: 0.25, output: 1.25 },
    speedRating: 9,
    qualityRating: 6,
    isPremium: false,
    isEnabled: true,
  },
];

/**
 * Get model by ID
 */
export function getModelById(modelId: string): AIModelConfig | undefined {
  return AI_MODEL_CATALOGUE.find(m => m.id === modelId);
}

/**
 * Get all enabled models
 */
export function getEnabledModels(): AIModelConfig[] {
  return AI_MODEL_CATALOGUE.filter(m => m.isEnabled);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: AIProvider): AIModelConfig[] {
  return AI_MODEL_CATALOGUE.filter(m => m.provider === provider && m.isEnabled);
}

/**
 * Get non-premium (free tier) models
 */
export function getFreeTierModels(): AIModelConfig[] {
  return AI_MODEL_CATALOGUE.filter(m => !m.isPremium && m.isEnabled);
}

/**
 * Get default model based on environment
 */
export function getDefaultModel(): AIModelConfig {
  // Check for GEMINI_API_KEY first (primary provider)
  if (process.env.GEMINI_API_KEY) {
    return AI_MODEL_CATALOGUE.find(m => m.id === 'gemini-2.5-flash')!;
  }
  // Fall back to OpenAI if available
  if (process.env.OPENAI_API_KEY) {
    return AI_MODEL_CATALOGUE.find(m => m.id === 'gpt-4o-mini')!;
  }
  // Fall back to Claude if available
  if (process.env.ANTHROPIC_API_KEY) {
    return AI_MODEL_CATALOGUE.find(m => m.id === 'claude-haiku')!;
  }
  // Default to Gemini Flash
  return AI_MODEL_CATALOGUE.find(m => m.id === 'gemini-2.5-flash')!;
}

/**
 * Check if a provider is available (API key configured)
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  switch (provider) {
    case 'google':
      return !!process.env.GEMINI_API_KEY;
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    default:
      return false;
  }
}

/**
 * Get available models (only those with configured API keys)
 */
export function getAvailableModels(): AIModelConfig[] {
  return AI_MODEL_CATALOGUE.filter(m => m.isEnabled && isProviderAvailable(m.provider));
}

/**
 * Log current AI model configuration on startup
 */
export function logAIModelConfig() {
  const defaultModel = getDefaultModel();
  const availableModels = getAvailableModels();
  
  console.log(`[AI-CONFIG] Default model: ${defaultModel.displayName}`);
  console.log(`[AI-CONFIG] Available models: ${availableModels.map(m => m.id).join(', ')}`);
  console.log(`[AI-CONFIG] Providers: Google=${isProviderAvailable('google')}, OpenAI=${isProviderAvailable('openai')}, Anthropic=${isProviderAvailable('anthropic')}`);
}

// Legacy compatibility - maps to new structure
export type AIModelProvider = 'claude' | 'gemini';
export function getAIModelConfig(): { provider: AIModelProvider; model: string; maxTokens: { simple: number; complex: number }; costPer1MTokens: { input: number; output: number } } {
  const defaultModel = getDefaultModel();
  const provider = defaultModel.provider === 'google' ? 'gemini' : 'claude';
  
  return {
    provider: provider as AIModelProvider,
    model: defaultModel.model,
    maxTokens: {
      simple: 4000,
      complex: 8000,
    },
    costPer1MTokens: defaultModel.costPer1MTokens,
  };
}
