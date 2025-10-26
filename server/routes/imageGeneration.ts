/**
 * AI Image Generation API Routes
 */

import express from 'express';
import { imageGenerationService } from '../services/imageGeneration';

const router = express.Router();

// Generate an image
router.post('/generate', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId, prompt, width, height, quality, style } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const generationId = await imageGenerationService.generateImage({
      userId: req.user.id,
      projectId,
      prompt,
      width,
      height,
      quality,
      style,
    });

    res.json({ success: true, generationId });
  } catch (error: any) {
    console.error('[IMAGE-GEN] Generate error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});

// Get generation status
router.get('/:generationId', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const generation = await imageGenerationService.getGeneration(req.params.generationId);
    
    if (!generation) {
      return res.status(404).json({ error: 'Generation not found' });
    }

    res.json({ generation });
  } catch (error: any) {
    console.error('[IMAGE-GEN] Get generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to get generation' });
  }
});

// Get user's image generation history
router.get('/history/:limit?', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.params.limit || '20');
    const generations = await imageGenerationService.getUserGenerations(req.user.id, limit);

    res.json({ generations });
  } catch (error: any) {
    console.error('[IMAGE-GEN] Get history error:', error);
    res.status(500).json({ error: error.message || 'Failed to get image history' });
  }
});

// Estimate cost
router.post('/estimate', async (req: express.Request, res: express.Response) => {
  try {
    const { quality, width, height } = req.body;
    const cost = imageGenerationService.estimateCost(
      quality || 'standard',
      width || 1024,
      height || 1024
    );

    res.json({ cost });
  } catch (error: any) {
    console.error('[IMAGE-GEN] Estimate cost error:', error);
    res.status(500).json({ error: error.message || 'Failed to estimate cost' });
  }
});

export default router;
