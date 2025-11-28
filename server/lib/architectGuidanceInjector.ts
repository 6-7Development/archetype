/**
 * Architect Guidance Injector
 * 
 * Real-time feedback loop between Hexad (Gemini Flash) and I AM Architect (Claude Sonnet 4).
 * When Hexad makes mistakes, I AM provides corrective guidance DURING THE ACTIVE SESSION.
 * 
 * CRITICAL FEATURES:
 * - Detects violations in real-time (not post-job)
 * - Calls I AM Architect for expert guidance
 * - Injects guidance back into Hexad conversation as system message
 * - Hexad reads correction and fixes behavior immediately
 * - TRUE TEAMWORK: Lomu + I AM work together ❤️
 */

import Anthropic from '@anthropic-ai/sdk';
import type { PhaseValidationResult } from './phaseGatekeeper';
import type { QualityAnalysis } from './responseQualityGuard';

export interface GuidanceRequest {
  violation: string;
  context: {
    phase: string;
    userMessage: string;
    lomuResponse: string;
    toolCalls: any[];
  };
  qualityScore: number;
}

export interface GuidanceResponse {
  guidance: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  shouldRetry: boolean;
  suggestedActions: string[];
}

export class ArchitectGuidanceInjector {
  private anthropic: Anthropic | null;
  private guidanceHistory: Map<string, GuidanceResponse[]> = new Map();
  
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[ARCHITECT-GUIDANCE] ANTHROPIC_API_KEY missing - guidance injection will be disabled');
      this.anthropic = null;
      return;
    }
    this.anthropic = new Anthropic({ apiKey });
    console.log('[ARCHITECT-GUIDANCE] I AM Architect initialized for real-time guidance');
  }
  
  /**
   * Request guidance from I AM Architect when Hexad violates workflow
   */
  async requestGuidance(request: GuidanceRequest): Promise<GuidanceResponse> {
    // Graceful degradation - if no API key configured, return empty guidance
    if (!this.anthropic) {
      console.warn('[ARCHITECT-GUIDANCE] I AM Architect unavailable (no API key) - skipping guidance');
      return {
        guidance: '', // Empty guidance
        severity: 'low',
        shouldRetry: false,
        suggestedActions: [],
      };
    }
    
    console.log('[ARCHITECT-GUIDANCE] 🧑‍💼 Calling I AM Architect for guidance...');
    console.log('[ARCHITECT-GUIDANCE] Violation:', request.violation);
    console.log('[ARCHITECT-GUIDANCE] Phase:', request.context.phase);
    console.log('[ARCHITECT-GUIDANCE] Quality Score:', request.qualityScore);
    
    const systemPrompt = `You are I AM ARCHITECT, an expert supervisor guiding Hexad (Gemini Flash) to follow strict workflow rules.

Hexad just violated a workflow rule. Your job is to provide BRIEF, DIRECT corrective guidance that will be injected into Hexad's conversation as a system message.

GUIDANCE RULES:
1. Be CONCISE (max 100 words)
2. Be DIRECT and authoritative
3. Focus on WHAT to do, not why
4. Use simple, actionable commands
5. Reference the specific violation
6. Provide 2-3 concrete corrective actions

EXAMPLE GOOD GUIDANCE:
"⚠️ WORKFLOW VIOLATION DETECTED
You skipped creating a task list in PLAN phase.
CORRECTIVE ACTIONS:
1. Call write_task_list() with 3-5 specific tasks
2. Each task must be actionable and testable
3. Proceed to EXECUTE only after task list is created
Resume work NOW."

EXAMPLE BAD GUIDANCE:
"It appears you may have forgotten to create a task list. Task lists are important because they help structure work. I recommend considering creating one if appropriate. Perhaps you could think about the steps needed..."`;
    
    const userPrompt = `VIOLATION: ${request.violation}

CONTEXT:
- Phase: ${request.context.phase}
- User Request: "${request.context.userMessage.slice(0, 200)}..."
- Hexad Response: "${request.context.lomuResponse.slice(0, 300)}..."
- Tool Calls Made: ${request.context.toolCalls.length}
- Quality Score: ${request.qualityScore}/100

Provide brief, direct corrective guidance (max 100 words):`;
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300, // Keep guidance brief
        temperature: 0.3, // More deterministic
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt,
        }],
      });
      
      const guidanceText = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('\n');
      
      // Determine severity based on quality score
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (request.qualityScore < 30) severity = 'critical';
      else if (request.qualityScore < 50) severity = 'high';
      else if (request.qualityScore < 70) severity = 'medium';
      else severity = 'low';
      
      // Determine if Hexad should retry (for critical violations)
      const shouldRetry = severity === 'critical' || request.violation.includes('Missing create_task_list');
      
      // Extract suggested actions from guidance
      const suggestedActions = this.extractActions(guidanceText);
      
      const guidance: GuidanceResponse = {
        guidance: guidanceText,
        severity,
        shouldRetry,
        suggestedActions,
      };
      
      console.log('[ARCHITECT-GUIDANCE] ✅ Guidance received from I AM Architect');
      console.log('[ARCHITECT-GUIDANCE] Severity:', severity);
      console.log('[ARCHITECT-GUIDANCE] Should Retry:', shouldRetry);
      console.log('[ARCHITECT-GUIDANCE] Guidance:', guidanceText);
      
      return guidance;
      
    } catch (error: any) {
      console.error('[ARCHITECT-GUIDANCE] ❌ Failed to get guidance from I AM:', error.message);
      
      // Fallback guidance if I AM Architect fails
      return {
        guidance: `⚠️ WORKFLOW VIOLATION: ${request.violation}\n\nCORRECTIVE ACTION REQUIRED:\nReview the 7-phase workflow rules and re-execute this phase correctly.`,
        severity: 'medium',
        shouldRetry: false,
        suggestedActions: ['Review workflow rules', 'Re-execute phase correctly'],
      };
    }
  }
  
  /**
   * Extract actionable steps from guidance text
   */
  private extractActions(guidance: string): string[] {
    const actions: string[] = [];
    
    // Look for numbered lists (1. 2. 3.)
    const numberedMatches = guidance.match(/\d+\.\s+([^\n]+)/g);
    if (numberedMatches) {
      actions.push(...numberedMatches.map(m => m.replace(/^\d+\.\s+/, '')));
    }
    
    // Look for bullet points
    const bulletMatches = guidance.match(/[-•]\s+([^\n]+)/g);
    if (bulletMatches) {
      actions.push(...bulletMatches.map(m => m.replace(/^[-•]\s+/, '')));
    }
    
    return actions.slice(0, 3); // Max 3 actions
  }
  
  /**
   * Format guidance for injection into Hexad conversation
   */
  formatGuidanceForInjection(guidance: GuidanceResponse, jobId: string): string {
    // Store in history
    if (!this.guidanceHistory.has(jobId)) {
      this.guidanceHistory.set(jobId, []);
    }
    this.guidanceHistory.get(jobId)!.push(guidance);
    
    const severityEmoji = {
      low: '⚠️',
      medium: '🔴',
      high: '🚨',
      critical: '💀',
    }[guidance.severity];
    
    let formatted = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    formatted += `${severityEmoji} I AM ARCHITECT - CORRECTIVE GUIDANCE\n`;
    formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    formatted += guidance.guidance;
    formatted += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    if (guidance.shouldRetry) {
      formatted += '⚠️ RETRY REQUIRED - Re-execute this phase\n';
      formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    }
    
    return formatted;
  }
  
  /**
   * Get guidance history for a job
   */
  getGuidanceHistory(jobId: string): GuidanceResponse[] {
    return this.guidanceHistory.get(jobId) || [];
  }
  
  /**
   * Check if job has received multiple guidances (escalation indicator)
   */
  shouldEscalateJob(jobId: string): boolean {
    const history = this.getGuidanceHistory(jobId);
    return history.length >= 3; // 3 strikes and you're out
  }
  
  /**
   * Clear guidance history for a job
   */
  clearHistory(jobId: string): void {
    this.guidanceHistory.delete(jobId);
  }
}

// Global singleton instance (with graceful fallback if API key missing)
let architectGuidanceInjectorInstance: ArchitectGuidanceInjector | null = null;

try {
  architectGuidanceInjectorInstance = new ArchitectGuidanceInjector();
} catch (error: any) {
  console.warn('[ARCHITECT-GUIDANCE] Failed to initialize I AM Architect:', error.message);
  console.warn('[ARCHITECT-GUIDANCE] Real-time guidance injection will be disabled');
}

export const architectGuidanceInjector = architectGuidanceInjectorInstance;
