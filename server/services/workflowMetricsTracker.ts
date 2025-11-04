/**
 * Workflow Metrics Tracker for LomuAI v2.0
 * 
 * Tracks comprehensive metrics for workflow enforcement:
 * - Phase transitions with timestamps
 * - Violations and enforcement actions
 * - Token usage and efficiency
 * - Test execution and verification
 * - Quality scores
 * 
 * Used by lomuJobManager.ts to measure and improve LomuAI workflow compliance
 */

import type { InsertLomuWorkflowMetrics } from '@shared/schema';

export interface ViolationRecord {
  type: 'phase_skip' | 'test_skip' | 'direct_edit' | 'no_announcement' | 'excessive_rambling' | 'tool_block';
  phase: string;
  message: string;
  timestamp: string;
}

interface PhaseTimestamps {
  [phase: string]: string;
}

export class WorkflowMetricsTracker {
  private jobId: string;
  private userId: string;
  private startTime: Date;
  
  private phasesExecuted: string[] = [];
  private phaseTimestamps: PhaseTimestamps = {};
  private phasesSkipped: string[] = [];
  private currentPhase: string | null = null;
  private phaseStartTimes: Map<string, Date> = new Map();
  
  private planSkipJustified: boolean = false;
  
  private testsRun: boolean = false;
  private testsPassed: boolean = false;
  private compilationChecked: boolean = false;
  private verificationComplete: boolean = false;
  private workflowRestarted: boolean = false;
  
  private violations: ViolationRecord[] = [];
  private restartCount: number = 0;
  private toolBlockCount: number = 0;
  
  private totalTokens: number = 0;
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  private iterationCount: number = 0;
  
  private assessDurationMs: number = 0;
  private planDurationMs: number = 0;
  private executeDurationMs: number = 0;
  private testDurationMs: number = 0;
  private verifyDurationMs: number = 0;
  
  private commitExecuted: boolean = false;
  private filesModified: number = 0;
  private jobStatus: 'completed' | 'failed' | 'interrupted' = 'interrupted';

  constructor(jobId: string, userId: string) {
    this.jobId = jobId;
    this.userId = userId;
    this.startTime = new Date();
    console.log(`[METRICS-TRACKER] Initialized for job ${jobId}`);
  }

  /**
   * Record a phase transition with timestamp
   */
  recordPhaseTransition(phase: string): void {
    const now = new Date();
    const timestamp = now.toISOString();
    
    // End timing for previous phase if exists
    if (this.currentPhase && this.phaseStartTimes.has(this.currentPhase)) {
      const phaseStart = this.phaseStartTimes.get(this.currentPhase)!;
      const durationMs = now.getTime() - phaseStart.getTime();
      
      // Record duration by phase name
      switch (this.currentPhase) {
        case 'assess':
          this.assessDurationMs += durationMs;
          break;
        case 'plan':
          this.planDurationMs += durationMs;
          break;
        case 'execute':
          this.executeDurationMs += durationMs;
          break;
        case 'test':
          this.testDurationMs += durationMs;
          break;
        case 'verify':
          this.verifyDurationMs += durationMs;
          break;
      }
    }
    
    // Record new phase
    if (!this.phasesExecuted.includes(phase)) {
      this.phasesExecuted.push(phase);
    }
    this.phaseTimestamps[phase] = timestamp;
    this.currentPhase = phase;
    this.phaseStartTimes.set(phase, now);
    
    console.log(`[METRICS-TRACKER] Phase transition: ${phase} at ${timestamp}`);
  }

  /**
   * Record a phase skip (with or without justification)
   */
  recordPhaseSkip(phase: string, justified: boolean = false): void {
    if (!this.phasesSkipped.includes(phase)) {
      this.phasesSkipped.push(phase);
    }
    
    if (phase === 'plan') {
      this.planSkipJustified = justified;
    }
    
    console.log(`[METRICS-TRACKER] Phase skipped: ${phase} (justified: ${justified})`);
  }

