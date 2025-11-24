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
export { knowledge_search, knowledge_store, knowledge_recall, code_search } from './knowledge';

// NEW: Smart Code Intelligence Tools - AST-based file analysis and context detection
export { indexFile, smartReadFile, getRelatedFiles, extractFunction, getAutoContext, getFileSummary } from './smart-code-tools';

// NEW: Google Docs Integration
export { readGoogleDoc, searchGoogleDoc, listGoogleDocs, getGoogleDocMetadata } from './google-docs-access';

// NEW TOOLS - Replit Agent Feature Parity (18 tools)
// GROUP 1: Deployment & Rollback
export { suggestDeploy, suggestRollback } from './deployment';

// GROUP 2: Secrets Management
export { askSecrets, checkSecrets } from './secrets';

// GROUP 3: Database & Infrastructure
export { checkDatabaseStatus, executeSql, createPostgresqlDatabase } from './database-tools';
export { programmingLanguageInstall } from './programming-languages';

// GROUP 4: Design & Assets
export { generateDesignGuidelines } from './design-guidelines';
export { stockImageTool } from './stock-images';

// GROUP 5: Integrations
export { searchIntegrations, useIntegration } from './integrations';

// GROUP 6: File & System Operations
export { webFetch } from './web-fetch';
export { refreshAllLogs } from './logs';
export { glob, ls, read, write } from './file-operations';

/**
 * LomuAI Tool Definitions
 * Complete toolset for LomuAI's autonomous development capabilities
 */
