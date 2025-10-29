/**
 * Anthropic API Wrapper with Context Window Management
 * 
 * This module provides robust wrapper functions for calling the Anthropic API
 * with automatic token estimation, input truncation, and context limit handling.
 * 
 * Features:
 * - Token estimation for input text
 * - Automatic truncation when input exceeds context limits
 * - Dynamic max_tokens adjustment to fit within context window
 * - Retry logic for context-limit errors
 * 
 * Environment Variables:
 * - ANTHROPIC_API_KEY: Required API key
 * - ANTHROPIC_DEFAULT_MODEL: Default model (default: claude-sonnet-4-20250514)
 * - ANTHROPIC_DEFAULT_MAX_TOKENS: Default max tokens for responses (default: 8000)
 * - ANTHROPIC_CONTEXT_LIMIT: Model context limit (default: 200000)
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Configuration & Constants
// ============================================================================

const DEFAULT_MODEL = process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = parseInt(process.env.ANTHROPIC_DEFAULT_MAX_TOKENS || '8000', 10);
const CONTEXT_LIMIT = parseInt(process.env.ANTHROPIC_CONTEXT_LIMIT || '200000', 10);

// Safety margin to account for estimation errors (5%)
const SAFETY_MARGIN = 0.05;
const EFFECTIVE_CONTEXT_LIMIT = Math.floor(CONTEXT_LIMIT * (1 - SAFETY_MARGIN));

// Minimum max_tokens to ensure useful responses
const MIN_MAX_TOKENS = 1000;

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate the number of tokens in a text string.
 * 
 * Uses a simple heuristic: ~4 characters per token on average for English text.
 * This is a conservative estimate that works well for the Anthropic models.
 * 
 * @param text - The text to estimate tokens for
 * @returns Estimated number of tokens
 */
export function estimateTokensFromText(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  // Conservative estimate: 4 characters per token
  // This accounts for both English text and code
  const chars = text.length;
  const estimatedTokens = Math.ceil(chars / 4);
  
  return estimatedTokens;
}

/**
 * Truncate text to fit within a specified token budget.
 * 
 * Truncates from the middle to preserve both the beginning (context)
 * and end (recent messages) of the conversation.
 * 
 * @param text - The text to truncate
 * @param allowedTokens - Maximum number of tokens allowed
 * @returns Truncated text
 */
export function truncateTextByTokens(text: string, allowedTokens: number): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const currentTokens = estimateTokensFromText(text);
  
  // If text already fits, return as-is
  if (currentTokens <= allowedTokens) {
    return text;
  }
  
  // Calculate how many characters we can keep
  const allowedChars = Math.floor(allowedTokens * 4);
  
  if (allowedChars < 100) {
    // Text is too long, return just the start
    return text.slice(0, 100) + '\n\n[... truncated due to length ...]';
  }
  
  // Truncate from the middle, keeping start and end
  const keepStart = Math.floor(allowedChars * 0.3);
  const keepEnd = Math.floor(allowedChars * 0.3);
  const ellipsis = '\n\n[... middle section truncated to fit context window ...]\n\n';
  
  const truncated = text.slice(0, keepStart) + ellipsis + text.slice(-keepEnd);
  
  return truncated;
}

/**
 * Truncate an array of messages to fit within token budget.
 * Keeps the first message (system context) and most recent messages.
 * 
 * @param messages - Array of conversation messages
 * @param allowedTokens - Maximum tokens allowed for all messages
 * @returns Truncated messages array
 */
function truncateMessages(messages: any[], allowedTokens: number): any[] {
  if (!messages || messages.length === 0) {
    return [];
  }
  
  // Always keep first message if it exists (usually system/context)
  const result: any[] = [];
  let currentTokens = 0;
  
  // Add messages from most recent backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageText = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content);
    const messageTokens = estimateTokensFromText(messageText);
    
    if (currentTokens + messageTokens <= allowedTokens) {
      result.unshift(message);
      currentTokens += messageTokens;
    } else if (result.length === 0) {
      // If first message is too large, truncate it
      const truncatedContent = truncateTextByTokens(messageText, allowedTokens);
      result.unshift({
        ...message,
        content: truncatedContent,
      });
      break;
    } else {
      // We've filled our budget
      break;
    }
  }
  
  return result;
}

