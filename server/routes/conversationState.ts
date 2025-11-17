import { Router } from 'express';
import { isAuthenticated } from '../universalAuth';
import {
  getState,
  getOrCreateState,
  updateGoal,
  updateSummary,
  clearState,
  updateContext,
  formatStateForPrompt,
} from '../services/conversationState';
import { db } from '../db';
import { conversationStates } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/conversation/sessions
 * List all conversation sessions for the current user
 */
router.get('/sessions', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string | undefined;

    let query = db
      .select()
      .from(conversationStates)
      .where(eq(conversationStates.userId, userId))
      .orderBy(desc(conversationStates.lastInteractionAt))
      .limit(limit);

    const sessions = await query;

    // Filter by search term if provided
    let filteredSessions = sessions;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredSessions = sessions.filter(session => 
        (session.currentGoal?.toLowerCase() ?? '').includes(searchLower) ||
        (session.sessionSummary?.toLowerCase() ?? '').includes(searchLower) ||
        (session.projectId?.toLowerCase() ?? '').includes(searchLower)
      );
    }

    res.json({
      success: true,
      sessions: filteredSessions,
      total: filteredSessions.length
    });
  } catch (error: any) {
    console.error('[CONVERSATION-STATE-API] Failed to list sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/conversation/state/:projectId
 * Get current conversation state for a project (or null for general chat)
 */
router.get('/state/:projectId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const projectId = req.params.projectId === 'general' ? null : req.params.projectId;

    const state = await getState(userId, projectId);

    if (!state) {
      return res.json({
        success: true,
        state: null,
        message: 'No conversation state found',
      });
    }

    res.json({
      success: true,
      state,
    });
  } catch (error: any) {
    console.error('[CONVERSATION-STATE-API] Failed to get state:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/conversation/state/:projectId/init
 * Initialize or get existing conversation state
 */
router.post('/state/:projectId/init', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const projectId = req.params.projectId === 'general' ? null : req.params.projectId;

    const state = await getOrCreateState(userId, projectId);

    res.json({
      success: true,
      state,
    });
  } catch (error: any) {
    console.error('[CONVERSATION-STATE-API] Failed to initialize state:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/conversation/state/:projectId/goal
 * Set or update the current goal
 */
router.post('/state/:projectId/goal', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const projectId = req.params.projectId === 'general' ? null : req.params.projectId;
    const { goal } = req.body;

    if (!goal || typeof goal !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Goal is required and must be a string',
      });
    }

    // Get or create state
    const state = await getOrCreateState(userId, projectId);

    // Update goal
    const updatedState = await updateGoal(state.id, goal);

    res.json({
      success: true,
      state: updatedState,
      message: 'Goal updated successfully',
    });
  } catch (error: any) {
    console.error('[CONVERSATION-STATE-API] Failed to update goal:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/conversation/state/:projectId/summary
 * Update the session summary
 */
router.post('/state/:projectId/summary', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const projectId = req.params.projectId === 'general' ? null : req.params.projectId;
    const { summary } = req.body;

    if (!summary || typeof summary !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Summary is required and must be a string',
      });
    }

    // Get or create state
    const state = await getOrCreateState(userId, projectId);

    // Update summary
    const updatedState = await updateSummary(state.id, summary);

    res.json({
      success: true,
      state: updatedState,
      message: 'Summary updated successfully',
    });
  } catch (error: any) {
    console.error('[CONVERSATION-STATE-API] Failed to update summary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/conversation/state/:projectId/context
 * Update context (structured data)
 */
router.post('/state/:projectId/context', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const projectId = req.params.projectId === 'general' ? null : req.params.projectId;
    const { context } = req.body;

    if (!context || typeof context !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Context is required and must be an object',
      });
    }

    // Get or create state
    const state = await getOrCreateState(userId, projectId);

    // Update context
    const updatedState = await updateContext(state.id, context);

    res.json({
      success: true,
      state: updatedState,
      message: 'Context updated successfully',
    });
  } catch (error: any) {
    console.error('[CONVERSATION-STATE-API] Failed to update context:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/conversation/state/:projectId/clear
 * Clear/reset conversation state
 */
router.post('/state/:projectId/clear', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const projectId = req.params.projectId === 'general' ? null : req.params.projectId;

    // Get state
    const state = await getState(userId, projectId);

    if (!state) {
      return res.json({
        success: true,
        message: 'No state to clear',
      });
    }

    // Clear state
    const clearedState = await clearState(state.id);

    res.json({
      success: true,
      state: clearedState,
      message: 'Conversation state cleared successfully',
    });
  } catch (error: any) {
    console.error('[CONVERSATION-STATE-API] Failed to clear state:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/conversation/state/:projectId/formatted
 * Get state formatted for AI prompt injection
 */
router.get('/state/:projectId/formatted', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const projectId = req.params.projectId === 'general' ? null : req.params.projectId;

    const state = await getState(userId, projectId);
    const formatted = await formatStateForPrompt(state);

    res.json({
      success: true,
      formatted,
      state,
    });
  } catch (error: any) {
    console.error('[CONVERSATION-STATE-API] Failed to format state:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
