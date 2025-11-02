import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";

export function registerFileOperationRoutes(app: Express) {
  // PUT /api/projects/:projectId/files/:fileId/move - Move file to folder
  app.put("/api/projects/:projectId/files/:fileId/move", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, fileId } = req.params;
      const { folderId } = req.body;

      // Verify file exists and belongs to user/project
      const file = await storage.getFile(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      if (file.projectId !== projectId) {
        return res.status(403).json({ error: "File belongs to different project" });
      }

      // If moving to a folder, verify it exists
      if (folderId) {
        const folder = await storage.getProjectFolder(folderId, userId);
        if (!folder) {
          return res.status(404).json({ error: "Target folder not found" });
        }
        if (folder.projectId !== projectId) {
          return res.status(403).json({ error: "Target folder belongs to different project" });
        }
      }

      const updated = await storage.moveFile(fileId, userId, folderId || null);
      res.json(updated);
    } catch (error: any) {
      console.error("Error moving file:", error);
      res.status(500).json({ error: error.message || "Failed to move file" });
    }
  });

  // PUT /api/projects/:projectId/files/:fileId/rename - Rename file
  app.put("/api/projects/:projectId/files/:fileId/rename", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, fileId } = req.params;
      const { filename } = req.body;

      if (!filename) {
        return res.status(400).json({ error: "Filename is required" });
      }

      // Verify file exists and belongs to user/project
      const file = await storage.getFile(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      if (file.projectId !== projectId) {
        return res.status(403).json({ error: "File belongs to different project" });
      }

      const updated = await storage.renameFile(fileId, userId, filename);
      res.json(updated);
    } catch (error: any) {
      console.error("Error renaming file:", error);
      res.status(500).json({ error: error.message || "Failed to rename file" });
    }
  });

  // DELETE /api/projects/:projectId/files/bulk - Bulk delete files
  app.delete("/api/projects/:projectId/files/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const { fileIds } = req.body;

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: "fileIds array is required" });
      }

      // Verify all files belong to user and project
      for (const fileId of fileIds) {
        const file = await storage.getFile(fileId, userId);
        if (!file) {
          return res.status(404).json({ error: `File ${fileId} not found` });
        }
        if (file.projectId !== projectId) {
          return res.status(403).json({ error: `File ${fileId} belongs to different project` });
        }
      }

      await storage.bulkDeleteFiles(fileIds, userId);
      res.json({ success: true, deleted: fileIds.length });
    } catch (error: any) {
      console.error("Error bulk deleting files:", error);
      res.status(500).json({ error: error.message || "Failed to bulk delete files" });
    }
  });
}
