/**
 * LOMU SUPER CORE Module Exports
 * Central re-exports for prompt building and configuration
 */

export * from './config';
export * from './promptSections';
export * from './promptBuilder';
export * from './tooling';

// Default exports for backward compatibility
export { buildLomuSuperCorePrompt } from './promptBuilder';
export { LOMU_CORE_CONFIG, MODEL_CONFIG, API_CONFIG, type LomuCoreConfig } from './config';
export { LOMU_CORE_TOOLS, TOOL_DISTRIBUTION, getToolsForContext } from './tooling';

// Alias for architect context
export { buildLomuSuperCorePrompt as buildArchitectSystemPrompt } from './promptBuilder';
