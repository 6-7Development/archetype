# Quick Start: Anthropic Wrapper

Get started with the Anthropic wrapper in 5 minutes.

## 1. Basic Usage

```typescript
import { callAnthropic } from './lib/anthropic-wrapper.js';

// Simple API call
const result = await callAnthropic({
  input: 'What is TypeScript?',
  maxTokens: 1024,
});

console.log(result.content);
// Output: TypeScript is a typed superset of JavaScript...
```

## 2. With Conversation History

```typescript
const result = await callAnthropic({
  input: 'Tell me more',
  messages: [
    { role: 'user', content: 'What is TypeScript?' },
    { role: 'assistant', content: 'TypeScript is...' },
    { role: 'user', content: 'Tell me more' },
  ],
  maxTokens: 2048,
});
```

## 3. With System Prompt

```typescript
const result = await callAnthropic({
  input: 'Write a haiku about coding',
  system: 'You are a creative poet.',
  maxTokens: 512,
});
```

## 4. Handling Large Inputs

```typescript
// The wrapper automatically handles large inputs
const veryLongText = '...'; // 100K+ tokens

const result = await callAnthropic({
  input: veryLongText,
  maxTokens: 4096,
});

// Check if truncation occurred
if (result.truncated) {
  console.log('⚠️ Input was truncated to fit context window');
}

// Check if retry was needed
if (result.retried) {
  console.log('⚠️ Request was retried with reduced tokens');
}
```

## 5. Token Estimation

```typescript
import { estimateTokensFromText } from './lib/anthropic-wrapper.js';

const text = 'Some text to estimate';
const tokens = estimateTokensFromText(text);

console.log(`Estimated tokens: ${tokens}`);
```

## 6. Text Truncation

```typescript
import { truncateTextByTokens } from './lib/anthropic-wrapper.js';

const longText = '...very long text...';
const truncated = truncateTextByTokens(longText, 1000);

console.log(truncated);
// Output: Beginning text...[... content truncated ...]...end text
```

## 7. Error Handling

```typescript
try {
  const result = await callAnthropic({
    input: 'Process this',
    maxTokens: 2048,
  });
  
  console.log('Success:', result.content);
} catch (error) {
  if (error.status === 401) {
    console.error('Invalid API key');
  } else if (error.status === 429) {
    console.error('Rate limit exceeded');
  } else {
    console.error('API error:', error.message);
  }
}
```

## 8. Class Interface

```typescript
import { AnthropicWrapper } from './lib/anthropic-wrapper.js';

// Create wrapper instance
const wrapper = new AnthropicWrapper(
  'your-api-key',  // Optional: defaults to ANTHROPIC_API_KEY env var
  'claude-sonnet-4-20250514',  // Optional: defaults to env var
  4096  // Optional: default max tokens
);

// Make calls
const result = await wrapper.call({
  input: 'Hello',
  maxTokens: 1024,
});

// Access underlying client
const client = wrapper.getClient();
```

## 9. Environment Variables

Set these in your `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Optional (with defaults shown)
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-20250514
ANTHROPIC_DEFAULT_MAX_TOKENS=4096
ANTHROPIC_CONTEXT_LIMIT=200000
```

## 10. Return Value

All calls return a rich result object:

```typescript
const result = await callAnthropic({ input: 'Hi' });

console.log(result.content);        // Text response
console.log(result.usage);          // { inputTokens: 10, outputTokens: 5 }
console.log(result.truncated);      // true if input was truncated
console.log(result.retried);        // true if retry was needed
console.log(result.fullResponse);   // Full Anthropic SDK response
```

## Common Patterns

### Pattern 1: Check Before Large Operations

```typescript
import { estimateTokensFromText } from './lib/anthropic-wrapper.js';

const tokens = estimateTokensFromText(myLargeInput);

if (tokens > 150000) {
  console.warn('Large input detected, truncation likely');
}

const result = await callAnthropic({
  input: myLargeInput,
  maxTokens: 8000,
});
```

### Pattern 2: Progressive Truncation

```typescript
import { truncateTextByTokens } from './lib/anthropic-wrapper.js';

// Try full input first
let input = myLargeText;
let result;

try {
  result = await callAnthropic({ input, maxTokens: 4096 });
} catch (error) {
  // If it fails, pre-truncate and retry
  input = truncateTextByTokens(myLargeText, 100000);
  result = await callAnthropic({ input, maxTokens: 4096 });
}
```

### Pattern 3: Monitor Token Usage

```typescript
const calls = [];
let totalTokens = 0;

for (const item of items) {
  const result = await callAnthropic({
    input: item.text,
    maxTokens: 2048,
  });
  
  calls.push(result);
  totalTokens += result.usage.inputTokens + result.usage.outputTokens;
}

console.log(`Total tokens used: ${totalTokens}`);
console.log(`Estimated cost: $${(totalTokens / 1000 * 0.003).toFixed(4)}`);
```

## Testing

Run the test suite:

```bash
npx tsx server/lib/anthropic-wrapper.test.ts
```

Expected output:
```
======================================================================
  Anthropic Wrapper Unit Tests
======================================================================

... (21 tests)

======================================================================
Results: 21 passed, 0 failed
======================================================================
```

## Troubleshooting

### "Cannot find module '@anthropic-ai/sdk'"
Install dependencies: `npm install`

### "API key invalid"
Set `ANTHROPIC_API_KEY` environment variable or pass to constructor

### "Context limit exceeded" (rare)
Should be automatically handled by wrapper. If you see this:
1. Check if wrapper is being used correctly
2. Verify token estimation is working
3. File an issue with reproduction steps

### Tests failing
1. Ensure `@anthropic-ai/sdk` is installed
2. Run with `npx tsx` not `node`
3. Check TypeScript version is compatible

## Next Steps

- 📖 Read the [full README](./ANTHROPIC_WRAPPER_README.md)
- 🔧 See [integration guide](./INTEGRATION_GUIDE.md) for Meta-SySop
- 💡 Check [examples](./anthropic-wrapper-examples.ts) for advanced patterns
- 📊 Review [implementation summary](./IMPLEMENTATION_SUMMARY.md)

## Support

Questions? Check:
1. `ANTHROPIC_WRAPPER_README.md` - Complete API documentation
2. `anthropic-wrapper-examples.ts` - 5 practical examples
3. `INTEGRATION_GUIDE.md` - Integration into existing code
4. Test file - `anthropic-wrapper.test.ts` has usage examples

---

**Happy Coding!** 🚀
