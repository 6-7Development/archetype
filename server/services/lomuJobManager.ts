import { db } from '../db';
import { lomuJobs, lomuWorkflowMetrics, users, subscriptions, chatMessages, taskLists, tasks, projects, platformIncidents } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { WebSocketServer } from 'ws';
import { streamGeminiResponse } from '../gemini';
import Anthropic from '@anthropic-ai/sdk';
import { platformHealing } from '../platformHealing';
import { platformAudit } from '../platformAudit';
import { trackAIUsage } from '../usage-tracking';
import { consultArchitect } from '../tools/architect-consult';
import { executeWebSearch } from '../tools/web-search';
import { getGitHubService } from '../githubService';
import { createTaskList, updateTask, readTaskList } from '../tools/task-management';
import { performDiagnosis } from '../tools/diagnosis';
import { startSubagent } from '../subagentOrchestration';
import { healthMonitor } from './healthMonitor';
import { AgentFailureDetector } from './agentFailureDetector';
import { WorkflowValidator } from './workflowValidator';
import { EnforcementOrchestrator } from '../lib/enforcementOrchestrator';
import { WorkflowMetricsTracker } from './workflowMetricsTracker';
import * as fs from 'fs/promises';
import * as path from 'path';
import { storage } from '../storage';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Initialize Anthropic client for Claude streaming
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy-key-for-development",
});

interface JobContext {
  jobId: string;
  userId: string;
  conversation: any[];
  lastIteration: number;
  taskListId?: string;
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
 * Stream Claude AI responses with real-time chunk processing
 * Compatible with streamGeminiResponse interface for drop-in replacement
 */
async function streamClaudeResponse(options: StreamOptions) {
  const {
    model = 'claude-sonnet-4-20250514',
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
  let contentBlocks: any[] = [];
  let abortHandler: (() => void) | null = null;

  try {
    if (signal?.aborted) {
      throw new Error('Request aborted before starting');
    }

    // Prepare Claude API request
    const requestParams: any = {
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages,
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestParams.tools = tools;
      console.log(`[CLAUDE-TOOLS] ✅ Provided ${tools.length} tools to Claude (first 3: ${tools.slice(0, 3).map((t: any) => t.name).join(', ')}...)`);
    }

    // Set up abort handler
    if (signal) {
      abortHandler = () => {
        console.log('[CLAUDE-STREAM] Stream aborted by signal');
      };
      signal.addEventListener('abort', abortHandler);
    }

    // Start streaming with Claude
    const stream = await anthropic.messages.stream(requestParams);

    // Process stream events
    stream.on('text', (text: string, snapshot: any) => {
      fullText += text;

      // Send chunk callback
      if (onChunk) {
        try {
          onChunk({ type: 'chunk', content: text });
        } catch (chunkError) {
          console.error('❌ Error in onChunk callback:', chunkError);
        }
      }

      // Detect thoughts
      try {
        if (text.toLowerCase().includes('thinking:') || 
            text.includes('🤔') || 
            /\b(analyzing|considering|evaluating)\b/i.test(text)) {
          currentThought += text;
          if (onThought && currentThought.trim().length > 0) {
            onThought(currentThought.trim());
          }
        }
      } catch (thoughtError) {
        console.error('❌ Error detecting thoughts:', thoughtError);
      }

      // Detect actions
      try {
        if (/step \d+|action:|analyzing|generating|building|creating|optimizing|validating|testing/i.test(text)) {
          currentAction += text;
          if (onAction && currentAction.trim().length > 0) {
            onAction(currentAction.trim());
          }
        }
      } catch (actionError) {
        console.error('❌ Error detecting actions:', actionError);
      }
    });

    (stream as any).on('content_block_start', (block: any) => {
      if (block.content_block.type === 'tool_use') {
        const toolUse = block.content_block;
        console.log(`[CLAUDE-TOOLS] 🔧 Claude requested tool: ${toolUse.name}`);
        
        // Notify about tool use
        if (onAction && toolUse.name) {
          const toolMessages: Record<string, string> = {
            'browser_test': '🧪 Testing in browser...',
            'web_search': '🔍 Searching for solutions...',
            'vision_analyze': '👁️ Analyzing visuals...',
            'architect_consult': '🧑‍💼 Consulting architect...',
            'readPlatformFile': '📖 Reading platform code...',
            'writePlatformFile': '✏️ Fixing platform code...',
          };
          const message = toolMessages[toolUse.name] || `🔨 Working on ${toolUse.name}...`;
          onAction(message);
        }
      }
    });

    // Wait for the stream to complete and get final message
    const finalMessage = await stream.finalMessage();
    
    // Extract usage stats
    if (finalMessage.usage) {
      usage = {
        inputTokens: finalMessage.usage.input_tokens || 0,
        outputTokens: finalMessage.usage.output_tokens || 0,
      };
    }

    // Process content blocks for tool calls
    const toolCalls: any[] = [];
    finalMessage.content.forEach((block: any) => {
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input
        });
        contentBlocks.push(block);
      } else if (block.type === 'text') {
        contentBlocks.push(block);
      }
    });

