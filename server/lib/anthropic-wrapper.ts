import Anthropic from '@anthropic-ai/sdk';

/**
 * AnthropicWrapper: Robust wrapper for Anthropic API with context limit handling
 * 
 * Prevents errors like "input length and `max_tokens` exceed context limit: 196601 + 16000 > 200000"
 * by estimating tokens, truncating payloads, and retrying with reduced parameters on failures.
 * 
 * Features:
 * - Token estimation (character-based approximation)
 * - Automatic text truncation to fit within context limits
 * - Retry logic with exponential backoff on context-limit errors
 * - Configurable via environment variables
 */

// Default configuration - can be overridden by environment variables
const DEFAULT_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  contextLimits: {
    'claude-sonnet-4-20250514': 200000,
    'claude-3-7-sonnet-20250219': 200000,
    'claude-3-5-sonnet-20241022': 200000,
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-2.1': 200000,
    'claude-2': 100000,
  } as Record<string, number>,
  defaultMaxTokens: 4096,
  reservedOutputTokens: 16000, // Reserve this much for output
  retryAttempts: 3,
  retryBackoffMs: 1000,
};

/**
 * Get configuration from environment variables or defaults
 */
function getConfig() {
  const model = process.env.ANTHROPIC_DEFAULT_MODEL || DEFAULT_CONFIG.model;
  
  // Allow overriding context limits via env vars like ANTHROPIC_CONTEXT_LIMIT_CLAUDE_SONNET_4
  const contextLimits = { ...DEFAULT_CONFIG.contextLimits };
  
  // Check for custom context limits in env vars
  Object.keys(contextLimits).forEach(modelKey => {
    const envKey = `ANTHROPIC_CONTEXT_LIMIT_${modelKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    if (process.env[envKey]) {
      const parsed = parseInt(process.env[envKey]!, 10);
      if (!isNaN(parsed) && parsed > 0) {
        contextLimits[modelKey] = parsed;
      }
    }
  });
  
  const defaultMaxTokens = process.env.ANTHROPIC_DEFAULT_MAX_TOKENS 
    ? parseInt(process.env.ANTHROPIC_DEFAULT_MAX_TOKENS, 10) 
    : DEFAULT_CONFIG.defaultMaxTokens;
  
  return {
    model,
    contextLimits,
    defaultMaxTokens: isNaN(defaultMaxTokens) ? DEFAULT_CONFIG.defaultMaxTokens : defaultMaxTokens,
    reservedOutputTokens: DEFAULT_CONFIG.reservedOutputTokens,
    retryAttempts: DEFAULT_CONFIG.retryAttempts,
    retryBackoffMs: DEFAULT_CONFIG.retryBackoffMs,
  };
}

/**
 * Options for calling Anthropic API
 */
export interface AnthropicCallOptions {
  input: string | any[]; // Text string or array of message objects
  model?: string;
  maxTokens?: number;
  system?: string;
  temperature?: number;
  topP?: number;
  tools?: any[];
  signal?: AbortSignal;
}

/**
 * Response from Anthropic API call
 */
export interface AnthropicResponse {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  raw?: any; // Full raw response from SDK
}

/**
 * AnthropicWrapper class - main interface for context-safe API calls
 */
export class AnthropicWrapper {
  private client: Anthropic;
  private config: ReturnType<typeof getConfig>;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY || 'dummy-key-for-development',
    });
    this.config = getConfig();
  }

  /**
   * Estimate token count from text using character-based approximation
   * 
   * Rule of thumb: 1 token ≈ 4 characters for English text
   * This is a conservative estimate that errs on the side of caution
   * 
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokensFromText(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    
    // Conservative estimate: 1 token ≈ 4 characters
    // Add a 10% buffer for safety
    const estimatedTokens = Math.ceil((text.length / 4) * 1.1);
    
    return estimatedTokens;
  }

  /**
   * Truncate text to fit within a token budget
   * 
   * @param text - Text to truncate
   * @param allowedTokens - Maximum tokens allowed
   * @returns Truncated text that fits within token budget
   */
  truncateTextByTokens(text: string, allowedTokens: number): string {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    const estimatedTokens = this.estimateTokensFromText(text);
    
    if (estimatedTokens <= allowedTokens) {
      return text; // No truncation needed
    }
    
    // Calculate how many characters we can keep (with buffer)
    const maxChars = Math.floor((allowedTokens * 4) / 1.1);
    
    if (maxChars <= 0) {
      return '';
    }
    
    // Truncate and add indicator
    const truncated = text.substring(0, maxChars);
    const truncationNote = '\n\n[... truncated due to context length ...]';
    
    return truncated + truncationNote;
  }

  /**
   * Get context limit for a specific model
   */
  private getContextLimit(model: string): number {
    return this.config.contextLimits[model] || 200000; // Default to 200k if unknown
  }

  /**
   * Estimate tokens from messages array
   */
  private estimateTokensFromMessages(messages: any[], system?: string): number {
    let totalTokens = 0;
    
    // Add system prompt tokens
    if (system) {
      totalTokens += this.estimateTokensFromText(system);
    }
    
    // Add message tokens
    for (const msg of messages) {
      if (typeof msg === 'string') {
        totalTokens += this.estimateTokensFromText(msg);
      } else if (msg.content) {
        if (typeof msg.content === 'string') {
          totalTokens += this.estimateTokensFromText(msg.content);
        } else if (Array.isArray(msg.content)) {
          // Handle content blocks
          for (const block of msg.content) {
            if (block.type === 'text' && block.text) {
              totalTokens += this.estimateTokensFromText(block.text);
            } else if (block.type === 'tool_result' && block.content) {
              totalTokens += this.estimateTokensFromText(
                typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
              );
            }
          }
        }
      }
    }
    
    // Add overhead for message formatting (approximately 5 tokens per message)
    totalTokens += messages.length * 5;
    
    return totalTokens;
  }

  /**
   * Truncate messages array to fit within token budget
   */
  private truncateMessages(messages: any[], allowedTokens: number, system?: string): any[] {
    if (messages.length === 0) {
      return [];
    }
    
    // Keep track of system tokens
    const systemTokens = system ? this.estimateTokensFromText(system) : 0;
    const availableForMessages = allowedTokens - systemTokens;
    
    // Start from the end (most recent messages) and work backwards
    const truncatedMessages: any[] = [];
    let usedTokens = 0;
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.estimateTokensFromMessages([msg]);
      
      if (usedTokens + msgTokens <= availableForMessages) {
        truncatedMessages.unshift(msg);
        usedTokens += msgTokens;
      } else {
        // If we can't fit the message, try to fit a truncated version
        if (typeof msg.content === 'string') {
          const remainingTokens = availableForMessages - usedTokens;
          if (remainingTokens > 100) { // Only worth it if we have room
            const truncatedContent = this.truncateTextByTokens(msg.content, remainingTokens - 10);
            truncatedMessages.unshift({
              ...msg,
              content: truncatedContent,
            });
          }
        }
        break; // Stop processing older messages
      }
    }
    
    return truncatedMessages;
  }

  /**
   * Call Anthropic API with automatic context limit handling
   * 
   * This method:
   * 1. Estimates input tokens
   * 2. Adjusts maxTokens if input + maxTokens exceeds context limit
   * 3. Truncates input if necessary
   * 4. Retries with reduced parameters on context-limit errors
   * 
   * @param options - API call options
   * @returns Promise<AnthropicResponse>
   */
  async callAnthropic(options: AnthropicCallOptions): Promise<AnthropicResponse> {
    const {
      input,
      model = this.config.model,
      maxTokens = this.config.defaultMaxTokens,
      system,
      temperature,
      topP,
      tools,
      signal,
    } = options;

    const contextLimit = this.getContextLimit(model);
    
    // Convert input to messages array
    let messages: any[];
    if (typeof input === 'string') {
      messages = [{ role: 'user', content: input }];
    } else if (Array.isArray(input)) {
      messages = input;
    } else {
      throw new Error('Input must be a string or array of messages');
    }

    let attempt = 0;
    let currentMaxTokens = maxTokens;
    let currentMessages = messages;
    let lastError: Error | null = null;

    while (attempt < this.config.retryAttempts) {
      try {
        // Estimate input tokens
        const inputTokens = this.estimateTokensFromMessages(currentMessages, system);
        
        // Check if input + maxTokens exceeds context limit
        if (inputTokens + currentMaxTokens > contextLimit) {
          console.warn(
            `⚠️ Anthropic context limit warning: ${inputTokens} input + ${currentMaxTokens} max_tokens = ${inputTokens + currentMaxTokens} > ${contextLimit}`
          );
          
          // Strategy 1: Reduce maxTokens to fit
          const adjustedMaxTokens = Math.max(
            1024, // Minimum useful output
            contextLimit - inputTokens - 1000 // Leave 1000 token buffer
          );
          
          if (adjustedMaxTokens < 1024 || inputTokens > contextLimit - 1024) {
            // Strategy 2: Input is too large, need to truncate
            console.warn('⚠️ Input too large, truncating messages...');
            const allowedInputTokens = contextLimit - currentMaxTokens - 1000;
            currentMessages = this.truncateMessages(currentMessages, allowedInputTokens, system);
            
            const newInputTokens = this.estimateTokensFromMessages(currentMessages, system);
            console.log(`✅ Truncated input from ${inputTokens} to ${newInputTokens} tokens`);
          } else {
            // Just reduce maxTokens
            currentMaxTokens = adjustedMaxTokens;
            console.log(`✅ Reduced max_tokens from ${maxTokens} to ${currentMaxTokens}`);
          }
        }

        // Make the API call
        const response = await this.client.messages.create({
          model,
          max_tokens: currentMaxTokens,
          messages: currentMessages,
          system,
          temperature,
          top_p: topP,
          tools,
        } as any, {
          signal,
        });

        // Extract text content from response
        let content = '';
        for (const block of response.content) {
          if (block.type === 'text') {
            content += block.text;
          }
        }

        return {
          content,
          stopReason: response.stop_reason,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          model: response.model,
          raw: response,
        };

      } catch (error: any) {
        lastError = error;
        
        // Check if it's a context limit error
        const isContextError = 
          error.status === 400 &&
          error.error?.type === 'invalid_request_error' &&
          (error.error?.message?.includes('context limit') ||
           error.error?.message?.includes('max_tokens'));

        if (isContextError && attempt < this.config.retryAttempts - 1) {
          console.warn(`⚠️ Context limit error on attempt ${attempt + 1}, retrying with reduced parameters...`);
          
          // Reduce maxTokens more aggressively
          currentMaxTokens = Math.floor(currentMaxTokens * 0.7);
          
          // Also try truncating messages
          const inputTokens = this.estimateTokensFromMessages(currentMessages, system);
          const allowedInputTokens = Math.floor(inputTokens * 0.8);
          currentMessages = this.truncateMessages(currentMessages, allowedInputTokens, system);
          
          // Wait before retrying
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryBackoffMs * Math.pow(2, attempt))
          );
          
          attempt++;
          continue;
        }
        
        // Not a context error or out of retries
        throw error;
      }
    }

    // If we exhausted all retries
    throw new Error(
      `Failed to call Anthropic API after ${this.config.retryAttempts} attempts. Last error: ${lastError?.message}`
    );
  }

  /**
   * Streaming version of callAnthropic (delegates to existing stream function for now)
   * This maintains compatibility with existing streaming code
   */
  async streamAnthropic(options: AnthropicCallOptions & { 
    onChunk?: (chunk: any) => void;
    onComplete?: (fullText: string, usage: any) => void;
    onError?: (error: Error) => void;
  }): Promise<{ fullText: string; usage: any }> {
    // For now, just use the non-streaming version and simulate streaming
    // In a future enhancement, this could do true streaming with context checks
    try {
      const response = await this.callAnthropic(options);
      
      if (options.onChunk) {
        // Simulate streaming by sending chunks
        const chunkSize = 50;
        for (let i = 0; i < response.content.length; i += chunkSize) {
          options.onChunk({ 
            type: 'chunk', 
            content: response.content.substring(i, i + chunkSize) 
          });
        }
      }
      
      if (options.onComplete) {
        options.onComplete(response.content, response.usage);
      }
      
      return {
        fullText: response.content,
        usage: response.usage,
      };
    } catch (error) {
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }
}

/**
 * Singleton instance for convenience
 */
let _defaultInstance: AnthropicWrapper | null = null;

export function getAnthropicWrapper(): AnthropicWrapper {
  if (!_defaultInstance) {
    _defaultInstance = new AnthropicWrapper();
  }
  return _defaultInstance;
}

/**
 * Helper function: Sanitize and validate file lists for diagnosis
 * Explicitly logs when file lists are empty and signals fallback usage
 */
export function sanitizeDiagnosisFileList(files: string[] | undefined | null): string[] {
  if (!files || !Array.isArray(files)) {
    console.log('ℹ️ Diagnosis file list is null/undefined, using fallback to analyze all files');
    return [];
  }
  
  if (files.length === 0) {
    console.log('ℹ️ Diagnosis file list is empty, using fallback to analyze all files');
    return [];
  }
  
  // Filter out invalid entries
  const sanitized = files.filter(file => {
    if (!file || typeof file !== 'string') {
      console.warn(`⚠️ Skipping invalid file list entry: ${file}`);
      return false;
    }
    if (file.trim().length === 0) {
      console.warn('⚠️ Skipping empty file path');
      return false;
    }
    return true;
  });
  
  if (sanitized.length === 0 && files.length > 0) {
    console.log('ℹ️ All file list entries were invalid, using fallback to analyze all files');
  } else if (sanitized.length < files.length) {
    console.log(`ℹ️ Sanitized file list: ${sanitized.length} valid entries (${files.length - sanitized.length} invalid entries removed)`);
  } else {
    console.log(`✅ File list sanitized: ${sanitized.length} valid files`);
  }
  
  return sanitized;
}
