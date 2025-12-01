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
   * Valid phase transitions (7-phase workflow state machine)
   * COMPLETE WORKFLOW: ASSESS → PLAN → EXECUTE → TEST → VERIFY → COMPLETE
   * Error can occur at any phase with recovery paths
   */
  private static readonly VALID_TRANSITIONS: Record<WorkflowPhase, WorkflowPhase[]> = {
    [WorkflowPhase.ASSESS]: [WorkflowPhase.PLAN, WorkflowPhase.ERROR],
    [WorkflowPhase.PLAN]: [WorkflowPhase.EXECUTE, WorkflowPhase.ERROR],
    [WorkflowPhase.EXECUTE]: [WorkflowPhase.TEST, WorkflowPhase.EXECUTE, WorkflowPhase.ERROR], // Can retry EXECUTE
    [WorkflowPhase.TEST]: [WorkflowPhase.VERIFY, WorkflowPhase.EXECUTE, WorkflowPhase.ERROR], // Can go back to EXECUTE if tests fail
    [WorkflowPhase.VERIFY]: [WorkflowPhase.COMPLETE, WorkflowPhase.EXECUTE, WorkflowPhase.ERROR], // Can go back to EXECUTE if verification fails
    [WorkflowPhase.COMPLETE]: [WorkflowPhase.ASSESS], // Allow restart only
    [WorkflowPhase.ERROR]: [WorkflowPhase.ASSESS, WorkflowPhase.PLAN, WorkflowPhase.EXECUTE], // Recovery paths
  };

  /**
   * Validate phase transition (GAP #2 FIX)
   * @returns true if transition is valid, false otherwise
   */
  static validatePhaseTransition(conversationId: string, targetPhase: WorkflowPhase): boolean {
    const state = workflowStates.get(conversationId);
    if (!state) {
      console.warn(`⚠️ [WORKFLOW-STATE] No state found for ${conversationId}`);
      return false;
    }

    const validTargets = this.VALID_TRANSITIONS[state.currentPhase] || [];
    const isValid = validTargets.includes(targetPhase);

    if (!isValid) {
      console.error(`❌ [WORKFLOW-STATE] Invalid transition: ${state.currentPhase} → ${targetPhase}`);
      console.error(`   Valid targets: ${validTargets.join(', ')}`);
    }

    return isValid;
  }

  /**
   * Update workflow phase with validation (GAP #2 FIX)
   */
  static updatePhase(conversationId: string, phase: WorkflowPhase, force: boolean = false): boolean {
    const state = workflowStates.get(conversationId);
    if (!state) return false;

    // Validate transition unless forced
    if (!force && !this.validatePhaseTransition(conversationId, phase)) {
      console.error(`🚫 [WORKFLOW-PHASE] Blocked invalid transition: ${state.currentPhase} → ${phase}`);
      return false;
    }

    console.log(`📍 [WORKFLOW-PHASE] ${state.currentPhase} → ${phase}`);
    state.currentPhase = phase;
    return true;
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