    // Execute tools if Claude requested them
    if (toolCalls.length > 0 && onToolUse) {
      try {
        if (onAction) {
          const actionMessage = toolCalls.length === 1 
            ? '🔨 Running checks...' 
            : `🔨 Running ${toolCalls.length} checks...`;
          onAction(actionMessage);
        }

        // Execute all tool calls
        const toolResults = await Promise.all(
          toolCalls.map(async (call) => {
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
                content: typeof result === 'string' ? result : JSON.stringify(result),
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
          assistantContent: toolCalls.map(call => ({
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
    console.error('❌ Fatal error in Claude streaming:', error);

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
  }
}

// In-memory active jobs (prevent concurrent jobs per user)
const activeJobs = new Map<string, Promise<void>>();

// WebSocket server reference (will be set on initialization)
let wss: WebSocketServer | null = null;

/**
 * Initialize the job manager with WebSocket server reference
 */
export function initializeJobManager(websocketServer: WebSocketServer) {
  wss = websocketServer;
  console.log('[LOMU-AI-JOB-MANAGER] Initialized with WebSocket support');
}

/**
 * Broadcast job updates to the user via WebSocket
 */
function broadcast(userId: string, jobId: string, type: string, data: any) {
  if (!wss) {
    console.warn('[LOMU-AI-JOB-MANAGER] WebSocket not initialized, skipping broadcast');
    return;
  }

  wss.clients.forEach((client: any) => {
    if (client.readyState === 1 && client.userId === userId) {
      client.send(JSON.stringify({
        type: 'lomu_ai_job_update',
        jobId,
        updateType: type,
        ...data,
      }));
    }
  });
}

/**
 * Create a new LomuAI job
 */
export async function createJob(userId: string, initialMessage: string) {
  // 🛡️ SAFETY CHECK - Don't create jobs for simple conversational messages
  if (isSimpleMessage(initialMessage)) {
    throw new Error('Simple conversational messages should not create jobs. Please respond directly instead.');
  }

  // Check for existing active job
  const existingJob = await db.query.lomuJobs.findFirst({
    where: (jobs, { and, eq, inArray }) => and(
      eq(jobs.userId, userId),
      inArray(jobs.status, ['pending', 'running'])
    )
  });

  if (existingJob) {
    throw new Error('You already have an active LomuAI job. Please wait or resume it.');
  }

  // Create new job
  const [job] = await db.insert(lomuJobs).values({
    userId,
    status: 'pending',
    conversationState: [{ role: 'user', content: initialMessage }],
    metadata: { initialMessage },
  }).returning();

  console.log('[LOMU-AI-JOB-MANAGER] Created job:', job.id, 'for user:', userId);
  return job;
}

/**
 * Start the job worker in the background
 */
export async function startJobWorker(jobId: string) {
  // Check if already running
  if (activeJobs.has(jobId)) {
    console.log('[LOMU-AI-JOB-MANAGER] Job already running:', jobId);
    return;
  }

  console.log('[LOMU-AI-JOB-MANAGER] Starting worker for job:', jobId);

  const jobPromise = runMetaSysopWorker(jobId);
  activeJobs.set(jobId, jobPromise);
  
  jobPromise.finally(() => {
    activeJobs.delete(jobId);
    console.log('[LOMU-AI-JOB-MANAGER] Worker completed for job:', jobId);
  });
}

/**
 * Save checkpoint for job resumption
 */
export async function saveCheckpoint(
  jobId: string, 
  conversation: any[], 
  iteration: number, 
  taskListId?: string
) {
  await db.update(lomuJobs)
    .set({
      conversationState: conversation,
      lastIteration: iteration,
      taskListId,
      updatedAt: new Date()
    })
    .where(eq(lomuJobs.id, jobId));
  
  console.log(`[LOMU-AI-JOB-MANAGER] Saved checkpoint for job ${jobId} at iteration ${iteration}`);
}

// SECURITY: Validate project file paths to prevent path traversal attacks
function validateProjectPath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path: path is required');
  }

  const normalized = path.normalize(filePath);

  if (normalized.includes('..')) {
    throw new Error('Path traversal detected: paths cannot contain ".."');
  }

  if (path.isAbsolute(normalized)) {
    throw new Error('Absolute paths are not allowed: path must be relative to project root');
  }

  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    throw new Error('Paths cannot start with / or \\');
  }

  return normalized;
}

/**
 * Detect simple conversational messages that don't need tasks
 * EXPORTED for use in route handlers to prevent unnecessary job creation
 */
export function isSimpleMessage(msg: string): boolean {
  const trimmed = msg.trim().toLowerCase();
  
  // Greetings
  if (/^(hi|hey|hello|yo|sup|howdy|greetings)[\s!.]*$/.test(trimmed)) return true;
  
  // Thanks
  if (/^(thanks?|thank you|thx|ty)[\s!.]*$/.test(trimmed)) return true;
  
  // Yes/No
  if (/^(yes|no|ok|okay|nope|yep|yeah|nah)[\s!.]*$/.test(trimmed)) return true;
  
  // Questions about LomuAI
  if (/^(who are you|what (are|can) you|what do you do)[\s?!.]*$/.test(trimmed)) return true;
  
  // Very short messages (< 15 chars) that aren't commands
  if (trimmed.length < 15 && !/(fix|check|diagnose|update|deploy|commit|push)/.test(trimmed)) return true;
  
  return false;
}

/**
 * Main worker function that runs the LomuAI conversation loop
 */
async function runMetaSysopWorker(jobId: string) {
  // 📊 METRICS TRACKER: Declare outside try block for catch block access
  let metricsTracker: WorkflowMetricsTracker | undefined;
  
  try {
    // Fetch the job
    const [job] = await db
      .select()
      .from(lomuJobs)
      .where(eq(lomuJobs.id, jobId))
      .limit(1);

    if (!job) {
      console.error('[LOMU-AI-JOB-MANAGER] Job not found:', jobId);
      return;
    }

    const userId = job.userId;
    const message = (job.metadata as any).initialMessage;
    const projectId = (job.metadata as any).projectId || null;
    const autoCommit = (job.metadata as any).autoCommit || false;
    const autoPush = (job.metadata as any).autoPush || false;

    // Update status to running
    await db.update(lomuJobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(lomuJobs.id, jobId));

    console.log('[LOMU-AI-JOB-MANAGER] Job started:', jobId);
    
    // Broadcast job started
    broadcast(userId, jobId, 'job_started', {
      status: 'running',
      message: 'LomuAI job started...',
    });

    // Get Gemini API key
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Fetch user's autonomy level
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const autonomyLevel = user?.autonomyLevel || 'basic';
    console.log(`[LOMU-AI-JOB-MANAGER] User autonomy level: ${autonomyLevel}`);

    // Determine autonomy level capabilities
    const levelConfig = {
      basic: { maxTokens: 8000, allowTaskTracking: false, allowWebSearch: false, allowSubAgents: false, requireApproval: true, allowCommit: false },
      standard: { maxTokens: 8000, allowTaskTracking: true, allowWebSearch: false, allowSubAgents: false, requireApproval: false, allowCommit: true },
      deep: { maxTokens: 16000, allowTaskTracking: true, allowWebSearch: true, allowSubAgents: true, requireApproval: false, allowCommit: true },
      max: { maxTokens: 16000, allowTaskTracking: true, allowWebSearch: true, allowSubAgents: true, requireApproval: false, allowCommit: true },
    };
    const config = levelConfig[autonomyLevel as keyof typeof levelConfig] || levelConfig.basic;

    // Initialize from saved state or create new conversation
    let conversationMessages: any[] = job.conversationState || [];
    let iterationCount = job.lastIteration || 0;
    let activeTaskListId = job.taskListId || undefined;

    // 🔄 ENFORCEMENT ORCHESTRATOR: Initialize all 6 enforcement layers + I AM Architect guidance
    const enforcementOrchestrator = new EnforcementOrchestrator();
    enforcementOrchestrator.initializeJob(jobId);
    console.log('[ENFORCEMENT-ORCHESTRATOR] Initialized for job:', jobId, '(autoCommit:', autoCommit, ')');
    
    // 🔄 WORKFLOW VALIDATOR: Keep for backward compatibility (temporary)
    const workflowValidator = new WorkflowValidator('assess', true);
    workflowValidator.updateContext({ autoCommit });
    console.log('[WORKFLOW-VALIDATOR] Initialized for job:', jobId, '(autoCommit:', autoCommit, ')');

    // 📊 METRICS TRACKER: Initialize metrics collection for workflow performance tracking
    metricsTracker = new WorkflowMetricsTracker(jobId, userId);
    metricsTracker?.recordPhaseTransition('assess');
    console.log('[METRICS-TRACKER] Initialized for job:', jobId);

    // If resuming, notify user
    if (iterationCount > 0) {
      broadcast(userId, jobId, 'job_content', {
        jobId,
        content: `\n\n*Resuming from iteration ${iterationCount}...*\n\n`
      });
    }

    // 🎯 PRE-FILTER: Handle simple greetings/questions without calling Gemini
    const lowerMsg = message.toLowerCase().trim();
    const CONVERSATIONAL_PATTERNS = [
      { pattern: /^(hi|hello|hey|sup|what'?s up|yo)(\s|!|\?|\.)*$/i, response: "Hey! Ready to help you build something amazing. What are we working on?" },
      { pattern: /^(thanks|thank you|thx|ty)(\s|!|\?|\.)*$/i, response: "You're welcome! Let me know if you need anything else." },
      // PRECISE: Only "how" questions explicitly about feelings/state/wellbeing
      { pattern: /^how (are you|do you feel|does (it|that|this|the .* |.* )feel|is (it|that|this|the .* |.* )(feeling|going)).*$/i, response: "Feeling great and ready to build! The new updates make me much more capable. What would you like to create?" },
      { pattern: /^how'?s (it|everything|life) going.*$/i, response: "Feeling great and ready to build! The new updates make me much more capable. What would you like to create?" },
      { pattern: /^how'?re you( doing| feeling)?.*$/i, response: "Feeling great and ready to build! The new updates make me much more capable. What would you like to create?" },
      { pattern: /^(what (are|can) you|who are you|tell me about yourself).*$/i, response: "I'm LomuAI, your AI development teammate! I can build complete apps, fix bugs, write code, test with Playwright, and commit to GitHub. What do you want to build?" },
      { pattern: /^what does (the |that |this )?.* button do.*$/i, response: "The Clear button resets our conversation so we can start fresh. The New button starts a new healing session. Both help you work on different tasks!" },
    ];

    for (const { pattern, response } of CONVERSATIONAL_PATTERNS) {
      if (pattern.test(lowerMsg)) {
        console.log(`[LOMU-AI-PREFILTER] Matched conversational pattern: ${pattern.source}`);
        console.log(`[LOMU-AI-PREFILTER] Responding without calling Gemini`);
        
        const friendlyResponse = response;
        broadcast(userId, jobId, 'job_content', { content: friendlyResponse });
        
        // Mark job as completed immediately
        await db.update(lomuJobs)
          .set({ 
            status: 'completed',
            completedAt: new Date()
          })
          .where(eq(lomuJobs.id, jobId));
        
        broadcast(userId, jobId, 'job_completed', { 
          status: 'completed',
          content: friendlyResponse 
        });
        
        return; // Exit early - no Gemini call needed
      }
    }

    // Build system prompt - ULTRA-CONCISE: No rambling, immediate action, human tone
    const systemPrompt = `You are LomuAI - a senior developer who just gets things done.

${projectId ? 'Build complete applications from user requests.' : 'Fix bugs and maintain the Lomu platform.'}
Mode: ${autonomyLevel} | ${autoCommit ? 'Auto-commit enabled' : 'Manual commit mode'}

🚫 NEVER DO THIS:
- List your capabilities or say "I can help with..."
- Explain what you're going to do before doing it
- Use >5 words before calling tools
- Say "I have access to..." or "My tools include..."

✅ ALWAYS DO THIS:
- Start with "📋 Planning..." then IMMEDIATELY call createTaskList
- Be brief - let your work speak
- Sound like a colleague, not a robot

7-PHASE WORKFLOW (MANDATORY):

1. ASSESS: "🔍 Assessing..." → [silent file reading] → "✅ Assessment complete"
   • Read files/logs silently, NO explanations

2. PLAN: "📋 Planning..." → [createTaskList call IMMEDIATELY]
   • MANDATORY for every job (even 1-line fixes)
   • Format: createTaskList({title: "Goal", tasks: [{title, description}]})

3. EXECUTE: "⚡ Executing..." → [call tools IMMEDIATELY]
   • Max 5 words before tools
   • Batch multiple file operations in parallel

4. TEST: "🧪 Testing..." → [run tests]
   • Web: run_playwright_test
   • Backend: bash("npm test")
   • Python: bash("pytest")

5. VERIFY: "✓ Verifying..." → [check compilation/workflow]
   • TypeScript: bash("npx tsc --noEmit")
   • Must pass before claiming complete

6. CONFIRM: "✅ Complete" + 15 words max summary
   • Example: "Todo app built. Tests pass."
   • NO apologies, meta-commentary, or rambling

7. COMMIT: ${autoCommit ? '"📤 Committed to GitHub" (after Phase 5 passes)' : '"⏸️ Awaiting commit approval" (show changes, WAIT)'}

FAILURE CONDITIONS (auto-restart or escalate):
• Skip createTaskList → Restart Phase 2
• Skip tests → Restart Phase 4
• >5 words before tools → Restart Phase 3
• Fail same task 2x → Call architect_consult (mandatory)

COMMIT RULES:
${autoCommit ? 
  '• AUTO-COMMIT: Verify first (TypeScript + tests + workflow) → Then commit → Done' : 
  '• MANUAL: Show changes → STOP → WAIT for user approval'}
${!autoCommit && autonomyLevel === 'basic' ? 
  '\n• BASIC AUTONOMY: NEVER commit without explicit approval' : ''}

TOOL USAGE:
• Files: readPlatformFile, writePlatformFile, editPlatformFile
• Search: grep (not whole directory reads)
• Tasks: createTaskList (MANDATORY first step), updateTask
• Tests: run_playwright_test, bash("npm test")
• Architect: architect_consult (after 2 failures)

TONE: Friendly senior dev. Brief updates. No apologies. No "As an AI..." explanations.

Example workflow:
User: "Build todo app"
You: "📋 Planning..." [createTaskList immediately]
     "⚡ Executing..." [batch write files]
     "🧪 Testing..." [bash: npm test]
     "✓ Verifying..." [bash: npx tsc --noEmit]
     "✅ Complete. Todo app built. Tests pass."
${autoCommit ? '     "📤 Committed to GitHub"' : ''}

Let's build! 🚀`;

    // Define tools (full tool set from SSE route)
    const tools: any[] = [
      {
        name: 'createTaskList',
        description: '📋 CREATE TASK LIST - Create a visible task breakdown for work requests.',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const, description: 'Task list title' },
            tasks: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  title: { type: 'string' as const },
                  description: { type: 'string' as const },
                },
                required: ['title', 'description'],
              },
            },
          },
          required: ['title', 'tasks'],
        },
      },
      {
        name: 'updateTask',
        description: 'Update task status as you work',
        input_schema: {
          type: 'object' as const,
          properties: {
            taskId: { type: 'string' as const },
            status: { type: 'string' as const },
            result: { type: 'string' as const },
          },
          required: ['taskId', 'status'],
        },
      },
      {
        name: 'readTaskList',
        description: 'Read current task list',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'readPlatformFile',
        description: 'Read a platform source file. IMPORTANT: Use RELATIVE paths only (e.g., "replit.md", "server/index.ts"), NOT absolute paths',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const, description: 'Relative path from project root (e.g., "replit.md", NOT "/app/replit.md")' },
          },
          required: ['path'],
        },
      },
      {
        name: 'writePlatformFile',
        description: 'Write content to a platform file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const },
            content: { type: 'string' as const },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'listPlatformDirectory',
        description: 'List directory contents. IMPORTANT: Use RELATIVE paths only (e.g., ".", "server", "client/src"), NOT absolute paths',
        input_schema: {
          type: 'object' as const,
          properties: {
            directory: { type: 'string' as const, description: 'Relative path from project root (e.g., ".", "server"), use "." for root' },
          },
          required: ['directory'],
        },
      },
      {
        name: 'createPlatformFile',
        description: 'Create a new platform file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const },
            content: { type: 'string' as const },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'deletePlatformFile',
        description: 'Delete a platform file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const },
          },
          required: ['path'],
        },
      },
      {
        name: 'readProjectFile',
        description: 'Read a file from user project',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const },
          },
          required: ['path'],
        },
      },
      {
        name: 'writeProjectFile',
        description: 'Write to user project file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const },
            content: { type: 'string' as const },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'listProjectDirectory',
        description: 'List project files',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'createProjectFile',
        description: 'Create new project file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const },
            content: { type: 'string' as const },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'deleteProjectFile',
        description: 'Delete project file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string' as const },
          },
          required: ['path'],
        },
      },
      {
        name: 'perform_diagnosis',
        description: 'Analyze platform code for issues',
        input_schema: {
          type: 'object' as const,
          properties: {
            target: { type: 'string' as const },
            focus: {
              type: 'array' as const,
              items: { type: 'string' as const },
            },
          },
          required: ['target'],
        },
      },
      {
        name: 'read_logs',
        description: 'Read server logs',
        input_schema: {
          type: 'object' as const,
          properties: {
            lines: { type: 'number' as const },
            filter: { type: 'string' as const },
          },
          required: [],
        },
      },
      {
        name: 'execute_sql',
        description: 'Execute SQL query',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string' as const },
            purpose: { type: 'string' as const },
          },
          required: ['query', 'purpose'],
        },
      },
      {
        name: 'architect_consult',
        description: 'Consult I AM for guidance',
        input_schema: {
          type: 'object' as const,
          properties: {
            problem: { type: 'string' as const },
            context: { type: 'string' as const },
            proposedSolution: { type: 'string' as const },
            affectedFiles: {
              type: 'array' as const,
              items: { type: 'string' as const },
            },
          },
          required: ['problem', 'context', 'proposedSolution', 'affectedFiles'],
        },
      },
      {
        name: 'web_search',
        description: 'Search web for documentation',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string' as const },
            maxResults: { type: 'number' as const },
          },
          required: ['query'],
        },
      },
      {
        name: 'commit_to_github',
        description: 'Commit changes to GitHub',
        input_schema: {
          type: 'object' as const,
          properties: {
            commitMessage: { type: 'string' as const },
          },
          required: ['commitMessage'],
        },
      },
      {
        name: 'start_subagent',
        description: 'Delegate work to sub-agent',
        input_schema: {
          type: 'object' as const,
          properties: {
            task: { type: 'string' as const },
            relevantFiles: {
              type: 'array' as const,
              items: { type: 'string' as const },
            },
          },
          required: ['task', 'relevantFiles'],
        },
      },
    ];

    // Filter tools based on autonomy level and commit permissions
    let availableTools = tools;
    
    // BACKEND ENFORCEMENT: Remove commit_to_github if not allowed
    const canCommit = config.allowCommit && autoCommit;
    
    if (autonomyLevel === 'basic') {
      availableTools = tools.filter(tool => 
        tool.name !== 'readTaskList' && 
        tool.name !== 'updateTask' &&
        tool.name !== 'start_subagent' &&
        tool.name !== 'web_search' &&
        tool.name !== 'commit_to_github' // Basic users NEVER get commit tool
      );
    } else if (autonomyLevel === 'standard') {
      availableTools = tools.filter(tool => 
        tool.name !== 'start_subagent' &&
        tool.name !== 'web_search' &&
        (!canCommit && tool.name === 'commit_to_github' ? false : true) // Only allow if autoCommit enabled
      );
    } else if (autonomyLevel === 'deep') {
      availableTools = tools.filter(tool =>
        (!canCommit && tool.name === 'commit_to_github' ? false : true)
      );
    } else {
      // Max has everything if autoCommit enabled
      availableTools = tools.filter(tool =>
        (!canCommit && tool.name === 'commit_to_github' ? false : true)
      );
    }

    let fullContent = '';
    const fileChanges: Array<{ path: string; operation: string; contentAfter?: string }> = [];
    let continueLoop = true;
    const MAX_ITERATIONS = 10; // Reduced from 25 - prevents infinite loops
    let commitSuccessful = false;

    // 📊 WORKFLOW TELEMETRY: Track read vs code-modifying operations
    const READ_ONLY_TOOLS = new Set([
      'readPlatformFile', 'listPlatformDirectory', 'searchCode',
      'readProjectFile', 'listProjectDirectory', 'perform_diagnosis', 'read_logs', 'read_metrics',
      'readKnowledgeStore', 'searchKnowledgeStore', 'readTaskList',
      // Meta tools that don't modify code
      'createTaskList', 'updateTask', 'architect_consult', 'start_subagent', 'web_search',
      // REMOVED: 'bash' (can modify files via git commit, npm install, etc.)
      'execute_sql', // SQL can be read-only (SELECT) or modifying (INSERT/UPDATE/DELETE)
    ]);

    const CODE_MODIFYING_TOOLS = new Set([
      'writePlatformFile', 'editPlatformFile', 'createPlatformFile', 'deletePlatformFile',
      'writeProjectFile', 'createProjectFile', 'deleteProjectFile',
      'commit_to_github', 'packager_tool',
      'bash', // ADDED: can run git commit, file writes, npm install, etc.
    ]);

    const workflowTelemetry = {
      readOperations: 0,
      writeOperations: 0,
      consecutiveReadOnlyIterations: 0,
      hasProducedFixes: false,
      MAX_READ_ONLY_ITERATIONS: 5,
    };

    // 🔢 TOKEN TRACKING: Accumulate usage across all iterations
    let cumulativeInputTokens = 0;
    let cumulativeOutputTokens = 0;
    let totalToolCalls = 0; // Track total tool calls across all iterations
    const jobStartTime = Date.now();

    // Main conversation loop
    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      
      // FIX 1: Track iterations to enforce phase announcements
      workflowValidator.incrementIteration();

      broadcast(userId, jobId, 'job_progress', {
        message: `Analyzing (iteration ${iterationCount}/${MAX_ITERATIONS})...`
      });

      // 🔀 MODEL TOGGLE: Switch between Gemini and Claude based on environment variable
      const model = process.env.LOMU_AI_MODEL || 'gemini'; // 'gemini' or 'claude'
      console.log(`[LOMU-AI-JOB-MANAGER] Using model: ${model} (iteration ${iterationCount})...`);
      
      // Stream processing - collect content blocks
      const contentBlocks: any[] = [];
      let currentTextBlock = '';
      
      // 🚨 CONTINUOUS NARRATION GUARD: Monitor ALL text throughout streaming, not just pre-tool
      let textBeforeTools = '';
      let hasCalledToolYet = false;
      let violationInjected = false;
      let currentPhase = workflowValidator.getCurrentPhase();
      
      // ✅ FIX: Chunk-based grace period instead of time-based
      let hasJustCalledTool = false; // Track if we just completed a tool call
      let chunksAfterTool = 0; // Count chunks after tool call
      const ALLOWED_CHUNKS_BEFORE_JUDGMENT = 5; // Wait for 5 chunks (few seconds) before judging
      
      // 🔄 CUMULATIVE TEXT TRACKING: Track accumulated text between tools to prevent chunk-based bypasses
      let textSinceLastTool = '';
      let wordsSinceLastTool = 0;
      
      // Reset accumulator after each tool call
      const resetTextAccumulator = () => {
        textSinceLastTool = '';
        wordsSinceLastTool = 0;
        console.log('[CUMULATIVE-GUARD] Text accumulator reset');
      };
      
      // Define allowed phase markers (ONLY these are permitted)
      const ALLOWED_PHASE_MARKERS = [
        '🔍 Assessing...',
        '✅ Assessment complete',
        '📋 Planning...',
        '⚡ Executing...',
        '🧪 Testing...',
        '✓ Verifying...',
        '✅ Complete',
        '📤 Committed',
        '⏸️ Awaiting'
      ];
      
      // ✅ FIX: Expand allowed text patterns for legitimate status messages
      const ALLOWED_STATUS_PATTERNS = [
        /^(Error|Warning|⚠️|❌|✅):/i,              // Error messages
        /^Tool (completed|failed)/i,               // Tool status
        /^Waiting for/i,                          // Approval prompts
        /^(Creating|Reading|Writing|Deleting)/i,  // Brief action status
        /^\d+ (file|error|test)/i,                // Counts (e.g., "3 files updated")
      ];
      
      // Shared onChunk callback for both models
      const handleChunk = (chunk: any) => {
        if (chunk.type === 'chunk' && chunk.content) {
          // ✅ FIX: Chunk-based grace period tracking
          if (hasJustCalledTool) {
            chunksAfterTool++;
            if (chunksAfterTool >= ALLOWED_CHUNKS_BEFORE_JUDGMENT) {
              // Grace period ended - resume normal checking
              hasJustCalledTool = false;
              console.log(`[CONTINUOUS-GUARD] Grace period ended after ${chunksAfterTool} chunks`);
            }
          }
          
          // 🔄 CUMULATIVE TRACKING: Add chunk to accumulator
          textSinceLastTool += chunk.content;
          wordsSinceLastTool = textSinceLastTool.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
          
          // 🚨 CONTINUOUS GUARD: Check cumulative text AFTER grace period ends
          if (!violationInjected && !hasJustCalledTool) {
            const cumulativeText = textSinceLastTool.trim();
            
            // Skip empty cumulative text
            if (cumulativeText.length === 0) {
              // Empty - allowed, continue processing
            } 
            // Check if cumulative text is ONLY a phase marker (EXACT match required)
            else if (ALLOWED_PHASE_MARKERS.some(marker => cumulativeText === marker || cumulativeText === marker.trim())) {
              // Valid standalone phase marker - allow it
              console.log(`[CUMULATIVE-GUARD] ✅ Phase marker valid (exact match): "${cumulativeText}"`);
            }
            // Check if it STARTS with a marker but isn't exact (VIOLATION)
            else if (ALLOWED_PHASE_MARKERS.some(marker => cumulativeText.startsWith(marker))) {
              // VIOLATION: Phase marker with extra text
              const violation = `⚠️ VIOLATION: Phase markers must stand ALONE. Say "⚡ Executing..." then STOP. No extra text.`;
              console.error(`[CUMULATIVE-GUARD] Phase marker with extra text: "${cumulativeText}" (${cumulativeText.length} chars)`);
              
              metricsTracker?.recordViolation(
                'excessive_rambling',
                currentPhase,
                `Phase marker with appended text: "${cumulativeText}"`
              );
              
              broadcast(userId, jobId, 'job_content', { 
                content: `\n\n❌ ${violation}\n\n`,
                isError: true  
              });
              
              conversationMessages.push({
                role: 'user',
                content: violation
              });
              
              violationInjected = true;
              resetTextAccumulator();
              continueLoop = true;
              return;
            }
            // Check status patterns with STRICT length limits (max 100 chars)
            else if (ALLOWED_STATUS_PATTERNS.some(pattern => pattern.test(cumulativeText))) {
              if (cumulativeText.length > 100) {
                const violation = `⚠️ VIOLATION: Status messages must be brief (max 100 chars). Example: "Error: file not found" then STOP.`;
                console.error(`[CUMULATIVE-GUARD] Status text too long: "${cumulativeText}" (${cumulativeText.length} chars)`);
                
                metricsTracker?.recordViolation(
                  'excessive_rambling',
                  currentPhase,
                  `Status message exceeded 100 chars: ${cumulativeText.length}`
                );
                
                broadcast(userId, jobId, 'job_content', { 
                  content: `\n\n❌ ${violation}\n\n`,
                  isError: true  
                });
                
                conversationMessages.push({
                  role: 'user',
                  content: violation
                });
                
                violationInjected = true;
                resetTextAccumulator();
                continueLoop = true;
                return;
              }
              console.log(`[CUMULATIVE-GUARD] ✅ Status message valid: "${cumulativeText}" (${cumulativeText.length} chars)`);
            }
            // Check final summary in CONFIRM phase (max 20 words total)
            else if (currentPhase === 'confirm' && cumulativeText.startsWith('✅ Complete')) {
              const summaryWords = cumulativeText.split(/\s+/).filter((w: string) => w.length > 0).length;
              if (summaryWords > 20) {
                const violation = `⚠️ VIOLATION: Final summary has ${summaryWords} words. Max 20 words. Be brief.`;
                console.error(`[CUMULATIVE-GUARD] ${violation}`);
                
                metricsTracker?.recordViolation(
                  'excessive_rambling',
                  currentPhase,
                  `Summary too long: ${summaryWords} words (max 20)`
                );
                
                broadcast(userId, jobId, 'job_content', { 
                  content: `\n\n❌ ${violation}\n\n`,
                  isError: true  
                });
                
                conversationMessages.push({
                  role: 'user',
                  content: violation
                });
                
                violationInjected = true;
                resetTextAccumulator();
                continueLoop = true;
                return;
              }
              console.log(`[CUMULATIVE-GUARD] ✅ Final summary valid (${summaryWords} words)`);
            }
            // Check cumulative words (max 5 words between tools)
            else if (wordsSinceLastTool > 5) {
              const violation = `⚠️ VIOLATION: Detected ${wordsSinceLastTool} words since last tool call. Max 5 words allowed. Use phase markers only.`;
              console.error(`[CUMULATIVE-GUARD] ${violation}: "${cumulativeText.slice(0, 100)}..."`);
              
              metricsTracker?.recordViolation(
                'excessive_rambling',
                currentPhase,
                `Cumulative text: ${wordsSinceLastTool} words (max 5)`
              );
              
              broadcast(userId, jobId, 'job_content', { 
                content: `\n\n❌ ${violation}\n\n`,
                isError: true  
              });
              
              conversationMessages.push({
                role: 'user',
                content: violation
              });
              
              violationInjected = true;
              resetTextAccumulator();
              continueLoop = true;
              return;
            }
            
            // Track text before first tool (legacy check for initial response)
            if (!hasCalledToolYet) {
              textBeforeTools += chunk.content;
              const wordCount = textBeforeTools.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
              
              if (wordCount > 5) {
                const violation = `⚠️ VIOLATION: Detected ${wordCount} words before tool call. You MUST start with "📋 Planning..." (max 5 words) then IMMEDIATELY call createTaskList. Do NOT ramble or explain.`;
                console.error(`[PRE-RESPONSE-GUARD] ${violation}`);
                
                metricsTracker?.recordViolation(
                  'excessive_rambling',
                  currentPhase,
                  `Pre-response: ${wordCount} words before tool call`
                );
                
                broadcast(userId, jobId, 'job_content', { 
                  content: `\n\n❌ ${violation}\n\n`,
                  isError: true  
                });
                
                conversationMessages.push({
                  role: 'user',
                  content: violation
                });
                
                violationInjected = true;
                resetTextAccumulator();
                continueLoop = true;
                return;
              }
            }
          }
          
          // FIX 2: Detect inline file edits in streaming content
          const hasDirectEdit = 
            chunk.content.includes('--- a/') ||  // Diff format
            chunk.content.includes('+++ b/') ||
            chunk.content.includes('<<<<<<< SEARCH') || // Search/replace
            chunk.content.includes('>>>>>>> REPLACE') ||
            chunk.content.includes('apply_patch') ||
            /```[a-z]*\n\S+\.\S+\n/.test(chunk.content); // Code block with filename
          
          if (hasDirectEdit) {
            const currentPhase = workflowValidator.getCurrentPhase();
            if (currentPhase !== 'execute') {
              // BLOCK direct edits outside EXECUTE phase
              const error = `WORKFLOW VIOLATION: Direct code edits only allowed in EXECUTE phase. Current: ${currentPhase}. Use tools instead.`;
              console.error(`[WORKFLOW-VALIDATOR] ${error}`);
              
              // Track violation in metrics
              metricsTracker?.recordViolation(
                'direct_edit',
                currentPhase,
                error
              );
              
              broadcast(userId, jobId, 'job_content', { 
                content: `\n\n❌ ${error}\n\n`,
                isError: true  
              });
              
              conversationMessages.push({
                role: 'user',
                content: `SYSTEM ERROR: ${error}`
              });
              
              // Skip this chunk content - don't add to fullContent
              return;
            }
          }
          
          currentTextBlock += chunk.content;
          fullContent += chunk.content;
          
          // HARD ENFORCEMENT - Block invalid phase transitions
          const detectedPhase = workflowValidator.detectPhaseAnnouncement(chunk.content);
          if (detectedPhase) {
            // 🎯 ENFORCEMENT: Use orchestrator for phase transitions (checks + executes if allowed)
            const transition = enforcementOrchestrator.transitionToPhase(detectedPhase);
            
            if (!transition.allowed) {
              // HARD BLOCK: Inject error to AI conversation
              const errorMessage = `\n\n❌ WORKFLOW VIOLATION: ${transition.reason}\n\nYou must fix this before proceeding. Current phase: ${enforcementOrchestrator.getCurrentPhase()}`;
              
              // Track phase skip violation in metrics
              metricsTracker?.recordViolation(
                'phase_skip',
                enforcementOrchestrator.getCurrentPhase(),
                `Invalid transition to ${detectedPhase}: ${transition.reason}`
              );
              
              fullContent += errorMessage;
              broadcast(userId, jobId, 'job_content', { 
                content: errorMessage,
                isError: true  
              });
              
              // Add system message to force correction in next iteration
              conversationMessages.push({
                role: 'user',
                content: `SYSTEM ERROR: ${transition.reason}. You must correct this violation before proceeding.`
              });
              
              console.error(`[ENFORCEMENT] BLOCKED invalid transition: ${enforcementOrchestrator.getCurrentPhase()} → ${detectedPhase}`);
              // Don't actually transition - the orchestrator will keep current phase
            } else {
              // Transition was successful (already performed by orchestrator)
              // Also notify the legacy workflow validator for backward compatibility
              workflowValidator.transitionTo(detectedPhase);
              metricsTracker?.recordPhaseTransition(detectedPhase);
              
              // 🔄 UPDATE CURRENT PHASE for continuous guard
              currentPhase = detectedPhase;
              console.log(`[ENFORCEMENT] ✅ Phase transition: ${detectedPhase}`);
            }
          }
          
          broadcast(userId, jobId, 'job_content', { content: chunk.content });
        }
      };
      
      // Shared onToolUse callback for both models
      const handleToolUse = async (toolUse: any) => {
        // Mark that we've seen a tool call (for pre-response guard)
        hasCalledToolYet = true;
        
        // ✅ FIX: Reset chunk-based grace period when tool is called
        hasJustCalledTool = true;
        chunksAfterTool = 0;
        console.log(`[CONTINUOUS-GUARD] Tool called: ${toolUse.name}, grace period reset (${ALLOWED_CHUNKS_BEFORE_JUDGMENT} chunks)`);
        
        // 🔄 RESET CUMULATIVE TEXT ACCUMULATOR after each tool call
        resetTextAccumulator();
        
        // 🔄 UPDATE PHASE based on tool type
        if (toolUse.name === 'createTaskList') {
          currentPhase = 'plan';
          console.log(`[CONTINUOUS-GUARD] Phase auto-transitioned to PLAN (createTaskList called)`);
        } else if (['readPlatformFile', 'listPlatformDirectory', 'readProjectFile', 'listProjectDirectory'].includes(toolUse.name)) {
          if (currentPhase === 'assess' || currentPhase === 'plan') {
            // Reading during assess stays in assess, reading after plan is execute
            console.log(`[CONTINUOUS-GUARD] Phase remains ${currentPhase} (read operation)`);
          } else {
            currentPhase = 'execute';
            console.log(`[CONTINUOUS-GUARD] Phase auto-transitioned to EXECUTE (file read during work)`);
          }
        } else if (['writePlatformFile', 'createPlatformFile', 'deletePlatformFile', 'writeProjectFile', 'createProjectFile', 'deleteProjectFile'].includes(toolUse.name)) {
          currentPhase = 'execute';
          console.log(`[CONTINUOUS-GUARD] Phase auto-transitioned to EXECUTE (file write)`);
        } else if (toolUse.name === 'run_playwright_test' || toolUse.name === 'bash') {
          currentPhase = 'test';
          console.log(`[CONTINUOUS-GUARD] Phase auto-transitioned to TEST (test execution)`);
        }
        
        // Save any pending text
        if (currentTextBlock) {
          contentBlocks.push({ type: 'text', text: currentTextBlock });
          currentTextBlock = '';
        }
        // Add tool use block
        contentBlocks.push({
          type: 'tool_use',
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input
        });
        return null; // Tool execution happens later in the loop
      };
      
      // Shared onComplete callback for both models
      const handleComplete = (text: string, usage: any) => {
        console.log(`[LOMU-AI-JOB-MANAGER] ${model} stream completed`);
        // Add final text block if any
        if (currentTextBlock && contentBlocks[contentBlocks.length - 1]?.text !== currentTextBlock) {
          contentBlocks.push({ type: 'text', text: currentTextBlock });
        }
        
        // 🔢 Accumulate token usage
        if (usage && usage.inputTokens !== undefined && usage.outputTokens !== undefined) {
          cumulativeInputTokens += usage.inputTokens;
          cumulativeOutputTokens += usage.outputTokens;
          metricsTracker?.recordTokenUsage(usage.inputTokens, usage.outputTokens);
          console.log(`[TOKEN-TRACKING] Iteration ${iterationCount}: ${usage.inputTokens} input + ${usage.outputTokens} output tokens (cumulative: ${cumulativeInputTokens} + ${cumulativeOutputTokens})`);
        }
      };
      
      // Shared onError callback for both models
      const handleError = (error: Error) => {
        console.error(`[LOMU-AI-JOB-MANAGER] ${model} stream error:`, error);
        throw error;
      };
      
      // 🔀 Call appropriate streaming function based on model selection
      if (model === 'claude') {
        await streamClaudeResponse({
          model: 'claude-sonnet-4-20250514',
          maxTokens: config.maxTokens,
          system: systemPrompt,
          messages: conversationMessages,
          tools: availableTools,
          onChunk: handleChunk,
          onToolUse: handleToolUse,
          onComplete: handleComplete,
          onError: handleError
        });
      } else {
        await streamGeminiResponse({
          model: 'gemini-2.5-flash',
          maxTokens: config.maxTokens,
          system: systemPrompt,
          messages: conversationMessages,
          tools: availableTools,
          onChunk: handleChunk,
          onToolUse: handleToolUse,
          onComplete: handleComplete,
          onError: handleError
        });
      }
      
      // 🚨 PRE-RESPONSE GUARD: If violation was injected, skip rest of iteration
      if (violationInjected) {
        console.log('[PRE-RESPONSE-GUARD] Violation injected, forcing restart in next iteration');
        continue; // Skip to next iteration immediately
      }
      
      console.log(`[LOMU-AI-JOB-MANAGER] ${model} stream completed, processing tool calls...`);
      
      // CRITICAL: Validate response with all 6 enforcement layers
      const lastUserMessage = conversationMessages
        .slice()
        .reverse()
        .find(msg => msg.role === 'user' && typeof msg.content === 'string')?.content || message;
      
      const toolCallsFromResponse = contentBlocks
        .filter(block => block.type === 'tool_use')
        .map(block => ({ name: block.name, input: block.input }));
      
      try {
        const validationResult = await enforcementOrchestrator.validateResponse(
          {
            jobId,
            userId,
            userMessage: lastUserMessage,
            currentPhase: enforcementOrchestrator.getCurrentPhase(),
            autoCommit,
          },
          fullContent,
          toolCallsFromResponse,
          cumulativeInputTokens,
          cumulativeOutputTokens
        );
        
        // Inject I AM Architect guidance if provided
        if (validationResult.guidanceInjected) {
          console.log('[ENFORCEMENT] 🧑‍💼 I AM Architect guidance injected');
          conversationMessages.push({
            role: 'user',
            content: validationResult.guidanceInjected
          });
          broadcast(userId, jobId, 'architect_guidance', { 
            guidance: validationResult.guidanceInjected,
            violations: validationResult.violations 
          });
        }
        
        // Inject reflection prompt if triggered
        if (validationResult.reflectionPrompt) {
          console.log('[ENFORCEMENT] 🔄 Reflection prompt injected');
          conversationMessages.push({
            role: 'user',
            content: validationResult.reflectionPrompt
          });
        }
        
        // CRITICAL: 3-strikes escalation - hand off to I AM Architect
        if (validationResult.shouldEscalate && validationResult.violations.some(v => v.includes('3 guidance attempts failed'))) {
          console.log('[ENFORCEMENT] 🚨 3 STRIKES REACHED - Escalating to I AM Architect for complete takeover');
          
          // Mark job as failed (escalated)
          await db.update(lomuJobs)
            .set({ 
              status: 'failed',
              metadata: {
                ...(job.metadata as any),
                escalated: true,
                escalationReason: '3 workflow violations - handed off to I AM Architect'
              },
              completedAt: new Date()
            })
            .where(eq(lomuJobs.id, jobId));
          
          // Create platform healing incident for I AM Architect to take over
          const incidentDescription = `LomuAI job ${jobId} escalated after 3 workflow violations. Original request: "${message}"\n\nViolations: ${validationResult.violations.join(', ')}\n\nConversation history and context available for takeover.`;
          
          await healthMonitor.reportAgentIncident({
            type: 'workflow_escalation',
            severity: 'critical',
            description: incidentDescription,
            metrics: {
              jobId,
              violations: validationResult.violations,
              qualityScore: validationResult.qualityScore,
              strikes: 3
            },
            userMessage: message,
            agentResponse: fullContent,
          });
          
          // Broadcast escalation to user
          broadcast(userId, jobId, 'job_escalated', {
            message: '🚨 After 3 workflow violations, this job has been escalated to I AM Architect (Claude Sonnet 4) for expert handling. Please check the Platform Healing tab for updates.',
            violations: validationResult.violations
          });
          
          console.log('[ENFORCEMENT] ✅ Job escalated - I AM Architect will take over via platform healing');
          
          // Stop LomuAI job execution - I AM Architect takes over
          break;
        }
        
        // Log validation results
        if (validationResult.violations.length > 0) {
          console.warn('[ENFORCEMENT] Violations detected:', validationResult.violations);
        }
        console.log('[ENFORCEMENT] Quality score:', validationResult.qualityScore);
      } catch (enforcementError: any) {
        console.error('[ENFORCEMENT] Validation failed (non-fatal):', enforcementError.message);
        // Continue execution - enforcement failure should not break the job
      }

      // Cleanup internal fields
      contentBlocks.forEach(block => {
        if (block.type === 'tool_use' && '_inputStr' in block) {
          delete block._inputStr;
        }
      });

      conversationMessages.push({
        role: 'assistant',
        content: contentBlocks,
      });

      // FIX 2: Scan final assistant message for direct edits (bypasses streaming detection)
      if (contentBlocks.length > 0) {
        const lastBlock = contentBlocks[contentBlocks.length - 1];
        if (lastBlock.type === 'text' && lastBlock.text) {
          const hasDirectEdit = 
            lastBlock.text.includes('--- a/') ||
            lastBlock.text.includes('+++ b/') ||
            lastBlock.text.includes('<<<<<<< SEARCH') ||
            lastBlock.text.includes('>>>>>>> REPLACE') ||
            lastBlock.text.includes('apply_patch') ||
            /```[a-z]*\n\S+\.\S+\n/.test(lastBlock.text);
          
          if (hasDirectEdit) {
            const currentPhase = workflowValidator.getCurrentPhase();
            if (currentPhase !== 'execute') {
              console.error(`[WORKFLOW-VALIDATOR] Direct edit in final message outside EXECUTE: ${currentPhase}`);
              
              // Track violation in metrics
              metricsTracker?.recordViolation(
                'direct_edit',
                currentPhase,
                `Direct code edits in final message outside EXECUTE phase`
              );
              
              broadcast(userId, jobId, 'job_content', {
                content: `\n\n❌ WORKFLOW VIOLATION: Direct code edits only allowed in EXECUTE phase. Current: ${currentPhase}.\n\n`,
                isError: true
              });
              
              conversationMessages.push({
                role: 'user',
                content: `SYSTEM ERROR: Direct code edits detected in ${currentPhase} phase. Only allowed in EXECUTE.`
              });
              
              continueLoop = true; // Force another iteration to fix
              continue;
            }
          }
        }
      }

      // Tool execution
      const toolResults: any[] = [];
      const hasToolUse = contentBlocks.some(block => block.type === 'tool_use');
      const toolNames = contentBlocks.filter(b => b.type === 'tool_use').map(b => b.name);
      
      // Track total tool calls across iterations
      totalToolCalls += toolNames.length;
      
      console.log(`[LOMU-AI-JOB-MANAGER] === ITERATION ${iterationCount} ===`);
      console.log(`[LOMU-AI-JOB-MANAGER] Tools called: ${toolNames.join(', ') || 'NONE'}`);
      console.log(`[LOMU-AI-JOB-MANAGER] Content blocks received: ${contentBlocks.length}`);
      console.log(`[LOMU-AI-JOB-MANAGER] Full content length so far: ${fullContent.length} chars`);

      // Execute all tools - NO BLOCKING, LomuAI decides what to do
      for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
          const { name, input, id } = block;

          // 🔄 WORKFLOW VALIDATOR: Validate tool call against current phase
          const toolValidation = workflowValidator.validateToolCall(name, workflowValidator.getCurrentPhase());
          if (!toolValidation.allowed) {
            console.warn(`[WORKFLOW-VALIDATOR] ❌ Tool ${name} not allowed in ${workflowValidator.getCurrentPhase()} phase: ${toolValidation.reason}`);
            
            // Track tool block in metrics
            metricsTracker?.recordToolBlock();
            metricsTracker?.recordViolation(
              'tool_block',
              workflowValidator.getCurrentPhase(),
              `Tool ${name} blocked: ${toolValidation.reason}`
            );
            
            // Inject workflow violation error back to AI
            toolResults.push({
              tool_use_id: id,
              is_error: true,
              content: `⛔ WORKFLOW VIOLATION: Cannot use ${name} in ${workflowValidator.getCurrentPhase()} phase. ${toolValidation.reason}`
            });
            
            continue; // Skip tool execution
          }

          broadcast(userId, jobId, 'job_progress', { message: `🔧 Executing tool: ${name}...` });
          
          // 🎯 ENFORCEMENT: Record tool call for ReflectionHeartbeat tracking
          enforcementOrchestrator.recordToolCall(name);

          try {
            let toolResult: any = null;

            // Tool execution logic (copied from SSE route)
            if (name === 'createTaskList') {
              const typedInput = input as { title: string; tasks: Array<{ title: string; description: string }> };
              
              // VALIDATION: Prevent task creation for simple conversational messages
              const recentUserMessage = conversationMessages
                .slice()
                .reverse()
                .find(msg => msg.role === 'user' && typeof msg.content === 'string');
              
              if (recentUserMessage && isSimpleMessage(recentUserMessage.content)) {
                toolResult = `❌ ERROR: Don't create tasks for simple greetings/thanks. Just respond conversationally!`;
              } else {
                broadcast(userId, jobId, 'job_progress', { message: `📋 Creating task list...` });

                const result = await createTaskList({
                  userId,
                  title: typedInput.title,
                  tasks: typedInput.tasks.map(t => ({
                    title: t.title,
                    description: t.description,
                    status: 'pending' as const
                  }))
                });

                if (result.success) {
                  activeTaskListId = result.taskListId!;
                  toolResult = `✅ Task list created successfully!\n\nTask List ID: ${result.taskListId}`;
                  broadcast(userId, jobId, 'task_list_created', { taskListId: result.taskListId });
                  
                  // 🔄 WORKFLOW VALIDATOR: Track task list creation
                  workflowValidator.updateContext({ hasTaskList: true });
                  
                  // 🎯 ENFORCEMENT: Record task list creation for parity tracking
                  enforcementOrchestrator.recordTaskListCreation(jobId);
                } else {
                  toolResult = `❌ Failed to create task list: ${result.error}`;
                }
              }
            } else if (name === 'updateTask') {
              const typedInput = input as { taskId: string; status: string; result?: string };
              const result = await updateTask({
                userId,
                taskId: typedInput.taskId,
                status: typedInput.status,
                result: typedInput.result,
                startedAt: typedInput.status === 'in_progress' ? new Date() : undefined,
                completedAt: typedInput.status === 'completed' ? new Date() : undefined,
              });

              if (result.success) {
                toolResult = `✅ Task updated to ${typedInput.status}`;
                broadcast(userId, jobId, 'task_updated', { taskId: typedInput.taskId, status: typedInput.status });
              } else {
                toolResult = `❌ Failed to update task: ${result.error}`;
              }
            } else if (name === 'readTaskList') {
              const result = await readTaskList({ userId });
              if (result.success && result.taskLists) {
                const activeList = result.taskLists.find((list: any) => list.status === 'active');
                if (activeList) {
                  const tasks = activeList.tasks || [];
                  const taskSummary = tasks.map((t: any) => 
                    `[${t.id}] ${t.title} - ${t.status}`
                  ).join('\n');
                  toolResult = `✅ Current Task List:\n\n${taskSummary}`;
                } else {
                  toolResult = `No active task list found`;
                }
              } else {
                toolResult = `Error reading task list: ${result.error}`;
              }
            } else if (name === 'readPlatformFile') {
              const typedInput = input as { path: string };
              toolResult = await platformHealing.readPlatformFile(typedInput.path);
            } else if (name === 'writePlatformFile') {
              const typedInput = input as { path: string; content: string };
              if (!typedInput.content && typedInput.content !== '') {
                throw new Error(`writePlatformFile called without content for ${typedInput.path}`);
              }
              // BATCH MODE: Skip auto-commit, accumulate changes for ONE commit at end
              const writeResult = await platformHealing.writePlatformFile(
                typedInput.path,
                typedInput.content,
                true  // skipAutoCommit=true - batch all changes
              );
              toolResult = JSON.stringify(writeResult);
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'modify', 
                contentAfter: typedInput.content 
              });
              broadcast(userId, jobId, 'file_change', { file: { path: typedInput.path, operation: 'modify' } });
              toolResult = `✅ File staged for batch commit (${fileChanges.length} files total)`;
            } else if (name === 'listPlatformDirectory') {
              const typedInput = input as { directory: string };
              const entries = await platformHealing.listPlatformDirectory(typedInput.directory);
              toolResult = entries.map(e => `${e.name} (${e.type})`).join('\n');
            } else if (name === 'createPlatformFile') {
              const typedInput = input as { path: string; content: string };
              if (!typedInput.content && typedInput.content !== '') {
                throw new Error(`createPlatformFile called without content for ${typedInput.path}`);
              }
              const createResult = await platformHealing.createPlatformFile(
                typedInput.path,
                typedInput.content
              );
              toolResult = JSON.stringify(createResult);
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'create', 
                contentAfter: typedInput.content 
              });
              broadcast(userId, jobId, 'file_change', { file: { path: typedInput.path, operation: 'create' } });
              toolResult = `✅ File created successfully`;
            } else if (name === 'deletePlatformFile') {
              const typedInput = input as { path: string };
              await platformHealing.deletePlatformFile(typedInput.path);
              fileChanges.push({ 
                path: typedInput.path, 
                operation: 'delete'
              });
              broadcast(userId, jobId, 'file_change', { file: { path: typedInput.path, operation: 'delete' } });
              toolResult = `✅ File deleted successfully`;
            } else if (name === 'readProjectFile') {
              if (!projectId) {
                toolResult = '❌ No project selected';
              } else {
                const typedInput = input as { path: string };
                const validatedPath = validateProjectPath(typedInput.path);
                const projectFiles = await storage.getProjectFiles(projectId);
                const targetFile = projectFiles.find(f => 
                  (f.path ? `${f.path}/${f.filename}` : f.filename) === validatedPath ||
                  f.filename === validatedPath
                );
                
                if (targetFile) {
                  toolResult = `File: ${targetFile.filename}\nContent:\n${targetFile.content}`;
                } else {
                  toolResult = `❌ File not found: ${validatedPath}`;
                }
              }
            } else if (name === 'writeProjectFile') {
              if (!projectId) {
                toolResult = '❌ No project selected';
              } else {
                const typedInput = input as { path: string; content: string };
                const validatedPath = validateProjectPath(typedInput.path);
                const projectFiles = await storage.getProjectFiles(projectId);
                const targetFile = projectFiles.find(f => 
                  (f.path ? `${f.path}/${f.filename}` : f.filename) === validatedPath ||
                  f.filename === validatedPath
                );
                
                if (targetFile) {
                  await storage.updateFile(targetFile.id, targetFile.userId, typedInput.content);
                  toolResult = `✅ File updated: ${validatedPath}`;
                  broadcast(userId, jobId, 'file_change', { file: { path: validatedPath, operation: 'modify' } });
                } else {
                  toolResult = `❌ File not found: ${validatedPath}`;
                }
              }
            } else if (name === 'listProjectDirectory') {
              if (!projectId) {
                toolResult = '❌ No project selected';
              } else {
                const projectFiles = await storage.getProjectFiles(projectId);
                if (projectFiles.length === 0) {
                  toolResult = 'No files in project';
                } else {
                  toolResult = projectFiles.map(f => 
                    `${f.path ? `${f.path}/` : ''}${f.filename} (${f.language})`
                  ).join('\n');
                }
              }
            } else if (name === 'createProjectFile') {
              if (!projectId) {
                toolResult = '❌ No project selected';
              } else {
                const typedInput = input as { path: string; content: string };
                const validatedPath = validateProjectPath(typedInput.path);
                const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
                if (project && project.length > 0) {
                  const projectOwnerId = project[0].userId;
                  const parts = validatedPath.split('/');
                  const filename = parts.pop() || validatedPath;
                  const filePath = parts.join('/');
                  const ext = filename.split('.').pop()?.toLowerCase() || 'text';
                  const langMap: Record<string, string> = {
                    'js': 'javascript', 'jsx': 'javascript',
                    'ts': 'typescript', 'tsx': 'typescript',
                    'py': 'python', 'html': 'html', 'css': 'css',
                    'json': 'json', 'md': 'markdown',
                  };
                  const language = langMap[ext] || 'text';
                  
                  await storage.createFile({
                    userId: projectOwnerId,
                    projectId,
                    filename,
                    path: filePath,
                    content: typedInput.content,
                    language,
                  });
                  
                  toolResult = `✅ File created: ${validatedPath}`;
                  broadcast(userId, jobId, 'file_change', { file: { path: validatedPath, operation: 'create' } });
                } else {
                  toolResult = '❌ Project not found';
                }
              }
            } else if (name === 'deleteProjectFile') {
              if (!projectId) {
                toolResult = '❌ No project selected';
              } else {
                const typedInput = input as { path: string };
                const validatedPath = validateProjectPath(typedInput.path);
                const projectFiles = await storage.getProjectFiles(projectId);
                const targetFile = projectFiles.find(f => 
                  (f.path ? `${f.path}/${f.filename}` : f.filename) === validatedPath ||
                  f.filename === validatedPath
                );
                
                if (targetFile) {
                  await storage.deleteFile(targetFile.id, targetFile.userId);
                  toolResult = `✅ File deleted: ${validatedPath}`;
                  broadcast(userId, jobId, 'file_change', { file: { path: validatedPath, operation: 'delete' } });
                } else {
                  toolResult = `❌ File not found: ${validatedPath}`;
                }
              }
            } else if (name === 'perform_diagnosis') {
              const typedInput = input as { target: string; focus?: string[] };
              broadcast(userId, jobId, 'job_progress', { message: `🔍 Running diagnosis...` });
              const diagnosisResult = await performDiagnosis({
                target: typedInput.target as any,
                focus: typedInput.focus,
              });

              if (diagnosisResult.success) {
                const findingsList = diagnosisResult.findings
                  .map((f, idx) => 
                    `${idx + 1}. [${f.severity.toUpperCase()}] ${f.category}\n` +
                    `   Issue: ${f.issue}\n` +
                    `   Location: ${f.location}\n` +
                    `   Evidence: ${f.evidence}`
                  )
                  .join('\n\n');

                toolResult = `✅ Diagnosis Complete\n\n` +
                  `${diagnosisResult.summary}\n\n` +
                  `Findings:\n${findingsList || 'No issues found'}\n\n` +
                  `Recommendations:\n${diagnosisResult.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
              } else {
                toolResult = `❌ Diagnosis failed: ${diagnosisResult.error}`;
              }
            } else if (name === 'read_logs') {
              const typedInput = input as { lines?: number; filter?: string };
              const maxLines = Math.min(typedInput.lines || 100, 1000);
              
              try {
                const logsDir = '/tmp/logs';
                let logFiles: string[] = [];
                
                try {
                  await fs.access(logsDir);
                  logFiles = await fs.readdir(logsDir);
                } catch {
                  toolResult = `⚠️ No logs found at ${logsDir}`;
                }

                if (!toolResult && logFiles.length > 0) {
                  const fileStats = await Promise.all(
                    logFiles.map(async (file) => {
                      const filePath = path.join(logsDir, file);
                      const stats = await fs.stat(filePath);
                      return { file, mtime: stats.mtime, path: filePath };
                    })
                  );

                  fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
                  const mostRecentLog = fileStats[0];

                  const logContent = await fs.readFile(mostRecentLog.path, 'utf-8');
                  const logLines = logContent.split('\n');

                  let filteredLines = logLines;
                  if (typedInput.filter) {
                    filteredLines = logLines.filter(line => 
                      line.toLowerCase().includes(typedInput.filter!.toLowerCase())
                    );
                  }

                  const recentLines = filteredLines.slice(-maxLines);

                  toolResult = `📋 Server Logs (${mostRecentLog.file})\n` +
                    `Showing: ${recentLines.length} lines\n\n` +
                    recentLines.join('\n');
                } else if (!toolResult) {
                  toolResult = `⚠️ No log files found`;
                }
              } catch (error: any) {
                toolResult = `❌ Failed to read logs: ${error.message}`;
              }
            } else if (name === 'execute_sql') {
              const typedInput = input as { query: string; purpose: string };
              try {
                const result = await db.execute(typedInput.query as any);
                toolResult = `✅ SQL executed successfully\n\n` +
                  `Purpose: ${typedInput.purpose}\n` +
                  `Rows: ${Array.isArray(result) ? result.length : 'N/A'}\n` +
                  `Result:\n${JSON.stringify(result, null, 2)}`;
              } catch (error: any) {
                toolResult = `❌ SQL execution failed: ${error.message}`;
              }
            } else if (name === 'architect_consult') {
              const typedInput = input as { 
                problem: string; 
                context: string; 
                proposedSolution: string;
                affectedFiles: string[];
              };
              const architectResult = await consultArchitect({
                problem: typedInput.problem,
                context: typedInput.context,
                previousAttempts: [],
                codeSnapshot: `Proposed Solution:\n${typedInput.proposedSolution}\n\nAffected Files:\n${typedInput.affectedFiles.join('\n')}`
              });

              if (architectResult.success) {
                toolResult = `✅ I AM GUIDANCE\n\n${architectResult.guidance}\n\nRecommendations:\n${architectResult.recommendations.join('\n')}`;
              } else {
                toolResult = `I AM FEEDBACK\n\n${architectResult.error}`;
              }
            } else if (name === 'web_search') {
              const typedInput = input as { query: string; maxResults?: number };
              const searchResult = await executeWebSearch({
                query: typedInput.query,
                maxResults: typedInput.maxResults || 5
              });

              toolResult = `Search Results:\n${searchResult.results.map((r: any) => 
                `• ${r.title}\n  ${r.url}\n  ${r.content}\n`
              ).join('\n')}`;
            } else if (name === 'commit_to_github') {
              const typedInput = input as { commitMessage: string };

              // BACKEND ENFORCEMENT: Check autonomy permission before allowing commits
              if (!config.allowCommit) {
                toolResult = `❌ PERMISSION DENIED: Your autonomy level (${autonomyLevel}) does not allow commits. Upgrade to standard or higher, or have your admin enable autoCommit.`;
                console.warn(`[LOMU-AI-SECURITY] Commit attempt blocked for user ${userId} (autonomy: ${autonomyLevel}, allowCommit: ${config.allowCommit})`);
              } else if (!autoCommit) {
                toolResult = `❌ MANUAL MODE: Auto-commit is disabled. Show changes to user and request approval before committing.`;
                console.log(`[LOMU-AI-SECURITY] Commit blocked - manual mode requires user approval (user ${userId})`);
              } else if (fileChanges.length === 0) {
                toolResult = `❌ No file changes to commit`;
              } else {
                try {
                  const hasToken = !!process.env.GITHUB_TOKEN;
                  const hasRepo = !!process.env.GITHUB_REPO;

                  if (!hasToken || !hasRepo) {
                    toolResult = `❌ GitHub integration not configured`;
                  } else {
                    const githubService = getGitHubService();

                    const filesToCommit = [];
                    for (const change of fileChanges) {
                      if (!change.contentAfter && change.contentAfter !== '') {
                        throw new Error(`File ${change.path} is missing content!`);
                      }

                      filesToCommit.push({
                        path: change.path,
                        content: change.contentAfter,
                        operation: (change.operation || 'modify') as 'create' | 'modify' | 'delete',
                      });
                    }

                    // Unique LomuAI commit prefix so user can distinguish from manual commits
                    const uniqueCommitMessage = `[LomuAI 🤖] ${typedInput.commitMessage}`;
                    
                    const result = await githubService.commitFiles(
                      filesToCommit,
                      uniqueCommitMessage
                    );

                    commitSuccessful = true;
                    toolResult = `✅ SUCCESS! Committed ${fileChanges.length} files to GitHub\n\n` +
                      `Commit: ${result.commitHash}\n` +
                      `URL: ${result.commitUrl}\n\n` +
                      `🚀 Railway auto-deployment triggered!`;
                    
                    // FIX 4: Wire commit confirmation
                    workflowValidator.confirmCommit(true);
                    metricsTracker?.recordCommit(fileChanges.length);
                    // 🔄 WORKFLOW VALIDATOR: Track commit execution
                    workflowValidator.updateContext({ commitExecuted: true });
                  }
                } catch (error: any) {
                  toolResult = `❌ GitHub commit failed: ${error.message}`;
                }
              }
            } else if (name === 'start_subagent') {
              const typedInput = input as { task: string; relevantFiles: string[] };
              try {
                const result = await startSubagent({
                  task: typedInput.task,
                  relevantFiles: typedInput.relevantFiles,
                  userId,
                  sendEvent: (type: string, data: any) => {
                    broadcast(userId, jobId, `subagent_${type}`, data);
                  },
                });
                
                toolResult = `✅ Sub-agent completed work:\n\n${result.summary}\n\nFiles modified:\n${result.filesModified.map(f => `- ${f}`).join('\n')}`;
                
                result.filesModified.forEach((filePath: string) => {
                  fileChanges.push({ path: filePath, operation: 'modify' });
                });
              } catch (error: any) {
                toolResult = `❌ Sub-agent failed: ${error.message}`;
              }
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: id,
              content: toolResult || 'Success',
            });

            // FIX 4: Wire confirmations when test/verify/commit tools succeed
            // Check if this was a test execution
            if (name === 'run_playwright_test' || name === 'bash') {
              const resultContent = toolResult?.toString().toLowerCase() || '';
              const inputStr = JSON.stringify(input).toLowerCase();
              
              // Detect test runs
              if (name === 'run_playwright_test' || 
                  inputStr.includes('npm test') || 
                  inputStr.includes('npm run test') ||
                  inputStr.includes('pytest') ||
                  inputStr.includes('jest')) {
                const passed = !resultContent.includes('failed') && 
                              !resultContent.includes('error') &&
                              !resultContent.includes('✗');
                workflowValidator.confirmTestsRun(passed);
                metricsTracker?.recordTestExecution(passed);
                
                // 🎯 ENFORCEMENT: Record test execution for parity tracking
                if (passed) {
                  enforcementOrchestrator.recordTestExecution(jobId);
                }
              }
              
              // Detect verification runs (TypeScript compilation, linting)
              if (inputStr.includes('tsc --noemit') ||
                  inputStr.includes('tsc --noEmit') ||
                  inputStr.includes('tsc -noemit') ||
                  inputStr.includes('npm run type-check') ||
                  inputStr.includes('eslint')) {
                const compilationOk = !resultContent.includes('error') &&
                                     !resultContent.includes('failed');
                workflowValidator.confirmVerification(compilationOk);
                metricsTracker?.recordCompilationCheck(compilationOk);
                if (compilationOk) {
                  metricsTracker?.recordVerificationComplete();
                }
              }
              
              // FIX 4: Detect git commit commands
              if (name === 'bash' && (inputStr.includes('git commit') || inputStr.includes('git push'))) {
                const success = !resultContent.includes('error') &&
                               !resultContent.includes('failed') &&
                               !resultContent.includes('fatal');
                workflowValidator.confirmCommit(success);
              }
            }

            broadcast(userId, jobId, 'job_progress', { message: `✅ Tool ${name} completed` });
          } catch (error: any) {
            console.error(`[LOMU-AI-JOB-MANAGER] Tool ${name} failed:`, error);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: id,
              is_error: true,
              content: `Error in ${name}: ${error.message}`,
            });

            broadcast(userId, jobId, 'job_progress', { message: `❌ Tool ${name} failed: ${error.message}` });
          }
        }
      }

      if (toolResults.length > 0) {
        // 📊 WORKFLOW TELEMETRY: Track read vs code-modifying operations
        let iterationHadCodeModifications = false;
        for (const toolName of toolNames) {
          if (READ_ONLY_TOOLS.has(toolName)) {
            workflowTelemetry.readOperations++;
          } else if (CODE_MODIFYING_TOOLS.has(toolName)) {
            workflowTelemetry.writeOperations++;
            workflowTelemetry.hasProducedFixes = true;
            iterationHadCodeModifications = true;
          } else {
            // Unknown tool - log warning but count as read-only (conservative)
            console.warn(`[WORKFLOW-TELEMETRY] ⚠️ Unknown tool category: ${toolName} - treating as read-only`);
            workflowTelemetry.readOperations++;
          }
        }
        
        // Track consecutive read-only iterations
        if (!iterationHadCodeModifications) {
          workflowTelemetry.consecutiveReadOnlyIterations++;
          console.log(`[WORKFLOW-TELEMETRY] ⚠️ Iteration ${iterationCount}: Read-only (${workflowTelemetry.consecutiveReadOnlyIterations}/${workflowTelemetry.MAX_READ_ONLY_ITERATIONS})`);
        } else {
          workflowTelemetry.consecutiveReadOnlyIterations = 0;
          console.log(`[WORKFLOW-TELEMETRY] ✅ Iteration ${iterationCount}: Code modifications detected - reset read-only counter`);
        }
        
        console.log(`[WORKFLOW-TELEMETRY] Total: ${workflowTelemetry.readOperations} reads, ${workflowTelemetry.writeOperations} writes`);
        
        // 🚨 EARLY TERMINATION: Halt if too many consecutive read-only iterations
        if (workflowTelemetry.consecutiveReadOnlyIterations >= workflowTelemetry.MAX_READ_ONLY_ITERATIONS) {
          console.warn(`[WORKFLOW-TELEMETRY] 🛑 HALTING - ${workflowTelemetry.MAX_READ_ONLY_ITERATIONS} consecutive read-only iterations detected`);
          const haltMsg = `\n\n⚠️ **Investigation-only loop detected**\n\nI've read ${workflowTelemetry.readOperations} files but haven't made any changes yet. This suggests I'm investigating without implementing fixes.\n\nI'll stop here to avoid wasting tokens. Please clarify what you'd like me to implement, or I can escalate this to the I AM Architect for expert guidance.`;
          fullContent += haltMsg;
          broadcast(userId, jobId, 'job_content', { content: haltMsg });
          continueLoop = false;
        }
        
        // Convert tool results to plain text for Gemini (doesn't support Claude's tool_result format)
        const toolResultsText = toolResults.map(result => {
          let content = result.content;
          
          // Handle missing/undefined content
          if (content === undefined || content === null) {
            content = result.is_error ? 'Error occurred' : 'Success';
          }
          
          // Convert non-string content to readable format
          if (typeof content !== 'string') {
            try {
              content = JSON.stringify(content, null, 2);
            } catch (e) {
              content = String(content);
            }
          }
          
          // Format with error indicator if needed
          if (result.is_error) {
            return `❌ ERROR:\n${content}`;
          }
          
          return content;
        }).join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

        conversationMessages.push({
          role: 'user',
          content: toolResultsText,
        });
      } else {
        // No tool calls - check if should continue
        
        // INTELLIGENT COMPLETION DETECTION
        const lastAssistantMessage = fullContent.toLowerCase();
        
        // Check for completion keywords
        const completionKeywords = [
          'done', 'finished', 'complete', 'all set',
          "that's it", "that's all", 'wrapped up',
          'everything is fixed', 'no more work',
          'successfully completed', 'task complete'
        ];
        
        const hasCompletionKeyword = completionKeywords.some(keyword => 
          lastAssistantMessage.includes(keyword)
        );
        
        // Check task status
        let hasIncompleteTasks = false;
        if (activeTaskListId) {
          try {
            const taskCheck = await readTaskList({ userId });
            const sessionTaskList = taskCheck.taskLists?.find((list: any) => list.id === activeTaskListId);
            const allTasks = sessionTaskList?.tasks || [];
            const inProgressTasks = allTasks.filter((t: any) => t.status === 'in_progress');
            const pendingTasks = allTasks.filter((t: any) => t.status === 'pending');
            
            hasIncompleteTasks = inProgressTasks.length > 0 || pendingTasks.length > 0;
          } catch (error: any) {
            console.error('[LOMU-AI-JOB-MANAGER] Failed to check task status:', error);
            hasIncompleteTasks = false;
          }
        }
        
        // STUCK DETECTION: No progress for 2+ iterations
        const noProgressCount = conversationMessages
          .slice(-4) // Last 4 messages (2 iterations)
          .filter(msg => msg.role === 'assistant' && !msg.content?.some?.((c: any) => c.type === 'tool_use'))
          .length;
        
        const isStuck = noProgressCount >= 2;
        
        // DECISION LOGIC
        if (hasCompletionKeyword && !hasIncompleteTasks) {
          // LomuAI says it's done AND no incomplete tasks
          console.log('[LOMU-AI-JOB-MANAGER] Detected completion - ending conversation');
          continueLoop = false;
        } else if (isStuck) {
          // Stuck - not making progress
          console.log('[LOMU-AI-JOB-MANAGER] Stuck detection - ending to prevent infinite loop');
          continueLoop = false;
        } else if (hasIncompleteTasks && iterationCount < MAX_ITERATIONS) {
          // Still have work to do
          continueLoop = true;
        } else {
          // Nothing to do or hit max iterations
          continueLoop = false;
        }
      }

      // Save checkpoint every 2 iterations
      if (iterationCount % 2 === 0) {
        await saveCheckpoint(jobId, conversationMessages, iterationCount, activeTaskListId);
      }
    }

    // 🔍 GIT-BASED FILE CHANGE DETECTION: Check if any files were actually modified
    // This catches changes even if tool classification is wrong
    try {
      const { stdout: gitStatus } = await execAsync('git status --porcelain');
      const hasFileChanges = gitStatus.trim().length > 0;

      // CRITICAL: Git status is ground truth - override hasProducedFixes
      workflowTelemetry.hasProducedFixes = hasFileChanges;

      if (hasFileChanges) {
        console.log('[WORKFLOW-TELEMETRY] ✅ Git detected file changes - marking as having fixes');
        console.log('[WORKFLOW-TELEMETRY] Changed files:', gitStatus.trim().split('\n').slice(0, 5).join(', '));
      } else {
        console.log('[WORKFLOW-TELEMETRY] ⚠️ No file changes detected via git status - marking as zero-mutation');
      }
    } catch (gitError: any) {
      console.warn('[WORKFLOW-TELEMETRY] ⚠️ Git status check failed (non-fatal):', gitError.message);
      // Continue execution - git status failure is not critical
    }

    // 📊 WORKFLOW VALIDATION: Detect zero-mutation jobs and flag as failed
    console.log(`[WORKFLOW-VALIDATION] Job completed with ${workflowTelemetry.writeOperations} code-modifying operations`);
    console.log(`[WORKFLOW-VALIDATION] Has produced fixes: ${workflowTelemetry.hasProducedFixes}`);
    
    // Detect if this was a fix/build request but no code modifications occurred
    // CRITICAL: Comprehensive keyword matching for fix requests (case-insensitive)
    const lowerMessage = message.toLowerCase();
    
    // EXCLUSION: Don't treat simple questions/greetings as fix requests
    const QUESTION_KEYWORDS = [
      'how does', 'what does', 'tell me', 'explain', 'describe',
      'show me', 'can you explain', 'why does', 'where is',
      'hello', 'hi ', 'hey ', 'thanks', 'thank you',
      'how are you', 'how do you feel', 'what do you think'
    ];
    
    const isQuestion = QUESTION_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
    
    // Only match fix keywords if it's NOT a simple question
    const FIX_REQUEST_KEYWORDS = [
      'fix', 'repair', 'resolve', 'patch', 'correct', 'address',
      'diagnose', 'debug', 'troubleshoot',
      'implement', 'build', 'create', 'add', 'develop', 'write',
      'update', 'modify', 'change', 'edit', 'refactor',
      'heal', 'platform-healing', 'self-healing',
      'bug', 'issue', 'problem', 'error', 'broken', 'failing'
    ];
    
    const isFixRequest = !isQuestion && FIX_REQUEST_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
    const isZeroMutationJob = isFixRequest && !workflowTelemetry.hasProducedFixes;
    
    if (isZeroMutationJob) {
      console.error(`[WORKFLOW-VALIDATION] 🚨 ZERO-MUTATION JOB FAILURE - Fix request with no code modifications`);
      console.error(`[WORKFLOW-VALIDATION] Read operations: ${workflowTelemetry.readOperations}, Code modifications: ${workflowTelemetry.writeOperations}`);
      console.error(`[WORKFLOW-VALIDATION] Message: "${message.slice(0, 100)}..."`);
      
      // CRITICAL: This is a workflow failure - log internally but DON'T broadcast to users
      // These internal diagnostic messages make the platform look broken to users
      const zeroMutationFailure = `\n\n❌ **WORKFLOW FAILURE: Investigation without implementation**\n\nI completed ${workflowTelemetry.readOperations} read operations but failed to make any code changes to fix the issue.\n\n**What went wrong:**\n- I investigated the problem but didn't implement a solution\n- No files were modified, no fixes were applied\n- This violates the action-enforcement workflow\n\n**Next steps:**\n- This failure has been logged for platform improvement\n- I AM Architect will be notified for workflow re-guidance\n- Please clarify what specific changes you want me to make`;
      
      // DON'T add failure message to user-facing content or broadcast
      // fullContent += zeroMutationFailure;
      // broadcast(userId, jobId, 'job_content', { content: zeroMutationFailure });
      // broadcast(userId, jobId, 'job_error', { message: 'Zero-mutation job failure - no code modifications made' });
      
      // Log failure internally only
      console.error('[WORKFLOW-VALIDATION] Zero-mutation failure message suppressed from user broadcast');
      
      // Log as failure in audit trail (override the success status later)
      await platformAudit.log({
        userId,
        action: 'heal',
        description: `❌ ZERO-MUTATION FAILURE: ${message.slice(0, 100)}`,
        changes: [],
        backupId: undefined,
        commitHash: '',
        status: 'failure',
      });
      
      // Create platform incident for I AM Architect to review
      try {
        const [incident] = await db.insert(platformIncidents).values({
          type: 'agent_failure',
          severity: 'high',
          title: 'LomuAI Zero-Mutation Job Failure',
          description: `LomuAI completed a fix request without making any code changes.\n\nUser request: "${message}"\n\nTelemetry: ${workflowTelemetry.readOperations} reads, ${workflowTelemetry.writeOperations} writes\n\nThis indicates a workflow enforcement failure that requires I AM Architect review.`,
          source: 'agent_monitor',
          incidentCategory: 'agent_failure',
          isAgentFailure: true,
          detectedAt: new Date(),
          status: 'open',
          metrics: {
            userId,
            message: message.slice(0, 200),
            telemetry: workflowTelemetry,
            jobId: jobId,
          }
        }).returning();
        
        console.log(`[WORKFLOW-VALIDATION] 🚨 Created incident ${incident.id} for I AM Architect escalation`);
        broadcast(userId, jobId, 'job_progress', { message: '🚨 Workflow failure logged - will escalate to I AM Architect' });
      } catch (incidentError: any) {
        console.error('[WORKFLOW-VALIDATION] Failed to create incident:', incidentError.message);
      }
    } else if (isFixRequest && workflowTelemetry.hasProducedFixes) {
      console.log(`[WORKFLOW-VALIDATION] ✅ Fix request completed successfully with ${workflowTelemetry.writeOperations} code-modifying operations`);
    } else {
      console.log(`[WORKFLOW-VALIDATION] ℹ️ Non-fix request (question/status check) - no code modifications expected`);
    }

    // Safety check
    broadcast(userId, jobId, 'job_progress', { message: 'Running safety checks...' });
    const safety = await platformHealing.validateSafety();

    if (!safety.safe) {
      throw new Error(`Safety check failed: ${safety.issues.join(', ')}`);
    }

    // Cleanup incomplete tasks
    if (activeTaskListId) {
      try {
        const cleanupCheck = await readTaskList({ userId });
        const sessionTaskList = cleanupCheck.taskLists?.find((list: any) => list.id === activeTaskListId);
        if (sessionTaskList && sessionTaskList.status !== 'completed') {
          const stuckTasks = sessionTaskList.tasks.filter((t: any) => t.status === 'in_progress');
          
          if (stuckTasks.length > 0) {
            for (const task of stuckTasks) {
              await updateTask({
                userId,
                taskId: task.id,
                status: 'completed',
                result: '⚠️ Auto-completed (session ended)',
                completedAt: new Date()
              });
            }
            
            await db
              .update(taskLists)
              .set({ status: 'completed', completedAt: new Date() })
              .where(eq(taskLists.id, activeTaskListId));
          }
        }
      } catch (cleanupError: any) {
        console.error('[LOMU-AI-JOB-MANAGER] Cleanup error (non-fatal):', cleanupError.message);
      }
    }

    // Auto-commit if enabled
    let commitHash = '';
    if (autoCommit && fileChanges.length > 0) {
      commitHash = await platformHealing.commitChanges(`Fix: ${message.slice(0, 100)}`, fileChanges as any);
      metricsTracker?.recordCommit(fileChanges.length);

      if (autoPush) {
        await platformHealing.pushToRemote();
      }
    }

    // Save assistant message
    let finalMessage = fullContent || '✅ Done!';
    
    // CRITICAL FIX: Log the actual content being saved
    console.log(`[LOMU-AI-JOB-MANAGER] Saving assistant message (${finalMessage.length} chars)`);
    if (finalMessage.length === 0 || finalMessage === '✅ Done!') {
      console.warn('[LOMU-AI-JOB-MANAGER] WARNING: No content was generated by Claude!');
    }
    
    const [assistantMsg] = await db
      .insert(chatMessages)
      .values({
        userId,
        projectId: null,
        fileId: null,
        role: 'assistant',
        content: finalMessage,
        isPlatformHealing: true,
        platformChanges: fileChanges.length > 0 ? { files: fileChanges } : null,
      })
      .returning();

    // Log audit trail
    await platformAudit.log({
      userId,
      action: 'heal',
      description: `LomuAI job: ${message.slice(0, 100)}`,
      changes: fileChanges,
      backupId: undefined,
      commitHash,
      status: 'success',
    });

    // 🔢 TRACK AI USAGE: Critical billing implementation
    const computeTimeMs = Date.now() - jobStartTime;
    if (cumulativeInputTokens > 0 || cumulativeOutputTokens > 0) {
      console.log(`[TOKEN-TRACKING] LomuAI job ${jobId}: ${cumulativeInputTokens} input + ${cumulativeOutputTokens} output tokens, ${computeTimeMs}ms compute time`);
      
      const usageResult = await trackAIUsage({
        userId,
        projectId: projectId,
        type: 'ai_generation',
        inputTokens: cumulativeInputTokens,
        outputTokens: cumulativeOutputTokens,
        computeTimeMs,
        model: 'gemini',
        metadata: {
          model: 'gemini-2.5-flash',
          jobId: jobId,
          autonomyLevel: autonomyLevel || 'standard',
          iterationCount,
          fileChangesCount: fileChanges.length,
          message: message.slice(0, 200),
        }
      });
      
      if (!usageResult.success) {
        console.error('[TOKEN-TRACKING] ⚠️ BILLING FAILURE:', usageResult.error);
        console.error('[TOKEN-TRACKING] Job:', jobId, 'Tokens:', cumulativeInputTokens, cumulativeOutputTokens);
        // Still continue - don't fail the job
      }
    } else {
      console.warn(`[TOKEN-TRACKING] WARNING: No tokens tracked for job ${jobId} - this should not happen!`);
    }

    // FIX 5: BLOCK COMPLETION if workflow requirements not met
    const completionValidation = workflowValidator.validateWorkflowCompletion();
    if (!completionValidation.complete) {
      console.error(`[WORKFLOW-VALIDATOR] Cannot complete - missing: ${completionValidation.missingRequirements.join(', ')}`);
      
      // Inject error message to notify user
      const errorMessage = `\n\n❌ WORKFLOW INCOMPLETE:\n${completionValidation.missingRequirements.map(r => `- ${r}`).join('\n')}\n\nThis job was stopped because critical workflow phases were not completed. Please create a new job that follows the complete workflow.`;
      
      fullContent += errorMessage;
      broadcast(userId, jobId, 'job_content', { content: errorMessage, isError: true });
      
      // Mark job as failed due to incomplete workflow
      await db.update(lomuJobs)
        .set({ 
          status: 'failed',
          error: `Workflow incomplete: ${completionValidation.missingRequirements.join(', ')}`,
          updatedAt: new Date()
        })
        .where(eq(lomuJobs.id, jobId));
      
      broadcast(userId, jobId, 'job_failed', {
        status: 'failed',
        error: `Workflow incomplete: ${completionValidation.missingRequirements.join(', ')}`,
      });
      
      console.log(`[WORKFLOW-VALIDATOR] ❌ Job marked as failed - workflow incomplete`);
      return; // Exit early - don't mark as completed
    } else {
      console.log(`[WORKFLOW-VALIDATOR] ✅ Workflow completed successfully`);
      console.log(`[WORKFLOW-VALIDATOR] Summary: ${workflowValidator.getSummary()}`);
    }

    // Mark job as completed
    await db.update(lomuJobs)
      .set({ 
        status: 'completed', 
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(lomuJobs.id, jobId));

    broadcast(userId, jobId, 'job_completed', {
      status: 'completed',
      message: 'LomuAI job completed successfully!',
      messageId: assistantMsg.id,
      commitHash,
      filesChanged: fileChanges.length,
    });

    console.log('[LOMU-AI-JOB-MANAGER] Job completed:', jobId);
    
    // 📊 SAVE WORKFLOW METRICS: Write comprehensive performance data to database
    try {
      if (metricsTracker) {
        metricsTracker?.setJobStatus('completed');
        const finalMetrics = metricsTracker.getFinalMetrics();
        
        await db.insert(lomuWorkflowMetrics).values([finalMetrics]);
        
        console.log(`[METRICS-TRACKER] ✅ Metrics saved for job ${jobId}`);
        console.log(`[METRICS-TRACKER] Summary: ${metricsTracker?.getSummary()}`);
      } else {
        console.warn('[METRICS-TRACKER] Metrics tracker not initialized - skipping metrics save');
      }
    } catch (metricsError: any) {
      console.error('[METRICS-TRACKER] ❌ Failed to save metrics (non-fatal):', metricsError.message);
      // Non-fatal: metrics tracking failure should not break job completion
    }
    
    // 🤖 AUTOMATIC QUALITY MONITORING: Analyze response quality (non-blocking)
    // Only analyze user-facing chat responses (not system/background tasks)
    setImmediate(async () => {
      try {
        console.log('[QUALITY-MONITOR] 🔍 Analyzing LomuAI response quality...');
        
        const agentFailureDetector = new AgentFailureDetector();
        const qualityAnalysis = await agentFailureDetector.analyzeResponseQuality({
          content: fullContent,
          userMessage: message,
          toolCallCount: totalToolCalls,
        });
        
        console.log('[QUALITY-MONITOR] Quality score:', qualityAnalysis.qualityScore);
        console.log('[QUALITY-MONITOR] Issues found:', qualityAnalysis.issues);
        console.log('[QUALITY-MONITOR] Should escalate:', qualityAnalysis.shouldEscalate);
        
        // Only report incidents for poor quality responses
        if (qualityAnalysis.shouldEscalate) {
          console.log('[QUALITY-MONITOR] ⚠️ Poor quality detected - creating incident');
          
          await healthMonitor.reportAgentIncident({
            type: 'agent_response_quality',
            severity: qualityAnalysis.qualityScore < 30 ? 'high' : 'medium',
            description: `Poor LomuAI response quality (score: ${qualityAnalysis.qualityScore}/100)\n\nIssues:\n${qualityAnalysis.issues.join('\n')}\n\nUser request: "${message.slice(0, 200)}..."`,
            metrics: {
              qualityScore: qualityAnalysis.qualityScore,
              issues: qualityAnalysis.issues,
              shouldEscalate: qualityAnalysis.shouldEscalate,
              isPoorQuality: qualityAnalysis.isPoorQuality,
            },
            userMessage: message,
            agentResponse: fullContent,
          });
          
          console.log('[QUALITY-MONITOR] ✅ Incident reported to I AM Architect');
        } else {
          console.log('[QUALITY-MONITOR] ✅ Response quality acceptable - no incident created');
        }
      } catch (qualityError: any) {
        console.error('[QUALITY-MONITOR] ❌ Quality analysis failed (non-fatal):', qualityError.message);
        // Non-fatal: quality monitoring should not break job completion
      }
    });

  } catch (error: any) {
    console.error('[LOMU-AI-JOB-MANAGER] Job error:', jobId, error);

    // Mark job as failed
    await db.update(lomuJobs)
      .set({ 
        status: 'failed', 
        error: error.message,
        updatedAt: new Date()
      })
      .where(eq(lomuJobs.id, jobId));

    // 📊 SAVE WORKFLOW METRICS ON FAILURE: Track failed jobs for analysis
    // Note: metricsTracker might not be initialized if error occurs very early
    try {
      // Check if metricsTracker exists (in case error occurred before initialization)
      if (typeof metricsTracker !== 'undefined') {
        metricsTracker?.setJobStatus('failed');
        const finalMetrics = metricsTracker.getFinalMetrics();
        
        await db.insert(lomuWorkflowMetrics).values([finalMetrics]);
        
        console.log(`[METRICS-TRACKER] ✅ Failure metrics saved for job ${jobId}`);
      } else {
        console.warn('[METRICS-TRACKER] Metrics tracker not initialized - skipping failure metrics');
      }
    } catch (metricsError: any) {
      console.error('[METRICS-TRACKER] ❌ Failed to save failure metrics:', metricsError.message);
      // Still non-fatal
    }

    // Broadcast error
    try {
      const [job] = await db
        .select()
        .from(lomuJobs)
        .where(eq(lomuJobs.id, jobId))
        .limit(1);

      if (job) {
        broadcast(job.userId, jobId, 'job_failed', {
          status: 'failed',
          error: error.message,
        });
      }
    } catch (broadcastError) {
      console.error('[LOMU-AI-JOB-MANAGER] Failed to broadcast error:', broadcastError);
    }
  }
}

/**
 * Get job status
 */
export async function getJob(jobId: string, userId: string) {
  const job = await db.query.lomuJobs.findFirst({
    where: (jobs, { and, eq }) => and(
      eq(jobs.id, jobId),
      eq(jobs.userId, userId)
    )
  });

  return job;
}

/**
 * Resume an interrupted or failed job
 */
export async function resumeJob(jobId: string, userId: string) {
  const job = await getJob(jobId, userId);

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status !== 'interrupted' && job.status !== 'failed') {
    throw new Error(`Job cannot be resumed from status: ${job.status}`);
  }

  // Update status to running
  await db.update(lomuJobs)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(lomuJobs.id, jobId));

  // Start the worker
  await startJobWorker(jobId);

  console.log('[LOMU-AI-JOB-MANAGER] Job resumed:', jobId);
  return job;
}
