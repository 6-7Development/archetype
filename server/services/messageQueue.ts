/**
 * Message Queue Service - Queue follow-up requests while agent is working
 */

import { db } from '../db';
import { messageQueue, type InsertMessageQueue, type MessageQueue } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { EventEmitter } from 'events';

export class MessageQueueService extends EventEmitter {
  private processingQueue = false;
  private processInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startQueueProcessor();
  }

  /**
   * Add message to queue
   */
  async enqueue(params: {
    userId: string;
    projectId?: string;
    message: string;
    priority?: number;
    metadata?: any;
  }): Promise<string> {
    const result = await db.insert(messageQueue).values({
      userId: params.userId,
      projectId: params.projectId,
      message: params.message,
      priority: params.priority || 5,
      status: 'queued',
      metadata: params.metadata,
    }).returning();

    const messageId = result[0].id;
    this.emit('message:queued', { messageId, ...params });
    
    return messageId;
  }

  /**
   * Get next queued message for processing
   */
  async dequeue(userId?: string): Promise<MessageQueue | null> {
    const whereClause = userId 
      ? and(eq(messageQueue.userId, userId), eq(messageQueue.status, 'queued'))
      : eq(messageQueue.status, 'queued');

    const messages = await db.query.messageQueue.findMany({
      where: whereClause,
      orderBy: [desc(messageQueue.priority), messageQueue.queuedAt],
      limit: 1,
    });

    if (messages.length === 0) return null;

    const message = messages[0];
    
    // Mark as processing
    await db.update(messageQueue)
      .set({
        status: 'processing',
        startedAt: new Date(),
      })
      .where(eq(messageQueue.id, message.id));

    return message;
  }

  /**
   * Mark message as completed
   */
  async complete(messageId: string): Promise<void> {
    await db.update(messageQueue)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(messageQueue.id, messageId));

    this.emit('message:completed', { messageId });
  }

  /**
   * Cancel a queued message
   */
  async cancel(messageId: string): Promise<void> {
    await db.update(messageQueue)
      .set({ status: 'cancelled' })
      .where(eq(messageQueue.id, messageId));

    this.emit('message:cancelled', { messageId });
  }

  /**
   * Get user's queue
   */
  async getUserQueue(userId: string): Promise<MessageQueue[]> {
    return await db.query.messageQueue.findMany({
      where: and(
        eq(messageQueue.userId, userId),
        eq(messageQueue.status, 'queued')
      ),
      orderBy: [desc(messageQueue.priority), messageQueue.queuedAt],
    });
  }

  /**
   * Get queue size
   */
  async getQueueSize(userId?: string): Promise<number> {
    const whereClause = userId
      ? and(eq(messageQueue.userId, userId), eq(messageQueue.status, 'queued'))
      : eq(messageQueue.status, 'queued');

    const result = await db.query.messageQueue.findMany({
      where: whereClause,
    });

    return result.length;
  }

  /**
   * Start automatic queue processor
   */
  private startQueueProcessor(): void {
    // Check queue every 5 seconds
    this.processInterval = setInterval(async () => {
      if (!this.processingQueue) {
        await this.processNext();
      }
    }, 5000);
  }

  /**
   * Process next queued message
   */
  private async processNext(): Promise<void> {
    this.processingQueue = true;
    
    try {
      const message = await this.dequeue();
      if (message) {
        this.emit('message:processing', message);
      }
    } catch (error) {
      console.error('[MESSAGE-QUEUE] Processing error:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Stop queue processor
   */
  stopQueueProcessor(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Clear all queued messages for a user
   */
  async clearUserQueue(userId: string): Promise<void> {
    await db.update(messageQueue)
      .set({ status: 'cancelled' })
      .where(and(
        eq(messageQueue.userId, userId),
        eq(messageQueue.status, 'queued')
      ));

    this.emit('queue:cleared', { userId });
  }
}

// Export singleton instance
export const messageQueueService = new MessageQueueService();
