import { GoogleGenerativeAI } from '@google/generative-ai';
import { platformHealing } from '../platformHealing.ts';
import { knowledge_search, knowledge_store, knowledge_recall, code_search } from '../tools/knowledge.ts';
import { buildArchitectSystemPrompt } from '../beehiveSuperCore/architectPrompt.ts';
import { RAILWAY_CONFIG } from '../config/railway.ts';
import { db } from '../db';
import { architectNotes } from '@shared/schema';

const genai = new GoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy-key",
});

// I AM Architect uses Gemini with stronger guardrails
const ARCHITECT_MODEL = 'gemini-2.5-flash';
const PLATFORM_PROJECT_ID = "platform-wide-notes";

// Simplified tool definitions for Gemini
const ARCHITECT_TOOLS = [
  {
    name: "readPlatformFile",
    description: "Read a file from the Archetype platform codebase",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
  },
  {
    name: "code_search",
    description: "Search the code snippet knowledge base",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] }
  },
  {
    name: "knowledge_search",
    description: "Search the knowledge base for historical information",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] }
  },
  {
    name: "knowledge_store",
    description: "Store knowledge for future use",
    input_schema: { type: "object", properties: { category: { type: "string" }, topic: { type: "string" }, content: { type: "string" } }, required: ["category", "topic", "content"] }
  }
];

// Execute architect tools
async function executeArchitectTool(toolName: string, toolInput: any): Promise<string> {
  try {
    switch (toolName) {
      case "readPlatformFile":
        return await platformHealing.readPlatformFile(toolInput.path);
      
      case "code_search": {
        const results = await code_search({ query: toolInput.query, limit: toolInput.limit || 10 }) as any[];
        return results.length > 0 ? JSON.stringify(results.slice(0, 3)) : "No code snippets found";
      }
      
      case "knowledge_search": {
        const results = await knowledge_search({ query: toolInput.query, limit: toolInput.limit || 10 });
        return results.length > 0 ? JSON.stringify(results.slice(0, 3)) : "No knowledge entries found";
      }
      
      case "knowledge_store": {
        return await knowledge_store({ category: toolInput.category, topic: toolInput.topic, content: toolInput.content, source: 'i-am-architect', confidence: 0.9 });
      }
      
      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error: any) {
    return `ERROR: ${error.message}`;
  }
}

export interface ArchitectAgentParams {
  problem: string;
  context: string;
  previousAttempts: string[];
  codeSnapshot?: string;
}

export interface ArchitectAgentResult {
  success: boolean;
  guidance: string;
  recommendations: string[];
  alternativeApproach?: string;
  evidenceUsed: string[];
  filesInspected: string[];
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

export async function runArchitectAgent(params: ArchitectAgentParams): Promise<ArchitectAgentResult> {
  const { problem, context, previousAttempts, codeSnapshot } = params;
  
  const filesInspected: string[] = [];
  const evidenceUsed: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const systemPrompt = buildArchitectSystemPrompt({ problem, context, previousAttempts, codeSnapshot });
    
    const userPrompt = `PROBLEM: ${problem}\n\nCONTEXT: ${context}\n\nPREVIOUS ATTEMPTS:\n${previousAttempts.join('\n')}\n\n${codeSnapshot ? `CODE:\n${codeSnapshot}` : ''}`;

    // Convert tools to Gemini format
    const geminiTools = ARCHITECT_TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema }));

    const model = genai.getGenerativeModel({
      model: ARCHITECT_MODEL,
      systemInstruction: systemPrompt,
      tools: { functionDeclarations: geminiTools }
    });

    let messages: any[] = [{ role: "user", parts: [{ text: userPrompt }] }];
    let guidance = '';
    let continueLoop = true;
    let rounds = 0;
    const MAX_ROUNDS = 3;

    while (continueLoop && rounds < MAX_ROUNDS) {
      rounds++;
      
      try {
        const response = await model.generateContent({
          contents: messages,
          generationConfig: { maxOutputTokens: 2000, temperature: 0.2 }
        });

        const result = response.response;
        totalInputTokens += result.usageMetadata?.promptTokenCount || 0;
        totalOutputTokens += result.usageMetadata?.candidatesTokenCount || 0;

        const parts = result.candidates?.[0]?.content?.parts || [];
        let hasToolCall = false;

        for (const part of parts) {
          if (part.text) {
            guidance = part.text;
          }
          if (part.functionCall) {
            hasToolCall = true;
            const call = part.functionCall;
            const toolResult = await executeArchitectTool(call.name, call.args || {});
            
            if (call.name === 'readPlatformFile') {
              filesInspected.push((call.args as any).path);
            }
            evidenceUsed.push(`Used ${call.name}`);

            messages.push({ role: "model", parts });
            messages.push({
              role: "user",
              parts: [{ functionResponse: { name: call.name, response: { result: toolResult } } }]
            });
          }
        }

        if (!hasToolCall) {
          continueLoop = false;
        }
      } catch (error: any) {
        console.error(`[ARCHITECT] Round ${rounds} error:`, error.message);
        if (rounds >= MAX_ROUNDS) throw error;
      }
    }

    return {
      success: true,
      guidance: guidance || "Architectural analysis complete. Review the code patterns and knowledge base.",
      recommendations: guidance.includes('recommend') ? ['Follow the strategic approach outlined above'] : [],
      alternativeApproach: undefined,
      evidenceUsed,
      filesInspected,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };

  } catch (error: any) {
    console.error('[ARCHITECT-AGENT] Failed:', error);
    return {
      success: false,
      guidance: '',
      recommendations: [],
      evidenceUsed,
      filesInspected,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      error: error.message,
    };
  }
}
