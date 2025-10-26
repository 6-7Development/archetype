/**
 * Design Prototype API Routes - Quick frontend prototypes
 */

import { Router } from 'express';
import { designPrototypeService } from '../services/designPrototype';

const router = Router();

/**
 * POST /api/design-prototypes
 * Create a new design prototype
 */
router.post('/', async (req, res) => {
  try {
    const { userId, projectId, planSessionId, name, description, screens, designSystemTokens } = req.body;

    if (!userId || !name || !screens) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const prototypeId = await designPrototypeService.createPrototype({
      userId,
      projectId,
      planSessionId,
      name,
      description,
      screens,
      designSystemTokens,
    });

    res.status(201).json({ prototypeId });
  } catch (error: any) {
    console.error('[DESIGN_PROTOTYPE] Error creating prototype:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/design-prototypes/:prototypeId
 * Get prototype details
 */
router.get('/:prototypeId', async (req, res) => {
  try {
    const { prototypeId } = req.params;
    const prototype = await designPrototypeService.getPrototype(prototypeId);

    if (!prototype) {
      return res.status(404).json({ error: 'Prototype not found' });
    }

    res.json(prototype);
  } catch (error: any) {
    console.error('[DESIGN_PROTOTYPE] Error getting prototype:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/design-prototypes
 * Get user's prototypes
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const prototypes = await designPrototypeService.getUserPrototypes(userId as string);
    res.json(prototypes);
  } catch (error: any) {
    console.error('[DESIGN_PROTOTYPE] Error getting prototypes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/design-prototypes/:prototypeId/screens
 * Update prototype screens
 */
router.patch('/:prototypeId/screens', async (req, res) => {
  try {
    const { prototypeId } = req.params;
    const { screens } = req.body;

    if (!Array.isArray(screens)) {
      return res.status(400).json({ error: 'Screens must be an array' });
    }

    await designPrototypeService.updateScreens(prototypeId, screens);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[DESIGN_PROTOTYPE] Error updating screens:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/design-prototypes/:prototypeId/approve
 * Approve prototype for building
 */
router.post('/:prototypeId/approve', async (req, res) => {
  try {
    const { prototypeId } = req.params;
    await designPrototypeService.approvePrototype(prototypeId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[DESIGN_PROTOTYPE] Error approving prototype:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/design-prototypes/:prototypeId/build
 * Start building approved prototype
 */
router.post('/:prototypeId/build', async (req, res) => {
  try {
    const { prototypeId } = req.params;
    const { generatedFiles } = req.body;

    await designPrototypeService.startBuilding(prototypeId, generatedFiles);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[DESIGN_PROTOTYPE] Error starting build:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/design-prototypes/:prototypeId/generate-tokens
 * Generate design system tokens from screens
 */
router.post('/:prototypeId/generate-tokens', async (req, res) => {
  try {
    const { prototypeId } = req.params;
    const prototype = await designPrototypeService.getPrototype(prototypeId);

    if (!prototype) {
      return res.status(404).json({ error: 'Prototype not found' });
    }

    const tokens = designPrototypeService.generateDesignTokens(prototype.screens as any[]);
    res.json(tokens);
  } catch (error: any) {
    console.error('[DESIGN_PROTOTYPE] Error generating tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
