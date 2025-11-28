import type { Express } from "express";
import { insertProjectSchema } from "@shared/schema";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import { checkUsageLimits, decrementAICredits, updateStorageUsage } from "../usage-tracking";
import multer from "multer";
import AdmZip from "adm-zip";
import path from "path";

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

export function registerProjectRoutes(app: Express) {
  // GET /api/projects - List all projects for authenticated user
  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const projects = await storage.getProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // POST /api/projects - Create new project
  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const validated = insertProjectSchema.parse(req.body);
      const project = await storage.createProject({ ...validated, userId });
      
      // Create initial project files (index.html, main.js, styles.css)
      console.log(`📁 [PROJECT] Creating initial files for project ${project.id}`);
      try {
        await storage.createInitialProjectFiles(project.id, userId);
        console.log(`✅ [PROJECT] Initial files created for project ${project.id}`);
      } catch (fileError) {
        console.error(`⚠️  [PROJECT] Failed to create initial files for project ${project.id}:`, fileError);
        // Don't fail the project creation if initial files fail, but log it
      }
      
      res.json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(400).json({ error: "Failed to create project" });
    }
  });

  // DELETE /api/projects/:id - Delete project
  app.delete("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      
      // Verify project exists and belongs to user
      const project = await storage.getProject(id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      await storage.deleteProject(id, userId);
      res.json({ success: true, message: "Project deleted successfully" });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // GET /api/projects/:projectId/files - Get project files
  app.get("/api/projects/:projectId/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      
      console.log(`📂 [FILES-API] Fetching files for user ${userId}, project ${projectId}`);
      
      let projectFiles = await storage.getProjectFiles(projectId, userId);
      
      console.log(`📂 [FILES-API] Found ${projectFiles?.length || 0} files for project ${projectId}`);
      console.log(`📂 [FILES-API] Returning:`, projectFiles?.map((f: any) => ({ id: f.id, filename: f.filename })));
      
      // Auto-create initial files if project has no files (handles existing projects)
      if (!projectFiles || projectFiles.length === 0) {
        console.log(`📝 [FILES-API] Project has no files - creating initial files automatically...`);
        try {
          projectFiles = await storage.createInitialProjectFiles(projectId, userId);
          console.log(`✅ [FILES-API] Created ${projectFiles.length} initial files for project ${projectId}`);
        } catch (createError) {
          console.warn(`⚠️  [FILES] Failed to create initial files:`, createError);
          // Continue with empty array if creation fails
          projectFiles = [];
        }
      }
      
      res.json(projectFiles || []);
    } catch (error: any) {
      console.error(`❌ [FILES] Error fetching files for project:`, error);
      console.error(`❌ [FILES] Stack:`, error.stack);
      res.status(500).json({ error: error.message || "Failed to fetch project files" });
    }
  });

  // POST /api/projects/:projectId/files - Create a single file
  app.post("/api/projects/:projectId/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const { filename, content, language } = req.body;
      
      console.log(`📝 [FILES] Creating file "${filename}" for project ${projectId}`);
      
      if (!filename) {
        return res.status(400).json({ error: "filename is required" });
      }
      
      // Verify project exists and belongs to user
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Create the file
      const file = await storage.createFile({
        projectId,
        userId,
        filename,
        content: content || '',
        language: language || 'javascript',
        path: undefined,
        folderId: undefined,
      });
      
      console.log(`✅ [FILES] Created file ${file.id} for project ${projectId}`);
      res.status(201).json(file);
    } catch (error: any) {
      console.error(`❌ [FILES] Error creating file:`, error);
      res.status(500).json({ error: error.message || "Failed to create file" });
    }
  });

  // POST /api/projects/:projectId/files/batch - Batch update project files
  app.post("/api/projects/:projectId/files/batch", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const { files } = req.body;
      
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ error: "files array is required" });
      }
      
      await storage.batchUpdateProjectFiles(projectId, userId, files);
      res.json({ success: true, filesUpdated: files.length });
    } catch (error: any) {
      console.error('Error batch updating files:', error);
      res.status(500).json({ error: error.message || "Failed to update files" });
    }
  });

  // GET /api/projects/:projectId/download - Download project as ZIP
  app.get("/api/projects/:projectId/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const files = await storage.getProjectFiles(projectId, userId);
      
      const zip = new AdmZip();
      for (const file of files) {
        const filePath = file.path ? path.join(file.path, file.filename) : file.filename;
        zip.addFile(filePath, Buffer.from(file.content, 'utf-8'));
      }
      
      const zipBuffer = zip.toBuffer();
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${project.name}.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error('Error downloading project:', error);
      res.status(500).json({ error: "Failed to download project" });
    }
  });

  // GET /api/projects/:projectId/versions - Get project versions
  app.get("/api/projects/:projectId/versions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const versions = await storage.getProjectVersions(projectId, userId);
      res.json(versions);
    } catch (error) {
      console.error('Error fetching versions:', error);
      res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  // POST /api/projects/:projectId/versions - Create project version
  app.post("/api/projects/:projectId/versions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const { label, description } = req.body;

      if (!label) {
        return res.status(400).json({ error: "Label is required" });
      }

      // Get current project files
      const projectFiles = await storage.getProjectFiles(projectId, userId);

      // Create version
      const version = await storage.createProjectVersion({
        userId,
        projectId,
        label,
        description,
      });

      // Save version files
      for (const file of projectFiles) {
        await storage.createProjectVersionFile({
          versionId: version.id,
          path: file.filename,
          content: file.content,
          language: file.language,
          checksum: null,
        });
      }

      res.json({ version, fileCount: projectFiles.length });
    } catch (error: any) {
      console.error('Error creating version:', error);
      res.status(500).json({ error: error.message || "Failed to create version" });
    }
  });

  // POST /api/projects/:projectId/versions/:versionId/restore - Restore version
  app.post("/api/projects/:projectId/versions/:versionId/restore", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId, versionId } = req.params;

      await storage.restoreProjectVersion(versionId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error restoring version:', error);
      res.status(500).json({ error: error.message || "Failed to restore version" });
    }
  });

  // Git Integration Routes
  app.get("/api/projects/:id/git", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id } = req.params;

      const repo = await storage.getGitRepository(id, userId);
      res.json({ repository: repo });
    } catch (error: any) {
      console.error("Error getting git repository:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:id/git/connect", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id } = req.params;
      const { provider, repoUrl, repoName, branch, accessToken } = req.body;

      if (!provider || !repoUrl || !repoName) {
        return res.status(400).json({ error: "Provider, repoUrl, and repoName required" });
      }

      const repository = await storage.createGitRepository({
        projectId: id,
        userId,
        provider,
        repoUrl,
        repoName,
        branch: branch || 'main',
        accessToken
      });

      res.json({ repository });
    } catch (error: any) {
      console.error("Error connecting git repository:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:id/git/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      const { status } = req.body;

      const repository = await storage.updateGitSyncStatus(id, userId, status || 'syncing');
      res.json({ repository });
    } catch (error: any) {
      console.error("Error syncing git repository:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id/git", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;

      await storage.deleteGitRepository(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error disconnecting git repository:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Template Reviews API
  app.get("/api/templates/:id/reviews", async (req, res) => {
    try {
      const { id } = req.params;
      const reviews = await storage.getTemplateReviews(id);
      res.json({ reviews });
    } catch (error: any) {
      console.error("Error getting reviews:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/templates/:templateId/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { templateId } = req.params;
      const { rating, title, comment } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1-5" });
      }

      const hasPurchased = await storage.hasUserPurchasedTemplate(userId, templateId);

      const review = await storage.createTemplateReview({
        templateId,
        userId,
        rating,
        title,
        comment,
        isVerifiedPurchase: hasPurchased ? 1 : 0
      });

      res.json({ review });
    } catch (error: any) {
      console.error("Error creating review:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/reviews/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id } = req.params;
      const { rating, title, comment } = req.body;

      const review = await storage.updateTemplateReview(id, userId, { rating, title, comment });
      res.json({ review });
    } catch (error: any) {
      console.error("Error updating review:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/reviews/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id } = req.params;

      await storage.deleteTemplateReview(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting review:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/reviews/:id/helpful", async (req, res) => {
    try {
      const { id } = req.params;
      const review = await storage.incrementReviewHelpful(id);
      res.json({ review });
    } catch (error: any) {
      console.error("Error marking helpful:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Template endpoints
  app.get("/api/templates", async (_req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      
      const template = await storage.getTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // For premium templates, ONLY return files if user owns it
      if (template.isPremium && Number(template.price) > 0) {
        if (!userId) {
          // Return metadata only for unauthenticated users
          return res.json({ ...template, files: [] });
        }
        
        const hasPurchased = await storage.hasUserPurchasedTemplate(userId, id);
        if (!hasPurchased) {
          // User is authenticated but hasn't purchased - return metadata only
          return res.json({ ...template, files: [], requiresPurchase: true });
        }
      }

      // User owns the template OR it's free - return full content
      const files = await storage.getTemplateFiles(id);
      res.json({ ...template, files });
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // Get user's purchased templates
  app.get("/api/templates/my-purchases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const purchases = await storage.getUserTemplatePurchases(userId);
      res.json(purchases);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  app.post("/api/templates/:id/instantiate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      const { name, description } = req.body;

      // Get template
      const template = await storage.getTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Check if premium template - user must own it
      if (template.isPremium && Number(template.price) > 0) {
        const hasPurchased = await storage.hasUserPurchasedTemplate(userId, id);
        if (!hasPurchased) {
          return res.status(403).json({ 
            error: "This is a premium template. Please purchase it first.",
            requiresPurchase: true,
            templatePrice: template.price
          });
        }
      }

      // Check usage limits - template instantiation counts as project creation
      const limitCheck = await checkUsageLimits(userId);
      if (!limitCheck.allowed) {
        return res.status(403).json({ 
          error: limitCheck.reason,
          usageLimitReached: true,
          requiresUpgrade: limitCheck.requiresUpgrade || false,
          requiresPayment: limitCheck.requiresPayment || false,
          trialExpired: limitCheck.trialExpired || false,
          creditsRemaining: limitCheck.creditsRemaining || 0,
          tokensUsed: limitCheck.tokensUsed || 0,
          tokenLimit: limitCheck.tokenLimit || 0,
        });
      }

      // Get template files
      const templateFiles = await storage.getTemplateFiles(id);

      // Create project from template
      const project = await storage.createProject({
        userId,
        templateId: id,
        name: name || template.name,
        description: description || template.description,
        type: template.category,
      });

      // Copy template files to project
      const projectFiles = [];
      for (const tFile of templateFiles) {
        const file = await storage.createFile({
          userId,
          projectId: project.id,
          filename: tFile.path,
          content: tFile.content,
          language: tFile.language,
        });
        projectFiles.push(file);
      }

      // Decrement AI credits for template instantiation (counts as project creation)
      await decrementAICredits(userId);

      // Update storage usage for the new files
      await updateStorageUsage(userId);

      res.json({ projectId: project.id, project, files: projectFiles });
    } catch (error: any) {
      console.error('Error instantiating template:', error);
      res.status(400).json({ error: error.message || "Failed to instantiate template" });
    }
  });

  // Live Preview endpoint - Compiles and serves project in iframe
  app.get("/api/preview/:projectId", async (req: any, res) => {
    const { projectId } = req.params;
    const startTime = Date.now();
    
    try {
      console.log(`🎬 [PREVIEW] Starting preview compilation for project ${projectId}`);
      
      // Get all project files (no userId required - allows public preview access)
      const files = await storage.getProjectFiles(projectId);
      
      console.log(`📁 [PREVIEW] Found ${files?.length || 0} files in project ${projectId}`);
      
      if (!files || files.length === 0) {
        console.warn(`⚠️  [PREVIEW] No files found in project ${projectId}`);
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head><title>No Files</title></head>
            <body style="font-family: system-ui; padding: 2rem; text-align: center; background: #f5f5f5;">
              <div style="max-width: 500px; margin: 4rem auto; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2 style="color: #666; margin-bottom: 1rem;">No Files Found</h2>
                <p style="color: #999;">This project doesn't have any files yet. Create some files in the AI Build tab to see a preview.</p>
              </div>
            </body>
          </html>
        `);
      }
      
      console.log(`📄 [PREVIEW] Files in project:`, files.map(f => ({ 
        filename: f.filename, 
        path: f.path,
        language: f.language,
        size: f.content?.length || 0 
      })));

      // Build file system map for esbuild
      const fileSystem: Record<string, string> = {};
      let entryPoint = 'index.tsx'; // Default entry
      
      for (const file of files) {
        const filePath = file.path ? `${file.path}/${file.filename}` : file.filename;
        fileSystem[filePath] = file.content;
        
        // Detect entry point (index.tsx, index.jsx, index.ts, index.js, or App.tsx)
        if (
          file.filename === 'index.tsx' ||
          file.filename === 'index.jsx' ||
          file.filename === 'index.ts' ||
          file.filename === 'index.js' ||
          file.filename === 'App.tsx' ||
          file.filename === 'main.tsx' ||
          file.filename === 'main.jsx'
        ) {
          entryPoint = filePath;
          console.log(`🎯 [PREVIEW] Detected entry point: ${entryPoint}`);
        }
      }

      // Check if entry point exists
      if (!fileSystem[entryPoint]) {
        console.warn(`⚠️  [PREVIEW] Default entry point '${entryPoint}' not found, searching for alternatives...`);
        
        // Fallback: find first .tsx, .jsx, .ts, or .js file
        const firstCodeFile = files.find(f => 
          f.filename.endsWith('.tsx') || 
          f.filename.endsWith('.jsx') || 
          f.filename.endsWith('.ts') || 
          f.filename.endsWith('.js')
        );
        
        if (firstCodeFile) {
          entryPoint = firstCodeFile.path 
            ? `${firstCodeFile.path}/${firstCodeFile.filename}` 
            : firstCodeFile.filename;
          console.log(`🎯 [PREVIEW] Using fallback entry point: ${entryPoint}`);
        } else {
          console.warn(`⚠️  [PREVIEW] No code files found, checking for HTML...`);
          
          // No code files - serve HTML only
          const htmlFile = files.find(f => 
            f.language === 'html' || f.filename.endsWith('.html')
          );
          
          if (htmlFile) {
            console.log(`📄 [PREVIEW] Serving static HTML file: ${htmlFile.filename}`);
            return res.send(htmlFile.content);
          }
          
          console.error(`❌ [PREVIEW] No entry point found in project ${projectId}`);
          return res.status(400).send(`
            <!DOCTYPE html>
            <html>
              <head><title>No Entry Point</title></head>
              <body style="font-family: system-ui; padding: 2rem; text-align: center; background: #f5f5f5;">
                <div style="max-width: 500px; margin: 4rem auto; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <h2 style="color: #666; margin-bottom: 1rem;">No Entry Point Found</h2>
                  <p style="color: #999; margin-bottom: 1rem;">Create one of these files to see a preview:</p>
                  <ul style="color: #999; text-align: left; list-style-position: inside;">
                    <li>index.tsx or index.jsx (React)</li>
                    <li>App.tsx (React component)</li>
                    <li>index.html (Static HTML)</li>
                  </ul>
                </div>
              </body>
            </html>
          `);
        }
      } else {
        console.log(`✅ [PREVIEW] Using entry point: ${entryPoint}`);
      }

      // Use esbuild to bundle in-memory
      console.log(`🔧 [PREVIEW] Starting esbuild compilation for entry point: ${entryPoint}`);
      console.log(`📦 [PREVIEW] File system contains ${Object.keys(fileSystem).length} files`);
      
      const build = await import('esbuild');
      
      const result = await build.build({
        stdin: {
          contents: fileSystem[entryPoint],
          resolveDir: '.',
          sourcefile: entryPoint,
          loader: entryPoint.endsWith('.tsx') || entryPoint.endsWith('.jsx') ? 'tsx' : 'ts',
        },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        target: ['es2020'],
        jsx: 'automatic',
        jsxDev: false,
        jsxImportSource: 'https://esm.sh/react@18.2.0',
        plugins: [
          {
            name: 'virtual-fs',
            setup(build) {
              // Resolve imports from our virtual file system
              build.onResolve({ filter: /.*/ }, (args) => {
                if (args.path.startsWith('.') || args.path.startsWith('/')) {
                  // Relative import
                  let resolvedPath = args.path;
                  
                  // Handle extensions
                  const extensions = ['.tsx', '.ts', '.jsx', '.js', ''];
                  for (const ext of extensions) {
                    const testPath = resolvedPath + ext;
                    if (fileSystem[testPath]) {
                      return { path: testPath, namespace: 'virtual-fs' };
                    }
                  }
                  
                  // Try with /index
                  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
                    const testPath = `${resolvedPath}/index${ext}`;
                    if (fileSystem[testPath]) {
                      return { path: testPath, namespace: 'virtual-fs' };
                    }
                  }
                }
                
                // External package - rewrite to use esm.sh CDN
                if (args.path === 'react') {
                  return { path: 'https://esm.sh/react@18.2.0', external: true };
                }
                if (args.path === 'react-dom' || args.path === 'react-dom/client') {
                  return { path: 'https://esm.sh/react-dom@18.2.0', external: true };
                }
                
                // Other packages - use esm.sh
                return { path: `https://esm.sh/${args.path}`, external: true };
              });
              
              build.onLoad({ filter: /.*/, namespace: 'virtual-fs' }, (args) => {
                const contents = fileSystem[args.path];
                if (!contents) {
                  return { errors: [{ text: `File not found: ${args.path}` }] };
                }
                
                const loader = args.path.endsWith('.tsx') || args.path.endsWith('.jsx') 
                  ? 'tsx' 
                  : args.path.endsWith('.ts') 
                  ? 'ts' 
                  : args.path.endsWith('.css')
                  ? 'css'
                  : 'js';
                
                return { contents, loader };
              });
            },
          },
        ],
      });

      if (result.errors.length > 0) {
        console.error(`❌ [PREVIEW] Build errors for project ${projectId}:`, result.errors);
        return res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Build Error</title></head>
            <body style="font-family: monospace; padding: 2rem; background: #1e1e1e; color: #ff6b6b;">
              <h2>Build Error</h2>
              <pre>${result.errors.map(e => e.text).join('\n')}</pre>
              <p style="color: #999; margin-top: 2rem; font-size: 14px;">Check the server logs for more details</p>
            </body>
          </html>
        `);
      }

      // Get the bundled JavaScript
      if (!result.outputFiles || result.outputFiles.length === 0) {
        console.error(`❌ [PREVIEW] No output files generated for project ${projectId}`);
        return res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Build Error</title></head>
            <body style="font-family: monospace; padding: 2rem; background: #1e1e1e; color: #ff6b6b;">
              <h2>Build Error</h2>
              <pre>No output files generated by esbuild</pre>
            </body>
          </html>
        `);
      }
      
      const bundled = result.outputFiles[0].text;
      const buildTime = Date.now() - startTime;
      console.log(`✅ [PREVIEW] Build successful! Generated ${bundled.length} bytes of JavaScript in ${buildTime}ms`);

      // Detect if code uses React or modules (they handle their own DOM ready)
      const usesReact = bundled.includes('React.createElement') || 
                        bundled.includes('createRoot') || 
                        bundled.includes('ReactDOM') ||
                        bundled.includes('jsx-runtime');
      
      // Add defensive guard checks to prevent null element errors
      // Instead of wrapping EVERYTHING, inject guard checks into the code
      const wrappedCode = usesReact 
        ? bundled // React apps handle their own mounting - don't wrap
        : `
          // Defensive wrapper for vanilla JS - only runs when DOM is ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
              ${bundled}
            });
          } else {
            ${bundled}
          }
        `;

      // Create HTML with bundled code
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="app"></div>
  <script type="module">
    ${wrappedCode}
  </script>
  <script>
    window.addEventListener('error', (e) => {
      console.error('Preview runtime error:', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Preview unhandled rejection:', e.reason);
    });
  </script>
</body>
</html>
      `;

      const totalTime = Date.now() - startTime;
      console.log(`🚀 [PREVIEW] Sending preview HTML for project ${projectId} (${html.length} bytes, total time: ${totalTime}ms)`);
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Preview-Build-Time', `${totalTime}ms`);
      res.send(html);
    } catch (error: any) {
      console.error(`❌ [PREVIEW] Compilation error for project ${projectId}:`, error);
      console.error(`❌ [PREVIEW] Error stack:`, error.stack);
      
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Compilation Error</title></head>
          <body style="font-family: monospace; padding: 2rem; background: #1e1e1e; color: #ff6b6b;">
            <h2>Compilation Error</h2>
            <pre>${error.message}</pre>
            <details style="margin-top: 1rem; color: #999;">
              <summary>Stack Trace</summary>
              <pre style="margin-top: 0.5rem; font-size: 12px;">${error.stack}</pre>
            </details>
            <p style="color: #999; margin-top: 2rem; font-size: 14px;">Check the server logs for more details</p>
          </body>
        </html>
      `);
    }
  });

  // POST /api/projects/:id/activate - Set as active project
  app.post("/api/projects/:id/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;

      // Verify project exists and belongs to user
      const project = await storage.getProject(id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Import project sessions table
      const { db } = await import("../db");
      const { projectSessions } = await import("@shared/schema");

      // Upsert project session (set as active)
      await db
        .insert(projectSessions)
        .values({ userId, activeProjectId: id, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: projectSessions.userId,
          set: { activeProjectId: id, updatedAt: new Date() },
        });

      res.json({ success: true, activeProjectId: id });
    } catch (error: any) {
      console.error('Error activating project:', error);
      res.status(500).json({ error: error.message || "Failed to activate project" });
    }
  });

  // GET /api/projects/active-session - Get user's active project session
  app.get("/api/projects/active-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;

      // Import project sessions table
      const { db } = await import("../db");
      const { projectSessions, projects } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Get user's active project session
      const [session] = await db
        .select()
        .from(projectSessions)
        .where(eq(projectSessions.userId, userId))
        .limit(1);

      if (!session || !session.activeProjectId) {
        return res.json({ activeProjectId: null, project: null });
      }

      // Get the project details
      const project = await storage.getProject(session.activeProjectId, userId);

      res.json({ 
        activeProjectId: session.activeProjectId, 
        project: project || null 
      });
    } catch (error: any) {
      console.error('Error getting active project session:', error);
      res.status(500).json({ error: error.message || "Failed to get active project session" });
    }
  });
}
