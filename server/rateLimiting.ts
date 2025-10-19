import rateLimit from 'express-rate-limit';

// Auth endpoints rate limiter - strict to prevent brute force
// Uses IP-based tracking (express-rate-limit handles IPv4/IPv6 automatically)
export const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: true, // Enable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.setHeader('Retry-After', '60'); // Set Retry-After header
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many authentication attempts. Please try again in 1 minute.',
      retryAfter: 60
    });
  }
});

// Standard API rate limiter - generous for normal operations
// Uses IP-based tracking
// NOTE: This is a SHARED limit across ALL endpoints using apiLimiter
// Background requests (auth checks, etc.) count toward this limit
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 total API requests per minute per IP (shared across all API endpoints)
  message: 'Too many API requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: true, // Enable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests, including successful ones
  skipFailedRequests: false, // Count all requests, including failed ones
  handler: (req, res) => {
    res.setHeader('Retry-After', '60'); // Set Retry-After header
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'API rate limit exceeded. Please try again in 1 minute.',
      retryAfter: 60
    });
  }
});

// AI generation rate limiter - strict to control costs
// Uses IP-based tracking for expensive AI operations
export const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 AI requests per minute per IP (expensive operations)
  message: 'Too many AI generation requests. Please wait before generating more.',
  standardHeaders: true,
  legacyHeaders: true, // Enable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.setHeader('Retry-After', '60'); // Set Retry-After header
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'AI generation rate limit exceeded. Please try again in 1 minute.',
      retryAfter: 60
    });
  }
});

// Webhook rate limiter - moderate for external service callbacks
// Uses IP-based tracking
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 webhook calls per minute per IP
  message: 'Too many webhook requests.',
  standardHeaders: true,
  legacyHeaders: true, // Enable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.setHeader('Retry-After', '60'); // Set Retry-After header
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Webhook rate limit exceeded.',
      retryAfter: 60
    });
  }
});
