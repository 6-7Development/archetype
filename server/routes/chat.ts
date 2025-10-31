import type { Express } from "express";
import { WebSocket } from "ws";
import { storage } from "../storage";
import { insertCommandSchema } from "@shared/schema";
import { anthropic, DEFAULT_MODEL, streamAnthropicResponse } from "../anthropic";
import { SYSOP_TOOLS } from "../tools";
import { checkUsageLimits, trackAIUsage, decrementAICredits, getUserUsageStats, updateStorageUsage } from "../usage-tracking";
import { isAuthenticated } from "../universalAuth";
import { aiLimiter } from "../rateLimiting";
import { aiQueue } from '../priority-queue';
import { buildSystemPrompt, FEATURES, activeGenerations } from "./common";
import { getOrCreateState, autoUpdateFromMessage, formatStateForPrompt } from '../services/conversationState';

//Helper function to summarize messages
async function summarizeMessages(messages: any[]): Promise<string> {
  const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
  
  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Summarize this conversation concisely (2-3 sentences max):\n\n${conversation}`
    }]
  });
  
  const summary = response.content[0].type === 'text' ? response.content[0].text : '';
  return `Previous conversation summary: ${summary}`;
}

// Helper function to parse task plans from Claude's response
function parseTaskPlan(text: string): { tasks: any[] } | null {
  try {
    // STRATEGY 1: Look for ```json code blocks (most reliable)
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
    const jsonBlocks = Array.from(text.matchAll(jsonBlockRegex));
    
    for (const match of jsonBlocks) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.type === 'task_plan' && Array.isArray(parsed.tasks)) {
          console.log(`✅ [TASK-PARSER] Found task plan with ${parsed.tasks.length} tasks (from code block)`);
          return { tasks: parsed.tasks };
        }
      } catch (e) {
        // Try next block
      }
    }
    
    // STRATEGY 2: Balanced brace matching for {"type":"task_plan"...}
    let depth = 0;
    let startIdx = -1;
    let inString = false;
    let escape = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Handle string escaping
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      
      // Track string boundaries
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      // Only count braces outside strings
      if (!inString) {
        if (char === '{') {
          if (depth === 0) {
            startIdx = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && startIdx !== -1) {
            // Found complete JSON object
            const jsonStr = text.substring(startIdx, i + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'task_plan' && Array.isArray(parsed.tasks)) {
                console.log(`✅ [TASK-PARSER] Found task plan with ${parsed.tasks.length} tasks (balanced brace matching)`);
                return { tasks: parsed.tasks };
              }
            } catch (e) {
              // Not valid JSON, continue searching
            }
            startIdx = -1;
          }
        }
      }
    }
    
    // No valid task plan found
    return null;
  } catch (error) {
    console.error('❌ [TASK-PARSER] Error parsing task plan:', error);
    return null;
  }
}

// Helper function to broadcast task events via WebSocket
function broadcastTaskEvent(wss: any, userId: string, eventType: 'task_plan' | 'task_update', data: any) {
  try {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN && (client as any).userId === userId) {
        client.send(JSON.stringify({
          type: eventType,
          ...data,
        }));
      }
    });
    console.log(`✅ [WEBSOCKET] Broadcasted ${eventType} to user ${userId}`);
  } catch (error) {
    console.error(`❌ [WEBSOCKET] Error broadcasting ${eventType}:`, error);
  }
}

