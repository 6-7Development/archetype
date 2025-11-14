import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebSocket } from 'ws';

const DEFAULT_MODEL = "gemini-2.5-flash";

// ✅ CRITICAL: Verify API key is loaded (external advice - log first 6 chars)
const apiKey = process.env.GEMINI_API_KEY || "dummy-key-for-development";
if (apiKey === "dummy-key-for-development") {
  console.warn('[GEMINI-INIT] ⚠️ WARNING: Using dummy API key - Gemini will not work!');
} else {
  console.log('[GEMINI-INIT] ✅ API key loaded:', apiKey.substring(0, 6) + '...');
  console.log('[GEMINI-INIT] ✅ Default model:', DEFAULT_MODEL);
}

const genai = new GoogleGenerativeAI(apiKey);

/**
 * Sanitize text to remove invisible characters that could corrupt JSON
 * (External advice: Google Docs can inject smart quotes, en-dashes, zero-width spaces)
 */
function sanitizeText(text: string): string {
  if (!text) return text;
  
  return text
    // Replace smart quotes with ASCII quotes
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes → "
    .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes → '
    // Replace en-dashes and em-dashes with regular dash
    .replace(/[\u2013\u2014]/g, '-')
    // Remove zero-width characters
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Normalize newlines to \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

// Extended Part type to include Gemini's thoughtSignature
interface GeminiPart {
  text?: string;
  functionCall?: any;
  thoughtSignature?: string;
}

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
              
              // ✅ FIX: Google's official format - response MUST be direct object, not wrapped in content array
              // See: https://ai.google.dev/gemini-api/docs/function-calling
              return {
                functionResponse: {
                  name: functionName,
                  response: responseData // Direct object - Google's official format
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
 * 
 * ✨ INCLUDES: Automatic retry loop for malformed function calls
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
  
  // 🔄 RETRY LOGIC: Track malformed response attempts
  let retryCount = 0;
  const MAX_RETRIES = 2;

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
      // ✅ CRITICAL: Hard "no-prose" contract at the top (from external advice)
      // ✅ SANITIZE: Remove invisible characters that could corrupt JSON (external advice)
      systemInstruction: sanitizeText(`CRITICAL: Return exactly one JSON object that conforms to the schema. Do not include any text before or after the JSON. Do not include backticks, comments, or explanations.

${system}

FUNCTION CALLING FORMAT (REQUIRED):
When calling a function, emit a pure JSON object with exactly this structure:
{"name":"function_name","args":{"param1":"value1","param2":"value2"}}

FORBIDDEN:
- Do NOT wrap in code: print(api.function_name(...))
- Do NOT use programming syntax
- Do NOT add explanations or prose around the JSON
- Do NOT include markdown fences or backticks

If you need to call a function, emit ONLY the JSON object.`),
      generationConfig: {
        maxOutputTokens: Math.max(maxTokens, 16000), // ⚠️ CRITICAL: Prevent truncated JSON (external advice: "silent killer")
        temperature: 0.0, // ZERO randomness for function calling (external advice: 0.0-0.3)
        topP: 0.8,        // Slightly reduced randomness for consistency
        // ✅ ARCHITECT FIX: Force JSON-only channel to prevent Python-style hallucinations
        responseMimeType: "application/json", // Prevents Gemini from using print(api.fn()) syntax
        // ✅ GEMINI BEST PRACTICE: Enable dynamic thinking for optimal performance
        // ✅ GAP 1 FIX: Enable thought visibility (Gemini's recommendation)
        thinkingConfig: {
          thinkingBudget: -1,  // -1 = dynamic thinking budget (adapts to complexity)
          includeThoughts: true  // ✅ Return thought summaries for frontend display
        },
      },
    };

    // Add tools at top level if provided
    if (geminiTools && geminiTools.length > 0 && geminiTools[0]?.functionDeclarations) {
      requestParams.tools = geminiTools;
      
      // ✅ NEW ARCHITECTURE: Force tool calling with explicit function list (external advice v2)
      // "Even perfect prompts won't stop free-text if tool config isn't strict"
      // mode: "ANY" = force tool call every time (no prose allowed)
      // allowedFunctionNames = explicit list of what can be called
      const functionNames = geminiTools[0].functionDeclarations.map((fn: any) => fn.name);
      
      requestParams.toolConfig = {
        functionCallingConfig: {
          // ✅ ARCHITECT FIX: Removed mode: 'ANY' - clashes with responseMimeType
          // Default behavior already allows tool calls, responseMimeType enforces JSON
          allowedFunctionNames: functionNames, // ✅ BE EXPLICIT about what's allowed
        }
      };
      
      console.log(`[GEMINI-TOOLCONFIG] mode: ANY (forced), ${functionNames.length} functions allowed:`, functionNames.slice(0, 5).join(', '));
    }

    // 🔍 DEBUG: Log what we're sending to Gemini
    console.log('[GEMINI-DEBUG] Request params:');
    console.log('  - Messages:', geminiMessages.length);
    console.log('  - System prompt length:', typeof system === 'string' ? system.length : 'unknown');
    console.log('  - Tools provided:', geminiTools ? geminiTools.length : 0);
    console.log('  - Tool config:', requestParams.toolConfig ? 'enabled' : 'none');
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
        const content = candidate.content;
        
        // 🔍 DEBUG: Check for safety blocks or finish reasons
        if (candidate.finishReason) {
          console.log('[GEMINI-DEBUG] Finish reason:', candidate.finishReason);
          
          // 🚨 CRITICAL: Handle MALFORMED_FUNCTION_CALL with auto-retry
          if (candidate.finishReason === 'MALFORMED_FUNCTION_CALL') {
            console.error(`🚨 [GEMINI-MALFORMED] Detected malformed function call! (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            
            // Log the malformed content for debugging
            const finishMessage = (candidate as any).finishMessage;
            let attemptedFunction: string | null = null;
            
            if (finishMessage) {
              console.error('[GEMINI-MALFORMED] Error details:', finishMessage);
              
              // Extract function name if present in error message
              const functionNameMatch = finishMessage.match(/function call:\s*([a-zA-Z_]+)/i);
              if (functionNameMatch) {
                attemptedFunction = functionNameMatch[1];
                console.error(`[GEMINI-MALFORMED] Attempted to call: ${attemptedFunction}`);
                console.error('[GEMINI-MALFORMED] This means Gemini used Python-like syntax instead of JSON');
              }
            }
            
            // Try to find the intended function from candidate content
            if (!attemptedFunction && content?.parts) {
              for (const part of content.parts) {
                if ((part as any).functionCall?.name) {
                  attemptedFunction = (part as any).functionCall.name;
                  console.log('[GEMINI-MALFORMED] Found function name from content:', attemptedFunction);
                  break;
                }
              }
            }
            
            // 🔄 RETRY LOGIC: Attempt to recover by retrying with clarifying message
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              console.log(`[GEMINI-RETRY] Retrying with clarifying message (${retryCount}/${MAX_RETRIES})...`);
              
              // Build clarifying message based on whether we know the function name
              let clarifyingContent: string;
              if (attemptedFunction) {
                // We know the function - provide specific guidance
                clarifyingContent = `Your last response used invalid function syntax. Please respond with ONLY a pure JSON object in this exact format:
{"name":"${attemptedFunction}","args":{"param1":"value1"}}

Do NOT use Python syntax like: ${attemptedFunction}(param1="value1")
Do NOT wrap in code blocks or backticks.
Return ONLY the raw JSON object.`;
              } else {
                // We don't know the function - provide generic guidance
                clarifyingContent = `Your last response used invalid function syntax. Please respond with ONLY a pure JSON function call object in this exact format:
{"name":"function_name","args":{"param":"value"}}

Do NOT use Python-like syntax.
Do NOT wrap in code blocks or backticks.
Return ONLY the raw JSON object.`;
              }
              
              const clarifyingMessage: any = {
                role: 'user',
                content: clarifyingContent
              };
              
              // Recursive retry with updated messages
              const retryMessages = [...messages, clarifyingMessage];
              
              return streamGeminiResponse({
                ...options,
                messages: retryMessages,
              });
            }
            
            // 🚫 MAX RETRIES EXCEEDED: Provide helpful error
            const errorText = `⚠️ Internal error: AI used invalid function syntax after ${MAX_RETRIES} retry attempts. This has been logged. Please try rephrasing your request differently.`;
            
            if (onChunk) {
              onChunk(errorText);
            }
            fullText += errorText;
            
            // Stop processing this malformed response
            break;
          }
          
          if (candidate.finishReason === 'SAFETY') {
            console.error('🚨 [GEMINI-SAFETY] Response blocked by safety filters!');
            console.error('[GEMINI-SAFETY] Safety ratings:', JSON.stringify(candidate.safetyRatings, null, 2));
          }
        }
        
        if (!content || !content.parts) {
          console.log('[GEMINI-DEBUG] Candidate with no content/parts:', JSON.stringify(candidate).substring(0, 200));
          continue;
        }

        // Process each part (cast to GeminiPart to include thoughtSignature)
        for (const part of (content.parts as GeminiPart[])) {
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
            
            // ✅ VALIDATION: Ensure args is a valid object (external advice: schema validation)
            let validatedArgs = functionCall.args || {};
            
            try {
              // Defensive parsing: Ensure args is an object, not a string or array
              if (typeof validatedArgs === 'string') {
                console.warn(`[GEMINI-VALIDATION] ⚠️ Args is string, parsing as JSON...`);
                validatedArgs = JSON.parse(validatedArgs);
              }
              
              if (Array.isArray(validatedArgs)) {
                console.warn(`[GEMINI-VALIDATION] ⚠️ Args is array, converting to object...`);
                validatedArgs = { items: validatedArgs };
              }
              
              if (typeof validatedArgs !== 'object' || validatedArgs === null) {
                console.error(`[GEMINI-VALIDATION] ❌ Invalid args type: ${typeof validatedArgs}`);
                validatedArgs = {};
              }
            } catch (parseError) {
              console.error(`[GEMINI-VALIDATION] ❌ Failed to parse args:`, parseError);
              validatedArgs = {};
            }
            
            // 🔍 DEBUG: Log when Gemini requests a tool
            console.log(`[GEMINI-TOOLS] 🔧 Gemini requested tool: ${functionCall.name}`);
            console.log(`[GEMINI-TOOLS] Tool args:`, JSON.stringify(validatedArgs).substring(0, 100));
            
            functionCalls.push({
              id: toolCallId,
              name: functionCall.name,
              input: validatedArgs
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
    // ✅ CRITICAL: Handle rate limits and quota errors (external advice)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = JSON.stringify(error);
    
    // Detect rate limit (429) or quota exceeded (400)
    if (errorString.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      console.error('🚨 [GEMINI-RATE-LIMIT] Rate limit or quota exceeded!');
      console.error('[GEMINI-RATE-LIMIT] Suggestion: Implement exponential backoff or reduce request frequency');
    } else if (errorString.includes('400') || errorMessage.includes('invalid')) {
      console.error('🚨 [GEMINI-INVALID] Invalid request - check API key, model name, or request format');
    }
    
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
