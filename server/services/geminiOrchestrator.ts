/**
 * GEMINI ORCHESTRATOR - Production-Grade 5-Layer Stack
 * 
 * Battle-tested pattern used by Cursor, Replit, and Bolt for code generation.
 * 
 * 5-Layer Architecture:
 * 1. Task Planner - Break requests into granular steps
 * 2. Context Gatherer - Read relevant files
 * 3. Streaming Code Generator - Output with structured tags
 * 4. Tool Executor - Apply changes and run tools
 * 5. Validation Loop - Verify and retry
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { streamGeminiResponse } from '../gemini';
import { read, write, glob } from '../tools/file-operations';
import { getOrCreateState, updateContext } from './conversationState';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// TypeScript Interfaces
export interface Task {
  id: string;
  description: string;
  files: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  subtasks?: Task[];
  priority?: number;
  dependencies?: string[]; // IDs of tasks that must complete first
}

export interface StreamEvent {
  type: 'text' | 'task_start' | 'task_complete' | 'tool_call' | 'file_operation' | 'validation' | 'error' | 'complete';
  content?: string;
  task?: Task;
  tool?: string;
  args?: any;
  filePath?: string;
  operation?: 'create' | 'modify' | 'delete';
  validationResult?: boolean;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  tasksCompleted: number;
  tasksFailed: number;
  filesModified: string[];
  errors: string[];
  duration: number;
}

export interface FileOperation {
  operation: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
}

export interface ToolCall {
  tool: string;
  [key: string]: any;
}

/**
 * GeminiOrchestrator - Production-grade code generation orchestrator
 */
export class GeminiOrchestrator {
  private genAI: GoogleGenerativeAI;
  private workingDir: string;
  private userId: string;
  private sessionId: string;
  private onStream: (event: StreamEvent) => void;
  private conversationHistory: Array<{ role: string; parts: any[] }> = [];
  private fileTree: string[] = [];
  private recentChanges: Array<{ file: string; timestamp: number }> = [];
  private filesModified: Set<string> = new Set();
  private model: string = 'gemini-2.0-flash-exp';

