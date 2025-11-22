import { db } from '../db';
import { agentRuns, creditWallets, creditLedger } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { CreditManager } from './creditManager';
import { createEvent, BillingEstimateData, BillingReconciledData } from '@shared/agentEvents';
import type { WebSocketServer } from 'ws';
import { validateToolResult } from '../validation/toolResultValidators';

export class AgentExecutor {
  /**
   * Create new agent run and reserve credits
   * 
   * NEW: Accepts token estimates for accurate credit calculation
   * - Platform healing (targetContext='platform'): FREE (0 credits)
   * - Project work (targetContext='project'): Calculate from tokens or use estimatedCredits fallback
   */
  static async startRun(params: {
    userId: string;
    projectId: string | null;
    estimatedInputTokens?: number;   // NEW: Token estimate for input
    estimatedOutputTokens?: number;  // NEW: Token estimate for output
    estimatedCredits?: number;       // OLD: Fallback if tokens not provided
    targetContext: 'platform' | 'project'; // NEW: Determine FREE vs PAID
    wss?: WebSocketServer;           // NEW: For billing event emission
    sessionId?: string;              // NEW: For billing event correlation
  }): Promise<{ success: boolean; runId?: string; error?: string; creditsReserved?: number }> {
    const { userId, projectId, estimatedInputTokens, estimatedOutputTokens, estimatedCredits, targetContext, wss, sessionId } = params;

    try {
      // Calculate credits needed based on targetContext
      let creditsNeeded: number;

      if (targetContext === 'platform') {
        // Platform healing = FREE for owners
        creditsNeeded = 0;
        console.log('[AGENT-EXECUTOR] Platform healing - FREE access (0 credits)');
      } else if (estimatedInputTokens !== undefined && estimatedOutputTokens !== undefined) {
        // Calculate from token estimates (preferred method)
        creditsNeeded = CreditManager.calculateCreditsForTokens(estimatedInputTokens, estimatedOutputTokens);
        console.log(`[AGENT-EXECUTOR] Calculated ${creditsNeeded} credits from tokens (input: ${estimatedInputTokens}, output: ${estimatedOutputTokens})`);
      } else if (estimatedCredits !== undefined) {
        // Fallback to estimated credits
        creditsNeeded = estimatedCredits;
        console.log(`[AGENT-EXECUTOR] Using fallback estimated credits: ${creditsNeeded}`);
      } else {
        // No estimates provided - use conservative default
        creditsNeeded = 100;
        console.warn('[AGENT-EXECUTOR] No token or credit estimates provided - using default 100 credits');
      }

      // Create agent run record
      const [run] = await db
        .insert(agentRuns)
        .values({
          userId,
          projectId,
          status: 'running',
          creditsReserved: creditsNeeded,
          creditsConsumed: 0,
          context: {},
        })
        .returning();

      // Reserve credits if needed (skip for FREE platform access)
      if (creditsNeeded > 0) {
        const reservation = await CreditManager.reserveCredits({
          userId,
          creditsNeeded,
          agentRunId: run.id,
          wss,
          sessionId,
        });

        if (!reservation.success) {
          // Failed to reserve - delete run and return error
          await db.delete(agentRuns).where(eq(agentRuns.id, run.id));
          return { success: false, error: reservation.error };
        }
      }

      // Get current credit balance for billing event
      const [wallet] = await db
        .select()
        .from(creditWallets)
        .where(eq(creditWallets.userId, userId));

      const currentBalance = wallet ? wallet.availableCredits : 0;

      // Emit billing.estimate event if WebSocket is available
      if (wss && sessionId) {
        const { broadcastToUser } = await import('../routes/websocket');
        const estimateEvent = createEvent<BillingEstimateData>(
          'billing.estimate',
          'system',
          {
            runId: run.id,
            sessionId,
            estimatedInputTokens: estimatedInputTokens || 0,
            estimatedOutputTokens: estimatedOutputTokens || 0,
            estimatedCredits: creditsNeeded,
            estimatedCostUsd: CreditManager.calculateUSDForCredits(creditsNeeded),
            creditBalance: currentBalance,
            isFreeAccess: creditsNeeded === 0,
            initialMonthlyCredits: wallet ? wallet.initialMonthlyCredits : 5000,
          }
        );
        broadcastToUser(wss, userId, estimateEvent);
        console.log('[AGENT-EXECUTOR] Emitted billing.estimate event');
      }

      return { success: true, runId: run.id, creditsReserved: creditsNeeded };
    } catch (error: any) {
      console.error('[AGENT-EXECUTOR] Error starting run:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if agent should pause due to credit depletion
   */
  static async shouldPause(runId: string): Promise<boolean> {
    try {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));

      if (!run) return true;

      // CRITICAL FIX: Never pause for owners (creditsReserved === 0)
      if (run.creditsReserved === 0) {
        return false;
      }

      // Check if consumed credits exceed reserved
      if (run.creditsConsumed >= run.creditsReserved) {
        return true;
      }

      return false;
    } catch (error) {
      return true; // Pause on error to be safe
    }
  }

  /**
   * Pause agent run and save state
   */
  static async pauseRun(params: {
    runId: string;
    context: any;
  }): Promise<{ success: boolean; error?: string }> {
    const { runId, context } = params;

    try {
      await db
        .update(agentRuns)
        .set({
          status: 'paused',
          context,
          pausedAt: new Date(),
        })
        .where(eq(agentRuns.id, runId));

      return { success: true };
    } catch (error: any) {
      console.error('[AGENT-EXECUTOR] Error pausing run:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume agent run after credit top-up
   */
  static async resumeRun(params: {
    runId: string;
    additionalCredits: number;
  }): Promise<{ success: boolean; context?: any; error?: string }> {
    const { runId, additionalCredits } = params;

    try {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));

      if (!run) {
        return { success: false, error: 'Run not found' };
      }

      if (run.status !== 'paused') {
        return { success: false, error: 'Run is not paused' };
      }

      // Reserve additional credits
      const reservation = await CreditManager.reserveCredits({
        userId: run.userId,
        creditsNeeded: additionalCredits,
        agentRunId: runId,
      });

      if (!reservation.success) {
        return { success: false, error: reservation.error };
      }

      // Update run with additional credits and resume
      await db
        .update(agentRuns)
        .set({
          status: 'running',
          creditsReserved: run.creditsReserved + additionalCredits,
          resumedAt: new Date(),
        })
        .where(eq(agentRuns.id, runId));

      return { success: true, context: run.context };
    } catch (error: any) {
      console.error('[AGENT-EXECUTOR] Error resuming run:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete agent run and reconcile credits
   * 
   * OVERLOADED: Supports both legacy and new signatures for backward compatibility
   * - NEW: completeRun({ runId, actualCreditsUsed, source, wss, sessionId, finalInputTokens, finalOutputTokens })
   * - LEGACY: completeRun(runId, creditsUsed) - defaults source to 'lomu_chat'
   * 
   * CRITICAL FIX: All database operations wrapped in single transaction to prevent inconsistent state
   */
  static async completeRun(
    paramsOrRunId: { 
      runId: string; 
      actualCreditsUsed: number; 
      source: 'lomu_chat' | 'architect_consultation';
      wss?: WebSocketServer;
      sessionId?: string;
      finalInputTokens?: number;
      finalOutputTokens?: number;
    } | string,
    creditsUsed?: number
  ): Promise<{ success: boolean; error?: string }> {
    // Backward compatibility: Handle both old (positional) and new (object) signatures
    let runId: string;
    let actualCreditsUsed: number;
    let source: 'lomu_chat' | 'architect_consultation';
    let wss: WebSocketServer | undefined;
    let sessionId: string | undefined;
    let finalInputTokens = 0;
    let finalOutputTokens = 0;

    if (typeof paramsOrRunId === 'string') {
      // LEGACY SIGNATURE: completeRun(runId, creditsUsed)
      runId = paramsOrRunId;
      actualCreditsUsed = creditsUsed ?? 0;
      source = 'lomu_chat'; // Default source for legacy callers
      console.log('[AGENT-EXECUTOR] Using LEGACY completeRun signature');
    } else {
      // NEW SIGNATURE: completeRun({ runId, actualCreditsUsed, source, ... })
      ({ runId, actualCreditsUsed, source, wss, sessionId, finalInputTokens = 0, finalOutputTokens = 0 } = paramsOrRunId);
      console.log('[AGENT-EXECUTOR] Using NEW completeRun signature');
    }

    try {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));

      if (!run) {
        return { success: false, error: 'Run not found' };
      }

      // CRITICAL FIX: Wrap ALL operations in a SINGLE transaction for atomicity
      // This ensures credits are only reconciled if agent run update succeeds
      let newBalance = 0;
      const creditsRefunded = run.creditsReserved - actualCreditsUsed;

      if (run.creditsReserved > 0) {
        // Execute credit reconciliation + run update + balance fetch atomically
        const result = await db.transaction(async (tx) => {
          const creditsToReturn = run.creditsReserved - actualCreditsUsed;

          // 1. Update credit wallet atomically
          const updateResult = await tx
            .update(creditWallets)
            .set({
              availableCredits: sql`available_credits + ${creditsToReturn}`,
              reservedCredits: sql`reserved_credits - ${run.creditsReserved}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(creditWallets.userId, run.userId),
                sql`reserved_credits >= ${run.creditsReserved}` // Guard against negative reserved
              )
            )
            .returning();

          if (updateResult.length === 0) {
            throw new Error('Insufficient reserved credits to reconcile');
          }

          // 2. Log consumption to credit ledger
          await tx.insert(creditLedger).values({
            userId: run.userId,
            deltaCredits: -actualCreditsUsed,
            usdAmount: null,
            source,
            referenceId: runId,
            metadata: {
              projectId: run.projectId,
              creditsReserved: run.creditsReserved,
              creditsReturned: creditsToReturn,
            },
          });

          // 3. Update agent run status
          await tx
            .update(agentRuns)
            .set({
              status: 'completed',
              creditsConsumed: actualCreditsUsed,
              completedAt: new Date(),
            })
            .where(eq(agentRuns.id, runId));

          // 4. Get final wallet balance (inside transaction for consistency)
          const [wallet] = await tx
            .select()
            .from(creditWallets)
            .where(eq(creditWallets.userId, run.userId));

          return { wallet, updateResult };
        });

        // Extract balance from transaction result
        newBalance = result.wallet ? result.wallet.availableCredits : 0;
      } else {
        // No credits to reconcile (FREE access) - just update run status
        await db
          .update(agentRuns)
          .set({
            status: 'completed',
            creditsConsumed: actualCreditsUsed,
            completedAt: new Date(),
          })
          .where(eq(agentRuns.id, runId));

        // Get final wallet balance for FREE access
        const [wallet] = await db
          .select()
          .from(creditWallets)
          .where(eq(creditWallets.userId, run.userId));

        newBalance = wallet ? wallet.availableCredits : 0;
      }

      // Emit billing.reconciled event if WebSocket is available
      if (wss && sessionId) {
        const { broadcastToUser } = await import('../routes/websocket');
        const reconciledEvent = createEvent<BillingReconciledData>(
          'billing.reconciled',
          'system',
          {
            runId,
            sessionId,
            finalInputTokens,
            finalOutputTokens,
            creditsReserved: run.creditsReserved,
            creditsActuallyUsed: actualCreditsUsed,
            creditsRefunded,
            finalCostUsd: CreditManager.calculateUSDForCredits(actualCreditsUsed),
            newCreditBalance: newBalance,
          }
        );
        broadcastToUser(wss, run.userId, reconciledEvent);
        console.log('[AGENT-EXECUTOR] Emitted billing.reconciled event');
      }

      return { success: true };
    } catch (error: any) {
      console.error('[AGENT-EXECUTOR] Error completing run:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a tool and return its result
   * Dispatches tool execution to appropriate handlers
   * 
   * ✅ VALIDATION: All tool results are validated and sanitized before returning
   * to prevent malformed data from corrupting conversation history.
   */
  static async executeTool(
    toolName: string,
    input: Record<string, any>,
    context: {
      userId: string;
      sessionId: string;
      projectId?: string;
      targetContext?: 'platform' | 'project';
      runId?: string;
    }
  ): Promise<string> {
    const { userId, sessionId, projectId, targetContext, runId } = context;
    
    try {
      console.log(`[AGENT-EXECUTOR] Executing tool: ${toolName}`, { input, userId, sessionId });
      
      // Import tool handlers
      const toolHandlers = await import('../routes/lomuChat/tools/toolHandler');
      
      // Execute tool and collect raw result
      let rawResult: any;
      
      // Route to appropriate handler based on tool name
      switch (toolName) {
        case 'read':
          rawResult = await toolHandlers.handleReadFile(input.file_path || input.path || '');
          break;
        
        case 'write':
          rawResult = await toolHandlers.handleWriteFile(
            input.file_path || input.path || '',
            input.content || ''
          );
          break;
        
        case 'edit':
          rawResult = await toolHandlers.handleEditFile(
            input.file_path || input.path || '',
            input.old_string || '',
            input.new_string || ''
          );
          break;
        
        case 'bash':
          rawResult = await toolHandlers.handleBashCommand(
            input.command || '',
            input.timeout || 120000
          );
          break;
        
        case 'search_codebase':
          rawResult = await toolHandlers.handleSearchCodebase(
            input.query || '',
            input.search_paths || []
          );
          break;
        
        case 'grep_tool':
          rawResult = await toolHandlers.handleGrep(
            input.pattern || '',
            input.path || '.'
          );
          break;
        
        case 'ls':
          rawResult = await toolHandlers.handleListDirectory(
            input.path || '.'
          );
          break;
        
        case 'glob':
          rawResult = await toolHandlers.handleGlobPattern(
            input.pattern || '',
            input.path || '.'
          );
          break;
        
        case 'create_task_list':
          rawResult = await toolHandlers.handleCreateTaskList(input.tasks || []);
          break;
        
        case 'update_task':
          rawResult = await toolHandlers.handleUpdateTask(input.task_id || '', input.status || 'pending');
          break;
        
        case 'read_task_list':
          rawResult = await toolHandlers.handleReadTaskList();
          break;
        
        case 'start_subagent':
          rawResult = await toolHandlers.handleStartSubagent(input);
          break;
        
        case 'web_search':
          rawResult = await toolHandlers.handleWebSearch(input.query || '');
          break;
        
        case 'get_auto_context':
          rawResult = await toolHandlers.handleGetAutoContext(input.file_path || '');
          break;
        
        case 'extract_function':
          rawResult = await toolHandlers.handleExtractFunction(
            input.file_path || '',
            input.function_name || ''
          );
          break;
        
        case 'smart_read_file':
          rawResult = await toolHandlers.handleSmartReadFile(
            input.file_path || '',
            input.context || ''
          );
          break;
        
        case 'perform_diagnosis':
          rawResult = await toolHandlers.handlePerformDiagnosis(input.issue || '');
          break;
        
        case 'architect_consult':
          rawResult = await toolHandlers.handleArchitectConsult(input.query || '');
          break;
        
        case 'refresh_all_logs':
          rawResult = await toolHandlers.handleRefreshAllLogs();
          break;
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      
      // ✅ VALIDATE AND SANITIZE RESULT BEFORE RETURNING
      const validation = validateToolResult(toolName, rawResult);
      if (!validation.valid) {
        console.warn(`[AGENT-EXECUTOR] Tool ${toolName} returned invalid result:`, validation.error);
      }
      
      console.log(`[AGENT-EXECUTOR] Tool ${toolName} result validated (${validation.sanitized.length} chars)`);
      return validation.sanitized; // Already sanitized and truncated
    } catch (error: any) {
      console.error(`[AGENT-EXECUTOR] Tool ${toolName} failed:`, error);
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }
}
