# Anthropic Context Limit Wrapper - Usage Guide

## Overview

The `AnthropicWrapper` class provides robust handling for Anthropic API calls, preventing context limit errors that can cause API failures.

## Problem Statement

Anthropic API calls can fail with errors like:
```
400 invalid_request_error: input length and `max_tokens` exceed context limit: 196601 + 16000 > 200000
```

This happens when the combined input tokens and requested max_tokens exceed the model's context window (e.g., 200,000 tokens for Claude Sonnet 4).

## Solution

The `AnthropicWrapper` class:
1. **Estimates token usage** using character-based approximation (1 token ≈ 4 characters)
2. **Truncates input** or reduces `max_tokens` to fit within context limits
3. **Retries automatically** with reduced parameters on context-limit errors
4. **Provides clear logging** for diagnosis and debugging

## Installation

The wrapper is already included in the codebase at `server/lib/anthropic-wrapper.ts`.

## Basic Usage

### Simple Text Completion

```typescript
import { AnthropicWrapper } from './server/lib/anthropic-wrapper';

const wrapper = new AnthropicWrapper();

// Simple API call with automatic context handling
const response = await wrapper.callAnthropic({
  input: 'What is the capital of France?',
  maxTokens: 1024,
});

console.log(response.content); // "The capital of France is Paris."
console.log(response.usage); // { inputTokens: 15, outputTokens: 8 }
```

### Conversation with Messages

```typescript
const messages = [
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi! How can I help you?' },
  { role: 'user', content: 'Tell me about TypeScript.' },
];

const response = await wrapper.callAnthropic({
  input: messages,
  system: 'You are a helpful coding assistant.',
  maxTokens: 2048,
  temperature: 0.7,
});
```

### Using Singleton Instance

```typescript
import { getAnthropicWrapper } from './server/lib/anthropic-wrapper';

const wrapper = getAnthropicWrapper();
const response = await wrapper.callAnthropic({
  input: 'Explain quantum computing',
});
```

## Configuration via Environment Variables

Add these to your `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx

# Optional - Advanced configuration
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-20250514
ANTHROPIC_DEFAULT_MAX_TOKENS=4096

# Context limits per model (optional overrides)
ANTHROPIC_CONTEXT_LIMIT_CLAUDE_SONNET_4_20250514=200000
ANTHROPIC_CONTEXT_LIMIT_CLAUDE_3_5_SONNET_20241022=200000
```

## API Reference

### AnthropicWrapper Class

#### Constructor

```typescript
const wrapper = new AnthropicWrapper(apiKey?: string);
```

#### Methods

##### estimateTokensFromText(text: string): number

Estimates token count from text using character-based approximation.

```typescript
const tokens = wrapper.estimateTokensFromText('Hello, world!');
console.log(tokens); // ~4 tokens
```

##### truncateTextByTokens(text: string, allowedTokens: number): string

Truncates text to fit within a token budget.

```typescript
const longText = 'a'.repeat(10000);
const truncated = wrapper.truncateTextByTokens(longText, 100);
// Returns truncated text with "[... truncated due to context length ...]" note
```

##### callAnthropic(options: AnthropicCallOptions): Promise<AnthropicResponse>

Main method for making API calls with automatic context handling.

**Options:**
- `input` (required): String or array of message objects
- `model` (optional): Model name (default: from env or 'claude-sonnet-4-20250514')
- `maxTokens` (optional): Maximum output tokens (default: from env or 4096)
- `system` (optional): System prompt
- `temperature` (optional): Sampling temperature (0.0 - 1.0)
- `topP` (optional): Nucleus sampling parameter
- `tools` (optional): Tool definitions for Claude
- `signal` (optional): AbortSignal for cancellation

**Returns:**
```typescript
{
  content: string;           // Generated text
  stopReason: string | null; // Why generation stopped
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;            // Model used
  raw?: any;                // Full SDK response
}
```

