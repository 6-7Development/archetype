/**
 * ResponseQualityGuard
 * 
 * Detects "explaining vs executing" anti-pattern using NLP heuristics + regex.
 * Applies penalties and triggers retries when Gemini talks too much instead of acting.
 * 
 * Detection Patterns:
 * - Excessive prose before tools (>5 words in EXECUTE phase)
 * - Meta-commentary about what the AI "will" do instead of doing it
 * - Apologies, disclaimers, and unnecessary explanations
 * - Generic AI responses ("As an AI, I...")
 */

export interface QualityAnalysis {
  qualityScore: number; // 0-100
  isPoorQuality: boolean;
  issues: string[];
  antiPatterns: string[];
  actionToExplanationRatio: number; // Higher is better
  shouldRetry: boolean;
  shouldEscalate: boolean;
}

export class ResponseQualityGuard {
  
  /**
   * Analyze response quality to detect "explaining vs executing"
   */
  analyzeQuality(
    response: string,
    toolCalls: any[] = [],
    phase?: string
  ): QualityAnalysis {
    const issues: string[] = [];
    const antiPatterns: string[] = [];
    let qualityScore = 100;
    
    const lowerResponse = response.toLowerCase();
    
    // ANTI-PATTERN 1: Generic AI disclaimers (major red flag)
    const genericPatterns = [
      { pattern: /i don't (feel|have feelings|experience)/i, name: 'Generic AI disclaimer', penalty: 40 },
      { pattern: /as an ai,? i (don't|cannot|can't)/i, name: 'AI limitation statement', penalty: 35 },
      { pattern: /i'm (just|simply) an ai/i, name: 'Self-referential AI statement', penalty: 30 },
      { pattern: /i don't have the ability to/i, name: 'Ability disclaimer', penalty: 35 },
    ];
    
    for (const { pattern, name, penalty } of genericPatterns) {
      if (pattern.test(response)) {
        qualityScore -= penalty;
        antiPatterns.push(name);
        issues.push(`Generic response: ${name}`);
      }
    }
    
    // ANTI-PATTERN 2: Meta-commentary about actions instead of taking them
    const metaCommentaryPatterns = [
      { pattern: /i will (now |first |next )?/gi, name: 'Future tense action', penalty: 15 },
      { pattern: /let me (now |first |next )?/gi, name: 'Let me statement', penalty: 15 },
      { pattern: /i('m going to| am going to)/gi, name: 'Going to statement', penalty: 15 },
      { pattern: /i'll (now |first |next )?/gi, name: 'Future tense contraction', penalty: 15 },
    ];
    
    for (const { pattern, name, penalty } of metaCommentaryPatterns) {
      const matches = response.match(pattern);
      if (matches && matches.length > 2) {
        qualityScore -= penalty;
        antiPatterns.push(name);
        issues.push(`Too much meta-commentary: ${matches.length} instances of "${pattern.source}"`);
      }
    }
    
    // ANTI-PATTERN 3: Apologies and unnecessary explanations
    const apologeticPatterns = [
      { pattern: /i apologize/i, name: 'Apology', penalty: 10 },
      { pattern: /sorry (for|about)/i, name: 'Sorry statement', penalty: 10 },
      { pattern: /unfortunately,?/i, name: 'Unfortunately qualifier', penalty: 8 },
      { pattern: /however,? (it's important|you should note)/i, name: 'Cautionary statement', penalty: 8 },
    ];
    
    for (const { pattern, name, penalty } of apologeticPatterns) {
      if (pattern.test(response)) {
        qualityScore -= penalty;
        antiPatterns.push(name);
        issues.push(`Unnecessary: ${name}`);
      }
    }
    
    // ANTI-PATTERN 4: Excessive explanation before execution (phase-specific)
    if (phase === 'EXECUTE') {
      const textBeforeTools = this.getTextBeforeTools(response);
      const wordCount = textBeforeTools.trim().split(/\s+/).length;
      
      if (wordCount > 5) {
        qualityScore -= Math.min(30, (wordCount - 5) * 3);
        antiPatterns.push('Excessive pre-execution prose');
        issues.push(`EXECUTE phase has ${wordCount} words before tools (max 5 allowed)`);
      }
    }
    
    // ANTI-PATTERN 5: No tool calls when tools are expected
    if (toolCalls.length === 0 && phase && !['CONFIRM', 'COMMIT'].includes(phase)) {
      qualityScore -= 40;
      antiPatterns.push('No tools used');
      issues.push(`Phase ${phase} requires tool usage, but no tools were called`);
    }
    
    // CALCULATE ACTION-TO-EXPLANATION RATIO
    const textLength = response.length;
    const toolCallIndicators = (response.match(/<function_calls>/g) || []).length;
    const actionToExplanationRatio = toolCallIndicators > 0 
      ? (toolCallIndicators * 500) / textLength // Higher is better
      : 0;
    
    if (actionToExplanationRatio < 0.2 && toolCalls.length > 0) {
      qualityScore -= 15;
      issues.push('Low action-to-explanation ratio: Too much talking, not enough doing');
    }
    
    // ANTI-PATTERN 6: Filler words and hedging
    const fillerPatterns = [
      { pattern: /\b(basically|essentially|actually)\b/gi, name: 'Filler words' },
      { pattern: /\b(kind of|sort of)\b/gi, name: 'Hedging language' },
      { pattern: /\b(to be honest|honestly)\b/gi, name: 'Unnecessary qualifiers' },
    ];
    
    let fillerCount = 0;
    for (const { pattern, name } of fillerPatterns) {
      const matches = response.match(pattern);
      if (matches) {
        fillerCount += matches.length;
      }
    }
    
    if (fillerCount > 3) {
      qualityScore -= Math.min(10, fillerCount * 2);
      antiPatterns.push('Excessive filler words');
      issues.push(`${fillerCount} instances of filler words/hedging language`);
    }
    
    // DETERMINE QUALITY CLASSIFICATION
    const isPoorQuality = qualityScore < 60;
    const shouldRetry = qualityScore < 50; // Very poor quality
    const shouldEscalate = qualityScore < 40; // Critical quality issues
    
    return {
      qualityScore: Math.max(0, qualityScore),
      isPoorQuality,
      issues,
      antiPatterns,
      actionToExplanationRatio,
      shouldRetry,
      shouldEscalate,
    };
  }
  
  /**
   * Extract text before first tool call
   */
  private getTextBeforeTools(response: string): string {
    const toolMarker = '<function_calls>';
    const idx = response.indexOf(toolMarker);
    
    if (idx === -1) {
      return response;
    }
    
    return response.substring(0, idx);
  }
  
  /**
   * Generate corrective feedback for poor quality responses
   */
  generateCorrectiveFeedback(analysis: QualityAnalysis): string {
    if (!analysis.isPoorQuality) {
      return '';
    }
    
    let feedback = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    feedback += '⚠️  RESPONSE QUALITY ALERT\n';
    feedback += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    feedback += `Quality Score: ${analysis.qualityScore}/100 ${this.getQualityEmoji(analysis.qualityScore)}\n\n`;
    
    if (analysis.antiPatterns.length > 0) {
      feedback += `ANTI-PATTERNS DETECTED:\n`;
      analysis.antiPatterns.forEach(p => feedback += `  ❌ ${p}\n`);
      feedback += `\n`;
    }
    
    if (analysis.issues.length > 0) {
      feedback += `ISSUES:\n`;
      analysis.issues.forEach(i => feedback += `  • ${i}\n`);
      feedback += `\n`;
    }
    
    feedback += `CORRECTIVE ACTIONS REQUIRED:\n`;
    feedback += `  ✓ SHUT UP and USE TOOLS\n`;
    feedback += `  ✓ Max 5 words before tools in EXECUTE phase\n`;
    feedback += `  ✓ No meta-commentary - just do it\n`;
    feedback += `  ✓ No apologies or disclaimers\n`;
    feedback += `  ✓ Actions > Explanations\n`;
    
    feedback += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    if (analysis.shouldEscalate) {
      feedback += '🚨 ESCALATING TO I AM ARCHITECT FOR GUIDANCE\n';
      feedback += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    }
    
    return feedback;
  }
  
  /**
   * Get emoji based on quality score
   */
  private getQualityEmoji(score: number): string {
    if (score >= 90) return '🌟';
    if (score >= 75) return '✅';
    if (score >= 60) return '⚠️';
    if (score >= 40) return '🔴';
    return '💀';
  }
  
  /**
   * Calculate penalty for retry
   */
  calculatePenalty(attempt: number): number {
    // Exponential backoff on quality threshold
    return Math.min(10, attempt * 2);
  }
}
