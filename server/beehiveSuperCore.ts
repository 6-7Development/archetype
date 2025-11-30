/**
 * BEEHIVE SUPER LOGIC CORE v1.0
 * 
 * Re-exports modular prompt building system
 * This file maintains backward compatibility while delegating to focused modules
 */

// Re-export all modular components
export * from './beehiveSuperCore/index.ts';

// Maintain primary exports for backward compatibility
export { buildLomuSuperCorePrompt as buildBeeHiveSuperCorePrompt, type BuildPromptOptions } from './beehiveSuperCore/promptBuilder.ts';
export { LOMU_CORE_CONFIG as BEEHIVE_CORE_CONFIG, MODEL_CONFIG, API_CONFIG, type LomuCoreConfig as BeeHiveCoreConfig } from './beehiveSuperCore/config.ts';
export { LOMU_CORE_TOOLS as BEEHIVE_CORE_TOOLS, TOOL_DISTRIBUTION, getToolsForContext } from './beehiveSuperCore/tooling.ts';

// Legacy compatibility aliases
export { buildLomuSuperCorePrompt, type BuildPromptOptions as BuildLomuPromptOptions } from './beehiveSuperCore/promptBuilder.ts';
export { LOMU_CORE_CONFIG, type LomuCoreConfig } from './beehiveSuperCore/config.ts';
export { LOMU_CORE_TOOLS } from './beehiveSuperCore/tooling.ts';

/**
 * Default export for convenience
 */
import { buildLomuSuperCorePrompt } from './beehiveSuperCore/promptBuilder.ts';
export default buildLomuSuperCorePrompt;