  /**
   * Record a workflow violation
   */
  recordViolation(
    type: ViolationRecord['type'],
    phase: string,
    message: string
  ): void {
    const violation: ViolationRecord = {
      type,
      phase,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.violations.push(violation);
    console.log(`[METRICS-TRACKER] Violation recorded: ${type} in ${phase} - ${message}`);
  }

  /**
   * Increment RESTART injection count
   */
  recordRestart(): void {
    this.restartCount++;
    console.log(`[METRICS-TRACKER] RESTART count: ${this.restartCount}`);
  }

  /**
   * Increment tool block count (when validator blocks a tool call)
   */
  recordToolBlock(): void {
    this.toolBlockCount++;
    console.log(`[METRICS-TRACKER] Tool block count: ${this.toolBlockCount}`);
  }

  /**
   * Record token usage from Gemini response
   */
  recordTokenUsage(input: number, output: number): void {
    this.inputTokens += input;
    this.outputTokens += output;
    this.totalTokens += (input + output);
    this.iterationCount++;
    
    console.log(`[METRICS-TRACKER] Token usage: +${input} input, +${output} output (total: ${this.totalTokens})`);
  }

  /**
   * Record test execution
   */
  recordTestExecution(passed: boolean): void {
    this.testsRun = true;
    this.testsPassed = passed;
    console.log(`[METRICS-TRACKER] Tests executed: ${passed ? 'PASSED' : 'FAILED'}`);
  }

  /**
   * Record compilation check
   */
  recordCompilationCheck(passed: boolean): void {
    this.compilationChecked = passed;
    console.log(`[METRICS-TRACKER] Compilation checked: ${passed ? 'PASSED' : 'FAILED'}`);
  }

  /**
   * Record verification completion
   */
  recordVerificationComplete(): void {
    this.verificationComplete = true;
    console.log(`[METRICS-TRACKER] Verification marked complete`);
  }

  /**
   * Record workflow restart (for verification phase)
   */
  recordWorkflowRestart(): void {
    this.workflowRestarted = true;
    console.log(`[METRICS-TRACKER] Workflow restarted for verification`);
  }

  /**
   * Record commit execution
   */
  recordCommit(filesChanged: number): void {
    this.commitExecuted = true;
    this.filesModified = filesChanged;
    console.log(`[METRICS-TRACKER] Commit executed: ${filesChanged} files modified`);
  }

  /**
   * Set final job status
   */
  setJobStatus(status: 'completed' | 'failed' | 'interrupted'): void {
    this.jobStatus = status;
    console.log(`[METRICS-TRACKER] Job status: ${status}`);
  }

  /**
   * Calculate quality scores based on collected metrics
   */
  private calculateQualityScores(): {
    phaseComplianceScore: number;
    testCoverageScore: number;
    tokenEfficiencyScore: number;
    overallQualityScore: number;
  } {
    // Phase compliance: % of required phases executed (out of 7)
    const phaseComplianceScore = Math.round((this.phasesExecuted.length / 7) * 100);

    // Test coverage: 100 if all tests pass + verification, 50 if tests run but incomplete, 0 if no tests
    let testCoverageScore = 0;
    if (this.testsRun && this.testsPassed && this.verificationComplete) {
      testCoverageScore = 100;
    } else if (this.testsRun) {
      testCoverageScore = 50;
    }

    // Token efficiency: Lower avg tokens per iteration = higher score
    // Baseline: 500 tokens/iteration = 100 score. Each 10 tokens over reduces by 1 point
    const avgTokensPerIteration = this.iterationCount > 0 
      ? this.totalTokens / this.iterationCount 
      : 0;
    const tokenEfficiencyScore = Math.max(
      0, 
      Math.round(100 - (avgTokensPerIteration - 500) / 10)
    );

    // Overall quality: Weighted average
    const overallQualityScore = Math.round(
      phaseComplianceScore * 0.4 +
      testCoverageScore * 0.4 +
      tokenEfficiencyScore * 0.2
    );

    return {
      phaseComplianceScore,
      testCoverageScore,
      tokenEfficiencyScore,
      overallQualityScore
    };
  }

  /**
   * Get final metrics for database insertion
   */
  getFinalMetrics() {
    const now = new Date();
    const totalDurationMs = now.getTime() - this.startTime.getTime();
    
    // Calculate avg tokens per iteration
    const avgTokensPerIteration = this.iterationCount > 0
      ? (this.totalTokens / this.iterationCount).toFixed(2)
      : "0.00";

    // Calculate quality scores
    const scores = this.calculateQualityScores();

    const metrics = {
      jobId: this.jobId,
      userId: this.userId,
      
      // Workflow compliance (use Array.from to ensure proper array type)
      phasesExecuted: Array.from(this.phasesExecuted),
      phaseTimestamps: this.phaseTimestamps,
      phasesSkipped: Array.from(this.phasesSkipped),
      planSkipJustified: this.planSkipJustified,
      
      // Testing & verification
      testsRun: this.testsRun,
      testsPassed: this.testsPassed,
      compilationChecked: this.compilationChecked,
      verificationComplete: this.verificationComplete,
      workflowRestarted: this.workflowRestarted,
      
      // Violations & enforcement
      violationCount: this.violations.length,
      violations: this.violations,
      restartCount: this.restartCount,
      toolBlockCount: this.toolBlockCount,
      
      // Token efficiency
      totalTokens: this.totalTokens,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      iterationCount: this.iterationCount,
      avgTokensPerIteration,
      
      // Quality scores
      phaseComplianceScore: scores.phaseComplianceScore,
      testCoverageScore: scores.testCoverageScore,
      tokenEfficiencyScore: scores.tokenEfficiencyScore,
      overallQualityScore: scores.overallQualityScore,
      
      // Performance metrics
      totalDurationMs,
      assessDurationMs: this.assessDurationMs,
      planDurationMs: this.planDurationMs,
      executeDurationMs: this.executeDurationMs,
      testDurationMs: this.testDurationMs,
      verifyDurationMs: this.verifyDurationMs,
      
      // Outcomes
      jobStatus: this.jobStatus,
      commitExecuted: this.commitExecuted,
      filesModified: this.filesModified,
    };

    console.log(`[METRICS-TRACKER] Final metrics calculated:`, {
      phases: this.phasesExecuted.length,
      violations: this.violations.length,
      tokens: this.totalTokens,
      quality: scores.overallQualityScore,
      duration: `${(totalDurationMs / 1000).toFixed(1)}s`
    });

    return metrics;
  }

  /**
   * Get current metrics summary (for debugging/logging during job)
   */
  getSummary(): string {
    return `Phases: ${this.phasesExecuted.join('→')} | Violations: ${this.violations.length} | Tokens: ${this.totalTokens} | Iterations: ${this.iterationCount}`;
  }
}
