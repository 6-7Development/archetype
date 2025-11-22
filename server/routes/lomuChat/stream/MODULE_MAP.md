# LomuAI Stream Handler Modular Architecture

## Overview
Breaking down the 3960-line `/stream` handler into 7 focused modules of 250-450 lines each.

## Module Breakdown

### 1. **types.ts** (~150 lines)
**Responsibility:** Shared TypeScript interfaces and type definitions
**Exports:**
- `StreamRequest` - Request body interface
- `StreamContext` - Session/conversation context
- `StreamState` - Active stream state tracking
- `AILoopConfig` - AI orchestration configuration
- `BillingInfo` - Credit tracking interfaces

### 2. **request-validation.ts** (~150 lines)
**Lines:** 690-741 (original handler)
**Responsibility:** Extract and validate incoming request parameters
**Exports:**
- `validateStreamRequest(req, res)` - Returns validated params or sends error
**Dependencies:** None (pure validation logic)

### 3. **billing-setup.ts** (~200 lines)
**Lines:** 732-773
**Responsibility:** Access control, token estimation, credit reservation
**Exports:**
- `setupBillingAndReservation(params)` - Returns agentRunId and creditsReserved
**Dependencies:** `validateContextAccess`, `calculateTokenEstimate`, AgentExecutor

### 4. **session-bootstrap.ts** (~300 lines)
**Lines:** 774-946
**Responsibility:** SSE setup, session management, message persistence
**Exports:**
- `bootstrapStreamSession(params)` - Returns session, conversationState, userMsg, sendEvent
**Dependencies:** SSE utilities, lomuAIBrain, DB operations

### 5. **context-preparation.ts** (~400 lines)
**Lines:** 947-1224
**Responsibility:** Load history, build conversation, format context, classify intent
**Exports:**
- `prepareAIContext(params)` - Returns conversationMessages, systemPrompt, tools, intent
**Dependencies:** formatStateForPrompt, classifyUserIntent, buildLomuSuperCorePrompt

### 6. **stream-emitter.ts** ✅ COMPLETE (~700 lines)
**Lines:** Extracted from 1225-4500 (sendEvent calls, thinking detection, chunk assembly)
**Responsibility:** SSE event emission, thinking block detection, content assembly
**Exports:**
- `createEmitContext(sendEvent, userId, wss, options)` - Factory for emit context
- `emitContentChunk(context, content, chunkState?)` - Send content with deduplication
- `emitToolCall(context, toolName, toolId, input)` - Tool execution events
- `emitToolResult(context, toolName, toolId, output, isError?)` - Tool results
- `emitProgress(context, message)` - Progress updates
- `emitThinking(context, title, content, progressMessages?)` - Thinking blocks
- `emitAction(context, title, content, progressMessages?)` - Action messages
- `emitResult(context, title, content, progressMessages?)` - Result messages
- `emitSystemInfo(context, message, severity?, metadata?)` - System notifications
- `emitError(context, message, code?, details?)` - Error messages
- `emitFileUpdate(context, path, operation)` - File change notifications
- `emitComplete(context, tokensUsed?, creditsConsumed?)` - Completion signal
- `emitDone(context, metadata?)` - Final done event with summary
- `detectAndEmitThinkingBlocks(context, chunkState, progressMessages)` - Pattern matching
- `assembleChunks(chunkState, options?)` - Assemble final content
- `getPostToolMessage(toolName, toolResult)` - Conversational flow
- `emitIterationProgress(context, iterationCount, showEvery?)` - Iteration status
- `emitTaskUpdate(context, taskId, status)` - Task state changes
- `emitPhaseTransition(context, phase, message)` - Phase updates
- `emitApprovalRequired(context, approvalId, summary, filesChanged, estimatedImpact)` - Approval workflow
- `emitHeartbeat(context)` - Connection keep-alive
- `createChunkState()` - Initialize chunk assembly state
**Dependencies:** 
- types.ts (EmitContext, EventSender, ProgressEntry, SSE event types)
- ../../websocket.ts (broadcastToUser)
- nanoid (ID generation)
**Note:** Comprehensive SSE emission layer with dual transport (SSE + WebSocket)

