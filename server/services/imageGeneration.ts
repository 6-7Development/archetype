/**
 * AI Image Generation Service - Generate images using OpenAI
 */

import { db } from '../db';
import { imageGenerations, type InsertImageGeneration, type ImageGeneration } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';

export class ImageGenerationService extends EventEmitter {
  /**
   * Generate an image using AI
   */
  async generateImage(params: {
    userId: string;
    projectId?: string;
    prompt: string;
    width?: number;
    height?: number;
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
  }): Promise<string> {
    // Create pending generation record
    const result = await db.insert(imageGenerations).values({
      userId: params.userId,
      projectId: params.projectId,
      prompt: params.prompt,
      model: 'gpt-image-1',
      width: params.width || 1024,
      height: params.height || 1024,
      quality: params.quality || 'standard',
      style: params.style || 'vivid',
      status: 'pending',
    }).returning();

    const generationId = result[0].id;

    // Emit event for async processing
    this.emit('image:requested', {
      generationId,
      ...params,
    });

    return generationId;
  }

  /**
   * Update generation status
   */
  async updateGeneration(generationId: string, updates: {
    status?: string;
    imageUrl?: string;
    tokensUsed?: number;
    cost?: number;
    error?: string;
  }): Promise<void> {
    const dbUpdates: any = { ...updates };
    if (updates.cost !== undefined) {
      dbUpdates.cost = updates.cost.toString();
    }
    
    await db.update(imageGenerations)
      .set(dbUpdates)
      .where(eq(imageGenerations.id, generationId));

    this.emit('image:updated', { generationId, ...updates });
  }

  /**
   * Get generation status
   */
  async getGeneration(generationId: string): Promise<ImageGeneration | null> {
    const result = await db.query.imageGenerations.findFirst({
      where: eq(imageGenerations.id, generationId),
    });

    return result || null;
  }

  /**
   * Get user's image generation history
   */
  async getUserGenerations(userId: string, limit: number = 20): Promise<ImageGeneration[]> {
    return await db.query.imageGenerations.findMany({
      where: eq(imageGenerations.userId, userId),
      orderBy: (imageGenerations, { desc }) => [desc(imageGenerations.createdAt)],
      limit,
    });
  }

  /**
   * Get project images
   */
  async getProjectImages(projectId: string): Promise<ImageGeneration[]> {
    return await db.query.imageGenerations.findMany({
      where: eq(imageGenerations.projectId, projectId),
      orderBy: (imageGenerations, { desc }) => [desc(imageGenerations.createdAt)],
    });
  }

  /**
   * Calculate estimated cost
   */
  estimateCost(quality: 'standard' | 'hd', width: number, height: number): number {
    // OpenAI image pricing (approximate)
    if (quality === 'hd') {
      return 0.08; // $0.08 per HD image
    }
    return 0.04; // $0.04 per standard image
  }
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();
