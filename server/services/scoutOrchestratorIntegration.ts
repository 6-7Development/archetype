/**
 * SCOUT ORCHESTRATOR INTEGRATION
 * Connects orchestrator with existing chat flow
 * Provides hooks for tool execution and workflow management
 */

import { scoutOrchestrator, OrchestratorSession, GeminiToolCall, ToolDispatchResult } from './scoutOrchestrator';
import { WorkflowPhase } from './workflowValidator';
import { convertToGeminiFunctionDeclarations, getAllToolSchemas } from './geminiToolSchemas';
import { parseToolResult, ToolResult } from './toolResponseValidator';

/**
 * Initialize orchestrator for a chat session
 */
export function initializeScoutSession(params: {
  sessionId: string;
  userId: string;
  projectId: string | null;
  targetContext: 'platform' | 'project';
}): OrchestratorSession {
  const session = scoutOrchestrator.getOrCreateSession(params);
  console.log(`[SCOUT-INTEGRATION] Session initialized: ${params.sessionId} (phase: ${session.currentPhase})`);
  return session;
}

/**
 * Get Gemini function declarations for tool registration
 */
export function getGeminiToolDeclarations() {
  return convertToGeminiFunctionDeclarations();
}

/**
 * Process tool calls from Gemini response through orchestrator
 */
export async function processToolCallsWithOrchestrator(
  sessionId: string,
  functionCalls: Array<{ name: string; args: Record<string, any> }>
): Promise<ToolDispatchResult[]> {
  const results: ToolDispatchResult[] = [];
  
  for (const call of functionCalls) {
    const result = await scoutOrchestrator.dispatchToolCall(sessionId, {
      name: call.name,
      args: call.args,
    });
    results.push(result);
  }
  
  return results;
}

/**
 * Convert tool results to format expected by Gemini conversation history
 */
export function formatToolResultsForConversation(results: ToolDispatchResult[]): any[] {
  return results.map(r => ({
    type: 'tool_result',
    tool_use_id: `${r.toolName}-${Date.now()}`,
    content: r.success 
      ? (typeof r.result.data === 'string' ? r.result.data : JSON.stringify(r.result.data))
      : `Error: ${r.result.error}`,
  }));
}

/**
 * Detect and announce phase from AI content
 */
export function detectPhaseFromContent(sessionId: string, content: string): WorkflowPhase | null {
  const phasePatterns: Record<WorkflowPhase, RegExp[]> = {
    assess: [
      /\[?ASSESS\]?/i,
      /assessing/i,
      /let me examine/i,
      /analyzing the/i,
    ],
    plan: [
      /\[?PLAN\]?/i,
      /here'?s my plan/i,
      /planning to/i,
      /task list/i,
    ],
    execute: [
      /\[?EXECUTE\]?/i,
      /implementing/i,
      /making the change/i,
      /writing the/i,
    ],
    test: [
      /\[?TEST\]?/i,
      /testing/i,
      /running tests/i,
      /verifying the fix/i,
    ],
    verify: [
      /\[?VERIFY\]?/i,
      /verification/i,
      /confirming/i,
      /checking compilation/i,
    ],
    confirm: [
      /\[?CONFIRM\]?/i,
      /completed successfully/i,
      /everything works/i,
    ],
    commit: [
      /\[?COMMIT\]?/i,
      /committing/i,
      /git commit/i,
    ],
    completed: [
      /task complete/i,
      /all done/i,
      /finished/i,
    ],
  };
  
  for (const [phase, patterns] of Object.entries(phasePatterns) as [WorkflowPhase, RegExp[]][]) {
    if (patterns.some(p => p.test(content))) {
      const session = scoutOrchestrator.getSession(sessionId);
      if (session && session.currentPhase !== phase) {
        scoutOrchestrator.advancePhase(sessionId, phase);
        console.log(`[SCOUT-INTEGRATION] Phase detected from content: ${phase}`);
      }
      return phase;
    }
  }
  
  return null;
}

/**
 * Get current session state summary for debugging/display
 */
export function getSessionSummary(sessionId: string): string {
  return scoutOrchestrator.getSessionSummary(sessionId);
}

/**
 * Get orchestrator statistics
 */
export function getOrchestratorStats() {
  return scoutOrchestrator.getStats();
}

