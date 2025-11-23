import type { Express } from "express";
import type { Server } from "http";
import { db } from "./db";
import { files, users } from "@shared/schema";
import { setupAuth } from "./universalAuth";
import { FEATURES } from "./routes/common";
import { performanceMonitor } from "./services/performanceMonitor";
import { isAdmin } from "./universalAuth";
import toolsRouter from './routes/tools';
import uploadRouter from './routes/upload';
import platformRouter from './platformRoutes';
import lomuAIChatRouter from './routes/lomuChat';
import aiKnowledgeRouter from './routes/aiKnowledge';
import conversationStateRouter from './routes/conversationState';
import architectRouter from './routes/architect';
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
import { registerHealingRoutes } from "./routes/healing";
import { registerFolderRoutes } from "./routes/folders";
import { registerFileOperationRoutes } from "./routes/fileOps";
import { registerFileUploadRoutes } from "./routes/fileUploads";
import { registerMigrationRoutes } from "./routes/migrations";
import { setupWebSocket } from "./routes/websocket";
import { registerTerminalRoutes } from "./routes/terminal";
import webhooksRouter, { setWebhookBroadcaster } from "./routes/webhooks";
import gitRouter from "./routes/git";
import { registerDeploymentRoutes } from "./routes/deployments";
import tasksRouter from "./routes/tasks";
import { registerArchitectNotesRoutes } from "./routes/architect-notes";
import { registerUserPreferencesRoutes } from "./routes/user-preferences";
import { registerScratchpadRoutes } from "./routes/scratchpad";
import creditsRouter from "./routes/credits";
import agentsRouter from "./routes/agents";
import approvalRouter from "./routes/approvalRoutes";

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== HEALTH & DIAGNOSTICS ====================
  
  // Health check endpoints (no auth required - for monitoring)
  // Railway expects /api/health
  const healthHandler = (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  };
  
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

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

  // JSON Healing Telemetry endpoints (public - for monitoring)
  // GET /api/telemetry/json-healing - Get JSON healing statistics
  app.get('/api/telemetry/json-healing', (req, res) => {
    console.log('[TELEMETRY] GET request received for /api/telemetry/json-healing');
    const stats = global.jsonHealingTelemetry;
    const successRate = stats.totalAttempts > 0 
      ? ((stats.success / stats.totalAttempts) * 100).toFixed(2)
      : 0;
    
    const responseData = {
      ...stats,
      successRate: `${successRate}%`,
      uptime: Date.now() - stats.lastReset.getTime()
    };
    
    console.log('[TELEMETRY] Sending JSON response:', JSON.stringify(responseData));
    res.json(responseData);
  });
  
  // POST /api/telemetry/json-healing/reset - Reset statistics
  app.post('/api/telemetry/json-healing/reset', (req, res) => {
    global.jsonHealingTelemetry = {
      success: 0,
      failure: 0,
      invalidStructure: 0,
      totalAttempts: 0,
      lastReset: new Date()
    };
    res.json({ message: 'Telemetry reset successfully' });
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
  
  // Wire WebSocket server to task management for task update broadcasts
  const { setWebSocketServer: setTaskManagementWebSocketServer } = await import('./tools/task-management');
  setTaskManagementWebSocketServer(wss);
  console.log('[TASK-MGMT] Task management connected to WebSocket');
  
  // Wire WebSocket server to approval manager for approval request broadcasts
  const { approvalManager } = await import('./services/approvalManager');
  approvalManager.setWebSocketServer(wss);
  console.log('[APPROVAL-MANAGER] Connected to WebSocket server');
  
  // Initialize platform metrics broadcaster
  const { PlatformMetricsBroadcaster } = await import('./services/platformMetricsBroadcaster');
  const metricsBroadcaster = new PlatformMetricsBroadcaster(wss);
  metricsBroadcaster.start();
  
  // Connect heal orchestrator to metrics broadcaster for healing event notifications
  const { healOrchestrator } = await import('./services/healOrchestrator');
  healOrchestrator.setBroadcaster(metricsBroadcaster);
  
  // Connect webhooks router to metrics broadcaster for deployment status broadcasting
  setWebhookBroadcaster(metricsBroadcaster);
  console.log('[WEBHOOKS] Webhooks router connected to metrics broadcaster');

  // Initialize LomuAI job manager with WebSocket support
  const { initializeJobManager } = await import('./services/lomuJobManager');
  initializeJobManager(wss);
  console.log('[LOMU-AI-JOB-MANAGER] Job manager connected to WebSocket');

  // Initialize LomuAI chat with WebSocket for live preview
  // const { initializeLomuAIWebSocket } = await import('./routes/lomuChat');
  // initializeLomuAIWebSocket(wss);
  // console.log('[LOMU-AI-CHAT] Live preview WebSocket initialized');

  // Initialize terminal WebSocket routes
  registerTerminalRoutes(wss, httpServer);
  console.log('[TERMINAL] Terminal WebSocket routes registered');

  // ==================== REGISTER ROUTE MODULES ====================
  
  // Register all route modules with dependencies
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  
  // 🆕 Performance metrics endpoint (admin only - for monitoring dashboard)
  // GET /api/metrics - Returns real-time performance statistics
  app.get('/api/metrics', isAdmin, async (_req: any, res) => {
    try {
      const metrics = performanceMonitor.getMetrics();
      res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[METRICS] Error fetching metrics:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch metrics' });
    }
  });
  
  registerArchitectNotesRoutes(app);
  registerUserPreferencesRoutes(app);
  registerScratchpadRoutes(app, { wss });
  registerOwnerSetupRoutes(app);
  registerSubscriptionRoutes(app);
  registerProjectRoutes(app);
  registerFileRoutes(app);
  registerFolderRoutes(app);
  registerFileOperationRoutes(app);
  registerFileUploadRoutes(app);
  registerMigrationRoutes(app);
  registerChatRoutes(app, { wss });
  registerHealingRoutes(app, { wss });

  // ==================== MOUNT EXISTING ROUTERS ====================
  
  // Mount tools router (browser_test, web_search, vision_analyze)
  app.use('/api/tools', toolsRouter);
  
  // Mount upload router (file uploads)
  app.use('/api', uploadRouter);
  
  // Mount platform router (platform self-healing)
  app.use('/api/platform', platformRouter);
  
  // Mount AI Knowledge Base router (learning and confidence scoring)
  app.use('/api/ai-knowledge', aiKnowledgeRouter);
  
  // Mount tasks router (task persistence across chats)
  app.use('/api/tasks', tasksRouter);
  
  // Mount LomuAI chat router (chat-based platform healing)
  app.use('/api/lomu-ai', lomuAIChatRouter);
  console.log('[LOMU-AI] LomuAI router mounted at /api/lomu-ai');
  
  // Mount I AM Architect router (architectural consultation with Claude Sonnet 4)
  app.use('/api/architect', architectRouter);
  console.log('[ARCHITECT] I AM Architect router mounted at /api/architect');
  
  // Mount conversation state router (context tracking for AI chats)
  app.use('/api/conversation', conversationStateRouter);
  
  // Mount credits router (credit purchase and balance management)
  app.use('/api/credits', creditsRouter);
  console.log('[CREDITS] Credits router mounted at /api/credits');
  
  // Mount approval router (user approval for file modifications)
  app.use('/api', approvalRouter);
  console.log('[APPROVALS] Approval router mounted at /api');
  
  // Mount agents router (agent run management and resume)
  app.use('/api/agents', agentsRouter);
  console.log('[AGENTS] Agents router mounted at /api/agents');
  
  // Mount webhooks router (deployment status from Railway/Render)
  app.use('/api/webhooks', webhooksRouter);
  console.log('[WEBHOOKS] Webhooks router mounted at /api/webhooks');
  
  // Mount git router (version control UI)
  app.use(gitRouter);
  console.log('[GIT] Git router mounted');

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

  // ==================== WORKFLOW METRICS ANALYTICS ====================
  
  // Import lomu workflow metrics table
  const { lomuWorkflowMetrics } = await import('@shared/schema');
  const { sql: drizzleSql, desc, gte, lte, and, count, eq } = await import('drizzle-orm');
  
  // Helper: Calculate date range (default to last 7 days)
  function getDateRange(startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
  
  // GET /api/workflow-metrics/summary - Aggregated statistics (OWNER-ONLY)
  app.get('/api/workflow-metrics/summary', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // 🔒 SECURITY: Owner-only access to workflow metrics
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || !user.isOwner) {
        return res.status(403).json({ error: 'Access denied. Workflow Analytics is owner-only.' });
      }
      
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(startDate, endDate);
      
      // Query all metrics in date range
      const metrics = await db
        .select()
        .from(lomuWorkflowMetrics)
        .where(
          and(
            gte(lomuWorkflowMetrics.createdAt, start),
            lte(lomuWorkflowMetrics.createdAt, end)
          )
        );
      
      if (metrics.length === 0) {
        return res.json({
          totalJobs: 0,
          avgPhaseCompliance: 0,
          avgTestCoverage: 0,
          avgTokenEfficiency: 0,
          avgOverallQuality: 0,
          totalViolations: 0,
          avgViolationsPerJob: 0,
          complianceRate: 0,
          testingRate: 0,
        });
      }
      
      // Calculate aggregates
      const totalJobs = metrics.length;
      const avgPhaseCompliance = Math.round(
        metrics.reduce((sum, m) => sum + m.phaseComplianceScore, 0) / totalJobs
      );
      const avgTestCoverage = Math.round(
        metrics.reduce((sum, m) => sum + m.testCoverageScore, 0) / totalJobs
      );
      const avgTokenEfficiency = Math.round(
        metrics.reduce((sum, m) => sum + m.tokenEfficiencyScore, 0) / totalJobs
      );
      const avgOverallQuality = Math.round(
        metrics.reduce((sum, m) => sum + m.overallQualityScore, 0) / totalJobs
      );
      const totalViolations = metrics.reduce((sum, m) => sum + m.violationCount, 0);
      const avgViolationsPerJob = parseFloat((totalViolations / totalJobs).toFixed(2));
      
      // Calculate rates
      const jobsWithAll7Phases = metrics.filter(m => 
        (m.phasesExecuted as string[]).length === 7
      ).length;
      const complianceRate = Math.round((jobsWithAll7Phases / totalJobs) * 100);
      
      const jobsWithTests = metrics.filter(m => m.testsRun).length;
      const testingRate = Math.round((jobsWithTests / totalJobs) * 100);
      
      res.json({
        totalJobs,
        avgPhaseCompliance,
        avgTestCoverage,
        avgTokenEfficiency,
        avgOverallQuality,
        totalViolations,
        avgViolationsPerJob,
        complianceRate,
        testingRate,
      });
    } catch (error: any) {
      console.error('[WORKFLOW-METRICS] Summary error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch summary' });
    }
  });
  
  // GET /api/workflow-metrics/timeline - Time-series data for charts (OWNER-ONLY)
  app.get('/api/workflow-metrics/timeline', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // 🔒 SECURITY: Owner-only access to workflow metrics
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || !user.isOwner) {
        return res.status(403).json({ error: 'Access denied. Workflow Analytics is owner-only.' });
      }
      
      const { startDate, endDate} = req.query;
      const { start, end } = getDateRange(startDate, endDate);
      
      // Query all metrics in date range
      const metrics = await db
        .select()
        .from(lomuWorkflowMetrics)
        .where(
          and(
            gte(lomuWorkflowMetrics.createdAt, start),
            lte(lomuWorkflowMetrics.createdAt, end)
          )
        )
        .orderBy(lomuWorkflowMetrics.createdAt);
      
      // Group by day
      const dailyData = new Map<string, { jobs: typeof metrics, count: number }>();
      
      metrics.forEach(metric => {
        const date = metric.createdAt?.toISOString().split('T')[0] || '';
        if (!dailyData.has(date)) {
          dailyData.set(date, { jobs: [], count: 0 });
        }
        const day = dailyData.get(date)!;
        day.jobs.push(metric);
        day.count++;
      });
      
      // Calculate daily aggregates
      const timeline = Array.from(dailyData.entries()).map(([date, { jobs, count }]) => ({
        date,
        jobCount: count,
        avgQuality: Math.round(
          jobs.reduce((sum, m) => sum + m.overallQualityScore, 0) / count
        ),
        violations: jobs.reduce((sum, m) => sum + m.violationCount, 0),
      }));
      
      res.json(timeline);
    } catch (error: any) {
      console.error('[WORKFLOW-METRICS] Timeline error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch timeline' });
    }
  });
  
  // GET /api/workflow-metrics/violations - Violation breakdown by type (OWNER-ONLY)
  app.get('/api/workflow-metrics/violations', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // 🔒 SECURITY: Owner-only access to workflow metrics
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || !user.isOwner) {
        return res.status(403).json({ error: 'Access denied. Workflow Analytics is owner-only.' });
      }
      
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(startDate, endDate);
      
      // Query all metrics in date range
      const metrics = await db
        .select()
        .from(lomuWorkflowMetrics)
        .where(
          and(
            gte(lomuWorkflowMetrics.createdAt, start),
            lte(lomuWorkflowMetrics.createdAt, end)
          )
        )
        .orderBy(desc(lomuWorkflowMetrics.createdAt));
      
      // Count violations by type
      const byType: Record<string, number> = {
        phase_skip: 0,
        test_skip: 0,
        direct_edit: 0,
        no_announcement: 0,
        excessive_rambling: 0,
        tool_block: 0,
      };
      
      const recentViolations: any[] = [];
      
      metrics.forEach(metric => {
        const violations = (metric.violations as any[]) || [];
        violations.forEach(v => {
          const type = v.type || 'unknown';
          if (byType.hasOwnProperty(type)) {
            byType[type]++;
          }
          
          // Collect recent violations (limit 10)
          if (recentViolations.length < 10) {
            recentViolations.push({
              ...v,
              jobId: metric.jobId,
              createdAt: metric.createdAt,
            });
          }
        });
      });
      
      res.json({ byType, recentViolations });
    } catch (error: any) {
      console.error('[WORKFLOW-METRICS] Violations error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch violations' });
    }
  });
  
  // GET /api/workflow-metrics/recent-jobs - Recent jobs with metrics (OWNER-ONLY)
  app.get('/api/workflow-metrics/recent-jobs', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // 🔒 SECURITY: Owner-only access to workflow metrics
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || !user.isOwner) {
        return res.status(403).json({ error: 'Access denied. Workflow Analytics is owner-only.' });
      }
      
      const { startDate, endDate } = req.query;
      const { start, end } = getDateRange(startDate, endDate);
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Query recent metrics
      const metrics = await db
        .select()
        .from(lomuWorkflowMetrics)
        .where(
          and(
            gte(lomuWorkflowMetrics.createdAt, start),
            lte(lomuWorkflowMetrics.createdAt, end)
          )
        )
        .orderBy(desc(lomuWorkflowMetrics.createdAt))
        .limit(limit);
      
      res.json(metrics);
    } catch (error: any) {
      console.error('[WORKFLOW-METRICS] Recent jobs error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch recent jobs' });
    }
  });

  // ==================== DEPLOYMENTS ====================
  registerDeploymentRoutes(app);

  console.log('✅ All routes registered successfully');
  
  return httpServer;
}
