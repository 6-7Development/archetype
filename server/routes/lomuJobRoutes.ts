import { Router } from 'express';
import { isAuthenticated, isAdmin } from '../universalAuth.ts';
import { db } from '../db.ts';
import { lomuJobs } from '@shared/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { createJob, startJobWorker, resumeJob, cancelJob } from '../services/lomuJobManager.ts';

const router = Router();

// POST /api/lomu-ai/start - Start a new background job
router.post('/start', isAuthenticated, async (req: any, res) => {
  try {
    const { message } = req.body;
    const userId = req.authenticatedUserId;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 🔥 CRITICAL FIX: SHORT-CIRCUIT for simple conversational messages
    // Don't create jobs for "hi", "thanks", etc. - respond directly instead
    const { isSimpleMessage } = await import('../services/lomuJobManager');

    if (isSimpleMessage(message)) {
      console.log('[LOMU-AI] Simple message detected, responding directly without job:', message.substring(0, 30));

      // Prepare simple responses
      const simpleResponses = {
        greetings: "Hey! 👋 I'm LomuAI, your platform maintenance assistant. Need help with something?",
        thanks: "You're welcome! Happy to help! 🍋",
        yes_no: "Got it! Let me know if you need anything else.",
        about: "I'm LomuAI - I maintain the Lomu platform, fix bugs, and handle deployments. What can I help you with today?"
      };

      const msg = message.trim().toLowerCase();
      let response = simpleResponses.about; // default

      if (/^(hi|hey|hello|yo|sup|howdy|greetings)/.test(msg)) {
        response = simpleResponses.greetings;
      } else if (/^(thanks?|thank you|thx|ty)/.test(msg)) {
        response = simpleResponses.thanks;
      } else if (/^(yes|no|ok|okay|nope|yep|yeah|nah)/.test(msg)) {
        response = simpleResponses.yes_no;
      }

      // Save simple exchange to chat history
      const { chatMessages } = await import('@shared/schema');
      const [assistantMsg] = await db
        .insert(chatMessages)
        .values({
          userId,
          projectId: null,
          fileId: null,
          role: 'assistant',
          content: response,
          isPlatformHealing: true,
        })
        .returning();

      return res.json({
        success: true,
        message: response,
        messageId: assistantMsg.id,
        isSimpleResponse: true, // Flag to indicate no job was created
      });
    }

    // ONLY create job for actual work requests
    const job = await createJob(userId, message);

    // Start worker in background (fire and forget)
    startJobWorker(job.id);

    console.log('[LOMU-AI] Started background job:', job.id);

    res.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job started successfully',
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to start job:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/lomu-ai/resume/:jobId - Resume an interrupted or failed job
router.post('/resume/:jobId', isAuthenticated, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;

    // Resume the job
    await resumeJob(jobId, userId);

    console.log('[LOMU-AI] Resumed job:', jobId);

    res.json({ 
      success: true,
      message: 'Job resumed successfully',
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to resume job:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('cannot be resumed')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

// GET /api/lomu-ai/job/:jobId - Get job status and details
router.get('/job/:jobId', isAuthenticated, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;

    // Get the job
    const job = await getJob(jobId, userId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ 
      success: true, 
      job,
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to get job:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/lomu-ai/job/:jobId/cancel - Cancel a running or pending job (graceful)
router.post('/job/:jobId/cancel', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { jobId } = req.params;
    const { reason } = req.body;
    
    // Get the job
    const job = await db.query.lomuJobs.findFirst({
      where: (jobs, { eq }) => eq(jobs.id, jobId)
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Allow admins/owners to cancel any job, or user to cancel their own
    const { users } = await import('@shared/schema');
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

    if (job.userId !== userId && !user?.isOwner && user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to cancel this job' });
    }
    
    const cancelledJob = await cancelJob(jobId, reason || 'Cancelled by user');
    
    console.log('[LOMU-AI] Job gracefully cancelled:', jobId, 'by user:', userId);
    
    res.json({ 
      success: true,
      job: cancelledJob,
      message: 'Job cancelled successfully'
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Cancel job error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/lomu-ai/active-job - Get user's active or interrupted job
router.get('/active-job', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;

    // Find the most recent active, interrupted, or pending job
    const job = await db.query.lomuJobs.findFirst({
      where: (jobs, { and, eq, inArray }) => and(
        eq(jobs.userId, userId),
        inArray(jobs.status, ['pending', 'running', 'interrupted'])
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    console.log('[LOMU-AI] Active job query for user:', userId, job ? `found ${job.id}` : 'none found');

    res.json({ 
      success: true, 
      job: job || null,
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to get active job:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/lomu-ai/job/:jobId - Cancel/clean up a stuck job (admin)
router.delete('/job/:jobId', isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.authenticatedUserId;

    // Get the job
    const job = await db.query.lomuJobs.findFirst({
      where: (jobs, { eq }) => eq(jobs.id, jobId)
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Admins can clean up any job, regular users can only clean up their own
    const { users } = await import('@shared/schema');
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

    if (!user?.isOwner && job.userId !== userId) {
      return res.status(403).json({ error: 'You can only cancel your own jobs' });
    }

    // Mark as failed/interrupted
    await db.update(lomuJobs)
      .set({ 
        status: 'failed',
        error: 'Job cancelled by user',
        updatedAt: new Date()
      })
      .where(eq(lomuJobs.id, jobId));

    console.log('[LOMU-AI] Job cancelled:', jobId, 'by user:', userId);

    res.json({ 
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error: any) {
    console.error('[LOMU-AI] Failed to cancel job:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;