import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { chats, messages } from '../lib/schema';
import OpenAI from 'openai';
import { WebSocket } from 'ws';

const router = Router();

// OpenAI client with proper configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout to prevent hanging
});

// In-memory queue for AI processing (can be replaced with Redis in production)
interface ChatJob {
  id: string;
  chatId: string;
  message: string;
  timestamp: number;
  wsId?: string;
}

class ChatProcessingQueue {
  private queue: ChatJob[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrent = 5; // Limit concurrent OpenAI calls

  async addJob(job: ChatJob): Promise<void> {
    this.queue.push(job);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.processing.add(job.id);

    try {
      await this.processJob(job);
    } catch (error) {
      console.error(`Error processing chat job ${job.id}:`, error);
      // Send error to WebSocket if available
      if (job.wsId && global.wsConnections?.has(job.wsId)) {
        const ws = global.wsConnections.get(job.wsId);
        ws.send(JSON.stringify({
          type: 'error',
          jobId: job.id,
          error: 'Failed to process message'
        }));
      }
    } finally {
      this.processing.delete(job.id);
      // Process next job
      setTimeout(() => this.processNext(), 100);
    }
  }

  private async processJob(job: ChatJob): Promise<void> {
    try {
      // Get chat history - SHORT database transaction
      const chatHistory = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, job.chatId))
        .orderBy(messages.createdAt)
        .limit(20); // Limit history for performance

      // Build OpenAI messages
      const openaiMessages = [
        {
          role: 'system' as const,
          content: 'You are a helpful AI assistant. Be concise and helpful.'
        },
        ...chatHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        {
          role: 'user' as const,
          content: job.message
        }
      ];

      // Make OpenAI call with streaming
      const stream = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: openaiMessages,
        stream: true,
        max_tokens: 500, // Limit response length
        temperature: 0.7
      });

      let assistantMessage = '';
      
      // Stream response via WebSocket
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        assistantMessage += content;
        
        // Send chunk to WebSocket if available
        if (job.wsId && global.wsConnections?.has(job.wsId)) {
          const ws = global.wsConnections.get(job.wsId);
          ws.send(JSON.stringify({
            type: 'chunk',
            jobId: job.id,
            content: content
          }));
        }
      }

      // Store messages in database - SHORT transactions
      await Promise.all([
        db.insert(messages).values({
          id: crypto.randomUUID(),
          chatId: job.chatId,
          role: 'user',
          content: job.message,
          createdAt: new Date(job.timestamp)
        }),
        db.insert(messages).values({
          id: crypto.randomUUID(),
          chatId: job.chatId,
          role: 'assistant',
          content: assistantMessage,
          createdAt: new Date()
        })
      ]);

      // Send completion via WebSocket
      if (job.wsId && global.wsConnections?.has(job.wsId)) {
        const ws = global.wsConnections.get(job.wsId);
        ws.send(JSON.stringify({
          type: 'complete',
          jobId: job.id,
          message: assistantMessage
        }));
      }

    } catch (error) {
      console.error('Error in processJob:', error);
      throw error;
    }
  }
}

const chatQueue = new ChatProcessingQueue();

// Initialize WebSocket connections storage
if (!global.wsConnections) {
  global.wsConnections = new Map();
}

// Chat routes
router.get('/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // SHORT database query with immediate connection release
    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);

    res.json(chatMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message, wsId } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Create job ID and add to queue
    const jobId = crypto.randomUUID();
    
    await chatQueue.addJob({
      id: jobId,
      chatId,
      message: message.trim(),
      timestamp: Date.now(),
      wsId
    });

    // Immediate response with job ID
    res.json({ 
      jobId,
      status: 'queued',
      message: 'Message queued for processing'
    });

  } catch (error) {
    console.error('Error queuing message:', error);
    res.status(500).json({ error: 'Failed to queue message' });
  }
});

router.get('/', async (req, res) => {
  try {
    const userChats = await db.select().from(chats).limit(50);
    res.json(userChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    
    const newChat = await db.insert(chats).values({
      id: crypto.randomUUID(),
      title: title || 'New Chat',
      createdAt: new Date()
    }).returning();

    res.json(newChat[0]);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

export default router;