/**
 * Tool Distribution Strategy for Google Gemini API Optimization
 * 
 * Based on Google's recommendation: Keep tool count between 10-20 for optimal performance
 * 
 * Architecture:
 * - LomuAI (Gemini Flash): 13 core development tools
 * - Sub-Agents (Gemini Flash): 12 specialized execution tools  
 * - I AM Architect (Claude Sonnet 4): 12+ governance/analysis tools
 */

import { LOMU_TOOLS } from './index';

/**
 * LOMU CORE TOOLS (14 tools)
 * For regular LomuAI development work - fast execution primitives
 * Used by: LomuAI Chat, Platform Healing
 */
export const LOMU_CORE_TOOLS = LOMU_TOOLS.filter(tool => [
  // File Operations (3)
  'read',
  'write',
  'ls',
  
  // Smart Code Intelligence (2)
  'smart_read_file',
  'get_auto_context',
  
  // Task Management (2)
  'create_task_list',
  'update_task',
  
  // Web & Research (2)
  'web_search',
  'web_fetch',
  
  // Testing & Diagnosis (2)
  'browser_test',
  'perform_diagnosis',
  
  // Escalation (1) - NEW! Consult architect when stuck
  'architect_consult',
  
  // System Operations (2)
  'bash',
  'refresh_all_logs',
].includes(tool.name));

/**
 * SUBAGENT TOOLS (12 tools)
 * For delegated coding/testing loops - execution-focused
 * Used by: Sub-agents spawned by LomuAI
 */
export const SUBAGENT_TOOLS = LOMU_TOOLS.filter(tool => [
  // File Operations (2)
  'read',
  'write',
  
  // Smart Code Intelligence (2)
  'smart_read_file',
  'extract_function',
  
  // Execution (2)
  'bash',
  'browser_test',
  
  // Secrets & Config (2)
  'check_secrets',
  'ask_secrets',
  
  // Integrations (2)
  'search_integrations',
  'use_integration',
  
  // Deployment (2)
  'suggest_deploy',
  'suggest_rollback',
].includes(tool.name));

/**
 * ARCHITECT TOOLS (23 tools)
 * For platform oversight, complex reasoning, and governance
 * Used by: I AM Architect (stays on Claude, can handle 20+ tools)
 */
export const ARCHITECT_TOOLS = LOMU_TOOLS.filter(tool => [
  // Platform File Operations (3)
  'read_platform_file',
  'write_platform_file',
  'list_platform_files',
  
  // Architect Services (2)
  'architect_consult',
  'request_architect_review',
  
  // Knowledge Management (4)
  'knowledge_store',
  'knowledge_search',
  'knowledge_recall',
  'code_search',
  
  // Logs & Diagnostics (2)
  'refresh_all_logs',
  'read_logs',
  
  // Database (2)
  'execute_sql_tool',
  'check_database_status',
  
  // Design & Assets (2)
  'generate_design_guidelines',
  'stock_image_tool',
  
  // GitHub (4)
  'create_github_branch',
  'create_pull_request',
  'export_project_to_github',
  'get_github_status',
  
  // Environment Variables (4)
  'set_env_var',
  'get_env_vars',
  'delete_env_var',
  'get_env_var_templates',
].includes(tool.name));

// Validation at module load to catch distribution errors early
const coreCount = LOMU_CORE_TOOLS.length;
const subagentCount = SUBAGENT_TOOLS.length;
const architectCount = ARCHITECT_TOOLS.length;

console.log('[TOOL-DISTRIBUTION] Tool counts:');
console.log(`  - LOMU_CORE_TOOLS: ${coreCount} ${coreCount > 20 ? '⚠️ EXCEEDS GOOGLE LIMIT' : '✅'}`);
console.log(`  - SUBAGENT_TOOLS: ${subagentCount} ${subagentCount > 20 ? '⚠️ EXCEEDS GOOGLE LIMIT' : '✅'}`);
console.log(`  - ARCHITECT_TOOLS: ${architectCount} (Claude - no limit)`);

// Validate Gemini agents stay within Google's 10-20 recommendation
if (coreCount > 20) {
  console.warn(`[TOOL-DISTRIBUTION] ⚠️ WARNING: LOMU_CORE_TOOLS has ${coreCount} tools, exceeds Google's 20 tool limit!`);
}

if (subagentCount > 20) {
  console.warn(`[TOOL-DISTRIBUTION] ⚠️ WARNING: SUBAGENT_TOOLS has ${subagentCount} tools, exceeds Google's 20 tool limit!`);
}
