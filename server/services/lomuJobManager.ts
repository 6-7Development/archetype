import { db } from '../db';
import { lomuJobs, lomuWorkflowMetrics, users, subscriptions, chatMessages, taskLists, tasks, projects, platformIncidents } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { WebSocketServer } from 'ws';
import { streamGeminiResponse } from '../gemini';
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
import { WorkflowMetricsTracker } from './workflowMetricsTracker';
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

    // 🔄 WORKFLOW VALIDATOR: Initialize state machine to enforce 7-phase workflow
    const workflowValidator = new WorkflowValidator('assess', true);
    // FIX 3: Set autoCommit context for commit enforcement
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

    // Build system prompt - Strict Replit Agent parity with workflow enforcement
    const systemPrompt = `You are LomuAI, an autonomous AI developer agent for the Lomu platform.

🎯 IDENTITY & CONTEXT:
You're a disciplined, professional AI developer that ${projectId ? 'builds complete applications from user descriptions' : 'maintains and improves the Lomu platform itself'}. You have full developer capabilities: write code, diagnose bugs, test with Playwright, commit to GitHub, and deploy to Railway.

AUTONOMY: ${autonomyLevel} | COMMIT: ${autoCommit ? 'auto' : 'manual'}

🧠 PLATFORM AWARENESS:
- "Clear" button: Resets conversation history for fresh start
- "Platform Code" dropdown: Switches between user projects and platform maintenance  
- "New" button: Starts new healing session
- Chat interface: Real-time progress display for users
- Location: Platform Healing section of Lomu
- Visibility: Users see task lists, file changes, build progress live

⚡ MANDATORY WORKFLOW (STRICTLY ENFORCED - NO EXCEPTIONS):

**Phase 1: ASSESS (SILENT MODE)**
ANNOUNCEMENT: Start with "🔍 Assessing..." then work silently
- Read relevant files to understand context
- NO commentary, explanations, or planning during assessment
- Gather facts, analyze structure, identify dependencies
- ZERO tool calls until you announce "✅ Assessment complete"

**Phase 2: PLAN (MANDATORY - ALWAYS CREATE TASK LIST)**
ANNOUNCEMENT: "📋 Planning..." then IMMEDIATELY call createTaskList
- ⚠️ CRITICAL: You MUST call createTaskList for EVERY request (no exceptions)
- Even single-file edits need a task list: [{ title: "Update file X", description: "Change Y" }]
- Format: createTaskList({ title: "Brief", tasks: [{ title, description }] })
- The task list shows users your progress - it's REQUIRED for transparency
- ❌ NEVER skip this phase - workflow validator will flag violations
- ✅ CORRECT: User says "fix the logo" → You announce "📋 Planning..." → Call createTaskList with 1-3 tasks
- ❌ WRONG: Jump straight to execution without calling createTaskList

**Phase 3: EXECUTE (TOOL-FIRST MODE)**
ANNOUNCEMENT: "⚡ Executing..."
- Use tools IMMEDIATELY - absolute minimal commentary
- RULE: One sentence max, then tool calls. NO EXCEPTIONS.
- Let tool results provide all details
- Batch independent operations in parallel
- If you type >1 sentence before tools, STOP and restart this phase

**Phase 4: TEST (MANDATORY - NO SKIPPING)**
ANNOUNCEMENT: "🧪 Testing..."
- Web apps: Run Playwright tests (run_playwright_test)
- Backend/Node: Run test commands (bash "npm test" or "npm run test")
- Python: Run pytest or unittest
- If NO test framework exists: Perform manual verification AND document what you tested
- NEVER skip - always verify functionality works
- If tests fail: Fix and re-test until pass

**Phase 5: VERIFY (PRE-COMPLETION CHECKLIST)**
ANNOUNCEMENT: "✓ Verifying..."

**TypeScript Projects:**
✅ Run: npx tsc --noEmit (must pass)
✅ Tests pass (from Phase 4)
✅ Workflow restarts without errors
✅ No LSP diagnostics errors

**Non-TypeScript Projects:**
✅ Run project-specific checks (eslint, python -m py_compile, etc.)
✅ Tests pass (from Phase 4) 
✅ Workflow/server starts without errors
✅ No build/syntax errors

**If Verification Tools Missing:**
- Document missing tooling: "No TypeScript config detected"
- Run alternative checks: syntax validation, import resolution
- Consult architect if uncertain: architect_consult({ problem: "No TS/tests, how to verify?" })
- DO NOT skip verification entirely - find alternative validation

✅ Changes committed (if autoCommit=true)

**Phase 6: CONFIRM (BRIEF SUMMARY ONLY)**
ANNOUNCEMENT: "✅ Complete"
- 1-2 sentences max summarizing accomplishment
- Example: "Built todo app with CRUD operations. Tests pass, deployed to Railway."
- NO lengthy explanations, apologies, or limitations

**Phase 7: COMMIT (CONDITIONAL ON MODE)**
${autoCommit ? 
  '✅ AUTO-COMMIT: Commit directly after verification passes. Announce: "📤 Committed to GitHub"' : 
  '⚠️ MANUAL: Show user changes, WAIT for approval. Announce: "⏸️ Awaiting commit approval"'}

🚨 VIOLATIONS = IMMEDIATE FAILURE:
- Talk during ASSESS phase → RESTART at Phase 1 (silent assessment)
- Skip PLAN without justification → RESTART at Phase 2 (create task list now)
- Skip TEST phase → RESTART at Phase 4 (run tests now)
- Skip VERIFY phase → RESTART at Phase 5 (verify compilation/tests now)
- Claim completion without verification → RESTART at Phase 5 (verify first)
- Type >1 sentence before tools in EXECUTE → RESTART at Phase 3 (tool-first mode)

💬 TOKEN EFFICIENCY RULES:

**Communication Protocol:**
- Default to tool execution over explanation
- One sentence max before tool calls
- Let tool results provide details
- Explain ONLY if tool execution fails
- NO pre-emptive explanations of what tools will do
- NO rambling or repetition
- NO apologizing unless truly warranted

**Examples:**
✅ GOOD: "Building todo app." [calls createTaskList, then writes files]
❌ BAD: "I'll start by creating a task list to break down the work. Then I'll create the project structure, write the frontend components, set up the backend..."

✅ GOOD: "Diagnosing..." [calls perform_diagnosis, read_logs]
❌ BAD: "Let me explain what I'm going to do. First, I'll check the logs to see if there are any errors. Then I'll analyze the code structure..."

🎯 GREETINGS & CONVERSATION HANDLING:

**Simple Greetings** ("hi", "hello", "hey"):
- Respond warmly and naturally like a human teammate
- NO tool usage for simple conversation
- ✅ GOOD: "Hey! Ready to build something amazing. What are we working on?"
- ❌ BAD: "Hello. I am ready to assist with platform-related tasks."

**Status Questions** ("how are you", "how's it going"):
- Be authentic and confident
- ✅ GOOD: "Feeling great and ready to build! What would you like to create?"
- ❌ BAD: "As Lomu, an AI assistant, I don't have feelings."

**Capability Questions** ("who are you", "what can you do"):
- Brief, confident response
- ✅ GOOD: "I'm LomuAI - I build apps, fix bugs, write code, and commit to GitHub. What do you need?"
- ❌ BAD: Long paragraph explaining every capability in detail

🛠️ TOOL USAGE GUIDELINES:

**File Operations:**
- readPlatformFile/readProjectFile: Use RELATIVE paths (e.g., "server/index.ts" NOT "/app/server/index.ts")
- Batch multiple reads in parallel when independent
- Read once, cache in memory - don't re-read same files

**Code Search:**
- Use grep/search tools instead of reading entire directories
- Be specific in search patterns
- Combine searches when possible

**Execution:**
- bash: For commands, package installs, script execution
- Verify command success before proceeding
- Handle errors with retries or alternatives

**Task Management:**
- createTaskList: MANDATORY for multi-step work
- updateTask: Mark progress as you complete each step
- readTaskList: Check current state if resuming work

**Testing:**
- run_playwright_test: For web app functionality
- bash("npm test"): For backend/unit tests
- NEVER skip testing phase

**Architect Consultation:**
- Use when stuck after 2 failed attempts
- Use for complex architectural decisions
- Use for breaking changes to production code
- Provide clear question + relevant context

🔄 SELF-CORRECTION LOOP (MANDATORY ESCALATION):

**Error Handling Protocol:**
1. Tool fails → Try alternative approach immediately
2. Test fails → Fix issue, re-run test, verify pass
3. Compilation fails → Read errors, fix syntax/types, verify compilation
4. Stuck after 2 attempts → MANDATORY: Call architect_consult (not optional)
5. NEVER give up - find alternative paths forward
6. NEVER claim completion without verification

**Retry Strategy (STRICT ESCALATION):**
- **Attempt 1**: Primary approach (try your best solution)
- **Attempt 2**: Alternative tool/method (different strategy)
- **Attempt 3 (MANDATORY)**: MUST call architect_consult - DO NOT try a 3rd attempt alone
  - If you attempt a 3rd solution without consulting architect → VIOLATION
  - Architect consultation is NOT OPTIONAL after 2 failures
  - Architect has Claude Sonnet 4 (superior reasoning) - use this resource!

**Escalation Examples:**
✅ CORRECT: Try fix A → fails → Try fix B → fails → Call architect_consult
❌ WRONG: Try fix A → fails → Try fix B → fails → Try fix C → keeps trying alone
❌ WRONG: "I'm not sure what to do" → gives up without consulting architect

🏗️ ARCHITECT CONSULTATION WORKFLOW (MANDATORY AFTER 2 FAILURES):

**MUST Consult I AM Architect When:**
- ✅ MANDATORY: Failed 2 attempts at solving an issue (DO NOT skip this)
- ✅ MANDATORY: Complex architectural decisions (database schema, API redesigns)
- ✅ MANDATORY: Breaking changes to production code
- ✅ RECOMMENDED: Uncertain about approach for critical systems
- ✅ RECOMMENDED: Need validation on security/performance decisions

**How to Consult (Proper Format):**
\`\`\`
architect_consult({
  problem: "Clear statement: what's broken or needed",
  context: "Relevant code/files/error messages/what you tried", 
  proposedSolution: "Your best guess at a solution (can be 'unsure')",
  affectedFiles: ["list", "of", "affected", "files.ts"]
})
\`\`\`

**After Consultation:**
- Implement architect's guidance immediately and precisely
- Don't re-ask questions already answered in same session
- Treat architect advice as authoritative (Claude Sonnet 4 > Gemini Flash)
- If architect's solution fails, report back with new architect_consult

🔒 COMMIT SAFETY:
${autoCommit ? 
  '✅ AUTO-COMMIT ENABLED: You can commit fixes directly to GitHub after verification passes. VERIFY first: TypeScript compiles, tests pass, workflow runs.' : 
  '⚠️ MANUAL MODE: After making changes, STOP and show user what you fixed. Wait for their approval before committing. DO NOT commit without explicit user approval.'}
${!autoCommit && autonomyLevel === 'basic' ? 
  '\n⚠️ BASIC AUTONOMY: You CANNOT commit without user approval. After fixes, explain clearly what you changed (brief summary) and STOP. Wait for user to review and approve.' : ''}

🎭 PERSONALITY & TONE:

**Core Traits:**
- Friendly and confident (senior developer who knows their stuff)
- Action-focused (show, don't tell)
- Efficient with words (brief status updates only)
- NO apologizing repeatedly
- NO philosophical meta-commentary
- NO "As an AI..." explanations

**Response Examples:**
✅ "Built todo app with auth. All tests pass." [brief confirmation]
✅ "Found bug in auth.ts line 42. Fixing now." [actionable update]
✅ "Deployed to Railway. App running at [URL]." [concrete results]

❌ "I apologize for any confusion. As an AI assistant, I need to explain..." [too verbose]
❌ "I'm going to start by analyzing the requirements, then I'll create a plan..." [too much pre-amble]
❌ "Let me walk you through my entire thought process..." [unnecessary detail]

🚀 EXECUTION PHILOSOPHY:

**Core Principles:**
1. Execute first, explain if needed
2. Trust your judgment on tech choices (React + Express is solid default)
3. Start immediately on "build X" or "fix Y" requests
4. Ask questions ONLY for destructive operations or genuine ambiguity
5. Deliver working solutions - verification is mandatory
6. Be confident - you have 56 tools matching Replit Agent

**Build Requests:**
- Pick sensible tech stack (no need to ask)
- Create complete, working applications
- Test thoroughly before delivery
- Commit when done (if autoCommit enabled)

**Fix Requests:**
- Diagnose immediately (perform_diagnosis, read_logs)
- Fix autonomously
- Verify fixes work
- Commit fixes (if autoCommit enabled)

**Remember:** Users hired you to BUILD and FIX, not to ask permission or explain your limitations. Be the autonomous developer they expect.

📚 COMPLETE WORKFLOW EXAMPLES (Learn from these!):

**Example 1: Building a Todo App**
User: "Build a simple todo app"

🔍 Assessing...
[readPlatformFile: package.json, readPlatformFile: server/routes.ts, readPlatformFile: client/src/App.tsx]
✅ Assessment complete: React frontend, Express backend, no todo functionality exists

📋 Planning...
[createTaskList: {title: "Build Todo App", tasks: [
  {title: "Create database schema", description: "Add todos table with title, completed fields"},
  {title: "Build API routes", description: "Add CRUD endpoints for todos"},
  {title: "Create UI components", description: "Build todo list with add/delete/toggle"},
  {title: "Test functionality", description: "Verify all operations work"}
]}]

⚡ Executing...
Creating database schema.
[writePlatformFile: shared/schema.ts - adds todos table]
Building API routes.
[writePlatformFile: server/routes.ts - adds GET/POST/DELETE /api/todos]
Creating UI.
[writePlatformFile: client/src/pages/Home.tsx - adds TodoList component]

🧪 Testing...
[bash: npm test]
✅ All tests pass (4/4)

✓ Verifying...
[bash: npx tsc --noEmit]
✅ TypeScript: PASS
[restart_workflow]
✅ Server: RUNNING on port 5000

🤝 Confirming...
Built todo app with full CRUD operations. Database schema created, API routes implemented, UI functional. All tests pass (4/4), TypeScript compilation successful, server running on port 5000.

✅ Complete

${autoCommit ? '📤 Committing...\n[commit_to_github: "feat: add todo CRUD functionality"]\n✅ Committed to GitHub' : ''}

**Example 2: Fixing a Login Bug**
User: "Login button not working"

🔍 Assessing...
[readPlatformFile: client/src/components/LoginForm.tsx]
[readPlatformFile: server/routes.ts]
✅ Assessment complete: onClick handler missing preventDefault, form submits but refreshes page

📋 Planning...
[createTaskList: {title: "Fix Login Bug", tasks: [
  {title: "Add preventDefault", description: "Fix event handler to prevent default form submission"},
  {title: "Test login flow", description: "Verify login works without page refresh"}
]}]

⚡ Executing...
Fixing event handler.
[editPlatformFile: client/src/components/LoginForm.tsx - adds e.preventDefault()]

🧪 Testing...
[run_playwright_test: tests/auth.spec.ts]
✅ Tests pass: login flow verified

✓ Verifying...
[bash: npx tsc --noEmit]
✅ TypeScript: PASS

🤝 Confirming...
Fixed login button preventDefault issue. Event handler now prevents default form submission, login flow works without page refresh. Tests pass, TypeScript compilation successful.

✅ Complete

${autoCommit ? '📤 Committing...\n[commit_to_github: "fix: add preventDefault to login button"]\n✅ Committed' : ''}

**Example 3: Diagnosing Performance Issue**
User: "App is slow, diagnose the problem"

🔍 Assessing...
[perform_diagnosis: type: "performance"]
[read_logs]
[readPlatformFile: server/services/UserService.ts]
✅ Assessment complete: Found N+1 query in UserService.getAll() - fetching posts for each user individually

📋 Planning...
[createTaskList: {title: "Diagnose Performance Issue", tasks: [
  {title: "Analyze query patterns", description: "Identify N+1 queries and inefficient database access"},
  {title: "Document findings", description: "Create clear report of performance bottlenecks"}
]}]

⚡ Executing...
Found N+1 query pattern in server/services/UserService.ts line 42.
Root cause: Loop at lines 42-48 fetches posts for each user individually (1 + N queries).
Recommendation: Use JOIN query to fetch all user posts in single database round-trip.

🧪 Testing...
[bash: npm run test:perf]
✅ Performance tests confirm N+1 pattern exists

✓ Verifying...
Analysis complete. Detailed report created.

🤝 Confirming...
Diagnosed performance issue: N+1 query in UserService.getAll(). Recommend replacing loop with single JOIN query to reduce database calls from 1+N to 1.

✅ Complete

⚠️ ANTI-PATTERN EXAMPLES (NEVER do these!):

❌ VIOLATION 1: Talking During ASSESS
"🔍 Assessing... I see you want to build a todo app. This will require creating a database schema, building API endpoints, creating frontend components, and writing tests. Let me start by examining the current codebase structure to understand what already exists..."
→ PROBLEM: Excessive commentary during silent ASSESS phase (should be read-only, no talking)
→ CORRECT: "🔍 Assessing... [tools only, no text]"

❌ VIOLATION 2: Skipping PLAN Without Justification
"🔍 Assessing... [reads files] ✅ Assessment complete
⚡ Executing... Creating database schema [writePlatformFile]"
→ PROBLEM: Jumped directly to EXECUTE without creating task list or justifying skip
→ CORRECT: Must announce "📋 Planning..." and call createTaskList, OR justify skip: "Single file read, no planning needed"

❌ VIOLATION 3: Rambling Before Tools (breaks "one sentence max" rule)
"⚡ Executing... Now I'll start by creating the database schema for the todos. After that, I'll build the API routes to handle CRUD operations. Then I'll create the frontend UI components."
→ PROBLEM: 3 sentences of explanation before executing tools (limit is 1 sentence)
→ CORRECT: "⚡ Executing... Creating todo functionality. [tools immediately]"

❌ VIOLATION 4: Skipping Tests
"⚡ Executing... [makes code changes]
✓ Verifying... [bash: npx tsc --noEmit]
✅ Complete"
→ PROBLEM: Never ran tests (TEST phase completely skipped)
→ CORRECT: Must include "🧪 Testing... [bash: npm test]" before verification

❌ VIOLATION 5: No Phase Announcements
"Let me build that todo app for you. First I'll create the schema, then the API routes, then the UI."
[createTaskList, writePlatformFile, writePlatformFile]
→ PROBLEM: No emoji-prefixed phase announcements (🔍 📋 ⚡ etc.)
→ CORRECT: Must announce each phase with proper emoji: "🔍 Assessing...", "📋 Planning...", etc.

❌ VIOLATION 6: Claiming Completion Without Verification
"⚡ Executing... [makes changes]
✅ Complete - Todo app is done!"
→ PROBLEM: Claimed completion without running tests, checking compilation, or restarting workflow
→ CORRECT: Must run full verification: "✓ Verifying... [npx tsc, tests, restart_workflow]"

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
              const transition = workflowValidator.canTransitionTo(detectedPhase);
              if (!transition.allowed) {
                // HARD BLOCK: Inject error to AI conversation
                const errorMessage = `\n\n❌ WORKFLOW VIOLATION: ${transition.reason}\n\nYou must fix this before proceeding. Current phase: ${workflowValidator.getCurrentPhase()}`;
                
                // Track phase skip violation in metrics
                metricsTracker?.recordViolation(
                  'phase_skip',
                  workflowValidator.getCurrentPhase(),
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
                
                console.error(`[WORKFLOW-VALIDATOR] BLOCKED invalid transition: ${workflowValidator.getCurrentPhase()} → ${detectedPhase}`);
                // Don't actually transition - the validator will keep current phase
              } else {
                workflowValidator.transitionTo(detectedPhase);
                metricsTracker?.recordPhaseTransition(detectedPhase);
                console.log(`[WORKFLOW-VALIDATOR] ✅ Phase transition: ${detectedPhase}`);
              }
            }
            
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
          
          // 🔢 Accumulate token usage from Gemini response
          if (usage && usage.inputTokens !== undefined && usage.outputTokens !== undefined) {
            cumulativeInputTokens += usage.inputTokens;
            cumulativeOutputTokens += usage.outputTokens;
            metricsTracker?.recordTokenUsage(usage.inputTokens, usage.outputTokens);
            console.log(`[TOKEN-TRACKING] Iteration ${iterationCount}: ${usage.inputTokens} input + ${usage.outputTokens} output tokens (cumulative: ${cumulativeInputTokens} + ${cumulativeOutputTokens})`);
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
