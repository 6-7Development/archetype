import Anthropic from '@anthropic-ai/sdk';
import { WebSocket } from 'ws';
import { truncateToolOutput, formatTruncationLog } from './utils/toolOutputTruncator';

/*
<important_code_snippet_instructions>
The newest Anthropic model is "claude-sonnet-4-20250514", not "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022" nor "claude-3-sonnet-20240229". 
If the user doesn't specify a model, always prefer using "claude-sonnet-4-20250514" as it is the latest model.
</important_code_snippet_instructions>
*/

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy-key-for-development",
});

interface StreamOptions {
  model?: string;
  maxTokens?: number;
  system: string;
  messages: any[];
  tools?: any[]; // Tool definitions for Claude tool use
  signal?: AbortSignal; // Abort signal for cancellation
  onChunk?: (chunk: any) => void;
  onThought?: (thought: string) => void;
  onAction?: (action: string) => void;
  onToolUse?: (toolUse: any) => Promise<any>; // Callback to execute tools
  onComplete?: (fullText: string, usage: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Stream AI responses with real-time thought/action detection
 * Includes defensive error handling and graceful degradation
 */
export async function streamAnthropicResponse(options: StreamOptions) {
  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    system,
    messages,
    tools,
    signal,
    onChunk,
    onThought,
    onAction,
    onToolUse,
    onComplete,
    onError,
  } = options;

  let fullText = '';
  let currentThought = '';
  let currentAction = '';
  let usage: any = null;
  let stream: any = null;
  let toolUses: any[] = []; // Track tool uses for execution
  let abortHandler: (() => void) | null = null; // Declare early to avoid ReferenceError

  try {
    // Check for abort before starting
    if (signal?.aborted) {
      throw new Error('Request aborted before starting');
    }

    // Create stream with error handling (include tools if provided)
    const streamParams: any = {
      model,
      max_tokens: maxTokens,
      system,
      messages,
    };
    
    // Add tools if provided for autonomous capabilities
    if (tools && tools.length > 0) {
      streamParams.tools = tools;
    }
    
    stream = await anthropic.messages.stream(streamParams);
    
    // Set up abort handler after stream creation succeeds
    if (signal) {
      abortHandler = () => {
        if (stream) {
          stream.controller?.abort();
        }
      };
      signal.addEventListener('abort', abortHandler);
    }

    // Process stream events with defensive parsing
    for await (const event of stream) {
      try {
        // Handle tool use blocks
        if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          const toolUse = event.content_block;
          toolUses.push(toolUse);
          
          // Notify about tool use (conversational)
          if (onAction) {
            const toolMessages: Record<string, string> = {
              'browser_test': '🧪 Testing in browser...',
              'web_search': '🔍 Searching for solutions...',
              'vision_analyze': '👁️ Analyzing visuals...',
              'architect_consult': '🧑‍💼 Consulting architect...',
              'read_platform_file': '📖 Reading platform code...',
              'write_platform_file': '✏️ Fixing platform code...',
            };
            const message = toolMessages[toolUse.name] || `🔨 Working on ${toolUse.name}...`;
            onAction(message);
          }
        }
        
        // Handle content deltas
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const chunk = event.delta.text;
          
          // Validate chunk before processing
          if (typeof chunk === 'string' && chunk.length > 0) {
            fullText += chunk;
            
            // Send raw chunk with error handling
            try {
              if (onChunk) {
                onChunk({ type: 'chunk', content: chunk });
              }
            } catch (chunkError) {
              console.error('❌ Error in onChunk callback:', chunkError);
              // Continue processing despite callback error
            }

            // Detect thoughts with safe regex matching
            try {
              if (chunk.toLowerCase().includes('thinking:') || 
                  chunk.includes('🤔') || 
                  /\b(analyzing|considering|evaluating)\b/i.test(chunk)) {
                currentThought += chunk;
                if (onThought && currentThought.trim().length > 0) {
                  onThought(currentThought.trim());
                }
              }
            } catch (thoughtError) {
              console.error('❌ Error detecting thoughts:', thoughtError);
              // Continue processing
            }

            // Detect actions with safe regex matching
            try {
              if (/step \d+|action:|analyzing|generating|building|creating|optimizing|validating|testing/i.test(chunk)) {
                currentAction += chunk;
                if (onAction && currentAction.trim().length > 0) {
                  onAction(currentAction.trim());
                }
              }
            } catch (actionError) {
              console.error('❌ Error detecting actions:', actionError);
              // Continue processing
            }
          }
        }

        // Capture usage stats with validation
        if (event.type === 'message_delta' && event.usage) {
          try {
            usage = {
              inputTokens: event.usage.input_tokens || 0,
              outputTokens: event.usage.output_tokens || 0,
            };
          } catch (usageError) {
            console.error('❌ Error parsing usage stats:', usageError);
          }
        }
      } catch (eventError) {
        console.error('❌ Error processing stream event:', eventError);
        // Continue to next event despite error
        continue;
      }
    }

