import { db } from '../db';
import { architectReviews, insertArchitectReviewSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { anthropic, DEFAULT_MODEL } from '../anthropic';

/**
 * Request Architect Review Tool
 * Get proactive feedback and improvement suggestions
 * Not just when stuck - architect can review any work and suggest better approaches
 */
export async function requestArchitectReview(params: {
  userId: string;
  projectId?: string;
  taskId?: string;
  taskListId?: string;
  reviewType: 'proactive' | 'requested' | 'post_completion';
  workDescription: string;
  codeChanges?: string;
  currentApproach?: string;
  constraints?: string[];
}): Promise<{
  success: boolean;
  reviewId?: string;
  findings?: string;
  severity?: string;
  suggestions?: string[];
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

    // Verify task list ownership if taskListId provided
    if (params.taskListId) {
      const { taskLists: taskListsTable } = await import('@shared/schema');
      const [taskList] = await db
        .select()
        .from(taskListsTable)
        .where(and(eq(taskListsTable.id, params.taskListId), eq(taskListsTable.userId, params.userId)))
        .limit(1);

      if (!taskList) {
        return {
          success: false,
          error: 'Unauthorized: Task list does not belong to user',
        };
      }
    }
    // Build architect prompt
    const architectPrompt = `
You are "The Architect" - an expert software architect providing proactive code review and improvement suggestions.

REVIEW TYPE: ${params.reviewType}

WORK DESCRIPTION:
${params.workDescription}

${params.currentApproach ? `CURRENT APPROACH:\n${params.currentApproach}\n` : ''}

${params.codeChanges ? `CODE CHANGES:\n${params.codeChanges}\n` : ''}

${params.constraints ? `CONSTRAINTS:\n${params.constraints.join('\n')}\n` : ''}

INSTRUCTIONS:
1. Review the work for correctness, best practices, and potential improvements
2. Suggest better approaches if you see opportunities (ONLY if they don't break the app)
3. Look for:
   - Security vulnerabilities
   - Performance issues
   - Code maintainability
   - Best practices violations
   - Better architectural patterns
4. Be constructive and specific
5. Prioritize suggestions by severity (critical, warning, info)

Provide your review in the following JSON format:
{
  "severity": "critical|warning|info",
  "findings": "Overall assessment and key issues found",
  "suggestions": ["Specific suggestion 1", "Specific suggestion 2", ...]
}
`;

    // Call Claude as The Architect
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system: architectPrompt,
      messages: [
        {
          role: 'user',
          content: 'Please review this work and provide your findings.',
        },
      ],
    });

    const resultText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse architect response
    let architectResponse: any;
    try {
      // Try to extract JSON from response
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        architectResponse = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        architectResponse = {
          severity: 'info',
          findings: resultText,
          suggestions: [],
        };
      }
    } catch (parseError) {
      architectResponse = {
        severity: 'info',
        findings: resultText,
        suggestions: [],
      };
    }

    // Save review to database
    const [review] = await db
      .insert(architectReviews)
      .values({
        userId: params.userId,
        projectId: params.projectId,
        taskId: params.taskId,
        taskListId: params.taskListId,
        reviewType: params.reviewType,
        findings: architectResponse.findings,
        severity: architectResponse.severity,
        status: 'pending',
      })
      .returning();

    return {
      success: true,
      reviewId: review.id,
      findings: architectResponse.findings,
      severity: architectResponse.severity,
      suggestions: architectResponse.suggestions || [],
    };
  } catch (error: any) {
    console.error('Failed to request architect review:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
