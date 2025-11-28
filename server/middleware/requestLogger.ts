import { Request, Response, NextFunction } from 'express';
import { logRequest, logger } from '../services/logger';

/**
 * Request logging middleware with structured logging
 * Logs method, path, duration, status code, and optional user context
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  
  // Attach request ID for tracing
  (req as any).requestId = requestId;
  
  // Log request start for slow request detection
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Request started', {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.get('user-agent')?.slice(0, 100),
    });
  }
  
  // Capture response finish for logging
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    
    // Skip logging for health checks and static assets
    if (req.path === '/health' || req.path === '/api/health' || req.path.startsWith('/assets')) {
      return;
    }
    
    // Log based on status code level
    if (status >= 500) {
      logger.error('Request failed', {
        requestId,
        method: req.method,
        path: req.path,
        status,
        durationMs: duration,
        userId: (req as any).user?.id,
        workspaceId: (req as any).teamContext?.workspaceId,
      });
    } else if (status >= 400) {
      logger.warn('Request client error', {
        requestId,
        method: req.method,
        path: req.path,
        status,
        durationMs: duration,
      });
    } else if (duration > 5000) {
      // Slow request warning (> 5 seconds)
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        path: req.path,
        status,
        durationMs: duration,
      });
    } else {
      logRequest(req.method, req.path, duration, status);
    }
  });
  
  next();
}

/**
 * Error logging middleware
 * Should be registered after all routes
 */
export function errorLogger(err: Error, req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.error('Unhandled error', {
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id,
  });
  
  next(err);
}
