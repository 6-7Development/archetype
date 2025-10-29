/**
 * Anthropic Context-Limit Protection
 * 
 * Prevents 400 errors from exceeding Claude's 200K token limit by:
 * 1. Estimating token counts for all context (messages + system prompt + attachments)
 * 2. Truncating older messages when approaching limit
 * 3. Maintaining 25K token safety margin (175K max)
 * 4. Iteratively dropping messages until under limit (no hard minimum)
 * 5. Final guard throws error if unable to reduce below limit
 */

import { MessageParam } from '@anthropic-ai/sdk/resources/messages';

// More conservative token estimation: ~3 characters = 1 token
// (Claude often uses more tokens than 4 chars/token estimate)
const CHARS_PER_TOKEN = 3;

// Anthropic limits with larger safety margin
const ANTHROPIC_MAX_TOKENS = 200000;
const SAFETY_MARGIN = 25000; // 25K buffer for safety
const MAX_CONTEXT_TOKENS = ANTHROPIC_MAX_TOKENS - SAFETY_MARGIN; // 175K

// Message preservation strategy - prefer keeping recent but not at cost of exceeding limit
const MIN_RECENT_MESSAGES = 5; // Prefer to keep at least 5, but will drop further if needed
const MAX_ATTACHMENT_SIZE = 50000; // Max chars per attachment (~16.7K tokens with 3 chars/token)

interface MessageContent {
  type: string;
  text?: string;
  source?: any;
  [key: string]: any;
}

interface TruncationResult {
  messages: MessageParam[];
  systemPrompt: string;
  estimatedTokens: number;
  truncated: boolean;
  removedMessages: number;
  originalTokens: number;
}

/**
 * Estimate token count for a string (conservative)
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for message content (handles both string and multimodal)
 */
function estimateMessageTokens(content: string | MessageContent[]): number {
  if (typeof content === 'string') {
    return estimateTokens(content);
  }

  // Multimodal content (array of blocks)
  let totalTokens = 0;
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      totalTokens += estimateTokens(block.text);
    } else if (block.type === 'image') {
      // Images cost ~1270 tokens for vision API (Claude's base cost)
      totalTokens += 1270;
    } else if (block.source && block.source.data) {
      // Base64 encoded data - estimate from length
      totalTokens += Math.ceil(block.source.data.length / (CHARS_PER_TOKEN * 1.5));
    }
  }
  return totalTokens;
}

/**
 * Truncate large text attachments in message content
 */
function truncateAttachments(content: MessageContent[]): MessageContent[] {
  return content.map(block => {
    if (block.type === 'text' && block.text && block.text.length > MAX_ATTACHMENT_SIZE) {
      const lines = block.text.split('\n');
      if (lines.length > 200) {
        // Keep first 100 and last 100 lines
        const truncatedLines = [
          ...lines.slice(0, 100),
          '\n... [TRUNCATED ' + (lines.length - 200) + ' lines] ...\n',
          ...lines.slice(-100)
        ];
        return {
          ...block,
          text: truncatedLines.join('\n')
        };
      } else {
        // Just truncate to character limit
        return {
          ...block,
          text: block.text.substring(0, MAX_ATTACHMENT_SIZE) + '\n\n... [TRUNCATED]'
        };
      }
    }
    return block;
  });
}

/**
 * Create safe Anthropic request with context-limit protection
 * 
 * @param messages - Conversation messages (chronological order)
 * @param systemPrompt - System prompt
 * @returns Truncated messages and system prompt with token estimates
 */
