/**
 * Design Prototype Service - Quick frontend prototypes from "Start with Design" mode
 */

import { db } from '../db';
import { designPrototypes, type InsertDesignPrototype, type DesignPrototype } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';

export class DesignPrototypeService extends EventEmitter {
  /**
   * Create a new design prototype
   */
  async createPrototype(params: {
    userId: string;
    projectId?: string;
    planSessionId?: string;
    name: string;
    description?: string;
    screens: any[];
    designSystemTokens?: any;
  }): Promise<string> {
    const result = await db.insert(designPrototypes).values({
      userId: params.userId,
      projectId: params.projectId,
      planSessionId: params.planSessionId,
      name: params.name,
      description: params.description,
      screens: params.screens,
      designSystemTokens: params.designSystemTokens,
      status: 'draft',
    }).returning();

    const prototypeId = result[0].id;
    this.emit('prototype:created', { prototypeId, ...params });
    
    return prototypeId;
  }

  /**
   * Get prototype details
   */
  async getPrototype(prototypeId: string): Promise<DesignPrototype | null> {
    const result = await db.query.designPrototypes.findFirst({
      where: eq(designPrototypes.id, prototypeId),
    });

    return result || null;
  }

  /**
   * Get user's design prototypes
   */
  async getUserPrototypes(userId: string): Promise<DesignPrototype[]> {
    return await db.query.designPrototypes.findMany({
      where: eq(designPrototypes.userId, userId),
      orderBy: (designPrototypes, { desc }) => [desc(designPrototypes.createdAt)],
    });
  }

  /**
   * Update prototype screens
   */
  async updateScreens(prototypeId: string, screens: any[]): Promise<void> {
    await db.update(designPrototypes)
      .set({ screens })
      .where(eq(designPrototypes.id, prototypeId));

    this.emit('prototype:updated', { prototypeId, screens });
  }

  /**
   * Approve prototype (ready to build functionality)
   */
  async approvePrototype(prototypeId: string): Promise<void> {
    await db.update(designPrototypes)
      .set({
        status: 'approved',
        approvedAt: new Date(),
      })
      .where(eq(designPrototypes.id, prototypeId));

    this.emit('prototype:approved', { prototypeId });
  }

  /**
   * Set prototype to building state
   */
  async startBuilding(prototypeId: string, generatedFiles: any): Promise<void> {
    await db.update(designPrototypes)
      .set({
        status: 'building',
        generatedFiles,
      })
      .where(eq(designPrototypes.id, prototypeId));

    this.emit('prototype:building', { prototypeId, generatedFiles });
  }

  /**
   * Generate design system tokens from prototype
   */
  generateDesignTokens(screens: any[]): {
    colors: any;
    typography: any;
    spacing: any;
  } {
    // Extract common design patterns from screens
    const colors = new Set();
    const fontSizes = new Set();
    const spacing = new Set();

    screens.forEach((screen: any) => {
      screen.components?.forEach((component: any) => {
        if (component.style?.color) colors.add(component.style.color);
        if (component.style?.backgroundColor) colors.add(component.style.backgroundColor);
        if (component.style?.fontSize) fontSizes.add(component.style.fontSize);
        if (component.style?.padding) spacing.add(component.style.padding);
        if (component.style?.margin) spacing.add(component.style.margin);
      });
    });

    return {
      colors: Array.from(colors),
      typography: { fontSizes: Array.from(fontSizes) },
      spacing: Array.from(spacing),
    };
  }
}

// Export singleton instance
export const designPrototypeService = new DesignPrototypeService();
