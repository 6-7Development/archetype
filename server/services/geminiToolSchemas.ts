/**
 * GEMINI TOOL SCHEMAS
 * Complete JSON schema definitions for all Scout tools
 * Registered with Gemini for proper function calling
 */

/**
 * Tool schema format for Gemini function declarations
 */
export interface GeminiToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required: string[];
  };
}

/**
 * Core file operation tools
 */
export const FILE_TOOLS: GeminiToolSchema[] = [
  {
    name: 'read',
    description: 'Read the contents of a file. Use this to examine code, configs, or any text file.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to read, relative to project root',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (1-indexed). Optional.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of lines to read. Default is 500.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write',
    description: 'Write content to a file. Creates the file if it does not exist. Overwrites existing content.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to write, relative to project root',
        },
        content: {
          type: 'string',
          description: 'The complete content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'edit',
    description: 'Edit a file by replacing a specific string with a new string. The old_string must exist exactly in the file.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to edit',
        },
        old_string: {
          type: 'string',
          description: 'The exact string to find and replace. Must be unique in the file.',
        },
        new_string: {
          type: 'string',
          description: 'The string to replace old_string with. Can be empty to delete.',
        },
        replace_all: {
          type: 'boolean',
          description: 'If true, replace all occurrences. Default is false (first only).',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'ls',
    description: 'List files and directories at a given path with tree-like output.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list. Use "." for current directory.',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list subdirectories recursively. Default true.',
        },
        max_files: {
          type: 'number',
          description: 'Maximum number of files to list. Default 1000.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern like "**/*.ts" or "src/**/*.tsx".',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files (e.g., "**/*.ts", "src/*.tsx")',
        },
        path: {
          type: 'string',
          description: 'Directory to search in. Default is current directory.',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep',
    description: 'Search for a pattern in files using regex. Returns matching lines.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for in file contents',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in. Default is current directory.',
        },
        type: {
          type: 'string',
          description: 'File type filter (e.g., "ts", "js", "py")',
        },
      },
      required: ['pattern'],
    },
  },
];

/**
 * Shell and system tools
 */
export const SHELL_TOOLS: GeminiToolSchema[] = [
  {
    name: 'bash',
    description: 'Execute a bash command. Use for running scripts, installing packages, or system operations.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
        description: {
          type: 'string',
          description: 'Brief description of what this command does',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Default 120000 (2 minutes).',
        },
      },
      required: ['command', 'description'],
    },
  },
];

/**
 * Task management tools
 */
export const TASK_TOOLS: GeminiToolSchema[] = [
  {
    name: 'write_task_list',
    description: 'Create a task list to track work. Use for complex multi-step tasks.',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          description: 'Array of task objects with id, content, and status fields',
          items: { type: 'object' },
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'read_task_list',
    description: 'Read the current task list to check progress.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'update_task',
    description: 'Update the status of a specific task.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The task ID to update',
        },
        status: {
          type: 'string',
          description: 'New status for the task',
          enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        },
      },
      required: ['id', 'status'],
    },
  },
];

/**
 * Search and analysis tools
 */
export const SEARCH_TOOLS: GeminiToolSchema[] = [
  {
    name: 'search_codebase',
    description: 'Search the codebase with a natural language query. Uses AI to find relevant code.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language question about the codebase',
        },
        search_paths: {
          type: 'array',
          description: 'Specific directories to search in',
          items: { type: 'string' },
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for documentation, solutions, or information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (3-10 words)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
      },
      required: ['query'],
    },
  },
];

/**
 * Platform-specific tools (aliases for platform context)
 */
export const PLATFORM_TOOLS: GeminiToolSchema[] = [
  {
    name: 'readPlatformFile',
    description: 'Read a platform source file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to project root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'writePlatformFile',
    description: 'Write content to a platform file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to project root',
        },
        content: {
          type: 'string',
          description: 'New file content',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'listPlatformFiles',
    description: 'List files in a directory',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path',
        },
      },
      required: ['directory'],
    },
  },
];

/**
 * GitHub and deployment tools
 */
export const GITHUB_TOOLS: GeminiToolSchema[] = [
  {
    name: 'commit_to_github',
    description: 'CRITICAL: Commit all platform changes to GitHub and trigger production deployment.',
    parameters: {
      type: 'object',
      properties: {
        commitMessage: {
          type: 'string',
          description: 'Detailed commit message explaining what was fixed',
        },
      },
      required: ['commitMessage'],
    },
  },
];

/**
 * Agent and AI consultation tools
 */