### 7. **iteration-controller.ts** ✅ COMPLETE (~535 lines)
**Lines:** Extracted from 1225-4500 (iteration loop, anti-paralysis, emergency brakes)
**Responsibility:** Main AI iteration loop control, anti-paralysis detection, emergency brakes
**Exports:**
- `executeAILoop(params)` - Main iteration controller, manages turn-by-turn execution
- `createAntiParalysisState()` - Initialize file read tracker
- `checkAntiParalysis(state, filePath, fileSize, lineCount)` - Detect analysis loops
- `resetAntiParalysisCounter(state, filePath)` - Reset after writes/edits
- `clearAntiParalysisCounters(state)` - Reset after grep/search
- `shouldStopIteration(context, currentTokens)` - Emergency brake checks
- `trackIterationProgress(context, iterationCount)` - Update RunStateManager
- `incrementApiCallCounter(conversationStateId, currentCount)` - Track API usage
- `checkEmptyIterations(state, hadToolCalls)` - Detect no-tool-call loops
- `checkThinkingLoop(state, isThinking)` - Detect analysis paralysis
- `createIterationState()` - Initialize iteration state
- `createWorkflowTelemetry()` - Initialize workflow telemetry
- `logAntiParalysisTelemetry(state, sendEvent, userId)` - Log intervention stats
**Interfaces:**
- `AntiParalysisState` - File read tracking state
- `IterationState` - Iteration loop state
- `WorkflowTelemetry` - Read/write operation tracking
- `EmergencyBrakeResult` - Stop condition check result
- `IterationContext` - Iteration execution context
- `IterationExecutionParams` - Loop execution parameters
**Dependencies:** 
- types.ts (UserIntent, EventSender, StreamContext)
- stream-emitter.ts (emitProgress, emitSystemInfo)
- ../../../config/lomuLimits.ts (LOMU_LIMITS, getMaxIterationsForIntent)
- ../../../services/RunStateManager.ts (RunStateManager)
- ../../../services/PhaseOrchestrator.ts (PhaseOrchestrator)
- ../../../db.ts (database access)
**Note:** Comprehensive iteration control with anti-paralysis, emergency brakes, and progress tracking

### 8. **response-handler.ts** (~400 lines)
**Lines:** 3500-4500 (approx)
**Responsibility:** Stream response chunks, persist messages, broadcast updates
**Exports:**
- `handleStreamResponse(params)` - Process AI response streaming
**Dependencies:** SSE utilities, DB persistence, WebSocket broadcasting, stream-emitter

### 9. **error-cleanup.ts** ✅ COMPLETE (~200 lines)
**Lines:** 4500-4649
**Responsibility:** Error handling, cleanup, billing reconciliation
**Exports:**
- `handleStreamError(error, context)` - Error handling logic
- `cleanupStream(context)` - Finally block cleanup (heartbeat, timeout, streams)
**Dependencies:** terminateStream, handleBilling

## Refactoring Strategy

### Phase 1: Extract Pure Utility Modules (Parallel)
- types.ts
- request-validation.ts
- error-cleanup.ts

### Phase 2: Extract Bootstrap & Setup (Sequential)
- billing-setup.ts (depends on validation types)
- session-bootstrap.ts (depends on billing setup)
- context-preparation.ts (depends on session)

### Phase 3: Extract AI Orchestration (Complex)
- ai-loop-controller.ts (largest module, may need subagent)
- response-handler.ts (intertwined with loop)

### Phase 4: Update Main Handler
- Replace /stream handler with orchestration calls
- Import and wire all modules
- Ensure error handling propagates correctly

## Dependency Graph
```
request-validation.ts
  ↓
billing-setup.ts
  ↓
session-bootstrap.ts
  ↓
context-preparation.ts
  ↓
ai-loop-controller.ts ←→ response-handler.ts
  ↓
error-cleanup.ts
```

## Shared Dependencies (Keep in lomuChat.ts or ./lomu/utils.ts)
- activeStreams (Set)
- wss (WebSocket server)
- All DB imports
- Existing utilities from ./lomuChat/streaming.ts, billing.ts, tools.ts
