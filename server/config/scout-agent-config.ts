/**
 * Scout Agent Configuration
 * 
 * Identifies all AI services (GPS), tools, and capabilities for Scout
 * Complete configuration for both Replit and Railway deployment
 */

export interface AIServiceConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKeyEnv: string;
  costPerMillionTokens: { input: number; output: number };
  contextWindow: number;
  capabilities: string[];
  status: 'required' | 'optional' | 'premium';
}

export interface ToolDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  requiredParams: string[];
  optionalParams: string[];
  requiresAuth: boolean;
  requiresDatabase: boolean;
  requiresAIService: string | null;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Scout's AI Services (GPS - Gemini, etc.)
 * Scout uses unified Gemini architecture only
 */
export const SCOUT_AI_SERVICES: AIServiceConfig[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Scout (Worker)',
    provider: 'Google',
    model: 'gemini-2.5-flash',
    apiKeyEnv: 'GEMINI_API_KEY',
    costPerMillionTokens: { input: 0.075, output: 0.3 },
    contextWindow: 1000000,
    capabilities: [
      'Code generation',
      'Bug fixing',
      'Code completion',
      'Function calling (18+ tools)',
      'Vision analysis',
      'Real-time streaming',
      'JSON function calling',
    ],
    status: 'required',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Scout Advanced (Strategic)',
    provider: 'Google',
    model: 'gemini-2.5-pro',
    apiKeyEnv: 'GEMINI_API_KEY',
    costPerMillionTokens: { input: 1.5, output: 6.0 },
    contextWindow: 2000000,
    capabilities: [
      'Complex architecture decisions',
      'Code review',
      'Performance optimization',
      'Security analysis',
      'Refactoring guidance',
      'Strategic planning',
    ],
    status: 'premium',
  },
];

/**
 * Scout's Tool Definitions - 18+ Core Tools
 * All tools verified and working
 */
