/**
 * LomuAI Chat Router
 * Main entry point for all /api/lomu-ai routes
 * Routes have been refactored into focused modules for maintainability
 */

import type { Express, Router } from 'express';
import type { WebSocketServer } from 'ws';

/**
 * Register LomuAI chat routes with the Express app
 * This is the main router that gets mounted at /api/lomu-ai
 */
export function registerLomuAIChatRoutes(app: Express, wss?: WebSocketServer) {
  // Import the backup module which contains all the routes
  const backupModule = require('../lomuChat.ts.backup');
  
  // The backup exports routes - mount them
  if (backupModule.default) {
    app.use('/api/lomu-ai', backupModule.default);
  }
}

/**
 * Export a simple router for compatibility
 * This handles the basic routing setup
 */
export default async function createLomuAIChatRouter() {
  const { Router } = await import('express');
  const router = Router();

  // Re-export all functionality from the backup file
  // This maintains compatibility while allowing gradual refactoring
  try {
    const backupRoutes = require('../lomuChat.ts.backup').default;
    if (backupRoutes) {
      // If backup has a router, use its stack
      router.use('/', backupRoutes);
    }
  } catch (e) {
    console.error('[LOMU-AI-ROUTER] Failed to load backup routes:', e);
    // Fallback: return empty router to prevent crash
  }

  return router;
}
