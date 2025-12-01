/**
 * Scout Workflow Routes
 * 
 * Exposes Scout agent capabilities and tool calling ability
 * Provides workflow initialization and status endpoints
 */

import { Router, type Request, type Response } from 'express';
import { initializeScoutTools, getScoutCapabilities } from '../services/scoutToolRegistry';
import { validateDeployment } from '../config/deployment-validation';
import { SCOUT_AI_SERVICES } from '../config/scout-agent-config';

const router = Router();

/**
 * GET /api/scout/capabilities
 * Returns Scout's AI services and available tools
 */
router.get('/capabilities', (req: Request, res: Response) => {
  try {
    const capabilities = getScoutCapabilities();
    res.json({
      aiServices: capabilities.aiServices.map(s => ({
        id: s.id,
        name: s.name,
        provider: s.provider,
        model: s.model,
        status: s.status,
        capabilities: s.capabilities,
      })),
      toolsCount: capabilities.tools.length,
      availableTools: capabilities.registry.getAllAvailableTools().length,
      timestamp: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve capabilities' });
  }
});

/**
 * GET /api/scout/tools
 * Returns list of all available tools
 */
router.get('/tools', (req: Request, res: Response) => {
  try {
    const capabilities = getScoutCapabilities();
    const tools = capabilities.tools.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      requiresAuth: t.requiresAuth,
      requiresDatabase: t.requiresDatabase,
      riskLevel: t.riskLevel,
      available: capabilities.registry.checkToolCapability(t.id).isAvailable,
    }));
    res.json(tools);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve tools' });
  }
});

/**
 * GET /api/scout/health
 * Returns Scout workflow health and deployment status
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const validation = validateDeployment();
    const capabilities = getScoutCapabilities();
    
    res.json({
      scoutStatus: validation.overall.isValid ? 'healthy' : 'degraded',
      environment: validation.environment,
      readyForDeployment: validation.overall.readyForDeployment,
      aiServices: {
        geminiFlash: !!process.env.GEMINI_API_KEY,
        configured: SCOUT_AI_SERVICES.filter(s => 
          process.env[s.apiKeyEnv]
        ).map(s => s.name),
      },
      tools: {
        available: capabilities.registry.getAllAvailableTools().length,
        total: capabilities.tools.length,
      },
      stats: capabilities.registry.getGlobalStats(),
      criticalIssues: validation.overall.criticalIssues,
      recommendations: validation.overall.recommendations,
      timestamp: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to retrieve health status',
      message: error.message 
    });
  }
});

/**
 * POST /api/scout/validate-tool-call
 * Validates tool call parameters before execution
 */
router.post('/validate-tool-call', (req: Request, res: Response) => {
  try {
    const { toolId, params } = req.body;

    if (!toolId) {
      return res.status(400).json({ error: 'Missing toolId' });
    }

    const capabilities = getScoutCapabilities();
    const validation = capabilities.registry.validateToolCall(toolId, params || {});

    res.json({
      toolId,
      valid: validation.valid,
      errors: validation.errors,
      tool: capabilities.registry.checkToolCapability(toolId),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

/**
 * GET /api/scout/stats
 * Returns tool usage statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const capabilities = getScoutCapabilities();
    const toolId = req.query.toolId as string;

    if (toolId) {
      const stats = capabilities.registry.getToolStats(toolId);
      res.json({ toolId, ...stats });
    } else {
      const stats = capabilities.registry.getGlobalStats();
      res.json(stats);
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

export default router;

/**
 * Initialize Scout workflow routes
 * Call this from main route registration
 */
export function registerScoutWorkflowRoutes(app: any): void {
  app.use('/api/scout', router);
  console.log('[SCOUT-WORKFLOW] Scout workflow routes registered');
}
