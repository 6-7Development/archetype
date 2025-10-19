import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key',
});

interface VisionAnalyzeParams {
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  prompt: string;
}

interface VisionAnalyzeResult {
  analysis: string;
  suggestions: string[];
  issues: string[];
}

/**
 * Analyze images using Claude Vision API
 * Allows SySop to understand screenshots, UI mockups, and visual designs
 */
export async function executeVisionAnalysis(params: VisionAnalyzeParams): Promise<VisionAnalyzeResult> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: params.imageMediaType,
                data: params.imageBase64,
              },
            },
            {
              type: 'text',
              text: params.prompt,
            },
          ],
        },
      ],
    });
    
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude Vision');
    }
    
    const analysis = content.text;
    
    // Parse structured response
    const suggestions: string[] = [];
    const issues: string[] = [];
    
    // Extract suggestions (lines starting with "Suggestion:" or similar)
    const suggestionMatches = analysis.match(/(?:Suggestion|Recommendation|Improvement):\s*(.+)/gi);
    if (suggestionMatches) {
      suggestions.push(...suggestionMatches.map(m => m.replace(/^(?:Suggestion|Recommendation|Improvement):\s*/i, '')));
    }
    
    // Extract issues (lines starting with "Issue:" or "Problem:")
    const issueMatches = analysis.match(/(?:Issue|Problem|Error|Bug):\s*(.+)/gi);
    if (issueMatches) {
      issues.push(...issueMatches.map(m => m.replace(/^(?:Issue|Problem|Error|Bug):\s*/i, '')));
    }
    
    return {
      analysis,
      suggestions,
      issues,
    };
  } catch (error) {
    console.error('Vision analysis error:', error);
    throw new Error(`Vision analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze UI screenshot for accessibility and design issues
 */
export async function analyzeUIScreenshot(imageBase64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'): Promise<VisionAnalyzeResult> {
  return executeVisionAnalysis({
    imageBase64,
    imageMediaType: mediaType,
    prompt: `Analyze this UI screenshot for:
1. Accessibility issues (contrast, text size, WCAG compliance)
2. Design consistency and visual hierarchy
3. Responsive layout concerns
4. User experience improvements

Provide specific, actionable feedback.`,
  });
}

/**
 * Compare design mockup with implementation
 */
export async function compareDesignToImplementation(
  mockupBase64: string,
  implementationBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Design Mockup:',
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: mockupBase64,
            },
          },
          {
            type: 'text',
            text: 'Current Implementation:',
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: implementationBase64,
            },
          },
          {
            type: 'text',
            text: 'Compare these two images and list:\n1. What matches the design\n2. What differs from the design\n3. Specific changes needed to match the mockup',
          },
        ],
      },
    ],
  });
  
  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude Vision');
  }
  
  return content.text;
}
