/**
 * WorkflowValidator - Authoritative State Machine
 * 
 * Programmatic runtime enforcement of the 7-phase workflow with:
 * - Per-phase token ceilings
 * - Mandatory tool call quotas
 * - Auto-halt on premature completion
 * - Phase transition validation
 * - Audit trail for compliance tracking
 */

export type WorkflowPhase = 'ASSESS' | 'PLAN' | 'EXECUTE' | 'TEST' | 'VERIFY' | 'CONFIRM' | 'COMMIT';

export interface PhaseConstraints {
  maxTokens: number;
  minToolCalls: number;
  mandatoryTools?: string[];
  allowedTransitions: WorkflowPhase[];
}

export interface WorkflowState {
  currentPhase: WorkflowPhase;
  phasesCompleted: WorkflowPhase[];
  totalTokensUsed: number;
  phaseTokens: Map<WorkflowPhase, number>;
  toolCallsInPhase: number;
  violations: string[];
  canComplete: boolean;
}

export class WorkflowValidator {
  private state: WorkflowState;
  private constraints: Map<WorkflowPhase, PhaseConstraints>;

  constructor() {
    // Initialize state
    this.state = {
      currentPhase: 'ASSESS',
      phasesCompleted: [],
      totalTokensUsed: 0,
      phaseTokens: new Map(),
      toolCallsInPhase: 0,
      violations: [],
      canComplete: false,
    };

    // Define per-phase constraints
    this.constraints = new Map([
      ['ASSESS', {
        maxTokens: 2000,
        minToolCalls: 1,
        mandatoryTools: ['read', 'search_codebase', 'grep'],
        allowedTransitions: ['PLAN'],
      }],
      ['PLAN', {
        maxTokens: 1500,
        minToolCalls: 0, // Task lists optional - can skip directly to EXECUTE
        mandatoryTools: [], // No mandatory tools - just planning phase
        allowedTransitions: ['EXECUTE'],
      }],
      ['EXECUTE', {
        maxTokens: 4000,
        minToolCalls: 2,
        mandatoryTools: ['write', 'edit'],
        allowedTransitions: ['TEST'],
      }],
      ['TEST', {
        maxTokens: 2000,
        minToolCalls: 0, // Testing optional - use judgment
        mandatoryTools: [], // No mandatory tools - testing is optional
        allowedTransitions: ['VERIFY', 'EXECUTE'], // Can go back to EXECUTE if tests fail
      }],
      ['VERIFY', {
        maxTokens: 1500,
        minToolCalls: 1,
        mandatoryTools: ['get_latest_lsp_diagnostics'],
        allowedTransitions: ['CONFIRM', 'EXECUTE'], // Can go back to EXECUTE if verification fails
      }],
      ['CONFIRM', {
        maxTokens: 500,
        minToolCalls: 0,
        allowedTransitions: ['COMMIT'],
      }],
      ['COMMIT', {
        maxTokens: 500,
        minToolCalls: 0,
        allowedTransitions: [],
      }],
    ]);
  }

