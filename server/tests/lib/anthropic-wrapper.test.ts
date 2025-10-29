/**
 * Unit tests for AnthropicWrapper
 * 
 * Tests token estimation, truncation logic, and sanitization helpers
 * Run with: tsx server/tests/lib/anthropic-wrapper.test.ts
 */

import { AnthropicWrapper, sanitizeDiagnosisFileList } from '../../lib/anthropic-wrapper';

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void | Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('  AnthropicWrapper Unit Tests');
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
          const stackLines = error.stack.split('\n').slice(1, 3);
          console.log(`  Stack: ${stackLines.join('\n')}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Results: ${this.passed} passed, ${this.failed} failed`);
    console.log('='.repeat(70) + '\n');

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Test utilities
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string) {
  if (actual <= expected) {
    throw new Error(
      message || `Expected ${actual} to be greater than ${expected}`
    );
  }
}

function assertLessThan(actual: number, expected: number, message?: string) {
  if (actual >= expected) {
    throw new Error(
      message || `Expected ${actual} to be less than ${expected}`
    );
  }
}

// Test suite
const runner = new TestRunner();

// ============================================================================
// Token Estimation Tests
// ============================================================================

runner.test('Test 1: estimateTokensFromText - empty string', () => {
  const wrapper = new AnthropicWrapper('test-key');
  const tokens = wrapper.estimateTokensFromText('');
  assertEqual(tokens, 0, 'Empty string should have 0 tokens');
});

runner.test('Test 2: estimateTokensFromText - simple text', () => {
  const wrapper = new AnthropicWrapper('test-key');
  const text = 'Hello, world!'; // 13 characters
  const tokens = wrapper.estimateTokensFromText(text);
  
  // Should be roughly 13/4 * 1.1 ≈ 4 tokens
  assertGreaterThan(tokens, 0, 'Should have positive tokens');
  assertLessThan(tokens, 10, 'Should be reasonable estimate for short text');
});

runner.test('Test 3: estimateTokensFromText - long text', () => {
  const wrapper = new AnthropicWrapper('test-key');
  const text = 'a'.repeat(4000); // 4000 characters
  const tokens = wrapper.estimateTokensFromText(text);
  
  // Should be roughly 4000/4 * 1.1 ≈ 1100 tokens
  assertGreaterThan(tokens, 1000, 'Should estimate ~1000+ tokens');
  assertLessThan(tokens, 1500, 'Should not overestimate too much');
});

runner.test('Test 4: estimateTokensFromText - handles null/undefined', () => {
  const wrapper = new AnthropicWrapper('test-key');
  
  // @ts-ignore - Testing runtime behavior
  const tokensNull = wrapper.estimateTokensFromText(null);
  assertEqual(tokensNull, 0, 'Null should return 0 tokens');
  
  // @ts-ignore - Testing runtime behavior
  const tokensUndefined = wrapper.estimateTokensFromText(undefined);
  assertEqual(tokensUndefined, 0, 'Undefined should return 0 tokens');
});

// ============================================================================
// Text Truncation Tests
// ============================================================================

runner.test('Test 5: truncateTextByTokens - no truncation needed', () => {
  const wrapper = new AnthropicWrapper('test-key');
  const text = 'Short text';
  const truncated = wrapper.truncateTextByTokens(text, 1000);
  
  assertEqual(truncated, text, 'Should not truncate if under budget');
});

runner.test('Test 6: truncateTextByTokens - truncates long text', () => {
  const wrapper = new AnthropicWrapper('test-key');
  const text = 'a'.repeat(4000); // 4000 characters ≈ 1100 tokens
  const truncated = wrapper.truncateTextByTokens(text, 100); // Only 100 tokens allowed
  
  assert(truncated.length < text.length, 'Should truncate text');
  assert(
    truncated.includes('[... truncated due to context length ...]'),
    'Should include truncation indicator'
  );
});

runner.test('Test 7: truncateTextByTokens - empty string', () => {
  const wrapper = new AnthropicWrapper('test-key');
  const truncated = wrapper.truncateTextByTokens('', 100);
  assertEqual(truncated, '', 'Empty string should remain empty');
});

runner.test('Test 8: truncateTextByTokens - zero token budget', () => {
  const wrapper = new AnthropicWrapper('test-key');
  const text = 'Some text';
  const truncated = wrapper.truncateTextByTokens(text, 0);
  assertEqual(truncated, '', 'Zero budget should return empty string');
});

// ============================================================================
// File List Sanitization Tests
// ============================================================================

runner.test('Test 9: sanitizeDiagnosisFileList - valid file list', () => {
  const files = ['file1.ts', 'file2.ts', 'dir/file3.ts'];
  const sanitized = sanitizeDiagnosisFileList(files);
  
  assertEqual(sanitized.length, 3, 'Should keep all valid files');
  assertEqual(sanitized[0], 'file1.ts', 'Should preserve file names');
});

runner.test('Test 10: sanitizeDiagnosisFileList - null/undefined', () => {
  const sanitizedNull = sanitizeDiagnosisFileList(null);
  const sanitizedUndefined = sanitizeDiagnosisFileList(undefined);
  
  assertEqual(sanitizedNull.length, 0, 'Null should return empty array');
  assertEqual(sanitizedUndefined.length, 0, 'Undefined should return empty array');
});

