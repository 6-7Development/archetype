/**
 * General Agent API Routes - Support ALL project types
 */

import { Router } from 'express';
import { generalAgentService } from '../services/generalAgent';

const router = Router();

/**
 * GET /api/general-agent/project-types
 * Get all supported project types
 */
router.get('/project-types', async (req, res) => {
  try {
    const types = generalAgentService.getProjectTypes();
    res.json(types);
  } catch (error: any) {
    console.error('[GENERAL_AGENT] Error getting project types:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/general-agent/projects/:projectId/settings
 * Get project settings
 */
router.get('/projects/:projectId/settings', async (req, res) => {
  try {
    const { projectId } = req.params;
    const settings = await generalAgentService.getProjectSettings(projectId);

    if (!settings) {
      return res.status(404).json({ error: 'Project settings not found' });
    }

    res.json(settings);
  } catch (error: any) {
    console.error('[GENERAL_AGENT] Error getting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/general-agent/projects/:projectId/settings
 * Initialize project settings
 */
router.post('/projects/:projectId/settings', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { projectType, framework, buildCommand, startCommand, testCommand, deploymentConfig, customSettings } = req.body;

    if (!projectType) {
      return res.status(400).json({ error: 'Missing projectType' });
    }

    const settingsId = await generalAgentService.initializeProjectSettings({
      projectId,
      projectType,
      framework,
      buildCommand,
      startCommand,
      testCommand,
      deploymentConfig,
      customSettings,
    });

    res.status(201).json({ settingsId });
  } catch (error: any) {
    console.error('[GENERAL_AGENT] Error initializing settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/general-agent/projects/:projectId/settings
 * Update project settings
 */
router.patch('/projects/:projectId/settings', async (req, res) => {
  try {
    const { projectId } = req.params;
    const updates = req.body;

    await generalAgentService.updateProjectSettings(projectId, updates);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[GENERAL_AGENT] Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/general-agent/build-adapter/:projectType
 * Get build adapter for project type
 */
router.get('/build-adapter/:projectType', async (req, res) => {
  try {
    const { projectType } = req.params;
    const adapter = generalAgentService.getBuildAdapter(projectType);

    res.json({
      defaultCommands: adapter.getDefaultCommands(),
      fileStructure: adapter.getFileStructure(),
      recommendedPackages: adapter.getRecommendedPackages(),
    });
  } catch (error: any) {
    console.error('[GENERAL_AGENT] Error getting adapter:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/general-agent/detect-project-type
 * Detect project type from files
 */
router.post('/detect-project-type', async (req, res) => {
  try {
    const { files } = req.body;

    if (!Array.isArray(files)) {
      return res.status(400).json({ error: 'Files must be an array' });
    }

    const projectType = await generalAgentService.detectProjectType(files);
    res.json({ projectType });
  } catch (error: any) {
    console.error('[GENERAL_AGENT] Error detecting project type:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
