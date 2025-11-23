import { Router } from 'express';
import { db } from '../db';
import { chatMessages } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated } from '../universalAuth';
import { aiLimiter } from '../rateLimiting';
import { streamAnthropicResponse } from '../anthropic';
import { buildArchitectSystemPrompt } from '../lomuSuperCore';
import Anthropic from '@anthropic-ai/sdk';
import multer from 'multer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { knowledge_search } from '../tools/knowledge.js';

const execAsync = promisify(exec);

const router = Router();

// Configure multer for image uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Architect tools - read-only consultant tools
const ARCHITECT_TOOLS: Anthropic.Tool[] = [
  {
    name: "readPlatformFile",
    description: "Read a file from the platform codebase to inspect code and understand implementations.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file from project root (e.g. 'server/routes/auth.ts')"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "bash",
    description: "Execute shell commands to check logs, run tests, or inspect the system.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute"
        }
      },
      required: ["command"]
    }
  },
  {
    name: "knowledge_search",
    description: "Search the knowledge base for historical information and architectural decisions.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query"
        },
        category: {
          type: "string",
          description: "Filter by category"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags"
        }
      },
      required: ["query"]
    }
  }
];

/**
 * POST /api/architect/access-tier
 * Always returns free access - Architect consultation is always FREE
 */
router.post('/access-tier', isAuthenticated, async (req: any, res) => {
  console.log('[ARCHITECT] Access tier check - architect is always FREE');
  return res.json({ isFreeAccess: true });
});

/**
 * POST /api/architect/stream
 * Stream AI responses from I AM Architect using Claude Sonnet 4
 */
