import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/**
 * Security validation middleware for API routes
 * Prevents injection attacks and validates all user inputs
 */

// Common validation schemas
export const schemas = {
  // ID validations
  uuid: z.string().uuid('Invalid ID format'),
  
  // String validations with injection prevention
  safeString: z.string()
    .min(1, 'Value cannot be empty')
    .max(1000, 'Value too long')
    .regex(/^[a-zA-Z0-9\s\-_.,!?'"()[\]{}@#$%&*+=/:;<>|\\~`]+$/, 'Contains invalid characters'),
  
  email: z.string().email('Invalid email format'),
  
  filename: z.string()
    .min(1, 'Filename cannot be empty')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9\-_.]+$/, 'Invalid filename characters'),
  
  path: z.string()
    .max(500, 'Path too long')
    .regex(/^[a-zA-Z0-9\-_./]+$/, 'Invalid path characters')
    .refine(val => !val.includes('..'), 'Path traversal detected'),
  
  // Project validations
  projectName: z.string()
    .min(1, 'Project name required')
    .max(100, 'Project name too long')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid project name characters'),
  
  projectDescription: z.string()
    .max(500, 'Description too long')
    .optional(),
  
  // Command validation
  command: z.string()
    .min(1, 'Command cannot be empty')
    .max(5000, 'Command too long'),
  
  // Chat message validation  
  chatMessage: z.string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message too long'),
  
  role: z.enum(['user', 'assistant', 'system']),
  
  // Pagination
  limit: z.coerce.number()
    .min(1)
    .max(100)
    .default(20),
    
  offset: z.coerce.number()
    .min(0)
    .default(0),
  
  // Support ticket validation
  supportTicket: z.object({
    subject: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    category: z.enum(['technical', 'billing', 'feature_request', 'bug_report', 'other']),
    priority: z.enum(['low', 'medium', 'high', 'urgent'])
  }),
  
  // Service request validation
  serviceRequest: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(10000),
    timeline: z.string().min(1).max(100),
    budget: z.string().min(1).max(50),
    techStack: z.string().max(500).optional(),
    features: z.string().max(5000).optional()
  }),
  
  // File upload validation
  fileUpload: z.object({
    filename: z.string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9\-_.]+$/, 'Invalid filename'),
    content: z.string().max(10 * 1024 * 1024), // 10MB limit
    language: z.string().max(50).optional()
  }),
  
  // Settings validation
  settings: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    autonomyLevel: z.enum(['basic', 'standard', 'deep', 'max']).optional(),
    emailNotifications: z.boolean().optional()
  })
};

/**
 * Validation middleware factory
 * Creates middleware that validates request data against a schema
 */
export function validate(schema: z.ZodSchema<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body, query, and params
      const dataToValidate = {
        ...req.body,
        ...req.query,
        ...req.params
      };
      
      // Parse and validate
      const validated = await schema.parseAsync(dataToValidate);
      
      // Replace request data with validated/sanitized data
      req.body = validated;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format validation errors nicely
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          error: 'Validation failed',
          errors
        });
      }
      
      // Unknown error
      console.error('Validation middleware error:', error);
      res.status(500).json({ error: 'Internal validation error' });
    }
  };
}

/**
 * Sanitize HTML content to prevent XSS
 * Allows safe HTML tags but removes scripts and dangerous attributes
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
  
  // Remove dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'button'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>|<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  return sanitized;
}

/**
 * Validate and sanitize file paths to prevent path traversal
 */
export function sanitizePath(inputPath: string): string {
  // Remove any path traversal attempts
  let sanitized = inputPath
    .replace(/\.\./g, '')
    .replace(/\/\//g, '/')
    .replace(/\\/g, '/');
  
  // Remove leading slashes
  if (sanitized.startsWith('/')) {
    sanitized = sanitized.substring(1);
  }
  
  // Ensure path doesn't escape project directory
  const parts = sanitized.split('/');
  const validParts = parts.filter(part => 
    part && 
    part !== '.' && 
    part !== '..' &&
    !part.includes('\0')
  );
  
  return validParts.join('/');
}

/**
 * Rate limiting configuration per endpoint
 */
export const rateLimits = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts'
  },
  
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many API requests'
  },
  
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 AI requests per minute
    message: 'Too many AI requests'
  },
  
  upload: {
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 uploads per minute
    message: 'Too many upload requests'
  }
};

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    res.setHeader('Permissions-Policy', 
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
    
    // Content Security Policy (adjust as needed)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' wss: https:;"
      );
    }
    
    next();
  };
}

/**
 * SQL injection prevention helper
 * Use with raw SQL queries (though we should use Drizzle ORM instead)
 */
export function escapeSql(value: string): string {
  if (typeof value !== 'string') return '';
  
  // Escape single quotes by doubling them (SQL standard)
  return value.replace(/'/g, "''");
}

/**
 * Validate environment variables on startup
 */
export function validateEnvironment() {
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'ANTHROPIC_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set these variables before starting the server.');
    process.exit(1);
  }
  
  // Validate format of certain env vars
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.error('❌ Invalid DATABASE_URL format. Must start with postgresql://');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed');
}