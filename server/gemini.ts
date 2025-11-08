import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebSocket } from 'ws';

const DEFAULT_MODEL = "gemini-2.5-flash";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy-key-for-development");

interface StreamOptions {
  model?: string;
  maxTokens?: number;
  system: string;
  messages: any[];
  tools?: any[];
  signal?: AbortSignal;
  onChunk?: (chunk: any) => void;
  onThought?: (thought: string) => void;
  onAction?: (action: string) => void;
  onToolUse?: (toolUse: any) => Promise<any>;
  onComplete?: (fullText: string, usage: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Convert Anthropic-style messages to Gemini format
 * Properly maps tool_use_id back to original function names
 */
function convertMessagesToGemini(messages: any[]): any[] {
  // Build a map of tool_use_id -> function name from all tool_use messages
  const toolUseMap = new Map<string, string>();
  
  messages.forEach(msg => {
    if (msg.role === 'assistant' && typeof msg.content !== 'string') {
      msg.content.forEach((c: any) => {
        if (c.type === 'tool_use') {
          toolUseMap.set(c.id, c.name);
        }
      });
    }
  });

  const convertedMessages = messages.map(msg => {
    if (msg.role === 'assistant') {
      return {
        role: 'model',
        parts: typeof msg.content === 'string' 
          ? [{ text: msg.content }]
          : msg.content.map((c: any) => {
              if (c.type === 'text') return { text: c.text };
              if (c.type === 'tool_use') return { 
                functionCall: {
                  name: c.name,
                  args: c.input
                }
              };
              return c;
            })
      };
    }
    return {
      role: 'user',
      parts: typeof msg.content === 'string'
        ? [{ text: msg.content }]
        : msg.content.map((c: any) => {
            if (c.type === 'text') return { text: c.text };
            if (c.type === 'tool_result') {
              // Get the original function name from the map
              const functionName = toolUseMap.get(c.tool_use_id) || c.tool_use_id;
              
              // Extract data from Anthropic block objects or handle raw content
              const extractContent = (content: any): any => {
                // Helper function to ensure we ALWAYS return an object
                const ensureObject = (value: any): any => {
                  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                    return { result: value };
                  }
                  return value;
                };

                // Handle array of block objects (Anthropic format)
                if (Array.isArray(content)) {
                  if (content.length === 1) {
                    const item = content[0];
                    // Handle Anthropic block objects
                    if (typeof item === 'object' && item !== null) {
                      if ('json' in item) {
                        // ✅ FIX: Ensure JSON payload is an object
                        return ensureObject(item.json);
                      }
                      if ('text' in item) return { result: item.text }; // Extract text as object
                    }
                    if (typeof item === 'string') return { result: item };
                  }
                  
                  // Handle multiple blocks: separate JSON and text
                  const jsonBlocks: any[] = [];
                  const textBlocks: string[] = [];
                  
                  content.forEach(c => {
                    if (typeof c === 'string') {
                      textBlocks.push(c);
                    } else if (typeof c === 'object' && c !== null) {
                      if ('json' in c) {
                        jsonBlocks.push(c.json);
                      } else if ('text' in c) {
                        textBlocks.push(c.text);
                      } else {
                        // Unknown object type, stringify it
                        textBlocks.push(JSON.stringify(c));
                      }
                    }
                  });
                  
                  // Return structured object based on what we have
                  if (jsonBlocks.length > 0 && textBlocks.length > 0) {
                    // Both JSON and text: return structured object
                    return {
                      json: jsonBlocks.length === 1 ? jsonBlocks[0] : jsonBlocks,
                      text: textBlocks.join('\n')
                    };
                  } else if (jsonBlocks.length > 0) {
                    // ✅ FIX: Only JSON - ensure result is an object
                    const jsonData = jsonBlocks.length === 1 ? jsonBlocks[0] : jsonBlocks;
                    return ensureObject(jsonData);
                  } else if (textBlocks.length > 0) {
                    // Only text: return as result object
                    return { result: textBlocks.join('\n') };
                  }
                  
                  // Empty array fallback
                  return {};
                }
                
                // Handle direct string content
                if (typeof content === 'string') {
                  try {
                    const parsed = JSON.parse(content);
                    // ✅ FIX: Ensure parsed result is an object
                    return ensureObject(parsed);
                  } catch {
                    return { result: content };
                  }
                }
                
                // ✅ FIX: Handle direct content - ensure it's an object
                if (!content) {
                  return {};
                }
                return ensureObject(content);
              };
              
              const responseData = extractContent(c.content);
              
              // ✅ FIX: Gemini requires response in { name, content: [{ text }] } format
              return {
                functionResponse: {
                  name: functionName,
                  response: {
                    name: functionName,
                    content: [{
                      text: JSON.stringify(responseData),
                      mimeType: 'application/json'
                    }]
                  }
                }
              };
            }
            return c;
          })
    };
  });
  
  // Cleanup memory leak: Clear the toolUseMap after processing
  toolUseMap.clear();
  
  return convertedMessages;
}

/**
 * Convert Anthropic-style tools to Gemini format
 * CRITICAL: Gemini expects ALL tools in a SINGLE wrapper object
 */
function convertToolsToGemini(tools: any[]): any[] {
  if (!tools || tools.length === 0) return [];
  
  return [{
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }))
  }];
}

