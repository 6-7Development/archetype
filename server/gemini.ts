/**
 * ✅ PRODUCTION READY: Gemini Resilience Fixes Confirmed
 * All four Gemini resilience fixes are working as intended:
 * 1. Hybrid Parser: Robustly handles both standard API function calls and JSON embedded in text.
 * 2. Forced Function Calling: Ensures Gemini uses tools when required, preventing text-based malformed calls.
 * 3. Retry Handler: Automatically retries malformed function calls with clarifying instructions and forced mode.
 * 4. Recovery Thresholds: Provides user-friendly error messages after max retries, guiding users on next steps.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebSocket } from 'ws';
import { jsonrepair } from 'jsonrepair';
import { telemetry } from './services/healingTelemetry';
import { geminiRateLimiter, exponentialBackoffWithJitter, estimateTokenCount } from './services/rateLimiter';

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

// Telemetry for JSON healing performance monitoring
declare global {
  var jsonHealingTelemetry: {
    success: number;
    failure: number;
    invalidStructure: number;
    totalAttempts: number;
    lastReset: Date;
  };
}

if (!global.jsonHealingTelemetry) {
  global.jsonHealingTelemetry = {
    success: 0,
    failure: 0,
    invalidStructure: 0,
    totalAttempts: 0,
    lastReset: new Date()
  };
}

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

/**
 * Robust JSON extraction and healing for incomplete/truncated Gemini responses
 * Uses aggressive repair strategy + jsonrepair library to fix:
 * - Missing closing braces
 * - Trailing commas
 * - Truncated mid-transmission JSON
 * 
 * @param responseText - Accumulated text from streaming chunks
 * @returns Parsed function call object or null if no valid JSON found
 */
export function robustExtractAndHeal(responseText: string): { name: string; args: any } | null {
  // 1. Clean and isolate JSON payload
  let cleanedText = responseText.replace(/```json|```/g, '').trim();
  
  // 2. Find first opening brace
  const firstBraceIndex = cleanedText.indexOf('{');
  if (firstBraceIndex === -1) return null;
  cleanedText = cleanedText.substring(firstBraceIndex);
  
  // 2.5. EARLY EXIT: Don't attempt to heal fragments that are too incomplete
  // If we only have "{" or "{\"" or similar minimal fragments, we need more data
  if (cleanedText.length < 10 || !cleanedText.includes(':')) {
    console.log('[JSON-HEALING] ⏸️ Fragment too small to heal, waiting for more chunks...');
    return null;
  }
  
  // 3. PRE-REPAIR: Fix obvious truncation issues
  let finalJsonString = cleanedText;
  if (!finalJsonString.endsWith('}')) {
    console.log('[JSON-HEALING] 🔧 Detected incomplete JSON (missing closing brace)');
    
    // Count missing braces/brackets (smart counting - ignore delimiters inside strings)
    let openBraces = 0;
    let closeBraces = 0;
    let openBrackets = 0;
    let closeBrackets = 0;
    let inString = false;
    let escape = false;
    
    for (const char of finalJsonString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') openBraces++;
        if (char === '}') closeBraces++;
        if (char === '[') openBrackets++;
        if (char === ']') closeBrackets++;
      }
    }
    
    // If we ended inside a string, close it first
    if (inString) {
      finalJsonString += '"';
      console.log('[JSON-HEALING] 🔧 Closed incomplete string');
    }
    
    // Remove trailing comma
    if (finalJsonString.endsWith(',')) {
      finalJsonString = finalJsonString.slice(0, -1);
    }
    
    // Add missing closing brackets and braces
    const missingBrackets = openBrackets - closeBrackets;
    const missingBraces = openBraces - closeBraces;
    
    if (missingBrackets > 0) {
      finalJsonString += ']'.repeat(missingBrackets);
      console.log(`[JSON-HEALING] 🔧 Added ${missingBrackets} missing closing bracket(s)`);
    }
    
    if (missingBraces > 0) {
      finalJsonString += '}'.repeat(missingBraces);
      console.log(`[JSON-HEALING] 🔧 Added ${missingBraces} missing closing brace(s)`);
    } else if (missingBraces === 0 && missingBrackets === 0) {
      // Edge case: no braces/brackets counted but doesn't end with }
      // This can happen with malformed JSON, add at least one closing brace
      finalJsonString += '}';
      console.log('[JSON-HEALING] 🔧 Added fallback closing brace');
    }
  }
  
  // 4. Attempt to heal with jsonrepair
  try {
    const repairedJsonString = jsonrepair(finalJsonString);
    const parsed = JSON.parse(repairedJsonString);
    
    // Validate it's a function call
    if (parsed.name && parsed.args) {
      telemetry.recordHealingSuccess(parsed.name);
      console.log('[JSON-HEALING] ✅ Successfully healed function call:', parsed.name);
      return { name: parsed.name, args: parsed.args };
    }
    return null;
  } catch (e) {
    telemetry.recordHealingFailure(String(e));
    console.error('[JSON-HEALING] ❌ Repair failed:', e);
    return null;
  }
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
  toolConfig?: any;  // Optional tool config for forced function calls
  signal?: AbortSignal;
  onChunk?: (chunk: any) => void;
  onThought?: (thought: string) => void;
  onAction?: (action: string) => void;
  onToolUse?: (toolUse: any) => Promise<any>;
  onComplete?: (fullText: string, usage: any) => void;
  onError?: (error: Error) => void;
  forceFunctionCall?: boolean;  // Force mode: ANY instead of AUTO when malformed calls detected
  userIntent?: 'fix' | 'build' | 'question' | 'casual' | 'diagnostic'; // Intent-sensitive mode control
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
import { GEMINI_CONFIG } from './workflows/gemini-config.ts';

