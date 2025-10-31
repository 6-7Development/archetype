import type { Express } from "express";
import type { Server } from "http";
import { db } from "./db";
import { files } from "@shared/schema";
import { setupAuth } from "./universalAuth";
import { FEATURES } from "./routes/common";
import toolsRouter from './routes/tools';
import uploadRouter from './routes/upload';
import platformRouter from './platformRoutes';
import lomuAIChatRouter from './routes/lomuChat';
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
  // Ultra-simple for Railway - just return 200 OK immediately
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
  
  // Wire WebSocket server to session manager for platform healing
  const { sessionManager } = await import('./platformHealingSession');
  sessionManager.setWebSocketServer(wss);
  console.log('[PLATFORM-HEALING] Session manager connected to WebSocket');
  
  // Wire WebSocket server to platform healing service for preview broadcasts
  const { platformHealing } = await import('./platformHealing');
  platformHealing.setWebSocketServer(wss);
  console.log('[PLATFORM-HEALING] Platform healing service connected to WebSocket');
  
  // Initialize platform metrics broadcaster
  const { PlatformMetricsBroadcaster } = await import('./services/platformMetricsBroadcaster');
  const metricsBroadcaster = new PlatformMetricsBroadcaster(wss);
  metricsBroadcaster.start();
  
  // Connect heal orchestrator to metrics broadcaster for healing event notifications
  const { healOrchestrator } = await import('./services/healOrchestrator');
  healOrchestrator.setBroadcaster(metricsBroadcaster);

  // Initialize LomuAI job manager with WebSocket support
  const { initializeJobManager } = await import('./services/lomuJobManager');
  initializeJobManager(wss);
  console.log('[LOMU-AI-JOB-MANAGER] Job manager connected to WebSocket');

  // Initialize LomuAI chat with WebSocket for live preview
  const { initializeLomuAIWebSocket } = await import('./routes/lomuChat');
  initializeLomuAIWebSocket(wss);
  console.log('[LOMU-AI-CHAT] Live preview WebSocket initialized');

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
  
  // Mount LomuAI chat router (chat-based platform healing)
  app.use('/api/lomuai', lomuAIChatRouter);

  // ==================== PLATFORM PREVIEW ROUTES ====================
  
  // Import preview builder service
  const { 
    getPreviewManifest, 
    servePreviewFile,
    getCacheStats 
  } = await import('./services/platformPreviewBuilder');
  
  // Import rate limiting
  const rateLimit = (await import('express-rate-limit')).default;
  
  // Import JWT for signed tokens
  const { SignJWT, jwtVerify } = await import('jose');
  
  // Rate limiter for preview builds (max 10 builds/min per admin session)
  const previewBuildLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Max 10 builds per minute
    message: 'Too many preview builds. Please wait before building again.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => {
      // Rate limit per session ID or user ID
      return req.params.sessionId || req.session?.claims?.sub || 'anonymous';
    },
  });

  // JWT secret for signed session tokens
  const JWT_SECRET = new TextEncoder().encode(
    process.env.SESSION_SECRET || 'fallback-preview-secret-key'
  );

  // Helper: Sign session token (valid for 10 minutes)
  async function signSessionToken(sessionId: string, userId: string): Promise<string> {
    const token = await new SignJWT({ sessionId, userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(JWT_SECRET);
    return token;
  }

  // Helper: Verify session token
  async function verifySessionToken(token: string): Promise<{ sessionId: string; userId: string } | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      return {
        sessionId: payload.sessionId as string,
        userId: payload.userId as string,
      };
    } catch (error) {
      console.error('[PREVIEW] Token verification failed:', error);
      return null;
    }
  }

  // GET /api/platform-preview/:sessionId - Get preview manifest and metadata
  app.get('/api/platform-preview/:sessionId', previewBuildLimiter, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { sessionId } = req.params;
      
      // Validate session token (if provided)
      const token = req.query.token || req.headers['x-preview-token'];
      if (token) {
        const verified = await verifySessionToken(token as string);
        if (!verified || verified.sessionId !== sessionId) {
          return res.status(403).json({ error: 'Invalid session token' });
        }
      }

      // Get manifest from builder
      const manifest = getPreviewManifest(sessionId);
      
      if (!manifest) {
        return res.status(404).json({ error: 'Preview session not found or expired' });
      }

      // Generate signed token for accessing preview assets
      const signedToken = await signSessionToken(sessionId, userId);

      res.json({
        ...manifest,
        previewUrl: `/platform-preview/${sessionId}/index.html?token=${signedToken}`,
        token: signedToken,
      });
    } catch (error: any) {
      console.error('[PREVIEW] Error fetching manifest:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch preview manifest' });
    }
  });

  // GET /platform-preview/:sessionId/* - Serve preview assets with CSP headers
  app.get('/platform-preview/:sessionId/*', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const filePath = req.params[0] || 'index.html';
      
      // Verify session token
      const token = req.query.token || req.headers['x-preview-token'];
      if (!token) {
        return res.status(401).json({ error: 'Preview token required' });
      }

      const verified = await verifySessionToken(token as string);
      if (!verified || verified.sessionId !== sessionId) {
        return res.status(403).json({ error: 'Invalid session token' });
      }

      // Serve file from preview builder
      const file = await servePreviewFile(sessionId, filePath);
      
      if (!file) {
        return res.status(404).send('File not found');
      }

      // Security: Add strict CSP headers
      res.setHeader('Content-Security-Policy', [
        "default-src 'none'",
        "script-src 'self' blob: 'unsafe-inline'", // Allow inline for bundled code
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; '));
      
      // Prevent cookies in preview
      res.setHeader('Set-Cookie', 'preview=isolated; Max-Age=0; SameSite=Strict');
      
      // Cache control (5 min TTL)
      res.setHeader('Cache-Control', 'public, max-age=300');
      
      // Set MIME type
      res.setHeader('Content-Type', file.mimeType);
      
      // Send file
      res.send(file.content);
    } catch (error: any) {
      console.error('[PREVIEW] Error serving file:', error);
      res.status(500).json({ error: error.message || 'Failed to serve preview file' });
    }
  });

  // GET /api/platform-preview/stats - Get cache statistics (admin only)
  app.get('/api/platform-preview/stats', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is admin
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const stats = getCacheStats();
      res.json(stats);
    } catch (error: any) {
      console.error('[PREVIEW] Error fetching stats:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cache stats' });
    }
  });

  // ==================== REPLIT AGENT-STYLE FEATURES ====================
  
  // Import Replit Agent feature routers (Wave 1)
  const taskRunnerRouter = await import('./routes/taskRunner');
  const messageQueueRouter = await import('./routes/messageQueue');
  const autonomySettingsRouter = await import('./routes/autonomySettings');
  const imageGenerationRouter = await import('./routes/imageGeneration');
  const dynamicIntelligenceRouter = await import('./routes/dynamicIntelligence');
  
  // Import Replit Agent feature routers (Wave 2 - 6 Missing Features)
  const planModeRouter = await import('./routes/planMode');
  const designPrototypeRouter = await import('./routes/designPrototype');
  const workflowsRouter = await import('./routes/workflows');
  const automationsRouter = await import('./routes/automations');
  const generalAgentRouter = await import('./routes/generalAgent');
  
  // Mount Wave 1 feature routers
  app.use('/api/task-runners', taskRunnerRouter.default);
  app.use('/api/message-queue', messageQueueRouter.default);
  app.use('/api/autonomy', autonomySettingsRouter.default);
  app.use('/api/image-generation', imageGenerationRouter.default);
  app.use('/api/dynamic-intelligence', dynamicIntelligenceRouter.default);
  
  // Mount Wave 2 feature routers (100% Replit Agent Parity)
  app.use('/api/plan-mode', planModeRouter.default);
  app.use('/api/design-prototypes', designPrototypeRouter.default);
  app.use('/api/workflows', workflowsRouter.default);
  app.use('/api/automations', automationsRouter.default);
  app.use('/api/general-agent', generalAgentRouter.default);

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

  // ==================== AVATAR STATE ROUTES ====================
  
  // GET /api/avatar/state - Get user's avatar state
  app.get("/api/avatar/state", async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      let avatarState = await storage.getUserAvatarState(userId);
      
      if (!avatarState) {
        avatarState = await storage.upsertUserAvatarState(userId, {
          userId,
          currentMood: "happy",
          autoMoodEnabled: true,
          particlePreference: "auto",
        });
      }
      
      res.json(avatarState);
    } catch (error) {
      console.error('Error fetching avatar state:', error);
      res.status(500).json({ error: "Failed to fetch avatar state" });
    }
  });

  // POST /api/avatar/mood - Update avatar mood
  app.post("/api/avatar/mood", async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { mood, autoMoodEnabled, particlePreference } = req.body;

      if (!mood || typeof mood !== 'string') {
        return res.status(400).json({ error: "Mood is required" });
      }

      const validMoods = [
        'happy', 'excited', 'thinking', 'working', 'success', 'error', 
        'annoyed', 'sad', 'idle', 'confused', 'content', 'cheerful', 
        'love', 'angry', 'displeased'
      ];
      
      if (!validMoods.includes(mood)) {
        return res.status(400).json({ 
          error: `Invalid mood. Must be one of: ${validMoods.join(', ')}` 
        });
      }

      const updateData: any = { currentMood: mood };
      if (typeof autoMoodEnabled === 'boolean') {
        updateData.autoMoodEnabled = autoMoodEnabled;
      }
      if (particlePreference && ['auto', 'minimal', 'off'].includes(particlePreference)) {
        updateData.particlePreference = particlePreference;
      }

      const avatarState = await storage.upsertUserAvatarState(userId, {
        userId,
        ...updateData,
      });
      
      try {
        wss.clients.forEach((client: any) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'AVATAR_MOOD_CHANGE',
              userId,
              mood,
              timestamp: new Date().toISOString(),
            }));
          }
        });
      } catch (wsError) {
        console.error('[AVATAR] WebSocket broadcast error:', wsError);
      }
      
      res.json({ success: true, avatarState });
    } catch (error: any) {
      console.error('Error updating avatar mood:', error);
      res.status(500).json({ error: error.message || "Failed to update avatar mood" });
    }
  });

  console.log('✅ All routes registered successfully');
  
  return httpServer;
}