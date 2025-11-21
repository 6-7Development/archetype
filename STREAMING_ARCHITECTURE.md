# LomuAI Streaming Architecture - Complete Pipeline Documentation

**Last Updated:** 2025-11-21  
**Purpose:** Comprehensive guide to LomuAI's real-time SSE streaming system

---

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Event Types & Data Formats](#event-types--data-formats)
3. [Backend Event Emission](#backend-event-emission)
4. [Frontend Event Handling](#frontend-event-handling)
5. [UI Component Integration](#ui-component-integration)
6. [Complete Flow Examples](#complete-flow-examples)
7. [Debugging Guide](#debugging-guide)

---

## 🏗️ Architecture Overview

### High-Level Flow
```
┌─────────────────┐
│  LomuAI Core    │ Gemini 2.5 Flash generates content
│  (Gemini API)   │
└────────┬────────┘
         │ streamText()
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Server-Side Event Emission (server/routes/lomuChat.ts)    │
│  • sendEvent(type, data)                                    │
│  • Wraps in { type, data } envelope                         │
│  • SSE format: data: {...}\n\n                              │
└────────┬────────────────────────────────────────────────────┘
         │ HTTP/2 SSE Stream
         │ (text/event-stream)
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend SSE Parser (client/src/components/universal-chat) │
│  • ReadableStream → decoder.decode()                        │
│  • Buffer management: /\r?\n\r?\n/ split                    │
│  • JSON.parse(line.substring(6)) → eventData               │
└────────┬────────────────────────────────────────────────────┘
         │ switch(eventData.type)
         ▼
┌─────────────────────────────────────────────────────────────┐
│  State Updates & Component Rendering                        │
│  • setMessages() → UniversalChat → MessageList             │
│  • EnhancedMessageDisplay → renders content + progress      │
│  • StatusStrip → shows phase/progress                       │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions
1. **Event Envelope**: All events wrapped in `{ type, data }` for consistency
2. **flushSync()**: Forces immediate React renders for word-by-word streaming
3. **Buffer Overflow Protection**: Auto-flush after 800 chars to prevent infinite buffering
4. **Heartbeat**: 15s keepalive comments prevent Railway 502 timeouts
5. **Progress Persistence**: `assistant_progress` events saved in message history

---

## 📦 Event Types & Data Formats

### Core Content Events
```typescript
// Streaming text content (word-by-word)
sendEvent('content', { content: string })

// Inline thinking/action/result blocks (Replit Agent style)
sendEvent('assistant_progress', {
  progressId: string,
  content: string,
  category: 'thinking' | 'action' | 'result'
})

// Status bar progress messages
sendEvent('progress', { message: string })
```

### Phase & State Events
```typescript
// Phase transitions (thinking → planning → working → verifying → complete)
sendEvent('run_phase', {
  phase: 'thinking' | 'planning' | 'working' | 'verifying' | 'complete',
  message?: string
})

// System information (safety backups, git status, etc.)
sendEvent('system_info', { message: string })
```

### Stream Control Events
```typescript
// User message confirmation
sendEvent('user_message', { messageId: string })

// Stream completion (clean exit)
sendEvent('complete', {})
sendEvent('done', { messageId: string, error: boolean })

// Error handling
sendEvent('error', { message: string })

// System information (safety backups, git status, configuration)
sendEvent('system_info', { message: string })

// Informational messages (non-critical notifications)
sendEvent('info', { message: string })
```

### Tool & Task Events
```typescript
// File changes (create/modify/delete)
sendEvent('file_change', {
  file: { path: string, operation: 'create' | 'modify' | 'delete' }
})

// Task list creation
sendEvent('task_list_created', { taskListId: string })

// Task status updates
sendEvent('task_updated', { taskId: string, status: string })
```

### Deployment Events
```typescript
sendEvent('deploy.started', {
  deploymentId: string,
  commitHash: string,
  commitUrl: string
})

sendEvent('deploy.step_update', {
  deploymentId: string,
  stepName: string,
  status: 'pending' | 'in_progress' | 'complete' | 'failed'
})

sendEvent('deploy.complete', {
  deploymentId: string,
  status: 'successful' | 'failed'
})
```

### Testing Events (Playwright)
```typescript
sendEvent('test.started', {
  sessionId: string,
  url: string
})

sendEvent('test.narration', {
  sessionId: string,
  text: string
})

sendEvent('test.step_update', {
  sessionId: string,
  step: TestStep // { type, description, status, screenshot? }
})

sendEvent('test.screenshot', {
  sessionId: string,
  stepId: string,
  screenshot: string // base64
})

sendEvent('test.completed', {
  sessionId: string,
  passedSteps: number,
  failedSteps: number
})
```

---

## 🔧 Backend Event Emission

### sendEvent Implementation
**Location:** `server/routes/lomuChat.ts:810`

```typescript
const sendEvent = (type: string, data: any) => {
  // ✅ Wrap in { type, data } envelope
  res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  
  // Explicit flush (if compression middleware provides it)
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }
};
```

### Critical SSE Headers
**Location:** `server/routes/lomuChat.ts:787-801`

```typescript
// Prevent buffering at all layers
res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
res.setHeader('Cache-Control', 'no-cache, no-transform');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no'); // Railway/nginx
res.setHeader('Content-Encoding', 'none'); // Prevent gzip

// Flush headers immediately
res.flushHeaders();

// Initial heartbeat to unblock fetch promise
res.write(': init\n\n');
```

### Heartbeat System
**Location:** `server/routes/lomuChat.ts:853-860`

```typescript
// Prevent Railway 502 timeouts (kills connections with no data for ~2 min)
const heartbeatInterval = setInterval(() => {
  res.write(': keepalive\n\n'); // SSE comment (ignored by EventSource)
}, 15000); // Every 15 seconds
```

### Gemini Streaming Integration
**Location:** `server/routes/lomuChat.ts:1860-2170`

```typescript
onChunk: async (chunk: any) => {
  // ============================================
  // CONTENT STREAMING WITH THINKING DETECTION
  // ============================================
  
  // Buffer text to detect thinking blocks
  let currentTextBlock = '';
  
  // Check for thinking delimiter: \n\n\n
  if (currentTextBlock.includes('\n\n\n')) {
    const [beforeDelim, afterDelim] = currentTextBlock.split('\n\n\n', 2);
    
    // Emit as thinking progress
    sendEvent('assistant_progress', {
      progressId: nanoid(),
      content: beforeDelim,
      category: 'thinking'
    });
    
    currentTextBlock = afterDelim;
  }
  
  // 🚨 BUFFER OVERFLOW PROTECTION
  if (currentTextBlock.length > 800 && !currentTextBlock.includes('\n\n\n')) {
    // Flush as regular content to prevent infinite buffering
    sendEvent('content', { content: currentTextBlock });
    currentTextBlock = '';
  }
},

onComplete: async (text: string, usage: any) => {
  // 🚨 CRITICAL FIX: Flush buffered text before completion
  if (currentTextBlock) {
    sendEvent('content', { content: currentTextBlock });
    currentTextBlock = '';
  }
}
```

---

## 🎯 Frontend Event Handling

### SSE Connection Setup
**Location:** `client/src/components/universal-chat.tsx:1048-1100`

```typescript
const response = await fetch('/api/lomu-ai/chat-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, projectId })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // Decode chunk and add to buffer
  buffer += decoder.decode(value, { stream: true });
  
  // Split on \n\n (SSE message boundary)
  const lines = buffer.split(/\r?\n\r?\n/);
  buffer = lines.pop() || ''; // Keep incomplete message
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const eventData = JSON.parse(line.substring(6));
      handleEvent(eventData); // Process event
    }
  }
}
```

### Event Handler Switch
**Location:** `client/src/components/universal-chat.tsx:1153-1425`

```typescript
const payload = eventData.data || {};

switch (eventData.type) {
  case 'content':
    // 🔥 USE flushSync() - forces immediate render
    assistantMessageContent += payload.content || '';
    flushSync(() => {
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg?.role === 'assistant') {
          updated[updated.length - 1] = {
            ...lastMsg,
            content: assistantMessageContent
          };
        }
        return updated;
      });
    });
    break;
    
  case 'assistant_progress':
    // Append to progressMessages for inline display
    const progressEntry = {
      id: payload.progressId || nanoid(),
      message: payload.content || '',
      timestamp: Date.now(),
      category: payload.category || 'action'
    };
    
    setMessages((prev) => {
      const updated = [...prev];
      const lastMsg = updated[updated.length - 1];
      if (lastMsg?.role === 'assistant') {
        updated[updated.length - 1] = {
          ...lastMsg,
          progressMessages: [...(lastMsg.progressMessages || []), progressEntry]
        };
      }
      return updated;
    });
    break;
    
  case 'progress':
    // Status bar updates (not inline)
    setProgressMessage(payload.message);
    break;
    
  case 'run_phase':
    setCurrentPhase(payload.phase || 'working');
    setPhaseMessage(payload.message || '');
    break;
    
  case 'error':
    toast({
      variant: 'destructive',
      title: 'Error',
      description: payload.message
    });
    break;
    
  case 'system_info':
  case 'info':
    // Informational messages (logged, not shown as toasts)
    console.log('[SSE] System info:', payload.message);
    break;
    
  case 'complete':
  case 'done':
    setIsGenerating(false);
    setProgressStatus('idle');
    break;
}
```

---

## 🎨 UI Component Integration

### Message Rendering Flow
```
UniversalChat (messages state)
   ↓
