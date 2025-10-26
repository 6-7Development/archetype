import type { Express } from "express";
import type { Server } from "http";
import { db } from "./db";
import { files } from "@shared/schema";
import { setupAuth } from "./universalAuth";
import { FEATURES } from "./routes/common";
import toolsRouter from './routes/tools';
import uploadRouter from './routes/upload';
import platformRouter from './platformRoutes';
import metaSySopChatRouter from './routes/metaSysopChat';
import { getDeploymentInfo } from './deploymentInfo';
import { storage } from "./storage";

// Import route registration functions
import { registerAuthRoutes } from "./routes/auth";
import { registerProjectRoutes } from "./routes/projects";
import { registerFileRoutes } from "./routes/files";
import { registerChatRoutes } from "./routes/chat";
import { registerSubscriptionRoutes } from "./routes/subscriptions";
import { registerAdminRoutes } from "./routes/admin";
import { registerOwnerSetupRoutes } from "./routes/owner-setup";
import { setupWebSocket } from "./routes/websocket";

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== HEALTH & DIAGNOSTICS ====================
  
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

  // Deployment info endpoint (public - for status page)
  // CRITICAL: Disable caching to prevent 304 responses that break JSON parsing
  app.get('/api/deployment-info', async (_req, res) => {
    try {
      const info = await getDeploymentInfo();
      // Prevent 304 Not Modified responses
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(info);
    } catch (error) {
      console.error('Error getting deployment info:', error);
      res.status(500).json({ error: 'Failed to get deployment info' });
    }
  });

  // User satisfaction survey routes (public)
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

  // ==================== AUTHENTICATION SETUP ====================
  
  // Setup OAuth authentication (must be before routes)
  await setupAuth(app);

  // ==================== WEBSOCKET SETUP ====================
  
  // Setup WebSocket server and get httpServer + wss
  const { httpServer, wss } = setupWebSocket(app);

  // ==================== REGISTER ROUTE MODULES ====================
  
  // Register all route modules with dependencies
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerOwnerSetupRoutes(app);
  registerSubscriptionRoutes(app);
  registerProjectRoutes(app);
  registerFileRoutes(app);
  registerChatRoutes(app, { wss });

  // ==================== MOUNT EXISTING ROUTERS ====================
  
  // Mount tools router (browser_test, web_search, vision_analyze)
  app.use('/api/tools', toolsRouter);
  
  // Mount upload router (file uploads)
  app.use('/api', uploadRouter);
  
  // Mount platform router (platform self-healing)
  app.use('/api/platform', platformRouter);
  
  // Mount Meta-SySop chat router (chat-based platform healing)
  app.use('/api/platform/chat', metaSySopChatRouter);

  // ==================== REPLIT AGENT-STYLE FEATURES ====================
  
  // Import new feature routers
  const taskRunnerRouter = await import('./routes/taskRunner');
  const messageQueueRouter = await import('./routes/messageQueue');
  const autonomySettingsRouter = await import('./routes/autonomySettings');
  const imageGenerationRouter = await import('./routes/imageGeneration');
  const dynamicIntelligenceRouter = await import('./routes/dynamicIntelligence');
  
  // Mount feature routers
  app.use('/api/task-runners', taskRunnerRouter.default);
  app.use('/api/message-queue', messageQueueRouter.default);
  app.use('/api/autonomy', autonomySettingsRouter.default);
  app.use('/api/image-generation', imageGenerationRouter.default);
  app.use('/api/dynamic-intelligence', dynamicIntelligenceRouter.default);

  // ==================== SUPPORT TICKET ROUTES ====================
  
  // GET /api/support/tickets - List user's tickets
  app.get("/api/support/tickets", async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const tickets = await storage.getSupportTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // GET /api/support/tickets/:id - Get ticket details
  app.get("/api/support/tickets/:id", async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
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

  // POST /api/support/tickets - Create ticket
  app.post("/api/support/tickets", async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { subject, description, category, priority } = req.body;

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

      const validCategories = ['technical', 'billing', 'feature_request', 'bug_report', 'other'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
      }

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
  app.post("/api/support/tickets/:id/messages", async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { id } = req.params;
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

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
  app.get("/api/support/tickets/:id/messages", async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { id } = req.params;

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

  console.log('✅ All routes registered successfully');
  
  return httpServer;
}
