# Anthropic Wrapper

A robust TypeScript wrapper for the Anthropic API that automatically handles context window limits through token estimation, intelligent truncation, and retry logic.

## Problem

The Anthropic Claude models have a context window limit (200K tokens for Claude Sonnet 4). When making API calls with large conversation histories or system prompts, you can encounter errors like:

```
400 error: input length and `max_tokens` exceed context limit: 196601 + 16000 > 200000
```

This wrapper solves this problem by:
- Estimating token usage before making API calls
- Automatically truncating input when needed
- Dynamically adjusting `max_tokens` to fit within context limits
- Retrying failed requests with more aggressive truncation

## Installation

The module is part of the Archetype platform and located at `server/lib/anthropic-wrapper.ts`.

No additional installation is needed - just import it:

```typescript
import {
  estimateTokensFromText,
  truncateTextByTokens,
  callAnthropic,
  AnthropicWrapper,
} from './lib/anthropic-wrapper';
```

## Configuration

The wrapper uses environment variables for configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Required API key from Anthropic | (required) |
| `ANTHROPIC_DEFAULT_MODEL` | Default model to use | `claude-sonnet-4-20250514` |
| `ANTHROPIC_DEFAULT_MAX_TOKENS` | Default max tokens for responses | `8000` |
| `ANTHROPIC_CONTEXT_LIMIT` | Model context window limit | `200000` |

## Usage

### Basic Token Estimation

```typescript
import { estimateTokensFromText } from './lib/anthropic-wrapper';

const text = 'Hello, world! This is a test message.';
const tokens = estimateTokensFromText(text);
console.log(`Estimated tokens: ${tokens}`); // ~10 tokens
```

### Text Truncation

```typescript
import { truncateTextByTokens } from './lib/anthropic-wrapper';

const longText = '...'; // Some long text
const maxTokens = 1000;
const truncated = truncateTextByTokens(longText, maxTokens);

// Truncated text will preserve start and end, truncate middle
console.log(truncated);
```

### Making API Calls with Context Management

```typescript
import { callAnthropic } from './lib/anthropic-wrapper';

const result = await callAnthropic({
  input: 'What is 2+2?',
  maxTokens: 100,
  model: 'claude-sonnet-4-20250514',
  temperature: 1.0,
});

if (result.success) {
  console.log('Response:', result.response);
  console.log('Was truncated:', result.truncated);
  console.log('Final tokens:', result.finalTokens);
} else {
  console.error('Error:', result.error);
}
```

### Using the AnthropicWrapper Class

```typescript
import { AnthropicWrapper } from './lib/anthropic-wrapper';

const wrapper = new AnthropicWrapper({
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  contextLimit: 200000,
});

// Estimate tokens
const tokens = wrapper.estimateTokens('Some text');

// Truncate text
const truncated = wrapper.truncateText('Long text...', 500);

// Make API call
const result = await wrapper.call({
  input: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' },
  ],
  maxTokens: 2000,
});
```

### Handling Conversation History

```typescript
import { callAnthropic } from './lib/anthropic-wrapper';

// Build conversation messages
const messages = [
  { role: 'user', content: 'First message' },
  { role: 'assistant', content: 'First response' },
  // ... many more messages
  { role: 'user', content: 'Latest message' },
];

// The wrapper will automatically truncate if needed
const result = await callAnthropic({
  input: messages,
  system: 'You are a helpful assistant.',
  maxTokens: 4096,
  tools: [], // Optional tools
});

if (result.truncated) {
  console.log('⚠️  Conversation was truncated to fit context window');
  console.log(`Original: ${result.originalTokens} tokens`);
  console.log(`Final: ${result.finalTokens} tokens`);
}
```

## API Reference

### Functions

#### `estimateTokensFromText(text: string): number`

Estimates the number of tokens in a text string using a conservative heuristic (~4 characters per token).

**Parameters:**
- `text` - The text to estimate tokens for

**Returns:** Estimated number of tokens

---

#### `truncateTextByTokens(text: string, allowedTokens: number): string`

Truncates text to fit within a specified token budget. Preserves the beginning (context) and end (recent messages) by truncating from the middle.

