import type { Express } from "express";
import type { WebSocketServer } from "ws";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import { insertScratchpadEntrySchema } from "@shared/schema";
import { broadcastToUser } from "./websocket";

export function registerScratchpadRoutes(app: Express, deps?: { wss?: WebSocketServer }) {
  const wss = deps?.wss;

  // POST /api/scratchpad - Create a new scratchpad entry
  app.post("/api/scratchpad", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertScratchpadEntrySchema.parse(req.body);
      
      const entry = await storage.createScratchpadEntry(validatedData);
      
      // Broadcast to WebSocket clients for real-time updates
      if (wss) {
        broadcastToUser(wss, req.user!.id, {
          type: 'scratchpad_entry',
          entry,
        });
      }
      
      res.json(entry);
    } catch (error: any) {
      console.error('[SCRATCHPAD] Error creating entry:', error);
      res.status(500).json({ error: error.message || 'Failed to create scratchpad entry' });
    }
  });

  // GET /api/scratchpad/:sessionId - Get all scratchpad entries for a session
  app.get("/api/scratchpad/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const entries = await storage.getScratchpadEntries(sessionId);
      res.json(entries);
    } catch (error: any) {
      console.error('[SCRATCHPAD] Error fetching entries:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch scratchpad entries' });
    }
  });

  // DELETE /api/scratchpad/:sessionId - Clear all scratchpad entries for a session
  app.delete("/api/scratchpad/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      await storage.clearScratchpadEntries(sessionId);
      
      // Broadcast clear event to WebSocket clients
      if (wss) {
        broadcastToUser(wss, req.user!.id, {
          type: 'scratchpad_cleared',
          sessionId,
        });
      }
      
      res.json({ success: true, message: 'Scratchpad cleared successfully' });
    } catch (error: any) {
      console.error('[SCRATCHPAD] Error clearing entries:', error);
      res.status(500).json({ error: error.message || 'Failed to clear scratchpad entries' });
    }
  });
}