MessageList.map(msg => ...)
   ↓
EnhancedMessageDisplay(
  content: msg.content,
  progressMessages: msg.progressMessages
)
   ↓
Renders:
1. Inline progress blocks (thinking/action/result)
2. Markdown content
3. Code syntax highlighting
```

### EnhancedMessageDisplay
**Location:** `client/src/components/enhanced-message-display.tsx`

```typescript
interface ProgressMessage {
  id: string;
  message: string;
  timestamp: number;
  category: 'thinking' | 'action' | 'result';
}

export function EnhancedMessageDisplay({
  content,
  progressMessages = [],
  isStreaming = false
}: Props) {
  // Convert progressMessages to blocks
  const blocks = progressMessages.map(progress => ({
    id: progress.id,
    content: progress.message,
    category: progress.category || 'action',
    timestamp: progress.timestamp
  }));
  
  // Category-specific styling
  const getCategoryStyles = (category) => {
    switch(category) {
      case 'thinking': return 'bg-purple-50 dark:bg-purple-900/20';
      case 'action': return 'bg-blue-50 dark:bg-blue-900/20';
      case 'result': return 'bg-green-50 dark:bg-green-900/20';
    }
  };
  
  return (
    <div>
      {/* Render inline progress blocks */}
      {blocks.map(block => (
        <Collapsible key={block.id}>
          <CollapsibleTrigger className={getCategoryStyles(block.category)}>
            {block.category === 'thinking' ? '🤔' : block.category === 'action' ? '🔧' : '✅'}
            {block.content.substring(0, 50)}...
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ReactMarkdown>{block.content}</ReactMarkdown>
          </CollapsibleContent>
        </Collapsible>
      ))}
      
      {/* Render main content */}
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
```

### StatusStrip Integration
**Location:** `client/src/components/universal-chat.tsx:850-900`

Shows:
- Current phase emoji (🤔 thinking, 🛠️ working, etc.)
- Progress message from `progress` events
- Status animations (pulsing dots, spinner)

---

## 📊 Complete Flow Examples

### Example 1: Simple Text Response
```
User: "Tell me about Lomu"
  ↓
[Backend] sendEvent('user_message', { messageId: '...' })
  ↓
[Frontend] assistantMessageId = payload.messageId
  ↓
[Gemini] onChunk: "Lomu is..."
  ↓
[Backend] sendEvent('content', { content: 'Lomu is...' })
  ↓
[Frontend] assistantMessageContent += 'Lomu is...'
[Frontend] flushSync() → immediate render
  ↓
[UI] Word-by-word streaming appears
  ↓
[Gemini] onComplete
  ↓
[Backend] sendEvent('complete', {})
  ↓
[Frontend] setIsGenerating(false)
```

### Example 2: Tool Call with Thinking
```
User: "Create a new file utils.ts"
  ↓
[Gemini] **Analyzing request**\n\n\nI'll create utils.ts
  ↓
[Backend] Detects \n\n\n delimiter
[Backend] sendEvent('assistant_progress', {
  content: '**Analyzing request**',
  category: 'thinking'
})
  ↓
[Frontend] Appends to progressMessages
  ↓
[EnhancedMessageDisplay] Renders purple thinking block
  ↓
[Gemini] functionCall: write_platform_file
  ↓
[Backend] sendEvent('progress', { message: '✏️ Creating utils.ts...' })
  ↓
[StatusStrip] Shows "Creating utils.ts..." in status bar
  ↓
[Backend] File created successfully
[Backend] sendEvent('file_change', { file: { path: 'utils.ts', operation: 'create' }})
  ↓
[Frontend] Updates file tracker (if implemented)
  ↓
[Gemini] functionResponse → continues streaming
```

### Example 3: Deployment Flow
```
[LomuAI] Calls commit_and_deploy tool
  ↓
[Backend] sendEvent('progress', { message: '📤 Committing 3 files...' })
  ↓
[Git] Commit created: abc123
  ↓
[Backend] sendEvent('deploy.started', {
  deploymentId: 'deploy-xyz',
  commitHash: 'abc123',
  commitUrl: 'https://github.com/...'
})
  ↓
[Frontend] Shows deployment card/modal
  ↓
[Backend] sendEvent('deploy.step_update', {
  stepName: 'Pushing to GitHub',
  status: 'in_progress'
})
  ↓
[UI] Updates step status with spinner
  ↓
[Backend] sendEvent('deploy.step_update', {
  stepName: 'Pushing to GitHub',
  status: 'complete'
})
  ↓
[Backend] sendEvent('deploy.complete', {
  status: 'successful',
  deploymentUrl: 'https://...'
})
  ↓
[UI] Shows success message + deployment link
```

---

## 🐛 Debugging Guide

### Common Issues & Solutions

#### 1. **Text Gets Stuck in "Thinking..." Status**
**Symptom:** Status shows "Thinking..." but no text appears

**Root Cause:** Buffer overflow - text starts with `**` but never gets flushed

**Solution:** Already fixed with 800-char overflow protection (line 1904)

**Verify:**
```bash
# Check logs for buffer overflow
grep "BUFFER OVERFLOW PROTECTION" /tmp/logs/Start_application_*.log

# Should see:
[THINKING-BUFFER] Buffer overflow (1245 chars) - flushing as regular content
```

#### 2. **Missing Content at End of Stream**
**Symptom:** Last few words/sentences don't appear

**Root Cause:** Buffered text not flushed on stream completion

**Solution:** Already fixed with onComplete flush (line 2166)

**Verify:**
```bash
# Check logs for completion flush
grep "STREAM-COMPLETE" /tmp/logs/Start_application_*.log

# Should see:
[STREAM-COMPLETE] Flushing 234 chars of buffered text
```

#### 3. **Railway 502 Timeout Errors**
**Symptom:** Connection drops after ~2 minutes of silence

**Root Cause:** Railway kills idle connections

**Solution:** 15-second heartbeat (line 853)

**Verify:**
```bash
# Check logs for heartbeat
grep "LOMU-AI-HEARTBEAT" /tmp/logs/Start_application_*.log

# Should see every 15s:
[LOMU-AI-HEARTBEAT] Sent keepalive to prevent timeout
```

#### 4. **Frontend Doesn't Update During Streaming**
**Symptom:** Text appears in chunks/batches instead of word-by-word

**Root Cause:** React batches state updates

**Solution:** Use `flushSync()` for immediate renders (line 1165)

**Verify:** Check browser DevTools - should see rapid DOM updates

#### 5. **Progress Messages Don't Persist**
**Symptom:** Thinking blocks disappear after stream completes

**Root Cause:** progressMessages not saved in database

**Status:** ✅ Already handled - progressMessages saved in `lomu_messages.progress_data` JSONB column

**Verify:**
```sql
SELECT id, role, progress_data 
FROM lomu_messages 
WHERE role = 'assistant' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Debug Logging

#### Backend Logs
```bash
# View real-time streaming events
tail -f /tmp/logs/Start_application_*.log | grep -E "sendEvent|THINKING-BUFFER|STREAM-COMPLETE"

# Check SSE connection setup
grep "SSE HEADER CONFIGURATION" /tmp/logs/Start_application_*.log

# Monitor heartbeat system
grep "LOMU-AI-HEARTBEAT" /tmp/logs/Start_application_*.log
```

#### Frontend Logs (Browser Console)
```javascript
// Enable SSE debug logging
localStorage.setItem('DEBUG_SSE', 'true');

// Filter SSE events
console.log('[SSE]') // Shows all parsed events
console.log('[SSE-CONTENT]') // Shows content accumulation
console.log('[SSE-UPDATE]') // Shows message updates
```

### Event Tracing

To trace a complete request/response cycle:

1. **Backend:** Search for messageId in logs
```bash
MESSAGE_ID="abc123"
grep "$MESSAGE_ID" /tmp/logs/Start_application_*.log
```

2. **Frontend:** Filter browser console by message ID
```javascript
// In browser console
const messageId = "abc123";
// All logs for this message will show the ID
```

3. **Database:** Check persisted message
```sql
SELECT * FROM lomu_messages WHERE id = 'abc123';
```

---

## 📚 Related Documentation

- **Agent Events Schema:** `shared/agentEvents.ts` - Structured event types
- **Gemini Integration:** `server/gemini.ts` - AI streaming setup
- **Message Display:** `client/src/components/enhanced-message-display.tsx`
- **Anti-Paralysis System:** `replit.md` - Guards against analysis loops

---

## 🚨 Quick Diagnostic Commands

Use these commands for rapid incident response:

### Check Active Streaming Session
```bash
# Get latest log file
LOG_FILE=$(ls -t /tmp/logs/Start_application_*.log | head -1)

# Verify SSE headers sent
grep "SSE HEADER CONFIGURATION" $LOG_FILE

# Check initial heartbeat
grep "Initial heartbeat sent" $LOG_FILE

# Monitor live streaming events
tail -f $LOG_FILE | grep -E "sendEvent|CONTENT|PROGRESS|COMPLETE"
```

### Verify Buffer Protection
```bash
# Check if buffer overflow protection triggered
grep "BUFFER OVERFLOW PROTECTION" $LOG_FILE

# Check if stream completion flushed buffered text
grep "STREAM-COMPLETE.*Flushing" $LOG_FILE
```

### Monitor Heartbeat Health
```bash
# Count heartbeats in last 2 minutes (should be ~8)
grep "LOMU-AI-HEARTBEAT" $LOG_FILE | tail -10
```

### Check Error Rate
```bash
# Find all error events
grep "sendEvent('error'" $LOG_FILE

# Check for anti-paralysis blocks
grep "ANTI_PARALYSIS_BLOCK" $LOG_FILE
```

### Trace Specific Message
```bash
# Replace with actual message ID from frontend
MESSAGE_ID="your-message-id"
grep "$MESSAGE_ID" $LOG_FILE | grep -E "sendEvent|content|progress"
```

---

## ✅ Health Checklist

Use this to verify streaming is working correctly:

### SSE Connection
- [ ] Initial heartbeat sent (`: init\n\n`) → `grep "Initial heartbeat sent" $LOG_FILE`
- [ ] Heartbeat every 15s (`: keepalive\n\n`) → `grep "LOMU-AI-HEARTBEAT" $LOG_FILE`
- [ ] SSE headers configured → `grep "SSE HEADER CONFIGURATION" $LOG_FILE`

### Content Streaming
- [ ] `content` events stream word-by-word → Check browser DevTools Network tab
- [ ] `assistant_progress` creates inline blocks → Verify purple/blue/green blocks appear
- [ ] `progress` updates status bar → Check StatusStrip shows messages
- [ ] Buffer overflow protection triggers after 800 chars → `grep "BUFFER OVERFLOW" $LOG_FILE`
- [ ] Stream completion flushes remaining buffered text → `grep "STREAM-COMPLETE.*Flushing" $LOG_FILE`

### UI Rendering
- [ ] Thinking blocks render with purple styling
- [ ] Action blocks render with blue styling
- [ ] Result blocks render with green styling
- [ ] EnhancedMessageDisplay shows collapsible blocks
- [ ] flushSync() provides word-by-word updates

### Event Handling
- [ ] Error events show toast notifications
- [ ] system_info events logged (not shown as toasts)
- [ ] Test events show in TestingPanel (if applicable)
- [ ] Deployment events show deployment UI (if applicable)

---

**End of Document**