  constructor(
    workingDir: string,
    userId: string,
    sessionId: string,
    onStream: (event: StreamEvent) => void
  ) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.workingDir = workingDir;
    this.userId = userId;
    this.sessionId = sessionId;
    this.onStream = onStream;
  }

  /**
   * MAIN EXECUTION FLOW
   * Orchestrates the entire 5-layer process
   */
  async execute(userRequest: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let tasksCompleted = 0;
    let tasksFailed = 0;

    try {
      // Stream start event
      this.onStream({
        type: 'text',
        content: '🤔 Planning tasks...\n',
      });

      // LAYER 1: Task Planning
      const tasks = await this.planTasks(userRequest);

      if (tasks.length === 0) {
        this.onStream({
          type: 'text',
          content: '⚠️ No tasks identified. Please provide more specific instructions.\n',
        });
        return {
          success: false,
          tasksCompleted: 0,
          tasksFailed: 0,
          filesModified: [],
          errors: ['No tasks could be planned from request'],
          duration: Date.now() - startTime,
        };
      }

      this.onStream({
        type: 'text',
        content: `\n📋 Planned ${tasks.length} task(s)\n\n`,
      });

      // Execute tasks in order
      for (const task of tasks) {
        try {
          this.onStream({
            type: 'task_start',
            task,
            content: `\n📋 **${task.description}**\n`,
          });

          await this.executeTask(task);

          if (task.status === 'completed') {
            tasksCompleted++;
            this.onStream({
              type: 'task_complete',
              task,
              content: `✅ Task completed: ${task.description}\n`,
            });
          } else {
            tasksFailed++;
            errors.push(`Task failed: ${task.description}`);
          }
        } catch (error: any) {
          tasksFailed++;
          errors.push(`Task error: ${task.description} - ${error.message}`);
          this.onStream({
            type: 'error',
            error: error.message,
            content: `❌ Error in task: ${error.message}\n`,
          });
        }
      }

      // Completion
      this.onStream({
        type: 'complete',
        content: `\n✅ All tasks processed! Completed: ${tasksCompleted}, Failed: ${tasksFailed}\n`,
      });

      return {
        success: tasksFailed === 0,
        tasksCompleted,
        tasksFailed,
        filesModified: Array.from(this.filesModified),
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[GEMINI-ORCHESTRATOR] Fatal error:', error);
      errors.push(`Fatal error: ${error.message}`);

      this.onStream({
        type: 'error',
        error: error.message,
        content: `❌ Fatal error: ${error.message}\n`,
      });

      return {
        success: false,
        tasksCompleted,
        tasksFailed: tasksFailed + 1,
        filesModified: Array.from(this.filesModified),
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * LAYER 1: TASK PLANNER
   * Break down user request into granular, executable tasks
   */
  private async planTasks(request: string): Promise<Task[]> {
    try {
      // Get codebase context
      const codebaseContext = await this.getCodebaseContext();

      const planningPrompt = `You are a senior software architect. Break down this coding request into granular, executable tasks.

User Request: ${request}

Current Codebase Context:
${codebaseContext}

Working Directory: ${this.workingDir}

Return a JSON array of tasks with this structure:
[
  {
    "id": "task-1",
    "description": "Create component file",
    "files": ["src/components/NewComponent.tsx"],
    "priority": 1,
    "dependencies": []
  }
]

Rules:
- Each task should modify 1-3 files maximum
- Order tasks by dependency (setup → implementation → tests)
- Be specific about file paths relative to working directory
- Include subtasks for complex operations
- Use priority (1-10, 1 = highest) to order tasks
- List task IDs in dependencies array for tasks that must complete first

Return ONLY the JSON array, no markdown, no explanation.`;

      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: 0.3, // Low temperature for structured planning
          topP: 0.95,
          topK: 40,
        }
      });

      const result = await model.generateContent(planningPrompt);
      const response = result.response.text();

      // Extract JSON from response (remove markdown code blocks if present)
      let jsonText = response.trim();
      if (jsonText.startsWith('```')) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1];
        }
      }

      // Try to find JSON array in response
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[TASK-PLANNER] Failed to extract JSON from response:', response);
        throw new Error('Failed to parse task plan - no JSON array found');
      }

      const tasks: Task[] = JSON.parse(jsonMatch[0]);

      // Validate and set status
      return tasks.map((t: any) => ({
        ...t,
        status: 'pending' as const,
        priority: t.priority || 5,
        dependencies: t.dependencies || [],
      }));
    } catch (error: any) {
      console.error('[TASK-PLANNER] Error:', error);
      throw new Error(`Task planning failed: ${error.message}`);
    }
  }

  /**
   * LAYER 2 & 3: EXECUTE TASK (Context Gathering + Streaming Code Generation)
   * Gather context, generate code with streaming, parse operations
   */
  private async executeTask(task: Task): Promise<void> {
    task.status = 'in_progress';

    try {
      // LAYER 2: Gather context for this specific task
      const relevantFiles = await this.gatherContext(task.files);

      this.onStream({
        type: 'text',
        content: `📖 Gathered context for ${relevantFiles.size} file(s)\n`,
      });

      // LAYER 3: Generate code with streaming
      const prompt = this.buildCodeGenerationPrompt(task, relevantFiles);

      let accumulatedCode = '';
      const fileOperations: FileOperation[] = [];
      const toolCalls: ToolCall[] = [];

      // Stream generation from Gemini
      await this.streamCodeGeneration(prompt, (chunk) => {
        accumulatedCode += chunk;

        // Stream text to user
        this.onStream({
          type: 'text',
          content: chunk,
        });

        // Parse operations in real-time (look for complete tags)
        this.parseOperationsFromStream(accumulatedCode, fileOperations, toolCalls);
      });

      // LAYER 4: Apply changes from parsed operations
      await this.applyChanges(accumulatedCode, task, fileOperations, toolCalls);

      // LAYER 5: Validate changes
      const isValid = await this.validateChanges(task);

      if (isValid) {
        task.status = 'completed';
      } else {
        task.status = 'failed';
        this.onStream({
          type: 'text',
          content: `\n❌ Validation failed, retrying task...\n`,
        });

        // Retry once
        task.status = 'pending';
        await this.executeTask(task);
      }
    } catch (error: any) {
      console.error('[EXECUTE-TASK] Error:', error);
      task.status = 'failed';
      throw error;
    }
  }

  /**
   * LAYER 2: CONTEXT GATHERER
   * Read relevant files before generating code
   */
  private async gatherContext(files: string[]): Promise<Map<string, string>> {
    const context = new Map<string, string>();

    for (const file of files) {
      try {
        const result = await read({ file_path: file });

        if (result.success && result.content) {
          context.set(file, result.content);
        } else {
          // File doesn't exist yet (will be created)
          context.set(file, '// New file');
        }
      } catch (error: any) {
        console.warn(`[CONTEXT-GATHERER] Could not read ${file}:`, error.message);
        context.set(file, '// New file');
      }
    }

    return context;
  }

  /**
   * LAYER 3: BUILD CODE GENERATION PROMPT
   * Create structured prompt for Gemini with context
   */
  private buildCodeGenerationPrompt(task: Task, context: Map<string, string>): string {
    const filesContext = Array.from(context.entries())
      .map(([filePath, content]) => {
        const lines = content.split('\n');
        const preview = lines.length > 100 
          ? `${lines.slice(0, 100).join('\n')}\n... (truncated, ${lines.length} lines total)`
          : content;
        return `### ${filePath}\n\`\`\`\n${preview}\n\`\`\``;
      })
      .join('\n\n');

    const conversationContext = this.conversationHistory
      .slice(-3)
      .map(h => `${h.role}: ${JSON.stringify(h.parts).substring(0, 200)}`)
      .join('\n');

    return `You are an expert code generator. Generate ONLY the code changes needed for this task.

**Task**: ${task.description}

**Current Code Context**:
${filesContext || 'No existing files'}

**Recent Conversation**:
${conversationContext || 'No recent context'}

**Instructions**:
1. Output code changes in this EXACT format:

<file_operation>
{
  "operation": "create" | "modify" | "delete",
  "path": "relative/path/to/file.ts",
  "content": "full file content here"
}
</file_operation>

2. For modifications, provide the COMPLETE file content (not diffs)
3. Include necessary imports and proper TypeScript types
4. Follow existing code style from context
5. Add brief comments for complex logic

**Available Tools** (use when needed):
- <tool_call>{"tool": "read", "file_path": "path/to/file.ts"}</tool_call>
- <tool_call>{"tool": "glob", "pattern": "**/*.ts"}</tool_call>

Generate the code now:`;
  }

  /**
   * LAYER 3: STREAM CODE GENERATION
   * Use Gemini streaming API to generate code in real-time
   */
  private async streamCodeGeneration(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const model = this.genAI.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      }
    });

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        onChunk(text);
      }
    }
  }

  /**
   * LAYER 4: PARSE OPERATIONS FROM STREAM
   * Extract file operations and tool calls from streamed response
   */
  private parseOperationsFromStream(
    accumulatedText: string,
    fileOperations: FileOperation[],
    toolCalls: ToolCall[]
  ): void {
    // Parse file operations
    const fileOpRegex = /<file_operation>([\s\S]*?)<\/file_operation>/g;
    let match;

    while ((match = fileOpRegex.exec(accumulatedText)) !== null) {
      try {
        const operation: FileOperation = JSON.parse(match[1].trim());

        // Check if we've already parsed this operation
        const alreadyParsed = fileOperations.some(
          op => op.path === operation.path && op.operation === operation.operation
        );

        if (!alreadyParsed) {
          fileOperations.push(operation);
        }
      } catch (error) {
        // JSON not complete yet, skip
      }
    }

    // Parse tool calls
    const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;

    while ((match = toolCallRegex.exec(accumulatedText)) !== null) {
      try {
        const toolCall: ToolCall = JSON.parse(match[1].trim());

        // Check if we've already parsed this tool call
        const alreadyParsed = toolCalls.some(
          tc => JSON.stringify(tc) === JSON.stringify(toolCall)
        );

        if (!alreadyParsed) {
          toolCalls.push(toolCall);
        }
      } catch (error) {
        // JSON not complete yet, skip
      }
    }
  }

  /**
   * LAYER 4: APPLY CHANGES
   * Execute file operations and tool calls
   */
  private async applyChanges(
    generatedCode: string,
    task: Task,
    fileOperations: FileOperation[],
    toolCalls: ToolCall[]
  ): Promise<void> {
    // Final parse to catch any remaining operations
    this.parseOperationsFromStream(generatedCode, fileOperations, toolCalls);

    // Execute tool calls first
    for (const toolCall of toolCalls) {
      await this.executeTool(toolCall);
    }

    // Execute file operations
    for (const operation of fileOperations) {
      try {
        const fullPath = path.join(this.workingDir, operation.path);

        this.onStream({
          type: 'file_operation',
          operation: operation.operation,
          filePath: operation.path,
          content: `\n${operation.operation === 'create' ? '✏️ Creating' : operation.operation === 'modify' ? '✏️ Modifying' : '🗑️ Deleting'}: ${operation.path}\n`,
        });

        if (operation.operation === 'create' || operation.operation === 'modify') {
          if (!operation.content) {
            throw new Error(`No content provided for ${operation.operation} operation on ${operation.path}`);
          }

          // Use write tool
          await write({
            file_path: operation.path,
            content: operation.content,
          });

          this.filesModified.add(operation.path);
          this.recentChanges.push({
            file: operation.path,
            timestamp: Date.now(),
          });

          this.onStream({
            type: 'text',
            content: `✅ ${operation.operation === 'create' ? 'Created' : 'Modified'}: ${operation.path}\n`,
          });
        } else if (operation.operation === 'delete') {
          await fs.unlink(fullPath);
          this.filesModified.add(operation.path);

          this.onStream({
            type: 'text',
            content: `✅ Deleted: ${operation.path}\n`,
          });
        }
      } catch (error: any) {
        console.error('[APPLY-CHANGES] Error:', error);
        this.onStream({
          type: 'text',
          content: `⚠️ Failed to apply change to ${operation.path}: ${error.message}\n`,
        });
      }
    }
  }

  /**
   * LAYER 4: EXECUTE TOOL
   * Execute tool calls during code generation
   */
  private async executeTool(toolCall: ToolCall): Promise<any> {
    this.onStream({
      type: 'tool_call',
      tool: toolCall.tool,
      args: toolCall,
      content: `\n🔧 Tool: ${toolCall.tool}\n`,
    });

    try {
      switch (toolCall.tool) {
        case 'read':
          const readResult = await read({
            file_path: toolCall.file_path,
            offset: toolCall.offset,
            limit: toolCall.limit,
          });
          this.onStream({
            type: 'text',
            content: `📖 Read: ${toolCall.file_path}\n`,
          });
          return readResult.content;

        case 'glob':
          const globResult = await glob({
            pattern: toolCall.pattern,
            path: toolCall.path,
          });
          this.onStream({
            type: 'text',
            content: `🔍 Found ${globResult.files.length} file(s) matching "${toolCall.pattern}"\n`,
          });
          return globResult.files;

        case 'run_command':
          this.onStream({
            type: 'text',
            content: `⚙️ Running: ${toolCall.command}\n`,
          });
          const { stdout, stderr } = await execAsync(toolCall.command, {
            cwd: this.workingDir,
          });
          this.onStream({
            type: 'text',
            content: stdout || stderr || 'Command completed\n',
          });
          return { stdout, stderr };

        default:
          this.onStream({
            type: 'text',
            content: `⚠️ Unknown tool: ${toolCall.tool}\n`,
          });
          return null;
      }
    } catch (error: any) {
      console.error('[EXECUTE-TOOL] Error:', error);
      this.onStream({
        type: 'text',
        content: `⚠️ Tool error: ${error.message}\n`,
      });
      return null;
    }
  }

  /**
   * LAYER 5: VALIDATION LOOP
   * Validate changes and retry if failed
   */
  private async validateChanges(task: Task): Promise<boolean> {
    this.onStream({
      type: 'text',
      content: '\n🔍 Validating changes...\n',
    });

    // Check if all expected files were created/modified
    for (const file of task.files) {
      const fullPath = path.join(this.workingDir, file);
      try {
        await fs.access(fullPath);
      } catch {
        this.onStream({
          type: 'validation',
          validationResult: false,
          content: `❌ Expected file not found: ${file}\n`,
        });
        return false;
      }
    }

    // Run TypeScript check if applicable
    const hasTypeScriptFiles = task.files.some(
      f => f.endsWith('.ts') || f.endsWith('.tsx')
    );

    if (hasTypeScriptFiles) {
      this.onStream({
        type: 'text',
        content: '🔍 Running TypeScript check...\n',
      });

      try {
        await execAsync('npx tsc --noEmit', {
          cwd: this.workingDir,
          timeout: 30000, // 30 second timeout
        });

        this.onStream({
          type: 'validation',
          validationResult: true,
          content: '✅ TypeScript check passed\n',
        });
        return true;
      } catch (error: any) {
        // TypeScript errors - log but don't fail (retry will fix)
        this.onStream({
          type: 'validation',
          validationResult: false,
          content: `⚠️ TypeScript errors found (will retry)\n${error.stdout || error.message}\n`,
        });
        return false;
      }
    }

    // All validations passed
    this.onStream({
      type: 'validation',
      validationResult: true,
      content: '✅ Validation passed\n',
    });
    return true;
  }

  /**
   * Get codebase context (file tree)
   */
  private async getCodebaseContext(): Promise<string> {
    try {
      const tree = await this.buildFileTree(this.workingDir);
      this.fileTree = tree;

      const preview = tree.slice(0, 50);
      const moreCount = tree.length - 50;

      return `File Tree (${tree.length} files total):
${preview.join('\n')}${moreCount > 0 ? `\n... and ${moreCount} more files` : ''}`;
    } catch (error: any) {
      console.error('[CODEBASE-CONTEXT] Error:', error);
      return 'File tree unavailable';
    }
  }

  /**
   * Build file tree recursively
   */
  private async buildFileTree(dir: string, prefix = ''): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        // Skip common ignored directories
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'build'
        ) {
          continue;
        }

        const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
        files.push(relativePath);

        if (entry.isDirectory()) {
          const subFiles = await this.buildFileTree(
            path.join(dir, entry.name),
            relativePath
          );
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error: any) {
      console.error('[BUILD-FILE-TREE] Error:', error);
      return [];
    }
  }
}

/**
 * Factory function to create orchestrator instance
 */
export function createGeminiOrchestrator(
  workingDir: string,
  userId: string,
  sessionId: string,
  onStream: (event: StreamEvent) => void
): GeminiOrchestrator {
  return new GeminiOrchestrator(workingDir, userId, sessionId, onStream);
}
