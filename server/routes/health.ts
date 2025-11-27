import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const healthRouter = Router();

/**
 * Health check endpoint for load balancers and Kubernetes
 * GET /health
 * GET /api/health
 * 
 * Returns: { status: 'ok', timestamp: ISO8601, uptime: seconds, database: 'connected' }
 * Status: 200 if healthy, 503 if unhealthy
 */

// Register on both /health and /api/health for consistency
healthRouter.get('/health', handleHealthCheck);
healthRouter.get('/api/health', handleHealthCheck);

async function handleHealthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const uptime = process.uptime();
  
  try {
    // Quick database health check - simple query
    await db.execute(sql`SELECT 1`);
    
    const responseTime = Date.now() - startTime;
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      database: 'connected',
      responseTimeMs: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('[HEALTH] Database check failed:', error instanceof Error ? error.message : 'Unknown error');
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      database: 'disconnected',
      responseTimeMs: responseTime,
      error: error instanceof Error ? error.message : 'Database connection check failed'
    });
  }
}

export function registerHealthRoutes(app: any): void {
  app.use(healthRouter);
  console.log('✅ Health endpoint active');
}

export default healthRouter;
