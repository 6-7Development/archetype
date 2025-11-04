/**
 * Workflow State Machine for LomuAI 7-Phase Workflow
 * 
 * Enforces: Assess → Plan → Execute → Test → Verify → Confirm → Commit
 * 
 * Purpose: Prevent Gemini Flash from skipping phases or violating workflow rules
 */

export type WorkflowPhase = 
  | 'assess' 
  | 'plan' 
  | 'execute' 
  | 'test' 
  | 'verify' 
  | 'confirm' 
  | 'commit' 
  | 'completed';

interface PhaseHistoryEntry {
  phase: WorkflowPhase;
  timestamp: Date;
}

interface PhaseValidationResult {
  allowed: boolean;
  reason?: string;
}

interface WorkflowCompletionValidation {
  complete: boolean;
  missingPhases: string[];
  warnings: string[];
}

interface WorkflowContext {
  hasTaskList?: boolean;
  testsRun?: boolean;
  verificationComplete?: boolean;
  commitExecuted?: boolean;
}

export class WorkflowValidator {
  private currentPhase: WorkflowPhase = 'assess';
  private phaseHistory: PhaseHistoryEntry[] = [];
  private enabled: boolean = true;
  private context: WorkflowContext = {};

  constructor(initialPhase: WorkflowPhase = 'assess', enabled: boolean = true) {
    this.currentPhase = initialPhase;
    this.enabled = enabled;
    this.recordPhaseTransition(initialPhase);
  }

  /**
   * Detect phase announcements in AI response text
   * Looks for emoji markers: 🔍 📋 ⚡ 🧪 ✓ ✅ 📤
   */
  detectPhaseAnnouncement(text: string): WorkflowPhase | null {
    if (!this.enabled || !text) return null;

    const patterns: Array<{ phase: WorkflowPhase; regex: RegExp }> = [
      { phase: 'assess', regex: /🔍\s*(Assessing|Assessment)/i },
      { phase: 'plan', regex: /📋\s*(Planning|Plan)/i },
      { phase: 'execute', regex: /⚡\s*(Executing|Execute)/i },
      { phase: 'test', regex: /🧪\s*(Testing|Test)/i },
      { phase: 'verify', regex: /✓\s*(Verifying|Verify)/i },
      { phase: 'confirm', regex: /✅\s*(Complete|Confirmed)/i },
      { phase: 'commit', regex: /📤\s*(Committed|Committing)/i },
    ];

    for (const { phase, regex } of patterns) {
      if (regex.test(text)) {
        return phase;
      }
    }

    return null;
  }

  /**
   * Validate if transition to new phase is allowed
   * Enforces sequential progression with some flexibility
   */
  canTransitionTo(newPhase: WorkflowPhase): boolean {
    if (!this.enabled) return true;

    const phaseOrder: WorkflowPhase[] = [
      'assess',
      'plan',
      'execute',
      'test',
      'verify',
      'confirm',
      'commit',
      'completed'
    ];

    const currentIndex = phaseOrder.indexOf(this.currentPhase);
    const newIndex = phaseOrder.indexOf(newPhase);

    // Allow staying in same phase
    if (currentIndex === newIndex) return true;

    // Allow moving forward sequentially
    if (newIndex === currentIndex + 1) return true;

    // Special cases: Allow skipping PLAN for trivial tasks
    // (from assess directly to execute)
    if (this.currentPhase === 'assess' && newPhase === 'execute') {
      console.log('[WORKFLOW-VALIDATOR] Allowing PLAN skip (trivial task)');
      return true;
    }

    // Allow skipping to CONFIRM from VERIFY (if no commit needed)
    if (this.currentPhase === 'verify' && newPhase === 'confirm') {
      return true;
    }

    // Disallow backwards movement (except restarts)
    if (newIndex < currentIndex && newPhase !== 'assess') {
      console.warn(`[WORKFLOW-VALIDATOR] Cannot move backwards from ${this.currentPhase} to ${newPhase}`);
      return false;
    }

    // Disallow skipping multiple phases
    if (newIndex > currentIndex + 1) {
      console.warn(`[WORKFLOW-VALIDATOR] Cannot skip from ${this.currentPhase} to ${newPhase}`);
      return false;
    }

    return false;
  }

