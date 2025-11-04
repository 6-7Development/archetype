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

interface PhaseTransitionResult {
  allowed: boolean;
  reason?: string;
}

interface WorkflowCompletionValidation {
  complete: boolean;
  missingRequirements: string[];
}

interface WorkflowContext {
  hasTaskList?: boolean;
  testsRun?: boolean;
  verificationComplete?: boolean;
  commitExecuted?: boolean;
  autoCommit?: boolean;
}

interface WorkflowConfirmations {
  testsRun: boolean;
  testsPassed: boolean;
  verificationComplete: boolean;
  compilationChecked: boolean;
  commitExecuted: boolean;
}

export class WorkflowValidator {
  private currentPhase: WorkflowPhase = 'assess';
  private phaseHistory: PhaseHistoryEntry[] = [];
  private enabled: boolean = true;
  private context: WorkflowContext = {};
  private planSkipJustification: string | null = null;
  private confirmations: WorkflowConfirmations = {
    testsRun: false,
    testsPassed: false,
    verificationComplete: false,
    compilationChecked: false,
    commitExecuted: false
  };
  private iterationsSincePhaseChange = 0;
  private maxIterationsWithoutPhase = 2;
  private blockToolsUntilPhaseAnnouncement = false;

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
   * FIX 1: Justify skipping PLAN phase
   * Agent must call this to explicitly justify assess→execute transition
   */
  justifyPlanSkip(reason: string): boolean {
    const validReasons = ['single file read', 'read-only query', 'status check', 'trivial'];
    const isValid = validReasons.some(v => reason.toLowerCase().includes(v));
    
    if (isValid) {
      this.planSkipJustification = reason;
      console.log(`[WORKFLOW-VALIDATOR] Plan skip justified: ${reason}`);
      return true;
    }
    
    console.error(`[WORKFLOW-VALIDATOR] Invalid plan skip reason: ${reason}`);
    return false;
  }

  /**
   * Validate if transition to new phase is allowed
   * FIX 1: Returns object with allowed + reason (for hard blocking)
   * FIX 1: Requires explicit justification for assess→execute
   */
  canTransitionTo(newPhase: WorkflowPhase): PhaseTransitionResult {
    if (!this.enabled) return { allowed: true };

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
    if (currentIndex === newIndex) return { allowed: true };

    // Allow moving forward sequentially
    if (newIndex === currentIndex + 1) return { allowed: true };

    // FIX 1: STRICT ENFORCEMENT - Require explicit justification for PLAN skip
    if (this.currentPhase === 'assess' && newPhase === 'execute') {
      if (!this.planSkipJustification) {
        return {
          allowed: false,
          reason: 'PLAN phase required unless explicitly justified. Call justifyPlanSkip() first or transition to PLAN phase.'
        };
      }
      console.log('[WORKFLOW-VALIDATOR] Allowing PLAN skip (justified)');
      return { allowed: true };
    }

    // Allow skipping to CONFIRM from VERIFY (if no commit needed)
    if (this.currentPhase === 'verify' && newPhase === 'confirm') {
      return { allowed: true };
    }

    // Disallow backwards movement (except restarts)
    if (newIndex < currentIndex && newPhase !== 'assess') {
      return {
        allowed: false,
        reason: `Cannot move backwards from ${this.currentPhase} to ${newPhase}`
      };
    }

    // Disallow skipping multiple phases
    if (newIndex > currentIndex + 1) {
      return {
        allowed: false,
        reason: `Cannot skip from ${this.currentPhase} to ${newPhase} - must follow sequential phases`
      };
    }

    return { allowed: false, reason: 'Invalid phase transition' };
  }

  /**
   * Transition to a new phase
   * Updated for FIX 2: Now uses PhaseTransitionResult
   * Updated for FIX 1: Reset iteration counter on valid transition
   */
  transitionTo(newPhase: WorkflowPhase): void {
    if (!this.enabled) {
      this.currentPhase = newPhase;
      return;
    }

    const transition = this.canTransitionTo(newPhase);
    if (transition.allowed) {
      this.currentPhase = newPhase;
      this.recordPhaseTransition(newPhase);
      this.iterationsSincePhaseChange = 0;
      this.blockToolsUntilPhaseAnnouncement = false;
      console.log(`[WORKFLOW-VALIDATOR] ✅ Transitioned to ${newPhase}`);
    } else {
      console.warn(`[WORKFLOW-VALIDATOR] ❌ Invalid transition to ${newPhase} from ${this.currentPhase}: ${transition.reason}`);
    }
  }

  /**
   * FIX 3: Confirm tests have been run
   */
  confirmTestsRun(passed: boolean): void {
    this.confirmations.testsRun = true;
    this.confirmations.testsPassed = passed;
    console.log(`[WORKFLOW-VALIDATOR] Tests confirmed: ${passed ? 'PASSED' : 'FAILED'}`);
  }

