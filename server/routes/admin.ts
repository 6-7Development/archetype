import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../universalAuth";
import { getGitHubService } from "../githubService";
import { promises as fs } from 'fs';
import * as path from 'path';

// Owner middleware - checks if user is platform owner
function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user as any;
  if (!user.isOwner) {
    return res.status(403).json({ 
      error: 'Forbidden - Owner access required',
      message: 'Only the platform owner can perform this action'
    });
  }

  next();
}

// Require admin middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req.user as any)?.id;
  
  // Simple admin check
  const ADMIN_USERS = ['admin', 'demo-user'];
  
  if (!userId || !ADMIN_USERS.includes(userId)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
}

// Helper function to recursively read directory files
async function readDirRecursive(rootDir: string, currentDir: string, excludePatterns: string[]): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    // Skip excluded patterns
    if (excludePatterns.some(pattern => relativePath.startsWith(pattern) || entry.name === pattern)) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await readDirRecursive(rootDir, fullPath, excludePatterns);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

export function registerAdminRoutes(app: Express) {
  // Maintenance Mode API
  app.get('/api/maintenance-mode/status', async (_req, res) => {
    try {
      const mode = await storage.getMaintenanceMode();
      res.json({
        enabled: mode.enabled,
        reason: mode.reason,
        enabledAt: mode.enabledAt,
        enabledBy: mode.enabledBy,
      });
    } catch (error: any) {
      console.error('Failed to get maintenance mode status:', error);
      res.status(500).json({ error: 'Failed to get maintenance mode status' });
    }
  });

  app.post('/api/maintenance-mode/enable', isAuthenticated, requireOwner, async (req, res) => {
    try {
      const { reason } = req.body;
      const user = req.user as any;
      
      const mode = await storage.enableMaintenanceMode(user.id, reason);
      
      console.log(`[MAINTENANCE-MODE] ✅ Enabled by ${user.email} (Owner)`);
      console.log(`[MAINTENANCE-MODE] Reason: ${reason || 'Platform maintenance in progress'}`);
      
      res.json({
        success: true,
        enabled: mode.enabled,
        reason: mode.reason,
        enabledAt: mode.enabledAt,
        message: 'Maintenance mode enabled. Platform modifications now commit to GitHub.',
      });
    } catch (error: any) {
      console.error('Failed to enable maintenance mode:', error);
      res.status(500).json({ error: 'Failed to enable maintenance mode' });
    }
  });

  app.post('/api/maintenance-mode/disable', isAuthenticated, requireOwner, async (req, res) => {
    try {
      const user = req.user as any;
      const mode = await storage.disableMaintenanceMode();
      
      console.log(`[MAINTENANCE-MODE] ✅ Disabled by ${user.email} (Owner)`);
      
      res.json({
        success: true,
        enabled: mode.enabled,
        message: 'Maintenance mode disabled. Platform modifications blocked in production.',
      });
    } catch (error: any) {
      console.error('Failed to disable maintenance mode:', error);
      res.status(500).json({ error: 'Failed to disable maintenance mode' });
    }
  });

  // MASTER ADMIN SETUP - Promote your account to admin
  app.post("/api/admin/promote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { adminSecret } = req.body;
      
      // SECURITY: Require admin secret from environment variable
      const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
      
      if (!ADMIN_SECRET_KEY) {
        return res.status(500).json({ 
          error: "Server misconfigured. ADMIN_SECRET_KEY environment variable not set.",
          hint: "Admin must set ADMIN_SECRET_KEY in Secrets before anyone can promote to admin"
        });
      }
      
      if (!adminSecret || adminSecret !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ 
          error: "Forbidden. Invalid admin secret key."
        });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if already admin
      if (user.role === "admin") {
        return res.json({
          success: true,
          message: "You are already an admin",
          user
        });
      }

      // Promote to admin
      await storage.updateUserRole(userId, "admin");
      const updatedUser = await storage.getUser(userId);

      console.log(`✅ User ${user.email} promoted to admin`);

      res.json({
        success: true,
        message: "Successfully promoted to admin",
        user: updatedUser
      });
    } catch (error: any) {
      console.error('Error promoting to admin:', error);
      res.status(500).json({ error: error.message || "Failed to promote to admin" });
    }
  });

  // GET /api/admin/dashboard - Admin dashboard data
  app.get("/api/admin/dashboard", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || 'demo-user';
      
      // Get all usage logs for analysis
      const logs = await storage.getRecentUsageLogs(1000);
      
      // Calculate total costs
      const totalCosts = logs.reduce((sum: number, log: any) => sum + (Number(log.cost) || 0), 0);
      
      // Get unique active users
      const activeUsers = new Set(logs.map((log: any) => log.userId)).size;
      
      // Calculate total AI requests
      const aiRequests = logs.filter((log: any) => log.type === 'ai_generation').length;
      
      // Calculate revenue from subscriptions
      const revenue = activeUsers * 20;
      
      res.json({
        totalCosts,
        activeUsers,
        aiRequests,
        revenue,
        logs: logs.slice(0, 100),
      });
    } catch (error: any) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ error: error.message || 'Failed to get admin data' });
    }
  });

  // POST /api/leads - Capture email leads from landing page
  app.post("/api/leads", async (req: Request, res: Response) => {
    try {
      const { email, source, metadata } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: "Valid email required" });
      }

      // Check if email already exists
      const existingLead = await storage.getLeadByEmail(email);
      if (existingLead) {
        return res.status(200).json({ 
          message: "Email already registered",
          lead: existingLead 
        });
      }

      const lead = await storage.createLead({
        email,
        source: source || "landing_page",
        metadata: metadata || {},
        status: "new",
      });

      console.log(`✅ New lead captured: ${email} from ${source}`);

      res.status(201).json({ 
        message: "Successfully registered",
        lead 
      });
    } catch (error: any) {
      console.error('Lead capture error:', error);
      res.status(500).json({ message: error.message || 'Failed to save lead' });
    }
  });

  // Support ticket routes - Admin
  app.get("/api/admin/support/tickets", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const tickets = await storage.getAllSupportTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error('Error fetching all tickets:', error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.put("/api/admin/support/tickets/:id/status", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "Status is required" });
      }

      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const resolvedAt = status === 'resolved' ? new Date() : null;
      const ticket = await storage.updateSupportTicketStatus(id, status, resolvedAt);
      res.json(ticket);
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
      res.status(500).json({ error: error.message || "Failed to update ticket status" });
    }
  });

  app.put("/api/admin/support/tickets/:id/assign", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      if (assignedTo !== null && typeof assignedTo !== 'string') {
        return res.status(400).json({ error: "assignedTo must be a string or null" });
      }

      const ticket = await storage.assignSupportTicket(id, assignedTo);
      res.json(ticket);
    } catch (error: any) {
      console.error('Error assigning ticket:', error);
      res.status(500).json({ error: error.message || "Failed to assign ticket" });
    }
  });

  // Satisfaction survey admin route
  app.get('/api/admin/satisfaction-stats', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const stats = await storage.getSatisfactionStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error getting satisfaction stats:', error);
      res.status(500).json({ error: error.message || 'Failed to get stats' });
    }
  });

  // Force deploy to production - commits and force pushes all workspace changes
  app.post('/api/admin/force-deploy', isAuthenticated, requireOwner, async (req, res) => {
    try {
      const user = req.user as any;
      const { message } = req.body;

      console.log(`[FORCE-DEPLOY] 🚀 Starting force deploy by ${user.email} (Owner)`);
      
      // Get GitHub service
      const github = getGitHubService();
      
      // Project root directory
      const PROJECT_ROOT = path.resolve(process.cwd());
      
      // Files/directories to exclude
      const EXCLUDE_PATTERNS = [
        'node_modules',
        '.git',
        '.replit',
        'dist',
        'build',
        '.vscode',
        '.env',
        '.env.local',
        'tmp',
        'logs',
        'attached_assets',
        'db.sqlite',
        'package-lock.json',
      ];

      console.log('[FORCE-DEPLOY] 📂 Reading workspace files...');
      const allFiles = await readDirRecursive(PROJECT_ROOT, PROJECT_ROOT, EXCLUDE_PATTERNS);
      console.log(`[FORCE-DEPLOY] Found ${allFiles.length} files to deploy`);

      // Read file contents
      const fileChanges = await Promise.all(
        allFiles.map(async (filePath) => {
          const fullPath = path.join(PROJECT_ROOT, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          return {
            path: filePath,
            content,
            operation: 'modify' as const,
          };
        })
      );

      console.log(`[FORCE-DEPLOY] 📦 Committing ${fileChanges.length} files to GitHub...`);
      
      // Commit all files
      const commitMessage = message || 'Force deploy from Archetype platform';
      const result = await github.commitFiles(fileChanges, commitMessage);

      console.log(`[FORCE-DEPLOY] ✅ Successfully deployed!`);
      console.log(`[FORCE-DEPLOY] Commit: ${result.commitHash}`);
      console.log(`[FORCE-DEPLOY] URL: ${result.commitUrl}`);
      console.log(`[FORCE-DEPLOY] 🔄 Railway will auto-deploy within 2-3 minutes`);

      res.json({
        success: true,
        commitHash: result.commitHash,
        commitUrl: result.commitUrl,
        filesDeployed: fileChanges.length,
        message: 'Force deploy successful. Railway will auto-deploy within 2-3 minutes.',
      });
    } catch (error: any) {
      console.error('[FORCE-DEPLOY] ❌ Deploy failed:', error);
      res.status(500).json({ 
        error: 'Force deploy failed', 
        details: error.message 
      });
    }
  });
}
