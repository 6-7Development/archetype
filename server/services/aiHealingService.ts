import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { platformHealing } from '../platformHealing';
import path from 'path';
import fs from 'fs/promises';

export type AIStrategy = 'architect';

/**
 * AI Healing Service for Tier 3 (I AM Architect)
 * 
 * Note: Tier 2 (LomuAI) is now handled via LomuAI job delegation in healOrchestrator.ts
 * This service only handles Tier 3 (Architect/Claude) for agent failures and complex issues.
 * 
 * Strategy:
 * - 'architect': Use Claude Sonnet 4 (expensive, expert, for agent failures)
 */
export class AIHealingService {
  private anthropic: Anthropic;
  
  constructor() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    this.anthropic = new Anthropic({ apiKey: anthropicKey });
    console.log('[AI-HEALING] Anthropic Claude initialized for Tier 3 (I AM Architect)');
  }
  
  /**
   * Attempt to diagnose and fix an issue using AI (Tier 3: I AM Architect)
   */
  async diagnoseAndFix(
    diagnosticPrompt: string, 
    incident: any,
    strategy: AIStrategy = 'architect'
  ): Promise<{
    success: boolean;
    diagnosis?: string;
    fixApplied?: string;
    filesModified?: string[];
    error?: string;
    model?: string;
  }> {
    console.log(`[AI-HEALING] Using strategy: ${strategy}`);
    return this.diagnoseWithClaude(diagnosticPrompt, incident);
  }
  
  /**
   * Diagnose and fix using Claude Sonnet 4 (expensive, expert)
   */
  private async diagnoseWithClaude(diagnosticPrompt: string, incident: any): Promise<{
    success: boolean;
    diagnosis?: string;
    fixApplied?: string;
    filesModified?: string[];
    error?: string;
    model?: string;
  }> {
    try {
      console.log('[AI-HEALING] Starting Claude diagnosis...');
      console.log('[AI-HEALING] Prompt:', diagnosticPrompt);
      
      const { buildLomuSuperCorePrompt } = await import('../lomuSuperCore');
      
      const contextPrompt = `Current incident:
- Type: ${incident.type}
- Severity: ${incident.severity}
- Description: ${incident.description}`;

      const systemPrompt = buildLomuSuperCorePrompt({
        platform: 'LomuAI Platform (Self-Healing Mode)',
        autoCommit: false,
        intent: 'task',
        contextPrompt,
        userMessage: diagnosticPrompt,
        autonomyLevel: 'max',
      });

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: diagnosticPrompt
        }],
        tools: [
          {
            name: 'read_platform_file',
            description: 'Read a file from the platform codebase',
            input_schema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: 'Path to file relative to project root' }
              },
              required: ['file_path']
            }
          },
          {
            name: 'write_platform_file',
            description: 'Write or update a platform file',
            input_schema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: 'Path to file' },
                content: { type: 'string', description: 'New file content' }
              },
              required: ['file_path', 'content']
            }
          },
          {
            name: 'search_platform_files',
            description: 'Search for files matching a pattern',
            input_schema: {
              type: 'object',
              properties: {
                pattern: { type: 'string', description: 'Search pattern (e.g., "*.ts", "server/**")' }
              },
              required: ['pattern']
            }
          }
        ]
      });
      
      let diagnosis = '';
      let filesModified: string[] = [];
      
      for (const block of response.content) {
        if (block.type === 'text') {
          diagnosis += block.text;
        } else if (block.type === 'tool_use') {
          const toolName = block.name;
          const toolInput = block.input as any;
          
          console.log('[AI-HEALING] Executing tool:', toolName, toolInput);
          
          try {
            if (toolName === 'read_platform_file') {
              const filePath = path.join(process.cwd(), toolInput.file_path);
              const content = await fs.readFile(filePath, 'utf-8');
              console.log('[AI-HEALING] Read file:', toolInput.file_path);
              
            } else if (toolName === 'write_platform_file') {
              await platformHealing.writePlatformFile(
                toolInput.file_path,
                toolInput.content,
                true
              );
              filesModified.push(toolInput.file_path);
              console.log('[AI-HEALING] Modified file (not committed yet):', toolInput.file_path);
              
            } else if (toolName === 'search_platform_files') {
              const { glob } = await import('glob');
              const matches = await glob(toolInput.pattern, { cwd: process.cwd() });
              console.log('[AI-HEALING] Found files:', matches);
            }
          } catch (toolError: any) {
            console.error('[AI-HEALING] Tool execution error:', toolError);
          }
        }
      }
      
      console.log('[AI-HEALING] Diagnosis:', diagnosis);
      console.log('[AI-HEALING] Files modified:', filesModified);
      
      return {
        success: true,
        diagnosis,
        fixApplied: filesModified.length > 0 ? `Modified ${filesModified.length} file(s)` : 'Diagnosis only, no files changed',
        filesModified,
        model: 'claude-sonnet-4-20250514',
      };
      
    } catch (error: any) {
      console.error('[AI-HEALING] Claude error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
        model: 'claude-sonnet-4-20250514',
      };
    }
  }
}

export const aiHealingService = new AIHealingService();
