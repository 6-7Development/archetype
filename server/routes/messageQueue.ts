/**
 * Message Queue API Routes
 */

import express from 'express';
import { messageQueueService } from '../services/messageQueue.ts';

const router = express.Router();

// Add message to queue
router.post('/enqueue', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId, message, priority, metadata } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const messageId = await messageQueueService.enqueue({
      userId: req.user.id,
      projectId,
      message,
      priority,
      metadata,
    });

    res.json({ success: true, messageId });
  } catch (error: any) {
    console.error('[MESSAGE-QUEUE] Enqueue error:', error);
    res.status(500).json({ error: error.message || 'Failed to enqueue message' });
  }
});

// Get user's queue
router.get('/queue', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const queue = await messageQueueService.getUserQueue(req.user.id);
    const size = await messageQueueService.getQueueSize(req.user.id);

    res.json({ queue, size });
  } catch (error: any) {
    console.error('[MESSAGE-QUEUE] Get queue error:', error);
    res.status(500).json({ error: error.message || 'Failed to get queue' });
  }
});

// Cancel a queued message
router.delete('/:messageId', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await messageQueueService.cancel(req.params.messageId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[MESSAGE-QUEUE] Cancel error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel message' });
  }
});

// Clear all queued messages
router.delete('/queue/clear', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await messageQueueService.clearUserQueue(req.user.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[MESSAGE-QUEUE] Clear queue error:', error);
    res.status(500).json({ error: error.message || 'Failed to clear queue' });
  }
});

export default router;
