import Anthropic from '@anthropic-ai/sdk';
import { platformHealing } from '../platformHealing';
import { knowledge_search, code_search } from '../tools/knowledge';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy-key-for-development",
});

/**
 * I AM (Architect) - Lightweight Agent with Read-Only Tools
 * Upgraded from simple consultation to independent code analysis
 * 
 * Capabilities:
 * - Inspect platform code independently
 * - Search code patterns and snippets
 * - Query historical knowledge
 * - Validate hypotheses with evidence
 * 
 * Security: READ-ONLY access only - no write operations
 */

// Tool definitions for the Architect Agent
const ARCHITECT_TOOLS: Anthropic.Tool[] = [
  {
    name: "readPlatformFile",
    description: "Read a file from the Archetype platform codebase. Use this to inspect actual code, understand implementations, and validate hypotheses about how the system works. READ-ONLY: Cannot modify files.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file from project root (e.g. 'server/routes/auth.ts', 'client/src/App.tsx')"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "code_search",
    description: "Search the code snippet knowledge base for patterns, implementations, and best practices. Use this to find proven solutions and code patterns that have worked before. READ-ONLY: Cannot store new snippets.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language query to search for code snippets (e.g. 'authentication flow', 'error handling pattern')"
        },
        language: {
          type: "string",
          description: "Filter by programming language (e.g. 'typescript', 'javascript', 'python')"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags (e.g. ['react', 'hooks'], ['auth', 'security'])"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)"
        }
      },
      required: []
    }
  },
  {
    name: "knowledge_query",
    description: "Query the knowledge base for historical information, bug fixes, and architectural decisions. Use this to understand past issues, successful solutions, and accumulated wisdom. READ-ONLY: Cannot store new knowledge.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language query (e.g. 'database connection issues', 'authentication bugs')"
        },
        category: {
          type: "string",
          description: "Filter by category (e.g. 'bug-fixes', 'best-practices', 'platform-fixes')"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags (e.g. ['auth', 'security'], ['performance'])"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)"
        }
      },
      required: ["query"]
    }
  }
];

