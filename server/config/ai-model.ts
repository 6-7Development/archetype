/**
 * AI Model Configuration
 * 
 * Unified Google Gemini Provider - Single provider architecture for:
 * - Simpler maintenance
 * - Consistent tool calling behavior
 * - Cost-effective pricing
 * - Large context windows (1M-2M tokens)
 */

export type AIProvider = 'google';

export interface AIModelConfig {
  id: string;
  provider: AIProvider;
  displayName: string;
  description: string;
  model: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  costPer1MTokens: {
    input: number;
    output: number;
  };
  speedRating: number;
  qualityRating: number;
  isPremium: boolean;
  isEnabled: boolean;
}

// Gemini-only model catalogue
export const AI_MODEL_CATALOGUE: AIModelConfig[] = [
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    displayName: 'Scout (Flash)',
    description: 'Fast worker agent. Best for most tasks.',
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
    displayName: 'Scout Advanced (Pro)',
    description: 'Strategic consultant. Complex architecture.',
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
 * Get default model - always Gemini Flash
 */
export function getDefaultModel(): AIModelConfig {
  return AI_MODEL_CATALOGUE.find(m => m.id === 'gemini-2.5-flash')!;
}

/**
 * Get advanced model - Gemini Pro for complex tasks
 */
export function getAdvancedModel(): AIModelConfig {
  return AI_MODEL_CATALOGUE.find(m => m.id === 'gemini-2.5-pro')!;
}

/**
 * Check if Gemini is available
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  return provider === 'google' && !!process.env.GEMINI_API_KEY;
}

/**
 * Get available models
 */
export function getAvailableModels(): AIModelConfig[] {
  if (!process.env.GEMINI_API_KEY) return [];
  return AI_MODEL_CATALOGUE.filter(m => m.isEnabled);
}

/**
 * Log AI model configuration
 */
export function logAIModelConfig() {
  const hasKey = !!process.env.GEMINI_API_KEY;
  console.log(`[AI-CONFIG] Provider: Google Gemini`);
  console.log(`[AI-CONFIG] API Key: ${hasKey ? '✓ configured' : '✗ missing'}`);
  console.log(`[AI-CONFIG] Models: Scout (Flash), Scout Advanced (Pro)`);
}

// Simplified config getter
export type AIModelProvider = 'gemini';
export function getAIModelConfig() {
  const defaultModel = getDefaultModel();
  return {
    provider: 'gemini' as AIModelProvider,
    model: defaultModel.model,
    maxTokens: { simple: 4000, complex: 8000 },
    costPer1MTokens: defaultModel.costPer1MTokens,
  };
}
