/**
 * Project Complexity Detection System
 * Analyzes user prompts to determine project complexity and estimate token usage
 */

export type ComplexityLevel = 'simple' | 'medium' | 'complex' | 'enterprise';

export interface ComplexityResult {
  level: ComplexityLevel;
  estimatedTokens: number;
  estimatedCost: number;
  confidence: number; // 0-1
  reasons: string[];
}

// Keywords and patterns for complexity detection
const COMPLEXITY_INDICATORS = {
  simple: {
    keywords: [
      'landing page', 'portfolio', 'single page', 'static site', 'basic form',
      'contact page', 'about page', 'simple blog', 'resume', 'personal site'
    ],
    patterns: /\b(simple|basic|minimal|static|landing)\b/i,
    tokenRange: [5000, 10000],
    avgTokens: 7500,
  },
  medium: {
    keywords: [
      'dashboard', 'crud app', 'blog', 'e-commerce', 'admin panel', 'multi-page',
      'interactive', 'api integration', 'form validation', 'authentication'
    ],
    patterns: /\b(dashboard|admin|crud|blog|ecommerce|multi-page|api|auth|login)\b/i,
    tokenRange: [10000, 30000],
    avgTokens: 20000,
  },
  complex: {
    keywords: [
      'saas', 'platform', 'marketplace', 'social network', 'real-time',
      'websocket', 'payment integration', 'stripe', 'subscription', 'analytics',
      'charts', 'reporting', 'multi-user', 'teams', 'collaboration'
    ],
    patterns: /\b(saas|platform|marketplace|social|real-time|websocket|payment|stripe|analytics|charts|multi-user|teams)\b/i,
    tokenRange: [30000, 100000],
    avgTokens: 60000,
  },
  enterprise: {
    keywords: [
      'enterprise', 'scalable', 'microservices', 'game', '3d', '2d game',
      'multiplayer', 'advanced analytics', 'machine learning', 'ai features',
      'complex workflow', 'multi-tenant', 'white label'
    ],
    patterns: /\b(enterprise|scalable|microservices|game|3d|2d|multiplayer|ml|ai|multi-tenant|white.?label)\b/i,
    tokenRange: [100000, 300000],
    avgTokens: 150000,
  },
};

/**
 * Analyze user prompt to determine project complexity
 */
export function detectComplexity(prompt: string): ComplexityResult {
  const lowerPrompt = prompt.toLowerCase();
  const scores = {
    simple: 0,
    medium: 0,
    complex: 0,
    enterprise: 0,
  };

  // Score each complexity level
  for (const [level, indicators] of Object.entries(COMPLEXITY_INDICATORS)) {
    // Check keywords
    const keywordMatches = indicators.keywords.filter(keyword => 
      lowerPrompt.includes(keyword.toLowerCase())
    ).length;
    scores[level as ComplexityLevel] += keywordMatches * 2;

    // Check patterns
    if (indicators.patterns.test(prompt)) {
      scores[level as ComplexityLevel] += 1;
    }
  }

  // Additional heuristics
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 100) {
    scores.complex += 1;
    scores.enterprise += 1;
  }

  // Feature detection
  const features = [
    'database', 'authentication', 'payment', 'api', 'real-time',
    'charts', 'analytics', 'admin', 'user management', 'email'
  ].filter(feature => lowerPrompt.includes(feature)).length;

  if (features >= 5) {
    scores.complex += 2;
    scores.enterprise += 1;
  } else if (features >= 3) {
    scores.medium += 2;
    scores.complex += 1;
  } else if (features >= 1) {
    scores.medium += 1;
  }

  // Determine complexity level
  let level: ComplexityLevel = 'simple';
  let maxScore = scores.simple;

  if (scores.medium > maxScore) {
    level = 'medium';
    maxScore = scores.medium;
  }
  if (scores.complex > maxScore) {
    level = 'complex';
    maxScore = scores.complex;
  }
  if (scores.enterprise > maxScore) {
    level = 'enterprise';
    maxScore = scores.enterprise;
  }

  // If no clear indicators, default to medium
  if (maxScore === 0) {
    level = 'medium';
    maxScore = 1;
  }

  const indicators = COMPLEXITY_INDICATORS[level];
  const estimatedTokens = indicators.avgTokens;
  const estimatedCost = calculateTokenCost(estimatedTokens);

  // Calculate confidence based on score strength
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(maxScore / totalScore, 1) : 0.5;

  // Build reasons
  const reasons = buildReasons(level, prompt, features);

  return {
    level,
    estimatedTokens,
    estimatedCost,
    confidence,
    reasons,
  };
}