  /**
   * Validate phase transition
   */
  canTransitionTo(targetPhase: WorkflowPhase): {
    allowed: boolean;
    reason?: string;
  } {
    const currentConstraints = this.constraints.get(this.state.currentPhase);

    if (!currentConstraints) {
      return { allowed: false, reason: 'Unknown phase' };
    }

    // Check if transition is allowed
    if (!currentConstraints.allowedTransitions.includes(targetPhase)) {
      return {
        allowed: false,
        reason: `Invalid transition: ${this.state.currentPhase} → ${targetPhase}. Allowed: ${currentConstraints.allowedTransitions.join(', ')}`,
      };
    }

    // Check if mandatory tools were called
    if (currentConstraints.minToolCalls > 0 && this.state.toolCallsInPhase < currentConstraints.minToolCalls) {
      return {
        allowed: false,
        reason: `Cannot exit ${this.state.currentPhase}: Required ${currentConstraints.minToolCalls} tool calls, only made ${this.state.toolCallsInPhase}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Execute phase transition
   */
  transitionTo(targetPhase: WorkflowPhase): void {
    const validation = this.canTransitionTo(targetPhase);

    if (!validation.allowed) {
      const violation = `⛔ TRANSITION BLOCKED: ${validation.reason}`;
      this.state.violations.push(violation);
      throw new Error(violation);
    }

    // Mark current phase as completed
    if (!this.state.phasesCompleted.includes(this.state.currentPhase)) {
      this.state.phasesCompleted.push(this.state.currentPhase);
    }

    // Transition to new phase
    this.state.currentPhase = targetPhase;
    this.state.toolCallsInPhase = 0;

    console.log(`[WORKFLOW-VALIDATOR] Phase transition: → ${targetPhase}`);
  }

  /**
   * Record tokens used in current phase
   */
  recordTokenUsage(inputTokens: number, outputTokens: number): void {
    const totalTokens = inputTokens + outputTokens;

    // Update total
    this.state.totalTokensUsed += totalTokens;

    // Update phase tokens
    const currentPhaseTokens = this.state.phaseTokens.get(this.state.currentPhase) || 0;
    this.state.phaseTokens.set(this.state.currentPhase, currentPhaseTokens + totalTokens);

    // Check if phase exceeded token ceiling
    const constraints = this.constraints.get(this.state.currentPhase);
    if (constraints && currentPhaseTokens + totalTokens > constraints.maxTokens) {
      const violation = `⚠️ TOKEN CEILING EXCEEDED: Phase ${this.state.currentPhase} used ${currentPhaseTokens + totalTokens} tokens (max ${constraints.maxTokens})`;
      this.state.violations.push(violation);
      console.warn(`[WORKFLOW-VALIDATOR] ${violation}`);
    }
  }

  /**
   * Record a tool call in current phase
   */
  recordToolCall(toolName: string): void {
    this.state.toolCallsInPhase++;
    console.log(`[WORKFLOW-VALIDATOR] Tool call #${this.state.toolCallsInPhase} in ${this.state.currentPhase}: ${toolName}`);
  }

  /**
   * Check if workflow can complete (all mandatory phases done)
   */
  canCompleteWorkflow(): {
    allowed: boolean;
    reason?: string;
  } {
    const mandatoryPhases: WorkflowPhase[] = ['ASSESS', 'PLAN', 'EXECUTE', 'TEST', 'VERIFY'];

    for (const phase of mandatoryPhases) {
      if (!this.state.phasesCompleted.includes(phase)) {
        return {
          allowed: false,
          reason: `❌ PREMATURE COMPLETION ATTEMPT: Phase ${phase} not completed yet. Mandatory phases: ${mandatoryPhases.join(' → ')}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validate completion attempt
   */
  validateCompletion(): void {
    const validation = this.canCompleteWorkflow();

    if (!validation.allowed) {
      const violation = validation.reason!;
      this.state.violations.push(violation);
      throw new Error(violation);
    }

    this.state.canComplete = true;
    console.log('[WORKFLOW-VALIDATOR] ✅ Workflow completion validated');
  }

  /**
   * Get current state
   */
  getState(): WorkflowState {
    return { ...this.state };
  }

  /**
   * Get violations
   */
  getViolations(): string[] {
    return [...this.state.violations];
  }

  /**
   * Check if critical violations exist (should escalate to I AM Architect)
   */
  hasCriticalViolations(): boolean {
    return this.state.violations.some(v =>
      v.includes('TRANSITION BLOCKED') ||
      v.includes('PREMATURE COMPLETION ATTEMPT') ||
      v.includes('TOKEN CEILING EXCEEDED')
    );
  }

  /**
   * Generate compliance report
   */
  generateReport(): string {
    let report = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    report += '  WORKFLOW COMPLIANCE REPORT\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    report += `Current Phase: ${this.state.currentPhase}\n`;
    report += `Phases Completed: ${this.state.phasesCompleted.join(' → ')}\n`;
    report += `Total Tokens Used: ${this.state.totalTokensUsed}\n`;
    report += `Tool Calls (current phase): ${this.state.toolCallsInPhase}\n\n`;

    if (this.state.violations.length > 0) {
      report += `VIOLATIONS (${this.state.violations.length}):\n`;
      this.state.violations.forEach((v, i) => report += `  ${i + 1}. ${v}\n`);
    } else {
      report += `✅ No violations detected\n`;
    }

    report += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return report;
  }
}