/**
 * Unit Tests for Anthropic Wrapper
 * 
 * Tests token estimation, truncation, and API wrapper functionality
 * 
 * Run with: npx tsx server/lib/anthropic-wrapper.test.ts
 */

import {
  estimateTokensFromText,
  truncateTextByTokens,
  callAnthropic,
  AnthropicWrapper,
  type CallAnthropicOptions,
} from './anthropic-wrapper.js';
import Anthropic from '@anthropic-ai/sdk';

// Simple mock function implementation
const vi = {
  fn: (impl?: any) => {
    const mock: any = (...args: any[]) => {
      mock.mock.calls.push(args);
      if (mock.mock.implementations.length > 0) {
        const implFn = mock.mock.implementations.shift();
        return implFn(...args);
      }
      return impl ? impl(...args) : undefined;
    };
    mock.mock = {
      calls: [] as any[][],
      implementations: [] as any[],
    };
    mock.mockResolvedValue = (value: any) => {
      mock.mock.implementations.push(() => Promise.resolve(value));
      return mock;
    };
    mock.mockRejectedValue = (value: any) => {
      mock.mock.implementations.push(() => Promise.reject(value));
      return mock;
    };
    mock.mockResolvedValueOnce = (value: any) => {
      mock.mock.implementations.push(() => Promise.resolve(value));
      return mock;
    };
    mock.mockRejectedValueOnce = (value: any) => {
      mock.mock.implementations.push(() => Promise.reject(value));
      return mock;
    };
    return mock;
  },
};

// ============================================================================
// Test Utilities
// ============================================================================

// Simple test runner for environments without vitest
class SimpleTestRunner {
  private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void | Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('  Anthropic Wrapper Unit Tests');
    console.log('='.repeat(70) + '\n');

