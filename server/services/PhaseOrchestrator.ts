// ============================================================================
// T2: PHASE ORCHESTRATION - DETERMINISTIC STATE MACHINE
// ============================================================================

export type Phase = 'thinking' | 'planning' | 'working' | 'verifying' | 'complete';

export interface PhaseTransition {
  phase: Phase;
  message: string;
  timestamp: Date;
}

export interface PhaseEmitter {
  (phase: Phase, message: string): void;
}

export interface PhaseChangeCallback {
  (runId: string, phase: Phase, message: string): void;
}

export class PhaseOrchestrator {
  private currentPhase: Phase | null = null;
  private emittedPhases: Set<Phase> = new Set();
  private transitions: PhaseTransition[] = [];
  private readonly emitter: PhaseEmitter;
  private readonly runId: string;
  private readonly onPhaseChange?: PhaseChangeCallback;
  
  // Phase sequence for validation
  private static readonly PHASE_SEQUENCE: Phase[] = [
    'thinking',
    'planning',
    'working',
    'verifying',
    'complete'
  ];
  
  // Phase order map for comparison
  private static readonly PHASE_ORDER: Record<Phase, number> = {
    'thinking': 0,
    'planning': 1,
    'working': 2,
    'verifying': 3,
    'complete': 4
  };

  constructor(
    emitter: PhaseEmitter, 
    runId: string,
    onPhaseChange?: PhaseChangeCallback
  ) {
    this.emitter = emitter;
    this.runId = runId;
    this.onPhaseChange = onPhaseChange;
  }

  /**
   * Emit a phase event with idempotent guards
   * @param phase - The phase to emit
   * @param message - The message to display for this phase
   * @returns true if phase was emitted, false if skipped (already emitted)
   */
  public emitPhase(phase: Phase, message: string): boolean {
    // ✅ IDEMPOTENT GUARD: Prevent double emissions
    if (this.emittedPhases.has(phase)) {
      console.log(`[PHASE-ORCHESTRATOR] ⏭️  Skipped phase '${phase}' (already emitted)`);
      return false;
    }

    // ✅ SEQUENCE VALIDATION: Warn if emitting out of order (but allow it)
    if (this.currentPhase !== null) {
      const currentOrder = PhaseOrchestrator.PHASE_ORDER[this.currentPhase];
      const newOrder = PhaseOrchestrator.PHASE_ORDER[phase];
      
      if (newOrder < currentOrder) {
        console.warn(`[PHASE-ORCHESTRATOR] ⚠️  Phase '${phase}' emitted after '${this.currentPhase}' (out of order)`);
      } else if (newOrder > currentOrder + 1) {
        const skippedPhases = PhaseOrchestrator.PHASE_SEQUENCE.slice(currentOrder + 1, newOrder);
        console.log(`[PHASE-ORCHESTRATOR] ⏭️  Skipped phases: ${skippedPhases.join(', ')}`);
      }
    }

    // Emit the phase
    this.emitter(phase, message);
    this.currentPhase = phase;
    this.emittedPhases.add(phase);
    this.transitions.push({
      phase,
      message,
      timestamp: new Date()
    });

    // Call onPhaseChange callback to update RunStateManager
    if (this.onPhaseChange) {
      this.onPhaseChange(this.runId, phase, message);
    }

    console.log(`[PHASE-ORCHESTRATOR] ✅ Emitted phase '${phase}': ${message}`);
    return true;
  }

  /**
   * Emit thinking phase (pre-loop milestone)
   */
  public emitThinking(message: string = 'Analyzing your request and considering approaches...'): boolean {
    return this.emitPhase('thinking', message);
  }

  /**
   * Emit planning phase (first plan creation milestone)
   */
  public emitPlanning(message: string = 'Creating a plan to address your request...'): boolean {
    return this.emitPhase('planning', message);
  }

  /**
   * Emit working phase (first tool call milestone)
   */
  public emitWorking(message: string = 'Implementing changes...'): boolean {
    return this.emitPhase('working', message);
  }

  /**
   * Emit verifying phase (validation start milestone)
   */
  public emitVerifying(message: string = 'Verifying changes and running validation...'): boolean {
    return this.emitPhase('verifying', message);
  }

  /**
   * Emit complete phase (completion milestone)
   */
  public emitComplete(message: string = 'Task completed successfully!'): boolean {
    return this.emitPhase('complete', message);
  }

  /**
   * Check if a phase has been emitted
   */
  public hasEmitted(phase: Phase): boolean {
    return this.emittedPhases.has(phase);
  }

  /**
   * Get current phase
   */
  public getCurrentPhase(): Phase | null {
    return this.currentPhase;
  }

  /**
   * Get all phase transitions
   */
  public getTransitions(): PhaseTransition[] {
    return [...this.transitions];
  }

  /**
   * Get summary of phase timeline
   */
  public getSummary(): string {
    const phaseList = this.transitions.map(t => t.phase).join(' → ');
    const duration = this.transitions.length > 1
      ? this.transitions[this.transitions.length - 1].timestamp.getTime() - this.transitions[0].timestamp.getTime()
      : 0;
    
    return `Phases: ${phaseList} (${duration}ms)`;
  }

  /**
   * Reset orchestrator (for testing or new runs)
   */
  public reset(): void {
    this.currentPhase = null;
    this.emittedPhases.clear();
    this.transitions = [];
    console.log('[PHASE-ORCHESTRATOR] 🔄 Reset orchestrator');
  }
}
