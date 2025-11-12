# Validation Helpers Integration Plan

## Overview
This document outlines the strategy for integrating `validationHelpers.ts` into the existing LomuAI workflow to improve reliability and code quality.

## Current LomuAI Flow
The main execution loop in `server/routes/lomuChat.ts` (around line 1290):

```typescript
await streamGeminiResponse({
  model: 'gemini-2.5-flash',
  maxTokens: config.maxTokens,
  system: safeSystemPrompt,
  messages: safeMessages,
  tools: availableTools,
  onChunk: (chunk) => { /* stream text */ },
  onToolUse: (toolUse) => { /* execute tools */ },
  onComplete: () => { /* finalize */ },
});
```

## Integration Points

### 1. File Operation Validation
**Entry Point**: `server/routes/lomuChat.ts` - After file write operations
**Hook**: In the tool execution callback (onToolUse), after write/edit operations

```typescript
// In onToolUse callback, after file write
if (toolUse.name === 'write_platform_file' || toolUse.name === 'write') {
  const filePath = toolUse.input.path;
  
  // Validate file was written successfully
  const validation = await validateFileChanges([filePath], process.cwd());
  
  if (!validation.success) {
    console.error('[FILE-VALIDATION]', validation.errors);
    // Optionally retry or notify user
  }
}
```

**Data Flow**:
1. Tool writes file
2. Validation checks file exists
3. Log errors if validation fails
4. Continue execution (non-blocking)

### 2. TypeScript Validation (Optional)
**Entry Point**: `server/routes/lomuChat.ts` - End of iteration or on user request
**Hook**: Before marking task complete, when TypeScript files were modified

```typescript
// Track modified TypeScript files during iteration
const modifiedTsFiles = fileChanges
  .filter(f => f.path.match(/\.(ts|tsx)$/))
  .map(f => f.path);

// Optional TypeScript validation before completing
if (modifiedTsFiles.length > 0 && shouldValidateTypeScript) {
  const tsValidation = await validateTypeScript(
    modifiedTsFiles,
    process.cwd()
  );
  
  if (!tsValidation.success) {
    // Show type errors to user
    broadcastToUser(userId, {
      type: 'validation_warning',
      errors: tsValidation.errors,
    });
  }
}
```

**Configuration**:
- Default: OFF (no blocking)
- Opt-in: Via user setting or environment variable
- Usage: Only for complex refactors

### 3. Retry Logic for Failed Operations
**Entry Point**: `server/routes/lomuChat.ts` - Tool execution error handling
**Hook**: Wrap critical operations in retry helper

```typescript
// Example: Retry file read operations
const fileContent = await retryOperation(
  () => read({ file_path: filePath }),
  {
    maxRetries: 3,
    baseDelay: 1000,
    exponential: true,
    onRetry: (attempt, error) => {
      console.log(`[RETRY] Attempt ${attempt}: ${error.message}`);
    }
  }
);
```

**Use Cases**:
- File system operations (transient errors)
- Network requests (timeouts, rate limits)
- Database operations (connection issues)

### 4. Progress Tracking
**Entry Point**: `server/routes/lomuChat.ts` - Throughout execution
**Hook**: Track file changes for auditing and rollback

```typescript
// Initialize tracker at start of request
const changeTracker = new FileChangeTracker();

// Track operations as they happen
changeTracker.recordChange(filePath, 'create');
changeTracker.recordChange(filePath, 'modify');
changeTracker.recordChange(filePath, 'delete');

// Query changes at end
const recentChanges = changeTracker.getRecentChanges(60000); // Last minute
const modifiedFiles = changeTracker.getModifiedFiles();

// Include in completion message
broadcastToUser(userId, {
  type: 'completion',
  filesModified: modifiedFiles,
  changes: recentChanges,
});
```

**Benefits**:
- Audit trail for debugging
- Rollback capability
- User transparency

### 5. Duplicate Suppression
**Entry Point**: `server/routes/lomuChat.ts` - Before executing tools
**Hook**: Prevent redundant file operations

