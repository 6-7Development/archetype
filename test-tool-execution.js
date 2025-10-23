// Simple test to verify multi-turn tool execution works
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Mock tool that returns file content
const mockTools = [
  {
    name: "read_platform_file",
    description: "Read a file from the Archetype platform codebase",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" }
      },
      required: ["path"]
    }
  }
];

async function testMultiTurnExecution() {
  console.log('🧪 Testing multi-turn tool execution...\n');
  
  const messages = [
    {
      role: 'user',
      content: 'Read the file server/routes.ts and tell me what you see'
    }
  ];
  
  let turnCount = 0;
  const maxTurns = 5;
  
  while (turnCount < maxTurns) {
    turnCount++;
    console.log(`\n🔄 Turn ${turnCount}:`);
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: messages,
      tools: mockTools,
    });
    
    console.log(`   Stop reason: ${response.stop_reason}`);
    
    if (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(c => c.type === 'tool_use');
      console.log(`   🔧 Tool requested: ${toolUse.name}`);
      console.log(`   📝 Arguments: ${JSON.stringify(toolUse.input)}`);
      
      // Add assistant message with tool use
      messages.push({
        role: 'assistant',
        content: response.content
      });
      
      // Mock tool result
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ 
            success: true,
            content: '// File content here...\nconst express = require("express");'
          })
        }]
      });
      
      console.log(`   ✅ Tool executed, continuing conversation...`);
      continue;
      
    } else {
      // Final response
      const textContent = response.content.find(c => c.type === 'text');
      console.log(`\n✅ Final response received:`);
      console.log(`   ${textContent.text.substring(0, 150)}...`);
      console.log(`\n🎉 SUCCESS: Multi-turn execution completed in ${turnCount} turns`);
      break;
    }
  }
  
  if (turnCount >= maxTurns) {
    console.log('\n❌ FAILED: Exceeded max turns');
  }
}

testMultiTurnExecution().catch(console.error);