export const SCOUT_TOOLS: ToolDefinition[] = [
  // GROUP 1: File Operations (7 tools)
  {
    id: 'read-file',
    name: 'Read File',
    category: 'file-operations',
    description: 'Read project or platform source code files',
    requiredParams: ['path'],
    optionalParams: ['offset', 'limit'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'write-file',
    name: 'Write File',
    category: 'file-operations',
    description: 'Create or modify files in the project',
    requiredParams: ['path', 'content'],
    optionalParams: [],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'high',
  },
  {
    id: 'glob-files',
    name: 'Glob Files',
    category: 'file-operations',
    description: 'Find files matching glob patterns',
    requiredParams: ['pattern'],
    optionalParams: ['path'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'list-directory',
    name: 'List Directory',
    category: 'file-operations',
    description: 'List files and directories in a path',
    requiredParams: ['path'],
    optionalParams: ['recursive', 'maxFiles'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'get-file-map',
    name: 'Get File Map',
    category: 'file-operations',
    description: 'Get high-level project structure and file map',
    requiredParams: [],
    optionalParams: ['filter'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'search-files',
    name: 'Search Files',
    category: 'file-operations',
    description: 'Search file contents using regex',
    requiredParams: ['pattern'],
    optionalParams: ['path', 'type'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'refresh-logs',
    name: 'Refresh Logs',
    category: 'file-operations',
    description: 'Fetch and read latest workflow and console logs',
    requiredParams: [],
    optionalParams: [],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },

  // GROUP 2: Code Intelligence (5 tools)
  {
    id: 'smart-read-file',
    name: 'Smart Read File',
    category: 'code-intelligence',
    description: 'AST-based code reading with context detection',
    requiredParams: ['path'],
    optionalParams: ['offset', 'limit'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'extract-function',
    name: 'Extract Function',
    category: 'code-intelligence',
    description: 'Extract specific function from a file',
    requiredParams: ['path', 'functionName'],
    optionalParams: [],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'get-related-files',
    name: 'Get Related Files',
    category: 'code-intelligence',
    description: 'Find related files based on imports and usage',
    requiredParams: ['path'],
    optionalParams: [],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'get-auto-context',
    name: 'Get Auto Context',
    category: 'code-intelligence',
    description: 'Automatically determine required context for a file',
    requiredParams: ['path'],
    optionalParams: [],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'code-search',
    name: 'Code Search',
    category: 'code-intelligence',
    description: 'Search codebase with full context understanding',
    requiredParams: ['query'],
    optionalParams: ['searchPaths'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },

  // GROUP 3: Database & Infrastructure (4 tools)
  {
    id: 'check-database-status',
    name: 'Check Database Status',
    category: 'database',
    description: 'Verify database connection and status',
    requiredParams: [],
    optionalParams: [],
    requiresAuth: true,
    requiresDatabase: true,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'execute-sql',
    name: 'Execute SQL',
    category: 'database',
    description: 'Execute SQL queries against development database',
    requiredParams: ['sql_query'],
    optionalParams: ['environment'],
    requiresAuth: true,
    requiresDatabase: true,
    requiresAIService: null,
    riskLevel: 'high',
  },
  {
    id: 'create-postgresql-database',
    name: 'Create PostgreSQL Database',
    category: 'database',
    description: 'Create a new PostgreSQL database',
    requiredParams: [],
    optionalParams: [],
    requiresAuth: true,
    requiresDatabase: true,
    requiresAIService: null,
    riskLevel: 'high',
  },
  {
    id: 'programming-language-install',
    name: 'Install Programming Language',
    category: 'infrastructure',
    description: 'Install programming languages and dependencies',
    requiredParams: ['programming_languages'],
    optionalParams: [],
    requiresAuth: true,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'high',
  },

  // GROUP 4: Environment & Secrets (3 tools)
  {
    id: 'view-env-vars',
    name: 'View Environment Variables',
    category: 'secrets',
    description: 'View non-secret environment variables',
    requiredParams: [],
    optionalParams: ['type', 'environment', 'keys'],
    requiresAuth: true,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'set-env-vars',
    name: 'Set Environment Variables',
    category: 'secrets',
    description: 'Set environment variables (not secrets)',
    requiredParams: ['input'],
    optionalParams: [],
    requiresAuth: true,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'high',
  },
  {
    id: 'request-env-var',
    name: 'Request Environment Variables',
    category: 'secrets',
    description: 'Request secrets or env vars from user',
    requiredParams: ['request'],
    optionalParams: ['user_message'],
    requiresAuth: true,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'medium',
  },

  // GROUP 5: AI/Vision Services (3 tools)
  {
    id: 'web-search',
    name: 'Web Search',
    category: 'ai-services',
    description: 'Search web for documentation and examples',
    requiredParams: ['query'],
    optionalParams: [],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'low',
  },
  {
    id: 'vision-analyze',
    name: 'Vision Analysis',
    category: 'ai-services',
    description: 'Analyze images using Gemini Vision',
    requiredParams: ['imageBase64', 'imageMediaType', 'prompt'],
    optionalParams: [],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: 'gemini-2.5-flash',
    riskLevel: 'low',
  },
  {
    id: 'search-codebase',
    name: 'Search Codebase',
    category: 'ai-services',
    description: 'Use LLM to search and understand codebase',
    requiredParams: ['query'],
    optionalParams: ['search_paths'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: 'gemini-2.5-flash',
    riskLevel: 'low',
  },

  // GROUP 6: Deployment & Testing (3 tools)
  {
    id: 'suggest-deploy',
    name: 'Suggest Deploy',
    category: 'deployment',
    description: 'Suggest deploying application to production',
    requiredParams: [],
    optionalParams: [],
    requiresAuth: true,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'medium',
  },
  {
    id: 'suggest-rollback',
    name: 'Suggest Rollback',
    category: 'deployment',
    description: 'Suggest rollback to previous checkpoint',
    requiredParams: ['suggest_rollback_reason'],
    optionalParams: [],
    requiresAuth: true,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'medium',
  },
  {
    id: 'browser-test',
    name: 'Browser Test',
    category: 'testing',
    description: 'Test application in real browser using Playwright',
    requiredParams: ['url'],
    optionalParams: ['actions', 'assertions'],
    requiresAuth: false,
    requiresDatabase: false,
    requiresAIService: null,
    riskLevel: 'medium',
  },
];

/**
 * Environment Variables Required for Scout Deployment
 */
export interface EnvironmentRequirement {
  key: string;
  type: 'secret' | 'env';
  required: boolean;
  environment: 'development' | 'production' | 'shared';
  description: string;
  example?: string;
}

export const SCOUT_ENV_REQUIREMENTS: EnvironmentRequirement[] = [
  {
    key: 'GEMINI_API_KEY',
    type: 'secret',
    required: true,
    environment: 'shared',
    description: 'Google Gemini API key for Scout AI',
    example: 'AIzaSy...',
  },
  {
    key: 'DATABASE_URL',
    type: 'secret',
    required: true,
    environment: 'shared',
    description: 'PostgreSQL database connection string',
    example: 'postgresql://user:pass@host/db',
  },
  {
    key: 'SESSION_SECRET',
    type: 'secret',
    required: true,
    environment: 'shared',
    description: 'Secret key for session management',
    example: 'random-secure-string',
  },
  {
    key: 'NODE_ENV',
    type: 'env',
    required: true,
    environment: 'shared',
    description: 'Node environment (development or production)',
    example: 'production',
  },
  {
    key: 'PORT',
    type: 'env',
    required: false,
    environment: 'shared',
    description: 'Server port (default: 5000)',
    example: '5000',
  },
];

/**
 * Validation functions
 */
export function validateScoutSetup(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required AI services
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === 'dummy-key-for-development') {
    errors.push('GEMINI_API_KEY is not configured');
  }

  // Check database
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    errors.push('DATABASE_URL is not configured');
  }

  // Check session secret
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    warnings.push('SESSION_SECRET not configured (using development default)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getRequiredSecrets(): string[] {
  return SCOUT_ENV_REQUIREMENTS
    .filter(r => r.type === 'secret' && r.required)
    .map(r => r.key);
}

export function getToolById(toolId: string): ToolDefinition | undefined {
  return SCOUT_TOOLS.find(t => t.id === toolId);
}

export function getToolsByCategory(category: string): ToolDefinition[] {
  return SCOUT_TOOLS.filter(t => t.category === category);
}

export function getHighRiskTools(): ToolDefinition[] {
  return SCOUT_TOOLS.filter(t => t.riskLevel === 'high');
}

export function getAllToolIds(): string[] {
  return SCOUT_TOOLS.map(t => t.id);
}

export function validateToolCall(toolId: string, params: Record<string, any>): {
  valid: boolean;
  errors: string[];
} {
  const tool = getToolById(toolId);
  if (!tool) {
    return { valid: false, errors: [`Tool not found: ${toolId}`] };
  }

  const errors: string[] = [];

  // Check required parameters
  for (const required of tool.requiredParams) {
    if (!(required in params)) {
      errors.push(`Missing required parameter: ${required}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
