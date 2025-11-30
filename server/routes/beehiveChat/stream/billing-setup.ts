/**
 * Billing and Access Control Setup Module
 * 
 * Extracted from lomuChat.ts lines 732-773 (STEP 2 and billing section)
 * Handles:
 * - Context access validation (owner-only for platform, ownership check for projects)
 * - Token estimation for credit reservation
 * - Agent run initialization and credit reservation via AgentExecutor
 * - Insufficient credits error handling
 * 
 * This module separates billing concerns from the main stream handler,
 * making it easier to test, maintain, and extend billing logic.
 */

import type { WebSocketServer } from 'ws';
import type { BillingSetupResult, AgentRunStartParams } from './types.ts';
import { validateContextAccess } from '../../lomu/utils.ts';
import { calculateTokenEstimate } from '../billing.ts';
import { AgentExecutor } from '../../../services/agentExecutor.ts';

/**
 * Parameters for billing and reservation setup
 */
export interface BillingSetupParams {
  userId: string;
  targetContext: 'platform' | 'project';
  projectId: string | null;
  message: string;
  wss?: WebSocketServer;
  sessionId?: string;
}

/**
 * Setup billing and credit reservation for BeeHive stream
 * 
 * This function orchestrates the billing workflow:
 * 1. Validates user access based on context (platform = owner-only, project = ownership check)
 * 2. Estimates token usage using conversation history and message length
 * 3. Starts agent run and reserves credits via AgentExecutor
 * 4. Returns success/failure with appropriate error details
 * 
 * @param params - Billing setup parameters
 * @returns BillingSetupResult with runId and credits info, or error details
 * 
 * @example
 * ```typescript
 * const billingResult = await setupBillingAndReservation({
 *   userId: 'user123',
 *   targetContext: 'project',
 *   projectId: 'proj456',
 *   message: 'Build a new feature',
 *   wss: websocketServer,
 *   sessionId: 'session789'
 * });
 * 
 * if (!billingResult.success) {
 *   if (billingResult.requiresCreditPurchase) {
 *     return res.status(402).json({ error: billingResult.error });
 *   } else {
 *     return res.status(403).json({ error: billingResult.error });
 *   }
 * }
 * 
 * const agentRunId = billingResult.runId;
 * ```
 */
export async function setupBillingAndReservation(
  params: BillingSetupParams
): Promise<BillingSetupResult> {
  const { userId, targetContext, projectId, message, wss, sessionId } = params;

  console.log('[BILLING-SETUP] Starting billing and reservation setup', {
    userId,
    targetContext,
    projectId: projectId || 'none',
    messageLength: message.length,
    hasWebSocket: !!wss,
    hasSession: !!sessionId,
  });

  // ============================================================================
  // STEP 1: Validate context access
  // ============================================================================
  // Platform healing: owner-only access
  // Project work: ownership check for the specific project
  
  try {
    const accessCheck = await validateContextAccess(userId, targetContext, projectId);
    
    if (!accessCheck.allowed) {
      console.log('[BILLING-SETUP] ❌ Access denied -', accessCheck.reason);
      return {
        success: false,
        error: accessCheck.reason || 'Access denied',
        requiresCreditPurchase: false,
      };
    }
    
    console.log('[BILLING-SETUP] ✅ Access validation passed');
  } catch (error: any) {
    console.error('[BILLING-SETUP] Access validation error:', error);
    return {
      success: false,
      error: 'Failed to validate access permissions',
      requiresCreditPurchase: false,
    };
  }

  // ============================================================================
  // STEP 2: Estimate tokens for credit reservation
  // ============================================================================
  // Uses conversation history + current message to estimate input tokens
  // Estimates output tokens conservatively (max of 1000 or 50% of input)
  
  let estimatedInputTokens: number;
  let estimatedOutputTokens: number;
  
  try {
    const isPlatformHealing = targetContext === 'platform';
    const tokenEstimate = await calculateTokenEstimate(userId, message, isPlatformHealing);
    
    estimatedInputTokens = tokenEstimate.inputTokens;
    estimatedOutputTokens = tokenEstimate.outputTokens;
    
    console.log('[BILLING-SETUP] Token estimation complete', {
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      total: estimatedInputTokens + estimatedOutputTokens,
    });
  } catch (error: any) {
    console.error('[BILLING-SETUP] Token estimation error:', error);
    return {
      success: false,
      error: 'Failed to estimate token usage for billing',
      requiresCreditPurchase: false,
    };
  }

  // ============================================================================
  // STEP 3: Start agent run and reserve credits
  // ============================================================================
  // AgentExecutor handles:
  // - Creating agent run record in database
  // - Reserving credits based on token estimates
  // - Emitting billing events via WebSocket (if wss provided)
  // - Checking user has sufficient credits
  // 
  // Platform context: FREE (no credit deduction)
  // Project context: PAID (credits reserved and deducted)
  
  try {
    const runParams: AgentRunStartParams = {
      userId,
      projectId: projectId || null,
      estimatedInputTokens,
      estimatedOutputTokens,
      targetContext,
      wss: wss || undefined,
      sessionId: sessionId || undefined,
    };
    
    console.log('[BILLING-SETUP] Starting agent run with credit reservation', runParams);
    
    const runResult = await AgentExecutor.startRun(runParams);
    
    if (!runResult.success) {
      console.error('[BILLING-SETUP] ❌ Agent run failed to start:', runResult.error);
      
      // Check if failure is due to insufficient credits
      const isInsufficientCredits = 
        runResult.error?.includes('insufficient') || 
        runResult.error?.includes('credits');
      
      return {
        success: false,
        error: runResult.error || 'Failed to start agent run',
        creditsNeeded: runResult.creditsReserved,
        requiresCreditPurchase: isInsufficientCredits,
      };
    }
    
    console.log('[BILLING-SETUP] ✅ Agent run started successfully', {
      runId: runResult.runId,
      creditsReserved: runResult.creditsReserved,
    });
    
    return {
      success: true,
      runId: runResult.runId,
      creditsReserved: runResult.creditsReserved,
    };
  } catch (error: any) {
    console.error('[BILLING-SETUP] Unexpected error during agent run creation:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error during billing setup',
      requiresCreditPurchase: false,
    };
  }
}

/**
 * Validate billing setup parameters
 * Ensures all required fields are present and valid
 */
export function validateBillingParams(params: BillingSetupParams): { valid: boolean; error?: string } {
  if (!params.userId || typeof params.userId !== 'string') {
    return { valid: false, error: 'userId is required and must be a string' };
  }
  
  if (!params.targetContext || !['platform', 'project'].includes(params.targetContext)) {
    return { valid: false, error: 'targetContext must be "platform" or "project"' };
  }
  
  if (params.targetContext === 'project' && !params.projectId) {
    return { valid: false, error: 'projectId is required for project context' };
  }
  
  if (!params.message || typeof params.message !== 'string') {
    return { valid: false, error: 'message is required and must be a string' };
  }
  
  return { valid: true };
}

/**
 * Helper to format billing error response for HTTP response
 * Maps BillingSetupResult to appropriate HTTP status code and error object
 */
export function formatBillingError(result: BillingSetupResult): { status: number; body: any } {
  if (result.requiresCreditPurchase) {
    return {
      status: 402,
      body: {
        error: result.error,
        creditsNeeded: result.creditsNeeded,
        requiresCreditPurchase: true,
      },
    };
  }
  
  return {
    status: 403,
    body: {
      error: result.error,
      targetContext: result.error?.includes('platform') ? 'platform' : undefined,
      requiresOwnership: result.error?.includes('owner') ? true : undefined,
    },
  };
}
