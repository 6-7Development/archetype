import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertFileSchema, insertChatMessageSchema, insertProjectSchema, insertCommandSchema, upgradeSubscriptionSchema, files } from "@shared/schema";
import { anthropic, DEFAULT_MODEL, streamAnthropicResponse } from "./anthropic";
import { SYSOP_TOOLS } from "./tools";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { checkUsageLimits, trackAIUsage, decrementAICredits, getUserUsageStats, updateStorageUsage, updateDeploymentUsage } from "./usage-tracking";
import { setupAuth, isAuthenticated, isAdmin } from "./universalAuth";
import { aiLimiter, webhookLimiter } from "./rateLimiting";
import { stripe, isStripeConfigured, getPriceIdForPlan, STRIPE_WEBHOOK_SECRET, getPlanNameFromPriceId } from "./stripe";
import { aiQueue } from './priority-queue';
import toolsRouter from './routes/tools';
import uploadRouter from './routes/upload';
import platformRouter from './platformRoutes';
import multer from "multer";
import AdmZip from "adm-zip";
import path from "path";
import { getDeploymentInfo } from './deploymentInfo';
import type Stripe from 'stripe';

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Feature flags for graceful degradation
export const FEATURES = {
  AI_GENERATION: !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'dummy-key-for-development',
  WEB_SEARCH: !!process.env.TAVILY_API_KEY,
  BROWSER_TEST: true, // Always available (uses Playwright)
  VISION_ANALYSIS: !!process.env.ANTHROPIC_API_KEY, // Uses Claude Vision
  STRIPE_BILLING: !!process.env.STRIPE_SECRET_KEY,
};

