import type { Response } from 'express';
import type { StreamRequest, ValidationResult } from './types.ts';
import { validateContextAccess } from '../utils.ts';
import { chatMessageSchema, safeStringSchema } from '../../../validation/inputValidator.ts';

/**
 * Validated request parameters after successful validation
 * Contains all extracted and validated parameters ready for processing
 */
export interface ValidatedStreamRequest {
  message: string;
  attachments: Array<{
    fileName: string;
    fileType: string;
    content: string;
    mimeType: string;
    size: number;
  }>;
  autoCommit: boolean;
  autoPush: boolean;
  projectId: string | null;
  sessionId?: string;
  targetContext: 'platform' | 'project';
  userId: string;
}

/**
 * Validation result containing either validated parameters or error details
 */
export type RequestValidationResult = 
  | { success: true; data: ValidatedStreamRequest }
  | { success: false; statusCode: number; error: string; details?: any };

/**
 * STEP 1: Extract and validate all request parameters for BeeHive stream endpoint
 * 
 * Performs comprehensive validation of incoming stream requests:
 * - Extracts all required and optional parameters
 * - Validates targetContext is 'platform' or 'project'
 * - Validates message is a non-empty string
 * - Validates GEMINI_API_KEY environment variable exists
 * - Validates user has access to the requested context (platform/project)
 * 
 * @param req - Express request object with authenticated user
 * @param res - Express response object for sending error responses
 * @returns Validated request data if successful, null if validation fails (error sent via res)
 * 
 * @example
 * ```typescript
 * const validatedRequest = await validateStreamRequest(req, res);
 * if (!validatedRequest) return; // Error already sent to client
 * 
 * const { message, targetContext, projectId } = validatedRequest;
 * // Continue with stream processing...
 * ```
 */
export async function validateStreamRequest(
  req: any, 
  res: Response
): Promise<ValidatedStreamRequest | null> {
  console.log('[LOMU-AI-CHAT] Stream request received');
  
  // ============================================================================
  // STEP 1.1: Extract request parameters with defaults and auto-detection
  // ============================================================================
  
  const { 
    message, 
    attachments = [], 
    autoCommit = false, 
    autoPush = false, 
    projectId = null,
    sessionId,  // Extract sessionId for billing event correlation
    targetContext = (projectId ? 'project' : 'platform') // Auto-detect from projectId if not provided
  } = req.body as StreamRequest;
  
  const userId = req.authenticatedUserId;
  
  console.log('[LOMU-AI-CHAT] Message:', message?.substring(0, 50), 
    'Context:', targetContext, 
    'Attachments:', attachments?.length || 0, 
    'UserId:', userId, 
    'ProjectId:', projectId || 'none');

  // ============================================================================
  // STEP 1.2: Validate targetContext
  // ============================================================================
  
  if (targetContext !== 'platform' && targetContext !== 'project') {
    console.log('[LOMU-AI-CHAT] ERROR: Invalid targetContext');
    res.status(400).json({ 
      error: 'Invalid targetContext. Must be "platform" or "project".' 
    });
    return null;
  }

  // ============================================================================
  // STEP 1.3: Validate message parameter using Zod schema
  // ============================================================================
  
  if (!message || typeof message !== 'string') {
    console.log('[LOMU-AI-CHAT] ERROR: Message validation failed - empty or invalid type');
    res.status(400).json({ 
      error: 'Oops! I need a message to help you. What would you like me to work on?' 
    });
    return null;
  }

  // CRITICAL SECURITY: Validate message content using Zod schema
  const messageValidation = safeStringSchema.safeParse(message);
  if (!messageValidation.success) {
    console.log('[LOMU-AI-CHAT] ERROR: Message validation failed -', messageValidation.error.errors);
    res.status(400).json({
      error: 'Invalid message content',
      details: messageValidation.error.errors
    });
    return null;
  }

  // ============================================================================
  // STEP 1.4: Validate GEMINI_API_KEY environment variable
  // ============================================================================
  
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.log('[LOMU-AI-CHAT] ERROR: No Gemini API key');
    res.status(503).json({ 
      error: 'Hmm, my AI brain isn\'t connected yet. The Gemini API key needs to be configured. Could you set it up in your environment variables?' 
    });
    return null;
  }
  
  // ============================================================================
  // STEP 1.5: Validate context access (owner-only for platform, ownership for projects)
  // ============================================================================
  
  const accessCheck = await validateContextAccess(userId, targetContext, projectId);
  if (!accessCheck.allowed) {
    console.log('[LOMU-AI-CHAT] ERROR: Access denied -', accessCheck.reason);
    res.status(403).json({ 
      error: accessCheck.reason,
      targetContext,
      requiresOwnership: targetContext === 'platform'
    });
    return null;
  }

  // ============================================================================
  // STEP 1.6: Return validated parameters
  // ============================================================================
  
  console.log('[LOMU-AI-CHAT] ✅ Request validation passed');
  
  return {
    message,
    attachments,
    autoCommit,
    autoPush,
    projectId,
    sessionId,
    targetContext,
    userId,
  };
}

/**
 * Lightweight validation result builder (for internal use)
 * Creates a structured validation result without sending HTTP response
 * 
 * @param req - Express request object
 * @returns Validation result object with success/failure details
 */
export async function buildValidationResult(
  req: any
): Promise<RequestValidationResult> {
  const { 
    message, 
    attachments = [], 
    autoCommit = false, 
    autoPush = false, 
    projectId = null,
    sessionId,
    targetContext = (projectId ? 'project' : 'platform')
  } = req.body as StreamRequest;
  
  const userId = req.authenticatedUserId;

  // Validate targetContext
  if (targetContext !== 'platform' && targetContext !== 'project') {
    return {
      success: false,
      statusCode: 400,
      error: 'Invalid targetContext. Must be "platform" or "project".'
    };
  }

  // Validate message
  if (!message || typeof message !== 'string') {
    return {
      success: false,
      statusCode: 400,
      error: 'Oops! I need a message to help you. What would you like me to work on?'
    };
  }

  // Validate GEMINI_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return {
      success: false,
      statusCode: 503,
      error: 'Hmm, my AI brain isn\'t connected yet. The Gemini API key needs to be configured. Could you set it up in your environment variables?'
    };
  }

  // Validate context access
  const accessCheck = await validateContextAccess(userId, targetContext, projectId);
  if (!accessCheck.allowed) {
    return {
      success: false,
      statusCode: 403,
      error: accessCheck.reason || 'Access denied',
      details: {
        targetContext,
        requiresOwnership: targetContext === 'platform'
      }
    };
  }

  // Return validated parameters
  return {
    success: true,
    data: {
      message,
      attachments,
      autoCommit,
      autoPush,
      projectId,
      sessionId,
      targetContext,
      userId,
    }
  };
}
