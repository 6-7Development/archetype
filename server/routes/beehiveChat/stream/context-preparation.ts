/**
 * CONTEXT PREPARATION MODULE
 * Extracted from lomuChat.ts streaming handler
 * 
 * Handles all AI context preparation logic:
 * - Conversation history loading
 * - Attachment processing
 * - Intent classification
 * - Complexity detection
 * - System prompt building
 * - Tool filtering
 * - Casual conversation detection
 */

import { db } from '../../../db.ts';
import { chatMessages, conversationStates } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { formatStateForPrompt, getCodeScratchpad, clearCodeScratchpad } from '../../../services/conversationState.ts';
import { classifyUserIntent, getMaxIterationsForIntent } from '../../../shared/chatConfig.ts';
import { buildBeeHiveSuperCorePrompt } from '../../../beehiveSuperCore.ts';
import { LOMU_CORE_TOOLS } from '../../../tools/tool-distributions.ts';
import type { 
  ConversationIntent, 
  UserIntent, 
  ComplexityResult,
  RunConfigGovernance 
} from './types.ts';

/**
 * Parameters for prepareAIContext function
 */
export interface PrepareAIContextParams {
  userId: string;
  conversationStateId: string;
  message: string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    content: string;
    mimeType: string;
    size: number;
  }>;
  userMessageId: string;
  autonomyLevel: 'basic' | 'standard' | 'deep' | 'max';
  autoCommit: boolean;
  autoPush: boolean;
  extendedThinking?: boolean;
  sendEvent: (type: string, data: any) => void;
}

/**
 * Result of AI context preparation
 */
export interface AIContextResult {
  conversationMessages: any[];
  systemPrompt: string;
  tools: any[];
  userIntent: UserIntent;
  conversationIntent: ConversationIntent;
  runConfig: RunConfigGovernance;
  maxIterations: number;
  isCasualConversation: boolean;
  isDefibrillatorPrompt: boolean;
}

/**
 * Helper: Get file extension for syntax highlighting
 */
export function getFileExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'text';
  
  // Map common extensions to language identifiers
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'py': 'python',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'c',
    'java': 'java',
    'css': 'css',
    'html': 'html',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
  };
  
  return langMap[ext] || ext;
}

/**
 * Classify user message intent (question vs task vs status)
 */
export function classifyConversationIntent(message: string): ConversationIntent {
  const lowerMsg = message.toLowerCase();

  // Questions: user wants info, not work
  if (lowerMsg.match(/^(can|could|do|does|is|are|will|would|should|how|what|why|when|where)/)) {
    return 'question';
  }

  // Status checks
  if (lowerMsg.match(/(status|done|finished|complete|progress|working)/)) {
    return 'status';
  }

  // Everything else is a task
  return 'task';
}

/**
 * Detect complexity of user request
 */
async function detectMessageComplexity(message: string): Promise<ComplexityResult> {
  const { detectComplexity } = await import('../../../complexity-detection.ts');
  return detectComplexity(message);
}

/**
 * MAIN FUNCTION: Prepare AI context for streaming response
 * 
 * This function handles all context preparation logic:
 * - Loads conversation history (last 5 messages)
 * - Builds conversation messages with attachment support
 * - Gets code scratchpad for continuity
 * - Classifies user intent (question/task/status)
 * - Detects complexity and determines extended thinking
 * - Builds system prompt with platform context
 * - Filters tools based on autonomy level
 * - Handles casual conversation short-circuit
 * - Detects defibrillator prompts
 */
