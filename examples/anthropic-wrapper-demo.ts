#!/usr/bin/env npx tsx

/**
 * Example demonstration of AnthropicWrapper usage
 * 
 * This example shows how the wrapper prevents context limit errors
 * by automatically truncating input and adjusting max_tokens.
 * 
 * Run with: npx tsx examples/anthropic-wrapper-demo.ts
 */

import { AnthropicWrapper, sanitizeDiagnosisFileList } from '../server/lib/anthropic-wrapper';

console.log('\n' + '='.repeat(70));
console.log('  Anthropic Context Limit Wrapper - Demo');
console.log('='.repeat(70) + '\n');

// Example 1: Token Estimation
console.log('📊 Example 1: Token Estimation\n');

const wrapper = new AnthropicWrapper('demo-key');

const shortText = 'Hello, world!';
const longText = 'a'.repeat(10000);

console.log(`Short text (${shortText.length} chars): ~${wrapper.estimateTokensFromText(shortText)} tokens`);
console.log(`Long text (${longText.length} chars): ~${wrapper.estimateTokensFromText(longText)} tokens`);

// Example 2: Text Truncation
console.log('\n📝 Example 2: Text Truncation\n');

const veryLongText = 'This is important information. '.repeat(1000);
const truncated = wrapper.truncateTextByTokens(veryLongText, 100);

console.log(`Original length: ${veryLongText.length} chars`);
console.log(`Truncated length: ${truncated.length} chars`);
console.log(`Includes truncation note: ${truncated.includes('truncated') ? 'Yes ✓' : 'No'}`);

// Example 3: File List Sanitization
console.log('\n🗂️  Example 3: File List Sanitization\n');

const messyFileList = [
  'valid-file.ts',
  null,
  undefined,
  '',
  '  ',
  'another-valid.ts',
] as any[];

console.log('Input files:', messyFileList);
const sanitized = sanitizeDiagnosisFileList(messyFileList);
console.log('Sanitized result:', sanitized);

// Example 4: Context Limit Simulation
console.log('\n⚠️  Example 4: Context Limit Handling Simulation\n');

const hugeInput = 'x'.repeat(800000); // ~220k tokens (over 200k limit)
const estimatedTokens = wrapper.estimateTokensFromText(hugeInput);

console.log(`Input size: ${hugeInput.length} chars`);
console.log(`Estimated tokens: ${estimatedTokens.toLocaleString()}`);
console.log(`Claude Sonnet 4 context limit: 200,000 tokens`);
console.log(`Would exceed limit: ${estimatedTokens > 200000 ? 'Yes ⚠️' : 'No'}`);

if (estimatedTokens > 200000) {
  const maxAllowedTokens = 200000 - 16000; // Reserve 16k for output
  const safeTruncated = wrapper.truncateTextByTokens(hugeInput, maxAllowedTokens);
  const newTokens = wrapper.estimateTokensFromText(safeTruncated);
  
  console.log(`\nAfter automatic truncation:`);
  console.log(`  New size: ${safeTruncated.length} chars`);
  console.log(`  New tokens: ${newTokens.toLocaleString()}`);
  console.log(`  Within limit: ${newTokens <= maxAllowedTokens ? 'Yes ✓' : 'No'}`);
}

// Example 5: Configuration
console.log('\n⚙️  Example 5: Configuration via Environment Variables\n');

console.log('Available configuration:');
console.log('  ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-20250514');
console.log('  ANTHROPIC_DEFAULT_MAX_TOKENS=4096');
console.log('  ANTHROPIC_CONTEXT_LIMIT_CLAUDE_SONNET_4_20250514=200000');
console.log('\nSet these in .env to customize behavior');

// Example 6: Usage Pattern
console.log('\n🚀 Example 6: Typical Usage Pattern\n');

console.log('```typescript');
console.log('import { getAnthropicWrapper } from "./server/lib/anthropic-wrapper";');
console.log('');
console.log('const wrapper = getAnthropicWrapper();');
console.log('');
console.log('try {');
console.log('  const response = await wrapper.callAnthropic({');
console.log('    input: userMessage,');
console.log('    maxTokens: 4096,');
console.log('  });');
console.log('  ');
console.log('  console.log(response.content);');
console.log('  console.log(`Used ${response.usage.inputTokens} + ${response.usage.outputTokens} tokens`);');
console.log('} catch (error) {');
console.log('  console.error("API call failed:", error);');
console.log('}');
console.log('```');

console.log('\n' + '='.repeat(70));
console.log('  Demo Complete!');
console.log('  See ANTHROPIC_WRAPPER_GUIDE.md for full documentation');
console.log('='.repeat(70) + '\n');