export const LOMU_TOOLS = [
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
    description: 'Diagnose platform issues by analyzing actual code. Automatically detects what to check based on your description. Returns evidence-based findings with real metrics (file sizes, pattern counts, actual code issues). Examples: "check performance", "security audit", "platform-wide health check", "memory leaks", "database queries".',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Describe what to diagnose (e.g., "performance issues", "security vulnerabilities", "platform health", "memory leaks", "database problems"). The tool will automatically determine which checks to run.',
        },
        focus: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: specific files to analyze (e.g., ["server/routes.ts"]). If not provided, analyzes common platform files.',
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
    description: 'Update task status and progress (IF you created a task list). Mark tasks as in_progress, completed_pending_review, or completed.',
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
    name: 'start_subagent',
    description: '🎯 ORCHESTRATION TOOL: Delegate complex work to specialized sub-agents. Use this for multi-file changes, refactoring, or parallel workstreams. Sub-agents work autonomously on user projects while you monitor progress.',
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Clear, specific task for the sub-agent. Include file paths, what to change, and success criteria. Example: "Implement user authentication with login/signup forms in auth.tsx and auth.ts"',
        },
        relevantFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files the sub-agent will work with (e.g., ["auth.tsx", "auth.ts", "schema.ts"])',
        },
        projectId: {
          type: 'string',
          description: 'Project ID from the current context',
        },
      },
      required: ['task', 'relevantFiles', 'projectId'],
    },
  },
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
  // Knowledge Management Tools
  {
    name: 'knowledge_store',
    description: 'Store knowledge for future recall by any AI agent. Use this to save learnings, patterns, solutions, and insights that could be valuable for future tasks across all agents.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Knowledge category (e.g., "bug-fixes", "architecture", "best-practices", "user-preferences")',
        },
        topic: {
          type: 'string',
          description: 'Specific topic (e.g., "authentication-patterns", "deployment-steps", "common-errors")',
        },
        content: {
          type: 'string',
          description: 'The knowledge content to store',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for easier searching (e.g., ["react", "typescript", "error-handling"])',
        },
        source: {
          type: 'string',
          description: 'Source of knowledge (default: "sysop")',
        },
        confidence: {
          type: 'number',
          description: 'Confidence score 0-1 (default: 0.8)',
        },
      },
      required: ['category', 'topic', 'content'],
    },
  },
  {
    name: 'knowledge_search',
    description: 'Search the shared knowledge base for relevant information. Use this to find solutions, patterns, or insights saved by any agent from previous tasks.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (searches in topic and content)',
        },
        category: {
          type: 'string',
          description: 'Filter by category (optional)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'knowledge_recall',
    description: 'Recall specific knowledge by category, topic, or ID. Use this to retrieve saved information when you know what you are looking for.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Recall by category (e.g., "bug-fixes")',
        },
        topic: {
          type: 'string',
          description: 'Recall by topic (partial match)',
        },
        id: {
          type: 'string',
          description: 'Recall specific entry by ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'code_search',
    description: 'Search or store reusable code snippets. Use this to save proven code patterns or find existing snippets to reuse.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for finding code snippets',
        },
        language: {
          type: 'string',
          description: 'Programming language filter (e.g., "typescript", "python")',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        store: {
          type: 'object',
          description: 'Store a new code snippet instead of searching',
          properties: {
            language: {
              type: 'string',
              description: 'Programming language',
            },
            description: {
              type: 'string',
              description: 'Description of what the code does',
            },
            code: {
              type: 'string',
              description: 'The actual code snippet',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for categorization',
            },
          },
          required: ['language', 'description', 'code'],
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
      },
    },
  },
  // ===== NEW REPLIT AGENT PARITY TOOLS (18 tools) =====
  // GROUP 1: Deployment & Rollback
  {
    name: 'suggest_deploy',
    description: 'Suggest deployment to production. Returns deployment instructions without actually deploying. User triggers deployment in UI.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'suggest_rollback',
    description: 'Suggest rolling back to previous checkpoint. Returns rollback instructions and available checkpoints without actually rolling back.',
    input_schema: {
      type: 'object',
      properties: {
        checkpoint: {
          type: 'string',
          description: 'Optional checkpoint ID to rollback to',
        },
        reason: {
          type: 'string',
          description: 'Reason for suggesting rollback',
        },
      },
    },
  },
  // GROUP 2: Secrets Management
  {
    name: 'ask_secrets',
    description: 'Request API keys from user. Prompts user to provide secrets for services like OpenAI, Stripe, etc. Returns instructions for adding secrets.',
    input_schema: {
      type: 'object',
      properties: {
        secret_keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of secret key names to request (e.g., ["OPENAI_API_KEY", "STRIPE_SECRET_KEY"])',
        },
        user_message: {
          type: 'string',
          description: 'Message explaining why these secrets are needed',
        },
      },
      required: ['secret_keys', 'user_message'],
    },
  },
  {
    name: 'check_secrets',
    description: 'Verify if secret environment variables exist. Returns boolean for each secret without exposing values. Use before making API calls.',
    input_schema: {
      type: 'object',
      properties: {
        secret_keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of secret key names to check',
        },
      },
      required: ['secret_keys'],
    },
  },
  // GROUP 3: Database & Infrastructure
  {
    name: 'check_database_status',
    description: 'Verify database connection and health. Returns connection status, version, size, and table information.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'execute_sql_tool',
    description: 'Execute SQL queries on development database. SAFETY: Only works on development DB, destructive operations require confirmation comment.',
    input_schema: {
      type: 'object',
      properties: {
        sql_query: {
          type: 'string',
          description: 'SQL query to execute. Add "-- CONFIRMED" comment for destructive operations.',
        },
        environment: {
          type: 'string',
          enum: ['development'],
          description: 'Must be "development" - production DB access not allowed',
        },
      },
      required: ['sql_query'],
    },
  },
  {
    name: 'create_postgresql_database_tool',
    description: 'Create or verify PostgreSQL database. Checks if DATABASE_URL is configured and verifies connection.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'programming_language_install_tool',
    description: 'Install programming languages and their package managers (Node.js, Python, Go, etc.). Returns installation status.',
    input_schema: {
      type: 'object',
      properties: {
        programming_languages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Languages to install (e.g., ["nodejs-20", "python-3.11", "go"])',
        },
      },
      required: ['programming_languages'],
    },
  },
  // GROUP 4: Design & Assets
  {
    name: 'generate_design_guidelines',
    description: 'Generate comprehensive design system documentation. Creates design guidelines with colors, typography, spacing, components, and accessibility rules.',
    input_schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of the project and design requirements',
        },
        projectName: {
          type: 'string',
          description: 'Project name for the guidelines',
        },
        colorScheme: {
          type: 'string',
          enum: ['light', 'dark', 'both'],
          description: 'Color scheme to support (default: both)',
        },
        includeComponents: {
          type: 'boolean',
          description: 'Include component library guidelines (default: true)',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'stock_image_tool',
    description: 'Fetch stock images from Unsplash. Downloads and saves images to attached_assets/stock_images. Requires UNSPLASH_ACCESS_KEY for real photos.',
    input_schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of desired images (e.g., "professional office", "sunset landscape")',
        },
        limit: {
          type: 'number',
          description: 'Number of images to fetch (1-10, default: 1)',
        },
        orientation: {
          type: 'string',
          enum: ['horizontal', 'vertical', 'all'],
          description: 'Image orientation (default: horizontal)',
        },
      },
      required: ['description'],
    },
  },
  // GROUP 5: Integrations
  {
    name: 'search_integrations',
    description: 'Search for available Replit-style integrations (OpenAI, Stripe, GitHub, Auth, etc.). Returns matching integrations with setup info.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "authentication", "payments", "AI")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'use_integration',
    description: 'Add or configure an integration in the project. Supports view (see details), add (install), and propose_setting_up (suggest setup) operations.',
    input_schema: {
      type: 'object',
      properties: {
        integration_id: {
          type: 'string',
          description: 'Integration ID from search_integrations (e.g., "connector:openai")',
        },
        operation: {
          type: 'string',
          enum: ['view', 'add', 'propose_setting_up'],
          description: 'Operation to perform',
        },
      },
      required: ['integration_id', 'operation'],
    },
  },
  // GROUP 6: File & System Operations
  {
    name: 'web_fetch',
    description: 'Fetch full web page content. Downloads HTML and converts to readable text/markdown. Use after web_search for detailed content.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full URL to fetch (must be valid HTTP/HTTPS)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'refresh_all_logs',
    description: 'Get latest workflow, browser, and server logs. Returns recent log entries with filtering and limiting options.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Filter logs by keyword',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of log entries to return (default: 100)',
        },
      },
    },
  },
  {
    name: 'glob',
    description: 'Find files matching glob patterns (e.g., "**/*.ts", "src/**/*.tsx"). Uses platform file search.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match (e.g., "**/*.ts", "*.json")',
        },
        path: {
          type: 'string',
          description: 'Base path to search from (default: ".")',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'ls',
    description: 'List directory contents with file/folder details. Supports recursive listing and filtering.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: ".")',
        },
        recursive: {
          type: 'boolean',
          description: 'Recursively list subdirectories (default: false)',
        },
        include_hidden: {
          type: 'boolean',
          description: 'Include hidden files (default: false)',
        },
        max_files: {
          type: 'number',
          description: 'Maximum files to list (default: 1000)',
        },
        ignore: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to ignore (default: ["node_modules", ".git", "dist"])',
        },
      },
    },
  },
  {
    name: 'read',
    description: 'Generic file read for any file. Supports offset and line limits. Works with both platform and project files.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'File path to read',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (default: 0)',
        },
        limit: {
          type: 'number',
          description: 'Maximum lines to read (default: 1000)',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write',
    description: 'Generic file write for any file. Creates directories if needed. Works with both platform and project files.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'File path to write to',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'bash',
    description: 'Execute bash commands in the terminal. Use for running npm commands, testing, building, or any shell operations.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 120000 = 2 minutes)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'run_playwright_test',
    description: 'Run Playwright end-to-end tests to verify application functionality. Use after implementing features to ensure they work correctly.',
    input_schema: {
      type: 'object',
      properties: {
        testFile: {
          type: 'string',
          description: 'Path to the test file to run (e.g., "tests/login.spec.ts")',
        },
        headless: {
          type: 'boolean',
          description: 'Run in headless mode (default: true)',
        },
      },
      required: ['testFile'],
    },
  },
  {
    name: 'commit_to_github',
    description: 'Commit all changes to GitHub with a descriptive message. Use after completing a fix or feature implementation.',
    input_schema: {
      type: 'object',
      properties: {
        commitMessage: {
          type: 'string',
          description: 'Clear, descriptive commit message explaining what was changed and why',
        },
      },
      required: ['commitMessage'],
    },
  },
  {
    name: 'read_logs',
    description: 'Read application logs to diagnose issues. Returns workflow logs, browser console logs, and server logs.',
    input_schema: {
      type: 'object',
      properties: {
        lines: {
          type: 'number',
          description: 'Number of log lines to retrieve (default: 100, max: 1000)',
        },
        filter: {
          type: 'string',
          description: 'Filter logs by keyword (e.g., "error", "warning", "user-123")',
        },
      },
    },
  },
  {
    name: 'create_platform_file',
    description: 'Create a new platform source code file. Use when adding new features to the Lomu platform itself.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to platform root (e.g., "client/src/components/NewFeature.tsx")',
        },
        content: {
          type: 'string',
          description: 'Complete file content',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'delete_platform_file',
    description: 'Delete a platform source code file. Use with caution - only when removing obsolete platform files.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to platform root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_project_file',
    description: 'Create a new file in the user project. Use when generating code for the user.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path in the project (e.g., "src/components/Button.tsx")',
        },
        content: {
          type: 'string',
          description: 'Complete file content',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'index_file',
    description: 'Parse and index a file to extract imports, exports, functions, classes, and dependencies. Creates searchable metadata for intelligent code navigation. Use for platform files or user project files.',
    input_schema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to file to index (e.g., "server/services/lomuChat.ts")',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (null for platform files)',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'smart_read_file',
    description: 'Read file content intelligently - if you mention specific functions/classes, extracts only those sections. Otherwise provides a smart summary with imports, exports, and function signatures. 70-80% more token-efficient than reading full files.',
    input_schema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to file to read',
        },
        context: {
          type: 'string',
          description: 'What you are looking for (e.g., "handleSubmit function", "UserService class")',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (null for platform files)',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'get_related_files',
    description: 'Automatically detect files related to a target file - finds imports, dependents, test files, schema files, and siblings. Returns prioritized list (0-10). Eliminates manual file specification.',
    input_schema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to target file',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (null for platform files)',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'extract_function',
    description: 'Extract a specific function from a file with line numbers and optional context. Token-efficient way to get exactly what you need without reading entire files.',
    input_schema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to file containing function',
        },
        functionName: {
          type: 'string',
          description: 'Name of function to extract',
        },
        includeContext: {
          type: 'boolean',
          description: 'Include imports and related code (default: false)',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (null for platform files)',
        },
      },
      required: ['filePath', 'functionName'],
    },
  },
  {
    name: 'get_auto_context',
    description: 'Analyze a user message and automatically gather relevant files with their smart summaries. Extracts mentioned file paths and includes related dependencies, tests, and schemas. Use this when user asks about code to auto-load context.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'User message to analyze',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (null for platform files)',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'get_file_summary',
    description: 'Get a smart summary of a file WITHOUT reading full content. Shows imports, exports, function signatures, class definitions, and types. Extremely token-efficient for understanding file structure.',
    input_schema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to file to summarize',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (null for platform files)',
        },
      },
      required: ['filePath'],
    },
  },
  // ========== GitHub Integration Tools ==========
  {
    name: 'commit_to_github',
    description: 'Commit files to the GitHub repository. Commits changes directly to the configured branch (main by default). Use this to save code changes to version control.',
    input_schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description: 'Array of files to commit',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path relative to project root' },
              content: { type: 'string', description: 'File content (optional if reading from filesystem)' },
              operation: { type: 'string', enum: ['create', 'modify', 'delete'], description: 'Operation type' },
            },
            required: ['path'],
          },
        },
        message: {
          type: 'string',
          description: 'Commit message describing the changes',
        },
      },
      required: ['files', 'message'],
    },
  },
  {
    name: 'create_github_branch',
    description: 'Create a new branch from main. Use this to start working on a feature or fix in isolation before merging.',
    input_schema: {
      type: 'object',
      properties: {
        branchName: {
          type: 'string',
          description: 'Name of the branch to create (e.g., "feature/new-api", "fix/bug-123")',
        },
      },
      required: ['branchName'],
    },
  },
  {
    name: 'push_to_branch',
    description: 'Push changes to a specific branch (for PR workflow). Use this when working on a feature branch before creating a pull request.',
    input_schema: {
      type: 'object',
      properties: {
        branchName: {
          type: 'string',
          description: 'Target branch name',
        },
        files: {
          type: 'array',
          description: 'Files to commit',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
              operation: { type: 'string', enum: ['create', 'modify', 'delete'] },
            },
            required: ['path'],
          },
        },
        message: {
          type: 'string',
          description: 'Commit message',
        },
      },
      required: ['branchName', 'files', 'message'],
    },
  },
  {
    name: 'create_pull_request',
    description: 'Create or update a Pull Request for a branch. Use this after pushing changes to a feature branch to request code review.',
    input_schema: {
      type: 'object',
      properties: {
        branchName: {
          type: 'string',
          description: 'Source branch name',
        },
        title: {
          type: 'string',
          description: 'PR title',
        },
        body: {
          type: 'string',
          description: 'PR description/body',
        },
      },
      required: ['branchName', 'title', 'body'],
    },
  },
  {
    name: 'export_project_to_github',
    description: 'Export entire project to GitHub repository. Use this for initial project setup or full project backup. Excludes node_modules, .git, .env, and other build artifacts.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message (default: "Initial commit from LomuAI")',
        },
        excludePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional patterns to exclude',
        },
      },
    },
  },
  {
    name: 'get_github_status',
    description: 'Check GitHub integration status and configuration. Use this to verify GitHub is properly set up.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  // ========== Environment Variables Tools ==========
  {
    name: 'set_env_var',
    description: 'Set an environment variable for project deployments. These variables will be available in deployed applications via process.env.* Use this to configure API keys, database URLs, and other secrets.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
        key: {
          type: 'string',
          description: 'Environment variable name (uppercase, e.g., DATABASE_URL, API_KEY)',
        },
        value: {
          type: 'string',
          description: 'Environment variable value',
        },
        description: {
          type: 'string',
          description: 'Optional description of this variable',
        },
      },
      required: ['projectId', 'key', 'value'],
    },
  },
  {
    name: 'get_env_vars',
    description: 'Get all environment variables for a project. Values are masked for security.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'delete_env_var',
    description: 'Delete an environment variable from a project.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
        key: {
          type: 'string',
          description: 'Environment variable name to delete',
        },
      },
      required: ['projectId', 'key'],
    },
  },
  {
    name: 'get_env_var_templates',
    description: 'Get a list of common environment variable templates and examples for databases, authentication, API keys, etc.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  // ========== Google Docs Integration ==========
  {
    name: 'google_docs_read',
    description: 'Read and extract content from a Google Docs document. Requires Google Docs connector to be set up in Replit. Use this to access documentation, design specs, or project requirements stored in Google Docs.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Google Docs document ID (from the URL)',
        },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'google_docs_search',
    description: 'Search for specific content within a Google Docs document. Returns matching excerpts with surrounding context.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Google Docs document ID',
        },
        searchTerm: {
          type: 'string',
          description: 'Text to search for',
        },
      },
      required: ['documentId', 'searchTerm'],
    },
  },
  {
    name: 'google_docs_metadata',
    description: 'Get document metadata (title, revision, accessible status) without reading full content. Use to verify access before reading.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Google Docs document ID',
        },
      },
      required: ['documentId'],
    },
  },
] as const;

