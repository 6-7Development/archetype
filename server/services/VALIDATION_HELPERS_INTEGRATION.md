# Validation Helpers Integration Guide

## Overview

The `validationHelpers.ts` module provides reusable utilities extracted from `geminiOrchestrator.ts` for use across the LomuAI workflow. These utilities can be gradually integrated without breaking existing functionality.

## Exported Utilities

### 1. File Validation

```typescript
import { validateFileChanges, validateTypeScript, validateAllChanges } from './validationHelpers';

// Check if files exist after operations
const result = await validateFileChanges(
  ['src/components/NewComponent.tsx', 'src/utils/helper.ts'],
  process.cwd()
);

if (!result.success) {
  console.error('Missing files:', result.errors);
}
```

### 2. TypeScript Validation

```typescript
// Validate TypeScript compilation
const tsResult = await validateTypeScript(
  ['src/components/NewComponent.tsx'],
  process.cwd()
);

if (!tsResult.success) {
  console.error('TypeScript errors:', tsResult.errors);
}
```

### 3. Combined Validation

```typescript
// Validate both file existence and TypeScript
const fullResult = await validateAllChanges(
  ['src/components/NewComponent.tsx'],
  { 
    workingDir: process.cwd(),
    skipTypeScriptCheck: false // optional
  }
);
```

### 4. Retry Logic

```typescript
import { retryOperation, retryValidation } from './validationHelpers';

// Retry any async operation with exponential backoff
const result = await retryOperation(
  async () => {
    // Your operation that might fail
    return await someApiCall();
  },
  {
    maxRetries: 3,
    baseDelay: 1000,
    exponential: true,
    onRetry: (attempt, error) => {
      console.log(`Retry ${attempt}: ${error.message}`);
    }
  }
);

// Retry validation specifically
const validationResult = await retryValidation(
  async () => validateFileChanges(files, workingDir),
  { maxRetries: 2, baseDelay: 500 }
);
```

### 5. Progress Tracking

```typescript
import { FileChangeTracker } from './validationHelpers';

// Track file changes during execution
const tracker = new FileChangeTracker();

// Record changes
tracker.recordChange('src/App.tsx', 'modify');
tracker.recordChange('src/NewFile.tsx', 'create');

// Get recent changes (last 60 seconds)
const recentChanges = tracker.getRecentChanges(60000);

// Get all modified files
const modifiedFiles = tracker.getModifiedFiles();

// Check if file was recently modified
if (tracker.wasRecentlyModified('src/App.tsx', 5000)) {
  console.log('File was modified in last 5 seconds');
}
```

### 6. Duplicate Suppression

```typescript
import { DuplicateSuppressionTracker, createOperationKey } from './validationHelpers';

// Prevent duplicate operations
const suppressionTracker = new DuplicateSuppressionTracker(5000);

const operationKey = createOperationKey('write', 'src/App.tsx', { content: '...' });

if (suppressionTracker.isDuplicate(operationKey)) {
  console.log('Skipping duplicate operation');
} else {
  // Perform operation
  await writeFile('src/App.tsx', content);
}

// Cleanup old entries periodically
setInterval(() => suppressionTracker.cleanup(), 10000);
```

### 7. Error Formatting

```typescript
import { formatValidationErrors } from './validationHelpers';

const result = await validateAllChanges(files, { workingDir: process.cwd() });
console.log(formatValidationErrors(result));
// Output:
// ❌ Errors:
//   - Expected file not found: src/Missing.tsx
// ⚠️ Warnings:
//   - TypeScript check skipped
```

## Integration into lomuChat.ts

### Example: Add validation after tool execution

```typescript
// In server/routes/lomuChat.ts, after tool execution (around line 1500)
import { 
  validateAllChanges, 
  FileChangeTracker,
  formatValidationErrors 
} from '../services/validationHelpers';

// Initialize tracker at the start of the request
const changeTracker = new FileChangeTracker();

// After executing a write/edit tool
if (toolName === 'write' || toolName === 'edit') {
  changeTracker.recordChange(toolArgs.file_path, 
    toolName === 'write' ? 'create' : 'modify'
  );
  
  // Optional: Validate after changes
  const validationResult = await validateAllChanges(
    [toolArgs.file_path],
    { 
      workingDir: process.cwd(),
      skipTypeScriptCheck: false 
    }
  );
  
  if (!validationResult.success) {
    // Log validation errors but don't block execution
    console.warn('[VALIDATION]', formatValidationErrors(validationResult));
  }
}

// At the end of the loop, get summary
const modifiedFiles = changeTracker.getModifiedFiles();
console.log(`[SUMMARY] Modified ${modifiedFiles.length} files:`, modifiedFiles);
```

### Example: Retry failed operations

```typescript
import { retryOperation } from '../services/validationHelpers';

// Wrap file operations with retry logic
const writeResult = await retryOperation(
  async () => {
    return await write({
      file_path: filePath,
      content: fileContent
    });
  },
  {
    maxRetries: 2,
    baseDelay: 1000,
    onRetry: (attempt, error) => {
      console.log(`[RETRY] Write operation failed, attempt ${attempt}: ${error.message}`);
    }
  }
);
```

### Example: Suppress duplicate tool calls

```typescript
import { DuplicateSuppressionTracker, createOperationKey } from '../services/validationHelpers';

// At the top of the file
const toolSuppressor = new DuplicateSuppressionTracker(3000);

// Before executing a tool
const toolKey = createOperationKey(
  toolUse.name, 
  JSON.stringify(toolUse.input)
);

if (toolSuppressor.isDuplicate(toolKey)) {
  console.log(`[SUPPRESS] Skipping duplicate tool call: ${toolUse.name}`);
  continue; // Skip this tool execution
}

// Execute tool normally
const result = await executeTool(toolUse);
```

## Benefits

1. **Reusable**: Clean, documented functions that can be used anywhere
2. **Type-safe**: Full TypeScript support with proper interfaces
3. **Non-breaking**: Can be integrated gradually without modifying existing code
4. **Testable**: Pure functions that are easy to unit test
5. **Monitored**: Built-in progress tracking and error reporting

## Next Steps

1. **Optional Integration**: Import into `lomuChat.ts` when needed
2. **Gradual Adoption**: Add validation to specific tool executions
3. **Monitoring**: Use `FileChangeTracker` to track modifications
4. **Performance**: Use `DuplicateSuppressionTracker` to reduce redundant operations

The utilities are ready to use but don't require immediate integration - they can be adopted incrementally as needed.
