/**
 * Walkthrough/Tutorial API Routes
 * 
 * Provides endpoints for interactive tutorials and walkthroughs
 */

import { Router } from 'express';
import { walkthroughService } from '../services/walkthroughService';
import { isAuthenticated } from '../universalAuth';

const router = Router();

router.get('/list', (req, res) => {
  const category = req.query.category as string | undefined;
  const walkthroughs = walkthroughService.getWalkthroughs(category);
  res.json(walkthroughs);
});

router.get('/:id', (req, res) => {
  const walkthrough = walkthroughService.getWalkthrough(req.params.id);
  if (!walkthrough) {
    return res.status(404).json({ error: 'Walkthrough not found' });
  }
  res.json(walkthrough);
});

router.get('/recommended', isAuthenticated, (req, res) => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const recommended = walkthroughService.getRecommendedWalkthrough(userId);
  res.json(recommended);
});

router.post('/:id/start', isAuthenticated, async (req, res) => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const progress = await walkthroughService.startWalkthrough(userId, req.params.id);
  if (!progress) {
    return res.status(404).json({ error: 'Walkthrough not found' });
  }
  res.json(progress);
});

router.post('/:id/step/:stepId/complete', isAuthenticated, async (req, res) => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const progress = await walkthroughService.completeStep(
    userId, 
    req.params.id, 
    req.params.stepId
  );
  
  if (!progress) {
    return res.status(404).json({ error: 'Progress not found' });
  }
  res.json(progress);
});

router.post('/:id/skip', isAuthenticated, async (req, res) => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await walkthroughService.skipWalkthrough(userId, req.params.id);
  res.json({ success: true });
});

router.get('/progress/all', isAuthenticated, (req, res) => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const progress = walkthroughService.getAllProgress(userId);
  res.json(progress);
});

router.get('/progress/:id', isAuthenticated, (req, res) => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const progress = walkthroughService.getProgress(userId, req.params.id);
  res.json(progress || null);
});

export default router;