  /**
   * FIX 3: Confirm verification has been completed
   */
  confirmVerification(compilationOk: boolean): void {
    this.confirmations.verificationComplete = true;
    this.confirmations.compilationChecked = compilationOk;
    console.log(`[WORKFLOW-VALIDATOR] Verification confirmed: ${compilationOk ? 'OK' : 'FAILED'}`);
  }

  /**
   * FIX 3: Confirm commit has been executed
   */
  confirmCommit(success: boolean): void {
    this.confirmations.commitExecuted = success;
    console.log(`[WORKFLOW-VALIDATOR] Commit confirmed: ${success ? 'SUCCESS' : 'FAILED'}`);
  }

  /**
   * FIX 1: Increment iteration counter to enforce phase announcements
   */
  incrementIteration(): void {
    this.iterationsSincePhaseChange++;
    
    if (this.iterationsSincePhaseChange >= this.maxIterationsWithoutPhase) {
      console.warn(`[WORKFLOW-VALIDATOR] No phase announcement for ${this.iterationsSincePhaseChange} iterations - BLOCKING tools`);
      this.blockToolsUntilPhaseAnnouncement = true;
    }
  }

  /**
   * Validate tool call based on current phase
   * FIX 1: Check if tools are blocked due to missing phase announcement
   * FIX 5: Tighten ASSESS phase to only allow read-only tools
   */
  validateToolCall(toolName: string, phase?: WorkflowPhase): PhaseValidationResult {
    if (!this.enabled) return { allowed: true };

    // FIX 1: HARD BLOCK if no phase announcement detected
    if (this.blockToolsUntilPhaseAnnouncement) {
      return {
        allowed: false,
        reason: `No phase announcement detected. You must announce current phase with emoji (🔍 Assessing, 📋 Planning, ⚡ Executing, etc.) before using tools.`
      };
    }

    const currentPhase = phase || this.currentPhase;

    // FIX 5: Define STRICT read-only allowlist for ASSESS phase
    const ASSESS_READ_ONLY_TOOLS = [
      'readPlatformFile',
      'readProjectFile',
      'listPlatformDirectory',
      'listProjectDirectory',
      'perform_diagnosis',
      'read_logs',
      'searchCodebase',
      'grep',
    ];

    // FIX 5: ASSESS phase ONLY allows read-only tools - explicitly block everything else
    if (currentPhase === 'assess') {
      const isReadOnly = ASSESS_READ_ONLY_TOOLS.some(pattern => 
        toolName === pattern || toolName.startsWith(pattern)
      );
      
      if (!isReadOnly) {
        return {
          allowed: false,
          reason: `ASSESS phase only allows read-only tools. ${toolName} is a write/execute operation. Announce "⚡ Executing..." first.`
        };
      }
    }

    // Define allowed tools per phase
    const phaseToolRules: Record<WorkflowPhase, {
      allowed?: string[];
      disallowed?: string[];
      description: string;
    }> = {
      assess: {
        allowed: ASSESS_READ_ONLY_TOOLS,
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
   * Helper: Check if a phase has been reached in history
   */
  private hasReachedPhase(phase: WorkflowPhase): boolean {
    return this.phaseHistory.some(entry => entry.phase === phase);
  }

  /**
   * FIX 3: Validate overall workflow completion with STRICT REQUIREMENTS
   * Now requires positive confirmations - no assumptions allowed
   * Updated to accept context parameter for commit enforcement
   */
  validateWorkflowCompletion(context?: WorkflowContext): WorkflowCompletionValidation {
    if (!this.enabled) {
      return { complete: true, missingRequirements: [] };
    }

    const missing: string[] = [];

    // FIX 3: Check phase history - PLAN required unless justified
    if (!this.hasReachedPhase('plan') && !this.planSkipJustification) {
      missing.push('PLAN phase (no task list created or skip justification)');
    }

    // FIX 3: REQUIRE positive test confirmation (not just context flag)
    if (!this.confirmations.testsRun) {
      missing.push('TEST phase (tests not run)');
    } else if (!this.confirmations.testsPassed) {
      missing.push('TEST phase (tests failed)');
    }

    // FIX 3: REQUIRE positive verification confirmation
    if (!this.confirmations.verificationComplete) {
      missing.push('VERIFY phase (verification not run)');
    } else if (!this.confirmations.compilationChecked) {
      missing.push('VERIFY phase (compilation failed)');
    }

    // FIX 3: Check commit if autoCommit enabled
    if (context?.autoCommit && !this.confirmations.commitExecuted) {
      missing.push('COMMIT phase (auto-commit enabled but no commit executed)');
    }

    return {
      complete: missing.length === 0,
      missingRequirements: missing
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
    this.planSkipJustification = null;
    this.confirmations = {
      testsRun: false,
      testsPassed: false,
      verificationComplete: false,
      compilationChecked: false,
      commitExecuted: false
    };
    this.iterationsSincePhaseChange = 0;
    this.blockToolsUntilPhaseAnnouncement = false;
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
