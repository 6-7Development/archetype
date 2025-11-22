import express from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import path from "path";
import * as fs from "fs/promises";
import * as crypto from "crypto";
import { fileUploadSchema, filePathSchema, filenameSchema } from '../validation/inputValidator';
import { normalizePathForStorage } from '../validation/authoritativeValidator';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Project root for path validation (uploads directory)
const PROJECT_ROOT = path.join(process.cwd(), 'uploads');

/**
 * Validate file path to prevent path traversal attacks
 * Returns validation result with normalized safe path
 */
function validatePath(userPath: string): { safe: boolean; normalized: string; absolutePath: string } {
  // Normalize the path (resolves .., ., //)
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Resolve to absolute path within PROJECT_ROOT
  const absolutePath = path.resolve(PROJECT_ROOT, normalized);
  
  // Ensure path stays within PROJECT_ROOT
  if (!absolutePath.startsWith(PROJECT_ROOT + path.sep) && absolutePath !== PROJECT_ROOT) {
    console.warn(`[PATH-VALIDATION] Rejected path traversal: ${userPath} -> ${absolutePath}`);
    return { safe: false, normalized, absolutePath };
  }
  
  // Block access to sensitive directories
  const forbidden = ['.git', 'node_modules', '.env', '.env.local'];
  const pathLower = normalized.toLowerCase();
  if (forbidden.some(dir => pathLower.includes(dir.toLowerCase()))) {
    console.warn(`[PATH-VALIDATION] Rejected access to forbidden directory: ${userPath}`);
    return { safe: false, normalized, absolutePath };
  }
  
  // Block null bytes (directory traversal attack)
  if (userPath.includes('\0') || normalized.includes('\0')) {
    console.warn(`[PATH-VALIDATION] Rejected null byte in path: ${userPath}`);
    return { safe: false, normalized, absolutePath };
  }
  
  return { safe: true, normalized, absolutePath };
}

// Upload and import project from ZIP
router.post('/upload', isAuthenticated, upload.single('project'), async (req: any, res) => {
  try {
    console.log('🔵 Upload endpoint hit!');
    console.log('  User:', req.authenticatedUserId);
    console.log('  File:', req.file ? req.file.originalname : 'NO FILE');
    
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // CRITICAL SECURITY: Validate filename using Zod schema
    const filenameValidation = filenameSchema.safeParse(req.file.originalname);
    if (!filenameValidation.success) {
      return res.status(400).json({
        error: 'Invalid filename',
        details: filenameValidation.error.errors
      });
    }

    if (!req.file.originalname.endsWith('.zip')) {
      console.log('❌ Not a ZIP file');
      return res.status(400).json({ error: 'Only ZIP files are supported' });
    }

    const userId = req.authenticatedUserId;
    console.log('✅ File accepted, processing...');
    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    // Create project
    const projectName = path.basename(req.file.originalname, '.zip');
    const project = await storage.createProject({
      userId,
      name: projectName,
      description: `Imported from ${req.file.originalname}`,
      type: 'webapp',
    });

    // Security: Track decompression size to prevent zip bombs
    let totalUncompressedSize = 0;
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB uncompressed limit
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file limit
    
    // Extract and import files
    console.log(`📦 Starting import of ${zipEntries.length} entries from ${req.file.originalname}`);
    
    const filePromises = zipEntries
      .filter(entry => !entry.isDirectory && !entry.name.includes('__MACOSX'))
      .map(async (entry) => {
        const filePath = entry.entryName;
        
        // Use authoritative path validator to prevent path traversal attacks
        const validation = normalizePathForStorage(filePath, PROJECT_ROOT);
        if (!validation.safe) {
          console.error(`❌ SECURITY: Path traversal detected in ZIP: ${filePath}`);
          throw new Error(validation.error || `Path traversal detected in ZIP: ${filePath}`);
        }
        
        // SECURITY: Check uncompressed size before extracting
        const uncompressedSize = entry.header.size;
        totalUncompressedSize += uncompressedSize;
        
        if (uncompressedSize > MAX_FILE_SIZE) {
          console.warn(`❌ Rejected oversized file: ${filePath} (${uncompressedSize} bytes)`);
          return null;
        }
        
        if (totalUncompressedSize > MAX_TOTAL_SIZE) {
          throw new Error('ZIP archive exceeds maximum uncompressed size (100MB). Possible zip bomb detected.');
        }
        
        const fileName = path.basename(validation.normalized);
        const folderPath = path.dirname(validation.normalized);
        
        // Extract content safely
        let content: string;
        try {
          content = entry.getData().toString('utf8');
        } catch (error) {
          console.warn(`⚠️ Failed to extract ${filePath}: ${error}`);
          return null;
        }
        
        // Determine language from extension
        const ext = path.extname(fileName).toLowerCase();
        const languageMap: Record<string, string> = {
          '.js': 'javascript',
          '.jsx': 'javascript',
          '.ts': 'typescript',
          '.tsx': 'typescript',
          '.html': 'html',
          '.css': 'css',
          '.json': 'json',
          '.md': 'markdown',
          '.py': 'python',
          '.java': 'java',
          '.go': 'go',
        };
        const language = languageMap[ext] || 'plaintext';

        try {
          // Use validated normalized path components for storage
          await storage.createFile({
            userId,
            projectId: project.id,
            filename: fileName,
            path: folderPath,
            content,
            language,
          });
          console.log(`✅ Imported: ${filePath}`);
          return true;
        } catch (error) {
          console.error(`❌ Failed to save ${filePath}:`, error);
          return null;
        }
      });

    const results = await Promise.all(filePromises);
    const filesImported = results.filter(r => r === true).length;
    
    console.log(`✅ Import complete: ${filesImported} files imported successfully`);

    res.json({
      success: true,
      projectId: project.id,
      projectName: project.name,
      filesImported,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to import project', 
      message: error.message 
    });
  }
});