// Tool execution handlers (all read-only)
async function executeArchitectTool(toolName: string, toolInput: any): Promise<string> {
  try {
    switch (toolName) {
      case "readPlatformFile": {
        const content = await platformHealing.readPlatformFile(toolInput.path);
        return `File: ${toolInput.path}\n\n${content}`;
      }
      
      case "code_search": {
        // Read-only mode: no store parameter allowed
        const results = await code_search({
          query: toolInput.query,
          language: toolInput.language,
          tags: toolInput.tags,
          limit: toolInput.limit || 10
        }) as any[];
        
        if (results.length === 0) {
          return "No code snippets found matching the query.";
        }
        
        return `Found ${results.length} code snippet(s):\n\n` + 
          results.map((snippet, i) => 
            `${i + 1}. [${snippet.language}] ${snippet.description}\n` +
            `   Tags: ${snippet.tags.join(', ')}\n` +
            `   Code:\n${snippet.code}\n`
          ).join('\n---\n\n');
      }
      
      case "knowledge_query": {
        const results = await knowledge_search({
          query: toolInput.query,
          category: toolInput.category,
          tags: toolInput.tags,
          limit: toolInput.limit || 10
        });
        
        if (results.length === 0) {
          return "No knowledge entries found matching the query.";
        }
        
        return `Found ${results.length} knowledge entry(s):\n\n` + 
          results.map((entry, i) => 
            `${i + 1}. [${entry.category}] ${entry.topic}\n` +
            `   Content: ${entry.content}\n` +
            `   Tags: ${entry.tags.join(', ')}\n` +
            `   Source: ${entry.source} (confidence: ${entry.confidence})\n` +
            `   Date: ${new Date(entry.timestamp).toLocaleDateString()}\n`
          ).join('\n---\n\n');
      }
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error: any) {
    return `ERROR executing ${toolName}: ${error.message}`;
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
  error?: string;
}

/**
 * Run the Architect Agent with autonomous code analysis capabilities
 * The agent can now inspect code, validate hypotheses, and provide evidence-based guidance
 */
export async function runArchitectAgent(params: ArchitectAgentParams): Promise<ArchitectAgentResult> {
  const { problem, context, previousAttempts, codeSnapshot } = params;
  
  const filesInspected: string[] = [];
  const evidenceUsed: string[] = [];

  try {
    const systemPrompt = `You are I AM (The Architect), an elite architectural consultant with autonomous code analysis capabilities.

Your mission: Break through deadlocks and provide evidence-based architectural guidance.

AVAILABLE TOOLS:
1. readPlatformFile - Inspect actual platform code to understand implementations
2. code_search - Search for code patterns and proven solutions
3. knowledge_query - Query historical knowledge and past solutions

ANALYSIS APPROACH:
1. INSPECT CODE: Use readPlatformFile to examine relevant files
2. SEARCH PATTERNS: Use code_search to find similar implementations
3. QUERY HISTORY: Use knowledge_query to learn from past issues
4. SYNTHESIZE: Combine evidence to provide concrete recommendations

IMPORTANT:
- You have READ-ONLY access - you cannot modify code
- Always cite specific evidence (files, code patterns, knowledge entries)
- Validate hypotheses by inspecting actual code
- Provide actionable, evidence-based recommendations
- Explain WHY previous attempts failed based on evidence`;

    const userPrompt = `SITUATION:
SySop is stuck in an architectural deadlock after multiple failed fix attempts.

PROBLEM:
${problem}

CONTEXT:
${context}

PREVIOUS ATTEMPTS (that failed):
${previousAttempts.map((attempt, i) => `${i + 1}. ${attempt}`).join('\n')}

${codeSnapshot ? `CODE SNAPSHOT:\n${codeSnapshot}\n` : ''}

YOUR TASK:
1. Use your tools to INSPECT relevant code and GATHER EVIDENCE
2. Identify the ROOT CAUSE based on actual code inspection
3. Explain WHY previous attempts failed (with evidence)
4. Provide a DIFFERENT APPROACH backed by code patterns or historical knowledge
5. Give SPECIFIC, ACTIONABLE recommendations with file references

Start by inspecting relevant files or searching for patterns. Think step-by-step.`;

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt }
    ];

    let continueAnalysis = true;
    let analysisRounds = 0;
    const MAX_ROUNDS = 5; // Prevent infinite loops

    while (continueAnalysis && analysisRounds < MAX_ROUNDS) {
      analysisRounds++;
      
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: ARCHITECT_TOOLS,
      });

      // Track tool usage for evidence
      const toolUseCounts = response.content.filter(c => c.type === 'tool_use').length;
      if (toolUseCounts > 0) {
        evidenceUsed.push(`Round ${analysisRounds}: Used ${toolUseCounts} tool(s)`);
      }

      // Check if we have a final answer
      const textContent = response.content.find(c => c.type === 'text');
      if (response.stop_reason === 'end_turn' && textContent) {
        // Agent has finished analysis
        continueAnalysis = false;
        
        // Parse the final guidance
        const guidanceText = textContent.type === 'text' ? textContent.text : '';
        
        // Try to extract structured information
        let parsedGuidance: any = {};
        try {
          const jsonMatch = guidanceText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedGuidance = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          // Use raw text if JSON parsing fails
          parsedGuidance = { guidance: guidanceText };
        }

        return {
          success: true,
          guidance: parsedGuidance.rootCause || parsedGuidance.guidance || guidanceText,
          recommendations: parsedGuidance.recommendations || [],
          alternativeApproach: parsedGuidance.alternativeApproach,
          evidenceUsed,
          filesInspected,
        };
      }

      // Process tool calls
      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.MessageParam = {
          role: "user",
          content: []
        };

        for (const content of response.content) {
          if (content.type === 'tool_use') {
            const toolName = content.name;
            const toolInput = content.input as any;
            
            // Track file inspections
            if (toolName === 'readPlatformFile' && toolInput.path) {
              filesInspected.push(toolInput.path);
            }

            console.log(`[ARCHITECT-AGENT] Executing tool: ${toolName}`);
            const result = await executeArchitectTool(toolName, toolInput);
            
            (toolResults.content as any[]).push({
              type: "tool_result",
              tool_use_id: content.id,
              content: result
            });
          }
        }

        // Add assistant response and tool results to conversation
        messages.push({
          role: "assistant",
          content: response.content
        });
        messages.push(toolResults);
      } else {
        // Unexpected stop reason
        continueAnalysis = false;
      }
    }

    // If we hit max rounds, return what we have
    return {
      success: true,
      guidance: "Analysis incomplete after maximum rounds. Please consult with more specific context.",
      recommendations: ["Break down the problem into smaller pieces", "Provide more specific file paths or error messages"],
      evidenceUsed,
      filesInspected,
    };

  } catch (error: any) {
    console.error('❌ Architect agent failed:', error);
    return {
      success: false,
      guidance: '',
      recommendations: [],
      evidenceUsed,
      filesInspected,
      error: error.message || 'Failed to run architect agent',
    };
  }
}
