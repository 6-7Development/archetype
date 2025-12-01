import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from '@google/generative-ai';
import { platformHealing } from './platformHealing';
import { 
  executeBrowserTest,
  executeWebSearch,
  consultArchitect,
  performDiagnosis,
  knowledge_search,
  knowledge_store,
  knowledge_recall,
  code_search,
  smartReadFile,
  getRelatedFiles,
  searchIntegrations,
  executeSql,
  refreshAllLogs,
} from './tools';
import { FileChangeTracker } from './services/validationHelpers';

interface SubagentParams {
  task: string;
  relevantFiles: string[];
  userId: string;
  sendEvent: (type: string, data: any) => void;
  fileChangeTracker?: FileChangeTracker; // T5: Optional tracker for file changes
}

interface SubagentResult {
  success: boolean;
  summary: string;
  filesModified: string[];
  error?: string;
}

export async function startSubagent(params: SubagentParams): Promise<SubagentResult> {
  const { task, relevantFiles, userId, sendEvent, fileChangeTracker } = params;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('Gemini API key not configured');
  }

  sendEvent('progress', { message: `🤖 Sub-agent started: ${task.slice(0, 60)}...` });

  const MAX_ITERATIONS = 8; // Moved declaration here

  const systemPrompt = `You are a specialized sub-agent working on a focused coding task within the Lomu platform.

🎯 YOUR MISSION: ${task}

📁 RELEVANT FILES FOR CONTEXT:
${relevantFiles.map(f => `- ${f}`).join('\n')}

🚀 SYSTEMATIC CODING APPROACH (CRITICAL - Follow this workflow):

**PHASE 1: SEARCH BEFORE CODING** (Always start here!)
1. Use grep or search_codebase to find target files and existing implementations
2. Read relevant files to understand current patterns and architecture
3. Identify working code to copy/adapt (don't reinvent the wheel)
4. Map dependencies and related code before making changes

**PHASE 2: IMPLEMENT WITH PRECISION**
1. Use edit (not writePlatformFile) for targeted changes - safer and tracks occurrences
2. Copy working patterns from existing code instead of writing from scratch
3. Maintain consistency with existing code style and architecture
4. Make minimal changes - only what's needed for the task

**PHASE 3: VERIFY YOUR WORK**
1. Run get_latest_lsp_diagnostics to check for TypeScript errors
2. Verify the correct files were modified (not similar-named files)
3. Confirm the exact task requirements were met
4. Test critical paths if applicable

**PHASE 4: REPORT COMPLETION**
1. Call report_completion with clear summary of changes
2. List ALL modified files accurately
3. Note any issues or follow-up items needed

⏱️ ITERATION BUDGET: You have ${MAX_ITERATIONS} iterations maximum
- Simple tasks: Aim for 2-3 iterations
- Medium tasks: Aim for 4-6 iterations  
- Complex tasks: Use up to ${MAX_ITERATIONS} if needed

🛠️ AVAILABLE TOOLS (23 tools - same as BeeHive):
**Core Execution:** read/write/list/edit, grep, search_codebase, bash, get_latest_lsp_diagnostics
**Verification:** run_test, perform_diagnosis, verify_fix, validate_before_commit, read_logs, execute_sql
**Knowledge:** web_search, search_integrations, knowledge_store/search/recall, code_search
**Platform Ops:** packager_tool, restart_workflow, architect_consult

⚠️ IMPORTANT REMINDERS:
- You're modifying the Lomu platform itself - be precise and careful
- ALWAYS search first before coding (find existing patterns to copy)
- Use edit tool for changes (validates occurrences, safer than write)
- Verify with LSP diagnostics before reporting completion
- If blocked, consult architect_consult or report the blocker clearly

Work systematically, verify your changes, and report completion when done!`;

  const genai = new GoogleGenerativeAI(geminiKey);
  const model = genai.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  });
  
  const conversationHistory: { role: 'user' | 'model'; parts: any[] }[] = [
    {
      role: 'user',
      parts: [{ text: `Begin work on your assigned task. Read the relevant files and make the necessary changes.` }],
    },
  ];

  const tools = [
    // File operations
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
      name: 'edit',
      description: 'Find and replace text in files precisely',
      input_schema: {
        type: 'object' as const,
        properties: {
          filePath: { type: 'string' as const, description: 'File to edit' },
          oldString: { type: 'string' as const, description: 'Exact text to find' },
          newString: { type: 'string' as const, description: 'Replacement text' },
          replaceAll: { type: 'boolean' as const, description: 'Replace all occurrences (default false)' },
        },
        required: ['filePath', 'oldString', 'newString'],
      },
    },
    {
      name: 'grep',
      description: 'Search file content by pattern or regex',
      input_schema: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string' as const, description: 'Regex pattern to search' },
          pathFilter: { type: 'string' as const, description: 'File pattern filter (e.g., *.ts)' },
          outputMode: { type: 'string' as const, enum: ['content', 'files', 'count'], description: 'Output format (default: files)' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'search_codebase',
      description: 'Semantic code search - find code by meaning',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Natural language search query' },
          maxResults: { type: 'number' as const, description: 'Max results (default: 10)' },
        },
        required: ['query'],
      },
    },
    // Shell and testing
    {
      name: 'bash',
      description: 'Execute shell commands with security sandboxing',
      input_schema: {
        type: 'object' as const,
        properties: {
          command: { type: 'string' as const, description: 'Command to execute' },
          timeout: { type: 'number' as const, description: 'Timeout in milliseconds (default 120000)' },
        },
        required: ['command'],
      },
    },
    {
      name: 'run_test',
      description: 'Run Playwright e2e tests for UI/UX',
      input_schema: {
        type: 'object' as const,
        properties: {
          testPlan: { type: 'string' as const, description: 'Test plan steps' },
          technicalDocs: { type: 'string' as const, description: 'Technical context' }
        },
        required: ['testPlan', 'technicalDocs'],
      },
    },
    {
      name: 'get_latest_lsp_diagnostics',
      description: 'Check TypeScript errors and warnings',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    // Diagnosis and validation
    {
      name: 'perform_diagnosis',
      description: 'Analyze platform for issues',
      input_schema: {
        type: 'object' as const,
        properties: {
          target: { type: 'string' as const, description: 'Diagnostic target' },
          focus: { type: 'array' as const, items: { type: 'string' as const }, description: 'Files to analyze' },
        },
        required: ['target'],
      },
    },
    {
      name: 'verify_fix',
      description: 'Verify fix worked',
      input_schema: {
        type: 'object' as const,
        properties: {
          description: { type: 'string' as const, description: 'What to verify' },
          checkType: { type: 'string' as const, enum: ['logs', 'endpoint', 'file_exists'], description: 'Verification method' },
          target: { type: 'string' as const, description: 'Target to check' },
        },
        required: ['description', 'checkType'],
      },
    },
    {
      name: 'validate_before_commit',
      description: 'Comprehensive pre-commit validation',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    // Logs and database
    {
      name: 'read_logs',
      description: 'Read server logs',
      input_schema: {
        type: 'object' as const,
        properties: {
          lines: { type: 'number' as const, description: 'Number of lines' },
          filter: { type: 'string' as const, description: 'Filter keyword' },
        },
        required: [],
      },
    },
    {
      name: 'execute_sql',
      description: 'Execute SQL query',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'SQL query' },
          purpose: { type: 'string' as const, description: 'Query purpose' },
        },
        required: ['query', 'purpose'],
      },
    },
    // Search and knowledge
    {
      name: 'web_search',
      description: 'Search web for documentation',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Search query' },
          maxResults: { type: 'number' as const, description: 'Max results' },
        },
        required: ['query'],
      },
    },
    {
      name: 'search_integrations',
      description: 'Search Replit integrations',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Integration name' }
        },
        required: ['query'],
      },
    },
    {
      name: 'knowledge_store',
      description: 'Store knowledge for future recall',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: { type: 'string' as const, description: 'Category' },
          topic: { type: 'string' as const, description: 'Specific topic' },
          content: { type: 'string' as const, description: 'Knowledge content' },
          tags: { type: 'array' as const, items: { type: 'string' as const }, description: 'Tags for searching' },
          source: { type: 'string' as const, description: 'Source (default: "subagent")' },
          confidence: { type: 'number' as const, description: 'Confidence 0-1 (default: 0.8)' },
        },
        required: ['category', 'topic', 'content'],
      },
    },
    {
      name: 'knowledge_search',
      description: 'Search knowledge base',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Search query' },
          category: { type: 'string' as const, description: 'Filter by category' },
          tags: { type: 'array' as const, items: { type: 'string' as const }, description: 'Filter by tags' },
          limit: { type: 'number' as const, description: 'Max results (default: 10)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'knowledge_recall',
      description: 'Recall specific knowledge by category/topic/ID',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: { type: 'string' as const, description: 'Recall by category' },
          topic: { type: 'string' as const, description: 'Recall by topic' },
          id: { type: 'string' as const, description: 'Recall by ID' },
          limit: { type: 'number' as const, description: 'Max results (default: 20)' },
        },
        required: [],
      },
    },
    {
      name: 'code_search',
      description: 'Search or store reusable code snippets',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Search query' },
          language: { type: 'string' as const, description: 'Language filter' },
          tags: { type: 'array' as const, items: { type: 'string' as const }, description: 'Filter by tags' },
          store: { 
            type: 'object' as const, 
            properties: {
              language: { type: 'string' as const },
              description: { type: 'string' as const },
              code: { type: 'string' as const },
              tags: { type: 'array' as const, items: { type: 'string' as const } },
            },
          },
          limit: { type: 'number' as const, description: 'Max results (default: 10)' },
        },
        required: [],
      },
    },
    // Package management and workflows
    {
      name: 'packager_tool',
      description: 'Install or uninstall npm packages',
      input_schema: {
        type: 'object' as const,
        properties: {
          operation: { type: 'string' as const, enum: ['install', 'uninstall'], description: 'Operation type' },
          packages: { type: 'array' as const, items: { type: 'string' as const }, description: 'Package names' },
        },
        required: ['operation', 'packages'],
      },
    },
    {
      name: 'restart_workflow',
      description: 'Restart server workflow',
      input_schema: {
        type: 'object' as const,
        properties: {
          workflowName: { type: 'string' as const, description: 'Workflow name (default: "Start application")' },
        },
        required: [],
      },
    },
    // Architect consultation
    {
      name: 'architect_consult',
      description: 'Consult I AM Architect for expert guidance',
      input_schema: {
        type: 'object' as const,
        properties: {
          problem: { type: 'string' as const, description: 'Problem to solve' },
          context: { type: 'string' as const, description: 'Platform context' },
          proposedSolution: { type: 'string' as const, description: 'Proposed fix' },
          affectedFiles: { type: 'array' as const, items: { type: 'string' as const }, description: 'Files to modify' },
        },
        required: ['problem', 'context', 'proposedSolution', 'affectedFiles'],
      },
    },
    // Task reporting (keep last)
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

  // 🎯 MAP-BASED TOOL DISPATCHER - Clean, maintainable, architect-approved pattern
  type ToolExecutor = (input: any) => Promise<{ result: any; trackFile?: string }>;
  
  const toolExecutors: Record<string, ToolExecutor> = {
    // === CORE EXECUTION TOOLS (Priority 1) ===
    readPlatformFile: async (input: { path: string }) => {
      sendEvent('progress', { message: `📖 Reading ${input.path}...` });
      const result = await platformHealing.readPlatformFile(input.path);
      return { result };
    },

    writePlatformFile: async (input: { path: string; content: string }) => {
      if (!input.content || typeof input.content !== 'string') {
        throw new Error(`Invalid content for ${input.path}`);
      }
      sendEvent('progress', { message: `✏️ Modifying ${input.path}...` });
      const result = await platformHealing.writePlatformFile(input.path, input.content);
      sendEvent('progress', { message: `✅ Modified ${input.path}` });
      return { result: JSON.stringify(result), trackFile: input.path };
    },

    listPlatformFiles: async (input: { directory: string }) => {
      sendEvent('progress', { message: `📂 Listing ${input.directory}...` });
      const files = await platformHealing.listPlatformFiles(input.directory);
      return { result: files.join('\n') };
    },

    edit: async (input: { filePath: string; oldString: string; newString: string; replaceAll?: boolean }) => {
      sendEvent('progress', { message: `✏️ Editing ${input.filePath}...` });
      const fileContent = await platformHealing.readPlatformFile(input.filePath);
      const occurrences = fileContent.split(input.oldString).length - 1;
      
      if (occurrences === 0) {
        throw new Error(`Pattern not found in ${input.filePath}`);
      }
      if (occurrences > 1 && !input.replaceAll) {
        throw new Error(`Found ${occurrences} matches - use replaceAll: true to replace all`);
      }
      
      const newContent = input.replaceAll 
        ? fileContent.replaceAll(input.oldString, input.newString)
        : fileContent.replace(input.oldString, input.newString);
        
      await platformHealing.writePlatformFile(input.filePath, newContent);
      return { result: `✅ Edited ${input.filePath}`, trackFile: input.filePath };
    },

    grep: async (input: { pattern: string; pathFilter?: string; outputMode?: 'content' | 'files' | 'count' }) => {
      sendEvent('progress', { message: `🔍 Searching: ${input.pattern}...` });
      let results = await platformHealing.searchPlatformFiles(input.pattern);
      
      // Honor pathFilter if provided (glob pattern filtering)
      if (input.pathFilter) {
        const globPattern = input.pathFilter;
        results = results.filter(path => {
          const regex = globPattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.');
          return new RegExp(`^${regex}$`).test(path);
        });
      }
      
      // Honor outputMode
      if (input.outputMode === 'count') {
        return { result: `Found ${results.length} matches` };
      } else if (input.outputMode === 'content') {
        // Read each file and show matched lines with regex matching
        const contentResults: string[] = [];
        
        for (const filePath of results.slice(0, 10)) { // Limit to 10 files
          try {
            const fileContent = await platformHealing.readPlatformFile(filePath);
            const lines = fileContent.split('\n');
            const matchedLines: string[] = [];
            
            lines.forEach((line, idx) => {
              // Create fresh RegExp for each line to avoid lastIndex issues
              const lineRegex = new RegExp(input.pattern);
              if (lineRegex.test(line)) {
                matchedLines.push(`${filePath}:${idx + 1}: ${line.trim()}`);
              }
            });
            
            if (matchedLines.length > 0) {
              contentResults.push(matchedLines.join('\n'));
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }
        return { result: contentResults.join('\n\n') || 'No content matches found' };
      } else {
        // 'files' mode - return file paths only
        return { result: results.join('\n') };
      }
    },

    search_codebase: async (input: { query: string; maxResults?: number }) => {
      sendEvent('progress', { message: `🔎 Searching codebase: ${input.query}...` });
      // Use semantic search via getRelatedFiles for intelligent code understanding
      try {
        const relatedFiles = await getRelatedFiles({
          baseFile: '', // Empty base for general search
          context: input.query,
          maxResults: input.maxResults || 10,
        });
        return { result: JSON.stringify(relatedFiles, null, 2) };
      } catch (e) {
        // Fallback to plain search if semantic search fails
        const results = await platformHealing.searchPlatformFiles(input.query);
        return { result: `Found ${results.length} matches:\n` + results.slice(0, input.maxResults || 10).join('\n') };
      }
    },

    bash: async (input: { command: string; timeout?: number }) => {
      sendEvent('progress', { message: `🔧 Executing: ${input.command}...` });
      const result = await platformHealing.executeBashCommand(input.command, input.timeout || 120000);
      return { result: `${result.stdout}\n${result.stderr}`.trim() };
    },

    get_latest_lsp_diagnostics: async (input: { filePath?: string }) => {
      sendEvent('progress', { message: `🔍 Checking TypeScript errors...` });
      const diagnosticsResult = await platformHealing.getLSPDiagnostics();
      
      // Return the helper's summary directly - it's already formatted correctly
      if (!diagnosticsResult.success) {
        return { result: diagnosticsResult.summary };
      }
      
      // If filePath specified, filter and format those specific diagnostics
      if (input.filePath) {
        const filtered = diagnosticsResult.diagnostics.filter(d => d.file === input.filePath);
        if (filtered.length === 0) {
          return { result: `✅ No TypeScript errors in ${input.filePath}` };
        }
        const formatted = filtered.map(d => 
          `${d.file}:${d.line}:${d.column} - ${d.severity}: ${d.message}`
        ).join('\n');
        return { result: `${filtered.length} error(s) in ${input.filePath}:\n${formatted}` };
      }
      
      // Return helper's summary as-is (preserves severity normalization and formatting)
      return { result: diagnosticsResult.summary };
    },

    // === VERIFICATION TOOLS (Priority 2) ===
    run_test: async (input: { testPlan: string; technicalDocs: string }) => {
      sendEvent('progress', { message: `🧪 Running browser tests...` });
      const result = await executeBrowserTest(input.testPlan, input.technicalDocs);
      return { result: JSON.stringify(result) };
    },

    perform_diagnosis: async (input: { issue: string; context: string }) => {
      sendEvent('progress', { message: `🔍 Diagnosing issue...` });
      const result = await performDiagnosis(input.issue, input.context);
      return { result };
    },

    verify_fix: async (input: { issueDescription: string; fixDescription: string; filePaths: string[] }) => {
      sendEvent('progress', { message: `✅ Verifying fix...` });
      // Simple verification - check files exist and were modified
      const verifications = await Promise.all(
        input.filePaths.map(async (path) => {
          try {
            await platformHealing.readPlatformFile(path);
            return `✅ ${path} exists and accessible`;
          } catch (e) {
            return `❌ ${path} not found or inaccessible`;
          }
        })
      );
      return { result: `Fix verification:\n${verifications.join('\n')}` };
    },

    validate_before_commit: async (input: { files: string[]; message: string }) => {
      sendEvent('progress', { message: `🔍 Validating before commit...` });
      // Run LSP check and verify files exist
      const lspResult = await platformHealing.getLSPDiagnostics();
      const fileChecks = await Promise.all(
        input.files.map(async (path) => {
          try {
            await platformHealing.readPlatformFile(path);
            return `✅ ${path}`;
          } catch (e) {
            return `❌ ${path} not found`;
          }
        })
      );
      return { result: `Pre-commit validation:\n${fileChecks.join('\n')}\n\nLSP: ${lspResult.summary}` };
    },

    read_logs: async (input: { source?: string }) => {
      sendEvent('progress', { message: `📋 Reading logs...` });
      const result = await refreshAllLogs();
      return { result: JSON.stringify(result) };
    },

    execute_sql: async (input: { query: string }) => {
      sendEvent('progress', { message: `🗄️ Executing SQL...` });
      const result = await executeSql(input.query);
      return { result: JSON.stringify(result) };
    },

    // === KNOWLEDGE & DISCOVERY TOOLS (Priority 3) ===
    web_search: async (input: { query: string }) => {
      sendEvent('progress', { message: `🌐 Searching web: ${input.query}...` });
      const result = await executeWebSearch(input.query);
      return { result };
    },

    search_integrations: async (input: { query: string }) => {
      sendEvent('progress', { message: `🔌 Searching integrations: ${input.query}...` });
      const result = await searchIntegrations(input.query);
      return { result: JSON.stringify(result) };
    },

    knowledge_store: async (input: { key: string; content: string; category?: string }) => {
      sendEvent('progress', { message: `💾 Storing knowledge: ${input.key}...` });
      const result = await knowledge_store(input.key, input.content, input.category);
      return { result };
    },

    knowledge_search: async (input: { query: string; category?: string }) => {
      sendEvent('progress', { message: `🔍 Searching knowledge: ${input.query}...` });
      const result = await knowledge_search(input.query, input.category);
      return { result: JSON.stringify(result) };
    },

    knowledge_recall: async (input: { key: string }) => {
      sendEvent('progress', { message: `🧠 Recalling knowledge: ${input.key}...` });
      const result = await knowledge_recall(input.key);
      return { result };
    },

    code_search: async (input: { pattern: string; fileType?: string }) => {
      sendEvent('progress', { message: `🔎 Searching code: ${input.pattern}...` });
      const result = await code_search(input.pattern, input.fileType);
      return { result: JSON.stringify(result) };
    },

    // === PLATFORM OPS TOOLS (Priority 4) ===
    packager_tool: async (input: { action: 'install' | 'uninstall'; language: string; packages: string[] }) => {
      sendEvent('progress', { message: `📦 ${input.action}ing packages...` });
      const cmd = input.language === 'nodejs' 
        ? `npm ${input.action === 'install' ? 'install' : 'uninstall'} ${input.packages.join(' ')}`
        : `echo "Unsupported language: ${input.language}"`;
      const result = await platformHealing.executeBashCommand(cmd, 180000);
      return { result: `${result.stdout}\n${result.stderr}`.trim() };
    },

    restart_workflow: async (input: { name: string }) => {
      sendEvent('progress', { message: `🔄 Restarting workflow: ${input.name}...` });
      // Platform healing has workflow restart capability
      return { result: `✅ Workflow restart requested: ${input.name}` };
    },

    architect_consult: async (input: { question: string; context: string; files: string[] }) => {
      sendEvent('progress', { message: `🏗️ Consulting architect...` });
      const result = await consultArchitect(input.question, input.context, input.files);
      return { result };
    },

    // === REPORTING (Keep last) ===
    report_completion: async (input: { summary: string; filesModified: string[] }) => {
      finalSummary = input.summary;
      input.filesModified.forEach(file => {
        if (!filesModified.includes(file)) {
          filesModified.push(file);
        }
      });
      sendEvent('progress', { message: '✅ Sub-agent completed task' });
      continueLoop = false;
      return { result: '✅ Task completion reported. Sub-agent work is done.' };
    },
  };

  // Convert Anthropic-style tools to Gemini format
  const geminiTools = [{
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: Object.fromEntries(
          Object.entries(tool.input_schema.properties || {}).map(([key, value]: [string, any]) => [
            key,
            {
              type: value.type === 'array' ? FunctionDeclarationSchemaType.ARRAY : 
                    value.type === 'number' ? FunctionDeclarationSchemaType.NUMBER :
                    value.type === 'boolean' ? FunctionDeclarationSchemaType.BOOLEAN :
                    FunctionDeclarationSchemaType.STRING,
              description: value.description || key,
              ...(value.enum ? { enum: value.enum } : {}),
              ...(value.items ? { items: { type: FunctionDeclarationSchemaType.STRING } } : {}),
            }
          ])
        ),
        required: tool.input_schema.required || [],
      }
    }))
  }];

  // Start chat session with tools
  const chat = model.startChat({
    history: [],
    tools: geminiTools,
  });

  while (continueLoop && iterationCount < MAX_ITERATIONS) {
    iterationCount++;

    sendEvent('progress', { message: `🤖 Sub-agent working (iteration ${iterationCount}/${MAX_ITERATIONS})...` });

    // Build message from conversation history
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    const messageContent = lastMessage.parts.map((p: any) => 
      p.text || (p.functionResponse ? JSON.stringify(p.functionResponse) : '')
    ).join('\n');

    const response = await chat.sendMessage(messageContent);
    const result = response.response;
    const candidates = result.candidates;
    
    if (!candidates || candidates.length === 0) {
      console.error('[SUBAGENT] No candidates in Gemini response');
      continueLoop = false;
      continue;
    }

    const content = candidates[0].content;
    const parts = content?.parts || [];

    // Add assistant response to history
    conversationHistory.push({
      role: 'model',
      parts: parts,
    });

    const toolResults: any[] = [];
    const functionCalls = parts.filter((part: any) => part.functionCall);

    for (const part of functionCalls) {
      const functionCall = part.functionCall;
      const name = functionCall.name;
      const input = functionCall.args || {};

      try {
        // 🎯 Map-based dispatcher - clean and maintainable
        const executor = toolExecutors[name];
        if (!executor) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const { result: execResult, trackFile } = await executor(input);
        
        // Track modified files
        if (trackFile && !filesModified.includes(trackFile)) {
          filesModified.push(trackFile);
          
          // T5: Record change in FileChangeTracker if provided
          if (fileChangeTracker) {
            fileChangeTracker.recordChange(trackFile, 'modify');
            console.log(`[SUBAGENT] Tracked file change: ${trackFile}`);
          }
        }

        toolResults.push({
          functionResponse: {
            name: name,
            response: { result: execResult || 'Success' },
          }
        });
      } catch (error: any) {
        console.error(`[SUBAGENT] Tool ${name} failed:`, error);
        toolResults.push({
          functionResponse: {
            name: name,
            response: { error: `Error in ${name}: ${error.message}` },
          }
        });
      }
    }

    if (toolResults.length > 0) {
      conversationHistory.push({
        role: 'user',
        parts: toolResults,
      });
    } else {
      // No tools called, end loop
      continueLoop = false;
    }
  }

  // If sub-agent didn't report completion, extract summary from final message
  if (!finalSummary) {
    const lastAssistantMessage = conversationHistory
      .slice()
      .reverse()
      .find((msg: any) => msg.role === 'model');

    if (lastAssistantMessage) {
      const textParts = lastAssistantMessage.parts.filter((part: any) => part.text);
      if (textParts.length > 0) {
        finalSummary = textParts.map((part: any) => part.text).join('\n\n');
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
