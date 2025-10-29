/**
 * Anthropic API Wrapper with Context Management
 * 
 * Provides robust wrappers around Anthropic API calls with:
 * - Token estimation for inputs
 * - Automatic text truncation to fit context windows
 * - Retry logic on context-limit errors
 * - Environment variable configuration
 * 
 * Solves: "input length and `max_tokens` exceed context limit: 196601 + 16000 > 200000"
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Configuration from Environment Variables
// ============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_DEFAULT_MODEL = process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-20250514';
const ANTHROPIC_DEFAULT_MAX_TOKENS = parseInt(process.env.ANTHROPIC_DEFAULT_MAX_TOKENS || '4096', 10);

// Model-specific context limits (tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-sonnet-4-20250514': 200000,
  'claude-3-7-sonnet-20250219': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-sonnet-20240620': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
};

// Get context limit for a model, with fallback
function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] || parseInt(process.env.ANTHROPIC_CONTEXT_LIMIT || '200000', 10);
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count from text
 * 
 * Uses a conservative character-to-token ratio for English text.
 * Claude's tokenizer averages ~3.5 characters per token.
 * We use 3.0 to be conservative (overestimate tokens).
 * 
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokensFromText(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  // Conservative estimate: 3 characters per token
  // This tends to overestimate, which is safer for context limits
  const CHARS_PER_TOKEN = 3.0;
  
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for structured message content
 * Handles text blocks, tool use blocks, and tool result blocks
 */
function estimateTokensFromContent(content: any): number {
  if (typeof content === 'string') {
    return estimateTokensFromText(content);
  }
  
  if (Array.isArray(content)) {
    return content.reduce((total, block) => {
      if (block.type === 'text' && block.text) {
        return total + estimateTokensFromText(block.text);
      } else if (block.type === 'tool_use') {
        // Tool use: name + input JSON
        const toolText = block.name + JSON.stringify(block.input || {});
        return total + estimateTokensFromText(toolText);
      } else if (block.type === 'tool_result') {
        // Tool result: content
        return total + estimateTokensFromText(String(block.content || ''));
      }
      return total;
    }, 0);
  }
  
  return 0;
}

/**
 * Estimate total tokens in a messages array
 */
function estimateTokensFromMessages(messages: any[]): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokensFromContent(msg.content);
  }, 0);
}

// ============================================================================
// Text Truncation
// ============================================================================

/**
 * Truncate text to fit within a token budget
 * 
 * Intelligently truncates text while preserving structure:
 * - Keeps the beginning and end of text (context is often there)
 * - Removes middle sections when too large
 * - Adds ellipsis to indicate truncation
 * 
 * @param text - Text to truncate
 * @param allowedTokens - Maximum tokens allowed
 * @returns Truncated text
 */
export function truncateTextByTokens(text: string, allowedTokens: number): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const currentTokens = estimateTokensFromText(text);
  
  // No truncation needed
  if (currentTokens <= allowedTokens) {
    return text;
  }
  
  // Calculate character budget (conservative)
  const CHARS_PER_TOKEN = 3.0;
  const targetChars = Math.floor(allowedTokens * CHARS_PER_TOKEN);
  
  // Reserve space for ellipsis
  const ellipsis = '\n\n[... content truncated ...]\n\n';
  const ellipsisTokens = estimateTokensFromText(ellipsis);
  const usableTokens = allowedTokens - ellipsisTokens;
  const usableChars = Math.floor(usableTokens * CHARS_PER_TOKEN);
  
  if (usableChars <= 0) {
    return ellipsis;
  }
  
  // Keep first 60% and last 40% of usable chars
  const keepStart = Math.floor(usableChars * 0.6);
  const keepEnd = Math.floor(usableChars * 0.4);
  
  const startText = text.substring(0, keepStart);
  const endText = text.substring(text.length - keepEnd);
  
  return startText + ellipsis + endText;
}

/**
 * Truncate messages array to fit within token budget
 * Keeps most recent messages, truncates older ones
 */
function truncateMessages(messages: any[], maxTokens: number): any[] {
  const currentTokens = estimateTokensFromMessages(messages);
  
  if (currentTokens <= maxTokens) {
    return messages;
  }
  
  // Strategy: Keep most recent messages, truncate or remove older ones
  const result: any[] = [];
  let tokenCount = 0;
  
  // Process messages in reverse (most recent first)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokensFromContent(msg.content);
    
    if (tokenCount + msgTokens <= maxTokens) {
      // Message fits, keep it
      result.unshift(msg);
      tokenCount += msgTokens;
    } else if (result.length === 0) {
      // This is the most recent message, must keep it (truncated)
      const allowedTokens = maxTokens - tokenCount;
      if (allowedTokens > 100) {
        // Truncate the content
        if (typeof msg.content === 'string') {
          result.unshift({
            ...msg,
            content: truncateTextByTokens(msg.content, allowedTokens),
          });
        } else {
          // For structured content, just keep it and hope for the best
          result.unshift(msg);
        }
      }
      break;
    } else {
      // Older message that doesn't fit, skip it
      break;
    }
  }
  
  return result;
}

// ============================================================================
// Anthropic API Wrapper
// ============================================================================

