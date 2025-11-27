import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

/**
 * Organization-level rate limiter
 * Limits: 1000 requests per minute PER organization (workspace)
 * Uses team context (workspaceId) from request
 * Skips health check endpoints
 */
export const orgRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute per organization
  message: 'Organization has exceeded rate limit',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: true, // Enable the `X-RateLimit-*` headers
  
  // Custom key generator: org_${workspaceId}
  keyGenerator: (req: Request, res: Response) => {
    const teamContext = (req as any).teamContext;
    if (!teamContext?.workspaceId) {
      // For unauthenticated requests, fall back to IP address
      return `org_${req.ip || 'unknown'}`;
    }
    return `org_${teamContext.workspaceId}`;
  },
  
  // Skip health check endpoints
  skip: (req: Request, res: Response) => {
    const path = req.path;
    return path === '/health' || path === '/api/health' || path.includes('/health/detailed');
  },
  
  handler: (req: Request, res: Response) => {
    res.setHeader('Retry-After', '60'); // Set Retry-After header
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Organization has exceeded rate limit. Please try again in 1 minute.',
      retryAfter: 60
    });
  }
});

/**
 * Wrapper middleware to ensure teamContext is available before org rate limiting
 * This checks if the request has organization context and applies the limiter
 */
export function orgRateLimiterWithContext(req: Request, res: Response, next: NextFunction) {
  const teamContext = (req as any).teamContext;
  
  // Skip rate limiting for health endpoints
  const path = req.path;
  if (path === '/health' || path === '/api/health' || path.includes('/health/detailed')) {
    return next();
  }
  
  // If no team context and not a public endpoint, skip org limiter
  // (global apiLimiter will still apply)
  if (!teamContext) {
    return next();
  }
  
  // Apply the org rate limiter
  return orgRateLimiter(req, res, next);
}
