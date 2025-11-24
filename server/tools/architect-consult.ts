import { runArchitectAgent } from '../routes/architectAgent';

export interface ArchitectConsultParams {
  problem: string;
  context: string;
  previousAttempts: string[];
  codeSnapshot?: string;
}

export interface ArchitectConsultResult {
  success: boolean;
  guidance: string;
  recommendations: string[];
  alternativeApproach?: string;
  alternativeApproaches?: string[]; // Gap #3: Multiple alternatives if confidence < 70%
  evidenceUsed?: string[];
  filesInspected?: string[];
  inputTokens?: number;
  outputTokens?: number;
  confidence?: number; // 0-100 confidence score
  confidenceReasoning?: string; // Gap #3: WHY confident/not confident
  risk?: 'low' | 'medium' | 'high'; // Risk assessment
  reasoning?: string; // I AM's thinking process
  error?: string;
}

/**
 * Consult The Architect - Now powered by autonomous agent with code analysis tools
 * 
 * UPGRADE: I AM (The Architect) is now a lightweight agent that can:
 * - Inspect platform code independently (readPlatformFile)
 * - Search code patterns and solutions (code_search)
 * - Query historical knowledge (knowledge_query)
 * - Provide evidence-based guidance with actual code references
 * 
 * When SySop is stuck in a bug loop (3+ failed fix attempts), invoke this tool
 */
export async function consultArchitect(params: ArchitectConsultParams): Promise<ArchitectConsultResult> {
  console.log('[ARCHITECT-CONSULT] Invoking I AM (Architect Agent) with autonomous analysis...');
  
  try {
    // Run the new architect agent with read-only tools
    const result = await runArchitectAgent({
      problem: params.problem,
      context: params.context,
      previousAttempts: params.previousAttempts,
      codeSnapshot: params.codeSnapshot,
    });

    // Log evidence-based analysis
    if (result.filesInspected.length > 0) {
      console.log(`[ARCHITECT] 📁 Files inspected: ${result.filesInspected.join(', ')}`);
    }
    if (result.evidenceUsed.length > 0) {
      console.log(`[ARCHITECT] 🔍 Evidence gathered: ${result.evidenceUsed.join(', ')}`);
    }

    // Calculate confidence based on evidence quality
    const evidenceQuality = (result.evidenceUsed?.length || 0) * 15;
    const filesAnalyzed = (result.filesInspected?.length || 0) * 10;
    const confidence = Math.min(100, 50 + evidenceQuality + filesAnalyzed);
    
    // Gap #3: Generate confidence reasoning (WHY confident/not confident)
    let confidenceReasoning = '';
    if (confidence >= 80) {
      confidenceReasoning = `High confidence: Found ${result.evidenceUsed?.length || 0} supporting evidence across ${result.filesInspected?.length || 0} files. Recommendation is well-grounded in analysis.`;
    } else if (confidence >= 60) {
      confidenceReasoning = `Moderate confidence: Found ${result.evidenceUsed?.length || 0} evidence sources. Recommendation is reasonable but consider implications.`;
    } else {
      confidenceReasoning = `Lower confidence: Limited evidence (${result.evidenceUsed?.length || 0} sources). Recommend testing this approach carefully or exploring alternatives.`;
    }

    // Generate alternatives if confidence < 70% (Gap #3)
    const alternatives = confidence < 70 ? [
      'Test the main recommendation in isolation before applying broadly',
      'Consider a phased rollout instead of all-at-once implementation',
      'Gather more test data before committing to this approach',
    ] : [];
    
    // Assess risk based on scope of changes
    const recommendationComplexity = (result.recommendations?.length || 0);
    let risk: 'low' | 'medium' | 'high' = 'low';
    if (recommendationComplexity > 5) risk = 'high';
    else if (recommendationComplexity > 3) risk = 'medium';

    return {
      success: result.success,
      guidance: result.guidance,
      recommendations: result.recommendations,
      alternativeApproach: result.alternativeApproach,
      alternativeApproaches: alternatives, // Gap #3
      evidenceUsed: result.evidenceUsed,
      filesInspected: result.filesInspected,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      confidence,
      confidenceReasoning, // Gap #3
      risk,
      reasoning: `I AM Architect analyzed ${result.filesInspected?.length || 0} files and found ${result.evidenceUsed?.length || 0} pieces of evidence to support these recommendations. Risk assessment: ${risk}.`,
      error: result.error,
    };

  } catch (error: any) {
    console.error('❌ Architect consultation failed:', error);
    return {
      success: false,
      guidance: '',
      recommendations: [],
      error: error.message || 'Failed to consult architect',
    };
  }
}
