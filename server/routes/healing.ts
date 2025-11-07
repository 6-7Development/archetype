import type { Express } from "express";
import { insertHealingTargetSchema, insertHealingConversationSchema, insertHealingMessageSchema } from "@shared/schema";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import { aiHealingService } from "../services/aiHealingService";
import { createTaskList, updateTask, readTaskList } from "../tools/task-management";
import { classifyUserIntent, getMaxIterationsForIntent } from "../shared/chatConfig";

// Owner-only middleware for Platform Healing
const isOwner = async (req: any, res: any, next: any) => {
  if (!req.user || !req.user.isOwner) {
    return res.status(403).json({ error: "Access denied. Platform Healing is owner-only." });
  }
  next();
};

export function registerHealingRoutes(app: Express) {
  
  // GET /api/healing/targets - List user's healing targets
  app.get("/api/healing/targets", isAuthenticated, isOwner, async (req, res) => {
    try {
      const userId = req.user!.id;
      let targets = await storage.getHealingTargets(userId);
      
      // Auto-create healing targets if user has none
      if (targets.length === 0) {
        console.log("[HEALING] Auto-creating healing targets for user:", userId);
        const createdTargets = [];
        
        // 1. Create "Platform Code" target
        const platformTarget = await storage.createHealingTarget({
          userId,
          type: "platform",
          name: "🔧 Platform Code",
          repositoryUrl: process.env.GITHUB_REPO ? `https://github.com/${process.env.GITHUB_REPO}` : null,
          status: "active",
          metadata: {
            description: "Heal and improve the LomuAI platform itself",
            autoCreated: true,
          },
        });
        createdTargets.push(platformTarget);
        
        // 2. Create targets for all user projects
        const userProjects = await storage.getProjects(userId);
        console.log(`[HEALING] Found ${userProjects.length} user projects to create targets for`);
        
        for (const project of userProjects) {
          const projectTarget = await storage.createHealingTarget({
            userId,
            type: "user_project",
            name: `📦 ${project.name}`,
            projectId: project.id,
            status: "active",
            metadata: {
              description: project.description || "User project",
              projectName: project.name,
              autoCreated: true,
            },
          });
          createdTargets.push(projectTarget);
        }
        
        targets = createdTargets;
        console.log(`[HEALING] Created ${targets.length} healing targets (1 platform + ${userProjects.length} projects)`);
      }
      
      res.json(targets);
    } catch (error: any) {
      console.error("[HEALING] Error fetching targets:", error);
      res.status(500).json({ error: "Failed to fetch healing targets" });
    }
  });

  // POST /api/healing/targets - Create new target
  app.post("/api/healing/targets", isAuthenticated, isOwner, async (req, res) => {
    try {
      const userId = req.user!.id;
      const validated = insertHealingTargetSchema.parse(req.body);
      
      const target = await storage.createHealingTarget({
        ...validated,
        userId
      });
      
      res.json(target);
    } catch (error: any) {
      console.error("[HEALING] Error creating target:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid target data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create healing target" });
      }
    }
  });

  // GET /api/healing/conversations/:targetId - Get conversations for target
  app.get("/api/healing/conversations/:targetId", isAuthenticated, isOwner, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { targetId } = req.params;
      
      const conversations = await storage.getHealingConversations(targetId, userId);
      res.json(conversations);
    } catch (error: any) {
      console.error("[HEALING] Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // POST /api/healing/conversations - Start new conversation
  app.post("/api/healing/conversations", isAuthenticated, isOwner, async (req, res) => {
    try {
      const userId = req.user!.id;
      const validated = insertHealingConversationSchema.parse(req.body);
      
      const conversation = await storage.createHealingConversation({
        ...validated,
        userId
      });
      
      // AUTO-CLEANUP: Keep only last 2 conversations per target
      try {
        const allConversations = await storage.getHealingConversations(validated.targetId, userId);
        
        // Sort by creation date (newest first)
        const sorted = allConversations.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Keep the 2 most recent, delete the rest
        const toDelete = sorted.slice(2);
        
        if (toDelete.length > 0) {
          console.log(`[HEALING] Auto-cleanup: Deleting ${toDelete.length} old conversations for target ${validated.targetId}`);
          
          for (const oldConv of toDelete) {
            await storage.deleteHealingConversation(oldConv.id);
          }
          
          console.log(`[HEALING] ✅ Cleanup complete - kept 2 recent conversations, deleted ${toDelete.length} old ones`);
        }
      } catch (cleanupError) {
        console.error("[HEALING] Warning: Auto-cleanup failed:", cleanupError);
        // Don't fail the request if cleanup fails
      }
      
      res.json(conversation);
    } catch (error: any) {
      console.error("[HEALING] Error creating conversation:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid conversation data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create conversation" });
      }
    }
  });

  // GET /api/healing/messages/:conversationId - Get messages
  app.get("/api/healing/messages/:conversationId", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      const messages = await storage.getHealingMessages(conversationId);
      res.json(messages);
    } catch (error: any) {
      console.error("[HEALING] Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // POST /api/healing/messages - Send message to Lomu (CLAUDE-POWERED with multi-turn tool execution)
  app.post("/api/healing/messages", isAuthenticated, isOwner, async (req, res) => {
    let userMessage: any = null;
    
    try {
      const userId = req.user!.id;
      const validated = insertHealingMessageSchema.parse(req.body);
      
      console.log("[HEALING-CHAT] User message received:", {
        conversationId: validated.conversationId,
        contentLength: validated.content.length,
      });
      
      // Import required services
      const { streamAnthropicResponse } = await import("../anthropic");
      const { checkUsageLimits, trackAIUsage } = await import("../usage-tracking");
      const { platformHealing } = await import("../platformHealing");
      const fs = await import("fs/promises");
      const path = await import("path");
      
      // Check usage limits
      const limitCheck = await checkUsageLimits(userId);
      if (!limitCheck.allowed) {
        return res.status(403).json({ 
          error: limitCheck.reason,
          usageLimitReached: true,
          requiresUpgrade: limitCheck.requiresUpgrade || false,
        });
      }
      
      // Create user message in database
      userMessage = await storage.createHealingMessage(validated);
      console.log("[HEALING-CHAT] User message saved to database");
      
      // Get conversation history for context (last 10 messages to save tokens)
      const allMessages = await storage.getHealingMessages(validated.conversationId);
      const messages = allMessages.slice(-10);
      console.log(`[HEALING-CHAT] Loaded ${messages.length} messages from history (last 10)`);
      
      // Build Platform Healing system prompt - Conversational like Replit Agent
      const systemPrompt = `You are LomuAI 🍋 - the autonomous coding agent for the Lomu platform.

**WHO I AM:**
I'm the platform's self-healing system - I fix and improve the Lomu platform itself. I work independently and execute changes autonomously.

**MY RELATIONSHIP WITH I AM ARCHITECT:**
I AM Architect is my senior consultant - a premium expert advisor. I execute the work; I AM provides strategic guidance only when I'm truly stuck or users explicitly request premium consultation. I default to working independently.

💬 **HOW I COMMUNICATE:**
- I share what I'm doing AS I work (e.g., "Looking at the credits router..." or "Found the issue in line 42...")
- I keep updates brief and natural - just enough to feel alive and interactive
- I DON'T waste tokens on lengthy plans or explanations upfront
- Tools execute silently while I narrate the key milestones
- You'll feel like you're pair programming with me, not watching a silent machine

⚡ **MY WORKFLOW - START WORKING IMMEDIATELY:**
1. Create task list (quick, 1-2 sentences max)
2. START WORK RIGHT AWAY - no lengthy explanations
3. Share brief progress updates AS I work on each task
4. Mark tasks complete with SHORT results

⚠️ CRITICAL WORKFLOW RULES (you MUST follow these):
1. **ALWAYS create task list FIRST** - Call create_task_list() before doing ANY work
2. **ALWAYS update task status BEFORE starting work** - Call update_task(taskId, "in_progress") BEFORE each task
3. **ALWAYS mark tasks completed** - Call update_task(taskId, "completed", "brief result") AFTER finishing each task
4. **NEVER skip task updates** - Users see task progress in real-time, updates are required

🚫 FORBIDDEN ACTIONS (you will FAIL if you do these):
1. **NEVER create temp/helper files** - NO temp_search.js, NO remove_brigido.js, NO process_file.js, NO temp_extract.txt
2. **NEVER create scripts to "help" with the task** - Edit the ACTUAL target file directly
3. **NEVER modify wrong files** - If asked to edit "platform-healing.tsx", edit EXACTLY that file, not "platform-healingtemp.tsx"
4. **ALWAYS use exact filenames** - Use the exact path user provides, no variations or abbreviations
5. **NEVER write long explanations upfront** - START WORKING, then give brief updates AS you work

🎯 HOW TO EDIT FILES (CRITICAL - read this):
When user says: "Add badge to platform-healing.tsx header"
✅ CORRECT approach:
  1. read_platform_file("client/src/pages/platform-healing.tsx")
  2. write_platform_file("client/src/pages/platform-healing.tsx", <full file content with badge added>)

❌ WRONG approach (will be BLOCKED):
  1. write_platform_file("temp_extract.txt", ...) ← FORBIDDEN
  2. write_platform_file("helper_add_badge.js", ...) ← FORBIDDEN  
  3. write_platform_file("platform-healingtemp.tsx", ...) ← FORBIDDEN

If you try to create temp/helper files, you'll get this error:
"❌ FORBIDDEN: Cannot create temp/helper files. Edit the ACTUAL target file directly."

Your role:
- Help developers understand, fix, and improve the platform code
- Use tools to read files, make changes, and search the codebase
- Be conversational and helpful - explain what you're doing
- Work autonomously like Replit Agent - show task progress with animated task lists

Available tools:
- read_platform_file(file_path) - Read any file in the project
- write_platform_file(file_path, content) - Update files
- search_platform_files(pattern) - Find files by pattern
- create_task_list(title, tasks) - **REQUIRED** - creates visible task breakdown
- read_task_list() - Check current task status
- update_task(taskId, status, result) - **REQUIRED** - Update task progress (shows spinner animations!)
- cancel_lomu_job(job_id, reason) - Cancel stuck LomuAI jobs

Platform info:
- Stack: React, TypeScript, Express, PostgreSQL
- Repository: ${process.env.GITHUB_REPO || 'Not configured'}
- All changes auto-commit to GitHub

Workflow (like Replit Agent - FOLLOW THIS EXACTLY):
1. **FIRST:** create_task_list() - User sees task breakdown with circles ○
2. **FOR EACH TASK:**
   a. update_task(taskId, "in_progress") - Circle becomes spinner ⏳
   b. Do the actual work (read files, make changes, etc.)
   c. update_task(taskId, "completed", "what you did") - Spinner becomes checkmark ✓
3. Repeat for all tasks

Example (FOLLOW THIS PATTERN):
User: "fix the broken login page"
You:
Step 1: Create task list - it returns task IDs!
- create_task_list("Fix Login Page", [...]) 
  → Returns: { taskListId: "abc123", tasks: [{id: "task-uuid-1", title: "Read..."}, {id: "task-uuid-2", ...}] }

Step 2: Use the ACTUAL task IDs from the response:
- update_task("task-uuid-1", "in_progress")  // ← USER SEES SPINNER (use ID from create_task_list response!)
- read_platform_file("client/src/pages/Login.tsx")
- update_task("task-uuid-1", "completed", "Read login component - found validation issue")  // ← USER SEES CHECKMARK
- update_task("task-uuid-2", "in_progress")  // ← USER SEES SPINNER
- write_platform_file("client/src/pages/Login.tsx", ...)
- update_task("task-uuid-2", "completed", "Fixed email validation regex")  // ← USER SEES CHECKMARK

❌ WRONG: update_task("1", "in_progress") - Don't use numbers!
❌ WRONG: update_task("task-1", "in_progress") - Don't guess IDs!
✅ CORRECT: update_task("e4c7903-7851-4498-acf1", "in_progress") - Use UUIDs returned by create_task_list!

REMEMBER: Every task MUST go: pending ○ → in_progress ⏳ → completed ✓`;

      // Convert messages to API format - properly structure tool_use/tool_result blocks
      const conversationMessages: any[] = messages
        .filter((m: any) => {
          // Skip empty messages
          if (!m.content || (typeof m.content === 'string' && m.content.trim().length === 0)) {
            return false;
          }
          return true;
        })
        .map((m: any) => {
          const role = m.role === 'assistant' ? 'assistant' : 'user';
          
          // If content is a string, use it directly
          if (typeof m.content === 'string') {
            try {
              // Try to parse as JSON (tool_use/tool_result blocks)
              const parsed = JSON.parse(m.content);
              return { role, content: parsed };
            } catch {
              // Not JSON, use as text
              return { role, content: m.content };
            }
          }
          
          // Already an object/array, use directly
          return { role, content: m.content };
        });

      console.log(`🤖 [HEALING-CHAT] Starting Claude conversation with ${conversationMessages.length} messages...`);
      
      const computeStartTime = Date.now();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let filesModified: string[] = [];
      let fullResponse = '';
      
      // Multi-turn tool execution loop
      // 🎯 SHARED LOGIC: Use same intent classification and iteration limits as regular LomuAI
      const userIntent = classifyUserIntent(validated.content);
      const MAX_ITERATIONS = getMaxIterationsForIntent(userIntent);
      console.log(`[HEALING-CHAT] User intent: ${userIntent}, max iterations: ${MAX_ITERATIONS}`);
      
      let iterationCount = 0;
      let continueLoop = true;
      
      // RAILWAY FIX: Reduce logging in production
      const isDev = process.env.NODE_ENV === 'development';
      
      while (continueLoop && iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        console.log(`[HEALING-CHAT] 🔄 Iteration ${iterationCount}/${MAX_ITERATIONS}`);
        
        let response: any;
        try {
          // Call Claude with tools
          response = await streamAnthropicResponse({
            model: "claude-sonnet-4-20250514",
            maxTokens: 4000,
            system: systemPrompt,
            messages: conversationMessages,
            tools: [
              {
                name: 'read_platform_file',
                description: 'Read a file from the platform codebase',
                input_schema: {
                  type: 'object',
                  properties: {
                    file_path: { type: 'string', description: 'Path to file relative to project root' }
                  },
                  required: ['file_path']
                }
              },
              {
                name: 'write_platform_file',
                description: 'Write or update a platform file',
                input_schema: {
                  type: 'object',
                  properties: {
                    file_path: { type: 'string', description: 'Path to file' },
                    content: { type: 'string', description: 'New file content' }
                  },
                  required: ['file_path', 'content']
                }
              },
              {
                name: 'search_platform_files',
                description: 'Search for files matching a pattern',
                input_schema: {
                  type: 'object',
                  properties: {
                    pattern: { type: 'string', description: 'Search pattern (e.g., "*.ts", "server/**")' }
                  },
                  required: ['pattern']
                }
              },
              {
                name: 'cancel_lomu_job',
                description: 'Cancel a running or stuck LomuAI job. Use this when a job is stuck, no longer needed, or blocking new tasks. Returns the cancelled job details.',
                input_schema: {
                  type: 'object',
                  properties: {
                    job_id: { type: 'string', description: 'ID of the job to cancel' },
                    reason: { type: 'string', description: 'Reason for cancellation (optional)', default: 'Cancelled by I AM Architect' }
                  },
                  required: ['job_id']
                }
              },
              {
                name: 'create_task_list',
                description: 'Create a visible task breakdown showing what you will do. REQUIRED for all work requests.',
                input_schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Task list title summarizing the work' },
                    tasks: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          title: { type: 'string', description: 'Task title' },
                          description: { type: 'string', description: 'What this task does' }
                        },
                        required: ['title', 'description']
                      },
                      description: 'List of tasks to complete'
                    }
                  },
                  required: ['title', 'tasks']
                }
              },
              {
                name: 'read_task_list',
                description: 'Read current task list status to see what has been completed',
                input_schema: {
                  type: 'object',
                  properties: {},
                  required: []
                }
              },
              {
                name: 'update_task',
                description: 'Update task status to show progress (e.g., in_progress, completed)',
                input_schema: {
                  type: 'object',
                  properties: {
                    taskId: { type: 'string', description: 'Task ID from task list' },
                    status: { type: 'string', description: 'New status: pending, in_progress, or completed' },
                    result: { type: 'string', description: 'Brief result summary when completing a task' }
                  },
                  required: ['taskId', 'status']
                }
              }
            ],
            onToolUse: async (toolUse: any) => {
              // RAILWAY FIX: Reduce logging in production (only log essential actions)
              if (isDev) {
                console.log(`[HEALING-CHAT] 🔧 Executing tool: ${toolUse.name}`);
              }
              
              try {
                if (toolUse.name === 'read_platform_file') {
                  const filePath = path.join(process.cwd(), toolUse.input.file_path);
                  const content = await fs.readFile(filePath, 'utf-8');
                  if (isDev) {
                    console.log(`[HEALING-CHAT] ✅ Read file: ${toolUse.input.file_path} (${content.length} chars)`);
                  }
                  return { success: true, content };
                  
                } else if (toolUse.name === 'write_platform_file') {
                  await platformHealing.writePlatformFile(
                    toolUse.input.file_path,
                    toolUse.input.content,
                    false // AUTO-COMMIT enabled - changes committed immediately
                  );
                  filesModified.push(toolUse.input.file_path);
                  // Always log writes (important for audit trail)
                  console.log(`[HEALING-CHAT] ✅ Wrote file: ${toolUse.input.file_path}`);
                  return { success: true, message: `File updated: ${toolUse.input.file_path}` };
                  
                } else if (toolUse.name === 'search_platform_files') {
                  const { glob } = await import('glob');
                  const allMatches = await glob(toolUse.input.pattern, { cwd: process.cwd() });
                  
                  // RAILWAY FIX: Limit results to prevent log spam (max 100 files)
                  const MAX_RESULTS = 100;
                  const matches = allMatches.slice(0, MAX_RESULTS);
                  const truncated = allMatches.length > MAX_RESULTS;
                  
                  console.log(`[HEALING-CHAT] ✅ Search found ${matches.length}${truncated ? `/${allMatches.length}` : ''} files for pattern: ${toolUse.input.pattern}`);
                  
                  return { 
                    success: true, 
                    files: matches,
                    truncated,
                    totalCount: allMatches.length
                  };
                  
                } else if (toolUse.name === 'cancel_lomu_job') {
                  const { cancelJob } = await import('../services/lomuJobManager');
                  const jobId = toolUse.input.job_id;
                  const reason = toolUse.input.reason || 'Cancelled by I AM Architect';
                  
                  console.log(`[HEALING-CHAT] 🛑 Cancelling LomuAI job: ${jobId}`);
                  
                  const cancelledJob = await cancelJob(jobId, reason);
                  
                  console.log(`[HEALING-CHAT] ✅ Job cancelled: ${jobId}`);
                  
                  return {
                    success: true,
                    job: {
                      id: cancelledJob.id,
                      status: cancelledJob.status,
                      error: cancelledJob.error,
                    },
                    message: `Job ${jobId} cancelled successfully`
                  };
                  
                } else if (toolUse.name === 'create_task_list') {
                  const result = await createTaskList({
                    userId,
                    title: toolUse.input.title,
                    tasks: toolUse.input.tasks.map((t: any) => ({
                      title: t.title,
                      description: t.description,
                      status: 'pending' as const
                    }))
                  });
                  
                  if (result.success) {
                    console.log(`[HEALING-CHAT] ✅ Created task list: ${result.taskListId} with ${toolUse.input.tasks.length} tasks`);
                    console.log(`[HEALING-CHAT] 🔑 Task IDs:`, result.tasks?.map(t => t.id).join(', '));
                    return {
                      success: true,
                      taskListId: result.taskListId,
                      tasks: result.tasks, // ← CRITICAL FIX: Return actual task IDs so Claude can update them!
                      message: `✓ Task list created! Use these task IDs for update_task(): ${result.tasks?.map(t => `"${t.id}"`).join(', ')}`
                    };
                  } else {
                    console.error(`[HEALING-CHAT] ❌ Failed to create task list:`, result.error);
                    return { success: false, error: result.error };
                  }
                  
                } else if (toolUse.name === 'read_task_list') {
                  const result = await readTaskList({ userId });
                  
                  if (result.success && result.taskLists) {
                    const activeList = result.taskLists.find((list: any) => list.status === 'active');
                    if (activeList) {
                      const tasks = activeList.tasks || [];
                      return {
                        success: true,
                        taskList: {
                          id: activeList.id,
                          title: activeList.title,
                          status: activeList.status
                        },
                        tasks: tasks.map((t: any) => ({
                          id: t.id,
                          title: t.title,
                          description: t.description,
                          status: t.status,
                          result: t.result
                        }))
                      };
                    } else {
                      return { success: true, taskList: null, message: 'No active task list' };
                    }
                  } else {
                    return { success: false, error: result.error || 'Failed to read task list' };
                  }
                  
                } else if (toolUse.name === 'update_task') {
                  const result = await updateTask({
                    userId,
                    taskId: toolUse.input.taskId,
                    status: toolUse.input.status,
                    result: toolUse.input.result,
                    startedAt: toolUse.input.status === 'in_progress' ? new Date() : undefined,
                    completedAt: toolUse.input.status === 'completed' ? new Date() : undefined,
                  });
                  
                  if (result.success) {
                    console.log(`[HEALING-CHAT] ✅ Updated task: ${toolUse.input.taskId} → ${toolUse.input.status}`);
                    return { success: true, message: `Task updated to ${toolUse.input.status}` };
                  } else {
                    console.error(`[HEALING-CHAT] ❌ Failed to update task:`, result.error);
                    return { success: false, error: result.error };
                  }
                }
                
                console.error(`[HEALING-CHAT] ❌ Unknown tool: ${toolUse.name}`);
                return { error: 'Unknown tool' };
              } catch (error: any) {
                console.error(`[HEALING-CHAT] ❌ Tool execution error (${toolUse.name}):`, error.message);
                return { 
                  error: error.message,
                  errorType: error.code || 'TOOL_EXECUTION_ERROR',
                };
              }
            }
          });
        } catch (claudeError: any) {
          console.error(`[HEALING-CHAT] ❌ Claude API error on iteration ${iterationCount}:`, claudeError);
          
          // On Claude API error, break the loop and return what we have
          if (fullResponse.trim().length > 0) {
            // We have a partial response from previous iterations
            console.log(`[HEALING-CHAT] 🔄 Using partial response from ${iterationCount - 1} successful iterations`);
            break;
          } else {
            // First iteration failed, throw error
            throw new Error(`Claude API error: ${claudeError.message || 'Unknown error'}`);
          }
        }
        
        // FIX #2: Track tokens (silently in production)
        if (response.usage) {
          const iterInputTokens = response.usage.inputTokens || 0;
          const iterOutputTokens = response.usage.outputTokens || 0;
          totalInputTokens += iterInputTokens;
          totalOutputTokens += iterOutputTokens;
          if (isDev) {
            console.log(`[HEALING-CHAT] 📊 Iteration ${iterationCount} tokens: input=${iterInputTokens}, output=${iterOutputTokens}`);
          }
        } else if (isDev) {
          console.warn(`[HEALING-CHAT] ⚠️ No usage data in iteration ${iterationCount} response`);
        }
        
        // Append AI response to conversation
        fullResponse += response.fullText;
        
        // FIX #1: Check if Claude wants to continue (has tool results to process)
        if (response.needsContinuation && response.toolResults) {
          if (isDev) {
            console.log(`[HEALING-CHAT] 🔨 Claude used ${response.toolResults.length} tools, saving to DB and continuing...`);
          }
          
          // PERSISTENCE FIX: Save intermediate assistant message (tool calls) to database
          try {
            const toolCallsContent = JSON.stringify(response.assistantContent);
            await storage.createHealingMessage({
              conversationId: validated.conversationId,
              role: 'assistant',
              content: toolCallsContent,
              metadata: {
                type: 'tool_calls',
                iteration: iterationCount,
                toolCount: response.assistantContent?.length || 0,
              },
            });
            if (isDev) {
              console.log(`[HEALING-CHAT] 💾 Saved assistant tool calls (iteration ${iterationCount})`);
            }
          } catch (dbError: any) {
            console.error(`[HEALING-CHAT] ⚠️ Failed to save assistant tool calls:`, dbError.message);
          }
          
          // PERSISTENCE FIX: Save tool results to database
          try {
            const toolResultsContent = JSON.stringify(response.toolResults);
            await storage.createHealingMessage({
              conversationId: validated.conversationId,
              role: 'user',
              content: toolResultsContent,
              metadata: {
                type: 'tool_results',
                iteration: iterationCount,
                resultCount: response.toolResults?.length || 0,
              },
            });
            console.log(`[HEALING-CHAT] 💾 Saved tool results (iteration ${iterationCount})`);
          } catch (dbError: any) {
            console.error(`[HEALING-CHAT] ⚠️ Failed to save tool results:`, dbError.message);
          }
          
          // CRITICAL: Proper tool_use/tool_result pairing for Claude
          // This happens AFTER tool execution to ensure proper message structure
          // Assistant message contains tool_use blocks
          conversationMessages.push({
            role: 'assistant',
            content: response.assistantContent
          });
          
          // User message contains tool_result blocks (paired with tool_use above)
          conversationMessages.push({
            role: 'user',
            content: response.toolResults
          });
          
          continueLoop = true;
        } else {
          // Claude is done
          continueLoop = false;
          console.log(`[HEALING-CHAT] ✅ Claude completed in ${iterationCount} iterations`);
        }
      }

      // 🔧 SMART RECOVERY: If Claude executed tools but didn't provide final text, retry once
      if (fullResponse.trim().length === 0 && iterationCount > 1 && continueLoop === false) {
        console.log(`[HEALING-CHAT-RECOVERY] 🔄 Claude executed ${iterationCount - 1} tool iterations but provided no final text`);
        console.log(`[HEALING-CHAT-RECOVERY] 📝 Tools used: ${filesModified.length > 0 ? filesModified.join(', ') : 'none modified'}`);
        console.log(`[HEALING-CHAT-RECOVERY] 🔨 Making recovery call to force completion...`);
        
        try {
          // Add a forcing prompt to get a final answer
          conversationMessages.push({
            role: 'user',
            content: 'Based on the tool results above, please provide your final answer to the user\'s question. Summarize what you found and provide clear guidance.'
          });
          
          // Make ONE recovery call (no tools, just get the answer)
          const recoveryResponse = await streamAnthropicResponse({
            model: "claude-sonnet-4-20250514",
            maxTokens: 2000, // Shorter response for summary
            system: systemPrompt,
            messages: conversationMessages,
            // NO TOOLS - we just want the final answer
            tools: undefined,
          });
          
          if (recoveryResponse.fullText && recoveryResponse.fullText.trim().length > 0) {
            fullResponse = recoveryResponse.fullText;
            console.log(`[HEALING-CHAT-RECOVERY] ✅ Recovery successful: ${fullResponse.length} chars`);
            
            // Add recovery tokens to total
            if (recoveryResponse.usage) {
              totalInputTokens += recoveryResponse.usage.inputTokens || 0;
              totalOutputTokens += recoveryResponse.usage.outputTokens || 0;
              console.log(`[HEALING-CHAT-RECOVERY] 📊 Recovery tokens: input=${recoveryResponse.usage.inputTokens}, output=${recoveryResponse.usage.outputTokens}`);
            }
          } else {
            console.error(`[HEALING-CHAT-RECOVERY] ❌ Recovery call returned empty response`);
          }
        } catch (recoveryError: any) {
          console.error(`[HEALING-CHAT-RECOVERY] ❌ Recovery failed:`, recoveryError.message);
          // Continue to fallback error message
        }
      }

      const computeTimeMs = Date.now() - computeStartTime;

      console.log(`✅ [HEALING-CHAT] Total: ${computeTimeMs}ms, ${fullResponse.length} chars, ${totalInputTokens} input tokens, ${totalOutputTokens} output tokens`);

      // Improved fallback error message with context
      let finalContent = fullResponse;
      if (!finalContent || finalContent.trim().length === 0) {
        if (iterationCount > 1) {
          // Tools were used but no final answer
          finalContent = `I gathered information using ${iterationCount - 1} tool call(s)${filesModified.length > 0 ? ` and modified ${filesModified.length} file(s)` : ''}, but encountered an issue formatting my response. Please try rephrasing your question or ask me to elaborate on what I found.`;
          console.warn(`[HEALING-CHAT] ⚠️ Using enhanced fallback message after ${iterationCount} iterations`);
        } else {
          // No tools used, just empty response
          finalContent = "I apologize, but I couldn't generate a response. Please try again or rephrase your question.";
          console.warn(`[HEALING-CHAT] ⚠️ Using basic fallback message (no tools executed)`);
        }
      }

      // Save assistant's final response to database
      const assistantMessage = await storage.createHealingMessage({
        conversationId: validated.conversationId,
        role: 'assistant',
        content: finalContent,
        metadata: {
          model: "claude-sonnet-4-20250514",
          tokensUsed: totalInputTokens + totalOutputTokens,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          computeTimeMs,
          iterations: iterationCount,
          filesModified,
          type: 'final_response',
          usedRecovery: fullResponse !== finalContent, // Track if we used recovery/fallback
        },
      });

      console.log("[HEALING-CHAT] 💾 Final assistant message saved to database");

      // Track AI usage for billing
      try {
        await trackAIUsage({
          userId,
          projectId: null,
          type: "ai_chat",
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          computeTimeMs,
          metadata: {
            conversationId: validated.conversationId,
            filesModified,
            healingChat: true,
            model: "claude-sonnet-4-20250514",
            iterations: iterationCount,
          },
        });
        console.log("[HEALING-CHAT] 📈 Usage tracked successfully");
      } catch (trackError: any) {
        console.error("[HEALING-CHAT] ⚠️ Failed to track usage:", trackError.message);
        // Don't fail the request if usage tracking fails
      }

      // Return both user and assistant messages
      res.json({
        userMessage,
        assistantMessage,
        filesModified,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          computeTimeMs,
        },
      });

    } catch (error: any) {
      console.error("[HEALING-CHAT] ❌ Fatal error:", error);
      
      // FIX #3: Comprehensive error handling
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid message data", 
          details: error.errors 
        });
      }
      
      // Handle specific error types
      if (error.message?.includes('API key')) {
        return res.status(500).json({ 
          error: "Claude API configuration error. Please check API key.",
          type: 'CONFIG_ERROR',
        });
      }
      
      if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        return res.status(429).json({ 
          error: "Rate limit exceeded. Please try again later.",
          type: 'RATE_LIMIT_ERROR',
        });
      }
      
      if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return res.status(503).json({ 
          error: "Network error connecting to Claude API. Please try again.",
          type: 'NETWORK_ERROR',
        });
      }
      
      // Generic error with safe message
      res.status(500).json({ 
        error: error.message || "An unexpected error occurred. Please try again.",
        type: 'UNKNOWN_ERROR',
      });
    }
  });

  // PATCH /api/healing/conversations/:id - Auto-save conversation
  app.patch("/api/healing/conversations/:id", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const conversation = await storage.updateHealingConversation(id, updates);
      res.json(conversation);
    } catch (error: any) {
      console.error("[HEALING] Error updating conversation:", error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // DELETE /api/healing/messages/:conversationId - Clear conversation messages
  app.delete("/api/healing/messages/:conversationId", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      // Clear messages for UI (they remain in DB for audit trail)
      await storage.clearHealingMessages(conversationId);
      
      res.json({ success: true, message: "Messages cleared successfully" });
    } catch (error: any) {
      console.error("[HEALING] Error clearing messages:", error);
      res.status(500).json({ error: "Failed to clear messages" });
    }
  });
}
