/**
 * LOMU SUPER CORE Tooling Module
 * Tool definitions and distribution
 */

export const LOMU_CORE_TOOLS = [
  {
    name: 'read',
    description: 'Read file contents with optional line range. Use for understanding code context.',
    category: 'file_operation',
  },
  {
    name: 'write',
    description: 'Write or create files. Always read first, then write with full content.',
    category: 'file_operation',
  },
  {
    name: 'bash',
    description: 'Execute shell commands for testing, compilation, running tools.',
    category: 'system',
  },
  {
    name: 'search_codebase',
    description: 'Semantic search for code patterns, functions, or architectural decisions.',
    category: 'search',
  },
  {
    name: 'grep',
    description: 'Fast text search using ripgrep. Find specific strings or regex patterns.',
    category: 'search',
  },
  {
    name: 'glob',
    description: 'Find files matching patterns. Use before reading multiple files.',
    category: 'search',
  },
  {
    name: 'ls',
    description: 'List directory contents. Understand project structure.',
    category: 'file_operation',
  },
  {
    name: 'get_latest_lsp_diagnostics',
    description: 'Get TypeScript/LSP errors. Run after major code changes.',
    category: 'diagnostic',
  },
  {
    name: 'refresh_all_logs',
    description: 'Fetch latest application logs for debugging.',
    category: 'diagnostic',
  },
  {
    name: 'start_subagent',
    description: 'Delegate complex multi-step tasks to focused subagents.',
    category: 'agent_delegation',
  },
  {
    name: 'user_query',
    description: 'Ask user clarifying questions when blocked on critical decisions.',
    category: 'user_interaction',
  },
  {
    name: 'web_search',
    description: 'Search the internet for up-to-date information, APIs, frameworks.',
    category: 'external',
  },
  {
    name: 'create_task_list',
    description: 'Break down complex work into tracked tasks. Use sparingly.',
    category: 'workflow',
  },
  {
    name: 'update_task',
    description: 'Update task status (in_progress, completed, pending).',
    category: 'workflow',
  },
  {
    name: 'read_task_list',
    description: 'View current task list and progress.',
    category: 'workflow',
  },
  {
    name: 'architect_consult',
    description: 'Escalate to I AM Architect for strategic guidance (premium).',
    category: 'escalation',
  },
  {
    name: 'perform_diagnosis',
    description: 'Run platform or project diagnostics.',
    category: 'diagnostic',
  },
  {
    name: 'extract_function',
    description: 'Extract and analyze specific functions from codebase.',
    category: 'analysis',
  },
];

// Tool counts for distribution
export const TOOL_DISTRIBUTION = {
  LOMU_CORE_TOOLS: 18, // Optimized for Google's 10-20 sweet spot
  SUBAGENT_TOOLS: 12,  // Focused subset
  ARCHITECT_TOOLS: 23, // Extended for complex reasoning (Claude)
} as const;

/**
 * Get tools available for a specific context
 */
export function getToolsForContext(context: 'lomu' | 'subagent' | 'architect'): typeof LOMU_CORE_TOOLS {
  switch (context) {
    case 'lomu':
      return LOMU_CORE_TOOLS;
    case 'subagent':
      return LOMU_CORE_TOOLS.slice(0, 12); // Core file ops + search
    case 'architect':
      return LOMU_CORE_TOOLS; // Can use all + Claude-specific tools
    default:
      return LOMU_CORE_TOOLS;
  }
}