```typescript
import { createOperationKey, DuplicateSuppressionTracker } from '../services/validationHelpers';

// Initialize suppressor at start of request
const dupSuppressor = new DuplicateSuppressionTracker(5000); // 5 second window

// Before executing file operation
const operationKey = createOperationKey(
  'write',
  filePath,
  JSON.stringify(content).slice(0, 100) // Hash of content
);

if (dupSuppressor.isDuplicate(operationKey)) {
  console.log('[DUP-SUPPRESSED]', filePath);
  return; // Skip redundant write
}

// ... execute operation
// Note: isDuplicate() already records the operation internally
```

**Benefits**:
- Prevents duplicate writes
- Reduces unnecessary I/O
- Faster execution

## Implementation Strategy

### Phase 1: Non-Blocking Validation (Week 1)
1. Add file validation after write operations
2. Log validation errors (non-blocking)
3. Track file changes for audit trail
4. No user-facing changes

**Acceptance**:
- Validation runs after file writes
- Errors logged to console
- No regressions in existing flow

### Phase 2: Retry Logic (Week 2)
1. Wrap file operations in retry helper
2. Add exponential backoff for transient errors
3. Log retry attempts
4. Monitor retry success rate

**Acceptance**:
- File operations retry on failure
- Retry count < 10% of requests
- No infinite retry loops

### Phase 3: TypeScript Validation (Week 3)
1. Add opt-in TypeScript validation
2. Environment variable: `ENABLE_TS_VALIDATION=true`
3. Show type errors to users
4. Make non-blocking by default

**Acceptance**:
- TypeScript validation runs when enabled
- Errors displayed to users
- Default behavior unchanged

### Phase 4: Duplicate Suppression (Week 4)
1. Add duplicate suppression for file operations
2. Track operation hashes
3. Skip redundant writes
4. Monitor suppression rate

**Acceptance**:
- Duplicates suppressed
- Suppression rate < 5%
- No false positives

## Testing Plan

### Unit Tests
```typescript
// tests/validationHelpers.test.ts
describe('ValidationHelpers', () => {
  test('validateFileChanges detects missing files', async () => {
    const result = await validateFileChanges(['nonexistent.ts'], '/tmp');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Expected file not found');
  });

  test('retryOperation retries on failure', async () => {
    let attempts = 0;
    const result = await retryOperation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'success';
    }, { maxRetries: 3 });
    expect(attempts).toBe(3);
    expect(result).toBe('success');
  });
});
```

### Integration Tests
```typescript
// tests/lomuChat.integration.test.ts
describe('LomuAI with Validation', () => {
  test('validates files after write', async () => {
    const response = await request(app)
      .post('/api/lomu/chat')
      .send({ message: 'Create file test.ts' });
    
    expect(response.body.validation).toBeDefined();
    expect(response.body.validation.success).toBe(true);
  });
});
```

### Manual Testing
1. Create a file via LomuAI
2. Check console logs for validation output
3. Verify file exists on disk
4. Delete file and retry - should see retry logs

## Rollback Plan

If validation helpers cause issues:

1. **Quick Rollback**: Remove validation calls, keep imports
2. **Feature Flag**: Add `ENABLE_VALIDATION=false` to disable
3. **Gradual Disable**: Remove phase by phase in reverse order

## Success Metrics

### Quantitative
- File write success rate > 99%
- Retry success rate > 90%
- Duplicate suppression rate < 5%
- TypeScript validation completion < 5 seconds

### Qualitative
- Fewer "file not found" errors in logs
- Improved debugging with change tracking
- Better user feedback on validation issues

## Next Steps

1. ✅ Create integration plan (this document)
2. ⬜ Review plan with architect
3. ⬜ Implement Phase 1 (non-blocking validation)
4. ⬜ Deploy to staging
5. ⬜ Monitor metrics for 1 week
6. ⬜ Proceed to Phase 2

## References

- `server/services/validationHelpers.ts` - Implementation
- `server/services/VALIDATION_HELPERS_INTEGRATION.md` - API documentation
- `server/routes/lomuChat.ts` - Integration point
- `replit.md` - Architecture documentation
