/**
 * AI Response Optimizer - Smart token usage based on request complexity
 */

export interface RequestAnalysis {
  isSimple: boolean;
  requestType: 'status' | 'question' | 'fix' | 'complex';
  suggestedLength: 'short' | 'medium' | 'detailed';
  confidence: number;
}

// Simple request patterns that should get short responses
const SIMPLE_PATTERNS = [
  /^(how|what|is|are|can|do|does|did|will|would|should)\s/i,
  /status|working|fixed|done|ready|available/i,
  /token usage|performance|speed|fast/i,
  /test|testing|check|verify/i,
  /good|bad|working|broken/i,
];

// Complex request patterns that need detailed responses
const COMPLEX_PATTERNS = [
  /fix|debug|error|problem|issue|broken/i,
  /implement|create|add|build|develop/i,
  /optimize|improve|enhance|upgrade/i,
  /explain|show me|walk through|tutorial/i,
];

export function analyzeRequest(message: string): RequestAnalysis {
  const words = message.trim().split(/\s+/).length;
  const isQuestion = message.includes('?');
  
  // Very short questions are usually simple
  if (words <= 6 && isQuestion) {
    return {
      isSimple: true,
      requestType: 'question',
      suggestedLength: 'short',
      confidence: 0.9
    };
  }

  // Check for simple patterns
  const hasSimplePattern = SIMPLE_PATTERNS.some(pattern => pattern.test(message));
  if (hasSimplePattern && words <= 10) {
    return {
      isSimple: true,
      requestType: 'status',
      suggestedLength: 'short',
      confidence: 0.8
    };
  }

  // Check for complex patterns
  const hasComplexPattern = COMPLEX_PATTERNS.some(pattern => pattern.test(message));
  if (hasComplexPattern || words > 20) {
    return {
      isSimple: false,
      requestType: 'complex',
      suggestedLength: 'detailed',
      confidence: 0.7
    };
  }

  // Default to medium length for unclear cases
  return {
    isSimple: false,
    requestType: 'fix',
    suggestedLength: 'medium',
    confidence: 0.6
  };
}

export function getOptimizedSystemPrompt(analysis: RequestAnalysis): string {
  const basePrompt = `You're Meta-SySop. Answer in 1-3 sentences max. NO emojis, NO bullet points, NO sections, NO formatting.

GOOD: "Yes, upload via GitHub import. I'll maintain the code and auto-save to GitHub."
BAD: "✅ What I Can Do: 1. Import code 2. Maintain..." (too long, emojis, formatting)`;

  switch (analysis.suggestedLength) {
    case 'short':
      return basePrompt + `\n\nThis is a simple ${analysis.requestType}. Give a brief, direct answer in 1 sentence.`;
    
    case 'medium':
      return basePrompt + `\n\nThis is a ${analysis.requestType} request. Explain briefly what you'll do, then do it.`;
    
    case 'detailed':
      return basePrompt + `\n\nThis is a complex ${analysis.requestType}. You may need multiple steps, but keep explanations concise.`;
    
    default:
      return basePrompt;
  }
}

// Token usage tracking
let tokenUsageStats = {
  totalRequests: 0,
  totalTokens: 0,
  averageTokens: 0,
  shortResponses: 0,
  mediumResponses: 0,
  longResponses: 0
};

export function trackTokenUsage(tokens: number, responseType: string) {
  tokenUsageStats.totalRequests++;
  tokenUsageStats.totalTokens += tokens;
  tokenUsageStats.averageTokens = Math.round(tokenUsageStats.totalTokens / tokenUsageStats.totalRequests);
  
  switch (responseType) {
    case 'short':
      tokenUsageStats.shortResponses++;
      break;
    case 'medium':
      tokenUsageStats.mediumResponses++;
      break;
    case 'detailed':
      tokenUsageStats.longResponses++;
      break;
  }
}

export function getTokenStats() {
  return { ...tokenUsageStats };
}