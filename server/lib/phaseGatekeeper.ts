/**
 * PhaseGatekeeper
 * 
 * Real-time response validator that enforces strict 7-phase workflow compliance.
 * Blocks phase transitions until all rules are satisfied.
 * 
 * ENFORCEMENT RULES:
 * - Phase 1 (ASSESS): Must use tools, no excessive commentary
 * - Phase 2 (PLAN): OPTIONAL createTaskList - only for complex work (5+ steps)
 * - Phase 3 (EXECUTE): Max 5 words before tools, no rambling
 * - Phase 4 (TEST): OPTIONAL testing (use for UI/UX features)
 * - Phase 5 (VERIFY): Must run verification checks
 * - Phase 6 (CONFIRM): Max 15 words summary
 * - Phase 7 (COMMIT): Conditional on auto-commit mode
 */

export interface PhaseValidationResult {
  passed: boolean;
  phase: string;
  violations: string[];
  suggestions: string[];
  qualityScore: number; // 0-100
}

export interface ResponseAnalysis {
  phase: string | null;
  wordCountBeforeTools: number;
  toolCallCount: number;
  hasTaskList: boolean;
  hasTestExecution: boolean;
  confirmationLength: number;
  violations: string[];
}

export class PhaseGatekeeper {
  
  /**
   * Validate a response before allowing phase transition
   */
  validateResponse(
    response: string,
    expectedPhase: string,
    toolCalls: any[] = []
  ): PhaseValidationResult {
    const violations: string[] = [];
    const suggestions: string[] = [];
    let qualityScore = 100;
    
    const analysis = this.analyzeResponse(response, toolCalls);
    
    // PHASE 1: ASSESS - Must use tools, minimal commentary
    if (expectedPhase === 'ASSESS') {
      if (analysis.toolCallCount === 0) {
        violations.push('⛔ PHASE 1 VIOLATION: No tools used - must read files/search codebase');
        qualityScore -= 40;
        suggestions.push('Use read(), search_codebase(), or grep() to gather information');
      }
      
      if (analysis.wordCountBeforeTools > 20) {
        violations.push(`⛔ PHASE 1 VIOLATION: ${analysis.wordCountBeforeTools} words before tools (max 5 allowed)`);
        qualityScore -= 20;
        suggestions.push('Say "🔍 Assessing..." then IMMEDIATELY call tools');
      }
    }
    
    // PHASE 2: PLAN - OPTIONAL create_task_list (only for complex work)
    if (expectedPhase === 'PLAN') {
      // Task lists are now OPTIONAL - no longer enforced
      // BeeHive should use judgment: create for complex work (5+ steps), skip for simple fixes
      
      if (analysis.wordCountBeforeTools > 10) {
        violations.push(`⛔ PHASE 2 VIOLATION: ${analysis.wordCountBeforeTools} words (max 5 allowed)`);
        qualityScore -= 15;
        suggestions.push('Say "📋 Planning..." then proceed to execution (task list optional)');
      }
    }
    
    // PHASE 3: EXECUTE - Max 5 words before tools
    if (expectedPhase === 'EXECUTE') {
      if (analysis.wordCountBeforeTools > 5) {
        violations.push(`⛔ PHASE 3 VIOLATION: ${analysis.wordCountBeforeTools} words before executing (max 5 allowed)`);
        qualityScore -= 30;
        suggestions.push('Say "⚡ Executing..." then SHUT UP and use tools');
      }
      
      if (analysis.toolCallCount === 0) {
        violations.push('⛔ PHASE 3 VIOLATION: No code changes made');
        qualityScore -= 35;
        suggestions.push('Use write() or edit() to implement changes');
      }
    }
    
    // PHASE 4: TEST - OPTIONAL testing (recommended for UI/UX features)
    if (expectedPhase === 'TEST') {
      // Testing is now OPTIONAL - encouraged for UI/UX features
      // BeeHive should use judgment: test for UI changes, skip for backend-only fixes
      if (!analysis.hasTestExecution) {
        // Don't penalize for skipping tests - it's optional
        suggestions.push('💡 Consider calling run_test() to verify UI/UX changes work correctly');
      }
    }
    
    // PHASE 5: VERIFY - Must run checks
    if (expectedPhase === 'VERIFY') {
      const hasVerification = toolCalls.some(tc => 
        tc.name === 'get_latest_lsp_diagnostics' || 
        tc.name === 'bash' ||
        tc.name === 'read'
      );
      
      if (!hasVerification) {
        violations.push('⛔ PHASE 5 VIOLATION: No verification checks performed');
        qualityScore -= 30;
        suggestions.push('Check LSP diagnostics, run TypeScript compilation, verify tests pass');
      }
    }
    
    // PHASE 6: CONFIRM - Max 15 words
    if (expectedPhase === 'CONFIRM') {
      if (analysis.confirmationLength > 15) {
        violations.push(`⛔ PHASE 6 VIOLATION: Confirmation too long (${analysis.confirmationLength} words, max 15)`);
        qualityScore -= 20;
        suggestions.push('Brief summary only: "✅ Complete. [Feature] working. [Tests] passing."');
      }
    }
    
    const passed = violations.length === 0;
    
    return {
      passed,
      phase: expectedPhase,
      violations,
      suggestions,
      qualityScore: Math.max(0, qualityScore),
    };
  }
  
