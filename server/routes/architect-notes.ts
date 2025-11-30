import type { Express } from "express";
import { db } from "../db";
import { architectNotes, insertArchitectNoteSchema } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { isAuthenticated, isAdmin } from "../universalAuth";

export function registerArchitectNotesRoutes(app: Express) {
  // GET /api/projects/:projectId/notes - List notes for project
  app.get("/api/projects/:projectId/notes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;

      const notes = await db
        .select()
        .from(architectNotes)
        .where(eq(architectNotes.projectId, projectId))
        .orderBy(desc(architectNotes.createdAt));

      res.json({ notes });
    } catch (error: any) {
      console.error('[ARCHITECT-NOTES] Error listing notes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/projects/:projectId/notes/:id - Get note details
  app.get("/api/projects/:projectId/notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { projectId, id } = req.params;

      const [note] = await db
        .select()
        .from(architectNotes)
        .where(and(
          eq(architectNotes.id, id),
          eq(architectNotes.projectId, projectId)
        ))
        .limit(1);

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.json({ note });
    } catch (error: any) {
      console.error('[ARCHITECT-NOTES] Error getting note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/projects/:projectId/notes - Create note (I AM or BeeHiveAI)
  app.post("/api/projects/:projectId/notes", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { title, content, authorRole, visibility } = req.body;

      // Validate input
      const validated = insertArchitectNoteSchema.parse({
        projectId,
        title,
        content,
        authorRole: authorRole || 'lomu', // Default to lomu
        visibility: visibility || 'project',
      });

      const [note] = await db
        .insert(architectNotes)
        .values(validated)
        .returning();

      res.json({ note });
    } catch (error: any) {
      console.error('[ARCHITECT-NOTES] Error creating note:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // PUT /api/projects/:projectId/notes/:id - Update note
  app.put("/api/projects/:projectId/notes/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { projectId, id } = req.params;
      const { title, content, visibility } = req.body;

      const [updated] = await db
        .update(architectNotes)
        .set({
          title: title !== undefined ? title : undefined,
          content: content !== undefined ? content : undefined,
          visibility: visibility !== undefined ? visibility : undefined,
          updatedAt: new Date(),
        })
        .where(and(
          eq(architectNotes.id, id),
          eq(architectNotes.projectId, projectId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.json({ note: updated });
    } catch (error: any) {
      console.error('[ARCHITECT-NOTES] Error updating note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/projects/:projectId/notes/:id - Delete note
  app.delete("/api/projects/:projectId/notes/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { projectId, id } = req.params;

      await db
        .delete(architectNotes)
        .where(and(
          eq(architectNotes.id, id),
          eq(architectNotes.projectId, projectId)
        ));

      res.json({ success: true });
    } catch (error: any) {
      console.error('[ARCHITECT-NOTES] Error deleting note:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
