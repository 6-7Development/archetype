import type { Express } from "express";
import { insertHealingTargetSchema, insertHealingConversationSchema, insertHealingMessageSchema } from "@shared/schema";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";

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

  // POST /api/healing/messages - Send message to Lomu (with AI response)
  app.post("/api/healing/messages", isAuthenticated, isOwner, async (req, res) => {
    try {
      const userId = req.user!.id;
      const validated = insertHealingMessageSchema.parse(req.body);
      
      console.log("[HEALING-CHAT] User message received:", {
        conversationId: validated.conversationId,
        contentLength: validated.content.length,
      });
      
      // Import required services
      const { anthropic, DEFAULT_MODEL } = await import("../anthropic");
      const { aiQueue } = await import("../priority-queue");
      const { checkUsageLimits, trackAIUsage } = await import("../usage-tracking");
      
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
      
      // Get conversation history for context
      const messages = await storage.getHealingMessages(validated.conversationId);
      console.log(`[HEALING-CHAT] Loaded ${messages.length} messages from history`);
      
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
- Analyze code and suggest fixes
- Explain technical decisions
- Propose architectural improvements
- Debug production issues
- Review and improve code quality

**Communication Style:**
- Be concise and technical
- Explain reasoning behind suggestions
- Provide code examples when helpful
- Ask clarifying questions when needed

Let's help maintain this platform!`;

      // Prepare messages for Claude
      const validMessages = messages.filter((m: any) => {
        const hasContent = m.content && typeof m.content === 'string' && m.content.trim().length > 0;
        if (!hasContent) {
          console.warn(`⚠️ [HEALING-CHAT] Filtering out message with empty content (ID: ${m.id})`);
        }
        return hasContent;
      });

      console.log(`🤖 [HEALING-CHAT] Calling Claude API with ${validMessages.length} valid messages...`);
      
      // Get user's subscription for queue priority
      const subscription = await storage.getSubscription(userId);
      const plan = subscription?.plan || 'free';
      
      const computeStartTime = Date.now();
      
      // Call Claude API through priority queue
      const completion = await aiQueue.enqueue(userId, plan, async () => {
        const result = await anthropic.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: validMessages.map((m: any) => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content
          })),
        });
        return result;
      });

      const computeTimeMs = Date.now() - computeStartTime;
      const responseText = completion.content[0].type === 'text' ? completion.content[0].text : "";

      console.log(`✅ [HEALING-CHAT] Claude responded in ${computeTimeMs}ms (${responseText.length} chars)`);

      // Save assistant's response to database
      const assistantMessage = await storage.createHealingMessage({
        conversationId: validated.conversationId,
        role: 'assistant',
        content: responseText,
        metadata: {
          model: DEFAULT_MODEL,
          tokensUsed: (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0),
          computeTimeMs,
        },
      });

      console.log("[HEALING-CHAT] Assistant message saved to database");

      // Track AI usage for billing
      const inputTokens = completion.usage?.input_tokens || 0;
      const outputTokens = completion.usage?.output_tokens || 0;
      
      await trackAIUsage({
        userId,
        projectId: null, // Platform healing doesn't belong to a specific project
        type: "ai_chat",
        inputTokens,
        outputTokens,
        computeTimeMs,
        metadata: {
          conversationId: validated.conversationId,
          messageLength: validated.content.length,
          healingChat: true, // Flag to identify platform healing vs regular chat
        },
      });

      console.log("[HEALING-CHAT] Usage tracked successfully");

      // Return both user and assistant messages
      res.json({
        userMessage,
        assistantMessage,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
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