    for (const test of this.tests) {
      try {
        process.stdout.write(`${test.name}...`);
        await test.fn();
        this.passed++;
        console.log(' ✓');
      } catch (error: any) {
        this.failed++;
        console.log(` ✗\n  Error: ${error.message}`);
        if (error.stack) {
          console.log(`  ${error.stack.split('\n').slice(1, 3).join('\n  ')}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Results: ${this.passed} passed, ${this.failed} failed`);
    console.log('='.repeat(70) + '\n');

    return this.failed === 0;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`${message}: expected ${expected} ± ${tolerance}, got ${actual}`);
  }
}

// ============================================================================
// Token Estimation Tests
// ============================================================================

const runner = new SimpleTestRunner();

runner.test('estimateTokensFromText: handles empty string', () => {
  const tokens = estimateTokensFromText('');
  assert(tokens === 0, 'Empty string should have 0 tokens');
});

runner.test('estimateTokensFromText: handles null/undefined', () => {
  const tokens1 = estimateTokensFromText(null as any);
  const tokens2 = estimateTokensFromText(undefined as any);
  assert(tokens1 === 0, 'Null should have 0 tokens');
  assert(tokens2 === 0, 'Undefined should have 0 tokens');
});

runner.test('estimateTokensFromText: estimates short text', () => {
  const text = 'Hello world';
  const tokens = estimateTokensFromText(text);
  // "Hello world" = 11 chars, at 3 chars/token = ~4 tokens
  assertApprox(tokens, 4, 2, 'Short text estimation');
});

runner.test('estimateTokensFromText: estimates long text', () => {
  // Create a ~3000 character text (should be ~1000 tokens)
  const text = 'abc'.repeat(1000); // 3000 chars
  const tokens = estimateTokensFromText(text);
  assertApprox(tokens, 1000, 100, 'Long text estimation');
});

runner.test('estimateTokensFromText: conservative estimation', () => {
  // Our estimate should be conservative (overestimate)
  // Average English text is ~4 chars/token, we use 3 chars/token
  const text = 'The quick brown fox jumps over the lazy dog';
  const tokens = estimateTokensFromText(text);
  // 44 chars / 3 = 15 tokens (conservative)
  // Actual would be ~11 tokens with Claude's tokenizer
  assert(tokens >= 11, 'Should be conservative (overestimate)');
  assert(tokens <= 20, 'Should not wildly overestimate');
});

// ============================================================================
// Truncation Tests
// ============================================================================

runner.test('truncateTextByTokens: no truncation when under limit', () => {
  const text = 'Short text';
  const truncated = truncateTextByTokens(text, 1000);
  assert(truncated === text, 'Should not truncate when under limit');
});

runner.test('truncateTextByTokens: truncates long text', () => {
  const text = 'a'.repeat(10000); // Very long text
  const truncated = truncateTextByTokens(text, 100);
  const tokens = estimateTokensFromText(truncated);
  assert(tokens <= 100, `Truncated text should be <= 100 tokens, got ${tokens}`);
  assert(truncated.includes('[... content truncated ...]'), 'Should include truncation marker');
});

runner.test('truncateTextByTokens: preserves start and end', () => {
  const text = 'START' + 'x'.repeat(10000) + 'END';
  const truncated = truncateTextByTokens(text, 100);
  assert(truncated.startsWith('START'), 'Should preserve start');
  assert(truncated.endsWith('END'), 'Should preserve end');
  assert(truncated.includes('[... content truncated ...]'), 'Should include truncation marker');
});

runner.test('truncateTextByTokens: handles empty string', () => {
  const truncated = truncateTextByTokens('', 100);
  assert(truncated === '', 'Empty string should remain empty');
});

runner.test('truncateTextByTokens: handles very small limits', () => {
  const text = 'This is a long text that needs truncation';
  const truncated = truncateTextByTokens(text, 5);
  const tokens = estimateTokensFromText(truncated);
  // Very small limits may result in just the ellipsis or slightly more
  assert(tokens <= 20, 'Should handle very small limits gracefully');
  assert(truncated.length > 0, 'Should return some text');
});

// ============================================================================
// AnthropicWrapper Tests (with mocked API)
// ============================================================================

runner.test('AnthropicWrapper: constructs with defaults', () => {
  const wrapper = new AnthropicWrapper();
  const client = wrapper.getClient();
  assert(client !== null, 'Should create client');
  assert(client instanceof Anthropic, 'Should be Anthropic instance');
});

runner.test('AnthropicWrapper: constructs with custom params', () => {
  const wrapper = new AnthropicWrapper('test-key', 'test-model', 2048);
  assert(wrapper !== null, 'Should create wrapper with custom params');
});

// Mock API response
const createMockResponse = (text: string, inputTokens: number, outputTokens: number) => ({
  id: 'msg_test123',
  type: 'message' as const,
  role: 'assistant' as const,
  content: [
    {
      type: 'text' as const,
      text,
    },
  ],
  model: 'claude-sonnet-4-20250514',
  stop_reason: 'end_turn' as const,
  stop_sequence: null,
  usage: {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  },
});

runner.test('AnthropicWrapper.call: basic successful call', async () => {
  const wrapper = new AnthropicWrapper('test-key');
  const mockCreate = vi.fn().mockResolvedValue(createMockResponse('Hello!', 10, 5));
  
  // Mock the client's messages.create method
  (wrapper.getClient().messages as any).create = mockCreate;
  
  const result = await wrapper.call({
    input: 'Hi',
  });
  
  assert(result.content === 'Hello!', 'Should return response text');
  assert(result.usage.inputTokens === 10, 'Should return input tokens');
  assert(result.usage.outputTokens === 5, 'Should return output tokens');
  assert(mockCreate.mock.calls.length === 1, 'Should call API once');
});

runner.test('AnthropicWrapper.call: handles large input', async () => {
  const wrapper = new AnthropicWrapper('test-key');
  const mockCreate = vi.fn().mockResolvedValue(createMockResponse('Response', 1000, 50));
  (wrapper.getClient().messages as any).create = mockCreate;
  
  // Create input that would exceed context (simulate ~190K tokens)
  // 190K + 16K = 206K which exceeds the 200K limit
  const largeInput = 'a'.repeat(570000); // ~190K tokens (570K chars / 3)
  
  const result = await wrapper.call({
    input: largeInput,
    maxTokens: 16000,
  });
  
  // With 190K input tokens + 16K output = 206K total, which exceeds 200K limit
  // The wrapper should adjust either input or max_tokens
  const callParams = mockCreate.mock.calls[0][0];
  const actualMaxTokens = callParams.max_tokens;
  
  // Either max_tokens was reduced OR the message was truncated
  const actualMessageLength = JSON.stringify(callParams.messages).length;
  const originalMessageLength = largeInput.length;
  
  const wasAdjusted = actualMaxTokens < 16000 || actualMessageLength < originalMessageLength;
  
  assert(
    wasAdjusted || result.truncated,
    `Should handle large input that exceeds context. maxTokens: ${actualMaxTokens}, truncated: ${result.truncated}, msgLen: ${actualMessageLength}/${originalMessageLength}`
  );
  assert(mockCreate.mock.calls.length === 1, 'Should call API once');
});

runner.test('AnthropicWrapper.call: retries on context error', async () => {
  const wrapper = new AnthropicWrapper('test-key');
  
  // First call fails with context error, second succeeds
  const mockCreate = vi.fn()
    .mockRejectedValueOnce({
      status: 400,
      message: 'input length and max_tokens exceed context limit',
    })
    .mockResolvedValueOnce(createMockResponse('Success', 1000, 50));
  
  (wrapper.getClient().messages as any).create = mockCreate;
  
  const result = await wrapper.call({
    input: 'Test',
    maxTokens: 8000,
  });
  
  assert(result.content === 'Success', 'Should succeed after retry');
  assert(result.retried === true, 'Should mark as retried');
  assert(mockCreate.mock.calls.length === 2, 'Should call API twice');
  
  // Second call should have same or fewer tokens (reduced by up to 30%)
  const firstCallTokens = mockCreate.mock.calls[0][0].max_tokens;
  const secondCallTokens = mockCreate.mock.calls[1][0].max_tokens;
  assert(secondCallTokens <= firstCallTokens, 'Should not increase tokens on retry');
  assert(secondCallTokens >= firstCallTokens * 0.6, 'Should reduce tokens by reasonable amount');
});

runner.test('AnthropicWrapper.call: throws on non-context errors', async () => {
  const wrapper = new AnthropicWrapper('test-key');
  
  const mockCreate = vi.fn().mockRejectedValue({
    status: 401,
    message: 'Invalid API key',
  });
  
  (wrapper.getClient().messages as any).create = mockCreate;
  
  let thrown = false;
  try {
    await wrapper.call({
      input: 'Test',
    });
  } catch (error: any) {
    thrown = true;
    assert(error.message.includes('Invalid API key'), 'Should throw original error');
  }
  
  assert(thrown, 'Should throw error');
  assert(mockCreate.mock.calls.length === 1, 'Should not retry on auth errors');
});

runner.test('AnthropicWrapper.call: supports conversation history', async () => {
  const wrapper = new AnthropicWrapper('test-key');
  const mockCreate = vi.fn().mockResolvedValue(createMockResponse('Response', 100, 20));
  (wrapper.getClient().messages as any).create = mockCreate;
  
  const result = await wrapper.call({
    input: 'Follow-up',
    messages: [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'Second message' },
    ],
  });
  
  assert(result.content === 'Response', 'Should handle conversation history');
  
  const callParams = mockCreate.mock.calls[0][0];
  assert(callParams.messages.length === 3, 'Should include all messages');
});

