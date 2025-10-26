/**
 * Autonomy Settings Service - Manage user AI agent autonomy preferences
 */

import { db } from '../db';
import { userAutonomySettings, type InsertUserAutonomySettings, type UserAutonomySettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class AutonomySettingsService {
  /**
   * Get user's autonomy settings (or create defaults)
   */
  async getUserSettings(userId: string): Promise<UserAutonomySettings> {
    let settings = await db.query.userAutonomySettings.findFirst({
      where: eq(userAutonomySettings.userId, userId),
    });

    // Create default settings if none exist
    if (!settings) {
      const result = await db.insert(userAutonomySettings).values({
        userId,
        autonomyLevel: 'medium',
        autoCommit: false,
        autoDeploy: false,
        requireReview: true,
        allowSubAgents: true,
        maxConcurrentTasks: 3,
        autoTestingEnabled: true,
        preferences: {},
      }).returning();

      settings = result[0];
    }

    return settings;
  }

  /**
   * Update autonomy settings
   */
  async updateSettings(userId: string, updates: Partial<InsertUserAutonomySettings>): Promise<UserAutonomySettings> {
    // Ensure settings exist first
    await this.getUserSettings(userId);

    const result = await db.update(userAutonomySettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userAutonomySettings.userId, userId))
      .returning();

    return result[0];
  }

  /**
   * Get autonomy level details
   */
  getAutonomyLevelConfig(level: string): {
    name: string;
    description: string;
    permissions: string[];
  } {
    const configs = {
      low: {
        name: 'Low Autonomy',
        description: 'Agent asks for approval before major actions',
        permissions: [
          'Can read code and suggest changes',
          'Requires approval before modifying files',
          'Requires approval before installing dependencies',
          'Cannot auto-deploy or auto-commit',
        ],
      },
      medium: {
        name: 'Medium Autonomy',
        description: 'Balanced approach - autonomy for common tasks',
        permissions: [
          'Can modify existing files',
          'Can create new files in existing directories',
          'Can install approved dependencies',
          'Requires approval for destructive operations',
          'Cannot auto-deploy (manual trigger only)',
        ],
      },
      high: {
        name: 'High Autonomy',
        description: 'Extended autonomy - minimal interruptions',
        permissions: [
          'Can create and modify any files',
          'Can install dependencies freely',
          'Can spawn sub-agents for parallel work',
          'Can run tests and fix failures automatically',
          'Optional auto-deploy if enabled',
        ],
      },
      max: {
        name: 'Max Autonomy (Beta)',
        description: 'Full autonomy - agent works independently',
        permissions: [
          'Complete file system access',
          'Unlimited dependency installation',
          'Parallel sub-agent spawning',
          'Auto-testing and auto-fixing',
          'Auto-commit to version control',
          'Auto-deploy on success',
          'Extended thinking for complex problems',
        ],
      },
    };

    return configs[level as keyof typeof configs] || configs.medium;
  }

  /**
   * Check if action is allowed based on autonomy level
   */
  async isActionAllowed(userId: string, action: string): Promise<boolean> {
    const settings = await this.getUserSettings(userId);
    const level = settings.autonomyLevel;

    const permissions: Record<string, string[]> = {
      low: ['read', 'suggest'],
      medium: ['read', 'suggest', 'modify', 'create_file'],
      high: ['read', 'suggest', 'modify', 'create_file', 'install_deps', 'spawn_subagent', 'run_tests'],
      max: ['*'], // All actions allowed
    };

    const allowed = permissions[level] || [];
    return allowed.includes('*') || allowed.includes(action);
  }
}

// Export singleton instance
export const autonomySettingsService = new AutonomySettingsService();