export function registerChatRoutes(app: Express, dependencies: { wss: any }) {
  const { wss } = dependencies;

  // Get commands for user
  app.get("/api/commands", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const projectId = req.query.projectId as string | undefined;
      console.log(`[GET /api/commands] Fetching for userId: ${userId}, projectId: ${projectId || 'null'}`);
      const commands = await storage.getCommands(userId, projectId || null);
      console.log(`[GET /api/commands] Found ${commands.length} commands`);
      res.json(commands);
    } catch (error) {
      console.error('Error fetching commands:', error);
      res.status(500).json({ error: "Failed to fetch commands" });
    }
  });

  // Get tasks - supports filtering by commandId or projectId
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const commandId = req.query.commandId as string | undefined;
      const projectId = req.query.projectId as string | undefined;
      
      if (commandId) {
        // Get tasks for a specific command
        console.log(`[GET /api/tasks] Fetching tasks for commandId: ${commandId}`);
        const tasks = await storage.getTasks(commandId);
        console.log(`[GET /api/tasks] Found ${tasks.length} tasks for command`);
        res.json(tasks);
      } else if (projectId) {
        // Get tasks for a specific project
        console.log(`[GET /api/tasks] Fetching tasks for projectId: ${projectId}, userId: ${userId}`);
        const tasks = await storage.getTasksByProject(projectId, userId);
        console.log(`[GET /api/tasks] Found ${tasks.length} tasks for project`);
        res.json(tasks);
      } else {
        res.status(400).json({ error: "Either commandId or projectId is required" });
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Update task status
  app.patch("/api/tasks/:taskId", isAuthenticated, async (req: any, res) => {
    try {
      const { taskId } = req.params;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "status is required and must be a string" });
      }
      
      console.log(`[PATCH /api/tasks/${taskId}] Updating status to: ${status}`);
      const updatedTask = await storage.updateTaskStatus(taskId, status);
      
      // Broadcast task_update event via WebSocket
      const userId = req.authenticatedUserId;
      broadcastTaskEvent(wss, userId, 'task_update', {
        task: {
          id: updatedTask.id,
          title: updatedTask.title,
          status: updatedTask.status,
          priority: updatedTask.priority,
          subAgentId: updatedTask.subAgentId,
        },
      });
      
      res.json(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Command execution endpoint (AI generation - rate limited)
  app.post("/api/commands", aiLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      console.log(`[POST /api/commands] Creating command for userId: ${userId}`);
      const { command, projectId, secrets } = req.body;
      
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: "command is required and must be a string" });
      }

      // Check if AI generation is available (graceful degradation)
      if (!FEATURES.AI_GENERATION) {
        return res.status(503).json({ 
          error: "AI generation temporarily unavailable. Anthropic API key not configured.",
          feature: 'AI_GENERATION',
          available: false
        });
      }

      // Check usage limits before proceeding
      const limitCheck = await checkUsageLimits(userId);
      if (!limitCheck.allowed) {
        return res.status(403).json({ 
          error: limitCheck.reason,
          usageLimitReached: true,
          requiresUpgrade: limitCheck.requiresUpgrade || false,
          requiresPayment: limitCheck.requiresPayment || false,
          trialExpired: limitCheck.trialExpired || false,
          creditsRemaining: limitCheck.creditsRemaining || 0,
          tokensUsed: limitCheck.tokensUsed || 0,
          tokenLimit: limitCheck.tokenLimit || 0,
        });
      }

      // Validate and save command with processing status
      const validated = insertCommandSchema.parse({
        projectId: projectId || null,
        command,
        status: "processing",
        response: null,
      });
      const savedCommand = await storage.createCommand({ ...validated, userId });

      try {
        // Determine mode: CREATE (new project) or MODIFY (existing project)
        const mode = projectId ? 'MODIFY' : 'CREATE';
        let existingFiles: any[] = [];
        
        // If MODIFY mode, fetch existing project files for context
        if (mode === 'MODIFY') {
          existingFiles = await storage.getProjectFiles(projectId, userId);
        }

        // Load chat history for conversation memory
        let chatHistory: any[] = [];
        if (projectId) {
          try {
            chatHistory = await storage.getChatMessagesByProject(userId, projectId);
            
            // Apply summarization logic
            if (chatHistory.length > 10) {
              const KEEP_RECENT = 5;
              const hasSummary = chatHistory.some(m => m.isSummary);
              
              if (!hasSummary) {
                const oldMessages = chatHistory.slice(0, chatHistory.length - KEEP_RECENT);
                const recentMessages = chatHistory.slice(chatHistory.length - KEEP_RECENT);
                const messagesForSummary = oldMessages.filter(m => m.role === 'user' || m.role === 'assistant');
                
                if (messagesForSummary.length > 0) {
                  console.log(`📊 Summarizing ${messagesForSummary.length} messages for command context`);
                  const summaryContent = await summarizeMessages(messagesForSummary);
                  
                  const summaryMessage = await storage.createChatMessage({
                    userId,
                    projectId,
                    role: 'system',
                    content: summaryContent,
                    isSummary: true,
                  });
                  
                  for (const oldMsg of oldMessages) {
                    await storage.deleteChatMessage(oldMsg.id, userId);
                  }
                  
                  chatHistory = [summaryMessage, ...recentMessages];
                  console.log(`✅ Chat optimized for command: ${messagesForSummary.length} → 1 summary + ${KEEP_RECENT} recent`);
                }
              }
            }
          } catch (error) {
            console.error('Error loading chat history for command:', error);
            // Continue without history - don't fail the command
          }
        }

        // 🎯 CONVERSATION STATE: Get or create state for context tracking
        const conversationState = await getOrCreateState(userId, projectId || null);
        
        // Auto-update state from user command (extract goals and files)
        await autoUpdateFromMessage(conversationState.id, command);
        console.log('[CONVERSATION-STATE] Updated from user command:', conversationState.id);

        // Get fresh conversation state and format for prompt injection
        const freshState = await storage.getConversationState(userId, projectId || null);
        const contextPrompt = formatStateForPrompt(freshState);

        // Build system prompt using shared function with conversation context
        const baseSystemPrompt = buildSystemPrompt(mode, existingFiles, chatHistory, secrets);
        const systemPrompt = `${baseSystemPrompt}\n\n${contextPrompt}`;

        // SySop interprets the command and generates project structure using Claude
        const computeStartTime = Date.now();
        
        // Get user's subscription plan
        const subscription = await storage.getSubscription(userId);
        const plan = subscription?.plan || 'free';

        // Wrap AI call in priority queue
        const completion = await aiQueue.enqueue(userId, plan, async () => {
          const result = await anthropic.messages.create({
            model: DEFAULT_MODEL,
            max_tokens: 8192,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: command,
              },
            ],
          });
          return result;
        });
        
        const computeTimeMs = Date.now() - computeStartTime;

        const responseText = completion.content[0].type === 'text' ? completion.content[0].text : "{}";
        
        console.log("=== Claude Response (first 200 chars) ===");
        console.log(responseText.substring(0, 200));
        console.log(`=== Response length: ${responseText.length} chars ===`);
        console.log(`=== Stop reason: ${completion.stop_reason} ===`);
        
        // Log if response was truncated (but don't block - just proceed)
        if (completion.stop_reason === 'max_tokens') {
          console.warn('⚠️ Response truncated due to max_tokens limit - continuing anyway (autonomous mode)');
          // Note: We proceed with partial response instead of blocking
        }
        
        // 📋 TASK MANAGEMENT: Parse and store tasks from Claude's response
        // This implements Replit Agent-style task tracking
        try {
          console.log('🔍 [TASK-PARSER] Attempting to parse task plan from Claude response...');
          console.log('📄 [TASK-PARSER] Response preview (first 800 chars):', responseText.substring(0, 800));
          console.log('📄 [TASK-PARSER] Searching for task_plan or tasks array...');
          
          const taskPlan = parseTaskPlan(responseText);
          
          if (taskPlan && taskPlan.tasks && taskPlan.tasks.length > 0) {
            console.log(`✅ [TASK-PARSER] SUCCESS! Found ${taskPlan.tasks.length} tasks in response`);
            console.log('📋 [TASK-PARSER] Task details:', JSON.stringify(taskPlan.tasks, null, 2));
            
            // Store each task in database with commandId linkage
            const storedTasks = [];
            for (const task of taskPlan.tasks) {
              try {
                const storedTask = await storage.createTask({
                  userId,
                  projectId: projectId || null,
                  commandId: savedCommand.id,
                  title: task.title || 'Untitled Task',
                  status: task.status || 'pending',
                  priority: task.priority || 1,
                  subAgentId: task.subAgentId || null,
                });
                storedTasks.push(storedTask);
                console.log(`✅ [TASK-PARSER] Stored task: ${storedTask.id} - ${storedTask.title}`);
              } catch (taskError) {
                console.error(`❌ [TASK-PARSER] Failed to store task:`, taskError);
                // Continue with other tasks if one fails
              }
            }
            
            // Broadcast task_plan event via WebSocket to client
            if (storedTasks.length > 0) {
              broadcastTaskEvent(wss, userId, 'task_plan', {
                commandId: savedCommand.id,
                projectId: projectId || null,
                tasks: storedTasks.map(t => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                  priority: t.priority,
                  subAgentId: t.subAgentId,
                })),
              });
              console.log(`📡 [TASK-PARSER] Broadcasted task_plan with ${storedTasks.length} tasks`);
            }
          } else {
            console.log('ℹ️ [TASK-PARSER] No task plan found in response (this is normal - not all commands need tasks)');
          }
        } catch (taskParsingError) {
          console.error('❌ [TASK-PARSER] Error in task parsing/storage:', taskParsingError);
          // Graceful degradation: continue with normal processing even if task parsing fails
        }
        
        // Strip markdown code fences if present
        let cleanedText = responseText.trim();
        const originalText = cleanedText;
        
        // Extract from code fences
        const codeFenceMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeFenceMatch) {
          cleanedText = codeFenceMatch[1].trim();
          console.log("✅ Extracted JSON from code fence");
        } else {
          // Extract JSON object with string-aware parsing
          const allMatches: string[] = [];
          let depth = 0;
          let startIdx = -1;
          let inString = false;
          let escapeNext = false;
          
          for (let i = 0; i < cleanedText.length; i++) {
            const char = cleanedText[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"') {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                if (depth === 0) startIdx = i;
                depth++;
              } else if (char === '}') {
                depth--;
                if (depth === 0 && startIdx !== -1) {
                  allMatches.push(cleanedText.substring(startIdx, i + 1));
                  startIdx = -1;
                }
                if (depth < 0) {
                  depth = 0;
                  startIdx = -1;
                }
              }
            }
          }
          
          if (allMatches.length > 0) {
            cleanedText = allMatches.reduce((longest, current) => 
              current.length > longest.length ? current : longest
            );
            console.log(`✅ Extracted largest JSON object (${cleanedText.length} chars from ${allMatches.length} candidates)`);
          }
        }
        
        console.log("=== Cleaned Text (first 200 chars) ===");
        console.log(cleanedText.substring(0, 200));
        
        let result;
        try {
          result = JSON.parse(cleanedText);
        } catch (parseError: any) {
          console.error("JSON Parse Error:", parseError.message);
          console.log("Failed text (first 500 chars):", cleanedText.substring(0, 500));
          
          // Final fallback
          const jsonMatch = originalText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              result = JSON.parse(jsonMatch[0]);
              console.log("✅ Successfully extracted JSON using fallback regex on original text");
            } catch (regexError) {
              throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
            }
          } else {
            throw new Error(`AI response is not valid JSON: ${parseError.message}`);
          }
        }

        // Check if SySop is requesting user to provide secrets
        if (result.needsSecrets === true) {
          const inputTokens = completion.usage?.input_tokens || 0;
          const outputTokens = completion.usage?.output_tokens || 0;
          
          await trackAIUsage({
            userId,
            projectId: null,
            type: "ai_generation",
            inputTokens,
            outputTokens,
            computeTimeMs,
            metadata: { command, needsSecrets: true },
          });

          await storage.updateCommand(
            savedCommand.id, 
            userId, 
            "needs_secrets", 
            JSON.stringify(result)
          );

          return res.json({
            commandId: savedCommand.id,
            needsSecrets: true,
            message: result.message || "This project requires secure credentials",
            requiredSecrets: result.requiredSecrets || [],
            usage: {
              tokensUsed: inputTokens + outputTokens,
            },
          });
        }

        // Extract checkpoint data
        const checkpointData = result.checkpoint || {
          complexity: "standard",
          cost: 0.40,
          estimatedTime: "10 minutes",
          actions: ["Generated project files", "Completed request"]
        };

        // Normal project generation flow
        let project;
        
        if (mode === 'CREATE') {
          project = await storage.createProject({
            userId,
            name: result.projectName || "Untitled Project",
            description: result.description || "",
          });
        } else {
          const existingProjects = await storage.getProjects(userId);
          project = existingProjects.find(p => p.id === projectId);
          
          if (!project) {
            throw new Error(`Project ${projectId} not found`);
          }
        }

        // Handle files based on mode
        const createdFiles: string[] = [];
        const modifiedFiles: string[] = [];
        const deletedFiles: string[] = [];
        
        if (result.files && Array.isArray(result.files)) {
          console.log(`💾 Processing ${result.files.length} files for project ${project.id} (mode: ${mode})`);
          
          let createdCount = 0;
          let updatedCount = 0;
          let deletedCount = 0;
          
          for (const file of result.files) {
            // Check if this is a delete operation
            if (file.action === 'delete') {
              const existingFile = existingFiles.find(f => f.filename === file.filename);
              if (existingFile) {
                console.log(`🗑️  Deleting file: ${file.filename} from project ${project.id}`);
                await storage.deleteFile(existingFile.id, userId);
                deletedFiles.push(file.filename);
                deletedCount++;
                console.log(`✅ File deleted: ${file.filename}`);
              }
              continue;
            }
            
            if (mode === 'MODIFY') {
              const existingFile = existingFiles.find(f => f.filename === file.filename);
              
              if (existingFile) {
                console.log(`📝 Updating file: ${file.filename} (${file.content?.length || 0} chars) in project ${project.id}`);
                await storage.updateFile(existingFile.id, userId, file.content);
                modifiedFiles.push(file.filename);
                updatedCount++;
                console.log(`✅ File updated: ${file.filename} with ID ${existingFile.id}`);
              } else {
                console.log(`➕ Creating new file: ${file.filename} (${file.content?.length || 0} chars) in project ${project.id}`);
                const savedFile = await storage.createFile({
                  userId,
                  projectId: project.id,
                  filename: file.filename,
                  content: file.content,
                  language: file.language || "plaintext",
                });
                createdFiles.push(file.filename);
                createdCount++;
                console.log(`✅ File created: ${file.filename} with ID ${savedFile.id}`);
              }
            } else {
              console.log(`➕ Creating file: ${file.filename} (${file.content?.length || 0} chars) in project ${project.id}`);
              const savedFile = await storage.createFile({
                userId,
                projectId: project.id,
                filename: file.filename,
                content: file.content,
                language: file.language || "plaintext",
              });
              createdFiles.push(file.filename);
              createdCount++;
              console.log(`✅ File created: ${file.filename} with ID ${savedFile.id}`);
            }
          }
          
          console.log(`📊 File operation summary for project ${project.id}: ${createdCount} created, ${updatedCount} updated, ${deletedCount} deleted`);
          
          // Track storage usage for billing after creating all files
          await updateStorageUsage(userId);
          
          // Broadcast files update to all connected clients via WebSocket
          console.log(`📡 Broadcasting files_updated event for project ${project.id}`);
          wss.clients.forEach((client: WebSocket) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'files_updated',
                projectId: project.id,
                userId: userId,
                fileCount: result.files.length,
                created: createdCount,
                updated: updatedCount,
                deleted: deletedCount,
              }));
            }
          });
          console.log(`✅ WebSocket broadcast complete for project ${project.id}`);
          
          // Auto-create snapshot after successful code generation
          try {
            const snapshotLabel = mode === 'CREATE' 
              ? `Initial creation: ${result.projectName || 'Untitled'}` 
              : `Update: ${command.substring(0, 50)}...`;
            
            await storage.createProjectSnapshot(
              project.id,
              userId,
              snapshotLabel,
              `Automatic snapshot after ${mode === 'CREATE' ? 'creating' : 'modifying'} project`
            );
            console.log(`📸 Auto-created snapshot for project ${project.id}: "${snapshotLabel}"`);
          } catch (snapshotError) {
            console.error('⚠️ Failed to create automatic snapshot:', snapshotError);
          }
        }

        // Track AI usage
        const inputTokens = completion.usage?.input_tokens || 0;
        const outputTokens = completion.usage?.output_tokens || 0;
        
        await trackAIUsage({
          userId,
          projectId: project.id,
          type: "ai_generation",
          inputTokens,
          outputTokens,
          computeTimeMs,
          metadata: {
            command,
            mode,
            filesGenerated: result.files?.length || 0,
            checkpoint: checkpointData,
          },
        });

        // Update command as completed
        await storage.updateCommand(savedCommand.id, userId, "completed", JSON.stringify(result));

        res.json({
          commandId: savedCommand.id,
          result: {
            ...result,
            projectId: project.id,
            checkpoint: checkpointData,
            changes: {
              created: createdFiles,
              modified: modifiedFiles,
              deleted: deletedFiles,
            },
          },
          usage: {
            tokensUsed: inputTokens + outputTokens,
            inputTokens,
            outputTokens,
            computeTimeMs,
          },
          summary: checkpointData.actions?.join('\n') || 'Files generated successfully',
        });
      } catch (error: any) {
        console.error('Command execution error:', error);
        await storage.updateCommand(savedCommand.id, userId, "failed", JSON.stringify({
          error: error.message || "Command execution failed"
        }));
        
        res.status(500).json({ 
          error: error.message || "Failed to execute command",
          commandId: savedCommand.id
        });
      }
    } catch (error: any) {
      console.error('Error in /api/commands:', error);
      res.status(500).json({ error: error.message || 'Failed to process command' });
    }
  });

  // POST /api/chat - AI chat conversation endpoint (streaming)
  app.post("/api/chat", aiLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { message, projectId, sessionId } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "message is required and must be a string" });
      }

      // Check usage limits
      const limitCheck = await checkUsageLimits(userId);
      if (!limitCheck.allowed) {
        return res.status(403).json({ 
          error: limitCheck.reason,
          usageLimitReached: true,
        });
      }

      // Get chat history for context
      const chatHistory = projectId ? await storage.getChatHistory(userId, projectId) : [];

      // Build system prompt
      const systemPrompt = buildSystemPrompt('MODIFY', [], chatHistory, {});

      // Stream response
      const computeStartTime = Date.now();
      
      const subscription = await storage.getSubscription(userId);
      const plan = subscription?.plan || 'free';

      // Filter out messages with empty content (Claude API requirement)
      const validMessages = chatHistory.filter((m: any) => {
        const hasContent = m.content && typeof m.content === 'string' && m.content.trim().length > 0;
        if (!hasContent) {
          console.warn(`⚠️ [AI-CHAT] Filtering out message with empty content (ID: ${m.id})`);
        }
        return hasContent;
      });

      console.log(`🤖 [AI-CHAT] Calling Claude API with ${validMessages.length} valid messages (filtered ${chatHistory.length - validMessages.length} empty)...`);
      const completion = await aiQueue.enqueue(userId, plan, async () => {
        const result = await anthropic.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            ...validMessages.map((m: any) => ({
              role: m.role === 'system' ? 'user' : m.role,
              content: m.content
            })),
            {
              role: "user",
              content: message,
            },
          ],
        });
        return result;
      });

      const computeTimeMs = Date.now() - computeStartTime;
      const responseText = completion.content[0].type === 'text' ? completion.content[0].text : "";

      // Save chat messages
      await storage.createChatMessage({
        userId,
        projectId,
        role: 'user',
        content: message,
      });

      await storage.createChatMessage({
        userId,
        projectId,
        role: 'assistant',
        content: responseText,
      });

      // Track usage
      const inputTokens = completion.usage?.input_tokens || 0;
      const outputTokens = completion.usage?.output_tokens || 0;
      
      await trackAIUsage({
        userId,
        projectId,
        type: "ai_chat",
        inputTokens,
        outputTokens,
        computeTimeMs,
        metadata: { message },
      });

      res.json({
        response: responseText,
        usage: {
          inputTokens,
          outputTokens,
        },
      });
    } catch (error: any) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to process message' });
    }
  });

  // POST /api/ai-chat-conversation - AI chat conversation endpoint (non-streaming, no auto-save)
  app.post("/api/ai-chat-conversation", aiLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { message, projectId } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "message is required and must be a string" });
      }

      console.log(`💬 [AI-CHAT-CONVERSATION] User ${userId} sending message for project ${projectId || 'general'}`);

      // Check if AI generation is available (graceful degradation)
      if (!FEATURES.AI_GENERATION) {
        return res.status(503).json({ 
          error: "AI chat temporarily unavailable. Anthropic API key not configured.",
          feature: 'AI_GENERATION',
          available: false
        });
      }

      // Check usage limits
      const limitCheck = await checkUsageLimits(userId);
      if (!limitCheck.allowed) {
        return res.status(403).json({ 
          error: limitCheck.reason,
          usageLimitReached: true,
        });
      }

      // Get chat history for context (supports both project-scoped and general chat)
      const chatHistory = await storage.getChatHistory(userId, projectId || null);
      console.log(`📚 [AI-CHAT-CONVERSATION] Loaded ${chatHistory.length} messages from history for ${projectId ? `project ${projectId}` : 'general chat'}`);

      // Build system prompt with autonomous building instructions
      const systemPrompt = buildSystemPrompt('MODIFY', [], chatHistory, {}) + `

🤖 **AUTONOMOUS BUILDING MODE**

You're in conversational mode, but you have FULL AUTONOMOUS BUILDING POWERS!

When the user asks you to build, fix, add, or modify something:
1. **Just do it!** Don't ask for permission.
2. Return JSON with this structure:

\`\`\`json
{
  "response": "✅ I'll build that for you! [Brief explanation of what you're building]",
  "shouldGenerate": true,
  "command": "[Clear, specific build command that describes what to create/fix]"
}
\`\`\`

**Examples:**

User: "Create a todo app with authentication"
You return:
\`\`\`json
{
  "response": "✅ I'll build a todo app with authentication! Creating full-stack app with React frontend, Express backend, and PostgreSQL database.",
  "shouldGenerate": true,
  "command": "Create a complete todo app with user authentication (Replit Auth), full CRUD operations, and responsive UI with dark mode"
}
\`\`\`

User: "Fix the chat conversations disappearing when I switch screens"
You return:
\`\`\`json
{
  "response": "✅ I'll fix the chat persistence issue! Implementing proper state management and session storage.",
  "shouldGenerate": true,
  "command": "Fix chat conversation persistence - implement session storage, proper state management, and ensure conversations persist across screen switches"
}
\`\`\`

User: "How does authentication work in React?"
You return (NO code generation needed):
\`\`\`json
{
  "response": "[Detailed explanation of React authentication patterns...]"
}
\`\`\`

**Key Rules:**
- Build requests → Set \`shouldGenerate: true\`
- Questions/discussions → Just respond normally (no shouldGenerate)
- Be specific in the \`command\` field - it's what I'll use to build
- Always respond conversationally first, THEN trigger building
- You're like Replit Agent - autonomous and action-oriented!

Remember: **You're a BUILDER first, conversationalist second!**`;

      // Call Claude API
      const computeStartTime = Date.now();
      
      const subscription = await storage.getSubscription(userId);
      const plan = subscription?.plan || 'free';

      // Filter out messages with empty content (Claude API requirement)
      const validMessages = chatHistory.filter((m: any) => {
        const hasContent = m.content && typeof m.content === 'string' && m.content.trim().length > 0;
        if (!hasContent) {
          console.warn(`⚠️ [AI-CHAT-CONVERSATION] Filtering out message with empty content (ID: ${m.id})`);
        }
        return hasContent;
      });

      console.log(`🤖 [AI-CHAT-CONVERSATION] Calling Claude API with ${validMessages.length} valid messages (filtered ${chatHistory.length - validMessages.length} empty)...`);
      const completion = await aiQueue.enqueue(userId, plan, async () => {
        const result = await anthropic.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            ...validMessages.map((m: any) => ({
              role: m.role === 'system' ? 'user' : m.role,
              content: m.content
            })),
            {
              role: "user",
              content: message,
            },
          ],
        });
        return result;
      });

      const computeTimeMs = Date.now() - computeStartTime;
      const responseText = completion.content[0].type === 'text' ? completion.content[0].text : "";

      console.log(`✅ [AI-CHAT-CONVERSATION] Claude responded in ${computeTimeMs}ms (${responseText.length} chars)`);

      // Parse response - check if SySop wants to build something (ROBUST PARSING)
      let parsedResponse: any = { response: responseText };
      let jsonExtracted = false;
      
      // Try multiple extraction strategies for maximum reliability
      try {
        // Strategy 1: Try parsing entire response as JSON (fastest if it's pure JSON)
        try {
          const candidate = JSON.parse(responseText);
          if (candidate && typeof candidate === 'object') {
            parsedResponse = candidate;
            jsonExtracted = true;
            console.log(`✅ [AI-CHAT-CONVERSATION] Parsed full response as JSON`);
          }
        } catch (e) {
          // Not pure JSON, try other strategies
        }
        
        // Strategy 2: Extract from ```json``` code block
        if (!jsonExtracted) {
          const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
          if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[1].trim());
            jsonExtracted = true;
            console.log(`✅ [AI-CHAT-CONVERSATION] Extracted JSON from code block`);
          }
        }
        
        // Strategy 3: Find JSON object anywhere in response (handles text before/after)
        if (!jsonExtracted) {
          // String-aware brace matching (same robust logic as command parsing)
          let depth = 0;
          let startIdx = -1;
          let inString = false;
          let escapeNext = false;
          const allMatches: string[] = [];
          
          for (let i = 0; i < responseText.length; i++) {
            const char = responseText[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            if (char === '"') {
              inString = !inString;
              continue;
            }
            if (!inString) {
              if (char === '{') {
                if (depth === 0) startIdx = i;
                depth++;
              } else if (char === '}') {
                depth--;
                if (depth === 0 && startIdx !== -1) {
                  allMatches.push(responseText.substring(startIdx, i + 1));
                  startIdx = -1;
                }
              }
            }
          }
          
          // Try parsing each match, prefer the one with shouldGenerate=true
          for (const match of allMatches) {
            try {
              const candidate = JSON.parse(match);
              if (candidate && typeof candidate === 'object') {
                parsedResponse = candidate;
                jsonExtracted = true;
                console.log(`✅ [AI-CHAT-CONVERSATION] Extracted JSON object from mixed response`);
                // If this has shouldGenerate, use it and stop searching
                if (candidate.shouldGenerate) break;
              }
            } catch (e) {
              // Invalid JSON, try next match
            }
          }
        }
        
        // Validate the extracted JSON has expected structure
        if (jsonExtracted) {
          if (parsedResponse.shouldGenerate === true) {
            if (!parsedResponse.command || typeof parsedResponse.command !== 'string') {
              console.warn(`⚠️ [AI-CHAT-CONVERSATION] shouldGenerate=true but missing valid command`);
              // Treat as plain text if command is missing
              parsedResponse = { response: parsedResponse.response || responseText };
              jsonExtracted = false;
            } else {
              console.log(`🔨 [AI-CHAT-CONVERSATION] SySop wants to build: YES`);
              console.log(`📋 [AI-CHAT-CONVERSATION] Build command: ${parsedResponse.command}`);
            }
          } else {
            console.log(`📝 [AI-CHAT-CONVERSATION] SySop is chatting (no build trigger)`);
          }
        } else {
          console.log(`📝 [AI-CHAT-CONVERSATION] Plain text response (no JSON detected)`);
        }
        
      } catch (parseError: any) {
        // Final fallback - treat as plain text
        console.warn(`⚠️ [AI-CHAT-CONVERSATION] JSON parsing error: ${parseError.message}`);
        console.log(`📝 [AI-CHAT-CONVERSATION] Falling back to plain text response`);
        parsedResponse = { response: responseText };
      }

      // Track usage
      const inputTokens = completion.usage?.input_tokens || 0;
      const outputTokens = completion.usage?.output_tokens || 0;
      
      await trackAIUsage({
        userId,
        projectId: projectId || null,
        type: "ai_chat",
        inputTokens,
        outputTokens,
        computeTimeMs,
        metadata: { 
          message,
          shouldGenerate: parsedResponse.shouldGenerate || false,
          command: parsedResponse.command || null,
        },
      });

      console.log(`📊 [AI-CHAT-CONVERSATION] Usage tracked: ${inputTokens + outputTokens} tokens`);

      // Return response with optional build trigger (frontend handles message saving and build execution)
      res.json({
        response: parsedResponse.response || responseText,
        shouldGenerate: parsedResponse.shouldGenerate || false,
        command: parsedResponse.command || undefined,
        usage: {
          inputTokens,
          outputTokens,
        },
      });
    } catch (error: any) {
      console.error('❌ [AI-CHAT-CONVERSATION] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to process message' });
    }
  });

  // GET /api/usage/stats - Get current user's usage statistics
  app.get("/api/usage/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const stats = await getUserUsageStats(userId);
      
      res.json({
        plan: stats.plan,
        tokensUsed: stats.tokensUsed,
        tokenLimit: stats.tokenLimit,
        projectsThisMonth: stats.projectsThisMonth,
        totalCost: stats.totalCost,
        totalAICost: stats.totalAICost,
      });
    } catch (error: any) {
      console.error('Error fetching usage stats:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch usage stats' });
    }
  });

  // POST /api/analyze-complexity - Analyze command complexity and estimate token usage
  app.post("/api/analyze-complexity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { command } = req.body;
      
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: "command is required and must be a string" });
      }

      const { detectComplexity } = await import("../complexity-detection");
      
      const complexityResult = detectComplexity(command);
      
      const stats = await getUserUsageStats(userId);
      const tokensRemaining = Math.max(0, stats.tokenLimit - stats.tokensUsed);
      
      const overageTokens = Math.max(0, complexityResult.estimatedTokens - tokensRemaining);
      const overageCost = overageTokens > 0 ? (overageTokens / 1000) * 1.50 : 0;
      
      res.json({
        complexity: complexityResult.level,
        estimatedTokens: complexityResult.estimatedTokens,
        estimatedCost: complexityResult.estimatedCost,
        reasons: complexityResult.reasons,
        tokensRemaining,
        tokenLimit: stats.tokenLimit,
        overageTokens,
        overageCost: parseFloat(overageCost.toFixed(2)),
      });
    } catch (error: any) {
      console.error('Error analyzing complexity:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze complexity' });
    }
  });

  // POST /api/stop-generation - Stop active AI generation
  app.post("/api/stop-generation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      
      // Find and abort active generation for this user
      const abortController = activeGenerations.get(userId);
      if (abortController) {
        abortController.abort();
        activeGenerations.delete(userId);
        console.log(`⛔ Aborted active generation for user ${userId}`);
        res.json({ success: true, message: "Generation stopped" });
      } else {
        res.json({ success: false, message: "No active generation found" });
      }
    } catch (error: any) {
      console.error('Error stopping generation:', error);
      res.status(500).json({ error: error.message || 'Failed to stop generation' });
    }
  });
}
