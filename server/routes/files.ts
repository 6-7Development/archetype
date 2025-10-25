import type { Express } from "express";
import { insertFileSchema, insertChatMessageSchema } from "@shared/schema";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

export function registerFileRoutes(app: Express) {
  // GET /api/files - Get all files for authenticated user
  app.get("/api/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const files = await storage.getFiles(userId);
      res.json(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // POST /api/files - Create new file
  app.post("/api/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const validated = insertFileSchema.parse(req.body);
      const file = await storage.createFile({ ...validated, userId });
      res.json(file);
    } catch (error) {
      console.error('Error creating file:', error);
      res.status(400).json({ error: "Failed to create file" });
    }
  });

  // PUT /api/files/:id - Update file
  app.put("/api/files/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      const { content } = req.body;
      
      await storage.updateFile(id, userId, content);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating file:', error);
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  // DELETE /api/files/:id - Delete file
  app.delete("/api/files/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      
      await storage.deleteFile(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // GET /api/chat/messages/:fileId - Get chat messages for a file
  app.get("/api/chat/messages/:fileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { fileId } = req.params;
      const messages = await storage.getChatMessages(fileId, userId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  // GET /api/chat/history/:projectId - Get chat history for a project
  app.get("/api/chat/history/:projectId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      
      console.log(`📝 [CHAT-HISTORY] Fetching history for project ${projectId}, user ${userId}`);
      
      const history = await storage.getChatHistory(userId, projectId);
      
      console.log(`📝 [CHAT-HISTORY] Found ${history?.length || 0} messages for project ${projectId}`);
      
      res.json(history || []);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  // POST /api/chat/messages - Save chat message
  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const validated = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage({ ...validated, userId });
      res.json(message);
    } catch (error: any) {
      console.error('Error creating chat message:', error);
      res.status(400).json({ error: error.message || "Failed to create chat message" });
    }
  });

  // POST /api/chat/upload-image - Upload image for chat
  app.post("/api/chat/upload-image", isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const userId = req.authenticatedUserId;
      const imageFile = req.file;
      
      console.log('[IMAGE UPLOAD] Processing image:', {
        originalName: imageFile.originalname,
        mimetype: imageFile.mimetype,
        size: imageFile.size,
        userId
      });

      // Store in attached_assets/chat_images/
      const uploadDir = path.join(process.cwd(), 'attached_assets', 'chat_images');
      
      // Ensure directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      // Generate unique filename
      const ext = path.extname(imageFile.originalname);
      const timestamp = Date.now();
      const filename = `chat_image_${timestamp}${ext}`;
      const filepath = path.join(uploadDir, filename);
      
      // Write file to disk
      await fs.writeFile(filepath, imageFile.buffer);
      
      console.log('[IMAGE UPLOAD] Successfully saved image to:', filepath);
      
      // Return public URL (relative to attached_assets)
      const publicUrl = `/attached_assets/chat_images/${filename}`;
      
      res.json({ 
        url: publicUrl,
        filename,
        size: imageFile.size,
        mimeType: imageFile.mimetype
      });
    } catch (error: any) {
      console.error('[IMAGE UPLOAD] ERROR:', error);
      console.error('[IMAGE UPLOAD] Stack:', error.stack);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });
}
