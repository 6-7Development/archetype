/**
 * Enforcement Orchestrator
 * 
 * Coordinates all 5 enforcement layers + I AM Architect guidance injection
 * for real-time LomuAI workflow compliance.
 * 
 * ENFORCEMENT LAYERS:
 * 1. PhaseGatekeeper - validates responses before phase transitions
 * 2. WorkflowValidator - authoritative state machine
 * 3. ResponseQualityGuard - detects explaining vs executing
 * 4. ReflectionHeartbeat - periodic self-checks
 * 5. ParityKPIs - tracks compliance metrics
 * + ArchitectGuidanceInjector - real-time I AM Architect teamwork
 */

import { PhaseGatekeeper } from './phaseGatekeeper';
import { WorkflowValidator } from './workflowValidator';
import { ResponseQualityGuard } from './responseQualityGuard';
import { ReflectionHeartbeat } from './reflectionHeartbeat';
import { parityKPIs } from './parityKPIs';
import { architectGuidanceInjector } from './architectGuidanceInjector';

export interface EnforcementContext {
  jobId: string;
  userId: string;
  userMessage: string;
  currentPhase: string;
  autoCommit: boolean;
}

export interface EnforcementResult {
  passed: boolean;
  violations: string[];
  guidanceInjected: string | null;
  shouldRetry: boolean;
  shouldEscalate: boolean;
  qualityScore: number;
  reflectionPrompt: string | null;
  phaseTransitionBlocked?: boolean;
  tokenCeilingExceeded?: boolean;
}

export class EnforcementOrchestrator {
  private phaseGatekeeper: PhaseGatekeeper;
  private workflowValidator: WorkflowValidator;
  private qualityGuard: ResponseQualityGuard;
  private reflectionHeartbeat: ReflectionHeartbeat;
  
  constructor() {
    this.phaseGatekeeper = new PhaseGatekeeper();
    this.workflowValidator = new WorkflowValidator();
    this.qualityGuard = new ResponseQualityGuard();
    this.reflectionHeartbeat = new ReflectionHeartbeat();
  }
  
  /**
   * Initialize enforcement for a new job
   */
  initializeJob(jobId: string): void {
    parityKPIs.startJob(jobId);
    this.reflectionHeartbeat.reset();
    console.log('[ENFORCEMENT-ORCHESTRATOR] Initialized for job:', jobId);
  }
  
  /**
   * Record token usage and check ceilings
   */
  recordTokenUsage(inputTokens: number, outputTokens: number): void {
    this.workflowValidator.recordTokenUsage(inputTokens, outputTokens);
  }
  
  /**
   * Record tool call and validate
   */
  recordToolCall(toolName: string): void {
    this.workflowValidator.recordToolCall(toolName);
    this.reflectionHeartbeat.recordToolCall(); // CRITICAL: Enable layer 4
  }
  
  /**
   * Attempt phase transition (returns success/failure with reason)
   */
  transitionToPhase(targetPhase: any): { allowed: boolean; reason?: string } {
    const validation = this.workflowValidator.canTransitionTo(targetPhase);
    
    if (validation.allowed) {
      this.workflowValidator.transitionTo(targetPhase);
    }
    
    return validation;
  }
  
  /**
   * Get current phase from workflow validator
   */
  getCurrentPhase(): string {
    return this.workflowValidator.getState().currentPhase;
  }
  
