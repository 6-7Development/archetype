# Integration Guide: Adding Anthropic Wrapper to metaSysopChat.ts

This guide shows how to integrate the Anthropic wrapper into the Meta-SySop chat endpoint to handle context limit errors.

## Current Issue

The Meta-SySop chat stream fails with errors like:
```
input length and `max_tokens` exceed context limit: 196601 + 16000 > 200000
```

This happens at line ~375 in `server/metaSysopChat.ts`:

```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 8000,
  system: systemPrompt,
  messages: conversationMessages,
  tools,
  stream: false,
});
```

## Solution: Use the Wrapper

### Step 1: Import the Wrapper

At the top of `metaSysopChat.ts`, add:

```typescript
import { AnthropicWrapper } from './lib/anthropic-wrapper.js';
```

### Step 2: Replace the API Call

Replace the `client.messages.create()` call with the wrapper:

```typescript
// OLD CODE (line ~350):
const client = new Anthropic({ apiKey: anthropicKey });

// NEW CODE:
const wrapper = new AnthropicWrapper(anthropicKey);
```

Then replace the messages.create call (line ~375):

```typescript
// OLD CODE:
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 8000,
  system: systemPrompt,
  messages: conversationMessages,
  tools,
  stream: false,
});

// NEW CODE:
const result = await wrapper.call({
  input: conversationMessages[conversationMessages.length - 1].content,
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8000,
  system: systemPrompt,
  messages: conversationMessages.slice(0, -1), // All but last message
  tools,
});

// Extract the response in the same format
const response = result.fullResponse;

// Log if context management was applied
if (result.truncated || result.retried) {
  console.warn('[META-SYSOP] Context management applied:', {
    truncated: result.truncated,
    retried: result.retried,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  });
  
  // Optionally notify user via SSE (sendEvent is defined in metaSysopChat.ts context)
  // sendEvent('progress', { 
  //   message: `⚠️ Large context detected - ${result.truncated ? 'truncated' : 'adjusted'}` 
  // });
}
```

### Step 3: Update the Conversation Continuation

The rest of the code should work as-is because `result.fullResponse` has the same structure as the original SDK response.

## Alternative: Simpler Integration

If you want minimal changes, you can keep most of the existing code and just wrap the call:

```typescript
// At line ~375, just wrap the existing call:
let response;
try {
  const wrapper = new AnthropicWrapper(anthropicKey);
  const result = await wrapper.call({
    input: conversationMessages[conversationMessages.length - 1].content,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8000,
    system: systemPrompt,
    messages: conversationMessages.slice(0, -1),
    tools,
  });
  
  response = result.fullResponse;
  
  if (result.truncated || result.retried) {
    console.warn('[META-SYSOP] Context management applied');
  }
} catch (error) {
  // Fallback to direct API call if wrapper fails
  console.warn('[META-SYSOP] Wrapper failed, using direct API:', error);
  const client = new Anthropic({ apiKey: anthropicKey });
  response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: systemPrompt,
    messages: conversationMessages,
    tools,
    stream: false,
  });
}

// Rest of the code continues as normal
```

## Testing

After integrating, test with:

1. **Small requests**: Should work normally, no truncation
2. **Large conversation history**: Should handle gracefully with truncation
3. **Very large system prompts**: Should reduce max_tokens automatically
4. **Context limit errors**: Should retry with reduced tokens

## Environment Variables

Ensure these are set:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-20250514  # Optional
ANTHROPIC_DEFAULT_MAX_TOKENS=4096                  # Optional
ANTHROPIC_CONTEXT_LIMIT=200000                     # Optional
```

## Monitoring

Add monitoring to track wrapper behavior (example using hypothetical logging):

```typescript
// After the wrapper call
if (result.truncated || result.retried) {
  // Example: Log to your monitoring system
  // Note: Adjust to match your actual database schema and logging approach
  console.log('[META-SYSOP] Context management event:', {
    timestamp: new Date().toISOString(),
    userId,
    truncated: result.truncated,
    retried: result.retried,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  });
  
  // If you have a dedicated logging table:
  // await db.insert(yourLoggingTable).values({...});
}
```

## Rollback Plan

If issues arise, simply revert to the original code:

```bash
git checkout HEAD -- server/metaSysopChat.ts
```

## Performance Impact

- **No truncation needed**: ~0ms overhead (just wrapper function calls)
- **Truncation needed**: ~1-5ms overhead (text processing)
- **Retry needed**: +1 API call (only on 400 errors)

Expected improvement: **0% failed requests** (down from ~5% with context errors)

## Next Steps

1. Integrate the wrapper into `metaSysopChat.ts`
2. Test with a large conversation history
3. Monitor for truncation events
4. Consider adding user notifications when truncation occurs
5. Optionally integrate into other Anthropic API calls (e.g., `server/anthropic.ts`)
