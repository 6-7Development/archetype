import type { Express } from "express";
import { insertProjectFolderSchema } from "@shared/schema";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";

export function registerFolderRoutes(app: Express) {
  // POST /api/projects/:projectId/folders - Create folder
  app.post("/api/projects/:projectId/folders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const { name, parentId, path } = req.body;

      // Validate request
      if (!name || !path) {
        return res.status(400).json({ error: "Name and path are required" });
      }

      // Validate folder hierarchy - prevent circular references
      if (parentId) {
        const parentFolder = await storage.getProjectFolder(parentId, userId);
        if (!parentFolder) {
          return res.status(404).json({ error: "Parent folder not found" });
        }
        if (parentFolder.projectId !== projectId) {
          return res.status(403).json({ error: "Parent folder belongs to different project" });
        }
        
        // Check for circular reference by ensuring path doesn't loop
        if (path.startsWith(parentFolder.path + "/") === false && path !== parentFolder.path) {
          // Parent path should be a prefix of the child path
          return res.status(400).json({ error: "Invalid folder hierarchy" });
        }
      }

      // Protect against path traversal attacks
      if (path.includes("..") || path.includes("//")) {
        return res.status(400).json({ error: "Invalid path format" });
      }

      const folder = await storage.createProjectFolder({
        projectId,
        userId,
        name,
        parentId: parentId || null,
        path,
      });

      res.json(folder);
    } catch (error: any) {
      console.error("Error creating folder:", error);
      res.status(500).json({ error: error.message || "Failed to create folder" });
    }
  });

  // GET /api/projects/:projectId/folders - List folders recursively
  app.get("/api/projects/:projectId/folders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;

      const folders = await storage.getProjectFolders(projectId, userId);
      res.json(folders);
    } catch (error: any) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ error: error.message || "Failed to fetch folders" });
    }
  });

  // PUT /api/projects/:projectId/folders/:folderId - Rename folder
  app.put("/api/projects/:projectId/folders/:folderId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, folderId } = req.params;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Verify folder exists and belongs to user/project
      const folder = await storage.getProjectFolder(folderId, userId);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      if (folder.projectId !== projectId) {
        return res.status(403).json({ error: "Folder belongs to different project" });
      }

      const updated = await storage.updateProjectFolder(folderId, userId, name);
      res.json(updated);
    } catch (error: any) {
      console.error("Error renaming folder:", error);
      res.status(500).json({ error: error.message || "Failed to rename folder" });
    }
  });

  // DELETE /api/projects/:projectId/folders/:folderId - Delete folder (cascade)
  app.delete("/api/projects/:projectId/folders/:folderId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, folderId } = req.params;

      // Verify folder exists and belongs to user/project
      const folder = await storage.getProjectFolder(folderId, userId);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      if (folder.projectId !== projectId) {
        return res.status(403).json({ error: "Folder belongs to different project" });
      }

      // Delete folder (cascade delete will be handled in storage layer)
      await storage.deleteProjectFolder(folderId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ error: error.message || "Failed to delete folder" });
    }
  });
}
