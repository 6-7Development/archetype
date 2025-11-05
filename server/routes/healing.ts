import type { Express } from "express";
import { insertHealingTargetSchema, insertHealingConversationSchema, insertHealingMessageSchema } from "@shared/schema";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import { aiHealingService } from "../services/aiHealingService";

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

  // POST /api/healing/messages - Send message to Lomu (GEMINI-POWERED with multi-turn tool execution)
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
      
      // Build Platform Healing system prompt
      const systemPrompt = `You are Lomu Platform AI. You maintain the LomuAI codebase.

RULES:
1. MAX 2-3 sentences per response
2. Take action immediately - use tools first, explain after
3. When fixing: read file → write fix → say "✅ Fixed [what]"
4. NO explanations unless asked
5. Changes auto-commit to GitHub

TOOLS:
- read_platform_file(file_path)
- write_platform_file(file_path, content) 
- search_platform_files(pattern)

PLATFORM:
- Stack: React, TypeScript, Express, PostgreSQL
- Repo: ${process.env.GITHUB_REPO || 'Not configured'}

BE BRIEF. ACT FAST.`;

      // Convert messages to API format
      const conversationMessages: any[] = messages
        .filter((m: any) => m.content && typeof m.content === 'string' && m.content.trim().length > 0)
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));

      console.log(`🤖 [HEALING-CHAT] Starting Claude conversation with ${conversationMessages.length} messages...`);
      
      const computeStartTime = Date.now();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let filesModified: string[] = [];
      let fullResponse = '';
      
      // Multi-turn tool execution loop
      const MAX_ITERATIONS = 5;
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
        } catch (geminiError: any) {
          console.error(`[HEALING-CHAT] ❌ Gemini API error on iteration ${iterationCount}:`, geminiError);
          
          // On Gemini API error, break the loop and return what we have
          if (fullResponse.trim().length > 0) {
            // We have a partial response from previous iterations
            console.log(`[HEALING-CHAT] 🔄 Using partial response from ${iterationCount - 1} successful iterations`);
            break;
          } else {
            // First iteration failed, throw error
            throw new Error(`Gemini API error: ${geminiError.message || 'Unknown error'}`);
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
        
        // FIX #1: Check if Gemini wants to continue (has tool results to process)
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
          
          // Add assistant's tool calls to conversation (for next Claude call)
          conversationMessages.push({
            role: 'assistant',
            content: response.assistantContent
          });
          
          // Add tool results to conversation (for next Claude call)
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
          model: "gemini-2.5-flash",
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
            model: "gemini-2.5-flash",
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
          error: "Gemini API configuration error. Please check API key.",
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
          error: "Network error connecting to Gemini API. Please try again.",
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
