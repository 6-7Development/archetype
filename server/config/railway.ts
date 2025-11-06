/**
 * Railway Deployment Configuration
 * 
 * Production-grade settings to prevent common deployment issues:
 * - Timeouts: Prevent container restarts from long-running requests
 * - Memory: Monitor and warn before hitting 512MB limit
 * - Concurrency: Limit concurrent AI requests to prevent memory pressure
 * - Health: Regular monitoring intervals
 */

export const RAILWAY_CONFIG = {
  // Timeout settings
  AI_REQUEST_TIMEOUT: 8 * 60 * 1000, // 8 minutes (leaves 2min buffer from 10min Railway limit)
  STREAM_TIMEOUT: 5 * 60 * 1000, // 5 minutes for SSE streams
  WEBSOCKET_TIMEOUT: 10 * 60 * 1000, // 10 minutes for WebSocket connections
  
  // Memory settings
  MEMORY_LIMIT_MB: 512, // Railway container limit
  MEMORY_WARNING_THRESHOLD: 400, // Start warning at 400MB (78% capacity)
  MAX_CONCURRENT_AI_REQUESTS: 3, // SAFE: Profiling shows 3 is ceiling for 512MB container (needs monitoring before increasing)
  
  // Health check settings
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  
  // Production flags
  IS_RAILWAY: process.env.RAILWAY_ENVIRONMENT !== undefined,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  
  // Environment detection
  ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development',
} as const;

// Log configuration on import
if (RAILWAY_CONFIG.IS_RAILWAY) {
  console.log('[RAILWAY-CONFIG] Production hardening active');
  console.log(`[RAILWAY-CONFIG] AI timeout: ${RAILWAY_CONFIG.AI_REQUEST_TIMEOUT / 1000}s`);
  console.log(`[RAILWAY-CONFIG] Memory limit: ${RAILWAY_CONFIG.MEMORY_LIMIT_MB}MB`);
  console.log(`[RAILWAY-CONFIG] Max concurrent AI: ${RAILWAY_CONFIG.MAX_CONCURRENT_AI_REQUESTS}`);
}
