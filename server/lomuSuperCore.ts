/**
 * LOMU SUPER LOGIC CORE v1.0
 * 
 * Re-exports modular prompt building system
 * This file maintains backward compatibility while delegating to focused modules
 */

// Re-export all modular components
export * from './lomuSuperCore/index.ts';

// Maintain primary exports for backward compatibility
export { buildLomuSuperCorePrompt, type BuildPromptOptions } from './lomuSuperCore/promptBuilder.ts';
export { LOMU_CORE_CONFIG, MODEL_CONFIG, API_CONFIG, type LomuCoreConfig } from './lomuSuperCore/config.ts';
export { LOMU_CORE_TOOLS, TOOL_DISTRIBUTION, getToolsForContext } from './lomuSuperCore/tooling.ts';

/**
 * Default export for convenience
 */
import { buildLomuSuperCorePrompt } from './lomuSuperCore/promptBuilder.ts';
export default buildLomuSuperCorePrompt;
