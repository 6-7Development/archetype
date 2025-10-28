import { Router } from 'express';
import { checkDatabaseHealth } from '../db/health';
import { logger } from '../logging';
import os from 'os';

export const healthRouter = Router();

// Basic health endpoint
healthRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Detailed health check
healthRouter.get('/health/detailed', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          rss: process.memoryUsage().rss
        },
        cpu: os.cpus(),
        loadAverage: os.loadavg()
      },
      database: dbHealth,
      version: process.env.npm_package_version || 'unknown'
    };

    logger.info('Health check requested', { ip: req.ip });
    res.json(health);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default healthRouter;