  /**
   * Transition to a new phase
   */
  transitionTo(newPhase: WorkflowPhase): void {
    if (!this.enabled) {
      this.currentPhase = newPhase;
      return;
    }

    if (this.canTransitionTo(newPhase)) {
      this.currentPhase = newPhase;
      this.recordPhaseTransition(newPhase);
      console.log(`[WORKFLOW-VALIDATOR] ✅ Transitioned to ${newPhase}`);
    } else {
      console.warn(`[WORKFLOW-VALIDATOR] ❌ Invalid transition to ${newPhase} from ${this.currentPhase}`);
    }
  }

  /**
   * Validate tool call based on current phase
   */
  validateToolCall(toolName: string, phase?: WorkflowPhase): PhaseValidationResult {
    if (!this.enabled) return { allowed: true };

    const currentPhase = phase || this.currentPhase;

    // Define allowed tools per phase
    const phaseToolRules: Record<WorkflowPhase, {
      allowed?: string[];
      disallowed?: string[];
      description: string;
    }> = {
      assess: {
        allowed: [
          'readPlatformFile',
          'readProjectFile',
          'listPlatformDirectory',
          'listProjectDirectory',
          'perform_diagnosis',
          'read_logs',
          'searchCodebase',
          'grep',
        ],
        description: 'ASSESS phase: Only read/diagnostic tools allowed',
      },
      plan: {
        allowed: [
          'createTaskList',
          'readTaskList',
          'readPlatformFile',
          'readProjectFile',
        ],
        description: 'PLAN phase: Only task list and read tools allowed',
      },
      execute: {
        disallowed: [
          'run_playwright_test',
          'bash(npm test)',
          'bash(pytest)',
        ],
        description: 'EXECUTE phase: All tools except test runners allowed',
      },
      test: {
        allowed: [
          'run_playwright_test',
          'bash',
          'readPlatformFile',
          'readProjectFile',
          'updateTask',
        ],
        description: 'TEST phase: Test runners and diagnostics allowed',
      },
      verify: {
        allowed: [
          'bash',
          'check_compilation',
          'check_lsp_diagnostics',
          'readPlatformFile',
          'readProjectFile',
          'updateTask',
        ],
        description: 'VERIFY phase: Compilation and validation tools allowed',
      },
      confirm: {
        allowed: [
          'updateTask',
          'readTaskList',
        ],
        description: 'CONFIRM phase: Only status updates allowed',
      },
      commit: {
        allowed: [
          'git_commit',
          'git_push',
          'bash',
          'updateTask',
        ],
        description: 'COMMIT phase: Only git operations allowed',
      },
      completed: {
        allowed: [],
        description: 'COMPLETED phase: No tools allowed',
      },
    };

    const rules = phaseToolRules[currentPhase];

    // Check explicit allow list
    if (rules.allowed) {
      const isAllowed = rules.allowed.some(pattern => {
        if (pattern.includes('(')) {
          // Pattern like "bash(npm test)"
          return toolName.startsWith(pattern.split('(')[0]);
        }
        return toolName === pattern || toolName.startsWith(pattern);
      });

      if (!isAllowed) {
        return {
          allowed: false,
          reason: `${rules.description}. Tool "${toolName}" not in allowed list.`,
        };
      }
    }

    // Check explicit disallow list
    if (rules.disallowed) {
      const isDisallowed = rules.disallowed.some(pattern => {
        if (pattern.includes('(')) {
          return toolName.startsWith(pattern.split('(')[0]);
        }
        return toolName === pattern;
      });

      if (isDisallowed) {
        return {
          allowed: false,
          reason: `${rules.description}. Tool "${toolName}" is disallowed in this phase.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if phase requirements are met
   */
  checkPhaseCompletion(phase: WorkflowPhase, context: WorkflowContext): boolean {
    if (!this.enabled) return true;

    switch (phase) {
      case 'plan':
        if (!context.hasTaskList) {
          console.warn('[WORKFLOW-VALIDATOR] PLAN incomplete: No task list created');
          return false;
        }
        return true;

      case 'test':
        if (!context.testsRun) {
          console.warn('[WORKFLOW-VALIDATOR] TEST incomplete: No tests executed');
          return false;
        }
        return true;

      case 'verify':
        if (!context.verificationComplete) {
          console.warn('[WORKFLOW-VALIDATOR] VERIFY incomplete: No verification checks run');
          return false;
        }
        return true;

      case 'commit':
        if (!context.commitExecuted) {
          console.warn('[WORKFLOW-VALIDATOR] COMMIT incomplete: No commit executed');
          return false;
        }
        return true;

      default:
        return true;
    }
  }

  /**
   * Validate overall workflow completion
   */
  validateWorkflowCompletion(context: WorkflowContext): WorkflowCompletionValidation {
    if (!this.enabled) {
      return { complete: true, missingPhases: [], warnings: [] };
    }

    const missingPhases: string[] = [];
    const warnings: string[] = [];

    // Check if PLAN phase was executed (unless skipped for trivial task)
    const hasPlanned = this.phaseHistory.some(entry => entry.phase === 'plan');
    if (!hasPlanned && !context.hasTaskList) {
      warnings.push('PLAN phase skipped - ensure this was a trivial single-step task');
    }

    // Check if TEST phase was executed
    const hasTested = this.phaseHistory.some(entry => entry.phase === 'test');
    if (!hasTested && !context.testsRun) {
      missingPhases.push('TEST');
      warnings.push('TEST phase not executed - functionality not verified');
    }

    // Check if VERIFY phase was executed
    const hasVerified = this.phaseHistory.some(entry => entry.phase === 'verify');
    if (!hasVerified && !context.verificationComplete) {
      missingPhases.push('VERIFY');
      warnings.push('VERIFY phase not executed - compilation/quality not checked');
    }

    // Check if COMMIT phase was executed (if needed)
    const hasCommitted = this.phaseHistory.some(entry => entry.phase === 'commit');
    if (!hasCommitted && !context.commitExecuted) {
      warnings.push('COMMIT phase not executed - changes not persisted');
    }

    const complete = missingPhases.length === 0;

    return {
      complete,
      missingPhases,
      warnings,
    };
  }

  /**
   * Update workflow context
   */
  updateContext(updates: Partial<WorkflowContext>): void {
    this.context = { ...this.context, ...updates };
    console.log('[WORKFLOW-VALIDATOR] Context updated:', updates);
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): WorkflowPhase {
    return this.currentPhase;
  }

  /**
   * Get phase history for audit trail
   */
  getPhaseHistory(): PhaseHistoryEntry[] {
    return [...this.phaseHistory];
  }

  /**
   * Reset validator (for new job)
   */
  reset(): void {
    this.currentPhase = 'assess';
    this.phaseHistory = [];
    this.context = {};
    this.recordPhaseTransition('assess');
    console.log('[WORKFLOW-VALIDATOR] Reset to initial state');
  }

  /**
   * Enable/disable validator
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[WORKFLOW-VALIDATOR] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Record phase transition for audit trail
   */
  private recordPhaseTransition(phase: WorkflowPhase): void {
    this.phaseHistory.push({
      phase,
      timestamp: new Date(),
    });
  }

  /**
   * Get workflow summary for debugging
   */
  getSummary(): string {
    const phaseSequence = this.phaseHistory.map(e => e.phase).join(' → ');
    return `Current: ${this.currentPhase} | History: ${phaseSequence} | Context: ${JSON.stringify(this.context)}`;
  }
}