// ============================================================================
// Anthropic API Wrapper
// ============================================================================

export interface CallAnthropicOptions {
  input: string | any[];  // Single string or array of messages
  model?: string;
  maxTokens?: number;
  system?: string;
  tools?: any[];
  temperature?: number;
  stream?: boolean;
}

export interface CallAnthropicResult {
  success: boolean;
  response?: any;  // Anthropic SDK response
  error?: string;
  truncated?: boolean;
  originalTokens?: number;
  finalTokens?: number;
  adjustedMaxTokens?: number;
}

/**
 * Call Anthropic API with automatic context window management.
 * 
 * This wrapper:
 * 1. Estimates token count for input
 * 2. Truncates input if it exceeds context limits
 * 3. Adjusts max_tokens to fit within context window
 * 4. Retries once if a context-limit error occurs
 * 
 * @param options - Configuration options for the API call
 * @returns Result object with response or error information
 */
export async function callAnthropic(options: CallAnthropicOptions): Promise<CallAnthropicResult> {
  const {
    input,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    system = '',
    tools = [],
    temperature = 1.0,
    stream = false,
  } = options;
  
  // Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'dummy-key-for-development') {
    return {
      success: false,
      error: 'ANTHROPIC_API_KEY is not configured',
    };
  }
  
  const client = new Anthropic({ apiKey });
  
  // Normalize input to messages array
  let messages: any[];
  if (typeof input === 'string') {
    messages = [{ role: 'user', content: input }];
  } else if (Array.isArray(input)) {
    messages = input;
  } else {
    return {
      success: false,
      error: 'Invalid input format: must be string or array of messages',
    };
  }
  
  // Estimate tokens
  const systemTokens = estimateTokensFromText(system);
  const messagesText = messages
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .join('\n');
  const messagesTokens = estimateTokensFromText(messagesText);
  const toolsTokens = estimateTokensFromText(JSON.stringify(tools));
  
  const totalInputTokens = systemTokens + messagesTokens + toolsTokens;
  const originalTotalTokens = totalInputTokens;
  
  // Check if we need to truncate or adjust
  let finalMessages = messages;
  let finalMaxTokens = maxTokens;
  let wasTruncated = false;
  
  const totalRequestedTokens = totalInputTokens + maxTokens;
  
  if (totalRequestedTokens > EFFECTIVE_CONTEXT_LIMIT) {
    console.warn('[AnthropicWrapper] Context limit would be exceeded:', {
      totalInputTokens,
      maxTokens,
      total: totalRequestedTokens,
      limit: EFFECTIVE_CONTEXT_LIMIT,
    });
    
    // Strategy 1: Reduce max_tokens first
    const availableForOutput = EFFECTIVE_CONTEXT_LIMIT - totalInputTokens;
    if (availableForOutput >= MIN_MAX_TOKENS) {
      finalMaxTokens = Math.min(maxTokens, availableForOutput);
      console.log(`[AnthropicWrapper] Reduced max_tokens from ${maxTokens} to ${finalMaxTokens}`);
    } else {
      // Strategy 2: Truncate messages AND reduce max_tokens
      const targetInputTokens = EFFECTIVE_CONTEXT_LIMIT - MIN_MAX_TOKENS;
      const availableForMessages = targetInputTokens - systemTokens - toolsTokens;
      
      finalMessages = truncateMessages(messages, availableForMessages);
      finalMaxTokens = MIN_MAX_TOKENS;
      wasTruncated = true;
      
      console.log(`[AnthropicWrapper] Truncated messages from ${messagesTokens} to ~${availableForMessages} tokens`);
      console.log(`[AnthropicWrapper] Reduced max_tokens to ${finalMaxTokens}`);
    }
  }
  
  // Build API request
  const requestParams: any = {
    model,
    max_tokens: finalMaxTokens,
    messages: finalMessages,
    temperature,
  };
  
  if (system) {
    requestParams.system = system;
  }
  
  if (tools && tools.length > 0) {
    requestParams.tools = tools;
  }
  
  // Make the API call with retry logic
  let attempt = 0;
  const maxAttempts = 2;
  
  while (attempt < maxAttempts) {
    attempt++;
    
    try {
      let response: any;
      
      if (stream) {
        // For streaming, return the stream object
        response = await client.messages.stream(requestParams);
      } else {
        // For non-streaming, return the complete message
        response = await client.messages.create(requestParams);
      }
      
      const finalInputTokens = systemTokens + estimateTokensFromText(
        finalMessages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n')
      ) + toolsTokens;
      
      return {
        success: true,
        response,
        truncated: wasTruncated,
        originalTokens: originalTotalTokens,
        finalTokens: finalInputTokens,
        adjustedMaxTokens: finalMaxTokens !== maxTokens ? finalMaxTokens : undefined,
      };
      
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      
      // Check if it's a context limit error
      const isContextError = 
        errorMessage.includes('context limit') ||
        errorMessage.includes('context window') ||
        (error.status === 400 && errorMessage.includes('max_tokens'));
      
      if (isContextError && attempt < maxAttempts) {
        console.warn(`[AnthropicWrapper] Context limit error on attempt ${attempt}, retrying with more aggressive truncation...`);
        
        // More aggressive truncation for retry
        const retryTargetInputTokens = EFFECTIVE_CONTEXT_LIMIT - MIN_MAX_TOKENS;
        const retryAvailableForMessages = Math.floor((retryTargetInputTokens - systemTokens - toolsTokens) * 0.8);
        
        finalMessages = truncateMessages(messages, retryAvailableForMessages);
        requestParams.messages = finalMessages;
        requestParams.max_tokens = MIN_MAX_TOKENS;
        wasTruncated = true;
        
        // Continue to next attempt
        continue;
      }
      
      // Non-retryable error or max attempts reached
      return {
        success: false,
        error: errorMessage,
        truncated: wasTruncated,
        originalTokens: originalTotalTokens,
      };
    }
  }
  
  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    error: 'Max retry attempts reached',
    truncated: wasTruncated,
    originalTokens: originalTotalTokens,
  };
}

