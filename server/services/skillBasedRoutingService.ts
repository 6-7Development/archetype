/**
 * Gap #12: Skill-Based Subagent Routing
 * Route tasks to specialized subagents based on their skills
 */

export interface SubagentSkillProfile {
  type: string; // 'tester', 'linter', 'refactorer', 'documenter'
  skills: string[];
  complexity: 'easy' | 'medium' | 'hard';
  preferredFileTypes: string[];
  costPerHour: number;
}

export interface TaskAnalysis {
  type: string;
  keywords: string[];
  fileTypes: string[];
  complexity: 'easy' | 'medium' | 'hard';
  estimatedDuration: number; // minutes
}

export interface RoutingDecision {
  recommendedAgent: string;
  confidence: number; // 0-100
  alternativeAgents: string[];
  reason: string;
}

const SKILL_PROFILES: Map<string, SubagentSkillProfile> = new Map([
  [
    'tester',
    {
      type: 'tester',
      skills: ['jest', 'vitest', 'e2e', 'playwright', 'unit-tests'],
      complexity: 'medium',
      preferredFileTypes: ['.test.ts', '.spec.ts', '.test.tsx'],
      costPerHour: 5,
    },
  ],
  [
    'linter',
    {
      type: 'linter',
      skills: ['eslint', 'prettier', 'style', 'formatting', 'code-quality'],
      complexity: 'easy',
      preferredFileTypes: ['.ts', '.tsx', '.js', '.jsx'],
      costPerHour: 2,
    },
  ],
  [
    'refactorer',
    {
      type: 'refactorer',
      skills: ['refactor', 'performance', 'architecture', 'optimization'],
      complexity: 'hard',
      preferredFileTypes: ['.ts', '.tsx', '.js'],
      costPerHour: 8,
    },
  ],
  [
    'documenter',
    {
      type: 'documenter',
      skills: ['documentation', 'comments', 'readme', 'api-docs', 'jsdoc'],
      complexity: 'easy',
      preferredFileTypes: ['.md', '.ts', '.tsx'],
      costPerHour: 3,
    },
  ],
]);

/**
 * Analyze task to extract skills/keywords
 */
export function analyzeTask(taskDescription: string): TaskAnalysis {
  const lower = taskDescription.toLowerCase();

  let type = 'general';
  let complexity: 'easy' | 'medium' | 'hard' = 'medium';

  if (lower.includes('test')) {
    type = 'test';
    complexity = 'medium';
  } else if (lower.includes('lint') || lower.includes('format') || lower.includes('style')) {
    type = 'lint';
    complexity = 'easy';
  } else if (
    lower.includes('refactor') ||
    lower.includes('optimize') ||
    lower.includes('performance')
  ) {
    type = 'refactor';
    complexity = 'hard';
  } else if (lower.includes('document') || lower.includes('comment')) {
    type = 'document';
    complexity = 'easy';
  }

  const keywords = taskDescription
    .split(' ')
    .filter((w) => w.length > 3 && !['that', 'this', 'with', 'from'].includes(w.toLowerCase()));

  return {
    type,
    keywords,
    fileTypes: [], // Would be populated from file list
    complexity,
    estimatedDuration: complexity === 'easy' ? 15 : complexity === 'medium' ? 30 : 60,
  };
}

/**
 * Route task to best-fit subagent
 */
export function routeTask(analysis: TaskAnalysis): RoutingDecision {
  const candidates: Array<{
    agent: string;
    score: number;
  }> = [];

  // Score each subagent
  for (const [key, profile] of SKILL_PROFILES.entries()) {
    let score = 0;

    // Match complexity
    if (profile.complexity === analysis.complexity) score += 40;
    else if (profile.complexity === 'hard' && analysis.complexity !== 'easy') score += 20;

    // Match type
    if (profile.type === analysis.type) score += 50;

    // Match skills
    const matchingSkills = profile.skills.filter((s) =>
      analysis.keywords.some((k) => s.includes(k) || k.includes(s)),
    ).length;
    score += matchingSkills * 5;

    candidates.push({ agent: key, score });
  }

  candidates.sort((a, b) => b.score - a.score);

  const recommended = candidates[0]?.agent || 'general';
  const confidence = Math.min(100, (candidates[0]?.score || 0) * 2);
  const alternatives = candidates.slice(1, 3).map((c) => c.agent);

  return {
    recommendedAgent: recommended,
    confidence,
    alternativeAgents: alternatives,
    reason: `Routed based on task type (${analysis.type}) and complexity (${analysis.complexity})`,
  };
}
