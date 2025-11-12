# Gemini Orchestrator - Production-Grade 5-Layer Stack

## Overview

The **GeminiOrchestrator** is a production-grade code generation engine implementing the battle-tested 5-layer stack pattern used by Cursor, Replit Agent, and Bolt.ai.

## Architecture

```
User Request
    ↓
1. TASK PLANNER (breaks request into granular steps)
    ↓
2. CONTEXT GATHERER (reads relevant files)
    ↓
3. STREAMING CODE GENERATOR (outputs with structured tags)
    ↓
4. TOOL EXECUTOR (applies changes, runs tools)
    ↓
5. VALIDATION LOOP (verifies changes, retries on failure)
```

## Features

✅ **Structured Task Planning** - Breaks complex requests into executable steps  
✅ **Smart Context Gathering** - Reads only relevant files before generation  
✅ **Real-time Streaming** - Streams code generation token-by-token  
✅ **Structured Output Parsing** - Parses `<file_operation>` and `<tool_call>` tags  
✅ **Automatic Validation** - TypeScript checking + file existence validation  
✅ **Auto-Retry Logic** - Retries failed tasks once automatically  
✅ **WebSocket Integration** - Real-time progress updates to frontend  
✅ **Production-Ready Error Handling** - Comprehensive error recovery  

## Quick Start

### 1. Import the Orchestrator

```typescript
import { createGeminiOrchestrator, type StreamEvent } from '@/server/services/geminiOrchestrator';
```

### 2. Create an Instance

```typescript
const orchestrator = createGeminiOrchestrator(
  process.cwd(),           // Working directory
  userId,                  // User ID for tracking
  sessionId,              // Session ID for context
  (event: StreamEvent) => {
    // Handle streaming events
    console.log(event.type, event.content);
  }
);
```

### 3. Execute a Request

```typescript
const result = await orchestrator.execute(
  'Create a React button component with TypeScript and Tailwind CSS'
);

console.log('Success:', result.success);
console.log('Files modified:', result.filesModified);
console.log('Tasks completed:', result.tasksCompleted);
```

## StreamEvent Types

The orchestrator emits various event types during execution:

| Event Type | Description | Properties |
|------------|-------------|------------|
| `text` | Streaming text content | `content` |
| `task_start` | Task begins execution | `task`, `content` |
| `task_complete` | Task finished successfully | `task`, `content` |
| `tool_call` | Tool is being executed | `tool`, `args`, `content` |
| `file_operation` | File operation in progress | `operation`, `filePath`, `content` |
| `validation` | Validation result | `validationResult`, `content` |
| `error` | Error occurred | `error`, `content` |
| `complete` | All tasks finished | `content` |

## Structured Output Format

### File Operations

The orchestrator expects Gemini to output file changes in this format:

```xml
<file_operation>
{
  "operation": "create",
  "path": "src/components/Button.tsx",
  "content": "import React from 'react';\n\nexport function Button() {\n  return <button>Click me</button>;\n}"
}
</file_operation>
```

**Operations:**
- `create` - Create a new file
- `modify` - Modify existing file (provides complete new content)
- `delete` - Delete a file

### Tool Calls

For dynamic operations during generation:

```xml
<tool_call>
{
  "tool": "read",
  "file_path": "src/utils/helpers.ts"
}
</tool_call>
```

**Available Tools:**
- `read` - Read file contents
- `glob` - Search for files by pattern
- `run_command` - Execute shell commands

## Integration with WebSocket

### Backend (Express Route)

```typescript
import { createGeminiOrchestrator } from '@/server/services/geminiOrchestrator';
import { broadcastToUser } from '@/server/routes/websocket';

router.post('/api/orchestrator/execute', isAuthenticated, async (req, res) => {
  const userId = req.user!.id;
  const { request, sessionId } = req.body;

  const orchestrator = createGeminiOrchestrator(
    process.cwd(),
    userId,
    sessionId,
    (event) => {
      // Stream to frontend via WebSocket
      broadcastToUser(userId, {
        type: 'orchestrator_stream',
        event,
      });
    }
  );

  const result = await orchestrator.execute(request);

  res.json({ success: true, result });
});
```