export const AGENT_TOOLS: GeminiToolSchema[] = [
  {
    name: 'consult_architect',
    description: 'Consult Scout Advanced for high-level guidance on complex architectural decisions. Use sparingly.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Specific architectural question or problem statement',
        },
        context: {
          type: 'string',
          description: 'Detailed context including failed approaches, constraints, and scope',
        },
        relevant_files: {
          type: 'string',
          description: 'Comma-separated file paths relevant to the question',
        },
        rationale: {
          type: 'string',
          description: 'Why guidance is needed (e.g., "Tried X and Y, both failed because...")',
        },
      },
      required: ['question', 'context', 'rationale'],
    },
  },
  {
    name: 'dispatch_subagent',
    description: 'Spawn a specialized sub-agent for parallel tasks like analysis, testing, or documentation.',
    parameters: {
      type: 'object',
      properties: {
        agentType: {
          type: 'string',
          description: 'Type of specialized agent',
          enum: ['analyst', 'tester', 'reviewer', 'linter', 'documenter'],
        },
        task: {
          type: 'string',
          description: 'Specific task for the sub-agent',
        },
        relevantFiles: {
          type: 'string',
          description: 'Comma-separated file paths relevant to this task',
        },
        priority: {
          type: 'string',
          description: 'Execution priority',
          enum: ['high', 'normal', 'low'],
        },
      },
      required: ['agentType', 'task'],
    },
  },
];

/**
 * Extended task management tools (alternative names)
 */
export const EXTENDED_TASK_TOOLS: GeminiToolSchema[] = [
  {
    name: 'createTaskList',
    description: 'Create a task list for complex work (5+ steps). Skip for quick fixes.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Brief title for this task list',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what you will do',
        },
        tasks: {
          type: 'array',
          description: 'Array of tasks to complete',
          items: { type: 'object' },
        },
      },
      required: ['title', 'tasks'],
    },
  },
  {
    name: 'updateTask',
    description: 'Update task status as you work to show live progress.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to update',
        },
        status: {
          type: 'string',
          description: 'New status',
          enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        },
        result: {
          type: 'string',
          description: 'Optional result description when completing',
        },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'readTaskList',
    description: 'Read your current task list to see task IDs and statuses',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

/**
 * Get all tool schemas for Gemini registration
 */
export function getAllToolSchemas(): GeminiToolSchema[] {
  return [
    ...FILE_TOOLS,
    ...SHELL_TOOLS,
    ...TASK_TOOLS,
    ...SEARCH_TOOLS,
    ...PLATFORM_TOOLS,
    ...GITHUB_TOOLS,
    ...AGENT_TOOLS,
    ...EXTENDED_TASK_TOOLS,
  ];
}

/**
 * Get basic tools for simple tasks (faster, fewer tokens)
 */
export function getBasicToolSchemas(): GeminiToolSchema[] {
  return [
    ...PLATFORM_TOOLS,
    ...GITHUB_TOOLS,
  ];
}

/**
 * Get all tools for complex tasks
 */
export function getAllToolSchemasForChat(): GeminiToolSchema[] {
  return getAllToolSchemas();
}

/**
 * Convert tool schemas to Gemini function declarations format
 */
export function convertToGeminiFunctionDeclarations(): any[] {
  const schemas = getAllToolSchemas();
  
  return [{
    functionDeclarations: schemas.map(schema => ({
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
    })),
  }];
}

/**
 * Get tool schema by name
 */
export function getToolSchema(toolName: string): GeminiToolSchema | undefined {
  const allSchemas = getAllToolSchemas();
  return allSchemas.find(s => s.name === toolName || s.name === toolName.toLowerCase());
}

/**
 * Validate tool call against schema
 */
export function validateToolCallAgainstSchema(
  toolName: string, 
  args: Record<string, any>
): { valid: boolean; errors: string[] } {
  const schema = getToolSchema(toolName);
  
  if (!schema) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }
  
  const errors: string[] = [];
  
  // Check required parameters
  for (const required of schema.parameters.required) {
    if (args[required] === undefined || args[required] === null) {
      errors.push(`Missing required parameter: ${required}`);
    }
  }
  
  // Type validation for provided params
  for (const [paramName, paramValue] of Object.entries(args)) {
    const propSchema = schema.parameters.properties[paramName];
    
    if (!propSchema) {
      continue; // Allow extra params
    }
    
    const expectedType = propSchema.type;
    const actualType = Array.isArray(paramValue) ? 'array' : typeof paramValue;
    
    if (expectedType !== actualType) {
      errors.push(`Parameter '${paramName}' has wrong type: expected ${expectedType}, got ${actualType}`);
    }
    
    // Enum validation
    if (propSchema.enum && !propSchema.enum.includes(paramValue)) {
      errors.push(`Parameter '${paramName}' must be one of: ${propSchema.enum.join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
