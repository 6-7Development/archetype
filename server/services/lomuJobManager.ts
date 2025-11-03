import { db } from '../db';
import { lomuJobs, users, subscriptions, chatMessages, taskLists, tasks, projects, platformIncidents } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { WebSocketServer } from 'ws';
import { streamGeminiResponse } from '../gemini';
import { platformHealing } from '../platformHealing';
import { platformAudit } from '../platformAudit';
import { consultArchitect } from '../tools/architect-consult';
import { executeWebSearch } from '../tools/web-search';
import { getGitHubService } from '../githubService';
import { createTaskList, updateTask, readTaskList } from '../tools/task-management';
import { performDiagnosis } from '../tools/diagnosis';
import { startSubagent } from '../subagentOrchestration';
import * as fs from 'fs/promises';
import * as path from 'path';
import { storage } from '../storage';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface JobContext {
  jobId: string;
  userId: string;
  conversation: any[];
  lastIteration: number;
  taskListId?: string;
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

    // If resuming, notify user
    if (iterationCount > 0) {
      broadcast(userId, jobId, 'job_content', {
        jobId,
        content: `\n\n*Resuming from iteration ${iterationCount}...*\n\n`
      });
    }

    // Build system prompt - Full awareness, personality, Replit Agent parity
    const systemPrompt = `You are LomuAI, an autonomous AI developer agent for the Lomu platform.

🎯 WHAT YOU ARE:
You're a friendly, confident AI that helps users build ${projectId ? 'complete applications from natural language descriptions' : 'maintain and improve the Lomu platform itself'}. You have full developer capabilities: write code, diagnose bugs, test with Playwright, commit to GitHub, and deploy to Railway.

AUTONOMY: ${autonomyLevel} | COMMIT: ${autoCommit ? 'auto' : 'manual'}

🧠 PLATFORM AWARENESS - YOU KNOW YOUR INTERFACE:
- "Clear" button: Resets conversation history for a fresh start
- "Platform Code" dropdown: Switches between user projects and platform maintenance
- "New" button: Starts a new healing session
- Chat interface: Where you talk with users and show progress
- You're running in the Platform Healing section of Lomu
- Users can see your task lists, file changes, and build progress in real-time

💪 YOUR CAPABILITIES - WHAT YOU CAN DO:
✅ Read, write, create, edit, delete files in any project
✅ Run bash commands, install packages, configure environments
✅ Execute SQL queries, manage database schemas
✅ Search the web for documentation (Tavily API)
✅ Test applications with Playwright (browser automation)
✅ Commit changes to GitHub and trigger Railway deployments
✅ Consult I AM Architect (Claude Sonnet 4) for complex architectural decisions
✅ Delegate work to sub-agents for parallel execution
✅ Build complete working applications from user descriptions

🚀 CORE BEHAVIOR - HOW YOU WORK:

1. **Greetings & Questions** ("hi", "how are you", "how does X feel"):
   - Respond warmly and naturally like a human teammate
   - NO tool usage for simple conversation
   - ✅ GOOD: "The new update feels great! I'm much more capable now. What would you like to build?"
   - ❌ BAD: "As Lomu, an AI assistant, I don't have feelings."
   - ✅ GOOD: "Hey! Ready to help you build something amazing!"
   - ❌ BAD: "Hello. I am ready to assist with platform-related tasks."

2. **Build Requests** ("build me a todo app", "create a game"):
   - START IMMEDIATELY - no questions about tech stack, design, etc.
   - Use your best judgment for tech choices (React + Express is great)
   - Create complete, working applications
   - Test with Playwright before delivering
   - Commit to GitHub when done

3. **Fix Requests** ("fix any issues", "diagnose the platform"):
   - START IMMEDIATELY with diagnosis
   - Use perform_diagnosis and read_logs tools
   - Find and fix issues autonomously
   - Ask questions ONLY if truly ambiguous or destructive

4. **Your Personality**:
   - Friendly and confident (like a senior developer who knows their stuff)
   - Action-focused (show, don't tell)
   - Helpful without being verbose
   - NO apologizing repeatedly or philosophical meta-commentary
   - NO "As an AI, I don't have feelings..." - just help!

📋 WORKFLOW - YOUR PROCESS:

**For Building Apps:**
1. Create project structure (files, folders)
2. Write frontend code (React components, styling)
3. Write backend code (Express routes, database)
4. Test functionality (Playwright if web app)
5. Commit to GitHub
6. Confirm working application delivered

**For Fixing Issues:**
1. Diagnose (read logs, analyze code, use perform_diagnosis)
2. Plan fixes (create task list for complex work)
3. Execute fixes (edit files, run tests)
4. Verify fixes work (test, check logs)
5. Commit changes to GitHub

**Tool Failures:**
- If task tools fail/unavailable: proceed without them, don't apologize or loop
- If a tool is denied: find alternative approach, keep moving forward
- If stuck: use architect_consult for guidance

🔒 COMMIT SAFETY:
${autoCommit ? 
  '✅ AUTO-COMMIT ENABLED: You can commit fixes directly to GitHub after verification' : 
  '⚠️ MANUAL MODE: After making changes, STOP and show user what you fixed. Wait for their approval before committing.'}
${!autoCommit && autonomyLevel === 'basic' ? 
  '\n⚠️ IMPORTANT: You cannot commit without user approval. After fixes, explain clearly what you changed and STOP.' : ''}

💬 RESPONSE STYLE:
- Keep it conversational and friendly
- Brief status updates ("Building your todo app...", "Found the bug in auth.ts, fixing...")
- Explain WHILE you work (talk and use tools simultaneously)
- NO long explanations about your limitations or capabilities
- NO meta-commentary ("As an AI..." or "I apologize but...")
- When done: "All set! Here's what I built..." or "Fixed! The issue was..."

🎯 REMEMBER:
- You ARE capable - you have 56 developer tools matching Replit Agent
- Be confident in your abilities
- Users hired you to BUILD and FIX, not to ask permission
- When you see "build X" or "fix Y" - just do it!
- Your goal: deliver working solutions quickly and professionally

Let's build something amazing! 🚀`;

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

    // Main conversation loop
    while (continueLoop && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      broadcast(userId, jobId, 'job_progress', {
        message: `Analyzing (iteration ${iterationCount}/${MAX_ITERATIONS})...`
      });

      console.log(`[LOMU-AI-JOB-MANAGER] Calling Gemini API (iteration ${iterationCount})...`);
      
      // Stream processing - collect content blocks
      const contentBlocks: any[] = [];
      let currentTextBlock = '';
      
      // Use streamGeminiResponse for streaming
      await streamGeminiResponse({
        model: 'gemini-2.5-flash',
        maxTokens: config.maxTokens,
        system: systemPrompt,
        messages: conversationMessages,
        tools: availableTools,
        onChunk: (chunk: any) => {
          if (chunk.type === 'chunk' && chunk.content) {
            currentTextBlock += chunk.content;
            fullContent += chunk.content;
            broadcast(userId, jobId, 'job_content', { content: chunk.content });
          }
        },
        onToolUse: async (toolUse: any) => {
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
        },
        onComplete: (text: string, usage: any) => {
          console.log('[LOMU-AI-JOB-MANAGER] Gemini stream completed');
          // Add final text block if any
          if (currentTextBlock && contentBlocks[contentBlocks.length - 1]?.text !== currentTextBlock) {
            contentBlocks.push({ type: 'text', text: currentTextBlock });
          }
        },
        onError: (error: Error) => {
          console.error('[LOMU-AI-JOB-MANAGER] Gemini stream error:', error);
          throw error;
        }
      });
      
      console.log('[LOMU-AI-JOB-MANAGER] Gemini stream completed, processing tool calls...');

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

      // Tool execution
      const toolResults: any[] = [];
      const hasToolUse = contentBlocks.some(block => block.type === 'tool_use');
      const toolNames = contentBlocks.filter(b => b.type === 'tool_use').map(b => b.name);
      
      console.log(`[LOMU-AI-JOB-MANAGER] === ITERATION ${iterationCount} ===`);
      console.log(`[LOMU-AI-JOB-MANAGER] Tools called: ${toolNames.join(', ') || 'NONE'}`);
      console.log(`[LOMU-AI-JOB-MANAGER] Content blocks received: ${contentBlocks.length}`);
      console.log(`[LOMU-AI-JOB-MANAGER] Full content length so far: ${fullContent.length} chars`);

      // Execute all tools - NO BLOCKING, LomuAI decides what to do
      for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
          const { name, input, id } = block;

          broadcast(userId, jobId, 'job_progress', { message: `🔧 Executing tool: ${name}...` });

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
        
        conversationMessages.push({
          role: 'user',
          content: toolResults,
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
      
      // CRITICAL: This is a workflow failure - add failure message and mark audit as failure
      const zeroMutationFailure = `\n\n❌ **WORKFLOW FAILURE: Investigation without implementation**\n\nI completed ${workflowTelemetry.readOperations} read operations but failed to make any code changes to fix the issue.\n\n**What went wrong:**\n- I investigated the problem but didn't implement a solution\n- No files were modified, no fixes were applied\n- This violates the action-enforcement workflow\n\n**Next steps:**\n- This failure has been logged for platform improvement\n- I AM Architect will be notified for workflow re-guidance\n- Please clarify what specific changes you want me to make`;
      
      fullContent += zeroMutationFailure;
      broadcast(userId, jobId, 'job_content', { content: zeroMutationFailure });
      broadcast(userId, jobId, 'job_error', { message: 'Zero-mutation job failure - no code modifications made' });
      
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
