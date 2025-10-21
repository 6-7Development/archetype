export { executeBrowserTest } from './browser-test';
export { executeWebSearch, searchDocumentation, searchCodeExamples } from './web-search';
export { executeVisionAnalysis, analyzeUIScreenshot, compareDesignToImplementation } from './vision-analyze';
export { consultArchitect } from './architect-consult';
export { executePlatformRead, executePlatformWrite, executePlatformList } from './platform-tools';

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
] as const;