router.post('/stream', isAuthenticated, aiLimiter, async (req: any, res) => {
  const userId = req.authenticatedUserId;
  const { message, sessionId = nanoid(), conversationHistory = [] } = req.body;

  console.log('[ARCHITECT] Stream request:', {
    userId,
    sessionId,
    messageLength: message?.length,
    historyLength: conversationHistory.length
  });

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

  try {
    // Save user message to database
    const [userMessage] = await db.insert(chatMessages).values({
      userId,
      projectId: null, // Architect is platform-wide
      conversationStateId: sessionId,
      role: 'user',
      content: message,
      isPlatformHealing: true, // Mark as architect conversation
    }).returning();

    // Build conversation history for Claude
    const messages: any[] = conversationHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Build architect system prompt
    const systemPrompt = buildArchitectSystemPrompt({
      problem: message,
      context: 'User is consulting I AM Architect for architectural guidance',
      previousAttempts: [],
      codeSnapshot: undefined
    });

    console.log('[ARCHITECT] Starting Claude stream with', messages.length, 'messages');

    let fullResponse = '';
    let assistantMessageId: string | null = null;
    let totalUsage = { inputTokens: 0, outputTokens: 0 };

    // SSE helper to send events in correct format (matches lomuChat.ts)
    const sendEvent = (eventType: string, data: any) => {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial heartbeat
    sendEvent('heartbeat', { timestamp: Date.now() });

    // Tool continuation loop - keep streaming until Claude is done
    let needsContinuation = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 20; // Allow thorough analysis (Claude often needs 10-15 tool calls)

    while (needsContinuation && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`[ARCHITECT] Stream iteration ${iterationCount}`);

      // Stream response from Claude
      const result = await streamAnthropicResponse({
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        system: systemPrompt,
        messages,
        tools: ARCHITECT_TOOLS,
        onChunk: (chunk) => {
          if (chunk.type === 'chunk' && chunk.content) {
            fullResponse += chunk.content;
            // Send SSE chunk to client (proper SSE format)
            sendEvent('content', { content: chunk.content });
          }
        },
        onToolUse: async (toolUse) => {
          console.log('[ARCHITECT] Tool use:', toolUse.name);
          
          // Send tool use notification to client (proper SSE format)
          sendEvent('tool_call', { 
            tool: toolUse.name,
            input: toolUse.input 
          });

          // Execute tool
          let result: any = null;
          
          try {
            if (toolUse.name === 'readPlatformFile') {
              const filePath = toolUse.input.path;
              const fullPath = path.join(process.cwd(), filePath);
              const content = await fs.readFile(fullPath, 'utf-8');
              result = { content };
            } else if (toolUse.name === 'bash') {
              const { stdout, stderr } = await execAsync(toolUse.input.command, {
                timeout: 30000,
                maxBuffer: 1024 * 1024
              });
              result = { stdout, stderr };
            } else if (toolUse.name === 'knowledge_search') {
              result = await knowledge_search(toolUse.input);
            } else {
              result = { error: `Tool ${toolUse.name} not implemented` };
            }
          } catch (error: any) {
            console.error('[ARCHITECT] Tool execution error:', error);
            result = { error: error.message };
          }

          // Send tool result to client (proper SSE format)
          sendEvent('tool_result', { 
            tool: toolUse.name,
            result 
          });

          return result;
        },
      });

      // Accumulate usage
      if (result.usage) {
        totalUsage.inputTokens += result.usage.inputTokens;
        totalUsage.outputTokens += result.usage.outputTokens;
      }

      // Check if we need to continue (Claude used tools)
      if (result.needsContinuation && result.assistantContent && result.toolResults) {
        console.log('[ARCHITECT] Tool continuation needed, appending results to conversation');
        
        // Add assistant's tool-use message to conversation
        messages.push({
          role: 'assistant',
          content: result.assistantContent
        });

        // Add tool results as user message
        messages.push({
          role: 'user',
          content: result.toolResults
        });

        needsContinuation = true;
      } else {
        // No more tools, we're done
        needsContinuation = false;
        
        console.log('[ARCHITECT] Stream complete:', {
          responseLength: fullResponse.length,
          iterations: iterationCount,
          usage: totalUsage
        });

        // Save assistant response to database
        // ✅ GAP #2 FIX: Add validationMetadata (Architect doesn't validate tool results)
        const [assistantMsg] = await db.insert(chatMessages).values({
          userId,
          projectId: null,
          conversationStateId: sessionId,
          role: 'assistant',
          content: fullResponse,
          isPlatformHealing: true,
          validationMetadata: undefined,
        }).returning();

        assistantMessageId = assistantMsg.id;

        // Send completion event (proper SSE format)
        sendEvent('done', { 
          messageId: assistantMessageId,
          usage: totalUsage 
        });
        res.end();
      }
    }

    // Safety check for infinite loops
    if (iterationCount >= MAX_ITERATIONS) {
      console.error('[ARCHITECT] Max iterations reached, stopping');
      sendEvent('error', { 
        error: 'Maximum tool iterations reached' 
      });
      res.end();
    }

  } catch (error: any) {
    console.error('[ARCHITECT] Fatal error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      // Use sendEvent helper (defined in stream handler scope)
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/architect/history/:sessionId
 * Get chat history for a specific session
 */
router.get('/history/:sessionId', isAuthenticated, async (req: any, res) => {
  const userId = req.authenticatedUserId;
  const { sessionId } = req.params;

  try {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.conversationStateId, sessionId),
          eq(chatMessages.isPlatformHealing, true)
        )
      )
      .orderBy(chatMessages.createdAt);

    console.log('[ARCHITECT] Retrieved history:', {
      sessionId,
      messageCount: messages.length
    });

    res.json({ messages });
  } catch (error: any) {
    console.error('[ARCHITECT] Error fetching history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/architect/upload-image
 * Upload images for vision-based analysis
 */
router.post('/upload-image', isAuthenticated, upload.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageId = nanoid();
    const imageDir = path.join(process.cwd(), 'attached_assets', 'chat_images');
    
    // Ensure directory exists
    await fs.mkdir(imageDir, { recursive: true });

    const ext = path.extname(req.file.originalname);
    const newPath = path.join(imageDir, `chat_image_${imageId}${ext}`);
    
    // Move uploaded file to permanent location
    await fs.rename(req.file.path, newPath);

    const imageUrl = `/attached_assets/chat_images/chat_image_${imageId}${ext}`;

    console.log('[ARCHITECT] Image uploaded:', {
      imageId,
      originalName: req.file.originalname,
      size: req.file.size,
      imageUrl
    });

    res.json({ 
      imageId,
      imageUrl,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error: any) {
    console.error('[ARCHITECT] Image upload error:', error);
    // Clean up uploaded file on error
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('[ARCHITECT] Failed to clean up uploaded file:', unlinkError);
      }
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
