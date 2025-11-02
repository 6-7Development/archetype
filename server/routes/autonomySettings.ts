/**
 * Autonomy Settings API Routes
 */

import express from 'express';
import { autonomySettingsService } from '../services/autonomySettings.ts';

const router = express.Router();

// Get user's autonomy settings
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const settings = await autonomySettingsService.getUserSettings(req.user.id);
    const levelConfig = autonomySettingsService.getAutonomyLevelConfig(settings.autonomyLevel);

    res.json({ settings, levelConfig });
  } catch (error: any) {
    console.error('[AUTONOMY] Get settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to get autonomy settings' });
  }
});

// Update autonomy settings
router.put('/', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates = req.body;
    const settings = await autonomySettingsService.updateSettings(req.user.id, updates);

    res.json({ success: true, settings });
  } catch (error: any) {
    console.error('[AUTONOMY] Update settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update autonomy settings' });
  }
});

// Get autonomy level options
router.get('/levels', async (req: express.Request, res: express.Response) => {
  try {
    const levels = ['low', 'medium', 'high', 'max'].map(level => ({
      level,
      ...autonomySettingsService.getAutonomyLevelConfig(level),
    }));

    res.json({ levels });
  } catch (error: any) {
    console.error('[AUTONOMY] Get levels error:', error);
    res.status(500).json({ error: error.message || 'Failed to get autonomy levels' });
  }
});

export default router;
