/**
 * Automations API Routes - Agents & Automations (Slackbots, Telegram, Cron)
 */

import { Router } from 'express';
import { automationService } from '../services/automationService';

const router = Router();

/**
 * GET /api/automations/templates
 * Get all automation templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { category } = req.query;
    const templates = await automationService.getTemplates(category as string | undefined);
    res.json(templates);
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error getting templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/automations/templates/:templateId
 * Get template by ID
 */
router.get('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await automationService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error getting template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/templates
 * Create a new automation template (admin/power users)
 */
router.post('/templates', async (req, res) => {
  try {
    const { name, category, description, icon, connectorType, configSchema, codeTemplate, isOfficial } = req.body;

    if (!name || !category || !configSchema || !codeTemplate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const templateId = await automationService.createTemplate({
      name,
      category,
      description,
      icon,
      connectorType,
      configSchema,
      codeTemplate,
      isOfficial,
    });

    res.status(201).json({ templateId });
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/deploy
 * Deploy an automation from template
 */
router.post('/deploy', async (req, res) => {
  try {
    const { userId, projectId, templateId, name, category, config } = req.body;

    if (!userId || !name || !category || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const runId = await automationService.deployAutomation({
      userId,
      projectId,
      templateId,
      name,
      category,
      config,
    });

    res.status(201).json({ runId });
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error deploying automation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/automations/runs
 * Get user's automation runs
 */
router.get('/runs', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const runs = await automationService.getUserAutomations(userId as string);
    res.json(runs);
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error getting runs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/automations/runs/:runId
 * Get automation run details
 */
router.get('/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = await automationService.getAutomationRun(runId);

    if (!run) {
      return res.status(404).json({ error: 'Automation run not found' });
    }

    res.json(run);
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error getting run:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/automations/runs/:runId/status
 * Update automation status
 */
router.patch('/runs/:runId/status', async (req, res) => {
  try {
    const { runId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing status' });
    }

    await automationService.updateAutomationStatus(runId, status);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error updating status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/runs/:runId/execute
 * Record automation execution
 */
router.post('/runs/:runId/execute', async (req, res) => {
  try {
    const { runId } = req.params;
    const { success } = req.body;

    await automationService.recordExecution(runId, success !== false);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error recording execution:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/seed-templates
 * Seed official automation templates (admin only)
 */
router.post('/seed-templates', async (req, res) => {
  try {
    await automationService.seedOfficialTemplates();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[AUTOMATIONS] Error seeding templates:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