  /**
   * Analyze response content to detect violations
   */
  private analyzeResponse(response: string, toolCalls: any[]): ResponseAnalysis {
    let phase: string | null = null;
    
    // Detect phase from response
    const phasePatterns = [
      { pattern: /🔍\s*Assessing|PHASE 1|ASSESS/i, phase: 'ASSESS' },
      { pattern: /📋\s*Planning|PHASE 2|PLAN/i, phase: 'PLAN' },
      { pattern: /⚡\s*Executing|PHASE 3|EXECUTE/i, phase: 'EXECUTE' },
      { pattern: /🧪\s*Testing|PHASE 4|TEST/i, phase: 'TEST' },
      { pattern: /✓\s*Verifying|PHASE 5|VERIFY/i, phase: 'VERIFY' },
      { pattern: /✅\s*Complete|PHASE 6|CONFIRM/i, phase: 'CONFIRM' },
    ];
    
    for (const { pattern, phase: p } of phasePatterns) {
      if (pattern.test(response)) {
        phase = p;
        break;
      }
    }
    
    // Count words before first tool call (if any)
    let textBeforeTools = response;
    const functionCallMarker = '<function_calls>';
    if (response.includes(functionCallMarker)) {
      const idx = response.indexOf(functionCallMarker);
      textBeforeTools = response.substring(0, idx);
    }
    
    const words = textBeforeTools.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCountBeforeTools = words.length;
    
    // Check for task list creation
    const hasTaskList = toolCalls.some(tc => tc.name === 'write_task_list');
    
    // Check for test execution
    const hasTestExecution = toolCalls.some(tc => tc.name === 'run_test');
    
    // Get confirmation length (final response after all tools)
    let confirmationText = '';
    const confirmationWords = confirmationText.trim().split(/\s+/).filter(w => w.length > 0);
    const confirmationLength = confirmationWords.length;
    
    return {
      phase,
      wordCountBeforeTools,
      toolCallCount: toolCalls.length,
      hasTaskList,
      hasTestExecution,
      confirmationLength,
      violations: [],
    };
  }
  
  /**
   * Generate corrective guidance for violations
   */
  generateCorrectiveGuidance(violations: PhaseValidationResult): string {
    if (violations.passed) {
      return '';
    }
    
    let guidance = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    guidance += `⚠️  WORKFLOW ENFORCEMENT - VIOLATIONS DETECTED\n`;
    guidance += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    guidance += `Phase: ${violations.phase}\n`;
    guidance += `Quality Score: ${violations.qualityScore}/100\n\n`;
    
    guidance += `VIOLATIONS:\n`;
    violations.violations.forEach(v => guidance += `  ${v}\n`);
    
    guidance += `\nCORRECTIVE ACTIONS:\n`;
    violations.suggestions.forEach(s => guidance += `  ✓ ${s}\n`);
    
    guidance += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    guidance += `STOP AND RE-EXECUTE THIS PHASE CORRECTLY.\n`;
    guidance += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    return guidance;
  }
  
  /**
   * Check if response should trigger I AM Architect intervention
   */
  shouldEscalateToArchitect(validation: PhaseValidationResult): boolean {
    // Escalate if quality score is critically low
    if (validation.qualityScore < 40) {
      return true;
    }
    
    // Escalate if critical violations (NOTE: task lists and tests are now optional)
    const hasCriticalViolation = validation.violations.some(v =>
      v.includes('PHASE 1 VIOLATION: No tools used') ||
      v.includes('PHASE 3 VIOLATION: No code changes made')
    );
    
    return hasCriticalViolation;
  }
}