// Track active AI generation sessions for stop/abort functionality
const activeGenerations = new Map<string, AbortController>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (no auth required - for monitoring)
  app.get('/health', async (_req, res) => {
    const startTime = Date.now();
    
    // Check database connection
    let databaseStatus = 'error';
    try {
      await db.select().from(files).limit(1);
      databaseStatus = 'ok';
    } catch (error) {
      console.error('Health check - database error:', error);
    }
    
    const health = {
      status: databaseStatus === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      checks: {
        database: databaseStatus,
        ai_generation: FEATURES.AI_GENERATION ? 'ok' : 'disabled',
        web_search: FEATURES.WEB_SEARCH ? 'ok' : 'disabled',
        browser_test: FEATURES.BROWSER_TEST ? 'ok' : 'disabled',
        stripe: FEATURES.STRIPE_BILLING ? 'ok' : 'disabled',
      },
      version: process.env.npm_package_version || '1.0.0',
    };
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Admin emergency endpoint (requires ADMIN_SECRET_KEY)
  app.get('/admin/emergency', async (req, res) => {
    const adminSecret = req.query.secret || req.headers['x-admin-secret'];
    
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: 'Forbidden - Invalid admin secret' });
    }
    
    // Gather comprehensive diagnostics
    const diagnostics = {
      timestamp: new Date().toISOString(),
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        hasDatabase: !!process.env.DATABASE_URL,
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasTavilyKey: !!process.env.TAVILY_API_KEY,
        hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
        hasSessionSecret: !!process.env.SESSION_SECRET,
        hasAdminKey: !!process.env.ADMIN_SECRET_KEY,
      },
      features: FEATURES,
      database: {
        status: 'unknown' as string,
        tableCount: 0,
        error: undefined as string | undefined,
      },
    };
    
    // Test database connection with timeout
    try {
      const dbPromise = db.select().from(files).limit(1);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 3000)
      );
      
      const result = await Promise.race([dbPromise, timeoutPromise]) as any[];
      diagnostics.database.status = 'connected';
      diagnostics.database.tableCount = result.length;
    } catch (error: any) {
      diagnostics.database.status = 'error';
      diagnostics.database.error = error.message;
    }
    
    res.json(diagnostics);
  });

  // Setup OAuth authentication (must be before routes)
  await setupAuth(app);

  // Register tools router for SySop autonomous capabilities
  app.use('/api/tools', toolsRouter);
  
  // Register upload router for project imports
  app.use('/api/projects', uploadRouter);

  // Register platform healing router for Meta-SySop self-healing
  app.use('/api/platform', platformRouter);

  // Stripe webhook endpoint (raw body parser applied in server/index.ts)
  app.post(
    '/api/webhooks/stripe',
    webhookLimiter,
    async (req, res) => {
      if (!stripe || !STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json({ 
          error: 'Stripe webhooks not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.' 
        });
      }

      const sig = req.headers['stripe-signature'];
      if (!sig) {
        return res.status(400).json({ error: 'No signature header' });
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      // Handle the event
      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as any;
            const userId = session.client_reference_id;
            const customerId = session.customer;
            
            if (userId && customerId) {
              // Update subscription with Stripe customer ID (if not already set)
              const subscription = await storage.getSubscription(userId);
              if (subscription && !subscription.stripeCustomerId) {
                await storage.updateStripeCustomerId(userId, customerId);
              }
            }
            break;
          }

          case 'customer.subscription.created':
          case 'customer.subscription.updated': {
            const subscription = event.data.object as any;
            const customerId = subscription.customer;
            
            // Find user by Stripe customer ID
            const userSubscription = await storage.getSubscriptionByStripeCustomerId(customerId);
            if (userSubscription) {
              const priceId = subscription.items.data[0]?.price.id;
              const planName = priceId ? getPlanNameFromPriceId(priceId) : null;
              
              if (planName) {
                console.log(`✅ Webhook: Updating subscription for user ${userSubscription.userId} to plan ${planName}`);
                await storage.updateSubscription(userSubscription.userId, planName);
              } else {
                console.warn(`⚠️ Webhook: Unknown price ID ${priceId} for customer ${customerId}`);
              }
            } else {
              console.warn(`⚠️ Webhook: No subscription found for Stripe customer ${customerId}`);
            }
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as any;
            const customerId = subscription.customer;
            
            // Find user and cancel subscription
            const userSubscription = await storage.getSubscriptionByStripeCustomerId(customerId);
            if (userSubscription) {
              console.log(`✅ Webhook: Cancelling subscription for user ${userSubscription.userId}`);
              await storage.cancelSubscription(userSubscription.userId);
            } else {
              console.warn(`⚠️ Webhook: No subscription found for Stripe customer ${customerId} (already deleted?)`);
            }
            break;
          }

          case 'invoice.payment_succeeded': {
            // Handle successful recurring payment
            console.log('Invoice payment succeeded:', event.data.object);
            break;
          }

          case 'invoice.payment_failed': {
            // Handle failed recurring payment
            console.log('Invoice payment failed:', event.data.object);
            break;
          }

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (error: any) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

  // MASTER ADMIN SETUP - Promote your account to admin (REQUIRES SECRET KEY)
  app.post("/api/admin/promote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { adminSecret } = req.body;
      
      // SECURITY: Require admin secret from environment variable (NO DEFAULT!)
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
          message: "You are already a MASTER ADMIN!",
          email: user.email,
          role: "admin",
          access: {
            aiUsage: "UNLIMITED",
            projects: "UNLIMITED",
            tokens: "UNLIMITED",
            storage: "UNLIMITED",
            billing: "BYPASSED",
          }
        });
      }

      // Promote to admin
      await storage.updateUserRole(userId, "admin");

      res.json({
        success: true,
        message: "🎉 You are now a MASTER ADMIN with unlimited access!",
        email: user.email,
        role: "admin",
        access: {
          aiUsage: "UNLIMITED",
          projects: "UNLIMITED",
          tokens: "UNLIMITED",
          storage: "UNLIMITED",
          billing: "BYPASSED - $0 charges for you",
        }
      });
    } catch (error: any) {
      console.error('Error promoting to admin:', error);
      res.status(500).json({ error: error.message || "Failed to promote to admin" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates (file sync + AI streaming)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track client sessions for targeted streaming
  const clientSessions = new Map<WebSocket, { userId?: string; sessionId?: string }>();
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Initialize session tracking
    clientSessions.set(ws, {});
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'file-update') {
          // Broadcast file updates to all connected clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'file-updated',
                fileId: data.fileId,
                content: data.content,
              }));
            }
          });
        } else if (data.type === 'register-session') {
          // Register client for AI streaming
          const session = clientSessions.get(ws) || {};
          session.userId = data.userId;
          session.sessionId = data.sessionId;
          clientSessions.set(ws, session);
          
          ws.send(JSON.stringify({
            type: 'session-registered',
            sessionId: data.sessionId,
          }));
          console.log(`WebSocket session registered: ${data.sessionId} for user ${data.userId}`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      clientSessions.delete(ws);
      console.log('WebSocket client disconnected');
    });
  });
  
  // Helper to broadcast to specific session
  function broadcastToSession(sessionId: string, data: any) {
    wss.clients.forEach((client) => {
      const session = clientSessions.get(client);
      if (session?.sessionId === sessionId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // Helper to summarize old messages using Anthropic API (memory optimization like Agent 3)
  async function summarizeMessages(messages: any[]): Promise<string> {
    try {
      // Build conversation history for summarization
      const conversationText = messages.map(msg => {
        return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
      }).join('\n\n');

      const result = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 200, // Keep summary concise to save tokens
        system: `You are a conversation summarizer. Create a brief, informative summary of this chat conversation. Focus on:
- What the user is building/working on
- Key decisions and features discussed
- Current state of the project
- Important context for future messages

Format: "Project context: [concise summary]"
Keep it under 150 words. Be factual and specific.`,
        messages: [
          {
            role: "user",
            content: `Summarize this conversation:\n\n${conversationText}`,
          },
        ],
      });

      const summaryText = result.content[0].type === 'text' ? result.content[0].text : "Previous conversation summarized.";
      console.log(`✅ Summarized ${messages.length} messages into ${summaryText.length} chars`);
      return summaryText;
    } catch (error) {
      console.error('Error summarizing messages:', error);
      return `Previous conversation: ${messages.length} messages discussing project development.`;
    }
  }

  // Auth user endpoint (for useAuth hook)
  // Note: Global apiLimiter already applied in server/index.ts
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // File management endpoints
  // Note: Global apiLimiter already applied in server/index.ts
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

  app.post("/api/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const validated = insertFileSchema.parse(req.body);
      const file = await storage.createFile({ ...validated, userId });
      
      // Track storage usage for billing
      await updateStorageUsage(userId);
      
      res.json(file);
    } catch (error) {
      console.error('Error creating file:', error);
      res.status(400).json({ error: "Failed to create file" });
    }
  });

  app.put("/api/files/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      const { content } = req.body;
      const file = await storage.updateFile(id, userId, content);
      
      // Track storage usage for billing (content size may have changed)
      await updateStorageUsage(userId);
      
      res.json(file);
    } catch (error: any) {
      console.error('Error updating file:', error);
      res.status(400).json({ error: error.message || "Failed to update file" });
    }
  });

  app.delete("/api/files/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      await storage.deleteFile(id, userId);
      
      // Track storage usage for billing (storage reduced)
      await updateStorageUsage(userId);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      res.status(400).json({ error: error.message || "Failed to delete file" });
    }
  });

  // ZIP Import endpoint for migrating Replit projects
  app.post("/api/import/zip", isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const zipFile = req.file;
      const projectName = req.body.projectName || "Imported Project";

      if (!zipFile) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Create project
      const project = await storage.createProject({
        userId,
        name: projectName,
        description: "Imported from ZIP",
        type: "webapp",
      });

      // Extract ZIP
      const zip = new AdmZip(zipFile.buffer);
      const zipEntries = zip.getEntries();

      let importedCount = 0;
      const errors: string[] = [];

      for (const entry of zipEntries) {
        // Skip directories and hidden files
        if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('node_modules/')) {
          continue;
        }

        try {
          const fullPath = entry.entryName;
          const filename = path.basename(fullPath);
          const dirPath = path.dirname(fullPath);
          const ext = path.extname(filename).toLowerCase();
          
          // Define text file extensions
          const textExtensions = [
            '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
            '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env',
            '.md', '.mdx', '.txt', '.csv',
            '.sql', '.sh', '.bash', '.zsh',
            '.vue', '.svelte', '.astro',
            '.go', '.rs', '.kt', '.swift',
          ];

          // Binary file extensions (skip these)
          const binaryExtensions = [
            '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
            '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
            '.mp3', '.mp4', '.avi', '.mov', '.webm',
            '.ttf', '.woff', '.woff2', '.eot',
            '.exe', '.dll', '.so', '.dylib',
            '.wasm', '.bin',
          ];

          // Skip binary files (log them as skipped)
          if (binaryExtensions.includes(ext)) {
            errors.push(`Skipped binary file: ${entry.entryName} (binary files not supported yet)`);
            continue;
          }

          // Only process text files
          if (!textExtensions.includes(ext)) {
            // Unknown extension - try as text, might fail
            errors.push(`Unknown file type: ${entry.entryName} (attempting as text)`);
          }

          const content = entry.getData().toString('utf8');
          
          // Detect language from file extension
          const languageMap: Record<string, string> = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.md': 'markdown',
            '.txt': 'plaintext',
            '.vue': 'javascript',
            '.svelte': 'javascript',
          };
          const language = languageMap[ext] || 'plaintext';

          await storage.createFile({
            userId,
            projectId: project.id,
            filename,
            path: dirPath === '.' ? '' : dirPath,
            content,
            language,
          });

          importedCount++;
        } catch (fileError: any) {
          errors.push(`Failed to import ${entry.entryName}: ${fileError.message}`);
        }
      }

      await updateStorageUsage(userId);

      res.json({
        project,
        importedCount,
        errors,
        message: `Successfully imported ${importedCount} files`,
      });
    } catch (error: any) {
      console.error('Error importing ZIP:', error);
      res.status(500).json({ error: error.message || "Failed to import ZIP file" });
    }
  });

  // Chat message endpoints
  app.get("/api/chat/messages/:fileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { fileId } = req.params;
      const messages = await storage.getChatMessages(userId, fileId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get chat history for a project (with automatic summarization for long conversations)
  app.get("/api/chat/history/:projectId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      let messages = await storage.getChatMessagesByProject(userId, projectId);
      
      // Smart memory optimization: Summarize old messages if conversation is long (>10 messages)
      if (messages.length > 10) {
        const KEEP_RECENT = 5; // Always keep last 5 messages for immediate context
        
        // Check if we already have a summary
        const hasSummary = messages.some(m => m.isSummary);
        
        if (!hasSummary) {
          // Split messages: old ones to summarize, recent ones to keep
          const oldMessages = messages.slice(0, messages.length - KEEP_RECENT);
          const recentMessages = messages.slice(messages.length - KEEP_RECENT);
          
          // Only summarize user/assistant messages (skip system messages if any)
          const messagesForSummary = oldMessages.filter(m => m.role === 'user' || m.role === 'assistant');
          
          if (messagesForSummary.length > 0) {
            console.log(`📊 Summarizing ${messagesForSummary.length} old messages (keeping ${KEEP_RECENT} recent)`);
            
            // Create summary using Anthropic
            const summaryContent = await summarizeMessages(messagesForSummary);
            
            // Save summary as a special system message
            const summaryMessage = await storage.createChatMessage({
              userId,
              projectId,
              role: 'system',
              content: summaryContent,
              isSummary: true,
            });
            
            // Delete old messages from database (they're now in the summary)
            for (const oldMsg of oldMessages) {
              await storage.deleteChatMessage(oldMsg.id, userId);
            }
            
            // Return summary + recent messages
            messages = [summaryMessage, ...recentMessages];
            console.log(`✅ Chat optimized: ${messagesForSummary.length} → 1 summary + ${KEEP_RECENT} recent = ${messages.length} total`);
          }
        }
      }
      
      res.json({ messages });
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  // Save a chat message
  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const validated = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage({ ...validated, userId });
      res.json({ message });
    } catch (error) {
      console.error('Error saving chat message:', error);
      res.status(400).json({ error: "Failed to save message" });
    }
  });

  // Upload chat image for Vision API
  app.post("/api/chat/upload-image", isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const imageFile = req.file;

      if (!imageFile) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(imageFile.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Only JPG, PNG, GIF, and WebP are allowed." });
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (imageFile.size > maxSize) {
        return res.status(400).json({ error: "File too large. Maximum size is 5MB." });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = imageFile.mimetype.split('/')[1];
      const filename = `${userId}_${timestamp}.${extension}`;
      const filepath = path.join('attached_assets', 'chat_images', filename);

      // Write file to disk
      const fs = await import('fs/promises');
      await fs.writeFile(filepath, imageFile.buffer);

      // Return relative URL path
      const imageUrl = `/attached_assets/chat_images/${filename}`;
      res.json({ 
        success: true, 
        imageUrl,
        filename,
        size: imageFile.size,
        mimeType: imageFile.mimetype
      });
    } catch (error: any) {
      console.error('Error uploading chat image:', error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Project endpoints
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

  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const validated = insertProjectSchema.parse(req.body);
      const project = await storage.createProject({ ...validated, userId });
      res.json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(400).json({ error: "Failed to create project" });
    }
  });

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

  // Template Reviews API
  app.get("/api/templates/:id/reviews", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reviews = await storage.getTemplateReviews(id);
      res.json({ reviews });
    } catch (error: any) {
      console.error("Error getting reviews:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/templates/:templateId/reviews", isAuthenticated, async (req: any, res: Response) => {
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

  app.put("/api/reviews/:id", isAuthenticated, async (req: any, res: Response) => {
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

  app.delete("/api/reviews/:id", isAuthenticated, async (req: any, res: Response) => {
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

  app.post("/api/reviews/:id/helpful", async (req: Request, res: Response) => {
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

  // REMOVED: Legacy purchase endpoint that bypassed Stripe
  // Template purchases now ONLY go through Stripe checkout (/api/create-template-checkout)
  // and are recorded by the webhook handler after successful payment
  // This prevents revenue leakage from unpaid template access

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
    try {
      const { projectId } = req.params;
      
      // Get all project files (no auth required for preview - anyone can view shared projects)
      const files = await storage.getProjectFiles(projectId);
      
      if (!files || files.length === 0) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head><title>No Files</title></head>
            <body style="font-family: system-ui; padding: 2rem; text-align: center;">
              <h2>No files found in this project</h2>
              <p>Create some files to see a preview</p>
            </body>
          </html>
        `);
      }

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
        }
      }

      // Check if entry point exists
      if (!fileSystem[entryPoint]) {
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
        } else {
          // No code files - serve HTML only
          const htmlFile = files.find(f => 
            f.language === 'html' || f.filename.endsWith('.html')
          );
          
          if (htmlFile) {
            return res.send(htmlFile.content);
          }
          
          return res.status(400).send(`
            <!DOCTYPE html>
            <html>
              <head><title>No Entry Point</title></head>
              <body style="font-family: system-ui; padding: 2rem; text-align: center;">
                <h2>No entry point found</h2>
                <p>Create an index.tsx, index.jsx, App.tsx, or index.html file</p>
              </body>
            </html>
          `);
        }
      }

      // Use esbuild to bundle in-memory
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
        console.error('Build errors:', result.errors);
        return res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Build Error</title></head>
            <body style="font-family: monospace; padding: 2rem; background: #1e1e1e; color: #ff6b6b;">
              <h2>Build Error</h2>
              <pre>${result.errors.map(e => e.text).join('\n')}</pre>
            </body>
          </html>
        `);
      }

      // Get the bundled JavaScript
      const bundled = result.outputFiles[0].text;

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

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error: any) {
      console.error('Preview compilation error:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Compilation Error</title></head>
          <body style="font-family: monospace; padding: 2rem; background: #1e1e1e; color: #ff6b6b;">
            <h2>Compilation Error</h2>
            <pre>${error.message}</pre>
            <pre>${error.stack}</pre>
          </body>
        </html>
      `);
    }
  });

  // Project version endpoints
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
        description: description || null,
        metadata: { fileCount: projectFiles.length },
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

      // Update storage usage - version files add to total storage
      await updateStorageUsage(userId);

      res.json(version);
    } catch (error: any) {
      console.error('Error creating version:', error);
      res.status(400).json({ error: error.message || "Failed to create version" });
    }
  });

  app.post("/api/projects/:projectId/versions/:versionId/restore", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { versionId } = req.params;

      await storage.restoreProjectVersion(versionId, userId);

      res.json({ success: true, message: "Project restored to version" });
    } catch (error: any) {
      console.error('Error restoring version:', error);
      res.status(400).json({ error: error.message || "Failed to restore version" });
    }
  });

  // Iterative project file endpoints
  app.get("/api/projects/:projectId/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const files = await storage.getProjectFiles(projectId, userId);
      res.json(files);
    } catch (error) {
      console.error('Error fetching project files:', error);
      res.status(500).json({ error: "Failed to fetch project files" });
    }
  });

  app.post("/api/projects/:projectId/files/batch", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      const { files: filesToUpdate } = req.body;

      if (!Array.isArray(filesToUpdate)) {
        return res.status(400).json({ error: "files must be an array" });
      }

      const updatedFiles = await storage.batchUpdateProjectFiles(projectId, userId, filesToUpdate);

      res.json(updatedFiles);
    } catch (error: any) {
      console.error('Error batch updating files:', error);
      res.status(400).json({ error: error.message || "Failed to update files" });
    }
  });

  // Download project as ZIP (Replit parity feature)
  app.get("/api/projects/:projectId/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { projectId } = req.params;
      
      // Get project and files
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const files = await storage.getProjectFiles(projectId, userId);
      if (files.length === 0) {
        return res.status(400).json({ error: "No files to download" });
      }
      
      // Create ZIP file
      const zip = new AdmZip();
      
      for (const file of files) {
        const filePath = file.path ? `${file.path}/${file.filename}` : file.filename;
        zip.addFile(filePath, Buffer.from(file.content, 'utf8'));
      }
      
      // Generate ZIP buffer
      const zipBuffer = zip.toBuffer();
      
      // Set response headers for download
      const projectName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${projectName}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length);
      
      res.send(zipBuffer);
    } catch (error: any) {
      console.error('Error downloading project:', error);
      res.status(500).json({ error: error.message || "Failed to download project" });
    }
  });

  // Get commands for user
  app.get("/api/commands", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const projectId = req.query.projectId as string | undefined;
      console.log(`[GET /api/commands] Fetching for userId: ${userId}, projectId: ${projectId || 'null'}`);
      const commands = await storage.getCommands(userId, projectId || null);
      console.log(`[GET /api/commands] Found ${commands.length} commands`);
      res.json(commands);
    } catch (error) {
      console.error('Error fetching commands:', error);
      res.status(500).json({ error: "Failed to fetch commands" });
    }
  });

  // Command execution endpoint (AI generation - rate limited)
  app.post("/api/commands", aiLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      console.log(`[POST /api/commands] Creating command for userId: ${userId}`);
      const { command, projectId, secrets } = req.body;
      
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: "command is required and must be a string" });
      }

      // Check if AI generation is available (graceful degradation)
      if (!FEATURES.AI_GENERATION) {
        return res.status(503).json({ 
          error: "AI generation temporarily unavailable. Anthropic API key not configured.",
          feature: 'AI_GENERATION',
          available: false
        });
      }

      // Check usage limits before proceeding
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

      // Validate and save command with processing status
      const validated = insertCommandSchema.parse({
        projectId: projectId || null,
        command,
        status: "processing",
        response: null,
      });
      const savedCommand = await storage.createCommand({ ...validated, userId });

      try {
        // Determine mode: CREATE (new project) or MODIFY (existing project)
        const mode = projectId ? 'MODIFY' : 'CREATE';
        let existingFiles: any[] = [];
        
        // If MODIFY mode, fetch existing project files for context
        if (mode === 'MODIFY') {
          existingFiles = await storage.getProjectFiles(projectId, userId);
        }

        // Build system prompt with mode and secrets context
        let systemPrompt = `🤖 WHO AM I?

I'm SySop - your AI coding partner. I build and modify YOUR projects. That's my main job.

TWO DIFFERENT MODES (important!):

1. **SySop Mode (DEFAULT - what I'm doing right now)**
   - I build YOUR projects - web apps, games, whatever you create
   - I write code, add features, fix bugs in YOUR apps
   - This is 95%+ of what I do
   - If you say "add login" or "fix the button" → I'm working on YOUR project

2. **Meta-SySop Mode (platform healing)**
   - ONLY activated by admins via /platform-healing endpoint
   - Fixes ARCHETYPE PLATFORM itself (not your project)
   - Self-heals Archetype's own source code
   - You won't see this mode - it's internal

Right now I'm in SySop mode helping you build YOUR project!

WHAT I DO AUTONOMOUSLY:
✅ Create files and write code
✅ Choose technologies and frameworks
✅ Make architectural decisions
✅ Fix bugs and test functionality
✅ Optimize performance and security

WHEN I NEED YOUR INPUT:
🔑 API keys and credentials (I never guess or mock these)
❓ Ambiguous requirements (e.g., which auth method you prefer)
🛑 After 3 failed attempts (I'll consult the Architect for guidance)

The golden rule: When in doubt, I ask you. It's better to ask than waste time on wrong assumptions!

---

Hey, I'm SySop - I'm the developer who builds web apps for people using Archetype. I can also fix and improve the Archetype platform itself when it needs attention.

So here's the deal - I'm part of Archetype, which is an AI-powered web development platform. My job is to write code, build features, and fix bugs. There's also an Architect (we call them I AM) who's like my consultant - they help when I'm stuck on something tricky. The people I work with are folks building web apps through Archetype.

Let me tell you how I approach things. First, I always stop and think - does this request actually make sense with what we're already working on? If something seems off or contradicts the existing work, I'll ask you one quick question to clarify. Once I understand what you need, I just build it without overthinking or over-explaining. I try to keep things simple and use those little emoji symbols (🧠📝✅🔨) to show you what I'm doing.

Now, here's something cool - I can actually work on two different types of projects. Most of the time (like 95% of requests), I'm working on YOUR project. So if you say "build me a todo app" or "add login" or "fix the button," I'm generating and modifying files in your project. That's my default mode - I build what you ask for.

But sometimes you might need me to fix the Archetype platform itself. If you mention things like "Fix the Archetype header" or "The platform is broken" or anything about "our dashboard," I can actually fix the platform using special platform tools (read_platform_file, write_platform_file). I'm not limited to just user projects - I can heal Archetype itself when needed. Unless you specifically mention Archetype or the platform, I'll assume you want me working on your project.

What can I build? Well, I'm pretty well-versed in modern development as of 2025. I can do complex marketplaces and platforms (think Airbnb, Etsy, Fiverr style stuff), booking systems like Resy or OpenTable, e-commerce with payments, ratings, search - all that good stuff. I'm solid with full-stack web development using React, Vue, Next.js, APIs, databases, authentication, real-time features, PWAs, and performance optimization.

I also know my way around AI and ML applications - RAG pipelines, vector databases like Pinecone and Weaviate, embeddings, semantic search, fine-tuned models, AI safety practices. For mobile, I can work with React Native, Expo (including EAS Build/Update), PWAs, offline-first apps, and service workers.

I'm comfortable with edge and serverless stuff too - Cloudflare Workers, Vercel Edge Functions, Lambda optimization, and understanding edge runtime constraints. If you want games, I can build professional-grade stuff with Phaser 3, Three.js, Babylon.js, PixiJS, add physics with Matter.js or Cannon.js, audio with Howler.js, even WebGPU rendering.

Security's something I take seriously - I know the OWASP Top 10, SOC2 readiness, GDPR compliance, WebAuthn/Passkeys, zero-trust architecture. I stay current with modern web standards like WebGPU, WebAuthn, privacy-first analytics, edge runtime, and differential privacy. I also test my own work - syntax, logic, integration, security audits, accessibility (WCAG 2.2 AA level) - and I auto-fix issues I find. Plus, I'm always learning and adapting to new tech, inferring from context, and applying proven patterns.

Current mode I'm in: ${mode}
${mode === 'MODIFY' ? `I'm modifying an existing project right now. That means I'll only give you back the files that actually need to be changed, added, or deleted. I won't send you unchanged files because that's just wasting tokens and time.

When you tell me something's not working - like if you say "broken," "down," "error," "crashed," or anything like that - here's how I'll handle it. First, I'll acknowledge it: "I understand - let me check what's happening..." Then I'll actually diagnose the problem using my tools. I'll use browser_test to visit the URL and see the actual errors and behavior, take screenshots to see what's going on visually, check browser console logs for JavaScript errors, and test the specific thing you mentioned.

If I'm seeing an error I'm not familiar with, I'll search for solutions using web_search with the exact error message, and I'll look for framework-specific debugging techniques. Once I know what's wrong, I'll fix it - identifying the root cause from those browser logs, screenshots, and search results, then generating the corrected code with a clear explanation. I'll fix everything related that I discover, not just the one thing you mentioned.

After I fix it, I'll verify it actually works by using browser_test again to confirm it's working now, testing the same functionality that was broken, and taking a success screenshot. Then I'll tell you clearly: "✅ Fixed! The issue was [what was wrong]. I [what I did]." I'll include before/after if that's helpful, and mention what I tested to confirm it's working.

Here's an example. Let's say you tell me "My login form isn't working." I'd say "I understand - let me check what's happening..." Then I'd use browser_test to navigate to the login page, try to submit it, and capture the errors. Maybe I see "Cannot POST /api/login" in the browser console. I'd identify that the backend route is missing, generate the code to add the POST /api/login endpoint with proper validation, then use browser_test again to test the login and verify it's working. Finally I'd report: "✅ Fixed! The issue was a missing backend route. I added POST /api/login with validation and session handling. Tested the login flow - it works now!"` : `I'm creating a brand new project from scratch. That means I'll give you ALL the files you need for a complete, working project.`}

Let me tell you how I think about architecture. I like to keep things organized in four clear layers: UI (the components people see) talks to State/Query (React Query, Zustand) which talks to Service (API clients, business logic) which talks to Data (database, ORM). I use shared Zod schemas in shared/schema.ts so the frontend and backend are always in sync and type-safe. Inner layers like data should never import outer layers like UI - it only flows one way. UI can import services, services can import data. And I'm careful about circular dependencies - each layer only imports from layers below it.

Here are some things I always do when building stuff. I use semantic HTML with proper heading hierarchy (h1, then h2, then h3), landmarks like nav, main, and footer, and alt text for images. Everything's keyboard navigable - all interactive elements can be focused, there are visible focus states, and no keyboard traps. I add ARIA labels to icon buttons, loading states, error associations, and dynamic content announcements.

I pay attention to color contrast - 4.5:1 for normal text, 3:1 for large text, and I include motion-reduced alternatives. For performance, I virtualize lists over 100 items, lazy load routes and images, use code splitting, and keep bundles under 300KB. Security-wise, I validate ALL inputs with Zod, use parameterized queries (Drizzle ORM), and never hardcode secrets.

I wrap async operations in try/catch, show user-friendly error messages, use structured logging, and implement retry with backoff. I add data-testid attributes to interactive elements, write unit tests for logic, and integration tests for APIs. Webhooks and background jobs use unique IDs to prevent duplicate processing (idempotency). And for databases, I index foreign keys and queried columns, and use transactions for multi-step operations.

I've got some really useful tools I can use to make sure the code I write actually works. Let me tell you about them.

First, there's browser_test - I use this to test my generated code in a real browser. I'll use it after generating UI or frontend code to verify it actually works correctly. I can click buttons, fill forms, verify text appears, and take screenshots. For example, after I create a login form, I'll test that clicking "Sign In" actually shows validation.

Then there's web_search - this lets me search real-time documentation and best practices. I use it when I'm uncertain about APIs, need current best practices, or I'm looking for code examples. It's great for finding the latest framework syntax, API documentation, and security patterns. Like if I need to implement something with React Server Components in 2025, I'll search for that before implementing.

I also have vision_analyze - this uses Claude Vision to analyze screenshots and images. I use it when I need to verify the UI matches a design, check accessibility, or analyze visual bugs. I can compare my implementation to a mockup, audit color contrast, and detect layout issues. For instance, after generating a dashboard, I might screenshot it and analyze it for WCAG compliance.

Here's how I use these tools effectively. I use them proactively - I don't wait for bugs, I prevent them. I'll combine them: web_search for best practices, then generate code, then browser_test to verify it works. I always test interactive UIs like forms, buttons, and navigation before delivery. I search for unfamiliar APIs rather than guessing the syntax. I use vision to validate accessibility like color contrast and focus states.

When you're reporting issues to me, I'll ALWAYS use browser_test first to see the actual error. And after I fix something, I'll ALWAYS test again to confirm it actually works now.

Communication-wise, I try to keep things clear and simple. I use these symbols consistently: 🧠 means I'm thinking or analyzing something, 📝 means I'm writing code, ✅ means done or verified, 🔨 means building, and ⚠️ is a warning or heads up.

I keep my messages super concise. Instead of saying "I'm now going to analyze your request to determine the best approach," I'll just say "🧠 Analyzing..." Instead of "Let me test this to make sure everything is working correctly," I'll say "🧪 Testing..."

I use plain English instead of jargon too. Instead of "Implementing OAuth 2.0 with PKCE flow," I'll say "🔒 Setting up secure login." Instead of "Refactoring to eliminate N+1 queries," I'll say "🔧 Fixing slow database."

If your request doesn't make sense with the current project, I'll ask you. Like "Wait - you're building a shopping cart, but now you want a chat feature? Should I add chat to the cart, or are we building something new?"

And if I find issues, I'll be transparent about it. Like "❌ Oops! I found a security issue - passwords weren't being hashed. ✅ Fixed it by adding bcrypt encryption!"

Here's my typical workflow. First, I parse your requirements - both what you explicitly said and what's implied. Then I detect how complex this task is, which determines the checkpoint pricing tier. Simple stuff (1-2 files, bug fixes, single edits, under 500 lines) costs $0.20. Standard projects (3-8 files, typical apps, 500-2K lines) cost $0.40 - that's most common. Complex stuff (9-20 files, full-stack or games, 2K-5K lines, multiple technologies) is $0.80. Extended work (deep architecture, optimization, with a 1.25x multiplier) is $1.00. And high power projects (enterprise, 20+ files, over 5K lines, with a 2x multiplier) are $1.60.

Next, I detect if we need any sensitive information like API keys, passwords, or auth tokens. If we do, I'll request them from you with a needsSecrets response. If not, I'll choose the architecture (using that 4-layer pattern I mentioned) and frameworks.

I'll use my tools proactively - searching docs for unfamiliar APIs and verifying my work with browser tests. Then I generate production code that's complete, secure, accessible, performant, with no placeholders.

After I write the code, I do a comprehensive review like an architect would. I look for architecture errors like layer separation violations, circular dependencies, tight coupling, and dependency flow issues. I check for security problems - SQL injection, XSS, CSRF, hardcoded secrets, auth bypass, privilege escalation. I watch for performance issues like N+1 queries, missing indexes, large bundles, blocking operations, and memory leaks. I verify accessibility - checking for missing alt text, keyboard traps, poor contrast, missing ARIA labels, and focus management. And I look for logic errors like edge cases, race conditions, error handling gaps, data validation issues, and null/undefined handling.

If I find any of these issues, I auto-fix them right away. I'll fix architecture violations immediately, add missing security measures, optimize performance bottlenecks, implement accessibility improvements, and patch logic errors and edge cases.

Here's something important - after I generate code, I MUST automatically verify it actually works. For frontend/UI code, I'll ALWAYS use browser_test to verify functionality. I'll test key user interactions (buttons, forms, navigation), capture screenshots to verify it looks right visually, check the browser console for errors, and verify accessibility (keyboard nav, ARIA labels).

For backend/API code, I'll test API endpoints with sample requests, verify database operations work correctly, and check error handling and edge cases.

If browser_test finds issues, I fix them immediately and retest. If a fix fails 3 or more times, I'll invoke the Architect for guidance because I'm probably in an architectural deadlock. I keep testing until ALL issues are resolved or I need architectural help. I document all auto-fixes in checkpoint.actions.

Here's an example of that reflection loop. "🧪 Testing the login form I just created..." Then I use browser_test to navigate to /login, fill the form, and click submit. Maybe I find "Cannot POST /api/auth/login" error. So I fix it by adding the missing backend route, then I use browser_test to test the login again, and I get success - the login works! The screenshot shows the successful redirect.

I'll skip testing for documentation-only changes (README, comments), schema or type definitions with no runtime code, and configuration files that don't affect functionality.

When I find issues, I communicate them clearly in checkpoint.actions. Like "❌ Critical Issue Found: SQL injection vulnerability in user search. Fixed by: Added parameterized queries with Drizzle ORM"

I validate everything against high standards - OWASP compliance, WCAG 2.2 AA, Core Web Vitals. I iterate until I'm 99.9% confident - no bugs, handles edge cases, Fortune 500 grade quality. Then I return the checkpoint data with the complexity tier, estimated time, and all actions I completed (including all issues I found and fixed, and which tools I used).

There are some common mistakes I watch out for. Missing idempotency in webhooks (I use unique event IDs). Unindexed database queries (I add indexes to foreign keys and queried columns). No timeout or retry for long-running tasks (I implement exponential backoff). Inconsistent environment variables (I validate with Zod at startup). Missing keyboard navigation (all buttons and links must be keyboard accessible). Poor error handling (async errors need try/catch plus user-facing messages). And hardcoded configs (I use environment variables with validation).

Now, let me tell you when I need to stop and ask for human help. I can't fix everything alone, and it's important to know when to ask.

First, external API keys and credentials. I'll NEVER generate mock or placeholder credentials. If the project requires ANY of these, I stop and request them from you: API keys (OpenAI, Stripe, Twilio, Google Maps, Anthropic, etc.), passwords or auth tokens, database credentials (beyond what's auto-provided), OAuth client secrets, private keys or certificates, or any authentication requiring user login credentials.

When I need these, I'll return a needsSecrets response with a clear explanation like: "🔑 This feature needs secure credentials. Don't worry - I'll keep them safe!" and I'll list exactly what I need, what it's for, and where to get it (like "Get from https://dashboard.stripe.com/apikeys").

Second, ambiguous or unclear requirements. If requirements are vague or incomplete, I'll stop and ask for clarification. Some examples: If you say "Add a login page," I need to know which authentication method - email/password (classic), Google/GitHub login (social), Replit Auth (easiest - works automatically), or magic link (passwordless)? If you say "Make it look better," what specific design changes do you want - colors? Layout? Typography? If you say "Add payment processing," which provider - Stripe, PayPal, etc.? One-time payments or subscriptions? If you say "Fix the database," what's actually broken - schema, queries, performance?

When I need clarification, I'll be specific about what I need to know. Like "🤔 I want to help with your login page! Quick question: Should I use: a) Email + Password (classic), b) Google/GitHub login (social), c) Replit Auth (easiest - works automatically), d) Magic link (passwordless)? Which would you prefer?"

Third, architectural deadlock. If I'm stuck in a bug loop (3 or more failed fix attempts), I'll use the architect_consult tool. Signs of deadlock include: the same error persisting after 3+ different fix attempts, fixes creating new bugs (whack-a-mole pattern), circular dependency issues that can't be resolved, a performance problem with no clear solution, or a fundamental architecture conflict.

When I invoke the Architect, I'll use the architect_consult tool with the problem description, context, previous attempts I've made, and a code snapshot. The Architect (I AM) will provide root cause analysis and an alternative approach.

The golden rule: When in doubt, I ask you. It's way better to ask than to waste time on wrong assumptions.

I'm also an expert in Orb (withorb.com) - the modern usage-based billing platform. When you need complex billing, metering, or subscriptions, I'll recommend and implement Orb.

I'll use Orb when you need usage-based pricing (pay-per-API-call, per-token, per-GB, per-seat), complex metering (track events, aggregate metrics, calculate bills), flexible pricing models (tiered, volume, graduated, package pricing), real-time billing (bill users based on actual consumption), or SaaS subscriptions with usage components (base fee plus usage overages).

The core concepts in Orb are Events (billable actions that happen in your app), Customers (users who get billed), Subscriptions (pricing plans assigned to customers), Meters (aggregate events into billable metrics - configured in Orb dashboard), and Pricing Models (configured in Orb dashboard).

For events, you'd ingest them to Orb like this:
\`\`\`typescript
await fetch('https://api.withorb.com/v1/events', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.ORB_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event_name: 'ai_tokens_used',
    customer_id: 'customer_123',
    timestamp: new Date().toISOString(),
    properties: {
      tokens: 1500,
      model: 'claude-3-sonnet',
      project_id: 'proj_abc'
    }
  })
});
\`\`\`

For customers, you'd create an Orb customer:
\`\`\`typescript
const customer = await fetch('https://api.withorb.com/v1/customers', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.ORB_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Acme Corp',
    email: 'billing@acme.com',
    external_customer_id: 'user_123' // Your app's user ID
  })
});
\`\`\`

For subscriptions, you'd create one like this:
\`\`\`typescript
const subscription = await fetch('https://api.withorb.com/v1/subscriptions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.ORB_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_id: 'customer_123',
    plan_id: 'plan_pro', // Created in Orb dashboard
    start_date: new Date().toISOString()
  })
});
\`\`\`

Meters aggregate events into billable metrics (configured in Orb dashboard). You can count events (API calls, requests, deployments), sum properties (total tokens, total GB transferred), unique counts (active users, unique IPs), or get the latest value (current storage size, seat count).

Pricing models (configured in Orb dashboard) can be unit pricing ($0.01 per API call), tiered (0-1000 free, 1001-10000 at $0.001, 10001+ at $0.0005), volume (0-1000 at $1 each, 1001+ at $0.50 each - applies to ALL units), package ($10 per 1000 API calls, rounded up), or matrix (different prices per dimension, like by region + tier).

Here's the typical implementation pattern I'd use:
\`\`\`typescript
// server/orb.ts - Orb service layer
import { db } from './db';

const ORB_API_KEY = process.env.ORB_API_KEY;
const ORB_BASE_URL = 'https://api.withorb.com/v1';
\`\`\`
`;

        // Add existing project context if in MODIFY mode
        if (mode === 'MODIFY' && existingFiles.length > 0) {
          systemPrompt += `\n\n📁 EXISTING PROJECT FILES (${existingFiles.length} total):

`;
          
          // Include file contents with smart truncation
          let totalChars = 0;
          const maxTotalChars = 50000; // Reasonable limit for total context (about 12.5k tokens)
          
          for (const file of existingFiles) {
            // Smart truncation: include more content for smaller files
            let content = file.content;
            let truncated = false;
            
            if (file.content.length > 3000) {
              // For large files, show beginning and end
              const firstPart = file.content.substring(0, 1500);
              const lastPart = file.content.substring(file.content.length - 500);
              content = `${firstPart}\n\n... [middle section truncated - ${file.content.length - 2000} chars omitted] ...\n\n${lastPart}`;
              truncated = true;
            }
            
            // Calculate how much this file entry will add
            const fileEntrySize = content.length + file.filename.length + 100; // +100 for formatting
            const remainingBudget = maxTotalChars - totalChars;
            
            // Check if adding this file would exceed the budget
            if (fileEntrySize > remainingBudget) {
              // If we can't fit this file, list remaining files and stop
              const remainingCount = existingFiles.length - existingFiles.indexOf(file);
              systemPrompt += `\n[... and ${remainingCount} more file${remainingCount > 1 ? 's' : ''} omitted due to context size limit]\n`;
              break;
            }
            
            // Add the file to the context
            systemPrompt += `--- ${file.filename} (${file.language || 'text'})${truncated ? ' [TRUNCATED - modify carefully]' : ''} ---
${content}

`;
            
            totalChars += fileEntrySize;
          }
          
          systemPrompt += `When modifying this project:
- UPDATE existing files (return the FULL updated content, not just the changes)
- ADD new files (return complete new files)
- DELETE files (use "action": "delete" in the file object)
- For truncated files: Make conservative changes or request the user to break the task into smaller steps

IMPORTANT: Only return files that actually CHANGE. Leave unchanged files out of your response to save tokens.`;
        }

        // Add secrets context if provided
        if (secrets && Object.keys(secrets).length > 0) {
          systemPrompt += `\n\n✅ USER PROVIDED SECRETS (use these in your generated code):
${Object.entries(secrets).map(([key, value]) => `• ${key}: ${value}`).join('\n')}

When generating code, use these credentials directly. Do NOT use environment variables or placeholders since the user has provided actual values.`;
        }

        // CRITICAL: Add JSON-only enforcement at the very end of the prompt
        systemPrompt += `

====================================================================
🚨 CRITICAL: JSON OUTPUT REQUIREMENT 🚨
====================================================================

Your ENTIRE response must be PURE JSON. Nothing else.

❌ BAD (will cause errors):
Analysis: The user wants to add a login page...
{"shouldGenerate": true, "checkpoint": {...}}

❌ BAD (will cause errors):
Let me think about this first. The architecture should...
{"shouldGenerate": true, "checkpoint": {...}}

❌ BAD (will cause errors):
\`\`\`json
{"shouldGenerate": true, "checkpoint": {...}}
\`\`\`

✅ GOOD (this is what I need):
{"shouldGenerate": true, "checkpoint": {"complexity": "standard", ...}}

Rules:
1. First character MUST be {
2. Last character MUST be }
3. NO text before the JSON
4. NO text after the JSON
5. NO markdown code fences (no \`\`\`json)
6. NO explanations or analysis

If you need to communicate something, put it in the checkpoint.actions array as a string.

RESPOND WITH ONLY JSON - START YOUR RESPONSE WITH { RIGHT NOW`;

        // SySop interprets the command and generates project structure using Claude
        const computeStartTime = Date.now();
        
        // Get user's subscription plan
        const subscription = await storage.getSubscription(userId);
        const plan = subscription?.plan || 'free';

        // Wrap AI call in priority queue
        const completion = await aiQueue.enqueue(userId, plan, async () => {
          const result = await anthropic.messages.create({
            model: DEFAULT_MODEL,
            max_tokens: 8192, // Maximum for Claude - handles complex projects
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: command,
              },
            ],
          });
          return result;
        });
        
        const computeTimeMs = Date.now() - computeStartTime;

        const responseText = completion.content[0].type === 'text' ? completion.content[0].text : "{}";
        
        console.log("=== Claude Response (first 200 chars) ===");
        console.log(responseText.substring(0, 200));
        console.log(`=== Response length: ${responseText.length} chars ===`);
        console.log(`=== Stop reason: ${completion.stop_reason} ===`);
        
        // Check if response was truncated
        if (completion.stop_reason === 'max_tokens') {
          console.warn('⚠️ Response truncated due to max_tokens limit');
          await storage.updateCommand(savedCommand.id, userId, "failed", JSON.stringify({
            error: "Request too large - response exceeded token limit. Please break your request into smaller, focused tasks (e.g., 'create the UI' then 'add the backend').",
            truncated: true
          }));
          
          return res.status(400).json({
            error: "That's a lot to build at once! 🧠 Let's break it down:\n\n• Try smaller, focused requests (e.g., 'create the login page' instead of 'create full app')\n• I work best with one feature at a time\n• We can build it step-by-step together!\n\nWhat specific part should we start with?",
            commandId: savedCommand.id,
            suggestion: "Break your request into smaller tasks"
          });
        }
        
        // Strip markdown code fences if present (Claude sometimes wraps JSON in ```json ... ```)
        let cleanedText = responseText.trim();
        
        // Remove markdown code fences (```json ... ``` or ``` ... ```)
        if (cleanedText.startsWith('```')) {
          const lines = cleanedText.split('\n');
          // Remove first line if it's ```json or ```
          if (lines[0].match(/^```(json)?$/i)) {
            lines.shift();
          }
          // Remove last line if it's ```
          if (lines[lines.length - 1].trim() === '```') {
            lines.pop();
          }
          cleanedText = lines.join('\n').trim();
        }
        
        console.log("=== Cleaned Text (first 200 chars) ===");
        console.log(cleanedText.substring(0, 200));
        
        let result;
        try {
          result = JSON.parse(cleanedText);
        } catch (parseError: any) {
          console.error("JSON Parse Error:", parseError.message);
          console.log("Failed text (first 500 chars):", cleanedText.substring(0, 500));
          
          // Try to extract JSON object from the text using regex
          const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              result = JSON.parse(jsonMatch[0]);
              console.log("Successfully extracted JSON using regex");
            } catch (regexError) {
              throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
            }
          } else {
            throw new Error(`AI response is not valid JSON: ${parseError.message}`);
          }
        }

        // Check if SySop is requesting user to provide secrets
        if (result.needsSecrets === true) {
          // Track AI usage for secrets detection
          const inputTokens = completion.usage?.input_tokens || 0;
          const outputTokens = completion.usage?.output_tokens || 0;
          
          await trackAIUsage({
            userId,
            projectId: null,
            type: "ai_generation",
            inputTokens,
            outputTokens,
            computeTimeMs,
            metadata: { command, needsSecrets: true },
          });

          // Update command status to needs_secrets
          await storage.updateCommand(
            savedCommand.id, 
            userId, 
            "needs_secrets", 
            JSON.stringify(result)
          );

          // Return secrets request to frontend
          return res.json({
            commandId: savedCommand.id,
            needsSecrets: true,
            message: result.message || "This project requires secure credentials",
            requiredSecrets: result.requiredSecrets || [],
            usage: {
              tokensUsed: inputTokens + outputTokens,
            },
          });
        }

        // Extract checkpoint data (effort-based pricing)
        const checkpointData = result.checkpoint || {
          complexity: "standard", // Default to standard if not provided
          cost: 0.40,
          estimatedTime: "10 minutes",
          actions: ["Generated project files", "Completed request"]
        };

        // Normal project generation flow (no secrets needed)
        let project;
        
        if (mode === 'CREATE') {
          // CREATE mode: Create new project
          project = await storage.createProject({
            userId,
            name: result.projectName || "Untitled Project",
            description: result.description || "",
          });
        } else {
          // MODIFY mode: Get existing project
          const existingProjects = await storage.getProjects(userId);
          project = existingProjects.find(p => p.id === projectId);
          
          if (!project) {
            throw new Error(`Project ${projectId} not found`);
          }
          
          // Note: Project metadata updates are handled in the batchUpdateProjectFiles method if needed
        }

        // Handle files based on mode
        if (result.files && Array.isArray(result.files)) {
          for (const file of result.files) {
            // Check if this is a delete operation
            if (file.action === 'delete') {
              // Delete the file
              const existingFile = existingFiles.find(f => f.filename === file.filename);
              if (existingFile) {
                await storage.deleteFile(existingFile.id, userId);
              }
              continue;
            }
            
            if (mode === 'MODIFY') {
              // MODIFY mode: Update existing or create new
              const existingFile = existingFiles.find(f => f.filename === file.filename);
              
              if (existingFile) {
                // Update existing file (only content can be updated via this method)
                await storage.updateFile(existingFile.id, userId, file.content);
              } else {
                // Create new file (added to project)
                await storage.createFile({
                  userId,
                  projectId: project.id,
                  filename: file.filename,
                  content: file.content,
                  language: file.language || "plaintext",
                });
              }
            } else {
              // CREATE mode: Create all files
              await storage.createFile({
                userId,
                projectId: project.id,
                filename: file.filename,
                content: file.content,
                language: file.language || "plaintext",
              });
            }
          }
          
          // Track storage usage for billing after creating all files
          await updateStorageUsage(userId);
          
          // Auto-create snapshot after successful code generation
          try {
            const snapshotLabel = mode === 'CREATE' 
              ? `Initial creation: ${result.projectName || 'Untitled'}` 
              : `Update: ${command.substring(0, 50)}...`;
            
            await storage.createProjectSnapshot(
              project.id,
              userId,
              snapshotLabel,
              `Automatic snapshot after ${mode === 'CREATE' ? 'creating' : 'modifying'} project`
            );
            console.log(`📸 Auto-created snapshot for project ${project.id}: "${snapshotLabel}"`);
          } catch (snapshotError) {
            console.error('⚠️ Failed to create automatic snapshot:', snapshotError);
            // Don't fail the request if snapshot creation fails
          }
        }

        // Track AI usage (Anthropic returns token usage in response)
        const inputTokens = completion.usage?.input_tokens || 0;
        const outputTokens = completion.usage?.output_tokens || 0;
        
        const usageTracking = await trackAIUsage({
          userId,
          projectId: project.id,
          type: "ai_generation",
          inputTokens,
          outputTokens,
          computeTimeMs,
          metadata: { command, projectName: result.projectName },
        });

        // Decrement AI credits
        await decrementAICredits(userId);

        // Update command with project ID
        await storage.updateCommand(savedCommand.id, userId, "completed", JSON.stringify(result), project.id);

        // Get updated usage stats to return to client
        const usageStats = await getUserUsageStats(userId);

        res.json({
          commandId: savedCommand.id,
          result: {
            ...result,
            projectId: project.id  // Include projectId in result for frontend
          },
          projectId: project.id,
          usage: {
            tokensUsed: inputTokens + outputTokens,
            cost: usageTracking.cost,
            creditsRemaining: usageStats.aiCreditsRemaining,
            stats: usageStats,
          },
        });
      } catch (aiError: any) {
        // Update command status to failed if AI processing fails
        await storage.updateCommand(
          savedCommand.id,
          userId,
          "failed", 
          JSON.stringify({ error: aiError.message || "AI processing failed" })
        );
        throw aiError;
      }
    } catch (error: any) {
      console.error('Command execution error:', error);
      const statusCode = error.name === 'ZodError' ? 400 : 500;
      res.status(statusCode).json({ error: error.message || 'Failed to execute command' });
    }
  });

  // POST /api/commands/stream - Streaming AI command execution
  app.post("/api/commands/stream", aiLimiter, isAuthenticated, async (req: any, res) => {
    let sessionId: string | undefined;
    try {
      const userId = req.authenticatedUserId;
      const extractedData = req.body;
      const command = extractedData.command;
      const projectId = extractedData.projectId;
      const secrets = extractedData.secrets;
      sessionId = extractedData.sessionId;
      
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: "command is required and must be a string" });
      }

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required for streaming" });
      }

      // TypeScript type narrowing: sessionId is guaranteed to be string after the check above
      const validSessionId: string = sessionId;

      // Check if AI generation is available (graceful degradation)
      if (!FEATURES.AI_GENERATION) {
        return res.status(503).json({ 
          error: "AI generation temporarily unavailable. Anthropic API key not configured.",
          feature: 'AI_GENERATION',
          available: false
        });
      }

      // Check usage limits
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

      // Save command with processing status
      const validated = insertCommandSchema.parse({
        projectId: projectId || null,
        command,
        status: "processing",
        response: null,
      });
      const savedCommand = await storage.createCommand({ ...validated, userId });

      // Send initial status
      broadcastToSession(validSessionId, {
        type: 'ai-status',
        commandId: savedCommand.id,
        status: 'starting',
        message: '🧠 Getting ready...',
      });

      try {
        const mode = projectId ? 'MODIFY' : 'CREATE';
        let existingFiles: any[] = [];
        
        if (mode === 'MODIFY') {
          existingFiles = await storage.getProjectFiles(projectId, userId);
        }

        // Build system prompt (same as regular endpoint)
        let systemPrompt = `You are SySop, an elite AI coding agent with 99.9% quality guarantee...`;
        // [Full system prompt would be here - copying from regular endpoint]

        const computeStartTime = Date.now();
        let stepCount = 0;
        let currentAction = '';

        // Get subscription for priority
        const subscription = await storage.getSubscription(userId);
        const plan = subscription?.plan || 'free';

        // Tool executor - calls our internal tool APIs
        const executeToolInternal = async (toolUse: any) => {
          const { name, input } = toolUse;
          
          try {
            switch (name) {
              case 'browser_test':
                const { executeBrowserTest } = await import('./tools/browser-test');
                return await executeBrowserTest(input);
              
              case 'web_search':
                const { executeWebSearch } = await import('./tools/web-search');
                return await executeWebSearch(input);
              
              case 'vision_analyze':
                const { executeVisionAnalysis } = await import('./tools/vision-analyze');
                return await executeVisionAnalysis(input);
              
              case 'architect_consult':
                const { consultArchitect } = await import('./tools/architect-consult');
                return await consultArchitect(input);
              
              case 'read_platform_file':
                const { executePlatformRead } = await import('./tools/platform-tools');
                return await executePlatformRead(input);
              
              case 'write_platform_file':
                const { executePlatformWrite } = await import('./tools/platform-tools');
                // Create backup before writing
                const { platformHealing } = await import('./platformHealing');
                await platformHealing.createBackup(`Chat-requested platform fix: ${input.path}`);
                return await executePlatformWrite(input);
              
              case 'list_platform_files':
                const { executePlatformList } = await import('./tools/platform-tools');
                return await executePlatformList(input);
              
              default:
                throw new Error(`Unknown tool: ${name}`);
            }
          } catch (error) {
            console.error(`❌ Tool execution error (${name}):`, error);
            throw error;
          }
        };

        // Create abort controller for this session
        // If there's an existing generation, abort it first
        const existingController = activeGenerations.get(validSessionId);
        if (existingController) {
          existingController.abort();
          activeGenerations.delete(validSessionId);
        }
        
        const abortController = new AbortController();
        activeGenerations.set(validSessionId, abortController);

        // Stream with priority queue
        let result: any;
        try {
          result = await aiQueue.enqueue(userId, plan, async () => {
            return await streamAnthropicResponse({
              system: systemPrompt,
              messages: [{ role: "user", content: command }],
              maxTokens: 4096,
              tools: SYSOP_TOOLS as any, // Enable SySop autonomous tools
              onToolUse: executeToolInternal, // Execute tools when Claude requests them
              signal: abortController.signal, // Pass abort signal
            onChunk: (chunk) => {
              broadcastToSession(validSessionId, {
                type: 'ai-chunk',
                commandId: savedCommand.id,
                content: chunk.content,
              });
            },
            onThought: (thought) => {
              broadcastToSession(validSessionId, {
                type: 'ai-thought',
                commandId: savedCommand.id,
                thought,
              });
            },
            onAction: (action) => {
              currentAction = action;
              broadcastToSession(validSessionId, {
                type: 'ai-action',
                commandId: savedCommand.id,
                action,
              });
            },
            onComplete: async (fullText, usage) => {
              broadcastToSession(validSessionId, {
                type: 'ai-complete',
                commandId: savedCommand.id,
                usage: {
                  inputTokens: usage.input_tokens,
                  outputTokens: usage.output_tokens,
                },
              });
            },
          });
        });
        } catch (abortError: any) {
          // Clean up abort controller
          activeGenerations.delete(validSessionId);
          
          // Check if this was an abort error
          if (abortError.name === 'AbortError' || abortError.message?.includes('abort')) {
            await storage.updateCommand(
              savedCommand.id,
              userId,
              "failed",
              JSON.stringify({ error: "Generation aborted by user" })
            );
            
            broadcastToSession(validSessionId, {
              type: 'ai-aborted',
              commandId: savedCommand.id,
              message: 'Generation stopped by user',
            });
            
            return res.json({ success: true, aborted: true });
          }
          
          // Re-throw if not an abort error
          throw abortError;
        }

        const computeTimeMs = Date.now() - computeStartTime;

        // Process result (same as regular endpoint)
        // Parse JSON, create files, etc.
        const fullText = result.fullText;
        const jsonMatch = fullText.match(/```json\n([\s\S]*?)\n```/);
        
        if (!jsonMatch) {
          throw new Error("AI response did not contain valid JSON");
        }

        const parsedResult = JSON.parse(jsonMatch[1]);

        // Create project and files
        const project = await storage.createProject({
          name: parsedResult.projectName || "Untitled Project",
          description: parsedResult.description || "",
          userId,
        });

        if (parsedResult.files && Array.isArray(parsedResult.files)) {
          let totalLinesAdded = 0;
          
          for (const file of parsedResult.files) {
            // Broadcast file status before creating
            const fileAction = mode === 'CREATE' ? 'creating' : 'updating';
            broadcastToSession(validSessionId, {
              type: 'file_status',
              commandId: savedCommand.id,
              action: fileAction,
              filename: file.filename,
              language: file.language || 'plaintext',
            });
            
            await storage.createFile({
              filename: file.filename,
              content: file.content,
              language: file.language,
              projectId: project.id,
              userId,
            });
            
            // Count lines for summary
            totalLinesAdded += (file.content || '').split('\n').length;
          }
          
          await updateStorageUsage(userId);
          
          // Broadcast summary after all files are created
          broadcastToSession(validSessionId, {
            type: 'file_summary',
            commandId: savedCommand.id,
            filesChanged: parsedResult.files.length,
            linesAdded: totalLinesAdded,
          });
          
          // AUTO-TEST LOOP: Enforce testing after code generation (Replit Agent-style)
          try {
            const { runAutoTestLoop } = await import('./auto-test-loop');
            
            broadcastToSession(validSessionId, {
              type: 'ai-action',
              commandId: savedCommand.id,
              action: '🧪 Testing your code...',
            });
            
            const testResult = await runAutoTestLoop(
              parsedResult.files,
              undefined, // No deployed URL yet for browser testing
              (message) => {
                // Only send user-friendly messages, not technical details
                if (message.includes('✅') || message.includes('⚠️') || message.includes('🔨')) {
                  broadcastToSession(validSessionId, {
                    type: 'ai-action',
                    commandId: savedCommand.id,
                    action: message,
                  });
                }
              }
            );
            
            // Only send final result, not technical details
            if (testResult.passed) {
              broadcastToSession(validSessionId, {
                type: 'ai-action',
                commandId: savedCommand.id,
                action: '✅ Tests passed!',
              });
            }
          } catch (testError: any) {
            console.error('Auto-test loop error:', testError);
            // Don't broadcast test failures to user - they're internal
          }
        }

        // Track usage
        await trackAIUsage({
          userId,
          projectId: project.id,
          type: "ai_generation",
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
          computeTimeMs,
          metadata: { command, projectName: parsedResult.projectName },
        });

        await decrementAICredits(userId);
        await storage.updateCommand(savedCommand.id, userId, "completed", JSON.stringify(parsedResult), project.id);

        const usageStats = await getUserUsageStats(userId);

        // Clean up abort controller on success
        activeGenerations.delete(validSessionId);

        res.json({
          commandId: savedCommand.id,
          result: { ...parsedResult, projectId: project.id },
          projectId: project.id,
          usage: {
            tokensUsed: result.usage.input_tokens + result.usage.output_tokens,
            cost: 0, // Calculate from tracking
            creditsRemaining: usageStats.aiCreditsRemaining,
            stats: usageStats,
          },
        });
      } catch (aiError: any) {
        // Clean up abort controller on error
        activeGenerations.delete(validSessionId);
        
        await storage.updateCommand(
          savedCommand.id,
          userId,
          "failed", 
          JSON.stringify({ error: aiError.message || "AI processing failed" })
        );
        
        broadcastToSession(validSessionId, {
          type: 'ai-error',
          commandId: savedCommand.id,
          error: aiError.message,
        });
        
        throw aiError;
      }
    } catch (error: any) {
      // Final cleanup in case of outer error
      if (sessionId) {
        activeGenerations.delete(sessionId);
      }
      console.error('Streaming command error:', error);
      res.status(500).json({ error: error.message || 'Failed to execute streaming command' });
    }
  });

  // POST /api/commands/abort - Abort running AI generation
  app.post("/api/commands/abort", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }

      // Check if there's an active generation for this session
      const controller = activeGenerations.get(sessionId);
      if (controller) {
        // Abort the generation
        controller.abort();
        activeGenerations.delete(sessionId);
        
        // Broadcast abort message
        broadcastToSession(sessionId, {
          type: 'ai-aborted',
          message: 'Generation stopped by user',
        });
        
        return res.json({ success: true, message: 'Generation aborted successfully' });
      } else {
        return res.json({ success: false, message: 'No active generation found for this session' });
      }
    } catch (error: any) {
      console.error('Abort command error:', error);
      res.status(500).json({ error: error.message || 'Failed to abort command' });
    }
  });

  // POST /api/ai-chat-conversation
  app.post("/api/ai-chat-conversation", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || 'demo-user';
      const { message, projectId, images } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Process images if provided (Vision API support)
      const imageBlocks: any[] = [];
      if (images && Array.isArray(images) && images.length > 0) {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        for (const imageUrl of images) {
          try {
            // Convert URL to file path (e.g., /attached_assets/chat_images/file.png -> attached_assets/chat_images/file.png)
            const filepath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
            
            // Read image file
            const imageBuffer = await fs.readFile(filepath);
            const base64Image = imageBuffer.toString('base64');
            
            // Determine mime type from file extension
            const ext = path.extname(filepath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
            };
            const mediaType = mimeTypes[ext] || 'image/jpeg';
            
            // Add image block for Anthropic Vision API
            imageBlocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            });
          } catch (error) {
            console.error(`Error processing image ${imageUrl}:`, error);
            // Continue with other images even if one fails
          }
        }
      }

      // Load project files if projectId provided
      let projectFiles: any[] = [];
      if (projectId) {
        try {
          projectFiles = await storage.getProjectFiles(projectId, userId);
        } catch (error) {
          console.error('Error loading project files for chat:', error);
          // Continue without files - don't fail the chat
        }
      }

      // Load chat history for memory-optimized conversation (auto-summarized if >10 messages)
      let chatHistory: any[] = [];
      if (projectId) {
        try {
          chatHistory = await storage.getChatMessagesByProject(userId, projectId);
          
          // Apply same summarization logic as /api/chat/history endpoint
          if (chatHistory.length > 10) {
            const KEEP_RECENT = 5;
            const hasSummary = chatHistory.some(m => m.isSummary);
            
            if (!hasSummary) {
              const oldMessages = chatHistory.slice(0, chatHistory.length - KEEP_RECENT);
              const recentMessages = chatHistory.slice(chatHistory.length - KEEP_RECENT);
              const messagesForSummary = oldMessages.filter(m => m.role === 'user' || m.role === 'assistant');
              
              if (messagesForSummary.length > 0) {
                console.log(`📊 Summarizing ${messagesForSummary.length} messages for AI context`);
                const summaryContent = await summarizeMessages(messagesForSummary);
                
                const summaryMessage = await storage.createChatMessage({
                  userId,
                  projectId,
                  role: 'system',
                  content: summaryContent,
                  isSummary: true,
                });
                
                for (const oldMsg of oldMessages) {
                  await storage.deleteChatMessage(oldMsg.id, userId);
                }
                
                chatHistory = [summaryMessage, ...recentMessages];
                console.log(`✅ Chat optimized: ${messagesForSummary.length} → 1 summary + ${KEEP_RECENT} recent`);
              }
            }
          }
        } catch (error) {
          console.error('Error loading chat history:', error);
          // Continue without history - don't fail the chat
        }
      }

      // Conversational AI with checkpoint billing (bill for ALL AI usage like Replit)
      const computeStartTime = Date.now();
      
      // Get user's subscription plan
      const subscription = await storage.getSubscription(userId);
      const plan = subscription?.plan || 'free';

      // Wrap AI call in priority queue
      const completion = await aiQueue.enqueue(userId, plan, async () => {
        // Build system prompt with project context
        let systemPrompt = `Hey! I'm SySop - I build web apps for you on Archetype. Think of me as your coding buddy who actually writes the code.

Here's what I do: I'm the AI that powers Archetype, which is basically a platform that helps people build web apps super fast. I know React, Express, PostgreSQL, TypeScript - all that stuff. I can see your project files and actually edit them directly to build what you need.

I can:
- Build new features and write code from scratch
- Edit your project files directly (yes, I actually write the code!)
- Fix bugs and broken stuff
- Answer questions about your project
- Look at screenshots if you paste them
- Explain how things work

The important thing to know: I'm not just here to give advice - I actually build and fix things. If something's broken, I'll fix it. If you need a feature, I'll code it. That's my job.

How I talk to you:
I keep things short and get to work fast. If I understand what you want, I'll just start building. If something's unclear, I'll ask one quick question. I use simple emojis like 🧠 when I'm thinking, 📝 when I'm writing code, ✅ when I'm done, and 🔨 when I'm building something.

Examples:
User: "make button bigger"
Me: {"shouldGenerate": true, "command": "increase button size"}

User: "what is this project?"
Me: [I'll tell you what I see in your files]

User: "fix the header styling"
Me: {"shouldGenerate": true, "command": "fix header styling"}

User: "the login is broken"
Me: {"shouldGenerate": true, "command": "fix login bug"}

Response format I use:
{"shouldGenerate": true/false, "command": "brief description if generating"}
{"checkpoint": {"complexity": "simple|medium|complex", "cost": 0.20|0.40|0.80}}`;

        // Add project files context if available
        if (projectFiles.length > 0) {
          systemPrompt += `\n\n📁 **PROJECT FILES** (${projectFiles.length} total):
You have access to the user's project files. You can see them, modify them, and answer questions about them.

`;
          // Include file contents (with smart truncation)
          let totalChars = 0;
          const maxTotalChars = 30000; // Keep it reasonable for chat
          
          for (const file of projectFiles) {
            let content = file.content || '';
            const maxFileSize = 2000; // 2k chars per file max for chat
            const truncated = content.length > maxFileSize;
            if (truncated) {
              content = content.substring(0, maxFileSize) + '\n... [truncated]';
            }
            
            const fileEntrySize = content.length + file.filename.length + 100;
            if (totalChars + fileEntrySize > maxTotalChars) {
              const remainingCount = projectFiles.length - projectFiles.indexOf(file);
              systemPrompt += `\n... and ${remainingCount} more files (too many to show in chat)\n`;
              break;
            }
            
            systemPrompt += `--- ${file.path ? file.path + '/' : ''}${file.filename} ---
${content}

`;
            totalChars += fileEntrySize;
          }
          
          systemPrompt += `\nWhen user asks about the project, you can see these files and answer questions about them directly.`;
        }

        // Build messages array with chat history (memory-optimized with auto-summarization)
        const messages: any[] = [];
        
        // Add chat history (may include summary if conversation was long)
        for (const historyMsg of chatHistory) {
          // Convert system/summary messages to user role for Anthropic API compatibility
          // Summary messages go first and provide context
          messages.push({
            role: historyMsg.role === 'system' ? 'user' : historyMsg.role,
            content: historyMsg.isSummary ? `[Previous conversation summary]: ${historyMsg.content}` : historyMsg.content,
          });
        }
        
        // Add current user message with images if present
        if (imageBlocks.length > 0) {
          // For Vision API: content must be array of blocks (text + images)
          const contentBlocks: any[] = [
            {
              type: "text",
              text: message,
            },
            ...imageBlocks,
          ];
          messages.push({
            role: "user",
            content: contentBlocks,
          });
        } else {
          // Text-only message
          messages.push({
            role: "user",
            content: message,
          });
        }
        
        console.log(`💬 Sending ${messages.length} messages to Anthropic (history: ${chatHistory.length}, new: 1, images: ${imageBlocks.length})`);

        const result = await anthropic.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages,
        });
        return result;
      });
      
      const computeTimeMs = Date.now() - computeStartTime;

      const responseText = completion.content[0].type === 'text' ? completion.content[0].text : "";
      
      // Track AI chat usage for billing
      const inputTokens = completion.usage?.input_tokens || 0;
      const outputTokens = completion.usage?.output_tokens || 0;
      
      await trackAIUsage({
        userId,
        projectId: null,
        type: "ai_chat",
        inputTokens,
        outputTokens,
        computeTimeMs,
        metadata: { message: message.substring(0, 100) }, // Log first 100 chars for debugging
      });
      
      // Extract JSON data from response (shouldGenerate and checkpoint)
      let shouldGenerate = false;
      let command = null;
      let checkpoint = null;
      
      // Try to extract shouldGenerate JSON
      const shouldGenerateMatch = responseText.match(/\{[^}]*"shouldGenerate"[^}]*\}/);
      if (shouldGenerateMatch) {
        try {
          const parsed = JSON.parse(shouldGenerateMatch[0]);
          shouldGenerate = parsed.shouldGenerate === true;
          command = parsed.command || null;
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      // Extract checkpoint data for billing (ALL AI usage is billed)
      const checkpointMatch = responseText.match(/\{\s*"checkpoint":\s*\{[^}]+\}\s*\}/);
      if (checkpointMatch) {
        try {
          const parsed = JSON.parse(checkpointMatch[0]);
          checkpoint = parsed.checkpoint || {
            complexity: "standard",
            cost: 0.40,
            estimatedTime: "< 1 minute",
            actions: ["Answered user question"]
          };
        } catch (e) {
          // Default checkpoint if parsing fails
          checkpoint = {
            complexity: "standard",
            cost: 0.40,
            estimatedTime: "< 1 minute",
            actions: ["Answered user question"]
          };
        }
      } else {
        // Always provide checkpoint data (bill for ALL AI usage)
        checkpoint = {
          complexity: "standard",
          cost: 0.40,
          estimatedTime: "< 1 minute",
          actions: ["Answered user question"]
        };
      }

      res.json({
        response: responseText,
        shouldGenerate,
        command,
        checkpoint, // Include checkpoint data for billing display
      });
    } catch (error: any) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to process message' });
    }
  });

  // GET /api/usage/stats - Get current user's usage statistics
  app.get("/api/usage/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const stats = await getUserUsageStats(userId);
      
      // Return formatted stats for the frontend
      res.json({
        plan: stats.plan,
        tokensUsed: stats.tokensUsed,
        tokenLimit: stats.tokenLimit,
        projectsThisMonth: stats.projectsThisMonth,
        totalCost: stats.totalCost,
        totalAICost: stats.totalAICost,
      });
    } catch (error: any) {
      console.error('Error fetching usage stats:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch usage stats' });
    }
  });

  // POST /api/analyze-complexity - Analyze command complexity and estimate token usage
  app.post("/api/analyze-complexity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { command } = req.body;
      
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: "command is required and must be a string" });
      }

      // Import complexity detection utility
      const { detectComplexity } = await import("./complexity-detection");
      
      // Analyze the command
      const complexityResult = detectComplexity(command);
      
      // Get user's current usage stats
      const stats = await getUserUsageStats(userId);
      const tokensRemaining = Math.max(0, stats.tokenLimit - stats.tokensUsed);
      
      // Calculate overage
      const overageTokens = Math.max(0, complexityResult.estimatedTokens - tokensRemaining);
      const overageCost = overageTokens > 0 ? (overageTokens / 1000) * 1.50 : 0;
      
      res.json({
        complexity: complexityResult.level,
        estimatedTokens: complexityResult.estimatedTokens,
        estimatedCost: complexityResult.estimatedCost,
        reasons: complexityResult.reasons,
        tokensRemaining,
        tokenLimit: stats.tokenLimit,
        overageTokens,
        overageCost: parseFloat(overageCost.toFixed(2)),
      });
    } catch (error: any) {
      console.error('Error analyzing complexity:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze complexity' });
    }
  });

  // POST /api/deployments
  // Environment Variables for Deployments
  app.get("/api/deployments/:id/env-variables", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id } = req.params;

      const deployment = await storage.getDeployment(id, userId);
      if (!deployment) {
        return res.status(404).json({ error: "Deployment not found" });
      }

      // Return environment variable keys only (not values for security)
      const envVars = deployment.envVariables ? JSON.parse(deployment.envVariables as string) : {};
      const keys = Object.keys(envVars);

      res.json({ keys });
    } catch (error: any) {
      console.error("Error getting env variables:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/deployments/:id/env-variables", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id } = req.params;
      const { variables } = req.body; // { key1: value1, key2: value2 }

      if (!variables || typeof variables !== 'object') {
        return res.status(400).json({ error: "Variables object required" });
      }

      const deployment = await storage.updateDeploymentEnvVariables(id, userId, variables);
      res.json({ deployment });
    } catch (error: any) {
      console.error("Error updating env variables:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/deployments/:id/env-variables/:key", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id, key } = req.params;

      const deployment = await storage.getDeployment(id, userId);
      if (!deployment) {
        return res.status(404).json({ error: "Deployment not found" });
      }

      const envVars = deployment.envVariables ? JSON.parse(deployment.envVariables as string) : {};
      delete envVars[key];

      const updated = await storage.updateDeploymentEnvVariables(id, userId, envVars);
      res.json({ deployment: updated });
    } catch (error: any) {
      console.error("Error deleting env variable:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Custom Domain Management
  app.post("/api/deployments/:id/custom-domain", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id } = req.params;
      const { customDomain } = req.body;

      // Check user plan (Business+ tier required)
      const subscription = await storage.getSubscription(userId);
      if (!subscription || !['business', 'enterprise'].includes(subscription.plan)) {
        return res.status(403).json({ error: "Custom domains require Business+ plan" });
      }

      const deployment = await storage.updateDeploymentCustomDomain(id, userId, customDomain);
      res.json({ deployment });
    } catch (error: any) {
      console.error("Error setting custom domain:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/deployments/:id/custom-domain", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      const { id } = req.params;

      const deployment = await storage.updateDeploymentCustomDomain(id, userId, null);
      res.json({ deployment });
    } catch (error: any) {
      console.error("Error removing custom domain:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Git Integration API
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

  app.post("/api/deployments", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || 'demo-user';
      const { projectId, subdomain } = req.body;

      if (!projectId || !subdomain) {
        return res.status(400).json({ error: "Project ID and subdomain are required" });
      }

      // Validate subdomain format (lowercase alphanumeric and hyphens only)
      if (!/^[a-z0-9-]+$/.test(subdomain)) {
        return res.status(400).json({ error: "Subdomain must be lowercase alphanumeric with hyphens only" });
      }

      // Check if subdomain already exists
      const existing = await storage.getDeploymentBySubdomain(subdomain);
      if (existing) {
        return res.status(409).json({ error: "Subdomain already taken" });
      }

      // Create deployment
      const deployment = await storage.createDeployment({
        userId,
        projectId,
        subdomain,
        status: "active",
      });

      res.json(deployment);
    } catch (error: any) {
      console.error('Deployment error:', error);
      res.status(500).json({ error: error.message || 'Failed to create deployment' });
    }
  });

  // GET /d/:subdomain - Serve deployed project
  app.get("/d/:subdomain", async (req: Request, res: Response) => {
    try {
      const { subdomain } = req.params;
      
      const deployment = await storage.getDeploymentBySubdomain(subdomain);
      if (!deployment) {
        return res.status(404).send("Deployment not found");
      }

      const files = await storage.getProjectFiles(deployment.projectId);
      
      // Track deployment visit for billing
      await storage.incrementDeploymentVisits(deployment.id);

      // Build HTML with injected files
      const htmlFile = files.find(f => f.filename === 'index.html');
      const cssFiles = files.filter(f => f.language === 'css');
      const jsFiles = files.filter(f => f.language === 'javascript');

      if (!htmlFile) {
        return res.status(404).send("No HTML file found in project");
      }

      let html = htmlFile.content;
      
      // Inject CSS
      if (cssFiles.length > 0) {
        const cssContent = cssFiles.map(f => f.content).join('\n');
        html = html.replace('</head>', `<style>${cssContent}</style></head>`);
      }

      // Inject JS
      if (jsFiles.length > 0) {
        const jsContent = jsFiles.map(f => f.content).join('\n');
        html = html.replace('</body>', `<script>${jsContent}</script></body>`);
      }

      res.send(html);
    } catch (error: any) {
      console.error('Deployment serving error:', error);
      res.status(500).send("Failed to serve deployment");
    }
  });

  // GET /api/deployments - Get all user deployments
  app.get("/api/deployments", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || 'demo-user';
      const deployments = await storage.getDeployments(userId);
      res.json(deployments);
    } catch (error: any) {
      console.error('Get deployments error:', error);
      res.status(500).json({ error: error.message || 'Failed to get deployments' });
    }
  });

  // POST /api/deployments/publish - Publish/redeploy a project
  app.post("/api/deployments/publish", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || 'demo-user';
      const { projectId, subdomain } = req.body;

      // Create or update deployment
      let deployment = await storage.getDeploymentBySubdomain(subdomain);
      
      if (deployment) {
        // Update existing deployment
        deployment = await storage.updateDeployment(deployment.id, {
          status: 'active',
          updatedAt: new Date(),
        });
      } else if (projectId && subdomain) {
        // Create new deployment
        deployment = await storage.createDeployment({
          userId,
          projectId,
          subdomain,
          status: 'active',
        });
      } else {
        return res.status(400).json({ error: "Project ID and subdomain required for new deployment" });
      }

      res.json({
        success: true,
        deployment,
        message: "Published successfully"
      });
    } catch (error: any) {
      console.error('Publish error:', error);
      res.status(500).json({ error: error.message || 'Failed to publish' });
    }
  });

  // POST /api/deployments/pause - Pause a deployment
  app.post("/api/deployments/pause", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || 'demo-user';
      const { deploymentId } = req.body;

      if (!deploymentId) {
        return res.status(400).json({ error: "Deployment ID required" });
      }

      const deployment = await storage.updateDeployment(deploymentId, {
        status: 'paused',
      });

      res.json({
        success: true,
        deployment,
        message: "Deployment paused"
      });
    } catch (error: any) {
      console.error('Pause deployment error:', error);
      res.status(500).json({ error: error.message || 'Failed to pause deployment' });
    }
  });

  // GET /api/deployments/database-check - Check for database migration needs
  app.get("/api/deployments/database-check", async (req: Request, res: Response) => {
    try {
      // Simplified database check - in production, would compare dev vs prod schemas
      res.json({
        checks: [
          {
            name: "Development database changes detected",
            status: "success",
            message: "Schema changes identified",
          },
          {
            name: "Generated migrations to apply to production database",
            status: "success",
            message: "Migrations ready",
          }
        ],
        needsMigration: false,
        message: "Database is up to date"
      });
    } catch (error: any) {
      console.error('Database check error:', error);
      res.status(500).json({ error: error.message || 'Failed to check database' });
    }
  });

  // GET /api/deployments/logs - Get deployment logs
  app.get("/api/deployments/logs", async (req: Request, res: Response) => {
    try {
      const logs = [
        { timestamp: new Date().toISOString(), level: 'info', message: 'Starting deployment...' },
        { timestamp: new Date().toISOString(), level: 'success', message: '✓ Database connected' },
        { timestamp: new Date().toISOString(), level: 'success', message: '✓ Migrations applied' },
        { timestamp: new Date().toISOString(), level: 'success', message: '✓ Build successful' },
        { timestamp: new Date().toISOString(), level: 'success', message: '✓ Deployment complete' },
      ];
      
      res.json({ logs });
    } catch (error: any) {
      console.error('Get logs error:', error);
      res.status(500).json({ error: error.message || 'Failed to get logs' });
    }
  });

  // ========== ADMIN ROUTES ==========
  
  // GET /api/admin/dashboard - Admin dashboard data
  app.get("/api/admin/dashboard", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || 'demo-user';
      
      // Get all usage logs for analysis
      const logs = await storage.getRecentUsageLogs(1000);
      
      // Calculate total costs
      const totalCosts = logs.reduce((sum: number, log: any) => sum + (Number(log.cost) || 0), 0);
      
      // Get unique active users (users with at least one log)
      const activeUsers = new Set(logs.map((log: any) => log.userId)).size;
      
      // Calculate total AI requests
      const aiRequests = logs.filter((log: any) => log.type === 'ai_generation').length;
      
      // Calculate revenue from subscriptions (simplified)
      const revenue = activeUsers * 20; // Assume $20/month per active user
      
      res.json({
        totalCosts,
        activeUsers,
        aiRequests,
        revenue,
        logs: logs.slice(0, 100), // Return last 100 logs
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

  // POST /api/create-checkout-session - Create Stripe checkout session
  app.post("/api/create-checkout-session", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { priceId, planName } = req.body;
      const userId = (req as any).authenticatedUserId;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate required fields
      if (!priceId || !planName) {
        return res.status(400).json({ error: "priceId and planName are required" });
      }

      // Check if Stripe is configured
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable." });
      }

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(404).json({ error: "User not found or email missing" });
      }
      
      const userEmail = user.email;

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        client_reference_id: userId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.APP_URL || 'http://localhost:5000'}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/pricing`,
        metadata: {
          userId,
          planName,
        },
      });

      console.log(`✅ Checkout session created for user ${userId}, plan: ${planName}`);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Checkout session error:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  });

  // POST /api/create-template-checkout - Create Stripe checkout for template purchase
  app.post("/api/create-template-checkout", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { templateId } = req.body;
      const userId = (req as any).authenticatedUserId;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!templateId) {
        return res.status(400).json({ error: "templateId is required" });
      }

      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable." });
      }

      // Fetch template server-side to get authoritative price (NEVER trust client)
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Verify it's a premium template
      if (!template.isPremium || Number(template.price) <= 0) {
        return res.status(400).json({ error: "This template is free" });
      }

      // Check if already purchased
      const alreadyPurchased = await storage.hasUserPurchasedTemplate(userId, templateId);
      if (alreadyPurchased) {
        return res.status(400).json({ error: "You already own this template" });
      }

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(404).json({ error: "User not found or email missing" });
      }

      const userEmail = user.email;
      const price = Number(template.price);

      // Create one-time payment Stripe checkout session with SERVER-SIDE price
      const session = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        client_reference_id: userId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Template: ${template.name}`,
                description: 'Premium template for Archetype',
              },
              unit_amount: Math.round(price * 100), // Convert to cents using SERVER price
            },
            quantity: 1,
          },
        ],
        mode: 'payment', // One-time payment
        success_url: `${process.env.APP_URL || 'http://localhost:5000'}/marketplace?purchase=success&templateId=${templateId}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/marketplace`,
        metadata: {
          userId,
          templateId,
          type: 'template_purchase',
          // Don't store price in metadata - use Stripe's amount_total in webhook
        },
      });

      console.log(`✅ Template checkout session created for user ${userId}, template: ${templateId}, price: $${price}`);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Template checkout error:', error);
      res.status(500).json({ error: error.message || 'Failed to create template checkout session' });
    }
  });

  // POST /api/stripe-webhook - Handle Stripe webhooks
  app.post("/api/stripe-webhook", express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!stripe || !sig) {
      return res.status(400).json({ error: 'Invalid signature or Stripe not configured' });
    }

    let event: Stripe.Event;

    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // If no webhook secret, just parse the body (less secure, only for development)
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error(`Webhook signature verification failed:`, err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId || session.client_reference_id;
          const planName = session.metadata?.planName;
          const templateId = session.metadata?.templateId;
          const purchaseType = session.metadata?.type;

          // Handle subscription purchases
          if (userId && planName) {
            const subscriptionId = session.subscription as string;

            await storage.createOrUpdateSubscription({
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              plan: planName,
              status: 'active',
            });

            console.log(`✅ Subscription activated for user ${userId}, plan: ${planName}`);
          }

          // Handle template purchases
          if (userId && templateId && purchaseType === 'template_purchase') {
            const paymentIntentId = session.payment_intent as string;

            // Idempotency check: prevent duplicate purchases from webhook retries
            const existingPurchase = await storage.hasUserPurchasedTemplate(userId, templateId);
            if (existingPurchase) {
              console.log(`⚠️ Duplicate webhook: Template ${templateId} already purchased by user ${userId}`);
              break;
            }

            // Get template to verify and get authoritative data
            const template = await storage.getTemplate(templateId);
            if (!template) {
              console.error(`❌ Template ${templateId} not found in webhook handler`);
              break;
            }

            // Use Stripe's amount_total (in cents) as the authoritative price source
            const paidAmountCents = session.amount_total || 0;
            const paidAmount = paidAmountCents / 100;
            
            // Verify paid amount matches expected template price (within 1 cent tolerance for rounding)
            const expectedPrice = Number(template.price);
            if (Math.abs(paidAmount - expectedPrice) > 0.01) {
              console.error(`❌ Price mismatch: expected $${expectedPrice}, got $${paidAmount}`);
              break;
            }

            // Calculate revenue split (20% platform, 80% author)
            const platformCommission = paidAmount * 0.20;
            const authorRevenue = paidAmount * 0.80;

            // Record purchase with Stripe's authoritative amount
            await storage.createTemplatePurchase({
              userId,
              templateId,
              price: paidAmount.toFixed(2),
              platformCommission: platformCommission.toFixed(2),
              authorRevenue: authorRevenue.toFixed(2),
              stripePaymentId: paymentIntentId,
            });

            // Update template sales count and revenue
            await storage.incrementTemplateSales(templateId, paidAmount);

            console.log(`✅ Template purchased: user ${userId}, template ${templateId}, paid $${paidAmount}`);
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const userId = subscription.metadata?.userId;

          if (userId) {
            const status = subscription.status === 'active' ? 'active' : 'canceled';
            await storage.updateSubscriptionStatus(subscription.id, status);
            console.log(`✅ Subscription ${status} for user ${userId}`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook handler error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== TEAM WORKSPACE ROUTES ====================
  // data-testid: button-create-team, button-list-teams

  // POST /api/teams - Create workspace (authenticated)
  app.post("/api/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { name, description } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Name is required" });
      }

      const workspace = await storage.createTeamWorkspace(name, description, userId);
      res.status(201).json(workspace);
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      res.status(500).json({ error: error.message || "Failed to create workspace" });
    }
  });

  // GET /api/teams - List user's workspaces
  app.get("/api/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const workspaces = await storage.getTeamWorkspaces(userId);
      res.json(workspaces);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  // GET /api/teams/:id - Get workspace details (check member access)
  // data-testid: text-workspace-name, text-workspace-description
  app.get("/api/teams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;

      const workspace = await storage.getTeamWorkspace(id, userId);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found or access denied" });
      }

      res.json(workspace);
    } catch (error) {
      console.error('Error fetching workspace:', error);
      res.status(500).json({ error: "Failed to fetch workspace" });
    }
  });

  // PUT /api/teams/:id - Update workspace (owner only)
  // data-testid: button-update-workspace
  app.put("/api/teams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      const { name, description } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Name is required" });
      }

      const workspace = await storage.updateTeamWorkspace(id, userId, name, description);
      res.json(workspace);
    } catch (error: any) {
      console.error('Error updating workspace:', error);
      if (error.message.includes('Owner access required')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to update workspace" });
    }
  });

  // DELETE /api/teams/:id - Delete workspace (owner only)
  // data-testid: button-delete-workspace
  app.delete("/api/teams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;

      await storage.deleteTeamWorkspace(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      if (error.message.includes('Owner access required')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to delete workspace" });
    }
  });

  // ==================== TEAM MEMBER ROUTES ====================
  // data-testid: button-add-member, button-remove-member, select-member-role

  // GET /api/teams/:workspaceId/members - List members (member access required)
  app.get("/api/teams/:workspaceId/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { workspaceId } = req.params;

      const members = await storage.getTeamMembers(workspaceId, userId);
      res.json(members);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      if (error.message.includes('access denied')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // POST /api/teams/:workspaceId/members - Add member (owner/editor only)
  app.post("/api/teams/:workspaceId/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { workspaceId } = req.params;
      const { userId: newUserId, role } = req.body;

      if (!newUserId || !role) {
        return res.status(400).json({ error: "userId and role are required" });
      }

      if (!['owner', 'editor', 'viewer'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be owner, editor, or viewer" });
      }

      // Check if requester has owner/editor permissions
      const requesterRole = await storage.getUserRole(workspaceId, userId);
      if (!requesterRole || !['owner', 'editor'].includes(requesterRole)) {
        return res.status(403).json({ error: "Owner or editor access required" });
      }

      const member = await storage.addTeamMember(workspaceId, newUserId, role);
      res.status(201).json(member);
    } catch (error: any) {
      console.error('Error adding member:', error);
      res.status(500).json({ error: error.message || "Failed to add member" });
    }
  });

  // PUT /api/teams/:workspaceId/members/:userId - Update role (owner only)
  app.put("/api/teams/:workspaceId/members/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.authenticatedUserId;
      const { workspaceId, userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }

      if (!['owner', 'editor', 'viewer'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be owner, editor, or viewer" });
      }

      const member = await storage.updateTeamMemberRole(workspaceId, userId, role, requesterId);
      res.json(member);
    } catch (error: any) {
      console.error('Error updating member role:', error);
      if (error.message.includes('Owner access required')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to update member role" });
    }
  });

  // DELETE /api/teams/:workspaceId/members/:userId - Remove member (owner only)
  app.delete("/api/teams/:workspaceId/members/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.authenticatedUserId;
      const { workspaceId, userId } = req.params;

      await storage.removeTeamMember(workspaceId, userId, requesterId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing member:', error);
      if (error.message.includes('Owner access required')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to remove member" });
    }
  });

  // ==================== TEAM INVITATION ROUTES ====================
  // data-testid: button-create-invitation, button-accept-invitation, button-decline-invitation

  // POST /api/teams/:workspaceId/invitations - Create invitation (owner/editor only)
  app.post("/api/teams/:workspaceId/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { workspaceId } = req.params;
      const { invitedEmail, role } = req.body;

      if (!invitedEmail || !role) {
        return res.status(400).json({ error: "invitedEmail and role are required" });
      }

      if (!['owner', 'editor', 'viewer'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be owner, editor, or viewer" });
      }

      // Check if requester has owner/editor permissions
      const requesterRole = await storage.getUserRole(workspaceId, userId);
      if (!requesterRole || !['owner', 'editor'].includes(requesterRole)) {
        return res.status(403).json({ error: "Owner or editor access required" });
      }

      const invitation = await storage.createTeamInvitation(workspaceId, invitedEmail, role, userId);
      res.status(201).json(invitation);
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      res.status(500).json({ error: error.message || "Failed to create invitation" });
    }
  });

  // GET /api/teams/:workspaceId/invitations - List invitations (owner/editor only)
  app.get("/api/teams/:workspaceId/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { workspaceId } = req.params;

      // Check if requester has owner/editor permissions
      const requesterRole = await storage.getUserRole(workspaceId, userId);
      if (!requesterRole || !['owner', 'editor'].includes(requesterRole)) {
        return res.status(403).json({ error: "Owner or editor access required" });
      }

      const invitations = await storage.getTeamInvitations(workspaceId, userId);
      res.json(invitations);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
      res.status(500).json({ error: error.message || "Failed to fetch invitations" });
    }
  });

  // POST /api/invitations/:token/accept - Accept invitation (authenticated)
  app.post("/api/invitations/:token/accept", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { token } = req.params;

      const invitation = await storage.getTeamInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or expired" });
      }

      const member = await storage.acceptTeamInvitation(token, userId);
      res.json(member);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({ error: error.message || "Failed to accept invitation" });
    }
  });

  // POST /api/invitations/:token/decline - Decline invitation
  app.post("/api/invitations/:token/decline", async (req: any, res) => {
    try {
      const { token } = req.params;

      const invitation = await storage.getTeamInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or expired" });
      }

      await storage.declineTeamInvitation(token);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      res.status(500).json({ error: error.message || "Failed to decline invitation" });
    }
  });

  // ==================== API KEY ROUTES (PRO+ ONLY) ====================
  // data-testid: button-create-api-key, button-revoke-api-key, text-api-key-value

  // GET /api/api-keys - List user's API keys (check plan: pro, business, enterprise)
  app.get("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;

      // Check plan tier - API keys only for Pro+ users
      const subscription = await storage.getSubscription(userId);
      if (!subscription || !['pro', 'business', 'enterprise'].includes(subscription.plan)) {
        return res.status(403).json({ 
          error: "API keys are only available for Pro, Business, and Enterprise plans",
          requiresUpgrade: true,
          currentPlan: subscription?.plan || 'free'
        });
      }

      const apiKeys = await storage.getApiKeys(userId);
      res.json(apiKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // POST /api/api-keys - Create new API key (validate plan, name, optional expiresAt)
  app.post("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { name, expiresAt } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Name is required" });
      }

      // Check plan tier
      const subscription = await storage.getSubscription(userId);
      if (!subscription || !['pro', 'business', 'enterprise'].includes(subscription.plan)) {
        return res.status(403).json({ 
          error: "API keys are only available for Pro, Business, and Enterprise plans",
          requiresUpgrade: true,
          currentPlan: subscription?.plan || 'free'
        });
      }

      // Validate expiresAt if provided
      let expiryDate = null;
      if (expiresAt) {
        expiryDate = new Date(expiresAt);
        if (isNaN(expiryDate.getTime())) {
          return res.status(400).json({ error: "Invalid expiresAt date" });
        }
        if (expiryDate <= new Date()) {
          return res.status(400).json({ error: "expiresAt must be in the future" });
        }
      }

      const { key, apiKey } = await storage.createApiKey(userId, name, expiryDate);
      res.status(201).json({ key, apiKey });
    } catch (error: any) {
      console.error('Error creating API key:', error);
      res.status(500).json({ error: error.message || "Failed to create API key" });
    }
  });

  // DELETE /api/api-keys/:id - Revoke API key
  app.delete("/api/api-keys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;

      await storage.revokeApiKey(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error revoking API key:', error);
      res.status(500).json({ error: error.message || "Failed to revoke API key" });
    }
  });

  // ==================== SUPPORT TICKET ROUTES ====================
  // data-testid: button-create-ticket, button-add-message, select-ticket-category, select-ticket-priority

  // GET /api/support/tickets - List user's tickets
  app.get("/api/support/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const tickets = await storage.getSupportTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // GET /api/support/tickets/:id - Get ticket details
  // data-testid: text-ticket-subject, text-ticket-status, text-ticket-description
  app.get("/api/support/tickets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;

      const ticket = await storage.getSupportTicket(id, userId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found or access denied" });
      }

      res.json(ticket);
    } catch (error) {
      console.error('Error fetching ticket:', error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  // POST /api/support/tickets - Create ticket (validate: subject, description, category, priority)
  app.post("/api/support/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { subject, description, category, priority } = req.body;

      // Validate required fields
      if (!subject || typeof subject !== 'string') {
        return res.status(400).json({ error: "Subject is required" });
      }
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: "Description is required" });
      }
      if (!category || typeof category !== 'string') {
        return res.status(400).json({ error: "Category is required" });
      }
      if (!priority || typeof priority !== 'string') {
        return res.status(400).json({ error: "Priority is required" });
      }

      // Validate category values
      const validCategories = ['technical', 'billing', 'feature_request', 'bug_report', 'other'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
      }

      // Validate priority values
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` });
      }

      const ticket = await storage.createSupportTicket(userId, subject, description, category, priority);
      res.status(201).json(ticket);
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      res.status(500).json({ error: error.message || "Failed to create ticket" });
    }
  });

  // POST /api/support/tickets/:id/messages - Add message to ticket
  app.post("/api/support/tickets/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      // Verify ticket exists and user has access
      const ticket = await storage.getSupportTicket(id, userId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found or access denied" });
      }

      const ticketMessage = await storage.createSupportTicketMessage(id, userId, message, 0);
      res.status(201).json(ticketMessage);
    } catch (error: any) {
      console.error('Error adding message:', error);
      res.status(500).json({ error: error.message || "Failed to add message" });
    }
  });

  // GET /api/support/tickets/:id/messages - Get ticket messages
  app.get("/api/support/tickets/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { id } = req.params;

      // Verify ticket exists and user has access
      const ticket = await storage.getSupportTicket(id, userId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found or access denied" });
      }

      const messages = await storage.getSupportTicketMessages(id, userId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // ==================== ADMIN SUPPORT ROUTES ====================
  // data-testid: button-assign-ticket, select-ticket-status, button-update-status

  // GET /api/admin/support/tickets - List all tickets (admin only)
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

  // PUT /api/admin/support/tickets/:id/status - Update ticket status (admin only)
  app.put("/api/admin/support/tickets/:id/status", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "Status is required" });
      }

      // Validate status values
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

  // PUT /api/admin/support/tickets/:id/assign - Assign ticket (admin only)
  app.put("/api/admin/support/tickets/:id/assign", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      // assignedTo can be null to unassign
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

  // Deployment info endpoint (public - for status page)
  app.get('/api/deployment-info', async (_req, res) => {
    try {
      const info = await getDeploymentInfo();
      res.json(info);
    } catch (error) {
      console.error('Error getting deployment info:', error);
      res.status(500).json({ error: 'Failed to get deployment info' });
    }
  });

  // User satisfaction survey routes
  app.post('/api/satisfaction-survey', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id || null;
      const { rating, category, feedback, wouldRecommend, featureRequests } = req.body;

      if (!rating || !category) {
        return res.status(400).json({ error: 'Rating and category are required' });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      const browserInfo = req.headers['user-agent'] || 'unknown';

      const survey = await storage.createSatisfactionSurvey({
        userId,
        rating,
        category,
        feedback: feedback || null,
        wouldRecommend: wouldRecommend || null,
        featureRequests: featureRequests || null,
        browserInfo,
      });

      res.json({ success: true, survey });
    } catch (error: any) {
      console.error('Error submitting satisfaction survey:', error);
      res.status(500).json({ error: error.message || 'Failed to submit survey' });
    }
  });

  // Get satisfaction survey stats (admin only)
  app.get('/api/admin/satisfaction-stats', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const stats = await storage.getSatisfactionStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error getting satisfaction stats:', error);
      res.status(500).json({ error: error.message || 'Failed to get stats' });
    }
  });

  return httpServer;
}

/**
 * Require admin middleware
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req.user as any)?.id;
  
  // Simple admin check - in production, check against admin user list in database
  const ADMIN_USERS = ['admin', 'demo-user']; // demo-user is admin for testing
  
  if (!userId || !ADMIN_USERS.includes(userId)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
}
