import { EventEmitter } from 'events';

type QueuedRequest = {
  id: string;
  userId: string;
  plan: string;
  priority: number;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  createdAt: Date;
};

// Plan priority levels (higher = more priority)
const PLAN_PRIORITY = {
  enterprise: 4,
  business: 3,
  pro: 2,
  starter: 1,
  free: 0,
};

export class PriorityQueue extends EventEmitter {
  private queue: QueuedRequest[] = [];
  private processing: boolean = false;
  private concurrent: number = 0;
  private readonly maxConcurrent: number = 5; // Process up to 5 requests simultaneously

  /**
   * Add a request to the priority queue
   */
  async enqueue<T>(
    userId: string,
    plan: string,
    execute: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const priority = PLAN_PRIORITY[plan as keyof typeof PLAN_PRIORITY] || 0;
      
      const request: QueuedRequest = {
        id: `${Date.now()}-${Math.random()}`,
        userId,
        plan,
        priority,
        execute,
        resolve,
        reject,
        createdAt: new Date(),
      };

      // Insert in priority order (higher priority first, then FIFO for same priority)
      const insertIndex = this.queue.findIndex(
        (item) => item.priority < priority
      );
      
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.emit('enqueue', { userId, plan, queueLength: this.queue.length });
      this.processQueue();
    });
  }

  /**
   * Process queued requests with concurrency limit
   */
  private async processQueue() {
    if (this.queue.length === 0 || this.concurrent >= this.maxConcurrent) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.concurrent++;
    this.emit('processing', { 
      userId: request.userId, 
      plan: request.plan, 
      concurrent: this.concurrent,
      queueLength: this.queue.length 
    });

    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.concurrent--;
      this.emit('completed', { 
        userId: request.userId, 
        concurrent: this.concurrent,
        queueLength: this.queue.length 
      });
      
      // Process next item
      this.processQueue();
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      concurrent: this.concurrent,
      maxConcurrent: this.maxConcurrent,
      breakdown: this.queue.reduce((acc, item) => {
        acc[item.plan] = (acc[item.plan] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// Singleton instance
export const aiQueue = new PriorityQueue();

// Log queue events (useful for debugging/monitoring)
aiQueue.on('enqueue', ({ userId, plan, queueLength }) => {
  console.log(`[QUEUE] Enqueued ${plan} user ${userId} | Queue: ${queueLength}`);
});

aiQueue.on('processing', ({ userId, plan, concurrent, queueLength }) => {
  console.log(`[QUEUE] Processing ${plan} user ${userId} | Active: ${concurrent} | Queue: ${queueLength}`);
});

aiQueue.on('completed', ({ userId, concurrent, queueLength }) => {
  console.log(`[QUEUE] Completed request | Active: ${concurrent} | Queue: ${queueLength}`);
});
