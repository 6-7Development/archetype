/**
 * SCOUT ORCHESTRATOR
 * Connects chat pipeline → workflow validator → tool execution
 * Enables Scout to actually execute tools and complete user requests
 */

import { WorkflowValidator, WorkflowPhase, WorkflowContext } from './workflowValidator';
import { scoutToolRegistry } from './scoutToolRegistry';
import { 
  handleReadFile, handleWriteFile, handleEditFile,
  handleBashCommand, handleGrep, handleListDirectory,
  handleGlobPattern, handleReadPlatformFile, handleWritePlatformFile,
  handleListPlatformFiles, handleSmartReadFile
} from '../routes/beehiveChat/tools/toolHandler';
import { parseToolResult, ToolResult } from './toolResponseValidator';

// Extended tool handlers (lazy loaded to avoid circular deps)
let commitToGitHub: ((args: any) => Promise<string>) | null = null;
let consultArchitect: ((args: any) => Promise<any>) | null = null;
let executeWebSearch: ((query: string, maxResults?: number) => Promise<any>) | null = null;
let dispatchSubagent: ((args: any) => Promise<any>) | null = null;

async function loadExtendedHandlers() {
  if (!commitToGitHub) {
    try {
      const github = await import('../tools/github-tools');
      commitToGitHub = github.commitToGitHub;
    } catch (e) { console.warn('[SCOUT-ORCHESTRATOR] GitHub tools not available'); }
  }
  if (!consultArchitect) {
    try {
      const architect = await import('../tools/architect-consult');
      consultArchitect = architect.consultArchitect;
    } catch (e) { console.warn('[SCOUT-ORCHESTRATOR] Architect consult not available'); }
  }
  if (!executeWebSearch) {
    try {
      const search = await import('../tools/web-search');
      executeWebSearch = search.executeWebSearch;
    } catch (e) { console.warn('[SCOUT-ORCHESTRATOR] Web search not available'); }
  }
  if (!dispatchSubagent) {
    try {
      const subagent = await import('../subagentOrchestration');
      dispatchSubagent = subagent.startSubagent;
    } catch (e) { console.warn('[SCOUT-ORCHESTRATOR] Subagent orchestration not available'); }
  }
}

/**
 * Pre-flight health check for critical integrations
 */
export async function checkIntegrationHealth(): Promise<{
  gemini: boolean;
  github: boolean;
  database: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // Check Gemini API key
  const geminiOk = !!process.env.GEMINI_API_KEY;
  if (!geminiOk) errors.push('GEMINI_API_KEY not configured');
  
  // Check GitHub
  const githubOk = !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
  if (!githubOk) errors.push('GitHub not configured (GITHUB_TOKEN or GITHUB_REPO missing)');
  
  // Check database
  const dbOk = !!process.env.DATABASE_URL;
  if (!dbOk) errors.push('DATABASE_URL not configured');
  
  return { gemini: geminiOk, github: githubOk, database: dbOk, errors };
}

/**
 * Orchestrator session state - tracks everything for multi-turn conversations
 */
export interface OrchestratorSession {
  sessionId: string;
  userId: string;
  projectId: string | null;
  targetContext: 'platform' | 'project';
  
  // Workflow state
  currentPhase: WorkflowPhase;
  phaseHistory: Array<{ phase: WorkflowPhase; timestamp: number }>;
  
  // Task tracking
  taskList: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  currentTaskId: string | null;
  
  // Tool execution history
  toolCalls: Array<{
    toolName: string;
    params: Record<string, any>;
    result: ToolResult;
    timestamp: number;
    phase: WorkflowPhase;
  }>;
  
  // File change tracking
  modifiedFiles: Map<string, {
    operation: 'read' | 'write' | 'edit' | 'delete';
    timestamp: number;
    contentBefore?: string;
    contentAfter?: string;
  }>;
  
  // Metrics
  startTime: number;
  iterationCount: number;
  totalTokensUsed: number;
  
  // Rollback capability - tracks file changes for undo
  rollbackStack?: Array<{
    operation: 'write' | 'edit';
    filePath: string;
    contentBefore: string | null;
    oldString?: string;
    newString?: string;
    timestamp: number;
  }>;
}

/**
 * Tool call from Gemini function calling
 */
export interface GeminiToolCall {
  name: string;
  args: Record<string, any>;
}