    // Get final message with complete usage
    let finalMessage: any = null;
    try {
      finalMessage = await stream.finalMessage();
      if (finalMessage?.usage) {
        usage = {
          inputTokens: finalMessage.usage.input_tokens || 0,
          outputTokens: finalMessage.usage.output_tokens || 0,
        };
      }
      
      // Extract complete tool uses from final message (with inputs)
      if (finalMessage?.content) {
        // Reset and use finalMessage tool uses (they have complete inputs)
        toolUses = [];
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            toolUses.push(block);
          }
        }
      }
    } catch (finalError) {
      console.error('❌ Error getting final message:', finalError);
      // Clear incomplete tool uses to prevent bad execution
      toolUses = [];
    }
    
    // Execute tools if Claude requested them
    if (toolUses.length > 0 && onToolUse && finalMessage?.stop_reason === 'tool_use') {
      try {
        if (onAction) {
          const actionMessage = toolUses.length === 1 
            ? '🔨 Running checks...' 
            : `🔨 Running ${toolUses.length} checks...`;
          onAction(actionMessage);
        }
        
        // Execute all tools and collect results
        const toolResults = await Promise.all(
          toolUses.map(async (toolUse) => {
            try {
              const result = await onToolUse(toolUse);
              
              // 🛡️ CRITICAL: Truncate tool output to prevent token explosions
              const truncResult = truncateToolOutput(toolUse.name, result);
              console.log(formatTruncationLog(toolUse.name, truncResult));
              
              // Add truncation warning if output was truncated
              let finalContent = truncResult.content;
              if (truncResult.wasTruncated && truncResult.summary) {
                finalContent = {
                  _truncated: true,
                  _summary: truncResult.summary,
                  _originalTokens: truncResult.originalSize,
                  _truncatedTokens: truncResult.truncatedSize,
                  result: truncResult.content
                };
              }
              
              return {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify(finalContent),
              };
            } catch (toolError) {
              console.error(`❌ Tool execution error (${toolUse.name}):`, toolError);
              return {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify({
                  error: toolError instanceof Error ? toolError.message : String(toolError),
                }),
                is_error: true,
              };
            }
          })
        );
        
        // Return tool results to be added to conversation
        return { 
          fullText, 
          usage: usage || { inputTokens: 0, outputTokens: 0 },
          toolResults,
          assistantContent: finalMessage.content, // Full content blocks for message continuation
          needsContinuation: true, // Indicate we need another turn
        };
      } catch (toolExecError) {
        console.error('❌ Error executing tools:', toolExecError);
      }
    }

    // Call completion callback with error handling
    try {
      if (onComplete) {
        onComplete(fullText, usage);
      }
    } catch (completeError) {
      console.error('❌ Error in onComplete callback:', completeError);
    }

    return { fullText, usage: usage || { inputTokens: 0, outputTokens: 0 } };

  } catch (error) {
    console.error('❌ Fatal error in Anthropic streaming:', error);
    
    // Notify error callback
    if (onError) {
      try {
        onError(error instanceof Error ? error : new Error(String(error)));
      } catch (callbackError) {
        console.error('❌ Error in onError callback:', callbackError);
      }
    }

    // Return partial results if we have any
    return { 
      fullText: fullText || '', 
      usage: usage || { inputTokens: 0, outputTokens: 0 },
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Clean up abort event listener to prevent memory leaks
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
    
    // Clean up stream if it exists
    try {
      if (stream && typeof stream.controller?.abort === 'function') {
        stream.controller.abort();
      }
    } catch (cleanupError) {
      console.error('❌ Error during stream cleanup:', cleanupError);
    }
  }
}

/**
 * Send streaming updates via WebSocket with error handling
 */
export function sendStreamUpdate(ws: WebSocket, data: any) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      ws.send(message);
    }
  } catch (error) {
    console.error('❌ Error sending WebSocket update:', error);
    // Don't throw - gracefully handle send failures
  }
}

/**
 * Broadcast to multiple WebSockets with error handling
 */
export function broadcastStreamUpdate(sockets: Set<WebSocket>, data: any) {
  const message = JSON.stringify(data);
  let successCount = 0;
  let failCount = 0;

  sockets.forEach(ws => {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        successCount++;
      }
    } catch (error) {
      console.error('❌ Error broadcasting to socket:', error);
      failCount++;
    }
  });

  if (failCount > 0) {
    console.warn(`⚠️  Broadcast partially failed: ${successCount} sent, ${failCount} failed`);
  }
}

export { anthropic, DEFAULT_MODEL };
