/**
 * LOMU SUPER CORE Prompt Builder
 * Assembles the complete system prompt from modular sections
 */

import { getPlatformAwarenessPrompt } from '../services/platformManifest.ts';
import {
  TOOLS_AWARENESS_SECTION,
  ROLE_SECTION,
  AUTONOMY_SECTION,
  ACTION_MANDATE_SECTION,
  TOOL_CALLING_RULES_SECTION,
  PROACTIVENESS_SECTION,
  TASK_EXECUTION_SECTION,
  COMMUNICATION_POLICY_SECTION,
  GEMINI_BEST_PRACTICES_SECTION,
  FORBIDDEN_ACTIONS_SECTION,
  ENGINEERING_REASONING_SECTION,
  TESTING_RULES_SECTION,
  WORKFLOW_SECTION,
} from './promptSections.ts';

export interface BuildPromptOptions {
  platform: string;
  autoCommit: boolean;
  intent: 'question' | 'task' | 'status';
  contextPrompt: string;
  userMessage: string;
  autonomyLevel?: string;
  extendedThinking?: boolean;
}

/**
 * Build the complete BeeHive system prompt
 * Assembles all modular sections into a cohesive prompt
 */
export function buildLomuSuperCorePrompt(options: BuildPromptOptions): string {
  const { 
    platform, 
    autoCommit, 
    intent, 
    contextPrompt, 
    userMessage, 
    autonomyLevel = 'standard', 
    extendedThinking = false 
  } = options;
  
  let prompt = `You are Lomu, an autonomous AI software engineer assistant that helps users build and debug software projects.

${getPlatformAwarenessPrompt()}

<tools_awareness>
${TOOLS_AWARENESS_SECTION}
</tools_awareness>

<role>
${ROLE_SECTION}
</role>

<autonomy>
${AUTONOMY_SECTION}
</autonomy>

<action_mandate>
${ACTION_MANDATE_SECTION}
</action_mandate>

<tool_calling_rules>
${TOOL_CALLING_RULES_SECTION}
</tool_calling_rules>

<proactiveness>
${PROACTIVENESS_SECTION}
</proactiveness>

<task_execution>
${TASK_EXECUTION_SECTION}
${extendedThinking ? `

🧠 **EXTENDED THINKING MODE ACTIVE**

This request requires deeper analysis. Before implementing:
1. **Consider 3-5 alternative approaches** - Don't just go with the first idea
2. **Analyze edge cases** - What could go wrong? What corner cases exist?
3. **Think about maintainability** - Will this be easy to extend and debug?
4. **Document your reasoning** - Explain your thinking process
5. **Verify assumptions** - Double-check your understanding
` : ''}
</task_execution>

<communication_policy>
${COMMUNICATION_POLICY_SECTION}
</communication_policy>

<gemini_best_practices>
${GEMINI_BEST_PRACTICES_SECTION}
</gemini_best_practices>

<forbidden_actions>
${FORBIDDEN_ACTIONS_SECTION}
</forbidden_actions>

<engineering_reasoning>
${ENGINEERING_REASONING_SECTION}
</engineering_reasoning>

<testing_rules>
${TESTING_RULES_SECTION}
</testing_rules>

<workflow>
${WORKFLOW_SECTION}
</workflow>

---

## CONTEXT & SETTINGS

**Platform:** ${platform}
**Auto-Commit:** ${autoCommit ? 'ENABLED' : 'DISABLED'}
**Intent:** ${intent}
**Autonomy Level:** ${autonomyLevel}
**User Message:** ${userMessage}

${contextPrompt ? `## USER-PROVIDED CONTEXT

${contextPrompt}` : ''}

---

Now proceed with your task. Remember: Be autonomous, be conversational, be efficient. Fix bugs immediately, don't over-explain. Use your 18 core tools wisely.`;

  return prompt;
}