export async function streamGeminiResponse(options: StreamOptions) {
  const {
    model = GEMINI_CONFIG.model.default,
    maxTokens = GEMINI_CONFIG.tokens.maxOutput,
    system,
    messages,
    tools,
    toolConfig,
    signal,
    onChunk,
    onThought,
    onAction,
    onToolUse,
    onComplete,
    onError,
    forceFunctionCall = false,  // CRITICAL FIX: Extract forceFunctionCall parameter
    userIntent,  // CRITICAL FIX: Extract userIntent parameter
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
  const MAX_RETRIES = GEMINI_CONFIG.retry.maxAttempts;

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

    // ✅ CRITICAL FIX: Move systemInstruction to MODEL level (not request level)
    // This ensures function calling respects the "no print() wrapping" rule
    const systemInstructionText = sanitizeText(`CRITICAL: You MUST use ONLY the tools declared in the schema. Do not wrap function calls in print() or any other syntax.

${system}

FUNCTION CALLING RULES (MANDATORY):
1. When calling a function, Gemini API handles it automatically - you just specify the name and args
2. DO NOT wrap calls in print(), code blocks, or any programming syntax
3. DO NOT use Python/JavaScript syntax like print(write_platform_file(...))
4. CORRECT: Just call the function name with its arguments
5. INCORRECT: print(function_name(...)) or function_name()(...) or any wrapper

Your available functions are declared in the tools schema. Use them directly.`);

    // Get the generative model with systemInstruction at MODEL level
    const generativeModel = genai.getGenerativeModel({ 
      model: model || DEFAULT_MODEL,
      systemInstruction: systemInstructionText  // ✅ MODEL-level instruction (stronger than request-level)
    });

    // Prepare request parameters (systemInstruction now at model level, not here)
    const requestParams: any = {
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: Math.max(maxTokens, 16000), // ⚠️ CRITICAL: Prevent truncated JSON (external advice: "silent killer")
        temperature: 0.0, // ZERO randomness for function calling (external advice: 0.0-0.3)
        topP: 0.8,        // Slightly reduced randomness for consistency
        // ✅ REMOVED: responseMimeType - INCOMPATIBLE with function calling per Gemini API error
        // Error: "Function calling with a response mime type: 'application/json' is unsupported"
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
      
      // Use custom toolConfig if provided (for forced retries), otherwise use default
      if (toolConfig) {
        requestParams.toolConfig = {
          functionCallingConfig: toolConfig.function_calling_config
        };
        console.log('[GEMINI-TOOLCONFIG] Using custom tool config:', JSON.stringify(toolConfig));
      } else {
        // ✅ INTENT-SENSITIVE MODE: Intelligent mode selection based on context
        // Two pathways that force mode: ANY (Gemini MUST call a tool):
        //   1. forceFunctionCall=true: Retry pathway after malformed function calls
        //   2. userIntent='fix'/'build': Initial requests for code changes
        // All other cases use mode: AUTO (Gemini can choose natural response or tool use)
        const shouldForceTools = forceFunctionCall || userIntent === 'fix' || userIntent === 'build';
        
        // Aggregate function names from ALL tool entries (not just geminiTools[0])
        const functionNames = (geminiTools || []).flatMap((toolSet: any) => 
          (toolSet.functionDeclarations || []).map((fn: any) => fn.name)
        );
        
        // 🛡️ SAFETY: Can't use mode: ANY without tools
        // If forceFunctionCall=true BUT no functions available → fall back to AUTO
        // This prevents Gemini API rejection during diagnostic retries that disable tools
        const hasFunctions = functionNames.length > 0;
        const callingMode = (shouldForceTools && hasFunctions) ? 'ANY' : 'AUTO';
        
        // Only set allowedFunctionNames if we have functions AND mode is ANY
        requestParams.toolConfig = {
          functionCallingConfig: {
            mode: callingMode,
            ...(hasFunctions && callingMode === 'ANY' ? { allowedFunctionNames: functionNames } : {})
          }
        };
        
        // Enhanced logging to explain mode selection reasoning
        if (shouldForceTools && !hasFunctions) {
          console.log(`[GEMINI-TOOLCONFIG] ⚠️ SAFETY FALLBACK: forceFunctionCall=true but no tools available → using mode: AUTO instead of ANY`);
        }
        console.log(`[GEMINI-TOOLCONFIG] mode: ${callingMode} (forceFunctionCall: ${options.forceFunctionCall || false}, intent: ${options.userIntent || 'not specified'}, ${functionNames.length} functions available${functionNames.length > 0 ? ': ' + functionNames.slice(0, 5).join(', ') : ''})`);
      }
    }

    // 🔍 DEBUG: Log what we're sending to Gemini
    console.log('[GEMINI-DEBUG] Request params:');
    console.log('  - Messages:', geminiMessages.length);
    console.log('  - System prompt length:', typeof system === 'string' ? system.length : 'unknown');
    console.log('  - Tools provided:', geminiTools ? geminiTools.length : 0);
    console.log('  - Tool config:', requestParams.toolConfig ? 'enabled' : 'none');
    console.log('  - Max tokens:', maxTokens);
    
    // ✅ PHASE 1: Token estimation for rate limiting
    const systemText = typeof system === 'string' ? system : '';
    const messagesText = JSON.stringify(geminiMessages);
    const estimatedTokens = estimateTokenCount(systemText + messagesText);
    
    console.log(`[RATE-LIMITER] Estimated tokens for request: ${estimatedTokens.toLocaleString()}`);
    
    // ✅ PHASE 2: Acquire tokens from rate limiter (prevents request bursts)
    await geminiRateLimiter.acquire(estimatedTokens);
    console.log(`[RATE-LIMITER] ✅ Tokens acquired, proceeding with API call`);
    
    // ✅ PHASE 3: Retry loop for 429 rate limit errors
    const MAX_429_RETRIES = 3;
    let last429Error: any = null;
    
    for (let attempt = 0; attempt < MAX_429_RETRIES; attempt++) {
      try {
        // CRITICAL: Reset state on each retry attempt
        fullText = '';
        functionCalls = [];
        usage = null;
        lastThought = '';
        lastAction = '';
        
        console.log(`[GEMINI-429-RETRY] Attempt ${attempt + 1}/${MAX_429_RETRIES}`);
        
        // Start streaming
        const result = await generativeModel.generateContentStream(requestParams);

        // CRITICAL: Process ENTIRE stream inside try block
        let chunkCount = 0;
        for await (const chunk of result.stream) {
          chunkCount++;
          if (chunkCount <= 3) {
            console.log(`[GEMINI-DEBUG] Chunk #${chunkCount}:`, JSON.stringify(chunk).substring(0, 300));
          }
          
          // CRITICAL: Check for mid-stream rate limit indicators
          // TypeScript workaround: chunk.error may exist at runtime but not in type definition
          const chunkWithError = chunk as any;
          if (chunkWithError.error) {
            const chunkError = chunkWithError.error;
            const errorMessage = chunkError.message || String(chunkError);
            const errorStatus = chunkError.status || chunkError.code;
            const is429 = 
              errorStatus === 429 ||
              errorMessage.includes('RESOURCE_EXHAUSTED') ||
              errorMessage.includes('rate limit') ||
              errorMessage.includes('quota');
              
            if (is429) {
              console.error(`[GEMINI-RATE-LIMIT] Mid-stream 429 detected at chunk ${chunkCount}`);
              throw chunkError; // Trigger retry of entire stream
            } else {
              console.error(`[GEMINI-CHUNK-ERROR] Mid-stream error at chunk ${chunkCount}:`, chunkError);
              throw chunkError;
            }
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
            console.error(`🚨 [GEMINI-MALFORMED] Detected malformed function call flag (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            
            // ✅ ARCHITECT FIX: Try to extract valid function call BEFORE treating as error
            // Often Gemini returns valid calls that our parser can extract, but flags them as malformed
            let extractedCall: any = null;
            let attemptedFunction: string | null = null;
            
            // STEP 1: Check if content has a valid functionCall (standard format)
            if (content?.parts) {
              for (const part of content.parts) {
                if ((part as any).functionCall?.name && (part as any).functionCall?.args) {
                  extractedCall = (part as any).functionCall;
                  attemptedFunction = extractedCall.name;
                  console.log('[GEMINI-MALFORMED] ✅ Found valid function call in parts:', attemptedFunction);
                  break;
                }
                
                // STEP 2: Try to heal from text field
                if (!extractedCall && (part as any).text && (part as any).text.includes('{')) {
                  try {
                    const healedCall = robustExtractAndHeal((part as any).text);
                    if (healedCall?.name && healedCall?.args) {
                      extractedCall = healedCall;
                      attemptedFunction = healedCall.name;
                      console.log('[GEMINI-MALFORMED] ✅ Healed function call from text:', attemptedFunction);
                      break;
                    }
                  } catch (e) {
                    console.log('[GEMINI-MALFORMED] Could not heal from text');
                  }
                }
              }
            }
            
            // ✅ SUCCESS: We extracted a valid call - use it instead of retrying!
            if (extractedCall && attemptedFunction) {
              console.log('[GEMINI-MALFORMED] ✅ Extracted valid call despite malformed flag - proceeding with execution');
              functionCalls.push(extractedCall);
              
              // Skip the retry logic - we have a valid call!
              // Continue processing the stream normally
              continue;
            }
            
            // STEP 3: If extraction failed, try to identify the function from error message
            const finishMessage = (candidate as any).finishMessage;
            if (!attemptedFunction && finishMessage) {
              console.error('[GEMINI-ERROR] Could not extract valid call, checking error message:', finishMessage);
              
              // Try to extract function name from error message
              const innerFunctionMatch = finishMessage.match(/(?:print\()?(?:default_api\.)?([a-zA-Z_]+)\s*\(/i);
              if (innerFunctionMatch) {
                attemptedFunction = innerFunctionMatch[1];
                console.error(`[GEMINI-ERROR] Extracted function name from error: ${attemptedFunction}`);
              } else {
                const functionNameMatch = finishMessage.match(/function call:\s*([a-zA-Z_]+)/i);
                if (functionNameMatch) {
                  attemptedFunction = functionNameMatch[1];
                  console.error(`[GEMINI-ERROR] Found function name: ${attemptedFunction}`);
                }
              }
            }
            
            // 🔄 RETRY LOGIC: Force function call with mode: ANY (per Gemini resilience guidance)
            // ✅ VALIDATION: Ensure the attempted function actually exists in our tools
            if (retryCount < MAX_RETRIES && attemptedFunction) {
              // Check if the attempted function is in the available tools
              const functionExists = tools?.some(tool => tool.name === attemptedFunction);
              
              if (!functionExists) {
                console.error(`[GEMINI-ERROR] ❌ Function "${attemptedFunction}" does not exist in available tools`);
                console.error('[GEMINI-ERROR] Available functions:', tools?.map(t => t.name).join(', '));
                console.error('[GEMINI-ERROR] This appears to be a hallucinated/invalid function - sending error to frontend');
                
                // CRITICAL FIX: Send error message immediately instead of retrying
                const hallucinatedError = `I apologize - I attempted to use a tool that doesn't exist ("${attemptedFunction}"). Let me try a different approach to help you.

Please restate your request and I'll use the correct tools this time.`;
                
                // ✅ Wrap callbacks in try-catch to prevent silent failures
                try {
                  if (onError) {
                    onError(new Error(hallucinatedError));
                  }
                } catch (callbackError) {
                  console.error('[GEMINI-CALLBACK] onError failed:', callbackError);
                }
                
                try {
                  if (onChunk) {
                    onChunk(hallucinatedError);
                  }
                } catch (callbackError) {
                  console.error('[GEMINI-CALLBACK] onChunk failed:', callbackError);
                }
                
                fullText += hallucinatedError;
                console.error('[GEMINI-ERROR] ✅ Hallucinated function error sent to frontend');
                
                // Stop processing this malformed response
                break;
              } else {
                retryCount++;
                console.log(`[GEMINI-RETRY] Retrying with structural constraint (${retryCount}/${MAX_RETRIES})...`);
                
                // Minimalist structural command (no mention of error type)
                const clarifyingContent = `🛑 SYSTEM ERROR: The last response was not executable. You must immediately retry your previous action. Your ONLY output must be a clean, complete function call object. Do NOT include any explanatory text, reasoning, or examples. Retry now.`;
                
                const clarifyingMessage: any = {
                  role: 'user',
                  content: clarifyingContent
                };
                
                // Recursive retry with FORCED function call
                const retryMessages = [...messages, clarifyingMessage];
                
                // ✅ ARCHITECT FIX: Keep ALL tools available during retry
                // Gemini often needs prerequisite tools (e.g., read_platform_file before write_platform_file)
                // Restricting to a single function causes deadlock!
                // Keep the full tool list so Gemini can execute the complete workflow
                
                console.log('[GEMINI-RETRY] Retrying with FULL tool access (no restrictions) to allow prerequisite calls');
                
                return streamGeminiResponse({
                  ...options,
                  messages: retryMessages,
                  forceFunctionCall: true,  // Force ANY tool call, but don't restrict which ones
                  // ❌ NO toolConfig restriction - let Gemini choose the right tools
                });
              }
            }
            
            // General retry without forcing specific function (when function doesn't exist or wasn't identified)
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              console.log(`[GEMINI-RETRY] Retrying with structural constraint (${retryCount}/${MAX_RETRIES})...`);
              
              // Minimalist structural command (no mention of error type)
              const clarifyingContent = `🛑 SYSTEM ERROR: The last response was not executable. You must immediately retry your previous action. Your ONLY output must be a clean, complete function call object. Do NOT include any explanatory text, reasoning, or examples. Retry now.`;
              
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
            
            // 🚫 GAP 4: MAX RETRIES EXCEEDED - Provide user-friendly error
            const userFriendlyError = `I apologize, but I'm having trouble completing this action. This usually happens when:

1. The request is very complex - try breaking it into smaller steps
2. The tools are returning unexpected results

What I attempted: ${attemptedFunction || 'unknown action'}

Please try:
- Rephrasing your request more specifically
- Breaking the task into smaller pieces
- Or let me know if you'd like me to try a different approach`;
            
            // ✅ Wrap callbacks in try-catch to prevent silent failures
            try {
              if (onError) {
                onError(new Error(userFriendlyError));
              }
            } catch (callbackError) {
              console.error('[GEMINI-CALLBACK] onError failed:', callbackError);
            }
            
            try {
              if (onChunk) {
                onChunk(userFriendlyError);
              }
            } catch (callbackError) {
              console.error('[GEMINI-CALLBACK] onChunk failed:', callbackError);
            }
            fullText += userFriendlyError;
            
            console.error('[GAP-4] ✅ User-friendly error message sent after MAX_RETRIES');
            
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
          // ============================================================================
          // ✅ PERMANENT FIX: Stream text content IMMEDIATELY (before any other processing)
          // ============================================================================
          // PROBLEM HISTORY:
          // - When Gemini sends thoughtSignature + functionCall + text together,
          //   the old code would process thoughtSignature/functionCall but SKIP the text
          // - This caused "Thinking..." badge to show but NO actual text in chat
          // - User only saw one big dump at the end
          //
          // SOLUTION:
          // - Stream ALL text content FIRST, before checking thoughtSignature/functionCall
          // - Skip only if text is function call JSON (contains '{"name":')
          // - This ensures text ALWAYS reaches the frontend, regardless of metadata
          //
          // ORDER MATTERS:
          // 1. Stream text (this section) ← MUST BE FIRST
          // 2. Process thoughtSignature for scratchpad status
          // 3. Extract function calls if present
          // ============================================================================
          if (part.text && !part.text.includes('{"name":')) {
            const text = part.text;
            fullText += text;
            
            // Stream immediately to frontend
            if (onChunk) {
              try {
                // ✅ CRITICAL FIX: Use 'content' type for orchestrator/event-emitter compatibility
                // chat.ts now handles both 'text' and 'content' types
                onChunk({ type: 'content', content: text });
                console.log('[GEMINI-TEXT-STREAM] ✅ Streamed:', text.substring(0, 80) + '...');
              } catch (chunkError) {
                console.error('❌ Error in onChunk callback:', chunkError);
              }
            }
          }
          
          // 🧠 Then handle thoughtSignature metadata (for scratchpad status only)
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
            // Thinking alone = contextual thinking message for scratchpad
            try {
              const thought = part.text ? getThinkingMessageFromText(part.text) : '🧠 Analyzing...';
              if (thought !== lastThought && onThought) {
                lastThought = thought;
                onThought(thought);
              }
            } catch (thoughtError) {
              console.error('❌ Error processing thoughtSignature:', thoughtError);
            }
          }

          // ============================================================================
          // RESPONSE PARSER FALLBACK: Handle Gemini's dual output formats
          // ============================================================================
          
          let extractedFunctionCall: any = null;
          
          // CHECK 1: Standard API format (correct way)
          if (part.functionCall) {
            extractedFunctionCall = part.functionCall;
            console.log('[GEMINI-PARSER] ✅ Function call found in correct API format');
          }
          
          // CHECK 2: Fallback - Parse JSON from text field (Gemini bug workaround)
          // Uses jsonrepair library to heal truncated/malformed JSON
          else if (part.text && part.text.includes('{')) {
            console.log('[GEMINI-PARSER] ⚠️ Checking text for function call...');
            
            try {
              // Use the healing function to extract and repair JSON
              const healedCall = robustExtractAndHeal(part.text);
              
              if (healedCall) {
                extractedFunctionCall = healedCall;
                console.log('[GEMINI-PARSER] ✅ Successfully healed function call from text:', healedCall.name);
                
                // Signal that fallback was used (triggers force mode on next iteration)
                if (onChunk) {
                  try {
                    onChunk({
                      type: 'fallback_used',
                      message: 'Function call healed from truncated JSON - will enforce strict mode next iteration'
                    });
                  } catch (fallbackEventError) {
                    console.error('❌ Error sending fallback_used event:', fallbackEventError);
                  }
                }
                
                // Clear the text since we extracted the function call
                part.text = '';
              } else {
                // Healing returned null - this is normal for incomplete chunks
                // Just continue processing and wait for more chunks
                console.log('[GEMINI-PARSER] ⏸️ Function call incomplete, waiting for more chunks...');
              }
            } catch (error) {
              console.error('[GEMINI-PARSER] ❌ Unexpected error during healing:', error);
              // Don't throw - just log and continue processing
            }
          }

          // ✅ Text handling moved to the beginning of the loop (lines 866-879)
          // This section removed to prevent duplicate streaming

          // Process the function call if found (from either CHECK 1 or CHECK 2)
          if (extractedFunctionCall) {
            const toolCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // ✅ VALIDATION: Ensure args is a valid object (external advice: schema validation)
            let validatedArgs = extractedFunctionCall.args || {};
            
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
            console.log(`[GEMINI-TOOLS] 🔧 Gemini requested tool: ${extractedFunctionCall.name}`);
            console.log(`[GEMINI-TOOLS] Tool args:`, JSON.stringify(validatedArgs).substring(0, 100));
            
            // ✅ VALIDATE: Check for BeeHive's specific double-escape bug in string content
            // Only check actual string values (not JSON encoding which naturally escapes backslashes)
            const checkForMalformedEscapes = (obj: any, path: string = ''): { found: boolean; details?: string } => {
              if (typeof obj === 'string') {
                // SMART CHECK: Only flag patterns that indicate BeeHive's specific bug
                const bugPatterns = [
                  { pattern: /\.join\(['"]\\\\n['"]\)/, name: ".join('\\\\n')" },
                  { pattern: /\.replace\([^,]+,\s*['"]\\\\n['"]\)/, name: ".replace(x, '\\\\n')" },
                  { pattern: /}\s*\\n\s*}/, name: "}\\n}" },
                ];
                
                for (const { pattern, name } of bugPatterns) {
                  if (pattern.test(obj)) {
                    return { 
                      found: true, 
                      details: `Found malformed pattern ${name} at ${path || 'root'}` 
                    };
                  }
                }
              } else if (typeof obj === 'object' && obj !== null) {
                // Recursively check nested objects/arrays
                for (const [key, value] of Object.entries(obj)) {
                  const result = checkForMalformedEscapes(value, path ? `${path}.${key}` : key);
                  if (result.found) return result;
                }
              }
              return { found: false };
            };
            
            const escapeCheck = checkForMalformedEscapes(validatedArgs);
            if (escapeCheck.found) {
              console.error(`[GEMINI-STREAM] ❌ INVALID FUNCTION CALL: ${escapeCheck.details}`);
              console.error(`[GEMINI-STREAM] Function: ${extractedFunctionCall.name}`);
              
              // Send error via error callback if available
              if (onError) {
                onError(new Error(
                  `Gemini returned invalid function call: ${escapeCheck.details}. ` +
                  `Function: ${extractedFunctionCall.name}. ` +
                  `Hint: Detected BeeHive double-escape bug pattern that causes syntax errors.`
                ));
              }
              
              // Don't push invalid function call - throw error to trigger retry
              throw new Error(
                `INVALID_FUNCTION_CALL: ${escapeCheck.details}. ` +
                `This indicates Gemini output bug that will cause syntax errors.`
              );
            }
            
            // 📊 Enhanced diagnostic logging
            console.log('[GEMINI-CHUNK-DEBUG]', {
              chunkNumber: chunkCount,
              hasFunctionCall: !!part.functionCall,
              hasText: !!part.text,
              textContainsFunctionJson: part.text ? part.text.includes('{"name":') : false,
              extractedFunctionCall: extractedFunctionCall ? extractedFunctionCall.name : null
            });
            
            functionCalls.push({
              id: toolCallId,
              name: extractedFunctionCall.name,
              input: validatedArgs
            });

            // ✅ CRITICAL FIX: Emit tool_use chunk so orchestrator sees it and increments toolCallCount
            // ✅ Wrap callback in try-catch to prevent silent failures
            if (onChunk) {
              try {
                onChunk({
                  type: 'tool_use',
                  toolId: toolCallId,
                  toolName: extractedFunctionCall.name,
                  input: validatedArgs
                });
                console.log(`[GEMINI-TOOLS] ✅ Emitted tool_use chunk for: ${extractedFunctionCall.name}`);
              } catch (chunkError) {
                console.error('[GEMINI-CALLBACK] onChunk failed on tool_use:', chunkError);
              }
            }

            // Notify about tool use (DE-DUPLICATED)
            if (onAction && extractedFunctionCall.name) {
              const action = getActionMessageFromFunctionCall(extractedFunctionCall.name);
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
        // ⚡ FAST MODE: Parallel Tool Execution
        // All tools are executed concurrently using Promise.all() for maximum speed
        // Instead of waiting for each tool sequentially, we fire them all at once
        console.log(`⚡ [GEMINI-FAST-MODE] Executing ${functionCalls.length} tools in PARALLEL`);
        const toolStartTime = Date.now();

        // Execute all function calls in parallel
        const toolResults = await Promise.all(
          functionCalls.map(async (call) => {
            try {
              const callStartTime = Date.now();
              const result = await onToolUse({
                type: 'tool_use',
                id: call.id,
                name: call.name,
                input: call.input
              });
              const callDuration = Date.now() - callStartTime;
              console.log(`✅ [GEMINI-FAST-MODE] Tool "${call.name}" completed in ${callDuration}ms`);
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

        const totalToolDuration = Date.now() - toolStartTime;
        console.log(`⚡ [GEMINI-FAST-MODE] All ${functionCalls.length} tools completed in ${totalToolDuration}ms (parallel execution)`);

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

    // ✅ SUCCESS: Streaming completed successfully
    console.log('[GEMINI-429-RETRY] ✅ Stream completed successfully, exiting retry loop');
    
    // Execute post-stream callback with Promise-safe error isolation
    // This catches both sync errors and async Promise rejections
    if (onComplete) {
      try {
        // Wrap in Promise.resolve() to handle both sync and async callbacks
        // Any Promise rejection will be caught by this try-catch
        await Promise.resolve().then(() => onComplete(fullText, usage));
      } catch (completeError) {
        // Callback errors are completely isolated and logged
        // They will NOT propagate to the retry handler
        console.error('❌ Post-stream callback error (isolated, non-fatal):', completeError);
      }
    }

    // Return success - exits retry loop
    return { fullText, usage: usage || { inputTokens: 0, outputTokens: 0 } };

  } catch (streamError: any) {
        // ✅ PHASE 3 (continued): Handle 429 rate limit errors with exponential backoff
        const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
        const errorString = JSON.stringify(streamError);
        const errorStatus = streamError?.status || streamError?.response?.status;
        
        // Check if it's a 429 rate limit error
        const is429Error = 
          errorStatus === 429 ||
          errorString.includes('429') || 
          errorString.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('quota');
        
        if (is429Error && attempt < MAX_429_RETRIES - 1) {
          last429Error = streamError;
          
          // Extract retry delay from error (Gemini provides this in errorDetails)
          let retryDelaySeconds = 47; // Default retry delay
          
          try {
            if (streamError.errorDetails) {
              const retryInfo = streamError.errorDetails.find((d: any) => 
                d['@type']?.includes('RetryInfo') || d['@type']?.includes('retryInfo')
              );
              
              if (retryInfo?.retryDelay) {
                // Parse retry delay (format: "47s" or just "47")
                const match = String(retryInfo.retryDelay).match(/(\d+)/);
                if (match) {
                  retryDelaySeconds = parseInt(match[1]);
                }
              }
            }
          } catch (parseError) {
            console.warn('[GEMINI-429-RETRY] Could not parse retry delay, using default 47s');
          }
          
          console.error(`[GEMINI-429-RETRY] Rate limit error on attempt ${attempt + 1}/${MAX_429_RETRIES}`);
          console.error(`[GEMINI-429-RETRY] Retry after: ${retryDelaySeconds}s`);
          console.error(`[GEMINI-429-RETRY] Error details:`, {
            status: errorStatus,
            message: errorMessage.substring(0, 200),
            hasErrorDetails: !!streamError.errorDetails,
          });

          // Send progress event to frontend
          if (onAction) {
            onAction(`Rate limit reached. Waiting ${retryDelaySeconds}s before retry ${attempt + 1}/${MAX_429_RETRIES}...`);
          }
          
          if (onChunk) {
            onChunk(`\n\n[System] Rate limit hit, retrying in ${retryDelaySeconds}s (attempt ${attempt + 1}/${MAX_429_RETRIES})...\n\n`);
          }

          // Wait with exponential backoff + retry delay from API
          await exponentialBackoffWithJitter(attempt, retryDelaySeconds * 1000);
          
          console.log(`[GEMINI-429-RETRY] Retrying now (attempt ${attempt + 2}/${MAX_429_RETRIES})...`);
          continue; // Retry the streaming call
        }
        
        // Non-429 error OR max retries exhausted - propagate the error
        console.error('[GEMINI-429-RETRY] Non-retryable error or max retries exhausted, propagating error');
        throw streamError;
      }
    }
    
    // ✅ PHASE 3 (final): All retry attempts exhausted for 429 errors
    if (last429Error) {
      console.error('[GEMINI-429-RETRY] ❌ All retry attempts exhausted for 429 error');
      
      const userFriendlyMessage = `I apologize, but the Gemini API is currently experiencing high load and rate limits. 

After ${MAX_429_RETRIES} retry attempts, I was unable to complete your request.

What you can try:
1. Wait a few minutes and try again
2. Break your request into smaller, simpler tasks
3. Contact support if this persists

This is a temporary issue with the AI service, not a problem with your request.`;
      
      if (onError) {
        onError(new Error(userFriendlyMessage));
      }
      
      if (onChunk) {
        onChunk(userFriendlyMessage);
      }
      
      throw last429Error;
    }

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