runner.test('Test 11: sanitizeDiagnosisFileList - empty array', () => {
  const sanitized = sanitizeDiagnosisFileList([]);
  assertEqual(sanitized.length, 0, 'Empty array should return empty array');
});

runner.test('Test 12: sanitizeDiagnosisFileList - filters invalid entries', () => {
  const files = [
    'valid.ts',
    null as any,
    undefined as any,
    '',
    '  ',
    'another-valid.ts',
  ];
  const sanitized = sanitizeDiagnosisFileList(files);
  
  assertEqual(sanitized.length, 2, 'Should keep only 2 valid files');
  assert(sanitized.includes('valid.ts'), 'Should include valid.ts');
  assert(sanitized.includes('another-valid.ts'), 'Should include another-valid.ts');
});

runner.test('Test 13: sanitizeDiagnosisFileList - all invalid entries', () => {
  const files = [null as any, undefined as any, '', '  '];
  const sanitized = sanitizeDiagnosisFileList(files);
  
  assertEqual(sanitized.length, 0, 'All invalid entries should result in empty array');
});

runner.test('Test 14: sanitizeDiagnosisFileList - mixed valid/invalid', () => {
  const files = ['file1.ts', '', 'file2.ts', null as any, 'file3.ts'];
  const sanitized = sanitizeDiagnosisFileList(files);
  
  assertEqual(sanitized.length, 3, 'Should keep 3 valid files');
});

// ============================================================================
// Configuration Tests
// ============================================================================

runner.test('Test 15: AnthropicWrapper reads default config', () => {
  // Clear env vars temporarily
  const oldModel = process.env.ANTHROPIC_DEFAULT_MODEL;
  const oldMaxTokens = process.env.ANTHROPIC_DEFAULT_MAX_TOKENS;
  delete process.env.ANTHROPIC_DEFAULT_MODEL;
  delete process.env.ANTHROPIC_DEFAULT_MAX_TOKENS;
  
  const wrapper = new AnthropicWrapper('test-key');
  
  // Wrapper should be created without errors
  assert(wrapper !== null, 'Wrapper should be created with defaults');
  
  // Restore env vars
  if (oldModel) process.env.ANTHROPIC_DEFAULT_MODEL = oldModel;
  if (oldMaxTokens) process.env.ANTHROPIC_DEFAULT_MAX_TOKENS = oldMaxTokens;
});

runner.test('Test 16: Token estimation is conservative', () => {
  const wrapper = new AnthropicWrapper('test-key');
  
  // Test with known text
  const text = 'This is a test sentence with exactly fifty characters!'; // 55 chars
  const tokens = wrapper.estimateTokensFromText(text);
  
  // With 55 chars: 55/4 * 1.1 ≈ 15 tokens (conservative)
  assertGreaterThan(tokens, 10, 'Should estimate at least 10 tokens');
  assertLessThan(tokens, 30, 'Should not grossly overestimate');
});

runner.test('Test 17: Truncation preserves readability', () => {
  const wrapper = new AnthropicWrapper('test-key');
  
  const text = 'This is an important message that should be partially preserved even when truncated due to length limits.';
  const truncated = wrapper.truncateTextByTokens(text, 5); // Very small budget
  
  // Should have some content
  assertGreaterThan(truncated.length, 10, 'Should preserve some content');
  
  // Should have truncation indicator
  assert(
    truncated.includes('truncated'),
    'Should include truncation indicator'
  );
});

runner.test('Test 18: File list sanitization handles whitespace', () => {
  const files = ['file1.ts', '  file2.ts  ', 'file3.ts  '];
  const sanitized = sanitizeDiagnosisFileList(files);
  
  // All should be kept as they're not empty (just trimmed in checks)
  assertEqual(sanitized.length, 3, 'Should keep files with whitespace');
});

runner.test('Test 19: Token estimation scales linearly', () => {
  const wrapper = new AnthropicWrapper('test-key');
  
  const text100 = 'a'.repeat(100);
  const text1000 = 'a'.repeat(1000);
  
  const tokens100 = wrapper.estimateTokensFromText(text100);
  const tokens1000 = wrapper.estimateTokensFromText(text1000);
  
  // Should be roughly 10x difference
  const ratio = tokens1000 / tokens100;
  assert(ratio > 8 && ratio < 12, 'Token estimation should scale roughly linearly');
});

runner.test('Test 20: Truncation with very small budget', () => {
  const wrapper = new AnthropicWrapper('test-key');
  
  const text = 'a'.repeat(10000);
  const truncated = wrapper.truncateTextByTokens(text, 1); // Just 1 token
  
  // Should return something (possibly just the truncation note)
  assert(truncated.length > 0, 'Should return non-empty string');
  assertLessThan(truncated.length, 100, 'Should be very short with 1 token budget');
});

// ============================================================================
// Run all tests
// ============================================================================

console.log('\n🧪 Running AnthropicWrapper Unit Tests...\n');
console.log('These tests verify:');
console.log('  • Token estimation accuracy');
console.log('  • Text truncation logic');
console.log('  • File list sanitization');
console.log('  • Configuration handling');
console.log('');

runner.run().catch((error) => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
