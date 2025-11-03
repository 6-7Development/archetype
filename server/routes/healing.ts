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
    try {
      const userId = req.user!.id;
      const validated = insertHealingMessageSchema.parse(req.body);
      
      console.log("[HEALING-CHAT] User message received:", {
        conversationId: validated.conversationId,
        contentLength: validated.content.length,
      });
      
      // Import required services
      const { streamGeminiResponse } = await import("../gemini");
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
      const userMessage = await storage.createHealingMessage(validated);
      console.log("[HEALING-CHAT] User message saved to database");
      
      // Get conversation history for context (last 10 messages to save tokens)
      const allMessages = await storage.getHealingMessages(validated.conversationId);
      const messages = allMessages.slice(-10);
      console.log(`[HEALING-CHAT] Loaded ${messages.length} messages from history (last 10)`);
      
      // Build Platform Healing system prompt
      const systemPrompt = `You are Lomu, an AI assistant helping maintain and improve the LomuAI platform.

**Your Role:**
- Help diagnose and fix platform issues
- Suggest improvements to the codebase
- Explain platform architecture and decisions
- Guide platform owners through complex changes

**Platform Context:**
- Platform: LomuAI - AI-powered development platform
- Stack: React, TypeScript, Express, PostgreSQL, Railway
- Repository: ${process.env.GITHUB_REPO || 'Not configured'}
- Branch: ${process.env.GITHUB_BRANCH || 'main'}

**Your Capabilities:**
You have access to these tools:
- read_platform_file: Read any file from the platform codebase
- write_platform_file: Write or update platform files
- search_platform_files: Search for files matching a pattern

**Communication Style:**
- Be concise and take action
- When asked to fix something, use your tools to read, analyze, and fix the code
- Provide code examples when helpful
- Ask clarifying questions only when absolutely necessary

Let's help maintain this platform!`;

      // Convert messages to API format
      const conversationMessages: any[] = messages
        .filter((m: any) => m.content && typeof m.content === 'string' && m.content.trim().length > 0)
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));

      console.log(`🤖 [HEALING-CHAT] Starting Gemini conversation with ${conversationMessages.length} messages...`);
      
      const computeStartTime = Date.now();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let filesModified: string[] = [];
      let fullResponse = '';
      
      // Multi-turn tool execution loop
      const MAX_ITERATIONS = 5;
      let iterationCount = 0;
      let continueLoop = true;
      
      while (continueLoop && iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        console.log(`[HEALING-CHAT] Iteration ${iterationCount}/${MAX_ITERATIONS}`);
        
        // Call Gemini with tools
        const response = await streamGeminiResponse({
          model: "gemini-2.5-flash",
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
            console.log(`[HEALING-CHAT] Executing tool: ${toolUse.name}`);
            
            try {
              if (toolUse.name === 'read_platform_file') {
                const filePath = path.join(process.cwd(), toolUse.input.file_path);
                const content = await fs.readFile(filePath, 'utf-8');
                return { success: true, content };
                
              } else if (toolUse.name === 'write_platform_file') {
                await platformHealing.writePlatformFile(
                  toolUse.input.file_path,
                  toolUse.input.content,
                  true // skipAutoCommit=true (manual commit by root user)
                );
                filesModified.push(toolUse.input.file_path);
                return { success: true, message: `File updated: ${toolUse.input.file_path}` };
                
              } else if (toolUse.name === 'search_platform_files') {
                const { glob } = await import('glob');
                const matches = await glob(toolUse.input.pattern, { cwd: process.cwd() });
                return { success: true, files: matches };
              }
              
              return { error: 'Unknown tool' };
            } catch (error: any) {
              console.error(`[HEALING-CHAT] Tool error:`, error);
              return { error: error.message };
            }
          }
        });
        
        // Track tokens
        if (response.usage) {
          totalInputTokens += response.usage.inputTokens || 0;
          totalOutputTokens += response.usage.outputTokens || 0;
        }
        
        // Append AI response to conversation
        fullResponse += response.fullText;
        
        // Check if Gemini wants to continue (has tool results to process)
        if (response.needsContinuation && response.toolResults) {
          console.log(`[HEALING-CHAT] Gemini used ${response.toolResults.length} tools, continuing...`);
          
          // Add assistant's tool calls to conversation
          conversationMessages.push({
            role: 'assistant',
            content: response.assistantContent
          });
          
          // Add tool results to conversation
          conversationMessages.push({
            role: 'user',
            content: response.toolResults
          });
          
          continueLoop = true;
        } else {
          // Gemini is done
          continueLoop = false;
          console.log(`[HEALING-CHAT] Gemini completed in ${iterationCount} iterations`);
        }
      }

      const computeTimeMs = Date.now() - computeStartTime;

      console.log(`✅ [HEALING-CHAT] Gemini responded in ${computeTimeMs}ms (${fullResponse.length} chars)`);

      // Save assistant's response to database
      const assistantMessage = await storage.createHealingMessage({
        conversationId: validated.conversationId,
        role: 'assistant',
        content: fullResponse || "I apologize, but I couldn't generate a response. Please try again.",
        metadata: {
          model: "gemini-2.5-flash",
          tokensUsed: totalInputTokens + totalOutputTokens,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          computeTimeMs,
          iterations: iterationCount,
          filesModified,
        },
      });

      console.log("[HEALING-CHAT] Assistant message saved to database");

      // Track AI usage for billing
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

      console.log("[HEALING-CHAT] Usage tracked successfully");

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
      console.error("[HEALING-CHAT] Error:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid message data", details: error.errors });
      } else {
        res.status(500).json({ error: error.message || "Failed to create message" });
      }
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
