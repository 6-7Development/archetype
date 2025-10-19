import { Router } from 'express';
import multer from 'multer';
import { executeBrowserTest } from '../tools/browser-test';
import { executeWebSearch } from '../tools/web-search';
import { executeVisionAnalysis } from '../tools/vision-analyze';
import { isAuthenticated } from '../universalAuth';
import { checkUsageLimits } from '../usage-tracking';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All tool endpoints require authentication
router.use(isAuthenticated);

/**
 * Execute browser test
 * POST /api/tools/browser-test
 */
router.post('/browser-test', async (req, res) => {
  // Check usage limits before executing expensive operations
  const usageCheck = await checkUsageLimits(req.user!.id);
  if (!usageCheck.allowed) {
    return res.status(429).json({ error: usageCheck.reason });
  }
  try {
    const { url, actions, assertions } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const result = await executeBrowserTest({
      url,
      actions,
      assertions,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Browser test error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Browser test failed',
    });
  }
});

/**
 * Execute web search
 * POST /api/tools/web-search
 */
router.post('/web-search', async (req, res) => {
  // Check usage limits
  const usageCheck = await checkUsageLimits(req.user!.id);
  if (!usageCheck.allowed) {
    return res.status(429).json({ error: usageCheck.reason });
  }
  
  try {
    const { query, maxResults, includeDomains, excludeDomains } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Check for Tavily API key
    if (!process.env.TAVILY_API_KEY) {
      return res.status(503).json({
        error: 'Web search is not configured. Administrator needs to set TAVILY_API_KEY environment variable.',
        help: 'Get a free API key at https://tavily.com',
      });
    }
    
    const result = await executeWebSearch({
      query,
      maxResults,
      includeDomains,
      excludeDomains,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Web search error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Web search failed',
    });
  }
});

/**
 * Analyze image with Vision API
 * POST /api/tools/vision-analyze
 */
router.post('/vision-analyze', upload.single('image'), async (req, res) => {
  // Check usage limits
  const usageCheck = await checkUsageLimits(req.user!.id);
  if (!usageCheck.allowed) {
    return res.status(429).json({ error: usageCheck.reason });
  }
  
  try {
    const { prompt, imageBase64, imageMediaType } = req.body;
    const file = req.file;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    let base64Data: string;
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    
    if (file) {
      // Image uploaded as multipart
      base64Data = file.buffer.toString('base64');
      mediaType = file.mimetype as any;
    } else if (imageBase64 && imageMediaType) {
      // Image provided as base64
      base64Data = imageBase64;
      mediaType = imageMediaType;
    } else {
      return res.status(400).json({ error: 'Image is required (as file or base64)' });
    }
    
    const result = await executeVisionAnalysis({
      imageBase64: base64Data,
      imageMediaType: mediaType,
      prompt,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Vision analysis error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Vision analysis failed',
    });
  }
});

export default router;