runner.test('AnthropicWrapper.call: supports system prompt', async () => {
  const wrapper = new AnthropicWrapper('test-key');
  const mockCreate = vi.fn().mockResolvedValue(createMockResponse('Response', 100, 20));
  (wrapper.getClient().messages as any).create = mockCreate;
  
  await wrapper.call({
    input: 'Test',
    system: 'You are a helpful assistant.',
  });
  
  const callParams = mockCreate.mock.calls[0][0];
  assert(callParams.system === 'You are a helpful assistant.', 'Should include system prompt');
});

runner.test('AnthropicWrapper.call: supports tools', async () => {
  const wrapper = new AnthropicWrapper('test-key');
  const mockCreate = vi.fn().mockResolvedValue(createMockResponse('Response', 100, 20));
  (wrapper.getClient().messages as any).create = mockCreate;
  
  const tools = [
    {
      name: 'get_weather',
      description: 'Get weather information',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
      },
    },
  ];
  
  await wrapper.call({
    input: 'What is the weather?',
    tools,
  });
  
  const callParams = mockCreate.mock.calls[0][0];
  assert(callParams.tools !== undefined, 'Should include tools');
  assert(callParams.tools.length === 1, 'Should have one tool');
});

runner.test('callAnthropic: convenience function works', async () => {
  // This test uses the convenience function which creates a wrapper internally
  // We can't easily mock it without a real API key, so we skip API-level validation
  
  // Just verify the function exists and can be called
  assert(typeof callAnthropic === 'function', 'callAnthropic should be a function');
  
  // If there's a real API key, we could test it, but for unit tests we'll skip
  console.log('      [Function signature validated]');
});

// ============================================================================
// Integration Tests (require real API key)
// ============================================================================

runner.test('Integration: Real API call (skipped if no key)', async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey || apiKey === 'dummy-key-for-development') {
    console.log('      [Skipped - no API key]');
    return;
  }
  
  // Only run if we have a real API key
  const wrapper = new AnthropicWrapper(apiKey);
  
  const result = await wrapper.call({
    input: 'Say "Hello" and nothing else.',
    maxTokens: 50,
  });
  
  assert(result.content.length > 0, 'Should get response');
  assert(result.usage.inputTokens > 0, 'Should report input tokens');
  assert(result.usage.outputTokens > 0, 'Should report output tokens');
  assert(result.fullResponse !== null, 'Should return full response');
});

// ============================================================================
// Run Tests
// ============================================================================

// Run tests if this file is executed directly
const isMainModule = typeof process !== 'undefined' && 
                     typeof process.argv !== 'undefined' &&
                     process.argv[1] && 
                     process.argv[1].includes('anthropic-wrapper.test');

if (isMainModule) {
  runner.run().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { runner };
