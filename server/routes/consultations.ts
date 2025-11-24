import type { Express } from "express";
import { db } from "../db";
import { architectNotes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../universalAuth";

export function registerConsultationRoutes(app: Express) {
  // GET /api/architect/consultations - List all consultations for user
  app.get("/api/architect/consultations", isAuthenticated, async (req: any, res) => {
    try {
      const consultations = await db
        .select()
        .from(architectNotes)
        .where(eq(architectNotes.authorRole, 'architect'))
        .limit(100);

      res.json({ consultations });
    } catch (error: any) {
      console.error('[CONSULTATIONS] Error listing:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/architect/consultations/:id - Get consultation details
  app.get("/api/architect/consultations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const [consultation] = await db
        .select()
        .from(architectNotes)
        .where(eq(architectNotes.id, req.params.id));

      if (!consultation) return res.status(404).json({ error: 'Not found' });
      res.json({ consultation });
    } catch (error: any) {
      console.error('[CONSULTATIONS] Error getting:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
