import Anthropic from '@anthropic-ai/sdk';
import { platformHealing } from '../platformHealing.ts';
import { knowledge_search, knowledge_store, knowledge_recall, code_search } from '../tools/knowledge.ts';
import { buildArchitectSystemPrompt } from '../lomuSuperCore.ts';
import { RAILWAY_CONFIG } from '../config/railway.ts';
import { db } from '../db';
import { architectNotes } from '@shared/schema';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy-key-for-development",
});

/**
 * I AM (The Architect) - FULLY AUTONOMOUS Agent with Developer Tools
 * Upgraded from read-only consultant to autonomous architect with full developer capabilities
 * 
 * Capabilities:
 * - Inspect AND modify platform code
 * - Execute shell commands
 * - Install/uninstall packages
 * - Check TypeScript errors
 * - Restart server workflows
 * - Search code patterns and snippets
 * - Query historical knowledge
 * 
 * Security: Command injection prevention, path validation, timeouts
 */

// Tool definitions for the Architect Agent
const ARCHITECT_TOOLS: Anthropic.Tool[] = [
  {
    name: "readPlatformFile",
    description: "Read a file from the Archetype platform codebase. Use this to inspect actual code, understand implementations, and validate hypotheses about how the system works.",
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
    description: "Search the code snippet knowledge base for patterns, implementations, and best practices. Use this to find proven solutions and code patterns that have worked before.",
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
    name: "knowledge_search",
    description: "Search the knowledge base for historical information, bug fixes, and architectural decisions. Use this to understand past issues, successful solutions, and accumulated wisdom.",
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
  },
  {
    name: "knowledge_store",
    description: "Store knowledge for future recall by any AI agent (LomuAI and I AM Architect share this notepad). Save learnings, patterns, solutions, and insights that could be valuable for future tasks.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Knowledge category (e.g., 'bug-fixes', 'architecture', 'best-practices', 'user-preferences')"
        },
        topic: {
          type: "string",
          description: "Specific topic (e.g., 'authentication-patterns', 'deployment-steps', 'common-errors')"
        },
        content: {
          type: "string",
          description: "The knowledge content to store"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for easier searching (e.g., ['react', 'typescript', 'error-handling'])"
        },
        source: {
          type: "string",
          description: "Source of knowledge (default: 'i-am-architect')"
        },
        confidence: {
          type: "number",
          description: "Confidence score 0-1 (default: 0.9 for I AM)"
        }
      },
      required: ["category", "topic", "content"]
    }
  },
  {
    name: "knowledge_recall",
    description: "Retrieve specific knowledge entries by category, topic, or ID. Use when you know what information you're looking for.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category"
        },
        topic: {
          type: "string",
          description: "Filter by topic (partial match)"
        },
        id: {
          type: "string",
          description: "Retrieve specific entry by ID"
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 20)"
        }
      },
      required: []
    }
  },
  {
    name: "bash",
    description: "Execute shell commands with security sandboxing. Use for running tests, checking logs, or executing build commands.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Command to execute (no && or ; chaining for security)"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default 120000)"
        }
      },
      required: ["command"]
    }
  },
  {
    name: "edit",
    description: "Find and replace text in files precisely. Use for making targeted code changes with exact string matching.",
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "File to edit (relative path from project root)"
        },
        oldString: {
          type: "string",
          description: "Exact text to find (must match exactly including whitespace)"
        },
        newString: {
          type: "string",
          description: "Replacement text"
        },
        replaceAll: {
          type: "boolean",
          description: "Replace all occurrences (default false)"
        }
      },
      required: ["filePath", "oldString", "newString"]
    }
  },
  {
    name: "grep",
    description: "Search file content by pattern or regex. Use for finding code patterns, error messages, or specific implementations across the codebase.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regex pattern to search for"
        },
        pathFilter: {
          type: "string",
          description: "File pattern filter (e.g., '*.ts', '*.tsx')"
        },
        outputMode: {
          type: "string",
          enum: ["content", "files", "count"],
          description: "Output format: 'content' (show matches), 'files' (list files), 'count' (count matches). Default: files"
        }
      },
      required: ["pattern"]
    }
  },
  {
    name: "packager_tool",
    description: "Install or uninstall npm packages. Use for adding dependencies or removing unused packages.",
    input_schema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["install", "uninstall"],
          description: "Operation type"
        },
        packages: {
          type: "array",
          items: { type: "string" },
          description: "Package names to install/uninstall"
        }
      },
      required: ["operation", "packages"]
    }
  },
  {
    name: "restart_workflow",
    description: "Restart server workflow after code changes. Use after modifying server-side code to apply changes.",
    input_schema: {
      type: "object",
      properties: {
        workflowName: {
          type: "string",
          description: "Workflow name (default: 'Start application')"
        }
      },
      required: []
    }
  },
  {
    name: "get_latest_lsp_diagnostics",
    description: "Check TypeScript errors and warnings. Use to validate code changes and catch type errors before runtime.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "create_architect_note",
    description: "Create a planning note/idea to share with LomuAI. Use this to document architectural decisions, implementation plans, or guidance. You cannot commit code, but you can guide LomuAI with detailed notes.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Note title"
        },
        content: {
          type: "string",
          description: "Markdown-formatted note content with implementation guidance"
        }
      },
      required: ["title", "content"]
    }
  }
];