/**
 * Tool dispatch result
 */
export interface ToolDispatchResult {
  toolName: string;
  success: boolean;
  result: ToolResult;
  executionTimeMs: number;
  phase: WorkflowPhase;
  phaseViolation?: string;
}

class ScoutOrchestrator {
  private sessions: Map<string, OrchestratorSession> = new Map();
  private validators: Map<string, WorkflowValidator> = new Map();
  
  /**
   * Create or get existing session
   */
  getOrCreateSession(params: {
    sessionId: string;
    userId: string;
    projectId: string | null;
    targetContext: 'platform' | 'project';
  }): OrchestratorSession {
    const existing = this.sessions.get(params.sessionId);
    if (existing) {
      return existing;
    }
    
    const session: OrchestratorSession = {
      sessionId: params.sessionId,
      userId: params.userId,
      projectId: params.projectId,
      targetContext: params.targetContext,
      currentPhase: 'assess',
      phaseHistory: [{ phase: 'assess', timestamp: Date.now() }],
      taskList: [],
      currentTaskId: null,
      toolCalls: [],
      modifiedFiles: new Map(),
      startTime: Date.now(),
      iterationCount: 0,
      totalTokensUsed: 0,
    };
    
    this.sessions.set(params.sessionId, session);
    
    // Create validator for this session (enabled by default via constructor)
    const validator = new WorkflowValidator('assess', { enabled: true, strictMode: false });
    this.validators.set(params.sessionId, validator);
    
    console.log(`[SCOUT-ORCHESTRATOR] Session created: ${params.sessionId}`);
    return session;
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId: string): OrchestratorSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Advance workflow phase
   */
  advancePhase(sessionId: string, newPhase: WorkflowPhase): boolean {
    const session = this.sessions.get(sessionId);
    const validator = this.validators.get(sessionId);
    
    if (!session || !validator) {
      console.error(`[SCOUT-ORCHESTRATOR] Session not found: ${sessionId}`);
      return false;
    }
    
    // Get workflow context for validation
    const context = this.buildWorkflowContext(session);
    
    // Validate phase transition
    const validationResult = validator.validatePhaseTransition(session.currentPhase, newPhase, context);
    
    if (!validationResult.valid) {
      console.warn(`[SCOUT-ORCHESTRATOR] Phase transition blocked: ${session.currentPhase} → ${newPhase}`, validationResult.errors);
      return false;
    }
    
    // Execute transition
    session.currentPhase = newPhase;
    session.phaseHistory.push({ phase: newPhase, timestamp: Date.now() });
    validator.announcePhase(newPhase);
    
    console.log(`[SCOUT-ORCHESTRATOR] Phase advanced: ${session.currentPhase} → ${newPhase}`);
    return true;
  }
  
  /**
   * Build workflow context from session state
   */
  private buildWorkflowContext(session: OrchestratorSession): WorkflowContext {
    const writeOperations = session.toolCalls.filter(tc => 
      ['write', 'edit', 'write_file', 'write_platform_file', 'edit_file'].some(w => 
        tc.toolName.toLowerCase().includes(w)
      )
    );
    
    return {
      hasTaskList: session.taskList.length > 0,
      testsRun: session.toolCalls.some(tc => 
        tc.toolName.includes('test') || tc.toolName.includes('playwright')
      ),
      verificationComplete: session.toolCalls.some(tc => 
        tc.toolName.includes('verify') || tc.toolName.includes('check')
      ),
      commitExecuted: session.toolCalls.some(tc => 
        tc.toolName.includes('git_commit')
      ),
      filesModified: writeOperations.length,
      iterationCount: session.iterationCount,
    };
  }
  