// NEW: Upload images/files for chat (screenshots, documents, etc.)
router.post('/chat-file', isAuthenticated, upload.single('file'), async (req: any, res) => {
  try {
    console.log('📁 Chat file upload endpoint hit!');
    console.log('  User:', req.authenticatedUserId);
    console.log('  File:', req.file ? req.file.originalname : 'NO FILE');
    console.log('  MimeType:', req.file?.mimetype);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.authenticatedUserId;
    const projectId = req.body.projectId; // Optional - can be null for general uploads
    
    // Create uploads directory if it doesn't exist (validated path)
    const chatDirPath = 'chat';
    const chatDirValidation = normalizePathForStorage(chatDirPath, PROJECT_ROOT);
    
    if (!chatDirValidation.safe) {
      return res.status(400).json({ error: chatDirValidation.error || 'Invalid upload directory path' });
    }
    
    const chatDirAbsolutePath = path.resolve(PROJECT_ROOT, chatDirValidation.normalized);
    await fs.mkdir(chatDirAbsolutePath, { recursive: true });
    
    // Generate unique filename with timestamp and random hash
    const fileExtension = path.extname(req.file.originalname);
    
    // SECURITY: Sanitize file extension (only allow safe characters)
    const safeExtension = fileExtension.replace(/[^a-zA-Z0-9.-]/g, '');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hash = crypto.randomBytes(8).toString('hex');
    const filename = `${timestamp}-${hash}${safeExtension}`;
    
    // SECURITY: Validate full file path before writing
    const filePathInChat = path.join(chatDirPath, filename);
    const fileValidation = normalizePathForStorage(filePathInChat, PROJECT_ROOT);
    
    if (!fileValidation.safe) {
      return res.status(400).json({ error: fileValidation.error || 'Invalid file path - security violation detected' });
    }
    
    // Save file to disk using validated absolute path
    const fileAbsolutePath = path.resolve(PROJECT_ROOT, fileValidation.normalized);
    await fs.writeFile(fileAbsolutePath, req.file.buffer);
    
    // Determine file type and create metadata
    const isImage = req.file.mimetype.startsWith('image/');
    const metadata = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: userId,
      projectId: projectId || null,
      uploadedAt: new Date().toISOString(),
      isImage,
    };
    
    // For images, we could add additional processing here (resize, thumbnails, etc.)
    let processedData = null;
    if (isImage) {
      // Basic image metadata
      processedData = {
        type: 'image',
        supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
      };
    }
    
    console.log(`✅ Chat file uploaded: ${filename} (${req.file.size} bytes)`);
    
    res.json({
      success: true,
      fileId: hash, // Use hash as file ID for retrieval
      filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      isImage,
      url: `/api/uploads/chat/${filename}`, // URL for accessing the file
      metadata,
      processedData,
    });

  } catch (error: any) {
    console.error('Chat file upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file for chat', 
      message: error.message 
    });
  }
});

// NEW: Serve uploaded chat files
router.get('/chat/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(process.cwd(), 'uploads', 'chat', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Read and serve file
    const fileBuffer = await fs.readFile(filePath);
    
    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    res.send(fileBuffer);
    
  } catch (error: any) {
    console.error('Error serving chat file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;