/**
 * Calculate estimated cost based on tokens (with caching)
 * Assumes 80% cache hit rate after first project
 */
function calculateTokenCost(totalTokens: number): number {
  // Split: ~40% input, ~60% output (typical)
  const inputTokens = totalTokens * 0.4;
  const outputTokens = totalTokens * 0.6;

  // Pricing per 1M tokens
  const inputCost = (inputTokens / 1_000_000) * 3.00;
  const outputCost = (outputTokens / 1_000_000) * 15.00;

  // Apply 80% cache discount (after first project)
  const cachedCost = (inputCost + outputCost) * 0.2;

  return parseFloat(cachedCost.toFixed(4));
}

/**
 * Build human-readable reasons for complexity classification
 */
function buildReasons(level: ComplexityLevel, prompt: string, featureCount: number): string[] {
  const reasons: string[] = [];

  switch (level) {
    case 'simple':
      reasons.push('Single-page or static site detected');
      if (featureCount === 0) {
        reasons.push('No complex features required');
      }
      break;

    case 'medium':
      reasons.push('Multi-page application with interactive features');
      if (featureCount >= 2) {
        reasons.push(`${featureCount} feature integrations detected`);
      }
      break;

    case 'complex':
      reasons.push('Full-featured platform with advanced capabilities');
      if (featureCount >= 4) {
        reasons.push(`${featureCount} complex features required`);
      }
      if (prompt.toLowerCase().includes('user') && prompt.toLowerCase().includes('auth')) {
        reasons.push('Multi-user authentication system');
      }
      break;

    case 'enterprise':
      reasons.push('Enterprise-grade application or game');
      if (featureCount >= 5) {
        reasons.push(`${featureCount}+ advanced features`);
      }
      if (prompt.toLowerCase().includes('game')) {
        reasons.push('Game development requires extensive code generation');
      }
      break;
  }

  return reasons;
}

/**
 * Get token allowance for a plan
 */
export function getTokenAllowance(plan: string): number {
  const allowances = {
    free: 30000,
    starter: 120000,
    pro: 300000,
    business: 800000,
    enterprise: 3000000,
  };

  return allowances[plan as keyof typeof allowances] || 30000;
}

/**
 * Calculate overage cost for additional tokens
 */
export function calculateOverageCost(tokensNeeded: number): number {
  // $1.50 per 1,000 tokens
  return parseFloat(((tokensNeeded / 1000) * 1.50).toFixed(2));
}

/**
 * Check if user has enough tokens for estimated project
 */
export interface TokenAvailability {
  hasEnough: boolean;
  tokensRemaining: number;
  tokensNeeded: number;
  overageTokens: number;
  overageCost: number;
}

export function checkTokenAvailability(
  tokensUsed: number,
  tokenLimit: number,
  estimatedTokens: number
): TokenAvailability {
  const tokensRemaining = Math.max(0, tokenLimit - tokensUsed);
  const tokensNeeded = estimatedTokens;
  const overageTokens = Math.max(0, tokensNeeded - tokensRemaining);
  const overageCost = overageTokens > 0 ? calculateOverageCost(overageTokens) : 0;

  return {
    hasEnough: tokensRemaining >= tokensNeeded,
    tokensRemaining,
    tokensNeeded,
    overageTokens,
    overageCost,
  };
}