  /**
   * Validate a response in real-time (called after each Gemini response)
   */
  async validateResponse(
    context: EnforcementContext,
    response: string,
    toolCalls: any[],
    inputTokens: number = 0,
    outputTokens: number = 0
  ): Promise<EnforcementResult> {
    console.log('[ENFORCEMENT-ORCHESTRATOR] Validating response...');
    
    const violations: string[] = [];
    let guidanceInjected: string | null = null;
    let shouldRetry = false;
    let shouldEscalate = false;
    let reflectionPrompt: string | null = null;
    let phaseTransitionBlocked = false;
    let tokenCeilingExceeded = false;
    
    // LAYER 2: WorkflowValidator - record token usage and check ceilings
    this.workflowValidator.recordTokenUsage(inputTokens, outputTokens);
    const state = this.workflowValidator.getState();
    
    if (this.workflowValidator.hasCriticalViolations()) {
      violations.push(...this.workflowValidator.getViolations());
      tokenCeilingExceeded = true;
      console.warn('[ENFORCEMENT-ORCHESTRATOR] Workflow validator violations:', this.workflowValidator.getViolations());
    }
    
    // LAYER 1: PhaseGatekeeper - validate response against current phase rules
    const phaseValidation = this.phaseGatekeeper.validateResponse(
      response,
      context.currentPhase,
      toolCalls
    );
    
    if (!phaseValidation.passed) {
      violations.push(...phaseValidation.violations);
      console.warn('[ENFORCEMENT-ORCHESTRATOR] Phase validation failed:', phaseValidation.violations);
      
      // Track violations in KPIs
      phaseValidation.violations.forEach(() => {
        parityKPIs.recordViolation(context.jobId, 10);
      });
    }
    
    // LAYER 3: ResponseQualityGuard - detect explaining vs executing
    const qualityAnalysis = this.qualityGuard.analyzeQuality(
      response,
      toolCalls,
      context.currentPhase
    );
    
    if (qualityAnalysis.isPoorQuality) {
      violations.push(...qualityAnalysis.issues);
      shouldRetry = qualityAnalysis.shouldRetry;
      shouldEscalate = qualityAnalysis.shouldEscalate;
      
      console.warn('[ENFORCEMENT-ORCHESTRATOR] Quality issues detected:', qualityAnalysis.issues);
      
      // Track in KPIs
      parityKPIs.recordViolation(context.jobId, 100 - qualityAnalysis.qualityScore);
    }
    
    // LAYER 4: ReflectionHeartbeat - check if self-reflection is due
    if (toolCalls.length > 0) {
      const shouldReflect = this.reflectionHeartbeat.recordToolCall();
      if (shouldReflect) {
        reflectionPrompt = this.reflectionHeartbeat.generateReflectionPrompt(context.currentPhase);
        console.log('[ENFORCEMENT-ORCHESTRATOR] Reflection triggered after tool calls');
      }
    }
    
    // CRITICAL: If violations detected, call I AM Architect for guidance
    if (violations.length > 0 && (shouldEscalate || phaseValidation.qualityScore < 50) && architectGuidanceInjector) {
      console.log('[ENFORCEMENT-ORCHESTRATOR] 🚨 Violations detected - calling I AM Architect...');
      
      try {
        const guidance = await architectGuidanceInjector.requestGuidance({
          violation: violations.join('; '),
          context: {
            phase: context.currentPhase,
            userMessage: context.userMessage,
            lomuResponse: response,
            toolCalls,
          },
          qualityScore: qualityAnalysis.qualityScore,
        });
        
        // Only inject if guidance is not empty
        if (guidance.guidance && guidance.guidance.length > 0) {
          guidanceInjected = architectGuidanceInjector.formatGuidanceForInjection(
            guidance,
            context.jobId
          );
          
          shouldRetry = shouldRetry || guidance.shouldRetry;
          shouldEscalate = shouldEscalate || guidance.severity === 'critical';
          
          console.log('[ENFORCEMENT-ORCHESTRATOR] ✅ I AM Architect guidance injected');
          
          // CRITICAL: Check for 3-strikes escalation after guidance injection
          if (architectGuidanceInjector.shouldEscalateJob(context.jobId)) {
            shouldEscalate = true;
            console.log('[ENFORCEMENT-ORCHESTRATOR] 🚨 3 STRIKES REACHED - Job escalation recommended');
            violations.push('CRITICAL: 3 guidance attempts failed - job requires I AM Architect takeover');
          }
        } else {
          console.log('[ENFORCEMENT-ORCHESTRATOR] ℹ️ No guidance provided (API key missing or degraded mode)');
        }
      } catch (error: any) {
        console.error('[ENFORCEMENT-ORCHESTRATOR] Failed to get I AM Architect guidance:', error.message);
        // Continue without guidance injection
      }
    } else if (violations.length > 0 && !architectGuidanceInjector) {
      console.warn('[ENFORCEMENT-ORCHESTRATOR] Violations detected but I AM Architect unavailable');
    }
    
    const passed = violations.length === 0;
    
    return {
      passed,
      violations,
      guidanceInjected,
      shouldRetry,
      shouldEscalate,
      qualityScore: qualityAnalysis.qualityScore,
      reflectionPrompt,
      phaseTransitionBlocked,
      tokenCeilingExceeded,
    };
  }
  
  /**
   * Record successful task list creation
   */
  recordTaskListCreation(jobId: string): void {
    parityKPIs.recordTaskListCreation(jobId);
    console.log('[ENFORCEMENT-ORCHESTRATOR] Task list created ✅');
  }
  
  /**
   * Record successful test execution
   */
  recordTestExecution(jobId: string): void {
    parityKPIs.recordTestExecution(jobId);
    console.log('[ENFORCEMENT-ORCHESTRATOR] Tests executed ✅');
  }
  
  /**
   * Record premature completion attempt
   */
  recordPrematureCompletion(jobId: string): void {
    parityKPIs.recordPrematureCompletion(jobId);
    console.warn('[ENFORCEMENT-ORCHESTRATOR] Premature completion attempt ❌');
  }
  
  /**
   * Record phase completion
   */
  recordPhaseCompletion(jobId: string, phase: string): void {
    parityKPIs.recordPhaseCompletion(jobId, phase);
  }
  
  /**
   * Generate final compliance report for job
   */
  generateComplianceReport(jobId: string): string {
    return parityKPIs.generateReport(jobId);
  }
  
  /**
   * Check if job meets all parity targets
   */
  meetsParityTargets(jobId: string): {
    passed: boolean;
    failures: string[];
  } {
    return parityKPIs.meetsParityTargets(jobId);
  }
  
  /**
   * Get reflection statistics
   */
  getReflectionStats(): {
    totalReflections: number;
    toolCallCount: number;
    lastReflection: Date | null;
  } {
    return this.reflectionHeartbeat.getStats();
  }
}

// Global singleton instance
export const enforcementOrchestrator = new EnforcementOrchestrator();
