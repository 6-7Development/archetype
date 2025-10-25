// Core tool exports - all verified and working
export { executeBrowserTest } from './browser-test';
export { executeWebSearch, searchDocumentation, searchCodeExamples } from './web-search';
export { executeVisionAnalysis, analyzeUIScreenshot, compareDesignToImplementation } from './vision-analyze';
export { consultArchitect } from './architect-consult';
export { performDiagnosis } from './diagnosis';
export { executePlatformRead, executePlatformWrite, executePlatformList } from './platform-tools';
export { executeProjectList, executeProjectRead, executeProjectWrite, executeProjectDelete } from './project-tools';
export { createTaskList, updateTask, readTaskList } from './task-management';
export { spawnSubAgent, checkSubAgentStatus } from './sub-agent';
export { requestArchitectReview } from './architect-review';

/**
 * Tool definitions for Claude
 * These tools enhance SySop's autonomous capabilities
 */
export const SYSOP_TOOLS = [
  {
    name: 'browser_test',
    description: 'Test the generated code in a real browser using Playwright. Verify UI functionality, run assertions, and capture screenshots.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to test (e.g., http://localhost:5000)',
        },
        actions: {
          type: 'array',
          description: 'List of actions to perform in the browser',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['click', 'type', 'navigate', 'screenshot', 'evaluate'],
                description: 'Type of action to perform',
              },
              selector: {
                type: 'string',
                description: 'CSS selector for the element (for click, type)',
              },
              text: {
                type: 'string',
                description: 'Text to type or URL to navigate to',
              },
              code: {
                type: 'string',
                description: 'JavaScript code to evaluate in the browser',
              },
            },
            required: ['type'],
          },
        },
        assertions: {
          type: 'array',
          description: 'Assertions to verify expected behavior',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['exists', 'visible', 'text', 'count'],
                description: 'Type of assertion',
              },
              selector: {
                type: 'string',
                description: 'CSS selector for the element',
              },
              expected: {
                type: ['string', 'number'],
                description: 'Expected value',
              },
            },
            required: ['type', 'selector'],
          },
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for real-time information, documentation, code examples, and best practices. Use this to look up APIs, frameworks, or current best practices.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
        includeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific domains to search (e.g., ["github.com", "stackoverflow.com"])',
        },
        excludeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Domains to exclude from search',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'vision_analyze',
    description: 'Analyze images using Claude Vision. Can analyze UI screenshots, design mockups, diagrams, or any visual content.',
    input_schema: {
      type: 'object',
      properties: {
        imageBase64: {
          type: 'string',
          description: 'Base64 encoded image data',
        },
        imageMediaType: {
          type: 'string',
          enum: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          description: 'Media type of the image',
        },
        prompt: {
          type: 'string',
          description: 'What to analyze or look for in the image',
        },
      },
      required: ['imageBase64', 'imageMediaType', 'prompt'],
    },
  },
  {
    name: 'architect_consult',
    description: 'Consult "I AM" (The Architect) when stuck in a bug loop or architectural deadlock. Use this after 3+ failed fix attempts to get expert guidance on a different approach.',
    input_schema: {
      type: 'object',
      properties: {
        problem: {
          type: 'string',
          description: 'Clear description of the problem you are stuck on',
        },
        context: {
          type: 'string',
          description: 'Relevant context about the project, tech stack, and constraints',
        },
        previousAttempts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of approaches you already tried that failed',
        },
        codeSnapshot: {
          type: 'string',
          description: 'Optional code snippet showing the problematic area',
        },
      },
      required: ['problem', 'context', 'previousAttempts'],
    },
  },
  {
    name: 'perform_diagnosis',
    description: 'Diagnose performance, security, memory, or database issues by analyzing actual code. Returns evidence-based findings with real metrics (file sizes, pattern counts, actual code issues). Use this to verify claims with concrete data instead of theoretical diagnosis.',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['performance', 'security', 'memory', 'database', 'all'],
          description: 'Type of diagnosis to perform. Use "all" for comprehensive analysis.',
        },
        focus: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: specific files to analyze (e.g., ["server/routes.ts"]). If not provided, analyzes common files.',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'read_platform_file',
    description: 'Read Archetype platform source code files. Use this when the user asks to fix/modify the platform itself (not their project). Example: "Fix the dashboard layout" or "The preview is broken".',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to platform root (e.g., "client/src/pages/dashboard.tsx", "server/routes.ts")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_platform_file',
    description: 'Modify Archetype platform source code. Use when user requests platform changes. ALWAYS create a backup first. Example: "Update the header design" or "Fix the login bug".',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to platform root',
        },
        content: {
          type: 'string',
          description: 'Complete new file content',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_platform_files',
    description: 'List Archetype platform source files in a directory. Use when exploring platform code structure.',
    input_schema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path (e.g., "client/src/pages", "server")',
        },
      },
      required: ['directory'],
    },
  },
  // Project File Tools (for user projects)
  {
    name: 'list_project_files',
    description: 'List all files in the user\'s project. Use this to see what files exist before reading or modifying them.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID from the current context',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'read_project_file',
    description: 'Read a file from the user\'s project. Use this to see current code before making changes.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID from the current context',
        },
        filename: {
          type: 'string',
          description: 'File name to read (e.g., "App.tsx", "server.js")',
        },
      },
      required: ['projectId', 'filename'],
    },
  },
  {
    name: 'write_project_file',
    description: 'Create or update a file in the user\'s project. Use this to add features or fix bugs.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID from the current context',
        },
        filename: {
          type: 'string',
          description: 'File name to write (e.g., "App.tsx", "server.js")',
        },
        content: {
          type: 'string',
          description: 'Complete file content',
        },
        language: {
          type: 'string',
          description: 'Programming language (e.g., "typescript", "javascript", "python")',
        },
      },
      required: ['projectId', 'filename', 'content'],
    },
  },
  {
    name: 'delete_project_file',
    description: 'Delete a file from the user\'s project. Use with caution.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID from the current context',
        },
        filename: {
          type: 'string',
          description: 'File name to delete',
        },
      },
      required: ['projectId', 'filename'],
    },
  },
  // Task Management Tools
  {
    name: 'create_task_list',
    description: 'Break down complex user requests into a task list with manageable steps. Use this at the start of any non-trivial work to organize and track progress. Creates a visible task list in the chat interface.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the task list (e.g., "Build Authentication System")',
        },
        description: {
          type: 'string',
          description: 'Overall description of the work to be done',
        },
        tasks: {
          type: 'array',
          description: 'Array of individual tasks',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Task title',
              },
              description: {
                type: 'string',
                description: 'Detailed task description',
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress'],
                description: 'Initial status (default: pending, use in_progress for first task)',
              },
            },
            required: ['title'],
          },
        },
      },
      required: ['title', 'tasks'],
    },
  },
  {
    name: 'update_task',
    description: 'Update task status and progress. Mark tasks as in_progress, completed_pending_review, or completed. ALWAYS mark tasks completed immediately after finishing work.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to update',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed_pending_review', 'completed', 'cancelled'],
          description: 'New task status',
        },
        architectReviewed: {
          type: 'string',
          enum: ['yes', 'no', 'not_applicable'],
          description: 'Whether architect has reviewed this task',
        },
        architectReviewReason: {
          type: 'string',
          description: 'Reason for architect review status',
        },
        result: {
          type: 'string',
          description: 'Result summary',
        },
        error: {
          type: 'string',
          description: 'Error message if task failed',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'read_task_list',
    description: 'Get current task list and task statuses. Use this to check progress.',
    input_schema: {
      type: 'object',
      properties: {
        taskListId: {
          type: 'string',
          description: 'Specific task list ID to read',
        },
      },
    },
  },
  // Sub-Agent Delegation Tools
  {
    name: 'spawn_sub_agent',
    description: 'Delegate specialized work to a sub-agent. Use this for parallel execution, specialized analysis, or isolated tasks. Sub-agents are autonomous and will complete the work independently.',
    input_schema: {
      type: 'object',
      properties: {
        agentType: {
          type: 'string',
          enum: ['architect', 'specialist', 'tester', 'reviewer', 'analyzer'],
          description: 'Type of sub-agent to spawn',
        },
        task: {
          type: 'string',
          description: 'Clear, specific task for the sub-agent to complete',
        },
        context: {
          type: 'object',
          description: 'Relevant context and data for the sub-agent',
        },
        systemPrompt: {
          type: 'string',
          description: 'Optional custom system prompt for the sub-agent',
        },
      },
      required: ['agentType', 'task'],
    },
  },
  {
    name: 'check_sub_agent_status',
    description: 'Check the status and results of a spawned sub-agent.',
    input_schema: {
      type: 'object',
      properties: {
        subAgentId: {
          type: 'string',
          description: 'Sub-agent ID to check',
        },
      },
      required: ['subAgentId'],
    },
  },
  // Architect Review Tool
  {
    name: 'request_architect_review',
    description: 'Request proactive code review and improvement suggestions from The Architect. Use this BEFORE completing tasks (not just when stuck) to get expert feedback. Architect can suggest better approaches that align with goals without breaking the app.',
    input_schema: {
      type: 'object',
      properties: {
        reviewType: {
          type: 'string',
          enum: ['proactive', 'requested', 'post_completion'],
          description: 'Type of review (use proactive for continuous improvement)',
        },
        workDescription: {
          type: 'string',
          description: 'Clear description of the work to review',
        },
        codeChanges: {
          type: 'string',
          description: 'Code changes made (use git diff or file contents)',
        },
        currentApproach: {
          type: 'string',
          description: 'Your current approach/implementation strategy',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Constraints to consider (e.g., "Must not break existing auth", "Performance critical")',
        },
      },
      required: ['reviewType', 'workDescription'],
    },
  },
] as const;