**Parameters:**
- `text` - The text to truncate
- `allowedTokens` - Maximum number of tokens allowed

**Returns:** Truncated text with truncation indicator

---

#### `callAnthropic(options: CallAnthropicOptions): Promise<CallAnthropicResult>`

Calls the Anthropic API with automatic context window management.

**Parameters:**
- `options.input` - Single string or array of messages
- `options.model` - Model to use (optional, defaults to env or claude-sonnet-4-20250514)
- `options.maxTokens` - Max tokens for response (optional, defaults to 8000)
- `options.system` - System prompt (optional)
- `options.tools` - Tool definitions (optional)
- `options.temperature` - Temperature setting (optional, defaults to 1.0)
- `options.stream` - Whether to stream response (optional, defaults to false)

**Returns:** Promise resolving to result object with:
- `success` - Whether the call succeeded
- `response` - Anthropic SDK response (if successful)
- `error` - Error message (if failed)
- `truncated` - Whether input was truncated
- `originalTokens` - Original token count before truncation
- `finalTokens` - Final token count after truncation
- `adjustedMaxTokens` - Adjusted max_tokens value (if changed)

---

### Classes

#### `AnthropicWrapper`

Object-oriented wrapper class providing the same functionality.

**Constructor:**
```typescript
new AnthropicWrapper(options?: {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  contextLimit?: number;
})
```

**Methods:**
- `estimateTokens(text: string): number` - Estimate tokens in text
- `truncateText(text: string, allowedTokens: number): string` - Truncate text
- `call(options: CallAnthropicOptions): Promise<CallAnthropicResult>` - Make API call

## How It Works

### Token Estimation

The wrapper uses a simple but effective heuristic:
- **~4 characters per token** on average for English text and code
- This is conservative and accounts for both text and code
- While not exact, it's sufficient for context window management

### Truncation Strategy

When input exceeds the context window:

1. **First attempt:** Reduce `max_tokens` only
   - If there's enough room for at least 1000 output tokens, just reduce the requested max_tokens
   - This preserves all input context when possible

2. **Second attempt:** Truncate messages AND reduce max_tokens
   - If reducing max_tokens isn't enough, truncate the input messages
   - Keeps the most recent messages (truncates from the beginning)
   - Ensures minimum 1000 tokens for output

3. **Retry logic:** If API still fails with context error
   - Applies more aggressive truncation (80% of available space)
   - Retries the request once

### Safety Margin

The wrapper includes a **5% safety margin** on the context limit to account for:
- Token estimation inaccuracies
- Special tokens and formatting
- Tool definitions and system prompt overhead

Effective limit = 200,000 × 0.95 = 190,000 tokens

## Testing

Run the unit tests:

```bash
npx tsx server/tests/anthropic-wrapper.test.ts
```

Run the usage examples:

```bash
npx tsx server/lib/anthropic-wrapper-example.ts
```

## Example Use Cases

### Meta-SySop Chat

The wrapper is designed for the Meta-SySop chat system which can have:
- Long conversation histories (50+ messages)
- Large system prompts with instructions
- Tool definitions adding to token count
- Code snippets and file contents in messages

Without the wrapper, these conversations would frequently exceed the 200K limit and fail with 400 errors.

### File Diagnosis

When analyzing platform files, the wrapper allows passing large file contents without worrying about context limits:

```typescript
const fileContents = await fs.readFile('large-file.ts', 'utf-8');

const result = await callAnthropic({
  input: `Analyze this file:\n\n${fileContents}`,
  system: 'You are an expert code reviewer.',
  maxTokens: 8000,
});

// File will be truncated if needed, but analysis will still work
```

## Limitations

- **Token estimation is approximate:** Uses 4 chars/token heuristic which may not be exact
- **Truncation from middle:** Might lose important context in the middle of conversations
- **No streaming support for truncation:** Truncation logic assumes non-streaming responses
- **Single retry:** Only retries once on context errors

## Future Improvements

Possible enhancements:
- Use Anthropic's official token counting API when available
- Smart truncation that preserves important context (not just recent messages)
- Configurable truncation strategies
- Better handling of tool definitions in token budget

## License

Part of the Archetype platform. See main repository LICENSE.
