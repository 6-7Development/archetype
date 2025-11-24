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
  evidenceUsed?: string[];
  filesInspected?: string[];
  inputTokens?: number;
  outputTokens?: number;
  confidence?: number; // 0-100 confidence score
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
    const evidenceQuality = (result.evidenceUsed?.length || 0) * 15; // 15% per piece of evidence
    const filesAnalyzed = (result.filesInspected?.length || 0) * 10; // 10% per file
    const confidence = Math.min(100, 50 + evidenceQuality + filesAnalyzed); // Base 50% + bonuses
    
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
      evidenceUsed: result.evidenceUsed,
      filesInspected: result.filesInspected,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      confidence,
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
