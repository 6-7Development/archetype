import { db } from '../db';
import { subAgents, insertSubAgentSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { anthropic, DEFAULT_MODEL } from '../anthropic';

/**
 * Spawn Sub-Agent Tool
 * Delegate specialized work to a sub-agent with full context
 * SECURITY: Input validation
 */
export async function spawnSubAgent(params: {
  userId: string;
  projectId?: string;
  taskId?: string;
  agentType: string;
  task: string;
  context?: any;
  relevantFiles?: string[];
  systemPrompt?: string;
}): Promise<{
  success: boolean;
  subAgentId?: string;
  result?: string;
  error?: string;
}> {
  try {
    // Verify project ownership if projectId provided
    if (params.projectId) {
      const { projects } = await import('@shared/schema');
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, params.projectId), eq(projects.userId, params.userId)))
        .limit(1);

      if (!project) {
        return {
          success: false,
          error: 'Unauthorized: Project does not belong to user',
        };
      }
    }

    // Verify task ownership if taskId provided
    if (params.taskId) {
      const { tasks: tasksTable, taskLists: taskListsTable } = await import('@shared/schema');
      const result = await db
        .select()
        .from(tasksTable)
        .innerJoin(taskListsTable, eq(tasksTable.taskListId, taskListsTable.id))
        .where(and(eq(tasksTable.id, params.taskId), eq(taskListsTable.userId, params.userId)))
        .limit(1);

      if (result.length === 0) {
        return {
          success: false,
          error: 'Unauthorized: Task does not belong to user',
        };
      }
    }

    // Validate agentType enum
    const validAgentTypes = ['architect', 'specialist', 'tester', 'reviewer', 'analyzer'];
    if (!validAgentTypes.includes(params.agentType)) {
      return {
        success: false,
        error: `Invalid agentType: ${params.agentType}`,
      };
    }

    // Validate sub-agent data using schema
    const subAgentData = insertSubAgentSchema.parse({
      userId: params.userId,
      projectId: params.projectId,
      taskId: params.taskId,
      agentType: params.agentType,
      task: params.task,
      context: params.context || {},
      status: 'running',
    });

    // Create sub-agent record
    const subAgentResult = await db
      .insert(subAgents)
      .values(subAgentData)
      .returning();

    if (!subAgentResult || subAgentResult.length === 0) {
      return {
        success: false,
        error: 'Failed to create sub-agent record',
      };
    }

    const subAgent = subAgentResult[0];

    // Execute sub-agent task using Claude with transactional safety
    const systemPrompt =
      params.systemPrompt ||
      `You are a specialized ${params.agentType} sub-agent. Complete the following task precisely and efficiently.`;

    const messages = [
      {
        role: 'user' as const,
        content: `Task: ${params.task}\n\nContext: ${JSON.stringify(params.context, null, 2)}`,
      },
    ];

    try {
      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
      });

      // Validate response structure
      if (!response.content || response.content.length === 0) {
        throw new Error('Claude returned empty response');
      }

      if (!response.usage || response.usage.input_tokens === undefined || response.usage.output_tokens === undefined) {
        throw new Error('Claude response missing token usage data');
      }

      const resultContent =
        response.content[0].type === 'text' ? response.content[0].text : '';

      // Update sub-agent with result (verify ownership)
      const updateResult = await db
        .update(subAgents)
        .set({
          status: 'completed',
          result: resultContent,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          completedAt: new Date(),
        })
        .where(and(eq(subAgents.id, subAgent.id), eq(subAgents.userId, params.userId)))
        .returning();

      if (updateResult.length === 0) {
        throw new Error('Failed to update sub-agent: ownership mismatch');
      }

      return {
        success: true,
        subAgentId: subAgent.id,
        result: resultContent,
      };
    } catch (aiError: any) {
      // Update sub-agent with error (verify ownership)
      try {
        await db
          .update(subAgents)
          .set({
            status: 'failed',
            error: aiError.message,
            completedAt: new Date(),
          })
          .where(and(eq(subAgents.id, subAgent.id), eq(subAgents.userId, params.userId)));
      } catch (updateError) {
        console.error('Failed to update sub-agent error status:', updateError);
      }

      return {
        success: false,
        error: aiError.message,
      };
    }
  } catch (error: any) {
    console.error('Failed to spawn sub-agent:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check Sub-Agent Status Tool
 * Monitor progress of delegated work
 * SECURITY: Verify ownership
 */
export async function checkSubAgentStatus(params: {
  userId: string; // REQUIRED for security
  subAgentId: string;
}): Promise<{
  success: boolean;
  status?: string;
  result?: string;
  error?: string;
}> {
  try {
    const [subAgent] = await db
      .select()
      .from(subAgents)
      .where(eq(subAgents.id, params.subAgentId));

    if (!subAgent) {
      return {
        success: false,
        error: 'Sub-agent not found',
      };
    }

    // Verify ownership
    if (subAgent.userId !== params.userId) {
      return {
        success: false,
        error: 'Unauthorized: Sub-agent does not belong to user',
      };
    }

    return {
      success: true,
      status: subAgent.status,
      result: subAgent.result || undefined,
      error: subAgent.error || undefined,
    };
  } catch (error: any) {
    console.error('Failed to check sub-agent status:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
