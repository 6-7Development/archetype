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

        // Build system prompt using shared function
        const systemPrompt = buildSystemPrompt(mode, existingFiles, chatHistory, secrets);

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
        
        // Check if response was truncated
        if (completion.stop_reason === 'max_tokens') {
          console.warn('⚠️ Response truncated due to max_tokens limit');
          await storage.updateCommand(savedCommand.id, userId, "failed", JSON.stringify({
            error: "Request too large - response exceeded token limit. Please break your request into smaller, focused tasks (e.g., 'create the UI' then 'add the backend').",
            truncated: true
          }));
          
          return res.status(400).json({
            error: "That's a lot to build at once! 🧠 Let's break it down:\n\n• Try smaller, focused requests (e.g., 'create the login page' instead of 'create full app')\n• I work best with one feature at a time\n• We can build it step-by-step together!\n\nWhat specific part should we start with?",
            commandId: savedCommand.id,
            suggestion: "Break your request into smaller tasks"
          });
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

      const completion = await aiQueue.enqueue(userId, plan, async () => {
        const result = await anthropic.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            ...chatHistory.map((m: any) => ({
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

      const { detectComplexity } = await import("./complexity-detection");
      
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