### Frontend (React)

```tsx
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket-stream';

export function OrchestratorChat() {
  const [events, setEvents] = useState<any[]>([]);
  const ws = useWebSocket('ws://localhost:5000/ws');

  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'orchestrator_stream') {
        setEvents(prev => [...prev, data.event]);
      }
    };
  }, [ws]);

  const execute = async (request: string) => {
    await fetch('/api/orchestrator/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request, sessionId: 'session-123' }),
    });
  };

  return (
    <div>
      {events.map((e, i) => (
        <div key={i}>{e.content || `[${e.type}]`}</div>
      ))}
    </div>
  );
}
```

## Validation & Retry Logic

### File Existence Validation

After each task, the orchestrator verifies all expected files were created/modified:

```typescript
// Checks each file in task.files exists
for (const file of task.files) {
  await fs.access(fullPath); // Throws if missing
}
```

### TypeScript Validation

For `.ts` and `.tsx` files, runs type checking:

```typescript
if (hasTypeScriptFiles) {
  await execAsync('npx tsc --noEmit', { cwd: workingDir });
}
```

### Auto-Retry

If validation fails, the task is automatically retried once:

```typescript
if (!isValid) {
  task.status = 'pending';
  await this.executeTask(task); // Retry
}
```

## Example Use Cases

### 1. Create a React Component

```typescript
const result = await orchestrator.execute(`
  Create a LoginForm component with:
  - Email and password inputs
  - Form validation using react-hook-form
  - Submit button with loading state
  - Error message display
  - TypeScript types
`);
```

### 2. Build a Complete Feature

```typescript
const result = await orchestrator.execute(`
  Build a user profile page with:
  1. Profile header with avatar and name
  2. Edit profile form
  3. Activity feed showing recent actions
  4. Settings section
  
  Use existing patterns from client/src/pages/
  Follow shadcn/ui component library
`);
```

### 3. Fix Bugs

```typescript
const result = await orchestrator.execute(`
  Fix the authentication bug where users can't log in:
  - Check server/routes/auth.ts for issues
  - Verify password hashing is correct
  - Add better error messages
  - Update tests to cover this case
`);
```

## Advanced Configuration

### Custom Working Directory

```typescript
const orchestrator = createGeminiOrchestrator(
  '/path/to/project',  // Custom working directory
  userId,
  sessionId,
  onStream
);
```

### Custom Model

By default uses `gemini-2.0-flash-exp`. To change:

```typescript
// In geminiOrchestrator.ts constructor:
this.model = 'gemini-2.5-flash'; // Or other model
```

### Timeout Configuration

For long-running validations:

```typescript
// In validateChanges method:
await execAsync('npx tsc --noEmit', {
  cwd: this.workingDir,
  timeout: 60000, // 60 seconds
});
```

## Performance Optimization

### Context Limiting

File content is limited to prevent token overflow:

```typescript
const preview = lines.length > 100 
  ? `${lines.slice(0, 100).join('\n')}\n... (truncated)`
  : content;
```

### File Tree Pruning

Ignores common directories to reduce noise:

```typescript
if (
  entry.name.startsWith('.') ||
  entry.name === 'node_modules' ||
  entry.name === 'dist'
) {
  continue;
}
```

### Conversation History

Only keeps last 3 turns to maintain focus:

```typescript
this.conversationHistory.slice(-3)
```

## Error Handling

### Task-Level Errors

Each task has independent error handling:

```typescript
try {
  await this.executeTask(task);
  tasksCompleted++;
} catch (error) {
  tasksFailed++;
  errors.push(`Task failed: ${error.message}`);
}
```

### Tool Errors

Tool failures are logged but don't crash execution:

```typescript
try {
  return await executeTool(toolCall);
} catch (error) {
  this.onStream({ type: 'text', content: `⚠️ Tool error: ${error.message}` });
  return null;
}
```

### Validation Errors

TypeScript errors trigger retry instead of failure:

