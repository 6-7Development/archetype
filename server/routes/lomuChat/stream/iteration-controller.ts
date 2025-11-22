/**
 * Iteration Controller Module
 * 
 * This module manages the main AI iteration loop for LomuAI streaming.
 * It controls the loop execution, anti-paralysis detection, emergency brakes,
 * and iteration budget management based on user intent.
 * 
 * Architecture:
 * - MAX_ITERATIONS varies by user intent (build/fix/diagnostic/casual)
 * - Anti-paralysis system tracks file reads to prevent analysis loops
 * - Emergency brakes enforce global safety limits (API calls, tokens, time)
 * - Iteration tracking updates RunStateManager and emits progress events
 * 
 * @module iteration-controller
 */

import type { ConversationState } from '@shared/schema';
import type { EventSender, StreamContext, UserIntent } from './types.ts';
import { LOMU_LIMITS, getMaxIterationsForIntent } from '../../../config/lomuLimits.ts';
import { emitProgress, emitSystemInfo } from './stream-emitter.ts';
import { db } from '../../../db.ts';
import { conversationStates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { RunStateManager } from '../../../services/RunStateManager.ts';
import type { PhaseOrchestrator } from '../../../services/PhaseOrchestrator.ts';

/**
 * Anti-paralysis tracker state
 * Tracks file reads to prevent analysis loops where AI repeatedly reads same files
 */
export interface AntiParalysisState {
  fileReadTracker: Map<string, number>; // filepath -> consecutive read count
  warningCount: number; // Number of warnings issued
  blockCount: number; // Number of blocks enforced
  readonly MAX_SAME_FILE_READS: number; // Max consecutive reads before blocking
}

/**
 * Iteration loop state
 * Contains runtime state for managing iteration execution
 */
export interface IterationState {
  iterationCount: number;
  continueLoop: boolean;
  consecutiveEmptyIterations: number;
  consecutiveThinkingCount: number;
  totalToolCallCount: number;
  iterationStartTime: number;
}

/**
 * Workflow telemetry state
 * Tracks read vs write operations to detect stuck workflows
 */
export interface WorkflowTelemetry {
  readOperations: number;
  writeOperations: number;
  consecutiveReadOnlyIterations: number;
  hasProducedFixes: boolean;
  readonly MAX_READ_ONLY_ITERATIONS: number;
}

/**
 * Emergency brake check result
 * Contains information about whether to stop execution
 */
export interface EmergencyBrakeResult {
  triggered: boolean;
  reason: string;
}

/**
 * Iteration loop context
 * Contains all dependencies needed for iteration execution
 */
export interface IterationContext {
  userId: string;
  conversationState: ConversationState;
  userIntent: UserIntent;
  sendEvent: EventSender;
  runStateManager: RunStateManager | null;
  phaseOrchestrator?: PhaseOrchestrator;
  runId: string;
  targetContext: 'platform' | 'project';
  projectId: string | null;
}

/**
 * Iteration execution parameters
 * Input parameters for executeAILoop function
 */
export interface IterationExecutionParams extends IterationContext {
  maxIterations?: number; // Optional override, otherwise computed from intent
  onIteration: (iterationCount: number) => Promise<{
    shouldContinue: boolean;
    toolCallCount: number;
    isThinking: boolean;
    isEmpty: boolean;
  }>;
}

/**
 * Create initial anti-paralysis state
 * 
 * @returns Fresh anti-paralysis tracker with default limits
 */
export function createAntiParalysisState(): AntiParalysisState {
  return {
    fileReadTracker: new Map(),
    warningCount: 0,
    blockCount: 0,
    MAX_SAME_FILE_READS: 2, // Warn on 2nd read, block on 3rd+ read
  };
}

/**
 * Create initial iteration state
 * 
 * @returns Fresh iteration state with counters at zero
 */
export function createIterationState(): IterationState {
  return {
    iterationCount: 0,
    continueLoop: true,
    consecutiveEmptyIterations: 0,
    consecutiveThinkingCount: 0,
    totalToolCallCount: 0,
    iterationStartTime: Date.now(),
  };
}

/**
 * Create initial workflow telemetry
 * 
 * @returns Fresh telemetry tracker with high ceiling for diagnostics
 */
export function createWorkflowTelemetry(): WorkflowTelemetry {
  return {
    readOperations: 0,
    writeOperations: 0,
    consecutiveReadOnlyIterations: 0,
    hasProducedFixes: false,
    MAX_READ_ONLY_ITERATIONS: 60, // High ceiling for thorough diagnostics
  };
}

/**
 * Check file read for anti-paralysis patterns
 * 
 * This function tracks consecutive reads of the same file and enforces
 * anti-paralysis measures to prevent analysis loops:
 * - 1st read: Normal, allow
 * - 2nd read: Warning (for large files), allow
 * - 3rd+ read: Block and force pivot to different strategy
 * 
 * @param state - Anti-paralysis tracker state
 * @param filePath - Path to file being read
 * @param fileSize - Size of file in bytes
 * @param lineCount - Number of lines in file
 * @returns Anti-paralysis action (null = allow, 'warn' = warning, 'block' = blocked)
 */
export function checkAntiParalysis(
  state: AntiParalysisState,
  filePath: string,
  fileSize: number,
  lineCount: number
): { action: null | 'warn' | 'block'; message?: string; readCount: number } {
  const currentReadCount = (state.fileReadTracker.get(filePath) || 0) + 1;
  state.fileReadTracker.set(filePath, currentReadCount);
  
  const isLargeFile = fileSize > 50000 || lineCount > 1000; // >50KB OR >1000 lines
  
  // Only enforce for large files
  if (!isLargeFile) {
    return { action: null, readCount: currentReadCount };
  }
  
  // Warn on 2nd read
  if (currentReadCount === state.MAX_SAME_FILE_READS) {
    state.warningCount++;
    const warningMsg = `\n\n⚠️ **WARNING: You've read this file ${currentReadCount} times (${lineCount} lines).**\n` +
      `Consider using grep() or search_codebase() for your next search to avoid analysis paralysis.\n`;
    console.warn(`[ANTI-PARALYSIS] Warning #${state.warningCount}: Read #${currentReadCount} of ${filePath} (${lineCount} lines)`);
    return { action: 'warn', message: warningMsg, readCount: currentReadCount };
  }
  
  // Block on 3rd+ read
  if (currentReadCount > state.MAX_SAME_FILE_READS) {
    state.blockCount++;
    const errorMsg = `🚨 **ANALYSIS PARALYSIS - BLOCKED**\n\n` +
      `File "${filePath}" (${lineCount} lines, ${(fileSize / 1024).toFixed(1)}KB) has been read ${currentReadCount} times.\n\n` +
      `**MANDATORY NEXT ACTION - Choose ONE:**\n` +
      `1. grep(pattern="specific pattern", path="${filePath}") - Search for specific text\n` +
      `2. search_codebase(query="your question") - Semantic code search\n` +
      `3. architect_consult(task="Help me understand...") - Get expert guidance\n\n` +
      `**SYSTEM BLOCK: You CANNOT call read_platform_file() for this file again.**\n` +
      `Counter resets after: write, edit, grep, search_codebase, or architect_consult.\n`;
    
    console.error(`[ANTI-PARALYSIS] BLOCK #${state.blockCount}: Halting iteration - ${currentReadCount} reads of ${filePath} (${lineCount} lines)`);
    return { action: 'block', message: errorMsg, readCount: currentReadCount };
  }
  
  return { action: null, readCount: currentReadCount };
}

/**
 * Reset anti-paralysis counter for a file
 * 
 * Called after successful operations that break analysis loops:
 * - File writes
 * - File edits
 * - grep searches
 * - Semantic codebase searches
 * 
 * @param state - Anti-paralysis tracker state
 * @param filePath - Path to file to reset counter for
 */
export function resetAntiParalysisCounter(state: AntiParalysisState, filePath: string): void {
  if (state.fileReadTracker.has(filePath)) {
    state.fileReadTracker.delete(filePath);
    console.log(`[ANTI-PARALYSIS] Reset read counter for ${filePath}`);
  }
}

/**
 * Clear all anti-paralysis counters
 * 
 * Called after operations that indicate agent pivoted strategy:
 * - grep (targeted search)
 * - search_codebase (semantic search)
 * 
 * @param state - Anti-paralysis tracker state
 */
export function clearAntiParalysisCounters(state: AntiParalysisState): void {
  const resetCount = state.fileReadTracker.size;
  state.fileReadTracker.clear();
  if (resetCount > 0) {
    console.log(`[ANTI-PARALYSIS] Reset ${resetCount} file read counters after strategic pivot`);
  }
}

/**
 * Check if iteration should stop due to emergency brakes
 * 
 * Emergency brakes enforce global safety limits:
 * 1. API call limit (50 calls per session)
 * 2. Token limit (500K tokens per session)
 * 
 * Session idle timeout and duration checks were removed to allow
 * users to work as long as they're active.
 * 
 * @param context - Iteration context
 * @param currentTokens - Current token count in conversation
 * @returns Emergency brake result
 */
export async function shouldStopIteration(
  context: IterationContext,
  currentTokens: number
): Promise<EmergencyBrakeResult> {
  const result: EmergencyBrakeResult = {
    triggered: false,
    reason: '',
  };
  
  // Check 1: API call count (50 calls max per session)
  const currentApiCallCount = context.conversationState.apiCallCount || 0;
  if (currentApiCallCount >= LOMU_LIMITS.API.MAX_API_CALLS_PER_SESSION) {
    result.triggered = true;
    result.reason = `🛑 Safety limit reached: Maximum API calls (${LOMU_LIMITS.API.MAX_API_CALLS_PER_SESSION}) exceeded. Please start a new conversation to continue.`;
    return result;
  }
  
  // Check 2: Session token limit (500K tokens max)
  if (currentTokens > LOMU_LIMITS.API.MAX_CONTEXT_TOKENS) {
    result.triggered = true;
    result.reason = `💾 Safety limit reached: Conversation memory exceeded ${LOMU_LIMITS.API.MAX_CONTEXT_TOKENS} tokens. Please start a new conversation.`;
    return result;
  }
  
  return result;
}

/**
 * Update iteration progress tracking
 * 
 * Updates RunStateManager with current iteration count and emits
 * progress events for long-running tasks.
 * 
 * @param context - Iteration context
 * @param iterationCount - Current iteration number
 */
export function trackIterationProgress(
  context: IterationContext,
  iterationCount: number
): void {
  // Update RunStateManager with current iteration
  if (context.runStateManager) {
    context.runStateManager.incrementIteration(context.runId);
  }
  
  // Show iteration count for long-running tasks (5+ iterations)
  if (iterationCount % 5 === 0) {
    emitProgress(
      {
        sendEvent: context.sendEvent,
        userId: context.userId,
        wss: null, // Progress events don't need WebSocket broadcast
        targetContext: context.targetContext,
        projectId: context.projectId,
      },
      `Working (step ${iterationCount})...`
    );
  }
}

/**
 * Increment API call counter in database
 * 
 * Updates the conversation state with incremented API call count
 * to track usage for emergency brakes.
 * 
 * @param conversationStateId - ID of conversation state to update
 * @param currentCount - Current API call count
 */
export async function incrementApiCallCounter(
  conversationStateId: string,
  currentCount: number
): Promise<void> {
  await db
    .update(conversationStates)
    .set({ 
      apiCallCount: currentCount + 1,
      lastUpdated: new Date(),
    })
    .where(eq(conversationStates.id, conversationStateId));
  
  console.log(`[EMERGENCY-BRAKE] API call ${currentCount + 1}/${LOMU_LIMITS.API.MAX_API_CALLS_PER_SESSION}`);
}

/**
 * Check for empty iteration pattern
 * 
 * Detects when consecutive iterations produce no tool calls,
 * indicating the AI may be stuck in a loop.
 * 
 * @param state - Iteration state
 * @param hadToolCalls - Whether current iteration had tool calls
 * @param maxEmptyIterations - Maximum allowed consecutive empty iterations
 * @returns Whether to stop due to empty iterations
 */
export function checkEmptyIterations(
  state: IterationState,
  hadToolCalls: boolean,
  maxEmptyIterations: number = 3
): { shouldStop: boolean; reason?: string } {
  if (!hadToolCalls) {
    state.consecutiveEmptyIterations++;
    
    if (state.consecutiveEmptyIterations >= maxEmptyIterations) {
      return {
        shouldStop: true,
        reason: `Stopped after ${maxEmptyIterations} consecutive iterations without tool calls`,
      };
    }
  } else {
    state.consecutiveEmptyIterations = 0; // Reset on tool call
  }
  
  return { shouldStop: false };
}

/**
 * Check for thinking loop pattern
 * 
 * Detects when AI produces consecutive thinking blocks without action,
 * indicating analysis paralysis at the reasoning level.
 * 
 * @param state - Iteration state
 * @param isThinking - Whether current iteration was thinking
 * @param maxConsecutiveThinking - Maximum allowed consecutive thinking iterations
 * @returns Enforcement message to inject (empty string if no enforcement needed)
 */
export function checkThinkingLoop(
  state: IterationState,
  isThinking: boolean,
  maxConsecutiveThinking: number = 3
): string {
  if (isThinking) {
    state.consecutiveThinkingCount++;
    
    if (state.consecutiveThinkingCount >= maxConsecutiveThinking) {
      console.warn(`[THINKING-WATCHDOG] ⚠️ ${state.consecutiveThinkingCount} consecutive thinking blocks - forcing action`);
      
      const enforcementMessage = `\n\n🚨 **SYSTEM ENFORCEMENT**: You've been thinking for ${state.consecutiveThinkingCount} consecutive turns.\n` +
        `**You MUST take action NOW.** Call a tool or provide a final answer - no more thinking blocks allowed.\n`;
      
      // Reset counter after enforcement
      state.consecutiveThinkingCount = 0;
      
      return enforcementMessage;
    }
  } else {
    state.consecutiveThinkingCount = 0; // Reset on action
  }
  
  return '';
}

/**
 * Execute main AI iteration loop
 * 
 * This is the core iteration controller that manages the AI's turn-by-turn
 * execution until task completion or budget exhaustion.
 * 
 * Loop mechanics:
 * - Calls onIteration callback for each turn
 * - Tracks iteration count and enforces MAX_ITERATIONS limit
 * - Checks emergency brakes before each iteration
 * - Detects empty iterations and thinking loops
 * - Updates progress tracking via RunStateManager
 * 
 * @param params - Iteration execution parameters
 * @returns Final iteration state after loop completion
 */
export async function executeAILoop(
  params: IterationExecutionParams
): Promise<IterationState> {
  const maxIterations = params.maxIterations || getMaxIterationsForIntent(params.userIntent);
  const state = createIterationState();
  
  console.log(`[ITERATION-CONTROLLER] Starting loop with max ${maxIterations} iterations (intent: ${params.userIntent})`);
  
  while (state.continueLoop && state.iterationCount < maxIterations) {
    state.iterationCount++;
    state.iterationStartTime = Date.now();
    
    console.log(`[ITERATION-CONTROLLER] Iteration ${state.iterationCount}/${maxIterations}`);
    
    // Track progress
    trackIterationProgress(params, state.iterationCount);
    
    // Check emergency brakes (API calls, tokens)
    // Note: currentTokens needs to be calculated by caller and passed through onIteration callback
    const emergencyBrake = await shouldStopIteration(params, 0); // Simplified - full impl needs token count
    if (emergencyBrake.triggered) {
      console.error(`[EMERGENCY-BRAKE] Triggered: ${emergencyBrake.reason}`);
      emitSystemInfo(
        {
          sendEvent: params.sendEvent,
          userId: params.userId,
          wss: null,
          targetContext: params.targetContext,
          projectId: params.projectId,
        },
        emergencyBrake.reason,
        'error'
      );
      state.continueLoop = false;
      break;
    }
    
    // Increment API call counter
    const currentApiCallCount = params.conversationState.apiCallCount || 0;
    await incrementApiCallCounter(params.conversationState.id, currentApiCallCount);
    
    // Execute iteration callback
    const result = await params.onIteration(state.iterationCount);
    
    // Update state from callback result
    if (!result.shouldContinue) {
      state.continueLoop = false;
    }
    
    state.totalToolCallCount += result.toolCallCount;
    
    // Check for empty iteration pattern
    const emptyCheck = checkEmptyIterations(state, result.toolCallCount > 0);
    if (emptyCheck.shouldStop) {
      console.log(`[ITERATION-CONTROLLER] ${emptyCheck.reason}`);
      state.continueLoop = false;
    }
    
    // Check for thinking loop pattern
    // Note: Enforcement message handling would be done by caller
    const thinkingEnforcement = checkThinkingLoop(state, result.isThinking);
    if (thinkingEnforcement) {
      console.warn(`[ITERATION-CONTROLLER] Thinking loop detected - enforcement message generated`);
      // Caller should inject this message into system prompt
    }
    
    // Check iteration timeout
    const elapsed = Date.now() - state.iterationStartTime;
    if (elapsed > LOMU_LIMITS.ITERATION.TIMEOUT_MS) {
      console.warn(`[ITERATION-CONTROLLER] Iteration ${state.iterationCount} exceeded timeout (${elapsed}ms > ${LOMU_LIMITS.ITERATION.TIMEOUT_MS}ms)`);
      // Non-fatal warning - allow completion
    }
  }
  
  console.log(`[ITERATION-CONTROLLER] Loop completed after ${state.iterationCount} iterations`);
  console.log(`[ITERATION-CONTROLLER] Total tool calls: ${state.totalToolCallCount}`);
  
  return state;
}

/**
 * Log anti-paralysis telemetry
 * 
 * Logs statistics about anti-paralysis interventions for monitoring.
 * 
 * @param state - Anti-paralysis tracker state
 * @param sendEvent - Event sender function
 * @param userId - User ID for event targeting
 */
export function logAntiParalysisTelemetry(
  state: AntiParalysisState,
  sendEvent: EventSender,
  userId: string
): void {
  if (state.warningCount > 0 || state.blockCount > 0) {
    console.log(`[ANTI-PARALYSIS-TELEMETRY] 📊 Interventions: ${state.warningCount} warnings, ${state.blockCount} blocks`);
    emitProgress(
      {
        sendEvent,
        userId,
        wss: null,
        targetContext: 'platform',
        projectId: null,
      },
      `Anti-paralysis system: ${state.warningCount} warnings, ${state.blockCount} blocks`
    );
  } else {
    console.log(`[ANTI-PARALYSIS-TELEMETRY] ✅ No interventions needed - efficient search strategies used`);
  }
}
