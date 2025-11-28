import { db } from '../db';
import { webhookQueue } from '@shared/schema';
import { logger, logError, logJob } from './logger';
import { withRetry } from './retryService';
import { sql, eq, and, lt } from 'drizzle-orm';

interface WebhookPayload {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface QueuedWebhook {
  id: string;
  targetUrl: string;
  payload: WebhookPayload;
  signature: string;
  attemptCount: number;
  nextRetryAt: Date;
  createdAt: Date;
  failureReason?: string;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 86400000; // 24 hours

/**
 * Queue a webhook for delivery with automatic retry
 */
export async function enqueueWebhook(
  targetUrl: string,
  payload: WebhookPayload,
  signature: string
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();

  try {
    await db.insert(webhookQueue).values({
      id,
      targetUrl,
      payload: payload as any,
      signature,
      attemptCount: 0,
      nextRetryAt: now,
      createdAt: now,
      status: 'pending',
    });

    logger.info('Webhook enqueued', { id, targetUrl, type: payload.type });
    return id;
  } catch (error) {
    logError('Failed to enqueue webhook', error as Error, { targetUrl });
    throw error;
  }
}

/**
 * Process pending webhooks with exponential backoff
 * Run this as a background job every 30 seconds
 */
export async function processWebhookQueue(): Promise<void> {
  const startTime = Date.now();
  const now = new Date();

  try {
    // Get all pending webhooks that are ready for retry
    const pendingWebhooks = await db.query.webhookQueue.findMany({
      where: and(
        eq(webhookQueue.status, 'pending'),
        lt(webhookQueue.nextRetryAt, now)
      ),
      limit: 10, // Process in batches
    });

    logger.info(`Processing ${pendingWebhooks.length} pending webhooks`);

    for (const webhook of pendingWebhooks) {
      await deliverWebhook(webhook as any);
    }

    const duration = Date.now() - startTime;
    logJob('webhook-queue-processor', 'completed', duration);
  } catch (error) {
    logError('Webhook queue processing failed', error as Error);
    logJob('webhook-queue-processor', 'failed', Date.now() - startTime, error as Error);
  }
}

/**
 * Deliver a single webhook with retry logic
 */
async function deliverWebhook(webhook: QueuedWebhook): Promise<void> {
  const { id, targetUrl, payload, signature, attemptCount } = webhook;

  try {
    await withRetry(
      async () => {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': webhook.createdAt.toISOString(),
          },
          body: JSON.stringify(payload),
          timeout: 10000,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      },
      `Webhook delivery to ${targetUrl}`,
      { maxRetries: 2, initialDelayMs: 1000 }
    );

    // Success - mark as delivered
    await db
      .update(webhookQueue)
      .set({ status: 'delivered', attemptCount: attemptCount + 1 })
      .where(eq(webhookQueue.id, id));

    logger.info('Webhook delivered successfully', { id, targetUrl });
  } catch (error) {
    const nextAttempt = attemptCount + 1;
    const shouldRetry = nextAttempt < MAX_RETRIES;

    if (shouldRetry) {
      // Calculate exponential backoff
      const backoffMs = Math.min(
        INITIAL_BACKOFF_MS * Math.pow(2, nextAttempt - 1),
        MAX_BACKOFF_MS
      );
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await db
        .update(webhookQueue)
        .set({
          attemptCount: nextAttempt,
          nextRetryAt,
          failureReason: (error as Error).message,
        })
        .where(eq(webhookQueue.id, id));

      logger.warn('Webhook delivery failed, scheduling retry', {
        id,
        targetUrl,
        attempt: nextAttempt,
        nextRetryMs: backoffMs,
        error: (error as Error).message,
      });
    } else {
      // Max retries exceeded - move to dead letter
      await db
        .update(webhookQueue)
        .set({
          status: 'failed',
          attemptCount: nextAttempt,
          failureReason: (error as Error).message,
        })
        .where(eq(webhookQueue.id, id));

      logError('Webhook failed after max retries', error as Error, {
        id,
        targetUrl,
        attempts: nextAttempt,
      });
    }
  }
}

/**
 * Get webhook queue statistics
 */
export async function getWebhookQueueStats() {
  const stats = await db
    .select({
      status: webhookQueue.status,
      count: sql<number>`COUNT(*)`,
      avgAttempts: sql<number>`AVG(${webhookQueue.attemptCount})`,
    })
    .from(webhookQueue)
    .groupBy(webhookQueue.status);

  return stats;
}
