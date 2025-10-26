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

    return {
      success: result.success,
      guidance: result.guidance,
      recommendations: result.recommendations,
      alternativeApproach: result.alternativeApproach,
      evidenceUsed: result.evidenceUsed,
      filesInspected: result.filesInspected,
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
