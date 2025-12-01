/**
 * Code Completion API Routes
 * 
 * Provides endpoints for AI-powered code completion suggestions
 */

import { Router } from 'express';
import { codeCompletionService, type CompletionRequest } from '../services/codeCompletionService';

const router = Router();

router.post('/completions', async (req, res) => {
  try {
    const request: CompletionRequest = req.body;
    
    if (!request.code || !request.language || !request.cursorPosition) {
      return res.status(400).json({ 
        error: 'Missing required fields: code, language, cursorPosition' 
      });
    }

    const response = await codeCompletionService.getCompletions(request);
    res.json(response);
  } catch (error: any) {
    console.error('[CODE-COMPLETION-API] Error:', error.message);
    res.status(500).json({ error: 'Failed to generate completions' });
  }
});

router.get('/metrics', (req, res) => {
  const metrics = codeCompletionService.getMetrics();
  res.json(metrics);
});

router.post('/cache/clear', (req, res) => {
  codeCompletionService.clearCache();
  res.json({ success: true, message: 'Cache cleared' });
});

export default router;
