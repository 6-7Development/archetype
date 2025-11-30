import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { platformHealing } from '../platformHealing';
import { trackAIUsage } from '../usage-tracking';
import path from 'path';
import fs from 'fs/promises';

export type AIStrategy = 'architect';

let PLATFORM_OWNER_ID: string | null = null;

async function getPlatformOwnerId(): Promise<string | null> {
  if (PLATFORM_OWNER_ID) return PLATFORM_OWNER_ID;
  
  try {
    const admin = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);
    
    if (admin.length > 0) {
      PLATFORM_OWNER_ID = admin[0].id;
      console.log('[AI-HEALING] Platform owner ID cached:', PLATFORM_OWNER_ID);
      return PLATFORM_OWNER_ID;
    }
    
    console.warn('[AI-HEALING] No admin user found in database');
    return null;
  } catch (error: any) {
    console.error('[AI-HEALING] Error fetching platform owner:', error);
    return null;
  }
}

export class AIHealingService {
  private genai: GoogleGenerativeAI;
  
  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    this.genai = new GoogleGenerativeAI(geminiKey);
    console.log('[AI-HEALING] Gemini initialized for I AM Architect (advanced healing)');
  }
  
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
    return this.diagnoseWithGemini(diagnosticPrompt, incident);
  }
  
  private async diagnoseWithGemini(diagnosticPrompt: string, incident: any): Promise<{
    success: boolean;
    diagnosis?: string;
    fixApplied?: string;
    filesModified?: string[];
    error?: string;
    model?: string;
  }> {
    const healingStartTime = Date.now();
    
    try {
      console.log('[AI-HEALING] Starting Gemini diagnosis...');
      console.log('[AI-HEALING] Prompt:', diagnosticPrompt.substring(0, 200) + '...');
      
      const { buildBeeHiveSuperCorePrompt } = await import('../beehiveSuperCore');
      
      const contextPrompt = `Current incident:
- Type: ${incident.type}
- Severity: ${incident.severity}
- Description: ${incident.description}`;

      const systemPrompt = buildBeeHiveSuperCorePrompt({
        platform: 'BeeHiveAI Platform (Self-Healing Mode)',
        autoCommit: false,
        intent: 'task',
        contextPrompt,
        userMessage: diagnosticPrompt,
        autonomyLevel: 'max',
      });

      const model = this.genai.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });

      const tools = [{
        functionDeclarations: [
          {
            name: 'read_platform_file',
            description: 'Read a file from the platform codebase',
            parameters: {
              type: 'OBJECT' as const,
              properties: {
                file_path: { type: 'STRING' as const, description: 'Path to file relative to project root' }
              },
              required: ['file_path']
            }
          },
          {
            name: 'write_platform_file',
            description: 'Write or update a platform file',
            parameters: {
              type: 'OBJECT' as const,
              properties: {
                file_path: { type: 'STRING' as const, description: 'Path to file' },
                content: { type: 'STRING' as const, description: 'New file content' }
              },
              required: ['file_path', 'content']
            }
          },
          {
            name: 'search_platform_files',
            description: 'Search for files matching a pattern',
            parameters: {
              type: 'OBJECT' as const,
              properties: {
                pattern: { type: 'STRING' as const, description: 'Search pattern (e.g., "*.ts", "server/**")' }
              },
              required: ['pattern']
            }
          }
        ]
      }];

      const chat = model.startChat({
        tools,
        generationConfig: {
          maxOutputTokens: 4000,
        }
      });

      const response = await chat.sendMessage(diagnosticPrompt);
      const result = response.response;
      
      let diagnosis = '';
      let filesModified: string[] = [];
      
      const candidates = result.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        
        for (const part of parts) {
          if (part.text) {
            diagnosis += part.text;
          } else if (part.functionCall) {
            const toolName = part.functionCall.name;
            const toolInput = part.functionCall.args as any;
            
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
      }
      
      console.log('[AI-HEALING] Diagnosis:', diagnosis.substring(0, 500) + '...');
      console.log('[AI-HEALING] Files modified:', filesModified);
      
      const computeTimeMs = Date.now() - healingStartTime;
      const usageMetadata = result.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount || 0;
      const outputTokens = usageMetadata?.candidatesTokenCount || 0;
      
      let billingUserId = incident.userId;
      if (!billingUserId) {
        const platformId = await getPlatformOwnerId();
        if (!platformId) {
          console.warn('[TOKEN-TRACKING] No platform owner found, skipping billing for platform incident:', incident.id);
          return {
            success: true,
            diagnosis,
            fixApplied: filesModified.length > 0 ? `Modified ${filesModified.length} file(s)` : 'Diagnosis only, no files changed',
            filesModified,
            model: 'gemini-2.5-flash',
          };
        }
        billingUserId = platformId;
        console.log('[TOKEN-TRACKING] Platform incident - billing to platform owner:', platformId);
      }
      
      if (inputTokens > 0 || outputTokens > 0) {
        console.log(`[TOKEN-TRACKING] I AM healing ${incident.id}: ${inputTokens} input + ${outputTokens} output tokens, ${computeTimeMs}ms compute time`);
        
        const usageResult = await trackAIUsage({
          userId: billingUserId,
          projectId: incident.projectId || null,
          type: 'ai_chat',
          inputTokens,
          outputTokens,
          computeTimeMs,
          model: 'gemini',
          metadata: {
            model: 'gemini-2.5-flash',
            incidentId: incident.id,
            incidentType: incident.type,
            incidentSeverity: incident.severity,
            healingStrategy: 'architect',
            filesModified: filesModified.length,
          }
        });
        
        if (!usageResult.success) {
          console.error('[TOKEN-TRACKING] BILLING FAILURE for incident:', incident.id, usageResult.error);
          console.error('[TOKEN-TRACKING] Tokens:', inputTokens, 'input,', outputTokens, 'output');
        }
      } else {
        console.warn(`[TOKEN-TRACKING] WARNING: No tokens tracked for I AM healing ${incident.id}`);
      }
      
      return {
        success: true,
        diagnosis,
        fixApplied: filesModified.length > 0 ? `Modified ${filesModified.length} file(s)` : 'Diagnosis only, no files changed',
        filesModified,
        model: 'gemini-2.5-flash',
      };
      
    } catch (error: any) {
      console.error('[AI-HEALING] Gemini error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
        model: 'gemini-2.5-flash',
      };
    }
  }
}

export const aiHealingService = new AIHealingService();
