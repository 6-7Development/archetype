/**
 * AI Models API
 * 
 * Endpoints for AI model catalogue and selection
 */

import { Router, Request, Response } from 'express';
import { 
  AI_MODEL_CATALOGUE, 
  getAvailableModels, 
  getDefaultModel, 
  getModelById,
  isProviderAvailable 
} from '../config/ai-model';

const router = Router();

/**
 * GET /api/models
 * Returns list of available AI models
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const availableModels = getAvailableModels();
    const defaultModel = getDefaultModel();
    
    // Transform to frontend-friendly format
    const models = availableModels.map(model => ({
      id: model.id,
      provider: model.provider,
      displayName: model.displayName,
      description: model.description,
      contextWindow: model.contextWindow,
      supportsVision: model.supportsVision,
      supportsStreaming: model.supportsStreaming,
      costPer1MTokens: model.costPer1MTokens,
      speedRating: model.speedRating,
      qualityRating: model.qualityRating,
      isPremium: model.isPremium,
      isDefault: model.id === defaultModel.id,
    }));

    res.json({
      success: true,
      models,
      defaultModelId: defaultModel.id,
      providers: {
        google: isProviderAvailable('google'),
        openai: isProviderAvailable('openai'),
        anthropic: isProviderAvailable('anthropic'),
      },
    });
  } catch (error: any) {
    console.error('[MODELS-API] Error fetching models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch models',
    });
  }
});

/**
 * GET /api/models/:modelId
 * Returns details for a specific model
 */
router.get('/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const model = getModelById(modelId);
    
    if (!model) {
      return res.status(404).json({
        success: false,
        error: `Model not found: ${modelId}`,
      });
    }
    
    // Check if provider is available
    const isAvailable = isProviderAvailable(model.provider);
    
    res.json({
      success: true,
      model: {
        ...model,
        isAvailable,
      },
    });
  } catch (error: any) {
    console.error('[MODELS-API] Error fetching model:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch model',
    });
  }
});

/**
 * GET /api/models/catalogue/full
 * Returns full catalogue (including disabled models) for admin
 */
router.get('/catalogue/full', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      models: AI_MODEL_CATALOGUE,
      providers: {
        google: isProviderAvailable('google'),
        openai: isProviderAvailable('openai'),
        anthropic: isProviderAvailable('anthropic'),
      },
    });
  } catch (error: any) {
    console.error('[MODELS-API] Error fetching catalogue:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch catalogue',
    });
  }
});

export default router;
