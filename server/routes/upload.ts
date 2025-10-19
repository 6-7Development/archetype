import express from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { storage } from "../storage";
import { requireAuth } from "../universalAuth";
import path from "path";

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload and import project from ZIP
router.post('/upload', requireAuth, upload.single('project'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.originalname.endsWith('.zip')) {
      return res.status(400).json({ error: 'Only ZIP files are supported' });
    }

    const userId = req.user!.id;
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

    // Extract and import files
    let filesImported = 0;
    const filePromises = zipEntries
      .filter(entry => !entry.isDirectory && !entry.name.includes('__MACOSX'))
      .map(async (entry) => {
        const filePath = entry.entryName;
        const fileName = path.basename(filePath);
        const folderPath = path.dirname(filePath);
        const content = entry.getData().toString('utf8');
        
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

        await storage.createFile({
          userId,
          projectId: project.id,
          filename: fileName,
          path: folderPath,
          content,
          language,
        });
        
        filesImported++;
      });

    await Promise.all(filePromises);

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
