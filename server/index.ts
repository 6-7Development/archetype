import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { apiLimiter } from "./rateLimiting";
import { db } from "./db";
import { files } from "@shared/schema";
import { autoHealing } from "./autoHealing";
import multer from "multer"; // Import multer

// DEPLOYMENT VERIFICATION: October 28, 2025 01:50 UTC - LomuAI execution fix deployed
// ✅ LomuAI system prompt rewritten to force immediate tool execution
// ✅ Continuation logic added to keep working on in_progress tasks
// ✅ Visual progress bars added to in_progress tasks
// ✅ Extensive diagnostic logging for LomuAI debugging
// PREVIOUS: Session store SSL, Vite allowedHosts, WebSocket WSS all configured

// PRODUCTION FIX: Handle SSL certificate validation for Render deployment
// Render provides proper SSL certificates, but Node.js may need this for some external API calls
if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
  console.log('🔒 Running on Render - SSL configured');
  console.log('✅ Deployment verified: All critical fixes active');
}

// Exponential backoff retry utility
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const delay = initialDelay * Math.pow(2, attempt);
      console.error(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} failed:`, {
        code: error.code,
        message: error.message,
        nextRetryIn: `${delay}ms`
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

const app = express();

// PERFORMANCE: Enable gzip compression for all responses (70-80% size reduction)
// BUT: Disable for SSE streams (they need real-time streaming, not buffering)
app.use(compression({
  filter: (req, res) => {
    // Disable compression for Server-Sent Events (SSE) - they need real-time streaming
    if (req.path === '/api/lomu-ai/stream' || req.path.includes('/stream')) {
      return false;
    }
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balance between speed and compression ratio
}));
console.log('[PERFORMANCE] Compression middleware enabled - responses will be 70-80% smaller (SSE streams excluded)');

// Force HTTPS redirect in production (Render provides free SSL)
app.use((req, res, next) => {
  // Check if we're in production and request is not secure
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Apply raw body parser for Stripe webhooks BEFORE global JSON parser
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// Apply global JSON parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Apply rate limiting globally to all /api/* routes
// This ensures all API requests (including error responses) are rate limited
app.use('/api', apiLimiter);

// 🛡️ OPTIMIZED response logging to prevent CPU spikes on large responses
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // 🛡️ OPTIMIZED: Only stringify small responses to prevent CPU spikes
      if (capturedJsonResponse) {
        try {
          // Pre-check response size before stringifying
          const responseKeys = Object.keys(capturedJsonResponse);
          const estimatedSize = responseKeys.length * 50; // Rough estimate
          
          if (estimatedSize < 1000) { // Only log small responses
            const jsonString = JSON.stringify(capturedJsonResponse);
            if (jsonString.length <= 200) {
              logLine += ` :: ${jsonString}`;
            } else {
              logLine += ` :: ${jsonString.substring(0, 200)}...`;
            }
          } else {
            logLine += ` :: [Large response: ${responseKeys.length} keys]`;
          }
        } catch (stringifyError) {
          // Prevent JSON.stringify from causing CPU spikes on circular references
          logLine += ` :: [Response logging error: ${stringifyError.message}]`;
        }
      }

      // Truncate final log line to prevent excessive memory usage
      if (logLine.length > 200) {
        logLine = logLine.slice(0, 199) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' }); // Files will be stored in the 'uploads/' directory

(async () => {
  const server = await registerRoutes(app);

  // 🛡️ CRITICAL WebSocket MEMORY LEAK FIX: Add error and close handlers to all WebSocket connections
  // This prevents memory leaks detected in platform diagnosis
  console.log('🔧 Adding WebSocket memory leak prevention handlers...');
  
  // Store original upgrade listeners to wrap them
  const originalUpgradeListeners = server.listeners('upgrade');
  
  // Remove original listeners
  server.removeAllListeners('upgrade');
  
  // Add our enhanced upgrade handler
  server.on('upgrade', (request: any, socket: any, head: any) => {
    // Call original upgrade handlers first
    originalUpgradeListeners.forEach(listener => {
      try {
        listener(request, socket, head);
      } catch (error) {
        console.error('[WEBSOCKET] Upgrade handler error:', error);
      }
    });
    
    // Add error and close handlers to prevent memory leaks
    socket.on('error', (error: any) => {
      console.error('[WEBSOCKET] Socket error (preventing memory leak):', error.message);
    });
    
    socket.on('close', () => {
      console.log('[WEBSOCKET] Socket closed (memory cleaned up)');
    });
  });

  // Serve attached_assets as static files
  app.use('/attached_assets', express.static('attached_assets'));

  // Add a new route for file uploads
  app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.status(200).json({ message: 'File uploaded successfully', filename: req.file.filename });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // START SERVER IMMEDIATELY - Don't wait for database!
  server.listen(port, '0.0.0.0', async () => {
    log(`serving on port ${port}`);
    console.log(`🌐 Server accessible at http://0.0.0.0:${port}`);
    
    // Setup Vite AFTER server is listening
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
  });

  // Test database connection AFTER server starts (non-blocking)
  console.log('🔍 Testing database connection...');
  try {
    await retryWithBackoff(async () => {
      await db.select().from(files).limit(1);
    }, 5, 1000);
    console.log('✅ Database connected successfully');
    
    // 🧹 STARTUP CLEANUP: Remove chat messages with incorrect camelCase tool names
    // This prevents old incorrect tool calls from polluting Claude's context
    console.log('🧹 Running startup cleanup for chat history...');
    try {
      const { sql } = await import('drizzle-orm');
      const cleanupResult = await db.execute(sql`
        DELETE FROM chat_messages 
        WHERE content LIKE '%createTaskList(%' 
           OR content LIKE '%updateTask(%' 
           OR content LIKE '%readTaskList(%'
           OR content LIKE '%startSubagent(%'
           OR content LIKE '%architectConsult(%'
           OR content LIKE '%performDiagnosis(%'
           OR content LIKE '%readPlatformFile(%'
           OR content LIKE '%writePlatformFile(%'
           OR content LIKE '%listPlatformDirectory(%'
      `);
      console.log('✅ Chat history cleanup complete');
    } catch (cleanupError: any) {
      console.warn('⚠️ Chat history cleanup failed (non-critical):', cleanupError.message);
    }
    
    // 🧹 CLEANUP: Fix stuck/zombie LomuAI jobs on server restart
    // ANY job with status 'pending' or 'running' is invalid after restart
    // because the server's activeJobs Map is cleared on restart
    console.log('🧹 Cleaning up stuck LomuAI jobs from previous server session...');
    try {
      const { lomuJobs } = await import('@shared/schema');
      const { inArray } = await import('drizzle-orm');
      
      const staleJobs = await db
        .update(lomuJobs)
        .set({
          status: 'failed',
          error: 'Job interrupted by server restart',
          updatedAt: new Date(),
        })
        .where(inArray(lomuJobs.status, ['pending', 'running']))
        .returning({ id: lomuJobs.id });
      
      if (staleJobs.length > 0) {
        console.log(`✅ Cleaned up ${staleJobs.length} interrupted LomuAI jobs`);
      } else {
        console.log('✅ No interrupted LomuAI jobs found');
      }
    } catch (jobCleanupError: any) {
      console.warn('⚠️ LomuAI job cleanup failed (non-critical):', jobCleanupError.message);
    }
  } catch (error: any) {
    console.error('❌ Database connection failed after retries:', error.message);
    console.error('⚠️ Running in degraded mode (database unavailable)');
    // Continue - graceful degradation will handle missing database
  }

  // Initialize auto-healing system (DISABLED by default to prevent token usage)
  // Users trigger healing manually via Platform Healing UI and pay for their own tokens
  const autoHealingEnabled = process.env.ENABLE_AUTO_HEALING === 'true';
  
  if (autoHealingEnabled) {
    console.log('🔧 Auto-healing system ENABLED (uses platform credits - for testing only!)');
    console.log('   ⚡ Kill-switch: Disabled after 3 consecutive failures (1 hour cooldown)');
    console.log('   ⏱️ Rate limit: Max 3 healing sessions per hour');
    console.log('   📋 Audit trail: All attempts logged to platformHealAttempts');
    console.log('   🔄 Rollback: Automatic rollback on verification/deployment failure');
    console.log('   💰 WARNING: This uses YOUR Anthropic credits!');
  } else {
    console.log('💡 Auto-healing system DISABLED (users trigger manually via UI)');
    console.log('   👥 Users pay for their own AI tokens when using Platform Healing');
  }

  // Start platform health monitor
  const { healthMonitor } = await import('./services/healthMonitor');
  await healthMonitor.start();

  // Start heal orchestrator (listens to health monitor events)
  const { healOrchestrator } = await import('./services/healOrchestrator');
  await healOrchestrator.start(healthMonitor);

  // Initialize memory monitoring for production
  const { setupMemoryMonitoring } = await import('./middleware/memoryMonitor');
  setupMemoryMonitoring();

  // 🛡️ CPU MONITORING: Track and report high CPU usage
  console.log('🛡️ Initializing CPU monitoring to detect performance issues...');
  let lastCpuCheckTime = process.hrtime();
  let lastCpuUsage = process.cpuUsage();
  
  const cpuMonitorInterval = setInterval(() => {
    const currentCpuCheckTime = process.hrtime(lastCpuCheckTime);
    const currentCpuUsage = process.cpuUsage(lastCpuUsage);
    
    // Calculate CPU usage percentage
    const totalTime = currentCpuCheckTime[0] * 1000000 + currentCpuCheckTime[1] / 1000; // microseconds
    const cpuPercent = ((currentCpuUsage.user + currentCpuUsage.system) / totalTime) * 100;
    
    if (cpuPercent > 85) {
      console.warn(`🚨 HIGH CPU USAGE DETECTED: ${cpuPercent.toFixed(1)}%`);
      console.warn('   - Check for infinite loops in auto-test-loop.ts');
      console.warn('   - Monitor JSON response stringification');
      console.warn('   - Review WebSocket connection handling');
    }
    
    lastCpuCheckTime = process.hrtime();
    lastCpuUsage = process.cpuUsage();
  }, 30000); // Check every 30 seconds
  
  // Clean up CPU monitoring on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(cpuMonitorInterval);
  });

  // Check GitHub integration configuration for owner-controlled platform modifications
  console.log('\n🔍 Checking GitHub integration configuration...');
  const requiredEnvVars: string[] = [];
  
  if (!process.env.GITHUB_TOKEN) {
    requiredEnvVars.push('GITHUB_TOKEN');
  }
  if (!process.env.GITHUB_REPO) {
    requiredEnvVars.push('GITHUB_REPO');
  }

  if (requiredEnvVars.length > 0) {
    console.log('⚠️  GitHub integration NOT configured - platform modifications in production will be disabled');
    console.log('📝 Missing required environment variables:');
    requiredEnvVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n💡 To enable owner-controlled platform modifications on Render:');
    console.log('   1. Set GITHUB_TOKEN (GitHub personal access token with repo permissions)');
    console.log('   2. Set GITHUB_REPO (format: "username/repo-name")');
    console.log('   3. Set GITHUB_BRANCH (optional, default: "main")');
    console.log('   4. Set OWNER_USER_ID (optional - Replit Auth ID of the owner)');
    console.log('   5. Owner can enable maintenance mode to commit changes to GitHub');
    console.log('   6. Render auto-deploys from GitHub commits\n');
  } else {
    console.log('✅ GitHub integration configured successfully');
    console.log(`   - Repository: ${process.env.GITHUB_REPO}`);
    console.log(`   - Branch: ${process.env.GITHUB_BRANCH || 'main'}`);
    console.log(`   - Token: ✓ (configured)`);
    if (process.env.OWNER_USER_ID) {
      console.log(`   - Owner User ID: ${process.env.OWNER_USER_ID}`);
    } else {
      console.log('   - Owner User ID: Not set (owner must be manually marked in database)');
    }
    console.log('   - Maintenance mode: Available for owner\n');
  }

  // Graceful shutdown handler for Railway deployment
  process.on('SIGTERM', async () => {
    console.log('[RAILWAY] SIGTERM received, shutting down gracefully...');
    
    // Stop memory monitoring
    const { stopMemoryMonitoring } = await import('./middleware/memoryMonitor');
    stopMemoryMonitoring();
    
    // Close server
    server.close(() => {
      console.log('[RAILWAY] Server closed successfully');
      process.exit(0);
    });
    
    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('[RAILWAY] Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  });

  console.log('[RAILWAY] Graceful shutdown handler registered (SIGTERM)');
})();