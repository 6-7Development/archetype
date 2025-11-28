/**
 * TOOL DISTRIBUTION STRATEGY
 * Balances all 67 tools across Hexad, I AM Architect, and Specialized Subagents
 * 
 * Philosophy:
 * - Hexad (Gemini): 18 essential tools for core development + delegation
 * - I AM Architect (Claude): 15-18 tools for strategic analysis + reviews
 * - Subagents: ~30 specialized tools organized by domain expertise
 */

// ============================================================================
// LOMU AI TOOLS (18 essential) - Cost-effective Gemini for rapid iteration
// ============================================================================
export const LOMU_AI_TOOL_NAMES = [
  // Core File Operations
  'read_project_file',
  'write_project_file',
  'delete_project_file',
  'bash',
  'read',
  'write',
  'glob',
  'ls',
  
  // Testing & Analysis
  'browser_test',
  'vision_analyze',
  'perform_diagnosis',
  'web_search',
  
  // Critical Decision Support (Delegation)
  'architect_consult',      // Ask I AM Architect for guidance
  'start_subagent',         // Delegate to specialists
  
  // Infrastructure Essentials
  'execute_sql_tool',
  'ask_secrets',
  'web_fetch',
  'suggest_deploy',
] as const;

// ============================================================================
// I AM ARCHITECT TOOLS (16 tools) - Claude for strategic guidance
// ============================================================================
export const ARCHITECT_TOOL_NAMES = [
  // Code Review & Analysis
  'request_architect_review',
  'code_search',
  'perform_diagnosis',
  
  // Knowledge Management
  'knowledge_store',
  'knowledge_search',
  'knowledge_recall',
  
  // Platform Administration
  'read_platform_file',
  'write_platform_file',
  'list_platform_files',
  
  // Infrastructure & Configuration
  'check_database_status',
  'create_postgresql_database_tool',
  'generate_design_guidelines',
  'search_integrations',
  'use_integration',
  
  // Deployment & Safety
  'suggest_rollback',
  'refresh_all_logs',
] as const;

// ============================================================================
// SUBAGENT TOOLS (~33 specialized tools) - Domain-specific experts
// ============================================================================

// TESTING SPECIALIST
export const TESTING_SPECIALIST_TOOLS = [
  'browser_test',
  'run_playwright_test',
  'vision_analyze',
  'check_sub_agent_status',
] as const;

// DATABASE & BACKEND SPECIALIST
export const DATABASE_SPECIALIST_TOOLS = [
  'execute_sql_tool',
  'check_database_status',
  'create_postgresql_database_tool',
  'programming_language_install_tool',
  'refresh_all_logs',
  'read_logs',
] as const;

// GITHUB & DEVOPS SPECIALIST
export const DEVOPS_SPECIALIST_TOOLS = [
  'commit_to_github',
  'create_github_branch',
  'push_to_branch',
  'create_pull_request',
  'export_project_to_github',
  'get_github_status',
  'suggest_deploy',
  'suggest_rollback',
] as const;

// INTEGRATIONS & SECRETS SPECIALIST
export const INTEGRATION_SPECIALIST_TOOLS = [
  'search_integrations',
  'use_integration',
  'ask_secrets',
  'check_secrets',
  'set_env_var',
  'get_env_vars',
  'delete_env_var',
  'get_env_var_templates',
] as const;

// CODE INTELLIGENCE SPECIALIST
export const CODE_INTELLIGENCE_TOOLS = [
  'index_file',
  'smart_read_file',
  'get_related_files',
  'extract_function',
  'get_auto_context',
  'get_file_summary',
  'read_platform_file',
  'write_platform_file',
  'create_platform_file',
  'delete_platform_file',
  'create_project_file',
] as const;

// DOCUMENTATION SPECIALIST
export const DOCUMENTATION_SPECIALIST_TOOLS = [
  'google_docs_read',
  'google_docs_search',
  'google_docs_metadata',
  'read_logs',
] as const;

// DESIGN & ASSETS SPECIALIST
export const DESIGN_SPECIALIST_TOOLS = [
  'generate_design_guidelines',
  'stock_image_tool',
  'vision_analyze',
] as const;

// TASK MANAGEMENT & ORCHESTRATION SPECIALIST
export const TASK_ORCHESTRATION_TOOLS = [
  'create_task_list',
  'update_task',
  'read_task_list',
  'spawn_sub_agent',
  'check_sub_agent_status',
  'request_architect_review',
] as const;

// ============================================================================
// SUBAGENT REGISTRY - Map specializations to their tools
// ============================================================================
export const SUBAGENT_SPECIALISTS = {
  testing: { tools: TESTING_SPECIALIST_TOOLS, description: 'Browser & UI testing expert' },
  database: { tools: DATABASE_SPECIALIST_TOOLS, description: 'Database & backend operations' },
  devops: { tools: DEVOPS_SPECIALIST_TOOLS, description: 'GitHub, deployment, CI/CD' },
  integration: { tools: INTEGRATION_SPECIALIST_TOOLS, description: 'APIs, integrations, secrets' },
  code_intelligence: { tools: CODE_INTELLIGENCE_TOOLS, description: 'Code analysis, refactoring' },
  documentation: { tools: DOCUMENTATION_SPECIALIST_TOOLS, description: 'Google Docs, logging' },
  design: { tools: DESIGN_SPECIALIST_TOOLS, description: 'UI/UX design & assets' },
  orchestration: { tools: TASK_ORCHESTRATION_TOOLS, description: 'Task management & coordination' },
} as const;

// ============================================================================
// TOOL DISTRIBUTION SUMMARY
// ============================================================================
export const DISTRIBUTION_SUMMARY = {
  lomu_ai: {
    agent: 'Hexad (Gemini 2.5 Flash)',
    toolCount: LOMU_AI_TOOL_NAMES.length,
    tools: LOMU_AI_TOOL_NAMES,
    purpose: 'Core development, rapid iteration, cost-effective operations',
    delegation: 'Asks I AM Architect for complex decisions, spawns subagents for specialized work',
  },
  architect: {
    agent: 'I AM Architect (Claude Sonnet 4)',
    toolCount: ARCHITECT_TOOL_NAMES.length,
    tools: ARCHITECT_TOOL_NAMES,
    purpose: 'Strategic guidance, code review, platform decisions',
    activation: 'Called by Hexad via architect_consult when stuck or for approval',
  },
  subagents: {
    totalTools: Object.values(SUBAGENT_SPECIALISTS).reduce((sum, s) => sum + s.tools.length, 0),
    specialists: SUBAGENT_SPECIALISTS,
    purpose: 'Domain-specific expert work, parallel execution',
    activation: 'Spawned by Hexad via start_subagent when specialized capability needed',
  },
  total: {
    uniqueTools: 67,
    distribution: `${LOMU_AI_TOOL_NAMES.length} + ${ARCHITECT_TOOL_NAMES.length} + ${Object.values(SUBAGENT_SPECIALISTS).reduce((sum, s) => sum + s.tools.length, 0)} (with some shared)`,
  },
} as const;
