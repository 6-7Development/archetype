import express from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import path from "path";

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

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
        
        // SECURITY: Validate path - reject absolute paths and path traversal attempts
        if (filePath.startsWith('/') || filePath.includes('..')) {
          console.warn(`❌ Rejected malicious path: ${filePath}`);
          return null;
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
        
        const fileName = path.basename(filePath);
        const folderPath = path.dirname(filePath);
        
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

export default router;
