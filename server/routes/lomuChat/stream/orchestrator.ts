/**
 * Stream Handler Orchestrator
 * 
 * Main entry point for BeeHive streaming chat endpoint.
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
import { emitContentChunk, emitToolCall, emitToolResult, emitProgress, emitSystemInfo, emitComplete, emitThinking, createChunkState, createEmitContext, emitTaskUpdate, emitPhaseTransition } from './stream-emitter.ts';
import { TokenTracker } from '../../../services/tokenTracker.ts';
import { CreditManager } from '../../../services/creditManager.ts';
import { beehiveAIBrain } from '../../../services/lomuAIBrain.ts';
import { AgentExecutor } from '../../../services/agentExecutor.ts';
import { LOMU_LIMITS } from '../../../config/lomuLimits.ts';
import { waitForApproval } from '../../lomu/utils.ts';
import type { RunConfigGovernance } from './types.ts';
import type { ToolResult } from '../../../validation/toolResultValidators.ts';

// Import tool execution functions
import * as tools from '../../../tools/index.ts';

/**
 * Main stream handler orchestrator
 * 
 * Handles the complete BeeHive chat streaming lifecycle from request validation
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
    const allToolResults: ToolResult[] = []; // ✅ PHASE 3: Track all tool results across iterations for persistence
    
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
                  // ✅ CRITICAL FIX: Detect thinking blocks in content (format: **Title**\n\nContent\n\n\n)
                  if (content.match(/^\*\*[^*]+\*\*\n\n[\s\S]*?\n\n\n?$/)) {
                    // This is a thinking block - extract and emit as thinking
                    const titleMatch = content.match(/^\*\*([^*]+)\*\*/);
                    const title = titleMatch ? titleMatch[1] : 'Thinking';
                    const contentMatch = content.match(/^\*\*[^*]+\*\*\n\n([\s\S]*?)\n\n\n?$/);
                    const thinkingContent = contentMatch ? contentMatch[1] : content;
                    
                    // ✅ Wrap emit in try-catch to prevent silent failures
                    try {
                      emitThinking(emitContext, title, thinkingContent, progressMessages);
                    } catch (emitError) {
                      console.error('[ORCHESTRATOR] emitThinking failed:', emitError);
                    }
                    isThinking = true;
                  } else {
                    // Regular content - emit normally
                    try {
                      emitContentChunk(emitContext, content, chunkState);
                    } catch (emitError) {
                      console.error('[ORCHESTRATOR] emitContentChunk failed:', emitError);
                    }
                    fullContent += content;
                  }
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
                
                try {
                  emitToolCall(emitContext, chunk.toolName, chunk.toolId, chunk.input);
                } catch (emitError) {
                  console.error('[ORCHESTRATOR] emitToolCall failed:', emitError);
                }
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
                  try {
                    emitSystemInfo(emitContext, msg, 'warning');
                  } catch (emitError) {
                    console.error('[ORCHESTRATOR] emitSystemInfo failed:', emitError);
                  }
                  shouldContinue = false;
                } else if (tokenUsagePercent >= 80) {
                  const msg = `⚠️ Token budget at ${tokenUsagePercent.toFixed(0)}% (${totalTokensUsed}/${tokenLimit})`;
                  try {
                    emitSystemInfo(emitContext, msg, 'warning');
                  } catch (emitError) {
                    console.error('[ORCHESTRATOR] emitSystemInfo failed:', emitError);
                  }
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
                  
                  // Track tokens in BeeHive Brain for session management
                  await beehiveAIBrain.recordTokens(userId, sessionId || 'default', usage.inputTokens, usage.outputTokens);
                }
              }
            },
          });
        }, 3, 'Gemini API call');

        // ============================================================================
        // ✅ FIX #1: TOOL EXECUTION - Execute tools returned by Gemini
        // ✅ PHASE 2: Collect ToolResult[] array instead of any[]
        // ============================================================================
        const iterationToolResults: ToolResult[] = [];
        const hasToolUse = contentBlocks.some(block => block.type === 'tool_use');
        
        if (hasToolUse) {
          console.log(`[TOOL-EXECUTION] Found ${contentBlocks.filter(b => b.type === 'tool_use').length} tools to execute`);
          
          // ✅ PHASE TRANSITION: Switch from thinking to working when tools start executing
          try {
            phaseOrchestrator.emitPhase('working', 'Executing tools...');
            emitPhaseTransition(emitContext, 'working', 'Executing tools...');
          } catch (phaseError: any) {
            console.error('[ORCHESTRATOR] Phase transition to working failed:', phaseError);
          }
          
          // Execute each tool
          for (const block of contentBlocks) {
            if (block.type === 'tool_use') {
              const { name: toolName, input, id: toolId } = block;
              
              console.log(`[TOOL-EXECUTION] Executing: ${toolName}`);
              
              // ✅ EMIT TASK CREATED: Notify frontend that a new task is starting
              const taskId = `task_${toolId}`;
              try {
                emitTaskUpdate(emitContext, taskId, 'in_progress');
              } catch (taskError: any) {
                console.error('[ORCHESTRATOR] emitTaskUpdate (created) failed:', taskError);
              }
              
              // Track tool call in brain
              const toolCallId = userId ? beehiveAIBrain.recordToolCall(userId, sessionId || 'default', toolName, input) : nanoid();
              
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
                    // ✅ PHASE 2: Create rejection ToolResult
                    shouldContinue = false;
                    const rejectionResult: ToolResult = {
                      toolName,
                      valid: false,
                      payload: '❌ USER REJECTED this operation. Please ask what they would like to do instead.',
                      warnings: ['User rejected approval'],
                      metadata: {
                        truncated: false,
                        schemaValidated: true
                      }
                    };
                    iterationToolResults.push(rejectionResult);
                    allToolResults.push(rejectionResult);
                    continue;
                  }
                }
                
                // ✅ PHASE 2: Execute tool and get structured ToolResult
                let toolResult: ToolResult;
                
                try {
                  // Execute tool with input parameters - now returns ToolResult
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
                  
                  // Add structured tool result to array (both iteration and all-time tracking)
                  iterationToolResults.push(toolResult);
                  allToolResults.push(toolResult);
                  
                  // Emit tool result event with ToolResult
                  try {
                    emitToolResult(emitContext, toolName, toolId, toolResult, false);
                  } catch (emitError) {
                    console.error('[ORCHESTRATOR] emitToolResult failed:', emitError);
                  }
                  
                  // ✅ EMIT TASK UPDATED: Mark task as complete with success
                  try {
                    emitTaskUpdate(emitContext, taskId, 'done');
                  } catch (taskError: any) {
                    console.error('[ORCHESTRATOR] emitTaskUpdate (done) failed:', taskError);
                  }
                  
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
                  
                  // ✅ EMIT TASK UPDATED: Mark task as failed
                  try {
                    emitTaskUpdate(emitContext, taskId, 'blocked');
                  } catch (taskError: any) {
                    console.error('[ORCHESTRATOR] emitTaskUpdate (blocked) failed:', taskError);
                  }
                  
                  // ✅ PHASE 2: Create error ToolResult
                  const errorMsg = `Tool execution failed: ${toolError.message}`;
                  const errorToolResult: ToolResult = {
                    toolName, // Fix: add missing line
                    valid: false,
                    payload: { error: errorMsg },
                    warnings: [errorMsg],
                    metadata: {
                      truncated: false,
                      schemaValidated: false
                    }
                  };
                  iterationToolResults.push(errorToolResult);
                  allToolResults.push(errorToolResult);
                  try {
                    emitToolResult(emitContext, toolName, toolId, errorToolResult, true);
                  } catch (emitError) {
                    console.error('[ORCHESTRATOR] emitToolResult (error) failed:', emitError);
                  }
                  throw toolError; // Re-throw to outer catch block
                }
                
                // Complete tool call in brain
                // ✅ PHASE 2: Convert ToolResult payload to string for brain tracking
                if (userId) {
                  const resultStr = typeof toolResult.payload === 'string' 
                    ? toolResult.payload 
                    : JSON.stringify(toolResult.payload);
                  beehiveAIBrain.completeToolCall(userId, sessionId || 'default', toolCallId, resultStr);
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
                
                // ✅ EMIT TASK UPDATED: Mark task as failed
                try {
                  emitTaskUpdate(emitContext, taskId, 'blocked');
                } catch (taskError: any) {
                  console.error('[ORCHESTRATOR] emitTaskUpdate (outer catch blocked) failed:', taskError);
                }
                
                // ✅ PHASE 2: Create error ToolResult for outer catch
                const errorMsg = `Error in ${toolName}: ${error.message}`;
                const errorToolResult: ToolResult = {
                  toolName,
                  valid: false,
                  payload: { error: errorMsg },
                  warnings: [errorMsg],
                  metadata: {
                    truncated: false,
                    schemaValidated: false
                  }
                };
                iterationToolResults.push(errorToolResult);
                allToolResults.push(errorToolResult);
                emitToolResult(emitContext, toolName, toolId, errorToolResult, true);
              }
            }
          }
          
          // ✅ PHASE 2: Add tool results to conversation with metadata awareness
          if (iterationToolResults.length > 0) {
            conversationMessages.push({
              role: 'assistant',
              content: contentBlocks
            });
            
            // Convert ToolResult[] to Gemini API format for next iteration
            // Format: { role: 'user', content: [{ type: 'tool_result', tool_use_id, content }] }
            // ✅ GAP FIX #1: Match by toolId instead of array index to avoid mismatches
            const toolResultMap = new Map(iterationToolResults.map(tr => [tr.toolName, tr]));
            
            const toolResultContent = contentBlocks
              .filter(block => block.type === 'tool_use')
              .map((block) => {
                const toolResult = toolResultMap.get(block.name);
                if (!toolResult) return null;
                
                // Convert payload to string for Gemini
                const resultContent = typeof toolResult.payload === 'string'
                  ? toolResult.payload
                  : JSON.stringify(toolResult.payload);
                
                // Log if truncation occurred
                if (toolResult.metadata.truncated) {
                  console.log(`[ORCHESTRATOR] ⚠️ Tool ${toolResult.toolName} result was truncated`);
                }
                
                return {
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: resultContent,
                  is_error: !toolResult.valid
                };
              })
              .filter(Boolean);
            
            conversationMessages.push({
              role: 'user',
              content: toolResultContent
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
    phaseOrchestrator.emitPhase('verifying', 'Verifying changes...');
    
    // ============================================================================
    // STEP 5.3: PRE-WRITE VALIDATION (syntax/JSON checking before persistence)
    // ============================================================================
    try {
      console.log('[ORCHESTRATOR] Step 5.3: Validating code before persistence...');
      
      // Pre-write validation: Check if content appears valid
      const validationResult = {
        isValid: fullContent.length > 0,
        issues: []
      };
      
      if (!validationResult.isValid) {
        console.warn('[ORCHESTRATOR] ⚠️ Validation warnings: Empty response');
        progressMessages.push({
          id: nanoid(),
          message: `Validation: Empty response (${validationResult.issues.length} issues)`,
          timestamp: Date.now(),
          category: 'action'
        });
      } else {
        console.log('[ORCHESTRATOR] ✅ Code validation passed');
        progressMessages.push({
          id: nanoid(),
          message: `Code validated successfully (${fullContent.length} chars)`,
          timestamp: Date.now(),
          category: 'result'
        });
      }
      
      phaseOrchestrator.emitPhase('verifying', `Validation: ${validationResult.isValid ? 'passed' : 'failed'}`);
    } catch (validationError: any) {
      console.error('[ORCHESTRATOR] Validation error:', validationError);
      emitSystemInfo(emitContext, `⚠️ Validation error: ${validationError.message}`, 'warning');
      // Continue with persistence even if validation fails
    }

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
          const commitMessage = `[BeeHive] ${fullContent?.substring(0, 50) || 'Auto-update'}\n\nFiles changed: ${allChangedFiles.join(', ')}`;
          
          const commitHash = await platformGitService.commit(commitMessage, {
            name: 'BeeHive Autonomous',
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
          phaseOrchestrator.emitPhase('complete', `Committed ${allChangedFiles.length} files`);
        } else {
          console.log('[ORCHESTRATOR] No changes to commit');
        }
      } catch (gitError: any) {
        console.error('[ORCHESTRATOR] Git commit failed:', gitError);
        emitSystemInfo(emitContext, `⚠️ Git commit failed: ${gitError.message}`, 'warning');
        // Continue with persistence even if git fails
      }
    }

    // Save assistant message to database - declare outside try block
    let assistantMsg: any = null;
    
    // Update to CONFIRM phase
    phaseOrchestrator.emitPhase('complete', 'Confirming changes...');
    
    // ============================================================================
    // STEP 6: FINAL PERSISTENCE
    // ============================================================================
    console.log('[ORCHESTRATOR] Step 6: Persisting results...');
    
    try {
      // Save assistant message to database
      // ✅ PHASE 3: Include validationMetadata from tool results
      
      // Build validation metadata
      const validationMetadata = allToolResults.length > 0 
        ? {
            valid: allToolResults.every((tr: ToolResult) => tr.valid),
            warnings: allToolResults.flatMap((tr: ToolResult) => tr.warnings),
            truncated: allToolResults.some((tr: ToolResult) => tr.metadata.truncated),
            schemaValidated: allToolResults.every((tr: ToolResult) => tr.metadata.schemaValidated)
          } as const
        : undefined;
      
      const result = await db.insert(chatMessages).values({
        userId,
        projectId,
        conversationStateId: conversationState.id,
        fileId: null,
        role: 'assistant',
        content: fullContent || 'Task completed.',
        progressMessages: JSON.stringify(progressMessages),
        isPlatformHealing: targetContext === 'platform',
        validationMetadata,
      }).returning();
      
      assistantMsg = result[0];
      console.log('[ORCHESTRATOR] Message persisted to database');
    } catch (persistError: any) {
      console.error('[ORCHESTRATOR] Persistence error:', persistError);
      phaseOrchestrator.emitPhase('complete', `Failed: ${persistError.message}`);
      throw persistError;
    }

    // Persist trace for debugging
    if (traceId) {
      await traceLogger.persist(traceId, conversationState.id, userId);
      console.log(`[ORCHESTRATOR] Trace persisted: ${traceId}`);
    }

    // Send completion events
    emitComplete(emitContext, undefined, totalCreditsUsed);
    // ✅ FIX #2: Don't emit error on successful stream completion - only emit done event
    terminateStream(res, sendEvent, assistantMsg?.id || 'unknown', undefined);

    console.log('[ORCHESTRATOR] ✅ Request completed successfully');

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