export function createSafeAnthropicRequest(
  messages: MessageParam[],
  systemPrompt: string
): TruncationResult {
  
  // Step 1: Calculate original token counts
  const systemTokens = estimateTokens(systemPrompt);
  const messageTokens = messages.map(msg => ({
    msg,
    tokens: estimateMessageTokens(msg.content)
  }));
  
  const originalMessageTokens = messageTokens.reduce((sum, m) => sum + m.tokens, 0);
  const originalTotalTokens = systemTokens + originalMessageTokens;
  
  console.log('[ANTHROPIC-WRAPPER] Original context size:');
  console.log(`  - System prompt: ${systemTokens.toLocaleString()} tokens`);
  console.log(`  - Messages: ${messageTokens.length} messages, ${originalMessageTokens.toLocaleString()} tokens`);
  console.log(`  - Total: ${originalTotalTokens.toLocaleString()} tokens`);
  console.log(`  - Limit: ${MAX_CONTEXT_TOKENS.toLocaleString()} tokens (${SAFETY_MARGIN.toLocaleString()}K safety margin)`);
  
  // Step 2: Check if we're within limits
  if (originalTotalTokens <= MAX_CONTEXT_TOKENS) {
    console.log(`[ANTHROPIC-WRAPPER] ✅ Within limits (${originalTotalTokens.toLocaleString()} / ${MAX_CONTEXT_TOKENS.toLocaleString()} tokens)`);
    console.log(`[ANTHROPIC-WRAPPER] Safety margin: ${(MAX_CONTEXT_TOKENS - originalTotalTokens).toLocaleString()} tokens remaining`);
    return {
      messages,
      systemPrompt,
      estimatedTokens: originalTotalTokens,
      truncated: false,
      removedMessages: 0,
      originalTokens: originalTotalTokens
    };
  }
  
  console.log(`[ANTHROPIC-WRAPPER] ⚠️ OVER LIMIT: ${originalTotalTokens.toLocaleString()} tokens exceeds ${MAX_CONTEXT_TOKENS.toLocaleString()}`);
  console.log(`[ANTHROPIC-WRAPPER] Over by: ${(originalTotalTokens - MAX_CONTEXT_TOKENS).toLocaleString()} tokens`);
  console.log('[ANTHROPIC-WRAPPER] Starting truncation process...');
  
  // Step 3: Truncate attachments first (non-destructive for message count)
  const messagesWithTruncatedAttachments = messages.map(msg => {
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: truncateAttachments(msg.content)
      };
    }
    return msg;
  });
  
  const attachmentTruncatedTokens = messagesWithTruncatedAttachments.map(msg => ({
    msg,
    tokens: estimateMessageTokens(msg.content)
  }));
  
  const messageTokensAfterAttachments = attachmentTruncatedTokens.reduce((sum, m) => sum + m.tokens, 0);
  const tokensAfterAttachmentTruncation = systemTokens + messageTokensAfterAttachments;
  
  console.log(`[ANTHROPIC-WRAPPER] After attachment truncation:`);
  console.log(`  - Messages: ${messageTokensAfterAttachments.toLocaleString()} tokens`);
  console.log(`  - Total: ${tokensAfterAttachmentTruncation.toLocaleString()} tokens`);
  
  // Step 4: If still over limit, iteratively remove older messages
  if (tokensAfterAttachmentTruncation <= MAX_CONTEXT_TOKENS) {
    console.log('[ANTHROPIC-WRAPPER] ✅ Attachment truncation successful');
    console.log(`[ANTHROPIC-WRAPPER] Safety margin: ${(MAX_CONTEXT_TOKENS - tokensAfterAttachmentTruncation).toLocaleString()} tokens remaining`);
    return {
      messages: messagesWithTruncatedAttachments as MessageParam[],
      systemPrompt,
      estimatedTokens: tokensAfterAttachmentTruncation,
      truncated: true,
      removedMessages: 0,
      originalTokens: originalTotalTokens
    };
  }
  
  console.log('[ANTHROPIC-WRAPPER] Still over limit after attachment truncation');
  console.log('[ANTHROPIC-WRAPPER] Iteratively removing oldest messages until under limit...');
  
  // Iteratively drop messages from the beginning until under limit
  let messagesToKeep = messagesWithTruncatedAttachments.length;
  let currentMessages = messagesWithTruncatedAttachments;
  let currentMessageTokens = messageTokensAfterAttachments;
  let currentTotalTokens = tokensAfterAttachmentTruncation;
  
  // First, try to keep at least MIN_RECENT_MESSAGES
  while (currentTotalTokens > MAX_CONTEXT_TOKENS && messagesToKeep > MIN_RECENT_MESSAGES) {
    messagesToKeep--;
    currentMessages = messagesWithTruncatedAttachments.slice(-messagesToKeep);
    currentMessageTokens = currentMessages.reduce((sum, msg) => sum + estimateMessageTokens(msg.content), 0);
    currentTotalTokens = systemTokens + currentMessageTokens;
    
    console.log(`[ANTHROPIC-WRAPPER] Trying ${messagesToKeep} messages: ${currentTotalTokens.toLocaleString()} tokens`);
  }
  
  // If still over limit, drop below MIN_RECENT_MESSAGES (prioritize staying under limit)
  if (currentTotalTokens > MAX_CONTEXT_TOKENS) {
    console.log(`[ANTHROPIC-WRAPPER] ⚠️ Still over limit with ${MIN_RECENT_MESSAGES} messages`);
    console.log('[ANTHROPIC-WRAPPER] Dropping below minimum threshold...');
    
    while (currentTotalTokens > MAX_CONTEXT_TOKENS && messagesToKeep > 1) {
      messagesToKeep--;
      currentMessages = messagesWithTruncatedAttachments.slice(-messagesToKeep);
      currentMessageTokens = currentMessages.reduce((sum, msg) => sum + estimateMessageTokens(msg.content), 0);
      currentTotalTokens = systemTokens + currentMessageTokens;
      
      console.log(`[ANTHROPIC-WRAPPER] ⚠️ Below MIN threshold, trying ${messagesToKeep} messages: ${currentTotalTokens.toLocaleString()} tokens`);
    }
  }
  
  const removedCount = messagesWithTruncatedAttachments.length - messagesToKeep;
  
  console.log(`[ANTHROPIC-WRAPPER] After message truncation:`);
  console.log(`  - Removed ${removedCount} older messages`);
  console.log(`  - Kept ${currentMessages.length} recent messages`);
  console.log(`  - Messages: ${currentMessageTokens.toLocaleString()} tokens`);
  console.log(`  - System: ${systemTokens.toLocaleString()} tokens`);
  console.log(`  - Total: ${currentTotalTokens.toLocaleString()} tokens`);
  
  // FINAL GUARD: Throw error if still over limit
  if (currentTotalTokens > MAX_CONTEXT_TOKENS) {
    console.error('[ANTHROPIC-WRAPPER] ❌ CRITICAL ERROR: Cannot reduce context below limit');
    console.error(`[ANTHROPIC-WRAPPER] Current: ${currentTotalTokens.toLocaleString()} tokens`);
    console.error(`[ANTHROPIC-WRAPPER] Limit: ${MAX_CONTEXT_TOKENS.toLocaleString()} tokens`);
    console.error(`[ANTHROPIC-WRAPPER] Over by: ${(currentTotalTokens - MAX_CONTEXT_TOKENS).toLocaleString()} tokens`);
    console.error(`[ANTHROPIC-WRAPPER] Messages remaining: ${currentMessages.length}`);
    console.error(`[ANTHROPIC-WRAPPER] System prompt: ${systemTokens.toLocaleString()} tokens`);
    console.error(`[ANTHROPIC-WRAPPER] Message tokens: ${currentMessageTokens.toLocaleString()} tokens`);
    
    throw new Error(
      `Cannot reduce context below ${MAX_CONTEXT_TOKENS.toLocaleString()} tokens. ` +
      `Current: ${currentTotalTokens.toLocaleString()} tokens with ${currentMessages.length} messages. ` +
      `System prompt alone is ${systemTokens.toLocaleString()} tokens. ` +
      `Consider reducing system prompt size or using a different model.`
    );
  }
  
  console.log(`[ANTHROPIC-WRAPPER] ✅ Successfully reduced context to ${currentTotalTokens.toLocaleString()} tokens`);
  console.log(`[ANTHROPIC-WRAPPER] Safety margin: ${(MAX_CONTEXT_TOKENS - currentTotalTokens).toLocaleString()} tokens remaining`);
  
  return {
    messages: currentMessages as MessageParam[],
    systemPrompt,
    estimatedTokens: currentTotalTokens,
    truncated: true,
    removedMessages: removedCount,
    originalTokens: originalTotalTokens
  };
}