export interface CallAnthropicOptions {
  input: string | any[];  // User message content (string or structured blocks)
  model?: string;
  maxTokens?: number;
  system?: string;
  messages?: any[];  // Optional: full conversation history
  tools?: any[];  // Optional: tool definitions
  temperature?: number;
}

export interface CallAnthropicResult {
  content: string;
  fullResponse: Anthropic.Messages.Message;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  truncated?: boolean;
  retried?: boolean;
}

/**
 * Anthropic Wrapper Class
 * 
 * Provides methods for safely calling Anthropic API with automatic
 * context management, truncation, and retry logic.
 */
export class AnthropicWrapper {
  private client: Anthropic;
  private defaultModel: string;
  private defaultMaxTokens: number;
  
  constructor(apiKey?: string, defaultModel?: string, defaultMaxTokens?: number) {
    this.client = new Anthropic({
      apiKey: apiKey || ANTHROPIC_API_KEY,
    });
    this.defaultModel = defaultModel || ANTHROPIC_DEFAULT_MODEL;
    this.defaultMaxTokens = defaultMaxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS;
  }
  
  /**
   * Get the underlying Anthropic client
   * Useful for advanced use cases
   */
  getClient(): Anthropic {
    return this.client;
  }
  
  /**
   * Call Anthropic API with automatic context management
   * 
   * Features:
   * - Estimates input token usage
   * - Truncates input if it would exceed context limit
   * - Reduces max_tokens if needed to fit within limit
   * - Retries on 400 errors related to context limits
   * 
   * @param options - Configuration for API call
   * @returns Result with content, usage stats, and metadata
   */
  async call(options: CallAnthropicOptions): Promise<CallAnthropicResult> {
    const model = options.model || this.defaultModel;
    const requestedMaxTokens = options.maxTokens || this.defaultMaxTokens;
    const contextLimit = getContextLimit(model);
    
    // Build messages array
    let messages: any[];
    if (options.messages) {
      // Use provided conversation history
      messages = [...options.messages];
    } else {
      // Create single user message
      messages = [{
        role: 'user',
        content: options.input,
      }];
    }
    
    // Estimate input tokens
    let inputTokens = estimateTokensFromMessages(messages);
    if (options.system) {
      inputTokens += estimateTokensFromText(options.system);
    }
    
    // Check if input + requested output exceeds context
    let maxTokens = requestedMaxTokens;
    let truncated = false;
    
    if (inputTokens + maxTokens > contextLimit) {
      // Need to adjust
      const available = contextLimit - inputTokens;
      
      if (available < 1000) {
        // Input is too large, must truncate
        const targetInputTokens = contextLimit - requestedMaxTokens - 1000; // Safety margin
        messages = truncateMessages(messages, Math.max(targetInputTokens, 1000));
        inputTokens = estimateTokensFromMessages(messages);
        if (options.system) {
          inputTokens += estimateTokensFromText(options.system);
        }
        truncated = true;
        
        // Recalculate available space
        const newAvailable = contextLimit - inputTokens;
        maxTokens = Math.min(requestedMaxTokens, Math.max(newAvailable - 1000, 1000));
      } else {
        // Just reduce max_tokens
        maxTokens = Math.max(available - 1000, 1000); // Keep 1000 token safety margin
      }
    }
    
    // Prepare API call parameters
    const params: any = {
      model,
      max_tokens: maxTokens,
      messages,
    };
    
    if (options.system) {
      params.system = options.system;
    }
    
    if (options.tools && options.tools.length > 0) {
      params.tools = options.tools;
    }
    
    if (options.temperature !== undefined) {
      params.temperature = options.temperature;
    }
    
    // Call API with retry logic
    let retried = false;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await this.client.messages.create(params);
        
        // Extract text content
        let content = '';
        for (const block of response.content) {
          if (block.type === 'text') {
            content += block.text;
          }
        }
        
        return {
          content,
          fullResponse: response,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          truncated,
          retried,
        };
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a context limit error
        const isContextError = error.status === 400 && 
          error.message && 
          (error.message.includes('context limit') || 
           error.message.includes('exceed') ||
           error.message.includes('max_tokens'));
        
        if (isContextError && attempt === 1) {
          // Retry with more aggressive truncation
          retried = true;
          const reduceBy = Math.floor(maxTokens * 0.3); // Reduce by 30%
          maxTokens = Math.max(maxTokens - reduceBy, 1000);
          params.max_tokens = maxTokens;
          
          // Also truncate messages more aggressively
          const targetInputTokens = contextLimit - maxTokens - 2000; // Larger safety margin
          messages = truncateMessages(messages, Math.max(targetInputTokens, 1000));
          params.messages = messages;
          truncated = true;
          
          console.warn(`[AnthropicWrapper] Context limit error, retrying with reduced tokens: ${maxTokens}`);
          continue;
        }
        
        // Not a context error, or already retried, throw it
        throw error;
      }
    }
    
    // Should never reach here, but if we do, throw last error
    throw lastError;
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Call Anthropic API with automatic context management (convenience function)
 * 
 * @param options - Configuration for API call
 * @returns Result with content, usage stats, and metadata
 */
export async function callAnthropic(options: CallAnthropicOptions): Promise<CallAnthropicResult> {
  const wrapper = new AnthropicWrapper();
  return wrapper.call(options);
}

// ============================================================================
// Exports
// ============================================================================

export default AnthropicWrapper;
