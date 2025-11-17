# LomuAI Chat Refactoring

This directory contains refactored modules from `server/routes/lomuChat.ts` to improve maintainability.

## Current Modules

### constants.ts
Contains all emergency limits and constants used throughout LomuAI:
- `EMERGENCY_LIMITS`: Rate limiting and session management constants
- `MAX_CONSECUTIVE_THINKING`: Maximum thinking iterations before forcing action

### utils.ts  
Contains utility functions extracted from the main chat handler:
- `mapDatabaseStatusToRunState()`: Status mapping for RunStateManager
- `detectLowConfidencePatterns()`: Runtime validation for AI responses
- `retryWithBackoff()`: Exponential backoff retry logic for API overload errors
- `ensureActiveSession()`: Session lifecycle management
- `validateProjectPath()`: Security validation for file paths
- `validateContextAccess()`: Access control for platform/project context
- `handleBilling()`: Centralized billing logic (FREE vs credits)
- `broadcastFileUpdate()`: WebSocket file update broadcasts
- `waitForApproval()` / `resolveApproval()`: Approval workflow management

## Refactoring Results

**Before:**
- `server/routes/lomuChat.ts`: 4,902 lines (monolithic)

**After:**
- `server/routes/lomuChat.ts`: 4,594 lines (-308 lines, -6.3%)
- `server/routes/lomu/constants.ts`: 11 lines
- `server/routes/lomu/utils.ts`: 328 lines

**Total extracted:** 339 lines of reusable utilities

## Next Steps for Future Refactoring

The remaining ~4,500 lines in `lomuChat.ts` contain:
1. **38 Tool Implementations** (~1,350 lines): read_file, write_file, execute_sql, etc.
   - Tightly coupled to streaming context (sendEvent, fileChangeTracker, userId, etc.)
   - Would require complex context object for extraction
   
2. **Stream Event Handlers** (~300 lines): onChunk, onThought, onAction, onToolUse, onComplete
   - Tightly coupled to request state and orchestration

3. **Main Orchestration Logic** (~2,800 lines): 
   - Iteration management
   - Phase orchestration  
   - Validation and cleanup
   - API route handlers

### Recommended Approach for Further Refactoring

1. **Create Tool Context Interface**
   ```typescript
   interface ToolExecutionContext {
     sendEvent: Function;
     fileChangeTracker: FileChangeTracker;
     userId: string;
     projectId?: string;
     targetContext: 'platform' | 'project';
     // ... other context
   }
   ```

2. **Extract Tool Categories**
   - `tools/platform-files.ts`: Platform file operations
   - `tools/project-files.ts`: Project file operations
   - `tools/diagnostics.ts`: Diagnosis and logging tools
   - `tools/execution.ts`: bash, restart_workflow, etc.
   - `tools/knowledge.ts`: Knowledge management tools

3. **Extract Handlers**
   - `handlers/stream-events.ts`: All onXXX callbacks
   
4. **Extract Orchestration**
   - `orchestrator/main-loop.ts`: Core iteration logic
   - `orchestrator/validation.ts`: Validation and cleanup

## Testing

After refactoring, verify:
- ✅ Application starts without errors
- ✅ WebSocket connections work
- ✅ File operations execute correctly  
- ✅ Billing system functions properly
- ✅ Session management works

## Status

**Phase 1 Complete:** Constants and utilities extracted (339 lines)
**Phase 2 Planned:** Tool implementations extraction (future iteration)
**Phase 3 Planned:** Handler extraction (future iteration)
**Phase 4 Planned:** Orchestration extraction (future iteration)