/**
 * Log truncation results to console with visual formatting
 */
export function logTruncationResults(result: TruncationResult): void {
  if (!result.truncated) {
    console.log('[ANTHROPIC-WRAPPER] ═══════════════════════════════════════');
    console.log('[ANTHROPIC-WRAPPER] ✅ NO TRUNCATION NEEDED');
    console.log('[ANTHROPIC-WRAPPER] ═══════════════════════════════════════');
    console.log(`[ANTHROPIC-WRAPPER] Total tokens: ${result.estimatedTokens.toLocaleString()} / ${MAX_CONTEXT_TOKENS.toLocaleString()}`);
    console.log(`[ANTHROPIC-WRAPPER] Safety margin: ${(MAX_CONTEXT_TOKENS - result.estimatedTokens).toLocaleString()} tokens`);
    return;
  }
  
  console.log('[ANTHROPIC-WRAPPER] ═══════════════════════════════════════');
  console.log('[ANTHROPIC-WRAPPER] ⚠️ CONTEXT TRUNCATED');
  console.log('[ANTHROPIC-WRAPPER] ═══════════════════════════════════════');
  console.log(`[ANTHROPIC-WRAPPER] Original tokens: ${result.originalTokens.toLocaleString()}`);
  console.log(`[ANTHROPIC-WRAPPER] Final tokens: ${result.estimatedTokens.toLocaleString()}`);
  console.log(`[ANTHROPIC-WRAPPER] Saved: ${(result.originalTokens - result.estimatedTokens).toLocaleString()} tokens (${Math.round((result.originalTokens - result.estimatedTokens) / result.originalTokens * 100)}%)`);
  console.log(`[ANTHROPIC-WRAPPER] Messages removed: ${result.removedMessages}`);
  console.log(`[ANTHROPIC-WRAPPER] Safety margin: ${(MAX_CONTEXT_TOKENS - result.estimatedTokens).toLocaleString()} tokens`);
  console.log('[ANTHROPIC-WRAPPER] ═══════════════════════════════════════');
}