/**
 * Get contextual action message based on function call name
 */
function getActionMessageFromFunctionCall(functionName: string): string {
  const actionMessages: Record<string, string> = {
    'browser_test': '🧪 Testing in browser...',
    'web_search': '🔍 Searching for solutions...',
    'vision_analyze': '👁️ Analyzing visuals...',
    'architect_consult': '🧑‍💼 Consulting architect...',
    'read_platform_file': '📖 Reading platform code...',
    'write_platform_file': '✏️ Fixing platform code...',
    'read': '📖 Reading files...',
    'write': '✏️ Writing files...',
    'edit': '✏️ Editing files...',
    'bash': '⚙️ Running commands...',
    'grep': '🔎 Searching code...',
    'ls': '📂 Listing files...',
    'glob': '🔍 Finding files...',
    'execute_sql_tool': '🗄️ Querying database...',
    'packager_tool': '📦 Installing packages...',
    'get_latest_lsp_diagnostics': '🔍 Checking for errors...',
    'search_codebase': '🔍 Searching codebase...',
    'web_fetch': '🌐 Fetching web content...',
    'stock_image_tool': '🖼️ Finding images...',
    'ask_secrets': '🔐 Requesting API keys...',
  };
  return actionMessages[functionName] || `🔨 Executing ${functionName}...`;
}

/**
 * Get contextual thinking message based on text patterns
 */
function getThinkingMessageFromText(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('planning') || lowerText.includes('plan')) {
    return '🧠 Planning approach...';
  }
  if (lowerText.includes('considering') || lowerText.includes('evaluating')) {
    return '💭 Considering options...';
  }
  if (lowerText.includes('analyzing') || lowerText.includes('analysis')) {
    return '🔍 Analyzing situation...';
  }
  if (lowerText.includes('thinking') || lowerText.includes('thought')) {
    return '🤔 Thinking through this...';
  }
  if (lowerText.includes('reviewing') || lowerText.includes('checking')) {
    return '👀 Reviewing code...';
  }
  
  return '🧠 Analyzing...';
}

/**
 * Stream Gemini AI responses with real-time thought/action detection
 * Compatible with Anthropic streaming interface
 */
