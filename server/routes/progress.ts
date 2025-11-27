/**
 * PROGRESS SSE ENDPOINT - TIER 2 IMPLEMENTATION
 * Streams real-time progress events to browser via SSE
 * Connected to ProgressTracker for workflow visibility
 */

import type { Express } from "express";
import { ProgressTracker } from "../workflows/progress-tracker.ts";
import { isAuthenticated } from "../universalAuth.ts";

export function registerProgressRoutes(app: Express) {
  /**
   * SSE endpoint: /api/chat/progress/:conversationId
   * Streams progress events to browser in real-time
   */
  app.get("/api/chat/progress/:conversationId", isAuthenticated, (req, res) => {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId required" });
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no"); // Disable buffering for Nginx

    console.log(`📡 [PROGRESS-SSE] Client connected for conversation ${conversationId}`);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: "connected", message: "Progress streaming started" })}\n\n`);

    // Subscribe to progress events
    const unsubscribe = ProgressTracker.subscribe((event) => {
      // Send event to client
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Handle client disconnect
    req.on("close", () => {
      console.log(`📡 [PROGRESS-SSE] Client disconnected for conversation ${conversationId}`);
      unsubscribe();
      res.end();
    });

    // Send heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000); // 30 seconds

    req.on("close", () => {
      clearInterval(heartbeat);
    });
  });

  /**
   * Get recent progress events for conversation
   * Useful if client joins after workflow started
   */
  app.get("/api/chat/progress/:conversationId/history", isAuthenticated, (req, res) => {
    const { conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const recentEvents = ProgressTracker.getRecent(limit);

    res.json({
      conversationId,
      events: recentEvents,
      timestamp: Date.now(),
    });
  });

  /**
   * Clear progress events (admin only)
   */
  app.post("/api/chat/progress/clear", isAuthenticated, (req, res) => {
    // TODO: Add admin check
    ProgressTracker.clear();
    res.json({ success: true, message: "Progress events cleared" });
  });

  console.log("[PROGRESS-ROUTES] SSE progress routes registered");
}
