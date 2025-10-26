import Anthropic from '@anthropic-ai/sdk';
import { platformHealing } from './platformHealing';

interface SubagentParams {
  task: string;
  relevantFiles: string[];
  userId: string;
  sendEvent: (type: string, data: any) => void;
}

interface SubagentResult {
  success: boolean;
  summary: string;
  filesModified: string[];
  error?: string;
}

export async function startSubagent(params: SubagentParams): Promise<SubagentResult> {
  const { task, relevantFiles, userId, sendEvent } = params;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('Anthropic API key not configured');
  }

  sendEvent('progress', { message: `🤖 Sub-agent started: ${task.slice(0, 60)}...` });

  const systemPrompt = `You are a specialized sub-agent working autonomously on a specific task.

🎯 YOUR MISSION:
${task}

📂 RELEVANT FILES:
${relevantFiles.map(f => `- ${f}`).join('\n')}

🔧 YOUR CAPABILITIES:
You have access to these tools:
- readPlatformFile: Read source files
- writePlatformFile: Modify files (you have pre-approval for the task)
- listPlatformFiles: Browse directories

⚠️ CONSTRAINTS:
- You are a WORKER, not an orchestrator
- Focus ONLY on the assigned task
- Complete the work efficiently
- Report a summary of what you accomplished
- You have approval to modify files related to your task

🎯 WORKFLOW:
1. Read relevant files to understand current state
2. Make necessary modifications
3. Verify your changes are correct
4. Report summary of work completed

DO NOT:
- Try to orchestrate or delegate
- Work on tasks outside your scope
- Ask for approval (you have it)
- Create new tasks

EXECUTE NOW - Complete your assigned task!`;

  const client = new Anthropic({ apiKey: anthropicKey });
  const conversationMessages: any[] = [
    {
      role: 'user',
      content: `Begin work on your assigned task. Read the relevant files and make the necessary changes.`,
    },
  ];

  const tools = [
    {
      name: 'readPlatformFile',
      description: 'Read a platform source file',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string' as const, description: 'File path relative to project root' },
        },
        required: ['path'],
      },
    },
    {
      name: 'writePlatformFile',
      description: 'Write content to a platform file (you have approval for task-related files)',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string' as const, description: 'File path relative to project root' },
          content: { type: 'string' as const, description: 'New file content' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'listPlatformFiles',
      description: 'List files in a directory',
      input_schema: {
        type: 'object' as const,
        properties: {
          directory: { type: 'string' as const, description: 'Directory path' },
        },
        required: ['directory'],
      },
    },
    {
      name: 'report_completion',
      description: 'Report task completion with summary of work done',
      input_schema: {
        type: 'object' as const,
        properties: {
          summary: { 
            type: 'string' as const, 
            description: 'Detailed summary of work completed, files modified, and changes made' 
          },
          filesModified: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'List of file paths that were modified',
          },
        },
        required: ['summary', 'filesModified'],
      },
    },
  ];

  const filesModified: string[] = [];
  let finalSummary = '';
  let continueLoop = true;
  let iterationCount = 0;
  const MAX_ITERATIONS = 8;

  while (continueLoop && iterationCount < MAX_ITERATIONS) {
    iterationCount++;

    sendEvent('progress', { message: `🤖 Sub-agent working (iteration ${iterationCount}/${MAX_ITERATIONS})...` });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: conversationMessages,
      tools,
      stream: false,
    });

    conversationMessages.push({
      role: 'assistant',
      content: response.content,
    });

    const toolResults: any[] = [];
    const hasToolUse = response.content.some(block => block.type === 'tool_use');

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const { name, input, id } = block;

        try {
          let toolResult: any = null;

          if (name === 'readPlatformFile') {
            const typedInput = input as { path: string };
            sendEvent('progress', { message: `📖 Sub-agent reading ${typedInput.path}...` });
            toolResult = await platformHealing.readPlatformFile(typedInput.path);
          } else if (name === 'writePlatformFile') {
            const typedInput = input as { path: string; content: string };

            if (!typedInput.content || typeof typedInput.content !== 'string') {
              throw new Error(`Invalid content for ${typedInput.path}`);
            }

            sendEvent('progress', { message: `✏️ Sub-agent modifying ${typedInput.path}...` });
            const writeResult = await platformHealing.writePlatformFile(
              typedInput.path,
              typedInput.content
            );
            toolResult = JSON.stringify(writeResult);

            // Track modified files
            if (!filesModified.includes(typedInput.path)) {
              filesModified.push(typedInput.path);
            }

            sendEvent('progress', { message: `✅ Modified ${typedInput.path}` });
          } else if (name === 'listPlatformFiles') {
            const typedInput = input as { directory: string };
            sendEvent('progress', { message: `📂 Sub-agent listing ${typedInput.directory}...` });
            const files = await platformHealing.listPlatformFiles(typedInput.directory);
            toolResult = files.join('\n');
          } else if (name === 'report_completion') {
            const typedInput = input as { summary: string; filesModified: string[] };
            finalSummary = typedInput.summary;
            
            // Merge reported files with tracked files
            typedInput.filesModified.forEach(file => {
              if (!filesModified.includes(file)) {
                filesModified.push(file);
              }
            });

            sendEvent('progress', { message: '✅ Sub-agent completed task' });
            toolResult = '✅ Task completion reported. Sub-agent work is done.';
            continueLoop = false;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: id,
            content: toolResult || 'Success',
          });
        } catch (error: any) {
          console.error(`[SUBAGENT] Tool ${name} failed:`, error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: id,
            is_error: true,
            content: `Error in ${name}: ${error.message}`,
          });
        }
      }
    }

    if (toolResults.length > 0) {
      conversationMessages.push({
        role: 'user',
        content: toolResults,
      });
    } else {
      // No tools called, end loop
      continueLoop = false;
    }
  }

  // If sub-agent didn't report completion, extract summary from final message
  if (!finalSummary) {
    const lastAssistantMessage = conversationMessages
      .reverse()
      .find((msg: any) => msg.role === 'assistant');

    if (lastAssistantMessage) {
      const textBlocks = lastAssistantMessage.content.filter((block: any) => block.type === 'text');
      if (textBlocks.length > 0) {
        finalSummary = textBlocks.map((block: any) => block.text).join('\n\n');
      }
    }
  }

  if (!finalSummary) {
    finalSummary = `Sub-agent completed ${filesModified.length} file modifications`;
  }

  sendEvent('progress', { message: `✅ Sub-agent finished: ${filesModified.length} files modified` });

  return {
    success: true,
    summary: finalSummary,
    filesModified,
  };
}