// ============================================================================
// AnthropicWrapper Class (for OOP usage)
// ============================================================================

export class AnthropicWrapper {
  private client: Anthropic;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private contextLimit: number;
  
  constructor(options?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    contextLimit?: number;
  }) {
    const apiKey = options?.apiKey || process.env.ANTHROPIC_API_KEY || 'dummy-key-for-development';
    this.client = new Anthropic({ apiKey });
    this.defaultModel = options?.model || DEFAULT_MODEL;
    this.defaultMaxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;
    this.contextLimit = options?.contextLimit || CONTEXT_LIMIT;
  }
  
  /**
   * Estimate tokens in text
   */
  estimateTokens(text: string): number {
    return estimateTokensFromText(text);
  }
  
  /**
   * Truncate text to fit token budget
   */
  truncateText(text: string, allowedTokens: number): string {
    return truncateTextByTokens(text, allowedTokens);
  }
  
  /**
   * Call Anthropic API with context management
   */
  async call(options: CallAnthropicOptions): Promise<CallAnthropicResult> {
    return callAnthropic({
      model: this.defaultModel,
      maxTokens: this.defaultMaxTokens,
      ...options,
    });
  }
}

// ============================================================================
// Named Exports for Constants
// ============================================================================

export {
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  CONTEXT_LIMIT,
  EFFECTIVE_CONTEXT_LIMIT,
  MIN_MAX_TOKENS,
};
