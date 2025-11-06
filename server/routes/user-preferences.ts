import type { Express } from "express";
import { db } from "../db";
import { userPreferences, insertUserPreferenceSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../universalAuth";

export function registerUserPreferencesRoutes(app: Express) {
  // GET /api/user/preferences - Get user preferences
  app.get("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;

      const [prefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      // Return default preferences if not set
      if (!prefs) {
        return res.json({
          userId,
          aiModel: 'claude',
          theme: 'light',
        });
      }

      res.json(prefs);
    } catch (error: any) {
      console.error('[USER-PREFERENCES] Error getting preferences:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/user/preferences - Update preferences
  app.put("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { aiModel, theme } = req.body;

      // Validate AI model
      if (aiModel && !['claude', 'gemini'].includes(aiModel)) {
        return res.status(400).json({ error: 'Invalid AI model. Must be "claude" or "gemini"' });
      }

      // Validate theme
      if (theme && !['light', 'dark'].includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme. Must be "light" or "dark"' });
      }

      // Upsert preferences
      const [updated] = await db
        .insert(userPreferences)
        .values({
          userId,
          aiModel: aiModel || 'claude',
          theme: theme || 'light',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: {
            aiModel: aiModel !== undefined ? aiModel : undefined,
            theme: theme !== undefined ? theme : undefined,
            updatedAt: new Date(),
          },
        })
        .returning();

      res.json({ preferences: updated });
    } catch (error: any) {
      console.error('[USER-PREFERENCES] Error updating preferences:', error);
      res.status(400).json({ error: error.message });
    }
  });
}