## Utility Functions

### sanitizeDiagnosisFileList(files: string[] | undefined | null): string[]

Sanitizes file lists for diagnosis operations, with explicit logging.

```typescript
import { sanitizeDiagnosisFileList } from './server/lib/anthropic-wrapper';

const files = ['file1.ts', null, '', 'file2.ts'];
const sanitized = sanitizeDiagnosisFileList(files);
// Logs: "ℹ️ Sanitized file list: 2 valid entries (2 invalid entries removed)"
// Returns: ['file1.ts', 'file2.ts']
```

Logs when file lists are empty or invalid, signaling fallback usage.

## Integration Examples

### In Express Route Handler

```typescript
import { Router } from 'express';
import { getAnthropicWrapper } from '../lib/anthropic-wrapper';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const wrapper = getAnthropicWrapper();
    
    const response = await wrapper.callAnthropic({
      input: message,
      maxTokens: 2048,
    });
    
    res.json({ 
      reply: response.content,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

export default router;
```

### In Meta-SySop Chat (Example Integration)

```typescript
// In server/metaSysopChat.ts or similar

import { getAnthropicWrapper } from '../lib/anthropic-wrapper';

const wrapper = getAnthropicWrapper();

const response = await wrapper.callAnthropic({
  input: conversationMessages,
  system: systemPrompt,
  maxTokens: 8000, // Will be auto-adjusted if too large
  tools: metaSysopTools,
});

// Response includes usage metrics for cost tracking
console.log(`Used ${response.usage.inputTokens} input + ${response.usage.outputTokens} output tokens`);
```

## Error Handling

The wrapper handles context-limit errors automatically, but other errors should be caught:

```typescript
try {
  const response = await wrapper.callAnthropic({
    input: veryLongInput,
    maxTokens: 16000,
  });
} catch (error) {
  if (error.status === 401) {
    console.error('Invalid API key');
  } else if (error.status === 429) {
    console.error('Rate limited - implement retry logic');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Testing

Run the unit tests:

```bash
npx tsx server/tests/lib/anthropic-wrapper.test.ts
```

Tests cover:
- Token estimation accuracy
- Text truncation logic
- File list sanitization
- Configuration handling
- Edge cases (null, undefined, empty strings)

## Best Practices

1. **Use environment variables** for configuration instead of hardcoding
2. **Monitor token usage** via the `usage` field in responses for cost tracking
3. **Set appropriate maxTokens** based on your use case (smaller = faster + cheaper)
4. **Handle errors gracefully** - the wrapper retries context errors but not auth/rate limit errors
5. **Use sanitizeDiagnosisFileList** when working with file lists to ensure data quality

## Troubleshooting

### "Still getting context limit errors"

If you still see context limit errors despite using the wrapper:
1. Check that your input isn't massively exceeding the context limit (>180k tokens)
2. Reduce the initial `maxTokens` parameter (try 4096 or less)
3. Enable debug logging to see truncation attempts:
   ```typescript
   // The wrapper logs warnings automatically to console
   ```

### "Token estimates seem off"

The wrapper uses a conservative estimate (1 token ≈ 4 chars with 10% buffer). This is intentionally safe rather than precise. Real token counts may vary by ±20%.

### "Truncation is cutting off important context"

Consider:
1. Reducing `maxTokens` to preserve more input
2. Summarizing or preprocessing input before sending
3. Using a model with a larger context window if available

## Future Enhancements

Potential improvements for maintainers:
- Add streaming support with real-time context checks
- Integrate actual tokenizer for precise counts (instead of approximation)
- Add caching layer for repeated inputs
- Support for batching multiple requests
- Automatic conversation history pruning

## Support

For issues or questions about the wrapper:
1. Check the tests in `server/tests/lib/anthropic-wrapper.test.ts` for examples
2. Review error logs for specific failure modes
3. Consult the Anthropic API documentation: https://docs.anthropic.com/