// ============================================================================
// EXPORT TOOL DISTRIBUTION STRATEGY (see tools/tool-distribution.ts)
// ============================================================================
export {
  LOMU_AI_TOOL_NAMES,
  ARCHITECT_TOOL_NAMES,
  TESTING_SPECIALIST_TOOLS,
  DATABASE_SPECIALIST_TOOLS,
  DEVOPS_SPECIALIST_TOOLS,
  INTEGRATION_SPECIALIST_TOOLS,
  CODE_INTELLIGENCE_TOOLS,
  DOCUMENTATION_SPECIALIST_TOOLS,
  DESIGN_SPECIALIST_TOOLS,
  TASK_ORCHESTRATION_TOOLS,
  SUBAGENT_SPECIALISTS,
  DISTRIBUTION_SUMMARY,
} from './tool-distribution';

/**
 * Essential LomuAI Tools (18 tools for Gemini)
 * Balanced tool distribution strategy:
 * - LomuAI: 18 core tools (cost-effective Gemini)
 * - I AM Architect: 16 strategic tools (Claude for complex reasoning)
 * - Subagents: ~33 specialized tools (domain experts)
 * This ensures all 67 tools are utilized while respecting Gemini's ≤20 recommendation
 */
export const ESSENTIAL_LOMU_TOOLS = LOMU_TOOLS.filter(tool =>
  [
    'read_project_file', 'write_project_file', 'delete_project_file',
    'bash', 'read', 'write', 'glob', 'ls',
    'browser_test', 'vision_analyze', 'perform_diagnosis', 'web_search',
    'architect_consult', 'start_subagent',
    'execute_sql_tool', 'ask_secrets', 'web_fetch', 'suggest_deploy'
  ].includes(tool.name)
);
