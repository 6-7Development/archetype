/**
 * Project Health Dashboard API Routes
 * 
 * Provides endpoints for project health metrics and analysis
 */

import { Router } from 'express';
import { projectHealthService } from '../services/projectHealthService';

const router = Router();

router.get('/analyze/:projectId?', async (req, res) => {
  try {
    const projectId = req.params.projectId || 'default';
    const metrics = await projectHealthService.analyzeProject(projectId);
    res.json(metrics);
  } catch (error: any) {
    console.error('[PROJECT-HEALTH-API] Error:', error.message);
    res.status(500).json({ error: 'Failed to analyze project health' });
  }
});

router.post('/refresh/:projectId?', async (req, res) => {
  try {
    const projectId = req.params.projectId || 'default';
    projectHealthService.invalidateCache(projectId);
    const metrics = await projectHealthService.analyzeProject(projectId);
    res.json(metrics);
  } catch (error: any) {
    console.error('[PROJECT-HEALTH-API] Error:', error.message);
    res.status(500).json({ error: 'Failed to refresh project health' });
  }
});

export default router;
