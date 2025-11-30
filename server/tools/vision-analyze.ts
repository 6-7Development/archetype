import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');

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
 * Analyze images using Gemini Vision API
 * Allows Hexad to understand screenshots, UI mockups, and visual designs
 */
export async function executeVisionAnalysis(params: VisionAnalyzeParams): Promise<VisionAnalyzeResult> {
  try {
    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: params.imageMediaType,
              data: params.imageBase64,
            },
          },
          {
            text: params.prompt,
          },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 2048,
      }
    });
    
    const analysis = result.response.text() || '';
    
    const suggestions: string[] = [];
    const issues: string[] = [];
    
    const suggestionMatches = analysis.match(/(?:Suggestion|Recommendation|Improvement):\s*(.+)/gi);
    if (suggestionMatches) {
      suggestions.push(...suggestionMatches.map(m => m.replace(/^(?:Suggestion|Recommendation|Improvement):\s*/i, '')));
    }
    
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
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png'
): Promise<VisionAnalyzeResult> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            text: 'Compare these two images - the first is the design mockup, the second is the implementation:'
          },
          {
            inlineData: {
              mimeType: mediaType,
              data: mockupBase64,
            },
          },
          {
            inlineData: {
              mimeType: mediaType,
              data: implementationBase64,
            },
          },
          {
            text: `Please analyze:
1. Visual fidelity - How closely does the implementation match the design?
2. Missing elements - What design elements are missing in the implementation?
3. Spacing/alignment differences
4. Color accuracy
5. Typography differences

Format your response with:
- Overall match score (percentage)
- List of discrepancies with suggestions to fix each`
          },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 2048,
      }
    });
    
    const analysis = result.response.text() || '';
    
    const suggestions: string[] = [];
    const issues: string[] = [];
    
    const suggestionMatches = analysis.match(/(?:Suggestion|Fix|Recommendation):\s*(.+)/gi);
    if (suggestionMatches) {
      suggestions.push(...suggestionMatches.map(m => m.replace(/^(?:Suggestion|Fix|Recommendation):\s*/i, '')));
    }
    
    const issueMatches = analysis.match(/(?:Discrepancy|Issue|Missing|Difference):\s*(.+)/gi);
    if (issueMatches) {
      issues.push(...issueMatches.map(m => m.replace(/^(?:Discrepancy|Issue|Missing|Difference):\s*/i, '')));
    }
    
    return {
      analysis,
      suggestions,
      issues,
    };
  } catch (error) {
    console.error('Design comparison error:', error);
    throw new Error(`Design comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
