import type { Express } from "express";
import { insertProjectMigrationSchema } from "@shared/schema";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";

export function registerMigrationRoutes(app: Express) {
  // GET /api/projects/:projectId/migrations - List all migrations for a project
  app.get("/api/projects/:projectId/migrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;

      const migrations = await storage.getProjectMigrations(projectId, userId);
      res.json(migrations);
    } catch (error: any) {
      console.error("Error fetching migrations:", error);
      res.status(500).json({ error: error.message || "Failed to fetch migrations" });
    }
  });

  // GET /api/projects/:projectId/migrations/history - Get applied migrations
  app.get("/api/projects/:projectId/migrations/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;

      const appliedMigrations = await storage.getAppliedMigrations(projectId, userId);
      res.json(appliedMigrations);
    } catch (error: any) {
      console.error("Error fetching migration history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch migration history" });
    }
  });

  // GET /api/projects/:projectId/migrations/:migrationId - Get single migration
  app.get("/api/projects/:projectId/migrations/:migrationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, migrationId } = req.params;

      const migration = await storage.getProjectMigration(migrationId, userId);
      
      if (!migration) {
        return res.status(404).json({ error: "Migration not found" });
      }

      if (migration.projectId !== projectId) {
        return res.status(403).json({ error: "Migration belongs to different project" });
      }

      res.json(migration);
    } catch (error: any) {
      console.error("Error fetching migration:", error);
      res.status(500).json({ error: error.message || "Failed to fetch migration" });
    }
  });

  // POST /api/projects/:projectId/migrations - Create new migration (MVP: mock data)
  app.post("/api/projects/:projectId/migrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const { name, sql, rollbackSql, filename } = req.body;

      if (!name || !sql) {
        return res.status(400).json({ error: "Migration name and SQL are required" });
      }

      // Verify project exists and belongs to user
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const migration = await storage.createProjectMigration({
        projectId,
        userId,
        name,
        filename: filename || `${Date.now()}_${name}.sql`,
        sql,
        rollbackSql: rollbackSql || null,
        status: "pending",
        appliedAt: null,
      });

      res.json(migration);
    } catch (error: any) {
      console.error("Error creating migration:", error);
      res.status(500).json({ error: error.message || "Failed to create migration" });
    }
  });

  // POST /api/projects/:projectId/migrations/:migrationId/apply - Apply migration (MVP: status update only)
  app.post("/api/projects/:projectId/migrations/:migrationId/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, migrationId } = req.params;

      const migration = await storage.getProjectMigration(migrationId, userId);
      
      if (!migration) {
        return res.status(404).json({ error: "Migration not found" });
      }

      if (migration.projectId !== projectId) {
        return res.status(403).json({ error: "Migration belongs to different project" });
      }

      if (migration.status === "applied") {
        return res.status(400).json({ error: "Migration already applied" });
      }

      // MVP: Just update status - actual execution requires per-project database
      const updated = await storage.updateMigrationStatus(migrationId, "applied", new Date());
      res.json(updated);
    } catch (error: any) {
      console.error("Error applying migration:", error);
      res.status(500).json({ error: error.message || "Failed to apply migration" });
    }
  });

  // POST /api/projects/:projectId/migrations/:migrationId/rollback - Rollback migration (MVP: status update only)
  app.post("/api/projects/:projectId/migrations/:migrationId/rollback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, migrationId } = req.params;

      const migration = await storage.getProjectMigration(migrationId, userId);
      
      if (!migration) {
        return res.status(404).json({ error: "Migration not found" });
      }

      if (migration.projectId !== projectId) {
        return res.status(403).json({ error: "Migration belongs to different project" });
      }

      if (migration.status !== "applied") {
        return res.status(400).json({ error: "Migration not applied" });
      }

      // MVP: Just update status - actual rollback requires per-project database
      const updated = await storage.updateMigrationStatus(migrationId, "pending");
      res.json(updated);
    } catch (error: any) {
      console.error("Error rolling back migration:", error);
      res.status(500).json({ error: error.message || "Failed to rollback migration" });
    }
  });
}
