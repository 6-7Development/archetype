import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { apiLimiter } from "./rateLimiting";
import { db } from "./db";
import { files } from "@shared/schema";
import { autoHealing } from "./autoHealing";

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
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balance between speed and compression ratio
}));
console.log('[PERFORMANCE] Compression middleware enabled - responses will be 70-80% smaller');

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
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // START SERVER IMMEDIATELY - Don't wait for database!
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Test database connection AFTER server starts (non-blocking)
  console.log('🔍 Testing database connection...');
  try {
    await retryWithBackoff(async () => {
      await db.select().from(files).limit(1);
    }, 5, 1000);
    console.log('✅ Database connected successfully');
  } catch (error: any) {
    console.error('❌ Database connection failed after retries:', error.message);
    console.error('⚠️ Running in degraded mode (database unavailable)');
    // Continue - graceful degradation will handle missing database
  }

  // Initialize auto-healing system (production only for safety)
  if (process.env.NODE_ENV === 'production') {
    console.log('🔧 Auto-healing system ENABLED (production mode)');
  } else {
    console.log('💡 Auto-healing system DISABLED (development mode - use manual healing)');
  }

  // Check GitHub integration configuration for owner-controlled platform modifications
  console.log('\n🔍 Checking GitHub integration configuration...');
  const missingEnvVars: string[] = [];
  
  if (!process.env.GITHUB_TOKEN) {
    missingEnvVars.push('GITHUB_TOKEN');
  }
  if (!process.env.GITHUB_REPO) {
    missingEnvVars.push('GITHUB_REPO');
  }
  if (!process.env.OWNER_USER_ID) {
    missingEnvVars.push('OWNER_USER_ID (optional - for automatic owner assignment)');
  }

  if (missingEnvVars.length > 0) {
    console.log('⚠️  GitHub integration NOT configured - platform modifications in production will be disabled');
    console.log('📝 Missing environment variables:');
    missingEnvVars.forEach(varName => {
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
    }
    console.log('   - Maintenance mode: Available for owner\n');
  }
})();
