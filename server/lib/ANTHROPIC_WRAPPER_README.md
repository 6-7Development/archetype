# Anthropic API Wrapper

A robust wrapper around the Anthropic API with automatic context management, token estimation, and retry logic.

## Problem

The Meta-SySop chat stream was failing with errors like:
```
input length and `max_tokens` exceed context limit: 196601 + 16000 > 200000
```

This occurs when the combined input tokens and requested output tokens exceed the model's context window (typically 200K tokens for Claude models).

## Solution

This wrapper provides:

1. **Token Estimation**: Conservative estimation of token usage from text
2. **Automatic Truncation**: Intelligently truncates input to fit within context limits
3. **Max Tokens Adjustment**: Reduces requested output tokens when needed
4. **Retry Logic**: Automatically retries with reduced tokens on context limit errors
5. **Environment Configuration**: Configurable via environment variables

## Installation

The wrapper is already integrated into the Archetype platform. No additional installation needed.

## Usage

### Basic Usage

```typescript
import { callAnthropic } from './lib/anthropic-wrapper.js';

const result = await callAnthropic({
  input: 'What is the meaning of life?',
  maxTokens: 4096,
});

console.log(result.content);
console.log('Input tokens:', result.usage.inputTokens);
console.log('Output tokens:', result.usage.outputTokens);
```

### With Conversation History

```typescript
const result = await callAnthropic({
  input: 'Follow-up question',
  messages: [
    { role: 'user', content: 'First message' },
    { role: 'assistant', content: 'First response' },
    { role: 'user', content: 'Second message' },
  ],
  maxTokens: 4096,
});
```

### With System Prompt

```typescript
const result = await callAnthropic({
  input: 'Write a poem',
  system: 'You are a creative poet who writes in haiku form.',
  maxTokens: 2048,
});
```

### With Tools (Function Calling)

```typescript
const result = await callAnthropic({
  input: 'What is the weather in Paris?',
  tools: [
    {
      name: 'get_weather',
      description: 'Get weather information for a location',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    },
  ],
  maxTokens: 1024,
});
```

### Using the Class Interface

```typescript
import { AnthropicWrapper } from './lib/anthropic-wrapper.js';

const wrapper = new AnthropicWrapper(
  'your-api-key',  // Optional, reads from ANTHROPIC_API_KEY env var
  'claude-sonnet-4-20250514',  // Optional model
  4096  // Optional default max tokens
);

const result = await wrapper.call({
  input: 'Hello, Claude!',
});

// Access underlying client for advanced use cases
const client = wrapper.getClient();
```

## Environment Variables

Configure the wrapper using these environment variables:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Optional (with defaults)
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-20250514
ANTHROPIC_DEFAULT_MAX_TOKENS=4096
ANTHROPIC_CONTEXT_LIMIT=200000
```

## Token Estimation

The wrapper uses a conservative character-to-token ratio for estimation:

```typescript
import { estimateTokensFromText } from './lib/anthropic-wrapper.js';

const text = 'Some long text...';
const tokens = estimateTokensFromText(text);
console.log(`Estimated tokens: ${tokens}`);
```

**Note**: The estimation uses 3 characters per token, which is conservative (tends to overestimate). Claude's actual tokenizer averages ~3.5-4 characters per token for English text.

## Text Truncation

Intelligently truncate text to fit within a token budget:

```typescript
import { truncateTextByTokens } from './lib/anthropic-wrapper.js';

const longText = '...very long text...';
const truncated = truncateTextByTokens(longText, 1000);  // Max 1000 tokens
```

The truncation strategy:
- Keeps the beginning (60%) and end (40%) of the text
- Removes middle sections when text is too large
- Adds `[... content truncated ...]` marker

## Return Value

All calls return a `CallAnthropicResult` object:

```typescript
interface CallAnthropicResult {
  content: string;  // Extracted text content
  fullResponse: Anthropic.Messages.Message;  // Full SDK response
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  truncated?: boolean;  // True if input was truncated
  retried?: boolean;  // True if retry was needed
}
```

## Error Handling

The wrapper automatically handles context limit errors:

1. First attempt: Calls API with estimated token usage
2. If context limit error (400): Retries with reduced tokens
   - Reduces `max_tokens` by 30%
   - Truncates messages more aggressively
   - Adds 2000 token safety margin
3. Other errors: Throws immediately

Example:

```typescript
try {
  const result = await callAnthropic({
    input: veryLongInput,
    maxTokens: 16000,
  });
  
  if (result.truncated) {
    console.warn('Input was truncated to fit context');
  }
  
  if (result.retried) {
    console.warn('API call was retried with reduced tokens');
  }
  
} catch (error) {
  console.error('API call failed:', error);
}
```

## Testing

Run the test suite:

```bash
npx tsx server/lib/anthropic-wrapper.test.ts
```

The tests cover:
- Token estimation accuracy
- Text truncation behavior
- API wrapper functionality (mocked)
- Error handling and retries
- Integration tests (optional, requires API key)

## Model Support

Supported Claude models with context limits:

- `claude-sonnet-4-20250514`: 200K tokens
- `claude-3-7-sonnet-20250219`: 200K tokens
- `claude-3-5-sonnet-20241022`: 200K tokens
- `claude-3-5-sonnet-20240620`: 200K tokens
- `claude-3-opus-20240229`: 200K tokens
- `claude-3-sonnet-20240229`: 200K tokens
- `claude-3-haiku-20240307`: 200K tokens

## Integration with Meta-SySop

To integrate with Meta-SySop or other platform features:

```typescript
import { callAnthropic } from './lib/anthropic-wrapper.js';

// In your streaming handler
const response = await callAnthropic({
  input: userMessage,
  system: systemPrompt,
  messages: conversationHistory,
  tools: availableTools,
  maxTokens: 8000,
});

// Check for truncation/retries
if (response.truncated || response.retried) {
  console.warn('[Meta-SySop] Context management applied:', {
    truncated: response.truncated,
    retried: response.retried,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
  });
}
```

## Performance Considerations

- **Token estimation**: O(n) where n is text length, very fast
- **Truncation**: O(n) worst case, typically fast for reasonable sizes
- **API calls**: Same performance as direct SDK calls
- **Retry overhead**: Adds one additional API call on context errors (rare)

## Limitations

1. **Token estimation is approximate**: Uses character count heuristic, not Claude's actual tokenizer
2. **Truncation is lossy**: Middle content is removed when input is too large
3. **Single retry**: Only retries once on context errors
4. **No streaming support**: Currently only supports non-streaming responses (can be extended)

## Future Enhancements

Potential improvements:
- Use official Anthropic tokenizer when available
- Support for streaming responses
- Smarter truncation strategies (e.g., summarization)
- Caching of token estimates
- More sophisticated retry strategies

## License

MIT - Part of the Archetype platform