```typescript
catch (error) {
  this.onStream({ 
    type: 'validation', 
    validationResult: false,
    content: 'TypeScript errors found (will retry)' 
  });
  return false; // Triggers retry
}
```

## Testing

### Unit Test Example

```typescript
import { createGeminiOrchestrator } from './geminiOrchestrator';

test('creates orchestrator instance', () => {
  const orchestrator = createGeminiOrchestrator(
    process.cwd(),
    'test-user',
    'test-session',
    () => {}
  );
  
  expect(orchestrator).toBeDefined();
});
```

### Integration Test Example

```typescript
test('executes simple task', async () => {
  const events: any[] = [];
  
  const orchestrator = createGeminiOrchestrator(
    '/tmp/test',
    'test-user',
    'test-session',
    (event) => events.push(event)
  );
  
  const result = await orchestrator.execute('Create a hello.txt file');
  
  expect(result.success).toBe(true);
  expect(result.filesModified).toContain('hello.txt');
  expect(events.some(e => e.type === 'complete')).toBe(true);
});
```

## Comparison with Simple Prompting

| Feature | Simple Prompt | GeminiOrchestrator |
|---------|--------------|-------------------|
| Multi-file changes | ❌ Often incomplete | ✅ Full codebase awareness |
| Validates output | ❌ No | ✅ TypeScript + file checks |
| Retries failures | ❌ No | ✅ Auto-retry with context |
| Streaming UX | ❌ Wait for full response | ✅ Token-by-token |
| Tool calling | ❌ No | ✅ Read files, run commands |
| Context management | ❌ Loses track | ✅ Maintains history |
| Task planning | ❌ Single shot | ✅ Breaks down complex requests |

## Best Practices

### 1. Be Specific in Requests

```typescript
// ❌ BAD: Too vague
await orchestrator.execute('Make the app better');

// ✅ GOOD: Specific requirements
await orchestrator.execute(`
  Add user authentication with:
  - Login form with email/password
  - JWT token management
  - Protected route wrapper
  - Logout functionality
`);
```

### 2. Provide Context

```typescript
// ✅ GOOD: Reference existing patterns
await orchestrator.execute(`
  Create a new dashboard page following the pattern in:
  - client/src/pages/analytics.tsx for layout
  - Use existing Card components from @/components/ui/card
  - Match the styling in design_guidelines.md
`);
```

### 3. Break Down Very Large Requests

```typescript
// Instead of one massive request, chain smaller ones:
await orchestrator.execute('Set up database schema');
await orchestrator.execute('Create API routes for CRUD');
await orchestrator.execute('Build frontend forms');
```

### 4. Handle Results

```typescript
const result = await orchestrator.execute(request);

if (result.success) {
  console.log('✅ Success! Modified:', result.filesModified);
} else {
  console.error('❌ Failed with errors:', result.errors);
  // Implement fallback or notify user
}
```

## Troubleshooting

### Issue: Tasks fail validation

**Solution:** Check TypeScript errors in logs. The orchestrator will retry once, but persistent errors need manual fixes.

### Issue: File operations not applied

**Solution:** Verify Gemini is outputting properly formatted `<file_operation>` tags. Check logs for parsing errors.

### Issue: Timeout on validation

**Solution:** Increase timeout in `validateChanges` method for large codebases.

### Issue: Missing context

**Solution:** Ensure working directory is correct and files exist. Use `glob` tool to verify file paths.

## Future Enhancements

Potential additions to the orchestrator:

1. **Diff Viewer** - Show before/after with syntax highlighting
2. **Approval Flow** - Confirm changes before applying
3. **Multi-Agent Collaboration** - Planning agent + coding agent + review agent
4. **Codebase Indexing** - Vector search for smarter context
5. **Performance Metrics** - Track token usage, execution time per task
6. **Rollback Support** - Git integration to revert failed changes

## License

Part of the Lomu Platform. Internal use only.

## Support

For issues or questions, contact the development team or refer to:
- `server/services/geminiOrchestrator.ts` (implementation)
- `server/services/geminiOrchestratorExample.ts` (integration examples)
- Attached pattern document for architectural details