  /**
   * Dispatch tool call from Gemini to actual handler
   */
  async dispatchToolCall(
    sessionId: string,
    toolCall: GeminiToolCall
  ): Promise<ToolDispatchResult> {
    const startTime = Date.now();
    const session = this.sessions.get(sessionId);
    const validator = this.validators.get(sessionId);
    
    if (!session) {
      return {
        toolName: toolCall.name,
        success: false,
        result: { success: false, error: 'Session not found' },
        executionTimeMs: Date.now() - startTime,
        phase: 'assess',
      };
    }
    
    const currentPhase = session.currentPhase;
    let phaseViolation: string | undefined;
    
    // Validate tool call against current phase
    if (validator) {
      const validation = validator.validateToolCall(toolCall.name, currentPhase);
      if (!validation.allowed) {
        phaseViolation = validation.reason;
        console.warn(`[SCOUT-ORCHESTRATOR] Phase violation: ${toolCall.name} in ${currentPhase} - ${validation.reason}`);
      }
    }
    
    // Note: Skip registry validation for orchestrator-handled tools
    // The orchestrator has its own comprehensive switch statement that handles
    // tool execution directly. Registry validation uses different naming conventions
    // (e.g., 'read-file' vs 'read') and would fail for orchestrator-native tools.
    
    // Execute the tool
    try {
      const result = await this.executeToolHandler(toolCall.name, toolCall.args, session);
      
      // Record the tool call
      session.toolCalls.push({
        toolName: toolCall.name,
        params: toolCall.args,
        result,
        timestamp: Date.now(),
        phase: currentPhase,
      });
      
      session.iterationCount++;
      
      // Track file modifications
      this.trackFileModification(session, toolCall.name, toolCall.args, result);
      
      return {
        toolName: toolCall.name,
        success: result.success,
        result,
        executionTimeMs: Date.now() - startTime,
        phase: currentPhase,
        phaseViolation,
      };
    } catch (error: any) {
      const errorResult: ToolResult = {
        success: false,
        error: `Tool execution failed: ${error.message}`,
      };
      
      return {
        toolName: toolCall.name,
        success: false,
        result: errorResult,
        executionTimeMs: Date.now() - startTime,
        phase: currentPhase,
        phaseViolation,
      };
    }
  }
  
