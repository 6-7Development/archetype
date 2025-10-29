/**
 * Example: Using Anthropic Wrapper in Meta-SySop
 * 
 * This example shows how to integrate the Anthropic wrapper
 * into the Meta-SySop chat flow to handle large context windows.
 */

import { callAnthropic, AnthropicWrapper } from './anthropic-wrapper.js';

// Example 1: Simple replacement in metaSysopChat.ts
// BEFORE:
// const response = await client.messages.create({
//   model: 'claude-sonnet-4-20250514',
//   max_tokens: 8000,
//   system: systemPrompt,
//   messages: conversationMessages,
//   tools,
// });

// AFTER (using wrapper):
async function exampleMetaSysopIntegration() {
  const systemPrompt = 'You are Meta-SySop...';
  const conversationMessages = [
    { role: 'user', content: 'Fix the platform issue...' },
  ];
  const tools = [/* ... tool definitions ... */];

  // Use the wrapper instead of direct API call
  const wrapper = new AnthropicWrapper();
  
  try {
    const result = await wrapper.call({
      input: 'Latest user message',
      system: systemPrompt,
      messages: conversationMessages,
      tools,
      maxTokens: 8000,
    });

    // Log if context management was applied
    if (result.truncated || result.retried) {
      console.warn('[Meta-SySop] Context management applied:', {
        truncated: result.truncated,
        retried: result.retried,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
    }

    // Process the response as usual
    // The fullResponse.content has the same structure as the SDK response
    for (const block of result.fullResponse.content) {
      if (block.type === 'text') {
        console.log('Text:', block.text);
      } else if (block.type === 'tool_use') {
        console.log('Tool use:', block.name, block.input);
      }
    }

    return result;
  } catch (error) {
    console.error('[Meta-SySop] API call failed:', error);
    throw error;
  }
}

// Example 2: Pre-checking conversation history size
async function exampleConversationManagement() {
  const conversationHistory = [
    // ... potentially very long history ...
  ];

  // Estimate tokens before making API call
  const { estimateTokensFromText } = await import('./anthropic-wrapper.js');
  
  let totalTokens = 0;
  for (const msg of conversationHistory) {
    if (typeof msg.content === 'string') {
      totalTokens += estimateTokensFromText(msg.content);
    }
  }

  console.log(`Conversation history: ~${totalTokens} tokens`);

  // If history is too large, you could:
  // 1. Let the wrapper handle it (it will truncate)
  // 2. Manually summarize older messages
  // 3. Only include recent N messages

  if (totalTokens > 150000) {
    console.warn('[Meta-SySop] Large conversation history detected, truncation likely');
  }

  // Make the call - wrapper handles truncation if needed
  const result = await callAnthropic({
    input: 'Continue the conversation',
    messages: conversationHistory,
    maxTokens: 8000,
  });

  return result;
}

// Example 3: Handling very large diagnosis results
async function exampleLargeDiagnosisReport() {
  // Simulate a large diagnosis report (100 lines for demo - adjust as needed)
  const diagnosisReport = `
    # Platform Diagnosis Report
    
    ${Array(100).fill('Line of diagnosis data...').join('\n')}
  `;

  // Import truncation helper
  const { truncateTextByTokens, estimateTokensFromText } = await import('./anthropic-wrapper.js');

  const tokens = estimateTokensFromText(diagnosisReport);
  console.log(`Diagnosis report size: ~${tokens} tokens`);

  // Option 1: Let the wrapper handle it
  const result1 = await callAnthropic({
    input: diagnosisReport,
    system: 'Analyze this diagnosis report and suggest fixes.',
    maxTokens: 4096,
  });

  // Option 2: Pre-truncate to specific size
  const truncated = truncateTextByTokens(diagnosisReport, 50000);
  const result2 = await callAnthropic({
    input: truncated,
    system: 'Analyze this truncated diagnosis report.',
    maxTokens: 4096,
  });

  return result1; // or result2
}

// Example 4: Monitoring token usage across multiple calls
async function exampleTokenUsageMonitoring() {
  const wrapper = new AnthropicWrapper();
  
  const calls = [
    { input: 'Check platform health', maxTokens: 2048 },
    { input: 'Analyze error logs', maxTokens: 4096 },
    { input: 'Suggest fixes', maxTokens: 2048 },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let truncationCount = 0;
  let retryCount = 0;

  for (const call of calls) {
    const result = await wrapper.call(call);
    
    totalInputTokens += result.usage.inputTokens;
    totalOutputTokens += result.usage.outputTokens;
    
    if (result.truncated) truncationCount++;
    if (result.retried) retryCount++;
  }

  // Anthropic Claude pricing (as of January 2025)
  // Note: Update these rates if pricing changes
  const INPUT_COST_PER_1K = 0.003;  // $0.003 per 1K input tokens
  const OUTPUT_COST_PER_1K = 0.015; // $0.015 per 1K output tokens

  console.log('[Meta-SySop] Token usage summary:', {
    totalInputTokens,
    totalOutputTokens,
    truncationCount,
    retryCount,
    estimatedCost: ((totalInputTokens / 1000) * INPUT_COST_PER_1K + (totalOutputTokens / 1000) * OUTPUT_COST_PER_1K).toFixed(4),
  });
}

// Example 5: Error handling with graceful degradation
async function exampleErrorHandling() {
  const wrapper = new AnthropicWrapper();

  try {
    const result = await wrapper.call({
      input: 'Process this request',
      maxTokens: 8000,
    });

    return {
      success: true,
      content: result.content,
      metadata: {
        truncated: result.truncated,
        retried: result.retried,
        tokens: result.usage,
      },
    };
  } catch (error: any) {
    console.error('[Meta-SySop] API error:', error);

    // Check error type and provide helpful feedback
    if (error.status === 401) {
      return {
        success: false,
        error: 'API key invalid or expired',
        suggestion: 'Check ANTHROPIC_API_KEY environment variable',
      };
    } else if (error.status === 429) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        suggestion: 'Wait a moment and retry',
      };
    } else if (error.message?.includes('context limit')) {
      // This should be rare since wrapper handles it, but just in case
      return {
        success: false,
        error: 'Input too large even after truncation',
        suggestion: 'Reduce input size or split into multiple requests',
      };
    } else {
      return {
        success: false,
        error: error.message || 'Unknown error',
        suggestion: 'Check logs for details',
      };
    }
  }
}

// Export examples for testing
export {
  exampleMetaSysopIntegration,
  exampleConversationManagement,
  exampleLargeDiagnosisReport,
  exampleTokenUsageMonitoring,
  exampleErrorHandling,
};
