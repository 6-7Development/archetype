/**
 * ReflectionHeartbeat
 * 
 * Periodic system-side prompt injection that forces BeeHive to self-check workflow compliance.
 * Triggers every N tool calls to ensure agent stays on track.
 * 
 * Benefits:
 * - Catches drift before violations accumulate
 * - Forces agent to consciously verify phase compliance
 * - Creates natural checkpoints for quality control
 */

export interface ReflectionCheck {
  triggerCount: number;
  question: string;
  expectedResponse: string;
  timestamp: Date;
}

export class ReflectionHeartbeat {
  private toolCallCount: number = 0;
  private reflectionHistory: ReflectionCheck[] = [];
  private readonly REFLECTION_INTERVAL: number = 5; // Every 5 tool calls
  
  /**
   * Record a tool call and check if reflection is due
   */
  recordToolCall(): boolean {
    this.toolCallCount++;
    return this.shouldTriggerReflection();
  }
  
  /**
   * Check if reflection should be triggered
   */
  private shouldTriggerReflection(): boolean {
    return this.toolCallCount % this.REFLECTION_INTERVAL === 0;
  }
  
  /**
   * Generate reflection prompt to inject into conversation
   */
  generateReflectionPrompt(currentPhase: string): string {
    const prompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 WORKFLOW COMPLIANCE CHECK (Tool Call #${this.toolCallCount})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before proceeding, verify you are following the 7-phase workflow:

CURRENT PHASE: ${currentPhase}

MANDATORY SELF-CHECK:
1. Did I announce this phase with the correct emoji?
2. Am I using ≤5 words before tools in EXECUTE phase?
3. Did I create a task list in PLAN phase? (ALWAYS MANDATORY)
4. Will I run tests in TEST phase? (ALWAYS MANDATORY)
5. Am I avoiding rambling/explaining instead of executing?

ANSWER BRIEFLY (≤10 words):
- Phase: [Confirm current phase]
- Compliance: [Yes/No + any violations]
- Next Action: [Tool to call next]

Then IMMEDIATELY resume work.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    const check: ReflectionCheck = {
      triggerCount: this.toolCallCount,
      question: prompt,
      expectedResponse: 'Brief compliance confirmation',
      timestamp: new Date(),
    };
    
    this.reflectionHistory.push(check);
    
    return prompt;
  }
  
  /**
   * Validate reflection response (ensure it's brief and compliant)
   */
  validateReflectionResponse(response: string): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const wordCount = response.trim().split(/\s+/).length;
    
    // Check response length (should be ≤20 words for reflection)
    if (wordCount > 20) {
      issues.push(`Reflection response too long: ${wordCount} words (max 20)`);
    }
    
    // Check if agent answered the questions
    const hasPhaseConfirmation = /phase:/i.test(response);
    const hasComplianceCheck = /compliance:/i.test(response);
    const hasNextAction = /next action:/i.test(response);
    
    if (!hasPhaseConfirmation || !hasComplianceCheck || !hasNextAction) {
      issues.push('Incomplete reflection: Missing required confirmations');
    }
    
    // Check for rambling/explaining instead of quick answers
    const isRambling = /let me|i will|i'm going to|however|unfortunately/i.test(response);
    if (isRambling) {
      issues.push('Reflection contains rambling - should be brief answers only');
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
  
  /**
   * Get reflection statistics
   */
  getStats(): {
    totalReflections: number;
    toolCallCount: number;
    lastReflection: Date | null;
  } {
    return {
      totalReflections: this.reflectionHistory.length,
      toolCallCount: this.toolCallCount,
      lastReflection: this.reflectionHistory.length > 0
        ? this.reflectionHistory[this.reflectionHistory.length - 1].timestamp
        : null,
    };
  }
  
  /**
   * Reset counters (for new job/session)
   */
  reset(): void {
    this.toolCallCount = 0;
    this.reflectionHistory = [];
  }
}