  /**
   * Execute the appropriate tool handler
   */
  private async executeToolHandler(
    toolName: string,
    args: Record<string, any>,
    session: OrchestratorSession
  ): Promise<ToolResult> {
    const normalizedName = toolName.toLowerCase().replace(/_/g, '');
    
    try {
      let rawResult: string;
      
      // Map tool names to handlers
      switch (normalizedName) {
        // File operations
        case 'read':
        case 'readfile':
        case 'readplatformfile':
          rawResult = await handleReadPlatformFile(args.file_path || args.filePath || args.path);
          break;
          
        case 'write':
        case 'writefile':
        case 'writeplatformfile':
          {
            const filePath = args.file_path || args.filePath || args.path;
            // Capture content before write for rollback capability
            let contentBefore: string | null = null;
            try {
              const fs = await import('fs/promises');
              contentBefore = await fs.readFile(filePath, 'utf-8');
            } catch (e) { /* file doesn't exist yet */ }
            
            rawResult = await handleWritePlatformFile(filePath, args.content);
            
            // Store rollback info in session
            if (!session.rollbackStack) session.rollbackStack = [];
            session.rollbackStack.push({
              operation: 'write',
              filePath,
              contentBefore,
              timestamp: Date.now(),
            });
          }
          break;
          
        case 'edit':
        case 'editfile':
          {
            const filePath = args.file_path || args.filePath || args.path;
            // Capture content before edit for rollback capability
            let contentBefore: string | null = null;
            try {
              const fs = await import('fs/promises');
              contentBefore = await fs.readFile(filePath, 'utf-8');
            } catch (e) { /* file doesn't exist */ }
            
            rawResult = await handleEditFile(
              filePath,
              args.old_string || args.oldString,
              args.new_string || args.newString
            );
            
            // Store rollback info in session
            if (!session.rollbackStack) session.rollbackStack = [];
            session.rollbackStack.push({
              operation: 'edit',
              filePath,
              contentBefore,
              oldString: args.old_string || args.oldString,
              newString: args.new_string || args.newString,
              timestamp: Date.now(),
            });
          }
          break;
          
        case 'ls':
        case 'listdirectory':
        case 'listplatformfiles':
          rawResult = await handleListPlatformFiles(args.path || args.directory || '.');
          break;
          
        case 'glob':
        case 'globfiles':
          rawResult = await handleGlobPattern(args.pattern, args.path || '.');
          break;
          
        case 'grep':
        case 'search':
          rawResult = await handleGrep(args.pattern, args.path || '.');
          break;
          
        case 'bash':
        case 'shell':
        case 'execute':
          rawResult = await handleBashCommand(args.command, args.timeout || 120000);
          break;
          
        case 'smartreadfile':
        case 'smartread':
          rawResult = await handleSmartReadFile(args.file_path || args.filePath, args.context || '');
          break;
          
        // Task management (return structured responses)
        case 'createtasklist':
        case 'writetasklist':
          session.taskList = (args.tasks || []).map((t: any, i: number) => ({
            id: t.id || `task-${i + 1}`,
            content: t.content || t.title || t.description,
            status: t.status || 'pending',
          }));
          rawResult = `✅ Task list created with ${session.taskList.length} tasks`;
          break;
          
        case 'updatetask':
          const task = session.taskList.find(t => t.id === args.taskId || t.id === args.id);
          if (task) {
            task.status = args.status || 'completed';
            rawResult = `✅ Task ${task.id} updated to ${task.status}`;
          } else {
            rawResult = `❌ Task not found: ${args.taskId || args.id}`;
          }
          break;
          
        case 'readtasklist':
          const taskListStr = session.taskList.map(t => 
            `[${t.status}] ${t.id}: ${t.content}`
          ).join('\n');
          rawResult = `✅ Current tasks:\n${taskListStr || '(no tasks)'}`;
          break;
        
        // Extended tools (lazy loaded)
        case 'committogithub':
        case 'commit_to_github':
          await loadExtendedHandlers();
          if (commitToGitHub) {
            // Build files array from args - support multiple formats
            let filesToCommit: Array<{ path: string; content?: string; operation?: 'create' | 'modify' | 'delete' }> = [];
            
            if (args.files && Array.isArray(args.files)) {
              // Files can be strings or objects
              filesToCommit = args.files.map((f: any) => {
                if (typeof f === 'string') {
                  return { path: f, operation: 'modify' as const };
                }
                return { path: f.path || f, content: f.content, operation: f.operation || 'modify' };
              });
            } else if (args.filePaths && Array.isArray(args.filePaths)) {
              filesToCommit = args.filePaths.map((p: string) => ({ path: p, operation: 'modify' as const }));
            } else if (session.modifiedFiles && session.modifiedFiles.size > 0) {
              // Use session's tracked modified files as fallback
              filesToCommit = Array.from(session.modifiedFiles).map(p => ({ path: p, operation: 'modify' as const }));
            }
            
            rawResult = await commitToGitHub({ 
              message: args.commitMessage || args.message || 'Scout: automated commit',
              files: filesToCommit
            });
          } else {
            rawResult = '❌ GitHub tools not available';
          }
          break;
          
        case 'consultarchitect':
        case 'consult_architect':
          await loadExtendedHandlers();
          if (consultArchitect) {
            const result = await consultArchitect({
              problem: args.question,
              context: args.context,
              previousAttempts: args.rationale ? [args.rationale] : [],
              codeSnapshot: args.relevant_files || args.relevantFiles,
            });
            rawResult = result.success 
              ? `✅ Architect guidance:\n${result.guidance}\n\nRecommendations:\n${(result.recommendations || []).join('\n')}`
              : `❌ Architect consultation failed: ${result.error}`;
          } else {
            rawResult = '❌ Architect consultation not available';
          }
          break;
          
        case 'websearch':
        case 'web_search':
          await loadExtendedHandlers();
          if (executeWebSearch) {
            const searchResult = await executeWebSearch(args.query, args.maxResults || 5);
            rawResult = searchResult.success 
              ? `✅ Search results:\n${JSON.stringify(searchResult.results, null, 2)}`
              : `❌ Search failed: ${searchResult.error}`;
          } else {
            rawResult = '❌ Web search not available';
          }
          break;
          
        case 'dispatchsubagent':
        case 'dispatch_subagent':
          await loadExtendedHandlers();
          if (dispatchSubagent) {
            try {
              const subagentResult = await dispatchSubagent({
                task: args.task,
                relevantFiles: args.relevantFiles || args.relevant_files || [],
                userId: session.userId,
                sendEvent: (type: string, data: any) => {
                  console.log(`[SUBAGENT-${type}]`, data.message || JSON.stringify(data));
                },
              });
              rawResult = subagentResult.success 
                ? `✅ Subagent completed: ${subagentResult.summary}\nModified: ${subagentResult.filesModified.join(', ') || 'none'}`
                : `❌ Subagent failed: ${subagentResult.error || 'Unknown error'}`;
            } catch (e: any) {
              rawResult = `❌ Subagent error: ${e.message}`;
            }
          } else {
            rawResult = '❌ Subagent orchestration not available';
          }
          break;
          
        default:
          rawResult = `⚠️ Tool not implemented: ${toolName}`;
          console.warn(`[SCOUT-ORCHESTRATOR] Unknown tool: ${toolName}`);
      }
      
      return parseToolResult(rawResult);
    } catch (error: any) {
      return {
        success: false,
        error: `Handler error: ${error.message}`,
      };
    }
  }
  
