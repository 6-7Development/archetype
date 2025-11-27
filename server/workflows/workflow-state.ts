/**
 * WORKFLOW STATE PERSISTENCE
 * Manages state between continuation turns to support Replit FAST mode parity
 */

import { WorkflowState, WorkflowPhase } from './workflow-config';

// In-memory store for workflow states (ideally would use Redis or database)
const workflowStates = new Map<string, WorkflowState>();

export class WorkflowStateManager {
  /**
   * Create a new workflow state
   */
  static createState(conversationId: string): WorkflowState {
    const state: WorkflowState = {
      conversationId,
      currentPhase: WorkflowPhase.ASSESS,
      continuationCount: 0,
      errorCount: 0,
      startTime: Date.now(),
      toolsExecuted: [],
      contextTokensUsed: 0,
      totalCost: 0,
      messages: [],
      state: {},
    };
    workflowStates.set(conversationId, state);
    return state;
  }

  /**
   * Get workflow state
   */
  static getState(conversationId: string): WorkflowState | undefined {
    return workflowStates.get(conversationId);
  }

  /**
   * Update workflow phase
   */
  static updatePhase(conversationId: string, phase: WorkflowPhase): void {
    const state = workflowStates.get(conversationId);
    if (state) {
      console.log(`📍 [WORKFLOW-PHASE] ${state.currentPhase} → ${phase}`);
      state.currentPhase = phase;
    }
  }

  /**
   * Record tool execution
   */
  static recordToolExecution(
    conversationId: string,
    toolName: string,
    status: 'success' | 'error' | 'timeout' | 'retry',
    costTokens: number,
    cached: boolean
  ): void {
    const state = workflowStates.get(conversationId);
    if (state) {
      const now = Date.now();
      const lastTool = state.toolsExecuted[state.toolsExecuted.length - 1];
      
      state.toolsExecuted.push({
        name: toolName,
        startTime: lastTool?.endTime || state.startTime,
        endTime: now,
        status,
        costTokens,
        resultCached: cached,
      });
      
      state.totalCost += costTokens;
      console.log(`💰 [COST-TRACKING] ${toolName}: +${costTokens} tokens (total: ${state.totalCost})`);
    }
  }

  /**
   * Increment continuation count
   */
  static incrementContinuation(conversationId: string): void {
    const state = workflowStates.get(conversationId);
    if (state) {
      state.continuationCount++;
      console.log(`🔄 [CONTINUATION] Turn ${state.continuationCount}`);
    }
  }

  /**
   * Record error
   */
  static recordError(conversationId: string): void {
    const state = workflowStates.get(conversationId);
    if (state) {
      state.errorCount++;
      console.log(`❌ [ERROR-COUNT] ${state.errorCount} errors in workflow`);
    }
  }

  /**
   * Update context tokens usage
   */
  static updateContextTokens(conversationId: string, inputTokens: number, outputTokens: number): void {
    const state = workflowStates.get(conversationId);
    if (state) {
      state.contextTokensUsed += inputTokens + outputTokens;
      console.log(`📊 [CONTEXT-USAGE] ${state.contextTokensUsed} total tokens used`);
    }
  }

  /**
   * Get workflow diagnostics
   */
  static getDiagnostics(conversationId: string): any {
    const state = workflowStates.get(conversationId);
    if (!state) return null;

    const elapsed = Date.now() - state.startTime;
    return {
      phase: state.currentPhase,
      continuations: state.continuationCount,
      errors: state.errorCount,
      elapsedMs: elapsed,
      toolsExecuted: state.toolsExecuted.length,
      totalCost: state.totalCost,
      contextTokens: state.contextTokensUsed,
    };
  }

  /**
   * Clean up workflow state
   */
  static cleanup(conversationId: string): void {
    workflowStates.delete(conversationId);
    console.log(`🧹 [CLEANUP] Workflow state removed: ${conversationId}`);
  }
}
