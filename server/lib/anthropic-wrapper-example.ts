/**
 * Example Usage of Anthropic Wrapper
 * 
 * This file demonstrates how to use the anthropic-wrapper module
 * to handle context window limits robustly.
 * 
 * Run with: tsx server/lib/anthropic-wrapper-example.ts
 */

import {
  estimateTokensFromText,
  truncateTextByTokens,
  callAnthropic,
  AnthropicWrapper,
} from './anthropic-wrapper';

// ============================================================================
// Example 1: Basic Token Estimation
// ============================================================================

function exampleTokenEstimation() {
  console.log('\n📊 Example 1: Token Estimation');
  console.log('='.repeat(60));
  
  const text = 'Hello, world! This is a test message.';
  const tokens = estimateTokensFromText(text);
  
  console.log(`Text: "${text}"`);
  console.log(`Estimated tokens: ${tokens}`);
  console.log(`Characters: ${text.length}`);
  console.log(`Ratio: ~${(text.length / tokens).toFixed(1)} chars per token`);
}

// ============================================================================
// Example 2: Text Truncation
// ============================================================================

function exampleTextTruncation() {
  console.log('\n✂️  Example 2: Text Truncation');
  console.log('='.repeat(60));
  
  const longText = `
This is a very long conversation history that might exceed
the context window. It contains multiple messages and lots
of context that needs to be preserved. However, if the total
tokens exceed the limit, we need to intelligently truncate
the content while preserving both the beginning (for context)
and the end (for recent messages).

${'Lorem ipsum dolor sit amet. '.repeat(100)}

And here's the most recent and important information that
should definitely be preserved in the conversation.
  `.trim();
  
  const originalTokens = estimateTokensFromText(longText);
  console.log(`Original text: ${originalTokens} tokens (${longText.length} chars)`);
  
  const maxTokens = 100;
  const truncated = truncateTextByTokens(longText, maxTokens);
  const truncatedTokens = estimateTokensFromText(truncated);
  
  console.log(`Truncated to: ${truncatedTokens} tokens (${truncated.length} chars)`);
  console.log(`Savings: ${((1 - truncatedTokens / originalTokens) * 100).toFixed(1)}%`);
  console.log(`\nTruncated preview (first 200 chars):`);
  console.log(truncated.slice(0, 200) + '...');
}

// ============================================================================
// Example 3: Using AnthropicWrapper Class
// ============================================================================

function exampleWrapperClass() {
  console.log('\n🔧 Example 3: AnthropicWrapper Class');
  console.log('='.repeat(60));
  
  const wrapper = new AnthropicWrapper({
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    contextLimit: 200000,
  });
  
  const testText = 'This is a test message for the wrapper class.';
  const tokens = wrapper.estimateTokens(testText);
  
  console.log('Wrapper initialized with:');
  console.log(`  Model: claude-sonnet-4-20250514`);
  console.log(`  Max Tokens: 4096`);
  console.log(`  Context Limit: 200000`);
  console.log(`\nTest text: "${testText}"`);
  console.log(`Estimated tokens: ${tokens}`);
}

// ============================================================================
// Example 4: callAnthropic with Error Handling (Simulated)
// ============================================================================

async function exampleCallAnthropic() {
  console.log('\n🤖 Example 4: callAnthropic Function');
  console.log('='.repeat(60));
  
  // Note: This will fail without a valid API key, but demonstrates the API
  console.log('Configuration check:');
  console.log(`  API Key set: ${process.env.ANTHROPIC_API_KEY ? '✓ Yes' : '✗ No'}`);
  console.log(`  Default Model: ${process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-20250514'}`);
  console.log(`  Default Max Tokens: ${process.env.ANTHROPIC_DEFAULT_MAX_TOKENS || '8000'}`);
  console.log(`  Context Limit: ${process.env.ANTHROPIC_CONTEXT_LIMIT || '200000'}`);
  
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'dummy-key-for-development') {
    console.log('\n⚠️  No valid API key - skipping actual API call');
    console.log('   Set ANTHROPIC_API_KEY environment variable to test API calls');
    return;
  }
  
  // Example of how to use callAnthropic
  console.log('\n📤 Making API call...');
  const result = await callAnthropic({
    input: 'What is 2+2?',
    maxTokens: 100,
  });
  
  if (result.success) {
    console.log('✅ API call successful!');
    console.log(`   Truncated: ${result.truncated ? 'Yes' : 'No'}`);
    console.log(`   Final tokens: ${result.finalTokens}`);
    if (result.adjustedMaxTokens) {
      console.log(`   Adjusted max_tokens: ${result.adjustedMaxTokens}`);
    }
  } else {
    console.log(`❌ API call failed: ${result.error}`);
  }
}

// ============================================================================
// Example 5: Handling Large Context
// ============================================================================

function exampleLargeContext() {
  console.log('\n📚 Example 5: Large Context Handling');
  console.log('='.repeat(60));
  
  // Simulate a large conversation history
  const messages = [];
  for (let i = 0; i < 50; i++) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}: ${'Lorem ipsum dolor sit amet. '.repeat(20)}`,
    });
  }
  
  const totalText = messages.map(m => m.content).join('\n');
  const totalTokens = estimateTokensFromText(totalText);
  
  console.log(`Conversation: ${messages.length} messages`);
  console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`Total characters: ${totalText.length.toLocaleString()}`);
  
  const maxTokens = 16000;
  const contextLimit = 200000;
  const wouldExceed = totalTokens + maxTokens > contextLimit;
  
  console.log(`\nWith max_tokens=${maxTokens}:`);
  console.log(`  Total: ${(totalTokens + maxTokens).toLocaleString()} tokens`);
  console.log(`  Context limit: ${contextLimit.toLocaleString()} tokens`);
  console.log(`  Would exceed: ${wouldExceed ? '❌ Yes' : '✅ No'}`);
  
  if (wouldExceed) {
    const safetyMargin = 0.05;
    const effectiveLimit = Math.floor(contextLimit * (1 - safetyMargin));
    const availableOutput = effectiveLimit - totalTokens;
    
    console.log(`\n⚠️  Context management needed:`);
    console.log(`  Effective limit (with 5% margin): ${effectiveLimit.toLocaleString()}`);
    console.log(`  Available for output: ${availableOutput.toLocaleString()}`);
    console.log(`  Would reduce max_tokens to: ${Math.min(maxTokens, availableOutput)}`);
  }
}

// ============================================================================
// Run All Examples
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Anthropic Wrapper - Usage Examples');
  console.log('='.repeat(60));
  
  exampleTokenEstimation();
  exampleTextTruncation();
  exampleWrapperClass();
  await exampleCallAnthropic();
  exampleLargeContext();
  
  console.log('\n' + '='.repeat(60));
  console.log('  Examples completed!');
  console.log('='.repeat(60));
  console.log('');
}

main().catch(error => {
  console.error('Error running examples:', error);
  process.exit(1);
});