  /**
   * Track file modifications for rollback support
   */
  private trackFileModification(
    session: OrchestratorSession,
    toolName: string,
    args: Record<string, any>,
    result: ToolResult
  ): void {
    const lowerName = toolName.toLowerCase();
    const filePath = args.file_path || args.filePath || args.path;
    
    if (!filePath) return;
    
    let operation: 'read' | 'write' | 'edit' | 'delete' = 'read';
    
    if (lowerName.includes('write')) operation = 'write';
    else if (lowerName.includes('edit')) operation = 'edit';
    else if (lowerName.includes('delete')) operation = 'delete';
    
    session.modifiedFiles.set(filePath, {
      operation,
      timestamp: Date.now(),
      contentAfter: operation === 'write' ? args.content : undefined,
    });
  }
  
  /**
   * Get session summary for AI context
   */
  getSessionSummary(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return 'No session found';
    
    const taskSummary = session.taskList.length > 0
      ? session.taskList.map(t => `- [${t.status}] ${t.content}`).join('\n')
      : 'No tasks defined';
    
    const recentTools = session.toolCalls.slice(-5).map(tc => 
      `- ${tc.toolName}: ${tc.result.success ? '✅' : '❌'}`
    ).join('\n');
    
    return `
## Session State
- Phase: ${session.currentPhase.toUpperCase()}
- Iterations: ${session.iterationCount}
- Modified Files: ${session.modifiedFiles.size}

## Tasks
${taskSummary}

## Recent Tool Calls
${recentTools || 'None yet'}
    `.trim();
  }
  
  /**
   * Cleanup old sessions
   */
  cleanupSessions(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions) {
      if (now - session.startTime > maxAgeMs) {
        this.sessions.delete(sessionId);
        this.validators.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[SCOUT-ORCHESTRATOR] Cleaned up ${cleaned} stale sessions`);
    }
    
    return cleaned;
  }
  
  /**
   * Get orchestrator stats
   */
  getStats(): {
    activeSessions: number;
    totalToolCalls: number;
    phaseDistribution: Record<WorkflowPhase, number>;
  } {
    const phaseDistribution: Record<WorkflowPhase, number> = {
      assess: 0, plan: 0, execute: 0, test: 0, 
      verify: 0, confirm: 0, commit: 0, completed: 0,
    };
    
    let totalToolCalls = 0;
    
    for (const session of this.sessions.values()) {
      phaseDistribution[session.currentPhase]++;
      totalToolCalls += session.toolCalls.length;
    }
    
    return {
      activeSessions: this.sessions.size,
      totalToolCalls,
      phaseDistribution,
    };
  }
}

export const scoutOrchestrator = new ScoutOrchestrator();

/**
 * Process Gemini function calls through the orchestrator
 */
export async function processGeminiFunctionCalls(
  sessionId: string,
  functionCalls: GeminiToolCall[]
): Promise<ToolDispatchResult[]> {
  const results: ToolDispatchResult[] = [];
  
  for (const call of functionCalls) {
    const result = await scoutOrchestrator.dispatchToolCall(sessionId, call);
    results.push(result);
    
    // Log for debugging
    console.log(`[SCOUT-ORCHESTRATOR] Tool: ${call.name} -> ${result.success ? '✅' : '❌'} (${result.executionTimeMs}ms)`);
  }
  
  return results;
}

/**
 * Format tool results for Gemini conversation history
 */
export function formatToolResultsForGemini(results: ToolDispatchResult[]): string {
  return results.map(r => {
    const status = r.success ? '✅' : '❌';
    const data = r.result.data ? JSON.stringify(r.result.data, null, 2) : r.result.error || 'No data';
    return `### ${r.toolName} ${status}\n${data}`;
  }).join('\n\n');
}
