import { z } from 'zod';
import path from 'path';

/**
 * Comprehensive Input Validation Schemas
 * Prevents security vulnerabilities: XSS, path traversal, command injection
 */

// Email validation
export const emailSchema = z.string().email('Invalid email format');

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// File path validation - prevents path traversal
export const filePathSchema = z.string()
  .min(1, 'File path cannot be empty')
  .max(500, 'File path too long')
  .refine(
    (filePath) => {
      // Reject absolute paths
      if (path.isAbsolute(filePath)) {
        return false;
      }
      
      // Reject path traversal attempts
      if (filePath.includes('..')) {
        return false;
      }
      
      // Reject null bytes (directory traversal attack)
      if (filePath.includes('\0')) {
        return false;
      }
      
      // Only allow safe characters in file paths
      const safePathRegex = /^[a-zA-Z0-9\-_./]+$/;
      return safePathRegex.test(filePath);
    },
    'Invalid file path - path traversal or unsafe characters detected'
  );

// Filename validation - stricter than full paths
export const filenameSchema = z.string()
  .min(1, 'Filename cannot be empty')
  .max(255, 'Filename too long')
  .refine(
    (filename) => {
      // Reject path separators in filenames
      if (filename.includes('/') || filename.includes('\\')) {
        return false;
      }
      
      // Only allow safe characters
      const safeFilenameRegex = /^[a-zA-Z0-9\-_.]+$/;
      return safeFilenameRegex.test(filename);
    },
    'Invalid filename - only alphanumeric, dash, underscore, and dot allowed'
  );

// Project name validation
export const projectNameSchema = z.string()
  .min(1, 'Project name required')
  .max(100, 'Project name too long')
  .regex(
    /^[a-zA-Z0-9\s\-_]+$/,
    'Project name can only contain letters, numbers, spaces, dashes, and underscores'
  );

// Enhanced command validation - prevents command injection AND redirection
export const commandSchema = z.string()
  .min(1, 'Command cannot be empty')
  .max(5000, 'Command too long')
  .refine(
    (cmd) => {
      // Reject shell metacharacters including redirection operators
      const dangerousChars = /[><|;&`$()]/;
      return !dangerousChars.test(cmd);
    },
    'Command contains shell metacharacters'
  )
  .refine(
    (cmd) => {
      // Reject control characters
      const controlChars = /[\x00-\x1F\x7F]/;
      return !controlChars.test(cmd);
    },
    'Command contains control characters'
  );

// Enhanced safe string validation - blocks control chars, scripts, and event handlers
export const safeStringSchema = z.string()
  .min(1, 'Value cannot be empty')
  .max(10000, 'Value too long')
  .refine(
    (str) => {
      // Reject null bytes
      return !str.includes('\0');
    },
    'String contains null bytes'
  )
  .refine(
    (str) => {
      // Reject control characters
      const controlChars = /[\x00-\x1F\x7F]/;
      return !controlChars.test(str);
    },
    'String contains control characters'
  )
  .refine(
    (str) => {
      // Reject script tags
      return !/<script/i.test(str);
    },
    'String contains script tags'
  )
  .refine(
    (str) => {
      // Reject event handlers (onclick, onload, etc.)
      return !/ on\w+=/i.test(str);
    },
    'String contains event handlers'
  );

// HTML content validation
export const htmlContentSchema = z.string()
  .max(1000000, 'HTML content too large') // 1MB limit
  .transform((html) => sanitizeHtml(html));

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes script tags, event handlers, and dangerous tags
 */
export function sanitizeHtml(html: string): string {
  let sanitized = html;
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'style'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>|<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  return sanitized;
}

/**
 * Validate and sanitize file path to prevent path traversal
 * Returns the normalized safe path or throws error
 */
export function validateAndNormalizePath(
  userPath: string,
  projectRoot: string
): { safe: boolean; normalized: string; absolutePath: string } {
  // Normalize the path (resolves .., ., //)
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Resolve to absolute path
  const absolutePath = path.resolve(projectRoot, normalized);
  
  // Ensure path stays within PROJECT_ROOT
  if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
    return { safe: false, normalized, absolutePath };
  }
  
  // Block access to sensitive directories
  const forbidden = ['.git', 'node_modules', '.env', '.env.local', '.env.production'];
  const pathLower = normalized.toLowerCase();
  if (forbidden.some(dir => pathLower.includes(dir.toLowerCase()))) {
    return { safe: false, normalized, absolutePath };
  }
  
  return { safe: true, normalized, absolutePath };
}

/**
 * Sanitize command string to prevent command injection
 * Removes shell metacharacters that could enable injection
 */
export function sanitizeCommand(cmd: string): string {
  // Remove dangerous shell metacharacters
  const dangerous = /[;&|`$()<>]/g;
  return cmd.replace(dangerous, '');
}

/**
 * Validate command arguments array
 * Ensures no argument contains shell metacharacters
 */
export function validateCommandArgs(args: string[]): boolean {
  const dangerous = /[;&|`$()<>]/;
  return !args.some(arg => dangerous.test(arg));
}

/**
 * Chat message validation
 */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(100000), // 100KB limit
  timestamp: z.string().datetime().optional(),
});

/**
 * File upload validation
 */
export const fileUploadSchema = z.object({
  filename: filenameSchema,
  content: z.string().max(10 * 1024 * 1024), // 10MB limit
  language: z.string().max(50).optional(),
  mimeType: z.string().max(100).optional(),
});

/**
 * Project creation validation
 */
export const projectCreateSchema = z.object({
  name: projectNameSchema,
  description: z.string().max(500).optional(),
  type: z.enum(['webapp', 'api', 'cli', 'library']).optional(),
});

/**
 * User settings validation
 */
export const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  autonomyLevel: z.enum(['basic', 'standard', 'deep', 'max']).optional(),
  emailNotifications: z.boolean().optional(),
  language: z.string().max(10).optional(),
});

/**
 * Pagination validation
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * Chat message with attachments validation
 */
export const chatMessageWithAttachmentsSchema = z.object({
  message: safeStringSchema,
  attachments: z.array(z.object({
    name: filenameSchema,
    content: z.string(),
    mimeType: z.string().regex(/^[a-z]+\/[a-z0-9\-+.]+$/i, 'Invalid MIME type')
  })).optional()
});

/**
 * Support ticket validation
 */
export const supportTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.enum(['technical', 'billing', 'feature_request', 'bug_report', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});
