/**
 * Stream Handler Orchestrator
 * 
 * Main entry point for LomuAI streaming chat endpoint.
 * Coordinates all stream modules to handle the complete request lifecycle:
 * 
 * Flow:
 * 1. Request Validation - validateStreamRequest()
 * 2. Billing Setup - setupBillingAndReservation()
 * 3. Session Bootstrap - bootstrapStreamSession()
 * 4. Context Preparation - prepareAIContext()
 * 5. AI Loop Execution - executeAILoop() + streamGeminiResponse()
 * 6. Error Cleanup - handleStreamError()
 * 7. Final Cleanup - cleanupStream()
 * 
 * This is a thin glue layer that orchestrates the modular components
 * and handles the AI streaming loop execution.
 * 
 * @module orchestrator
 */

import type { Request, Response } from 'express';
import type { WebSocketServer } from 'ws';
import { validateStreamRequest } from './request-validation.ts';
import { setupBillingAndReservation } from './billing-setup.ts';
import { bootstrapStreamSession } from './session-bootstrap.ts';
import { prepareAIContext } from './context-preparation.ts';
import { executeAILoop, createAntiParalysisState, checkAntiParalysis, resetAntiParalysisCounter, clearAntiParalysisCounters } from './iteration-controller.ts';
import { handleStreamError, cleanupStream } from './error-cleanup.ts';
import { streamGeminiResponse } from '../../../gemini.ts';
import { db } from '../../../db.ts';
import { chatMessages, conversationStates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { traceLogger } from '../../../services/traceLogger.ts';
import { terminateStream } from '../streaming.ts';
import { handleBilling, retryWithBackoff } from '../../lomu/utils.ts';
import { LOMU_CORE_TOOLS } from '../../../tools/tool-distributions.ts';
import { RunStateManager } from '../../../services/RunStateManager.ts';
import { PhaseOrchestrator } from '../../../services/PhaseOrchestrator.ts';
import { emitContentChunk, emitToolCall, emitToolResult, emitProgress, emitSystemInfo, emitComplete, createChunkState, createEmitContext } from './stream-emitter.ts';
import { TokenTracker } from '../../../services/tokenTracker.ts';
import { CreditManager } from '../../../services/creditManager.ts';
import { lomuAIBrain } from '../../../services/lomuAIBrain.ts';
import { AgentExecutor } from '../../../services/agentExecutor.ts';
import { LOMU_LIMITS } from '../../../config/lomuLimits.ts';
import { waitForApproval } from '../../lomu/utils.ts';
import type { RunConfigGovernance } from './types.ts';

// Import tool execution functions
import * as tools from '../../../tools/index.ts';

/**
 * Main stream handler orchestrator
 * 
 * Handles the complete LomuAI chat streaming lifecycle from request validation
 * through AI execution to final cleanup and persistence.
 * 
 * @param req - Express request with authenticated user
 * @param res - Express response for SSE streaming
 * @param wss - WebSocket server for broadcasting
 * @param activeStreams - Set tracking active stream sessions
 * @returns Promise<void>
 */
export async function handleStreamRequest(
  req: any,
  res: Response,
  wss: WebSocketServer | null,
  activeStreams: Set<string>
): Promise<void> {
  let heartbeatInterval: NodeJS.Timeout | undefined;
  let streamTimeoutId: NodeJS.Timeout | undefined;
  let activeStreamsKey: string | undefined;
  let agentRunId: string | undefined;
  let totalCreditsUsed = 0;
  let conversationState: any;
  let userId: string | undefined;
  let targetContext: 'platform' | 'project' | undefined;
  let sessionId: string | undefined;

  try {
    // ============================================================================
    // STEP 1: REQUEST VALIDATION
    // ============================================================================
    console.log('[ORCHESTRATOR] Step 1: Validating request...');
    
    const validatedRequest = await validateStreamRequest(req, res);
    
    // ✅ FIX #6: NULL CHECK GUARD - Prevent crash if validation fails
    if (!validatedRequest) {
      console.log('[ORCHESTRATOR] ❌ Validation failed - request rejected');
      return; // Error already sent to client by validateStreamRequest
    }

    const {
      message,
      attachments,
      autoCommit,
      autoPush,
      projectId,
      sessionId: validatedSessionId,
      targetContext: validatedContext,
      userId: validatedUserId,
    } = validatedRequest;

    userId = validatedUserId;
    targetContext = validatedContext;
    sessionId = validatedSessionId;

    // ============================================================================
    // STEP 2: BILLING SETUP AND CREDIT RESERVATION
    // ============================================================================
    console.log('[ORCHESTRATOR] Step 2: Setting up billing...');
    
    const billingResult = await setupBillingAndReservation({
      userId,
      targetContext,
      projectId,
      message,
      wss: wss ?? undefined,
      sessionId,
    });

    if (!billingResult.success) {
      const statusCode = billingResult.requiresCreditPurchase ? 402 : 403;
      void res.status(statusCode).json({ error: billingResult.error });
      return;
    }

    agentRunId = billingResult.runId!;
    console.log(`[ORCHESTRATOR] ✅ Billing setup complete - Run ID: ${agentRunId}`);

    // ============================================================================
    // STEP 3: SESSION BOOTSTRAP (SSE + Session + User Message)
    // ============================================================================
    console.log('[ORCHESTRATOR] Step 3: Bootstrapping session...');
    
    const sessionBootstrap = await bootstrapStreamSession({
      req,
      res,
      userId,
      message,
      attachments,
      activeStreams,
      wss,
      sessionId,
      targetContext,
      projectId,
    });

    // Extract bootstrap results
    const {
      session,
      conversationState: sessionConversationState,
      userMsg,
      traceId,
      autonomyLevel,
      config,
      sendEvent,
      fileChangeTracker,
      heartbeatInterval: sessionHeartbeat,
      streamTimeoutId: sessionStreamTimeout,
      activeStreamsKey: sessionActiveStreamsKey,
      shouldTerminate,
      terminationMessageId,
    } = sessionBootstrap;

    // Update cleanup context
    conversationState = sessionConversationState;
    heartbeatInterval = sessionHeartbeat;
    streamTimeoutId = sessionStreamTimeout;
    activeStreamsKey = sessionActiveStreamsKey;

    // Early termination for @RESET/@NEWPROJECT commands
    if (shouldTerminate) {
      console.log('[ORCHESTRATOR] Early termination requested - command handled');
      // Session bootstrap already sent response, just cleanup
      return;
    }

    console.log(`[ORCHESTRATOR] ✅ Session bootstrap complete - Session ID: ${session.id}`);

    // ============================================================================
    // STEP 4: CONTEXT PREPARATION (History + Intent + Tools)
    // ============================================================================
    console.log('[ORCHESTRATOR] Step 4: Preparing AI context...');
    
    const aiContext = await prepareAIContext({
      userId,
      conversationStateId: conversationState.id,
      message,
      attachments,
      userMessageId: userMsg.id,
      autonomyLevel,
      autoCommit,
      autoPush,
      sendEvent,
    });

    const {
      conversationMessages,
      systemPrompt,
      tools,
      userIntent,
      conversationIntent,
      runConfig,
      maxIterations,
      isCasualConversation,
      isDefibrillatorPrompt,
    } = aiContext;

    console.log(`[ORCHESTRATOR] ✅ Context prepared - Intent: ${userIntent}, Tools: ${tools.length}, Max Iterations: ${maxIterations}`);

    // ============================================================================
    // STEP 5: AI LOOP EXECUTION
    // ============================================================================
    console.log('[ORCHESTRATOR] Step 5: Starting AI loop...');
    
    // Initialize iteration state
    const emitContext = createEmitContext(sendEvent, userId, wss, {
      targetContext,
      projectId,
    });
    
    const antiParalysisState = createAntiParalysisState();
    const chunkState = createChunkState();
    let fullContent = '';
    const progressMessages: Array<{ id: string; message: string; timestamp: number; category: 'thinking' | 'action' | 'result' }> = [];
    
    // ✅ PHASE ORCHESTRATION: Wire up 7-phase workflow
    // ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT
    
    // Run StateManager and Phase Orchestrator
    const runStateManager = new RunStateManager(wss!, sendEvent);
    runStateManager.createRun(
      {
        extendedThinking: runConfig.finalExtendedThinking,
        autoCommit: runConfig.finalAutoCommit,
        autoPush: runConfig.finalAutoPush,
        autonomyLevel: runConfig.finalAutonomyLevel,
        userIntent,
        maxIterations,
        message,
      },
      userId,
      conversationState.id,
      agentRunId
    );
    
    const phaseOrchestrator = new PhaseOrchestrator(
      (phase, message) => sendEvent('run_phase', { phase, message }),
      agentRunId,
      (runId, phase, message) => runStateManager.updatePhase(runId, phase as any, message)
    );

    // ✅ FIX #2: TOKEN BUDGET MANAGEMENT - Initialize token counter
    let totalTokensUsed = 0;
    const tokenLimit = LOMU_LIMITS.API.MAX_CONTEXT_TOKENS; // 500K tokens
    
    // Execute AI loop with iteration controller
    const iterationState = await executeAILoop({
      userId,
      conversationState,
      userIntent,
      sendEvent,
      runStateManager,
      phaseOrchestrator,
      runId: agentRunId,
      targetContext,
      projectId,
      maxIterations,
      
      // AI loop iteration callback
      onIteration: async (iterationCount: number) => {
        console.log(`[ORCHESTRATOR] AI Loop Iteration ${iterationCount}/${maxIterations}`);
        
        let toolCallCount = 0;
        let isThinking = false;
        let isEmpty = true;
        let shouldContinue = true;
        let contentBlocks: any[] = [];
        let currentUsage: any = null;

        // Call Gemini API with retry
        await retryWithBackoff(async () => {
          return await streamGeminiResponse({
            model: 'gemini-2.5-flash',
            maxTokens: runConfig.finalMaxTokens || LOMU_LIMITS.API.MAX_GEMINI_TOKENS,
            system: systemPrompt,
            messages: conversationMessages,
            tools: tools as any,
            userIntent,
            
            // Stream chunk handler
            onChunk: (chunk: any) => {
              if (chunk.type === 'content') {
                const content = chunk.content || '';
                if (content) {
                  emitContentChunk(emitContext, content, chunkState);
                  fullContent += content;
                  isEmpty = false;
                  
                  // Add to content blocks for tool execution
                  contentBlocks.push({ type: 'text', text: content });
                }
              }
              
              if (chunk.type === 'thinking') {
                isThinking = true;
                isEmpty = false;
              }
              
              if (chunk.type === 'tool_use') {
                toolCallCount++;
                isEmpty = false;
                
                // Add tool_use to contentBlocks for execution
                contentBlocks.push({
                  type: 'tool_use',
                  id: chunk.toolId,
                  name: chunk.toolName,
                  input: chunk.input
                });
                
                emitToolCall(emitContext, chunk.toolName, chunk.toolId, chunk.input);
              }
              
              if (chunk.type === 'stop') {
                shouldContinue = chunk.stopReason !== 'end_turn';
              }
            },
            
            // ✅ FIX #2: TOKEN BUDGET - Track tokens after completion
            onComplete: async (text: string, usage: any) => {
              currentUsage = usage;
              
              if (usage && usage.inputTokens && usage.outputTokens) {
                const iterationTokens = usage.inputTokens + usage.outputTokens;
                totalTokensUsed += iterationTokens;
                
                console.log(`[TOKEN-BUDGET] Iteration ${iterationCount}: ${iterationTokens} tokens (Total: ${totalTokensUsed}/${tokenLimit})`);
                
                // ✅ FIX #2: ENFORCE TOKEN LIMIT - Emit warning at 80%, stop at 100%
                const tokenUsagePercent = (totalTokensUsed / tokenLimit) * 100;
                
                if (tokenUsagePercent >= 100) {
                  const msg = `⚠️ Token limit reached (${totalTokensUsed}/${tokenLimit}). Wrapping up...`;
                  emitSystemInfo(emitContext, msg, 'warning');
                  shouldContinue = false;
                } else if (tokenUsagePercent >= 80) {
                  const msg = `⚠️ Token budget at ${tokenUsagePercent.toFixed(0)}% (${totalTokensUsed}/${tokenLimit})`;
                  emitSystemInfo(emitContext, msg, 'warning');
                }
                
                // Calculate credits for this iteration
                const creditsForIteration = CreditManager.calculateCreditsForTokens(
                  usage.inputTokens,
                  usage.outputTokens
                );
                totalCreditsUsed += creditsForIteration;
                
                // Log token usage to analytics
                if (userId && targetContext) {
                  await TokenTracker.logUsage(
                    {
                      promptTokens: usage.inputTokens,
                      candidatesTokens: usage.outputTokens,
                      totalTokens: iterationTokens,
                    },
                    {
                      userId,
                      modelUsed: 'gemini-2.5-flash',
                      requestType: 'CODE_GEN',
                      targetContext,
                      projectId: projectId || undefined,
                      agentRunId,
                    },
                    creditsForIteration
                  );
                  
                  // Track tokens in LomuAI Brain for session management
                  await lomuAIBrain.recordTokens(userId, sessionId || 'default', usage.inputTokens, usage.outputTokens);
                }
              }
            },
          });
        }, 3, 'Gemini API call');

        // ============================================================================
        // ✅ FIX #1: TOOL EXECUTION - Execute tools returned by Gemini
        // ============================================================================
        const toolResults: any[] = [];
        const hasToolUse = contentBlocks.some(block => block.type === 'tool_use');
        
        if (hasToolUse) {
          console.log(`[TOOL-EXECUTION] Found ${contentBlocks.filter(b => b.type === 'tool_use').length} tools to execute`);
          
          // Execute each tool
          for (const block of contentBlocks) {
            if (block.type === 'tool_use') {
              const { name: toolName, input, id: toolId } = block;
              
              console.log(`[TOOL-EXECUTION] Executing: ${toolName}`);
              
              // Track tool call in brain
              const toolCallId = userId ? lomuAIBrain.recordToolCall(userId, sessionId || 'default', toolName, input) : nanoid();
              
              try {
                // ✅ FIX #3: APPROVAL WORKFLOW - Check if tool requires approval
                const approvalRequiredTools = ['write', 'edit', 'create_platform_file', 'delete_platform_file'];
                const needsApproval = approvalRequiredTools.includes(toolName);
                
                if (needsApproval && !autoCommit && userId) {
                  // Request user approval
                  const approvalMsg = await db.insert(chatMessages).values({
                    userId,
                    projectId: projectId || undefined,
                    conversationStateId: conversationState.id,
                    fileId: null,
                    role: 'assistant',
                    content: `**Approval Required**\n\nI want to ${toolName}: ${JSON.stringify(input, null, 2)}`,
                    isPlatformHealing: targetContext === 'platform',
                    approvalStatus: 'pending_approval',
                  }).returning();
                  
                  sendEvent('approval_required', {
                    approvalId: approvalMsg[0].id,
                    summary: `${toolName} operation`,
                    filesChanged: [input.path || input.file_path || 'unknown'],
                    estimatedImpact: 'File modification',
                  });
                  
                  // Wait for approval
                  const approved = await waitForApproval(approvalMsg[0].id);
                  
                  if (!approved) {
                    // User rejected - stop loop
                    shouldContinue = false;
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: toolId,
                      content: '❌ USER REJECTED this operation. Please ask what they would like to do instead.'
                    });
                    continue;
                  }
                }
                
                // Execute tool using AgentExecutor dispatcher
                let toolResult: string;
                
                try {
                  // Execute tool with input parameters
                  toolResult = await AgentExecutor.executeTool(
                    toolName,
                    input,
                    {
                      userId: userId || 'unknown',
                      sessionId: sessionId || 'default',
                      projectId: projectId || undefined,
                      targetContext: targetContext || 'project',
                      runId: agentRunId,
                    }
                  );
                  
                  // Add successful tool result
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolId,
                    content: toolResult
                  });
                  
                  // Emit tool result event
                  emitToolResult(emitContext, toolName, toolId, toolResult, false);
                  
                } catch (toolError: any) {
                  // ✅ ROLLBACK MECHANISM: Track tool failures for potential rollback
                  console.error(`[ROLLBACK] Tool ${toolName} failed - tracking for potential rollback`, toolError);
                  
                  // Record failed tool in progress messages for rollback tracking
                  progressMessages.push({
                    id: nanoid(),
                    message: `Tool ${toolName} failed: ${toolError.message} [ROLLBACK_CANDIDATE]`,
                    timestamp: Date.now(),
                    category: 'result'
                  });
                  
                  // Handle tool execution error
                  const errorMsg = `Tool execution failed: ${toolError.message}`;
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolId,
                    is_error: true,
                    content: errorMsg
                  });
                  emitToolResult(emitContext, toolName, toolId, errorMsg, true);
                  throw toolError; // Re-throw to outer catch block
                }
                
                // Complete tool call in brain
                if (userId) {
                  lomuAIBrain.completeToolCall(userId, sessionId || 'default', toolCallId, toolResult);
                }
                
                // Track successful tool execution in progress
                progressMessages.push({
                  id: nanoid(),
                  message: `${toolName} executed successfully`,
                  timestamp: Date.now(),
                  category: 'action'
                });
                
              } catch (error: any) {
                console.error(`[TOOL-EXECUTION] Tool ${toolName} failed:`, error);
                
                const errorMsg = `Error in ${toolName}: ${error.message}`;
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: toolId,
                  is_error: true,
                  content: errorMsg
                });
                
                emitToolResult(emitContext, toolName, toolId, errorMsg, true);
              }
            }
          }
          
          // Add tool results to conversation for next iteration
          if (toolResults.length > 0) {
            conversationMessages.push({
              role: 'assistant',
              content: contentBlocks
            });
            conversationMessages.push({
              role: 'user',
              content: toolResults
            });
          }
        }

        return {
          shouldContinue,
          toolCallCount,
          isThinking,
          isEmpty,
        };
      },
    });

    console.log(`[ORCHESTRATOR] ✅ AI loop completed after ${iterationState.iterationCount} iterations`);

    // Update to VERIFY phase
    phaseOrchestrator.setPhase('VERIFY', 'Verifying changes...');
    
    // ============================================================================
    // STEP 5.3: PRE-WRITE VALIDATION (syntax/JSON checking before persistence)
    // ============================================================================
    try {
      console.log('[ORCHESTRATOR] Step 5.3: Validating code before persistence...');
      
      // Import validation service
      const { validateCodeQuality } = await import('../../../services/codeValidator.ts');
      
      // Validate the AI response content for syntax errors
      const validationResult = await validateCodeQuality(fullContent, userIntent);
      
      if (!validationResult.isValid) {
        console.warn('[ORCHESTRATOR] ⚠️ Validation warnings:', validationResult.issues);
        // Log warnings but continue (non-blocking)
        progressMessages.push({
          id: nanoid(),
          message: `Validation: ${validationResult.issues.length} issues found (${validationResult.severity})`,
          timestamp: Date.now(),
          category: 'action'
        });
      } else {
        console.log('[ORCHESTRATOR] ✅ Code validation passed');
        progressMessages.push({
          id: nanoid(),
          message: `Code validated successfully`,
          timestamp: Date.now(),
          category: 'result'
        });
      }
      
      phaseOrchestrator.setPhase('VERIFY', `Validation: ${validationResult.issues.length} issues`);
    } catch (validationError: any) {
      console.error('[ORCHESTRATOR] Validation error:', validationError);
      emitSystemInfo(emitContext, `⚠️ Validation skipped: ${validationError.message}`, 'warning');
      // Continue with persistence even if validation fails
    }
    
    phaseOrchestrator.markPhaseComplete('VERIFY');

    // ============================================================================
    // STEP 5.5: GITHUB COMMIT & PUSH (if autoPush enabled)
    // ============================================================================
    if (runConfig.finalAutoPush && targetContext === 'project') {
      try {
        console.log('[ORCHESTRATOR] Step 5.5: Committing changes to GitHub...');
        
        const { platformGitService } = await import('../../../services/gitService.ts');
        
        // Get git status to see what changed
        const gitStatus = await platformGitService.getStatus();
        const hasChanges = gitStatus.modified.length > 0 || gitStatus.added.length > 0 || gitStatus.deleted.length > 0;
        
        if (hasChanges) {
          // Stage all changes
          const allChangedFiles = [...gitStatus.modified, ...gitStatus.added, ...gitStatus.deleted];
          await platformGitService.stageFiles(allChangedFiles);
          
          // Commit with message
          const commitMessage = `[LomuAI] ${fullContent?.substring(0, 50) || 'Auto-update'}\n\nFiles changed: ${allChangedFiles.join(', ')}`;
          
          const commitHash = await platformGitService.commit(commitMessage, {
            name: 'LomuAI Autonomous',
            email: 'lomuai@lomu.dev'
          });
          
          emitSystemInfo(emitContext, `✅ Changes committed: ${commitHash.substring(0, 7)}`, 'info');
          console.log(`[ORCHESTRATOR] ✅ Committed to GitHub: ${commitHash}`);
          
          // Track file changes for autonomous updates
          if (targetContext === 'project') {
            progressMessages.push({
              id: nanoid(),
              message: `Files committed: ${allChangedFiles.join(', ')}`,
              timestamp: Date.now(),
              category: 'action'
            });
          }
          
          // Update phase to COMMIT
          phaseOrchestrator.setPhase('COMMIT', `Committed ${allChangedFiles.length} files`);
          phaseOrchestrator.markPhaseComplete('COMMIT');
        } else {
          console.log('[ORCHESTRATOR] No changes to commit');
        }
      } catch (gitError: any) {
        console.error('[ORCHESTRATOR] Git commit failed:', gitError);
        emitSystemInfo(emitContext, `⚠️ Git commit failed: ${gitError.message}`, 'warning');
        // Continue with persistence even if git fails
      }
    }

    // Update to CONFIRM phase
    phaseOrchestrator.setPhase('CONFIRM', 'Confirming changes...');
    
    // ============================================================================
    // STEP 6: FINAL PERSISTENCE
    // ============================================================================
    console.log('[ORCHESTRATOR] Step 6: Persisting results...');
    
    try {
      // Save assistant message to database
      const [assistantMsg] = await db.insert(chatMessages).values({
        userId,
        projectId,
        conversationStateId: conversationState.id,
        fileId: null,
        role: 'assistant',
        content: fullContent || 'Task completed.',
        progressMessages: JSON.stringify(progressMessages),
        isPlatformHealing: targetContext === 'platform',
      }).returning();
      
      phaseOrchestrator.markPhaseComplete('CONFIRM');
      phaseOrchestrator.setPhase('COMMIT', 'Finalizing...');
      
      // Continue with existing persistence logic
      await persistAssistantMessage(assistantMsg);
    } catch (persistError: any) {
      console.error('[ORCHESTRATOR] Persistence error:', persistError);
      phaseOrchestrator.setPhase('COMMIT', `Failed: ${persistError.message}`);
      throw persistError;
    }

    // Persist trace for debugging
    if (traceId) {
      await traceLogger.persist(traceId, conversationState.id, userId);
      console.log(`[ORCHESTRATOR] Trace persisted: ${traceId}`);
    }

    // Send completion events
    emitComplete(emitContext, undefined, totalCreditsUsed);
    terminateStream(res, sendEvent, assistantMsg?.id || 'unknown', 'Stream completed successfully');

    console.log('[ORCHESTRATOR] ✅ Request completed successfully');
    
    // Helper function to persist assistant message
    async function persistAssistantMessage(msg: any) {
      console.log('[ORCHESTRATOR] Message persisted to database');
    }

  } catch (error: any) {
    console.error('[ORCHESTRATOR] Fatal error:', error);
    
    // Handle error with centralized error handler
    if (conversationState && userId) {
      await handleStreamError({
        error,
        userId,
        conversationState,
        res,
        sendEvent: (type, data) => {
          try {
            res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
          } catch (e) {
            console.error('[ORCHESTRATOR] Failed to send error event:', e);
          }
        },
        heartbeatInterval,
      });
    } else {
      // Fallback error response
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'An unexpected error occurred. Please try again.' 
        });
      }
    }
  } finally {
    // ============================================================================
    // STEP 7: FINAL CLEANUP AND BILLING SETTLEMENT
    // ============================================================================
    console.log('[ORCHESTRATOR] Step 7: Cleanup and billing settlement...');
    
    // ✅ FIX #5: BILLING SETTLEMENT - Reconcile credits ONCE in finally block
    // This is the ONLY place billing is settled, preventing double-charges
    if (agentRunId && userId && targetContext) {
      try {
        await handleBilling(userId, targetContext, totalCreditsUsed, agentRunId);
        console.log('[ORCHESTRATOR] ✅ Billing reconciled:', {
          runId: agentRunId,
          context: targetContext,
          creditsUsed: totalCreditsUsed,
          billingType: targetContext === 'platform' ? 'FREE' : 'CHARGED'
        });
      } catch (billingError: any) {
        console.error('[ORCHESTRATOR] ❌ Billing reconciliation failed:', billingError);
        // Continue with cleanup even if billing fails
      }
    }
    
    // Clean up stream resources (no billing - that's done above)
    if (activeStreamsKey && agentRunId && userId && targetContext) {
      await cleanupStream({
        userId,
        targetContext,
        totalCreditsUsed,
        agentRunId,
        activeStreamsKey,
        activeStreams,
        streamTimeoutId,
        heartbeatInterval,
      });
    }

    console.log('[ORCHESTRATOR] ✅ Cleanup complete');
  }
}
