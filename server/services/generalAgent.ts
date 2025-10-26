/**
 * General Agent Service - Support ALL project types (not just web apps)
 */

import { db } from '../db';
import { projectSettings, type InsertProjectSettings, type ProjectSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';

export class GeneralAgentService extends EventEmitter {
  /**
   * Get project type configurations
   */
  getProjectTypes(): Array<{
    type: string;
    name: string;
    description: string;
    icon: string;
    frameworks: string[];
  }> {
    return [
      {
        type: 'webapp',
        name: 'Web Application',
        description: 'Full-stack web apps with React, Vue, or vanilla JS',
        icon: 'Globe',
        frameworks: ['react', 'vue', 'svelte', 'vanilla', 'next', 'remix'],
      },
      {
        type: 'game',
        name: 'Game',
        description: 'Browser games, 2D/3D games with Unity, Pygame, or Phaser',
        icon: 'Gamepad2',
        frameworks: ['phaser', 'pygame', 'unity', 'godot', 'kaboom'],
      },
      {
        type: 'mobile',
        name: 'Mobile App',
        description: 'iOS/Android apps with React Native or Flutter',
        icon: 'Smartphone',
        frameworks: ['react-native', 'flutter', 'expo'],
      },
      {
        type: 'cli',
        name: 'CLI Tool',
        description: 'Command-line applications and utilities',
        icon: 'Terminal',
        frameworks: ['node-cli', 'python-cli', 'go-cli', 'rust-cli'],
      },
      {
        type: 'api',
        name: 'API/Backend',
        description: 'REST APIs, GraphQL servers, and backend services',
        icon: 'Server',
        frameworks: ['express', 'fastapi', 'flask', 'nest', 'hono'],
      },
      {
        type: 'automation',
        name: 'Automation/Bot',
        description: 'Chatbots, scheduled tasks, and workflow automation',
        icon: 'Bot',
        frameworks: ['discord-bot', 'slack-bot', 'telegram-bot', 'puppeteer'],
      },
      {
        type: 'data',
        name: 'Data Science',
        description: 'Data analysis, ML models, and notebooks',
        icon: 'Database',
        frameworks: ['jupyter', 'pandas', 'tensorflow', 'pytorch'],
      },
    ];
  }

  /**
   * Get or create project settings
   */
  async getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
    const result = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.projectId, projectId),
    });

    return result || null;
  }

  /**
   * Initialize project settings
   */
  async initializeProjectSettings(params: {
    projectId: string;
    projectType: string;
    framework?: string;
    buildCommand?: string;
    startCommand?: string;
    testCommand?: string;
    deploymentConfig?: any;
    customSettings?: any;
  }): Promise<string> {
    // Check if settings already exist
    const existing = await this.getProjectSettings(params.projectId);
    if (existing) {
      return existing.id;
    }

    const result = await db.insert(projectSettings).values({
      projectId: params.projectId,
      projectType: params.projectType,
      framework: params.framework,
      buildCommand: params.buildCommand,
      startCommand: params.startCommand,
      testCommand: params.testCommand,
      deploymentConfig: params.deploymentConfig,
      customSettings: params.customSettings,
    }).returning();

    const settingsId = result[0].id;
    this.emit('project:initialized', { settingsId, ...params });
    
    return settingsId;
  }

  /**
   * Update project settings
   */
  async updateProjectSettings(projectId: string, updates: Partial<InsertProjectSettings>): Promise<void> {
    await db.update(projectSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(projectSettings.projectId, projectId));

    this.emit('project:updated', { projectId, updates });
  }

  /**
   * Get build adapter for project type
   */
  getBuildAdapter(projectType: string): {
    getDefaultCommands: () => {
      build?: string;
      start: string;
      test?: string;
    };
    getFileStructure: () => string[];
    getRecommendedPackages: () => string[];
  } {
    const adapters: Record<string, any> = {
      webapp: {
        getDefaultCommands: () => ({
          build: 'npm run build',
          start: 'npm run dev',
          test: 'npm test',
        }),
        getFileStructure: () => [
          'src/components/',
          'src/pages/',
          'src/lib/',
          'public/',
        ],
        getRecommendedPackages: () => ['react', 'vite', 'tailwindcss'],
      },
      game: {
        getDefaultCommands: () => ({
          start: 'npm run dev',
          build: 'npm run build',
        }),
        getFileStructure: () => [
          'src/scenes/',
          'src/sprites/',
          'src/assets/',
        ],
        getRecommendedPackages: () => ['phaser', 'vite'],
      },
      mobile: {
        getDefaultCommands: () => ({
          start: 'npm start',
          build: 'npm run build',
        }),
        getFileStructure: () => [
          'src/screens/',
          'src/components/',
          'src/navigation/',
        ],
        getRecommendedPackages: () => ['expo', 'react-native'],
      },
      cli: {
        getDefaultCommands: () => ({
          start: 'node index.js',
          build: 'npm run build',
          test: 'npm test',
        }),
        getFileStructure: () => [
          'src/commands/',
          'src/utils/',
          'bin/',
        ],
        getRecommendedPackages: () => ['commander', 'chalk', 'inquirer'],
      },
      api: {
        getDefaultCommands: () => ({
          start: 'npm start',
          build: 'npm run build',
          test: 'npm test',
        }),
        getFileStructure: () => [
          'src/routes/',
          'src/controllers/',
          'src/models/',
          'src/middleware/',
        ],
        getRecommendedPackages: () => ['express', 'cors', 'dotenv'],
      },
      automation: {
        getDefaultCommands: () => ({
          start: 'npm start',
        }),
        getFileStructure: () => [
          'src/handlers/',
          'src/utils/',
          'src/config/',
        ],
        getRecommendedPackages: () => ['dotenv'],
      },
      data: {
        getDefaultCommands: () => ({
          start: 'jupyter notebook',
        }),
        getFileStructure: () => [
          'notebooks/',
          'data/',
          'models/',
          'scripts/',
        ],
        getRecommendedPackages: () => [],
      },
    };

    return adapters[projectType] || adapters.webapp;
  }

  /**
   * Detect project type from files
   */
  async detectProjectType(files: { filename: string; path: string }[]): Promise<string> {
    const fileMap = files.map(f => `${f.path}/${f.filename}`);

    // Check for specific frameworks/patterns
    if (fileMap.some(f => f.includes('phaser') || f.includes('game.js'))) {
      return 'game';
    }
    if (fileMap.some(f => f.includes('react-native') || f.includes('expo'))) {
      return 'mobile';
    }
    if (fileMap.some(f => f.includes('bin/') || f.includes('cli.js'))) {
      return 'cli';
    }
    if (fileMap.some(f => f.includes('.ipynb') || f.includes('notebook'))) {
      return 'data';
    }
    if (fileMap.some(f => f.includes('bot') || f.includes('discord') || f.includes('telegram'))) {
      return 'automation';
    }
    if (fileMap.some(f => f.includes('routes/') && !f.includes('pages/'))) {
      return 'api';
    }

    // Default to webapp
    return 'webapp';
  }
}

// Export singleton instance
export const generalAgentService = new GeneralAgentService();