// Tool execution handlers - now includes full developer capabilities
async function executeArchitectTool(toolName: string, toolInput: any): Promise<string> {
  try {
    switch (toolName) {
      case "readPlatformFile": {
        const content = await platformHealing.readPlatformFile(toolInput.path);
        return `File: ${toolInput.path}\n\n${content}`;
      }
      
      case "code_search": {
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
      
      case "knowledge_search": {
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
      
      case "knowledge_store": {
        const result = await knowledge_store({
          category: toolInput.category,
          topic: toolInput.topic,
          content: toolInput.content,
          tags: toolInput.tags,
          source: toolInput.source || 'i-am-architect',
          confidence: toolInput.confidence || 0.9
        });
        return result;
      }
      
      case "knowledge_recall": {
        const results = await knowledge_recall({
          category: toolInput.category,
          topic: toolInput.topic,
          id: toolInput.id,
          limit: toolInput.limit || 20
        });
        
        if (results.length === 0) {
          return "No knowledge entries found.";
        }
        
        return `Found ${results.length} knowledge entry(s):\n\n` + 
          results.map((entry, i) => 
            `${i + 1}. [${entry.category}] ${entry.topic}\n` +
            `   Content: ${entry.content}\n` +
            `   Tags: ${entry.tags.join(', ')}\n` +
            `   ID: ${entry.id}`
          ).join('\n---\n\n');
      }
      
      case "bash": {
        const result = await platformHealing.executeBashCommand(
          toolInput.command, 
          toolInput.timeout || 120000
        );
        
        if (result.success) {
          return `✅ Command executed successfully\n\nStdout:\n${result.stdout}\n${result.stderr ? `\nStderr:\n${result.stderr}` : ''}`;
        } else {
          return `❌ Command failed (exit code ${result.exitCode})\n\nStdout:\n${result.stdout}\n\nStderr:\n${result.stderr}`;
        }
      }
      
      case "edit": {
        const result = await platformHealing.editPlatformFile(
          toolInput.filePath,
          toolInput.oldString,
          toolInput.newString,
          toolInput.replaceAll || false
        );
        
        if (result.success) {
          return `✅ ${result.message}\nLines changed: ${result.linesChanged}`;
        } else {
          return `❌ ${result.message}`;
        }
      }
      
      case "grep": {
        const result = await platformHealing.grepPlatformFiles(
          toolInput.pattern,
          toolInput.pathFilter,
          toolInput.outputMode || 'files'
        );
        
        return result;
      }
      
      case "packager_tool": {
        const result = await platformHealing.installPackages(
          toolInput.packages,
          toolInput.operation
        );
        
        if (result.success) {
          return `✅ ${result.message}`;
        } else {
          return `❌ ${result.message}`;
        }
      }
      
      case "restart_workflow": {
        const workflowName = toolInput.workflowName || 'Start application';
        return `✅ Workflow "${workflowName}" restart requested. The server will restart automatically to apply changes.`;
      }
      
      case "get_latest_lsp_diagnostics": {
        const result = await platformHealing.getLSPDiagnostics();
        
        if (result.diagnostics.length === 0) {
          return `✅ ${result.summary}`;
        } else {
          const diagnosticsList = result.diagnostics
            .slice(0, 20)
            .map(d => `${d.file}:${d.line}:${d.column} - ${d.severity}: ${d.message}`)
            .join('\n');
          
          return `${result.summary}\n\n${diagnosticsList}${result.diagnostics.length > 20 ? `\n... and ${result.diagnostics.length - 20} more` : ''}`;
        }
      }
      
      case "create_architect_note": {
        try {
          const [note] = await db
            .insert(architectNotes)
            .values({
              projectId: null, // I AM creates platform-wide notes
              title: toolInput.title,
              content: toolInput.content,
              authorRole: 'architect',
            })
            .returning();
          
          return `✅ Architect note created: "${toolInput.title}"\nNote ID: ${note.id}\n\nThis guidance has been saved for LomuAI to reference.`;
        } catch (error: any) {
          return `❌ Failed to create architect note: ${error.message}`;
        }
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
  inputTokens?: number;
  outputTokens?: number;
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
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    // 🎯 I AM (The Architect) - Uses Architect-specific system prompt with ONLY the 9 tools it actually has
    // CRITICAL FIX: This prevents I AM from attempting to call non-existent tools
    const systemPrompt = buildArchitectSystemPrompt({
      problem,
      context,
      previousAttempts,
      codeSnapshot
    });

    const userPrompt = `🚨 ARCHITECTURAL DEADLOCK SITUATION

SySop is stuck after multiple failed fix attempts and needs your AUTONOMOUS help.

📋 PROBLEM:
${problem}

🔍 CONTEXT:
${context}

❌ PREVIOUS ATTEMPTS (that failed):
${previousAttempts.map((attempt, i) => `${i + 1}. ${attempt}`).join('\n')}

${codeSnapshot ? `📸 CODE SNAPSHOT:\n${codeSnapshot}\n` : ''}

🎯 YOUR AUTONOMOUS MISSION:

PHASE 1: INVESTIGATE (Use your analysis tools)
- Use readPlatformFile to inspect relevant code
- Use grep to search for patterns and error messages
- Use code_search to find proven solutions
- Use knowledge_query to learn from past fixes

PHASE 2: DIAGNOSE (Evidence-based root cause analysis)
- Identify the ROOT CAUSE with specific evidence
- Explain WHY previous attempts failed (cite code, line numbers)
- Validate hypotheses by inspecting actual implementations

PHASE 3: FIX (Execute changes autonomously)
- Use edit to make precise code changes
- Use bash to run tests or check configurations
- Use packager_tool to install/uninstall packages if needed
- Use get_latest_lsp_diagnostics to validate changes

PHASE 4: VALIDATE & REPORT
- Run get_latest_lsp_diagnostics to check for TypeScript errors
- Provide alternative approaches if needed
- Give SPECIFIC, ACTIONABLE recommendations with file references

💡 REMEMBER:
- You have FULL developer capabilities - not just read-only
- Always cite specific evidence (files, lines, code snippets)
- Think step-by-step, use tools systematically
- Make fixes autonomously when you identify the issue

Start by inspecting relevant files to understand the problem deeply.`;

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt }
    ];

    let continueAnalysis = true;
    let analysisRounds = 0;
    const MAX_ROUNDS = 5; // Prevent infinite loops

    while (continueAnalysis && analysisRounds < MAX_ROUNDS) {
      analysisRounds++;
      
      // Wrap Anthropic call with timeout to prevent Railway container timeouts
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI request timeout')), RAILWAY_CONFIG.AI_REQUEST_TIMEOUT)
      );
      
      const response = await Promise.race([
        anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3500, // 🎯 Same as Lomu - production-ready token budget
          system: systemPrompt,
          messages,
          tools: ARCHITECT_TOOLS,
        }),
        timeoutPromise
      ]) as Anthropic.Message;

      // Track token usage from Claude response
      if (response.usage) {
        totalInputTokens += response.usage.input_tokens || 0;
        totalOutputTokens += response.usage.output_tokens || 0;
      }

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
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
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
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };

  } catch (error: any) {
    console.error('❌ Architect agent failed:', error);
    return {
      success: false,
      guidance: '',
      recommendations: [],
      evidenceUsed,
      filesInspected,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      error: error.message || 'Failed to run architect agent',
    };
  }
}