/**
 * Execute a single tool call with orchestrator tracking
 * This bridges the gap between the existing tool handler and the orchestrator
 */
export async function executeToolWithTracking(
  sessionId: string,
  toolName: string,
  toolArgs: Record<string, any>,
  existingHandler: (args: any) => Promise<string>
): Promise<{ success: boolean; result: string; tracked: boolean }> {
  try {
    // Initialize session if not exists
    const session = scoutOrchestrator.getSession(sessionId);
    if (!session) {
      // Just execute without tracking if no session
      const result = await existingHandler(toolArgs);
      return { success: !result.startsWith('❌'), result, tracked: false };
    }
    
    // Execute through orchestrator's dispatch for tracking
    const dispatchResult = await scoutOrchestrator.dispatchToolCall(sessionId, {
      name: toolName,
      args: toolArgs,
    });
    
    // Return in expected format
    const resultStr = dispatchResult.success
      ? (typeof dispatchResult.result.data === 'string' 
          ? dispatchResult.result.data 
          : JSON.stringify(dispatchResult.result.data))
      : `❌ ${dispatchResult.result.error}`;
    
    return {
      success: dispatchResult.success,
      result: resultStr,
      tracked: true,
    };
  } catch (error: any) {
    console.error(`[SCOUT-INTEGRATION] Tool execution error: ${error.message}`);
    return {
      success: false,
      result: `❌ Error: ${error.message}`,
      tracked: false,
    };
  }
}

/**
 * Create task list through orchestrator
 */
export function createTaskListInSession(
  sessionId: string,
  tasks: Array<{ id: string; content: string; status?: string }>
): boolean {
  const session = scoutOrchestrator.getSession(sessionId);
  if (!session) return false;
  
  session.taskList = tasks.map(t => ({
    id: t.id,
    content: t.content,
    status: (t.status as 'pending' | 'in_progress' | 'completed') || 'pending',
  }));
  
  // Advance to plan phase if we're in assess
  if (session.currentPhase === 'assess') {
    scoutOrchestrator.advancePhase(sessionId, 'plan');
  }
  
  return true;
}

/**
 * Update task status through orchestrator
 */
export function updateTaskInSession(
  sessionId: string,
  taskId: string,
  status: 'pending' | 'in_progress' | 'completed'
): boolean {
  const session = scoutOrchestrator.getSession(sessionId);
  if (!session) return false;
  
  const task = session.taskList.find(t => t.id === taskId);
  if (!task) return false;
  
  task.status = status;
  
  // Auto-advance phases based on task completion
  if (status === 'in_progress' && session.currentPhase === 'plan') {
    scoutOrchestrator.advancePhase(sessionId, 'execute');
  }
  
  // Check if all tasks completed
  const allCompleted = session.taskList.every(t => t.status === 'completed');
  if (allCompleted && session.currentPhase === 'execute') {
    scoutOrchestrator.advancePhase(sessionId, 'verify');
  }
  
  return true;
}

/**
 * Build system prompt enhancement with current workflow state
 */
export function getWorkflowStatePrompt(sessionId: string): string {
  const session = scoutOrchestrator.getSession(sessionId);
  if (!session) return '';
  
  const taskList = session.taskList.length > 0
    ? session.taskList.map(t => `- [${t.status.toUpperCase()}] ${t.content}`).join('\n')
    : 'No tasks defined yet';
  
  const recentTools = session.toolCalls.slice(-3).map(tc => 
    `${tc.toolName}: ${tc.result.success ? '✅' : '❌'}`
  ).join(', ');
  
  return `
## CURRENT WORKFLOW STATE
Phase: ${session.currentPhase.toUpperCase()}
Iteration: ${session.iterationCount}
Modified Files: ${session.modifiedFiles.size}

## TASK LIST
${taskList}

## RECENT TOOL RESULTS
${recentTools || 'None yet'}

## WORKFLOW RULES
- ASSESS: Read files, analyze issue, gather context
- PLAN: Create task list with clear steps
- EXECUTE: Implement changes using write/edit tools
- TEST: Run tests to verify changes work
- VERIFY: Check compilation and integration
- CONFIRM: Ensure all requirements met
- COMMIT: Git commit changes (if applicable)
`.trim();
}

/**
 * Cleanup expired sessions
 */
export function cleanupSessions(): number {
  return scoutOrchestrator.cleanupSessions();
}
