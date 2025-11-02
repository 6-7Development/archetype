import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import multer from "multer";

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

export function registerFileUploadRoutes(app: Express) {
  // POST /api/projects/:projectId/uploads - Upload file (multipart)
  app.post(
    "/api/projects/:projectId/uploads",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const userId = req.authenticatedUserId;
        const { projectId } = req.params;
        const { folderId } = req.body;

        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        // If folder specified, verify it exists
        if (folderId) {
          const folder = await storage.getProjectFolder(folderId, userId);
          if (!folder) {
            return res.status(404).json({ error: "Folder not found" });
          }
          if (folder.projectId !== projectId) {
            return res.status(403).json({ error: "Folder belongs to different project" });
          }
        }

        // Convert file buffer to base64
        const base64Data = req.file.buffer.toString("base64");
        const storageKey = `data:${req.file.mimetype};base64,${base64Data}`;

        // Create file upload record
        const fileUpload = await storage.createFileUpload({
          projectId,
          userId,
          filename: req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_"), // Sanitize filename
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          storageKey, // Base64 data URL
          storageType: "base64",
          url: null, // No public URL for base64
          folderId: folderId || null,
        });

        res.json({
          ...fileUpload,
          url: storageKey, // Return data URL for immediate use
        });
      } catch (error: any) {
        console.error("Error uploading file:", error);
        res.status(500).json({ error: error.message || "Failed to upload file" });
      }
    }
  );

  // GET /api/projects/:projectId/uploads - List uploads
  app.get("/api/projects/:projectId/uploads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;

      const uploads = await storage.getFileUploads(projectId, userId);
      
      // Return uploads with data URLs
      const uploadsWithUrls = uploads.map((upload) => ({
        ...upload,
        url: upload.storageType === "base64" ? upload.storageKey : upload.url,
      }));

      res.json(uploadsWithUrls);
    } catch (error: any) {
      console.error("Error fetching uploads:", error);
      res.status(500).json({ error: error.message || "Failed to fetch uploads" });
    }
  });

  // DELETE /api/projects/:projectId/uploads/:uploadId - Delete upload
  app.delete("/api/projects/:projectId/uploads/:uploadId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, uploadId } = req.params;

      // Verify upload exists and belongs to user/project
      const upload = await storage.getFileUpload(uploadId, userId);
      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }
      if (upload.projectId !== projectId) {
        return res.status(403).json({ error: "Upload belongs to different project" });
      }

      await storage.deleteFileUpload(uploadId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting upload:", error);
      res.status(500).json({ error: error.message || "Failed to delete upload" });
    }
  });
}