export async function prepareAIContext(
  params: PrepareAIContextParams
): Promise<AIContextResult> {
  const {
    userId,
    conversationStateId,
    message,
    attachments,
    userMessageId,
    autonomyLevel,
    autoCommit,
    autoPush,
    extendedThinking,
    sendEvent,
  } = params;

  // ============================================================================
  // STEP 1: LOAD CONVERSATION HISTORY
  // ============================================================================
  // 🧠 ULTRA-MINIMAL MEMORY: Load last 5 messages only (saves ~5K tokens)
  const history = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.isPlatformHealing, true)
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(5); // ⚡ REDUCED FROM 10 - Saves another 5K tokens!

  // Reverse to chronological order (oldest → newest)
  history.reverse();

  // ============================================================================
  // STEP 2: BUILD CONVERSATION MESSAGES
  // ============================================================================
  // Build conversation for AI model
  // ✅ PHASE 3: Include validationMetadata for tool results (for UI/downstream consumers)
  const conversationMessages: any[] = history
    .filter(msg => msg.id !== userMessageId) // Exclude the message we just added
    .map(msg => {
      const msgObj: any = {
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      };
      
      // Preserve validation metadata if present (for tool result messages)
      if (msg.validationMetadata) {
        msgObj.validationMetadata = msg.validationMetadata;
      }
      
      // Preserve tool name if this is a tool result message
      if (msg.toolName) {
        msgObj.toolName = msg.toolName;
      }
      
      return msgObj;
    });

  // ============================================================================
  // STEP 3: PROCESS ATTACHMENTS
  // ============================================================================
  // Add current user message with attachments
  let userMessageContent: any = message;

  // If attachments exist, build multimodal content
  if (attachments && attachments.length > 0) {
    const contentBlocks: any[] = [];

    // Add text message first
    contentBlocks.push({
      type: 'text',
      text: message,
    });

    // Add attachments
    for (const att of attachments) {
      if (att.fileType === 'image') {
        // Use Vision API for images
        // Extract base64 data and mime type from data URL
        const base64Match = att.content.match(/^data:(.+);base64,(.+)$/);
        if (base64Match) {
          const [, mimeType, base64Data] = base64Match;
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Data,
            },
          });
        }
      } else {
        // Add text files (code, logs, text) as text blocks
        contentBlocks.push({
          type: 'text',
          text: `\n\n**Attached file: ${att.fileName}** (${att.fileType}):\n\`\`\`${att.fileType === 'code' ? getFileExtension(att.fileName) : att.fileType}\n${att.content}\n\`\`\``,
        });
      }
    }

    userMessageContent = contentBlocks;
  }

  conversationMessages.push({
    role: 'user',
    content: userMessageContent,
  });

  // ============================================================================
  // STEP 4: CLASSIFY INTENT
  // ============================================================================
  // Classify conversation intent (question vs task vs status)
  const conversationIntent = classifyConversationIntent(message);

  // Classify user intent for iteration limits (build vs fix vs diagnostic vs casual)
  const userIntent = classifyUserIntent(message);
  const maxIterations = getMaxIterationsForIntent(userIntent);

  console.log(`[INTENT-CLASSIFICATION] User intent: ${userIntent}, conversation intent: ${conversationIntent}, max iterations: ${maxIterations}`);

  // ============================================================================
  // STEP 5: LOAD CONVERSATION STATE & SCRATCHPAD
  // ============================================================================
  // Get fresh conversation state (may have been updated)
  const [conversationState] = await db
    .select()
    .from(conversationStates)
    .where(eq(conversationStates.id, conversationStateId))
    .limit(1);

  if (!conversationState) {
    throw new Error('Conversation state not found');
  }

  // Format conversation context for AI injection (with replit.md)
  const contextPrompt = await formatStateForPrompt(conversationState);

  // 🔄 GET CODE SCRATCHPAD (Reference previous working code)
  // Retrieve last verified code to provide continuity for modifications
  const lastVerifiedCode = await getCodeScratchpad(conversationStateId);
  const scratchpadContext = lastVerifiedCode 
    ? `\n\n📋 LAST VERIFIED CODE (from scratchpad):\n\`\`\`\n${lastVerifiedCode}\n\`\`\`\n\nThis is code that previously worked. Reference this when making modifications to maintain continuity.`
    : '';
  
  const enhancedContextPrompt = contextPrompt + scratchpadContext;

  // ============================================================================
  // STEP 6: COMPLEXITY DETECTION & RUN CONFIGURATION
  // ============================================================================
  // 🧠 COMPLEXITY DETECTION: Determine if extended thinking is needed (heuristic)
  const complexityResult = await detectMessageComplexity(message);
  
  // Map complexity level to numeric score
  const complexityScoreMap: Record<string, number> = { 
    simple: 0.25, medium: 0.5, complex: 0.75, enterprise: 1.0 
  };
  const complexityScore = complexityScoreMap[complexityResult.level] || 0.5;
  
  // Heuristic: Enable extended thinking for complex tasks (can be overridden later)
  const shouldEnableThinking = ['build', 'fix'].includes(userIntent) && (
    message.length >= 200 || complexityScore >= 0.6
  );
  
  // ✅ Store config values in mutable variables (finalized later)
  const finalExtendedThinking = extendedThinking ?? shouldEnableThinking;
  const finalAutoCommit = autoCommit;
  const finalAutoPush = autoPush;
  const finalAutonomyLevel = autonomyLevel;
  
  // 🏗️ FUTURE: Architect consultation or autoplan logic can modify these variables here
  // Example: if (shouldConsultArchitect) { finalExtendedThinking = await architect.recommend(); }
  
  const runConfig: RunConfigGovernance = {
    finalExtendedThinking,
    finalAutoCommit,
    finalAutoPush,
    finalAutonomyLevel,
    finalMaxTokens: 8000, // Default token limit per iteration
    userIntent,
    complexityLevel: complexityResult.level,
    complexityScore,
    messageLength: message.length,
    manualOverride: extendedThinking !== undefined,
    heuristicSuggestion: shouldEnableThinking,
  };
  
  console.log(`[LOMU-AI][RUN-CONFIG] Initial heuristics computed:`, runConfig);

  // ============================================================================
  // STEP 7: BUILD SYSTEM PROMPT
  // ============================================================================
  // ✅ FIX #1: Use casual prompt when casual intent detected (no tools/diagnostics)
  const systemPrompt = userIntent === 'casual'
    ? buildCasualConversationPrompt()
    : buildBeeHiveSuperCorePrompt({
        platform: 'BeeHive - React+Express+PostgreSQL on Railway',
        autoCommit: finalAutoCommit,
        intent: conversationIntent,
        contextPrompt: enhancedContextPrompt,
        userMessage: message,
        autonomyLevel: finalAutonomyLevel,
        extendedThinking: finalExtendedThinking,
      });

  // ============================================================================
  // STEP 8: TOOL FILTERING & AUTONOMY LEVELS
  // ============================================================================
  // ⚡ GOOGLE GEMINI OPTIMIZED: Use LOMU_CORE_TOOLS (21 tools optimized for Gemini)
  let availableTools = LOMU_CORE_TOOLS;

  // 🎯 AUTONOMY LEVEL FILTERING: Filter tools based on user's autonomy level
  if (autonomyLevel === 'basic') {
    // Basic: NO subagents, NO web search (only restricted tools in LOMU_CORE_TOOLS)
    availableTools = LOMU_CORE_TOOLS.filter(tool => 
      tool.name !== 'start_subagent' && 
      tool.name !== 'web_search'
    );
    console.log(`[TOOL-FILTERING] Basic autonomy level - filtered to ${availableTools.length} tools`);
  } else {
    // Standard/Deep/Max: ALL tools in LOMU_CORE_TOOLS ✅
    console.log(`[TOOL-FILTERING] ${autonomyLevel} autonomy level - using all ${availableTools.length} tools`);
  }

  // ============================================================================
  // STEP 9: DEFIBRILLATOR PROMPT DETECTION
  // ============================================================================
  // 🚨 DEFIBRILLATOR PROMPT DETECTION: Emergency escape from read-eval-no-write loops
  // Detects special "override" messages that force BeeHive out of analysis paralysis
  const isDefibrillatorPrompt = /🔴.*SYSTEM.*OVERRIDE|STOP.*READING|FORCE.*WRITE|emergency.*override/i.test(message);
  
  if (isDefibrillatorPrompt) {
    console.log('[DEFIBRILLATOR] 🚨 Emergency override detected - clearing caches and forcing write mode');
    
    // Clear conversation state caches to prevent stale analysis
    try {
      await clearCodeScratchpad(conversationStateId);
      console.log('[DEFIBRILLATOR] ✅ Cleared code scratchpad');
    } catch (error) {
      console.warn('[DEFIBRILLATOR] ⚠️ Failed to clear scratchpad:', error);
    }
    
    sendEvent('system_info', { 
      message: '🚨 EMERGENCY MODE: Analysis mode disabled. Forcing write operations.' 
    });
  }

  // ============================================================================
  // STEP 10: CASUAL CONVERSATION SHORT-CIRCUIT
  // ============================================================================
  // 🗨️ CASUAL INTENT SHORT-CIRCUIT: Prevent tool loading for casual messages
  // When user sends greetings/casual messages like "hello", "hi", "thanks", etc.
  // we should respond conversationally WITHOUT loading tools or running diagnostics
  let isCasualConversation = false;
  
  if (userIntent === 'casual') {
    console.log(`[CASUAL-SHORT-CIRCUIT] ✅ Casual message detected - clearing tools AND history to force conversational response`);
    availableTools = []; // Empty tools array forces AI to respond conversationally
    isCasualConversation = true;
    
    // 🔥 CRITICAL FIX: Clear conversation history to prevent continuing previous work
    // Solution: Clear entire conversation history and only send current greeting
    // This creates a clean context break
    const currentUserMessage = conversationMessages[conversationMessages.length - 1];
    conversationMessages.length = 0; // Clear all history
    conversationMessages.push(currentUserMessage); // Keep only current greeting
    
    console.log(`[CASUAL-SHORT-CIRCUIT] 🧹 Cleared conversation history - only current message remains`);
  }

  // ============================================================================
  // RETURN PREPARED CONTEXT
  // ============================================================================
  return {
    conversationMessages,
    systemPrompt,
    tools: availableTools,
    userIntent,
    conversationIntent,
    runConfig,
    maxIterations,
    isCasualConversation,
    isDefibrillatorPrompt,
  };
}

/**
 * Helper: Replace system prompt for casual conversation
 * Returns a lightweight conversational prompt without technical instructions
 */
export function buildCasualConversationPrompt(): string {
  return `You are Lomu, a friendly AI assistant that helps developers with their software projects.

The user has sent you a casual message (greeting, acknowledgment, or simple question).

Respond naturally and conversationally. Be friendly and helpful, but keep it brief.

Examples:
- User: "hi" → You: "Hey! How can I help you today?"
- User: "thanks" → You: "You're welcome! Let me know if you need anything else."
- User: "how are you?" → You: "I'm doing great, thanks for asking! Ready to help with any coding tasks you have."

Keep your response short (1-2 sentences) and natural.`;
}