export async function streamGeminiResponse(options: StreamOptions) {
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
  let functionCalls: any[] = [];
  let abortHandler: (() => void) | null = null;
  let abortController: AbortController | null = null;
  
  // 🎯 DE-DUPLICATION: Track last broadcast messages to prevent flooding
  let lastThought = '';
  let lastAction = '';

  try {
    if (signal?.aborted) {
      throw new Error('Request aborted before starting');
    }

    // Convert messages to Gemini format
    const geminiMessages = convertMessagesToGemini(messages);
    
    // Convert tools to Gemini format if provided
    const geminiTools = tools && tools.length > 0 ? convertToolsToGemini(tools) : undefined;

    // 🔍 DEBUG: Log tool conversion for debugging
    if (geminiTools && geminiTools.length > 0) {
      const toolCount = geminiTools[0]?.functionDeclarations?.length || 0;
      const toolNames = geminiTools[0]?.functionDeclarations?.map((t: any) => t.name).slice(0, 3).join(', ') || 'none';
      console.log(`[GEMINI-TOOLS] ✅ Converted ${toolCount} tools for Gemini (first 3: ${toolNames}...)`);
      
      // ⚠️ Google recommends 10-20 tools max for optimal performance
      if (toolCount > 20) {
        console.log(`[GEMINI-TOOLS] ⚠️ WARNING: ${toolCount} tools provided, Google recommends ≤20 for best results`);
      }
      
      console.log(`[GEMINI-TOOLS] Structure check:`, JSON.stringify(geminiTools[0]?.functionDeclarations?.[0], null, 2).substring(0, 200));
    } else {
      console.log('[GEMINI-TOOLS] ⚠️ No tools provided to Gemini');
    }

    // Create abort controller for cancellation
    abortController = new AbortController();
    if (signal) {
      abortHandler = () => {
        if (abortController) {
          abortController.abort();
        }
      };
      signal.addEventListener('abort', abortHandler);
    }

    // Get the generative model
    const generativeModel = genai.getGenerativeModel({ 
      model: model || DEFAULT_MODEL 
    });

    // Prepare request parameters with systemInstruction and tools at top level
    const requestParams: any = {
      contents: geminiMessages,
      // ✅ STRENGTHENED SYSTEM INSTRUCTION: Explicitly forbid Python SDK syntax
      systemInstruction: `${system}

CRITICAL FUNCTION CALLING RULES:
- NEVER use Python syntax like print() or default_api.method_name()
- NEVER use Python SDK patterns like default_api.CreateTaskListTasks()
- ALWAYS use JSON function calls ONLY
- Tool calls must be pure JSON objects, not Python code
- You can ONLY use the explicitly declared function tools provided
- If you're unsure, DO NOT call functions - just respond with text

Only use declared tools with proper JSON format.`,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1, // ULTRA-LOW = maximum determinism for function calling (Google recommends 0-0.2)
        topP: 0.8,        // Slightly reduced randomness for consistency
        // ❌ DON'T set responseMimeType - it breaks function calling!
      },
    };

    // Add tools at top level if provided
    if (geminiTools) {
      requestParams.tools = geminiTools;
    }

    // 🔍 DEBUG: Log what we're sending to Gemini
    console.log('[GEMINI-DEBUG] Request params:');
    console.log('  - Messages:', geminiMessages.length);
    console.log('  - System prompt length:', typeof system === 'string' ? system.length : 'unknown');
    console.log('  - Tools provided:', geminiTools ? geminiTools.length : 0);
    console.log('  - Max tokens:', maxTokens);
    
    // Start streaming
    const result = await generativeModel.generateContentStream(requestParams);

    // Process stream chunks
    let chunkCount = 0;
    for await (const chunk of result.stream) {
      chunkCount++;
      if (chunkCount <= 3) {
        console.log(`[GEMINI-DEBUG] Chunk #${chunkCount}:`, JSON.stringify(chunk).substring(0, 300));
      }
      try {
        // Check for abort
        if (signal?.aborted || abortController?.signal.aborted) {
          break;
        }

        const candidates = chunk.candidates;
        if (!candidates || candidates.length === 0) {
          console.log('[GEMINI-DEBUG] Chunk with no candidates:', JSON.stringify(chunk).substring(0, 200));
          continue;
        }

        const candidate = candidates[0];
        
        // 🔍 DEBUG: Check for safety blocks or finish reasons
        if (candidate.finishReason) {
          console.log('[GEMINI-DEBUG] Finish reason:', candidate.finishReason);
          if (candidate.finishReason === 'SAFETY') {
            console.error('🚨 [GEMINI-SAFETY] Response blocked by safety filters!');
            console.error('[GEMINI-SAFETY] Safety ratings:', JSON.stringify(candidate.safetyRatings, null, 2));
          }
        }
        
        const content = candidate.content;
        if (!content || !content.parts) {
          console.log('[GEMINI-DEBUG] Candidate with no content/parts:', JSON.stringify(candidate).substring(0, 200));
          continue;
        }

        // Process each part
        for (const part of content.parts) {
          // 🧠 CRITICAL FIX: Handle thoughtSignature with contextual messages
          // thoughtSignature + functionCall = action message
          // thoughtSignature alone = thinking message
          if (part.thoughtSignature && part.functionCall) {
            // Thinking + function call = action message
            try {
              const action = getActionMessageFromFunctionCall(part.functionCall.name);
              if (action !== lastAction && onAction) {
                lastAction = action;
                console.log('[GEMINI-ACTION] 🔧', action);
                onAction(action);
              }
            } catch (thoughtError) {
              console.error('❌ Error processing thoughtSignature + functionCall:', thoughtError);
            }
          } else if (part.thoughtSignature) {
            // Thinking alone = contextual thinking message based on nearby text
            try {
              // Use the text content to determine context, or default to generic
              const thought = part.text ? getThinkingMessageFromText(part.text) : '🧠 Analyzing...';
              if (thought !== lastThought && onThought) {
                lastThought = thought;
                console.log('[GEMINI-THOUGHT] 🧠', thought);
                onThought(thought);
              }
            } catch (thoughtError) {
              console.error('❌ Error processing thoughtSignature:', thoughtError);
            }
          }

          // Handle text content
          if (part.text) {
            const text = part.text;
            fullText += text;

            // Send chunk
            if (onChunk) {
              try {
                onChunk({ type: 'chunk', content: text });
              } catch (chunkError) {
                console.error('❌ Error in onChunk callback:', chunkError);
              }
            }

            // Detect thinking patterns in text (FALLBACK: when no thoughtSignature)
            try {
              if (/\b(planning|considering|evaluating|analyzing|thinking|reviewing)\b/i.test(text)) {
                const thought = getThinkingMessageFromText(text);
                if (thought !== lastThought && onThought) {
                  lastThought = thought;
                  onThought(thought);
                }
              }
            } catch (thoughtError) {
              console.error('❌ Error detecting thoughts in text:', thoughtError);
            }
          }

          // Handle function calls (tool use)
          if (part.functionCall) {
            const functionCall = part.functionCall;
            const toolCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 🔍 DEBUG: Log when Gemini requests a tool
            console.log(`[GEMINI-TOOLS] 🔧 Gemini requested tool: ${functionCall.name}`);
            console.log(`[GEMINI-TOOLS] Tool args:`, JSON.stringify(functionCall.args || {}).substring(0, 100));
            
            functionCalls.push({
              id: toolCallId,
              name: functionCall.name,
              input: functionCall.args || {}
            });

            // Notify about tool use (DE-DUPLICATED)
            if (onAction && functionCall.name) {
              const action = getActionMessageFromFunctionCall(functionCall.name);
              if (action !== lastAction) {
                lastAction = action;
                onAction(action);
              }
            }
          }
        }

        // Capture usage stats (Gemini provides this differently)
        if (chunk.usageMetadata) {
          usage = {
            inputTokens: chunk.usageMetadata.promptTokenCount || 0,
            outputTokens: chunk.usageMetadata.candidatesTokenCount || 0,
          };
        }
      } catch (chunkError) {
        console.error('❌ Error processing stream chunk:', chunkError);
        continue;
      }
    }

    // Note: Final usage stats are already captured from the last chunk
    // Gemini streaming provides usage in the final chunk's usageMetadata

    // Execute tools if Gemini requested them
    if (functionCalls.length > 0 && onToolUse) {
      try {
        if (onAction) {
          const actionMessage = functionCalls.length === 1 
            ? '🔨 Running checks...' 
            : `🔨 Running ${functionCalls.length} checks...`;
          onAction(actionMessage);
        }

        // Execute all function calls
        const toolResults = await Promise.all(
          functionCalls.map(async (call) => {
            try {
              const result = await onToolUse({
                type: 'tool_use',
                id: call.id,
                name: call.name,
                input: call.input
              });
              return {
                type: 'tool_result',
                tool_use_id: call.id,
                content: JSON.stringify(result),
              };
            } catch (toolError) {
              console.error(`❌ Tool execution error (${call.name}):`, toolError);
              return {
                type: 'tool_result',
                tool_use_id: call.id,
                content: JSON.stringify({
                  error: toolError instanceof Error ? toolError.message : String(toolError),
                }),
                is_error: true,
              };
            }
          })
        );

        // Return tool results in Anthropic-compatible format
        return {
          fullText,
          usage: usage || { inputTokens: 0, outputTokens: 0 },
          toolResults,
          assistantContent: functionCalls.map(call => ({
            type: 'tool_use',
            id: call.id,
            name: call.name,
            input: call.input
          })),
          needsContinuation: true,
        };
      } catch (toolExecError) {
        console.error('❌ Error executing tools:', toolExecError);
      }
    }

    // Call completion callback
    if (onComplete) {
      try {
        onComplete(fullText, usage);
      } catch (completeError) {
        console.error('❌ Error in onComplete callback:', completeError);
      }
    }

    return { fullText, usage: usage || { inputTokens: 0, outputTokens: 0 } };

  } catch (error) {
    console.error('❌ Fatal error in Gemini streaming:', error);

    if (onError) {
      try {
        onError(error instanceof Error ? error : new Error(String(error)));
      } catch (callbackError) {
        console.error('❌ Error in onError callback:', callbackError);
      }
    }

    return {
      fullText: fullText || '',
      usage: usage || { inputTokens: 0, outputTokens: 0 },
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Clean up abort event listener
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }

    // Clean up abort controller
    if (abortController) {
      try {
        abortController.abort();
      } catch (cleanupError) {
        console.error('❌ Error during cleanup:', cleanupError);
      }
    }
  }
}

/**
 * Send streaming updates via WebSocket with error handling and memory leak prevention
 */
export function sendStreamUpdate(ws: WebSocket, data: any) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      ws.send(message);
      
      // 🛡️ MEMORY LEAK FIX: Ensure WebSocket has error and close handlers
      if (!ws.listenerCount('error')) {
        ws.on('error', (error: any) => {
          console.error('[WEBSOCKET] Error handler added to prevent memory leak:', error.message);
        });
      }
      
      if (!ws.listenerCount('close')) {
        ws.on('close', () => {
          console.log('[WEBSOCKET] Close handler added to prevent memory leak');
        });
      }
    }
  } catch (error) {
    console.error('❌ Error sending WebSocket update:', error);
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

export { genai, DEFAULT_MODEL };
