import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy-key-for-development",
});

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
  error?: string;
}

/**
 * Consult The Architect - An expert architectural consultation system for deadlocks
 * When SySop is stuck in a bug loop (3+ failed fix attempts), invoke this tool
 */
export async function consultArchitect(params: ArchitectConsultParams): Promise<ArchitectConsultResult> {
  const { problem, context, previousAttempts, codeSnapshot } = params;

  try {
    const architectPrompt = `You are The Architect, an elite architectural consultant for SySop. Your job is to analyze complex technical problems and provide clear, actionable guidance.

SITUATION:
SySop is stuck in an architectural deadlock after multiple failed fix attempts.

PROBLEM:
${problem}

CONTEXT:
${context}

PREVIOUS ATTEMPTS (that failed):
${previousAttempts.map((attempt, i) => `${i + 1}. ${attempt}`).join('\n')}

${codeSnapshot ? `CODE SNAPSHOT:\n${codeSnapshot}\n` : ''}

YOUR TASK:
1. Identify the ROOT CAUSE (not surface symptoms)
2. Explain WHY previous attempts failed
3. Provide a DIFFERENT APPROACH that avoids the deadlock
4. Give SPECIFIC, ACTIONABLE recommendations

FORMAT YOUR RESPONSE:
{
  "rootCause": "Clear explanation of the fundamental issue",
  "whyAttemptsFailed": "Why the previous approaches didn't work",
  "alternativeApproach": "A completely different strategy to try",
  "recommendations": [
    "Specific actionable step 1",
    "Specific actionable step 2",
    "Specific actionable step 3"
  ],
  "thingsToAvoid": ["Anti-pattern 1", "Anti-pattern 2"]
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: "You are an expert software architect specializing in breaking deadlocks and providing alternative solutions.",
      messages: [
        {
          role: "user",
          content: architectPrompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Architect');
    }

    // Parse the architect's response
    const guidanceText = content.text;
    
    // Try to extract JSON if present
    let parsedGuidance: any;
    try {
      const jsonMatch = guidanceText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedGuidance = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // If JSON parsing fails, use raw text
      parsedGuidance = { guidance: guidanceText };
    }

    return {
      success: true,
      guidance: parsedGuidance.rootCause || guidanceText,
      recommendations: parsedGuidance.recommendations || [],
      alternativeApproach: parsedGuidance.alternativeApproach,
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
