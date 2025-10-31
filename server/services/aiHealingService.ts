import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { platformHealing } from '../platformHealing';
import path from 'path';
import fs from 'fs/promises';

/**
 * Simplified AI healing service for autonomous fixes
 * (Synchronous version - no streaming, designed for healOrchestrator)
 */
export class AIHealingService {
  private anthropic: Anthropic;
  
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    this.anthropic = new Anthropic({ apiKey });
  }
  
  /**
   * Attempt to diagnose and fix an issue
   */
  async diagnoseAndFix(diagnosticPrompt: string, incident: any): Promise<{
    success: boolean;
    diagnosis?: string;
    fixApplied?: string;
    filesModified?: string[];
    error?: string;
  }> {
    try {
      console.log('[AI-HEALING] Starting diagnosis and fix...');
      console.log('[AI-HEALING] Prompt:', diagnosticPrompt);
      
      // Build system prompt
      const systemPrompt = `You are LomuAI, an autonomous platform healing assistant. Your task is to diagnose and fix platform issues.

Current incident:
- Type: ${incident.type}
- Severity: ${incident.severity}
- Description: ${incident.description}

Available tools:
- read_platform_file(path): Read a file from the platform
- write_platform_file(path, content): Write/update a file
- search_platform_files(pattern): Search for files matching pattern

Instructions:
1. Diagnose the root cause of the issue
2. Propose a specific fix
3. Apply the fix using available tools
4. Explain what you did

Be concise and focused. Only modify files that are necessary to fix the issue.`;

      // Call Anthropic API (simplified - single turn for MVP)
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
      
      // Process response
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
                true // skipAutoCommit=true - we'll commit after verification
              );
              filesModified.push(toolInput.file_path);
              console.log('[AI-HEALING] Modified file (not committed yet):', toolInput.file_path);
              
            } else if (toolName === 'search_platform_files') {
              // Use glob to search for files
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
      };
      
    } catch (error: any) {
      console.error('[AI-HEALING] Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }
}

export const aiHealingService = new AIHealingService();
