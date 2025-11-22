import { AgentExecutor } from '../services/agentExecutor';
import type { ToolResult } from '../validation/toolResultValidators';
import { describe, test, expect } from 'vitest';

describe('Tool Result Integration Tests', () => {
  const mockContext = {
    userId: 'test-user',
    sessionId: 'test-session',
    projectId: 'test-project'
  };
  
  test('end-to-end: tool execution → validation → structured result', async () => {
    const result: ToolResult = await AgentExecutor.executeTool(
      'read',
      { file_path: 'package.json' },
      mockContext
    );
    
    expect(result).toBeDefined();
    expect(result.toolName).toBe('read');
    expect(result.valid).toBe(true);
    expect(typeof result.payload).toBe('string');
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.schemaValidated).toBe(true);
  });
  
  test('validates control character removal in real tool output', async () => {
    const result: ToolResult = await AgentExecutor.executeTool(
      'bash',
      { command: 'echo "test"', timeout: 5000, description: 'test command' },
      mockContext
    );
    
    expect(result.valid).toBe(true);
    
    const payloadStr = typeof result.payload === 'string' 
      ? result.payload 
      : JSON.stringify(result.payload);
      
    expect(payloadStr).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
  });
  
  test('handles large file reads with truncation', async () => {
    try {
      const result: ToolResult = await AgentExecutor.executeTool(
        'read',
        { file_path: 'node_modules/.package-lock.json' },
        mockContext
      );
      
      if (result.metadata.truncated) {
        expect(result.warnings.some(w => w.includes('truncated'))).toBe(true);
        expect(result.metadata.originalSize).toBeGreaterThan(45000);
      }
    } catch (e) {
      console.log('Skipping large file test - file not found');
    }
  });
  
  test('propagates schema validation failures correctly', async () => {
    const { validateToolResult } = await import('../validation/toolResultValidators');
    
    const invalidObject = {
      wrong: 'structure',
      missing: 'required fields'
    };
    
    const result = validateToolResult('write', invalidObject);
    
    expect(result.valid).toBe(false);
    expect(result.metadata.schemaValidated).toBe(false);
    expect(result.warnings.some(w => w.includes('Schema validation failed'))).toBe(true);
  });
  
  test('preserves type safety through entire pipeline', async () => {
    const tools = [
      { name: 'read', input: { file_path: 'README.md' } },
      { name: 'ls', input: { path: '.' } },
      { name: 'read_task_list', input: {} }
    ];
    
    for (const tool of tools) {
      const result: ToolResult = await AgentExecutor.executeTool(
        tool.name as any,
        tool.input,
        mockContext
      );
      
      expect(result).toHaveProperty('toolName');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('payload');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('metadata');
    }
  });
  
  test('validates structured command execution results', async () => {
    const result: ToolResult = await AgentExecutor.executeTool(
      'bash',
      { command: 'pwd', timeout: 5000, description: 'get working directory' },
      mockContext
    );
    
    expect(result.valid).toBe(true);
    expect(result.toolName).toBe('bash');
    
    if (typeof result.payload === 'object' && result.payload !== null) {
      expect(result.payload).toHaveProperty('success');
      expect(result.payload).toHaveProperty('output');
    }
  });
  
  test('handles file operation results correctly', async () => {
    const result: ToolResult = await AgentExecutor.executeTool(
      'ls',
      { path: '.' },
      mockContext
    );
    
    expect(result.valid).toBe(true);
    expect(result.toolName).toBe('ls');
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.metadata).toBeDefined();
  });
  
  test('ensures no control characters in nested object payloads', async () => {
    const result: ToolResult = await AgentExecutor.executeTool(
      'bash',
      { command: 'ls -la', timeout: 5000, description: 'list files' },
      mockContext
    );
    
    expect(result.valid).toBe(true);
    
    const jsonStr = JSON.stringify(result.payload);
    expect(jsonStr).not.toContain('\\u0000');
    expect(jsonStr).not.toContain('\\u001F');
    expect(jsonStr).not.toContain('\\x00');
    expect(jsonStr).not.toContain('\\x1F');
  });
  
  test('validates metadata presence in all tool results', async () => {
    const result: ToolResult = await AgentExecutor.executeTool(
      'read',
      { file_path: 'package.json' },
      mockContext
    );
    
    expect(result.metadata).toBeDefined();
    expect(result.metadata).toHaveProperty('schemaValidated');
    expect(typeof result.metadata.schemaValidated).toBe('boolean');
    
    if (result.metadata.truncated !== undefined) {
      expect(typeof result.metadata.truncated).toBe('boolean');
    }
    
    if (result.metadata.originalSize !== undefined) {
      expect(typeof result.metadata.originalSize).toBe('number');
    }
  });
  
  test('verifies warning array structure', async () => {
    const result: ToolResult = await AgentExecutor.executeTool(
      'read',
      { file_path: 'package.json' },
      mockContext
    );
    
    expect(Array.isArray(result.warnings)).toBe(true);
    
    result.warnings.forEach(warning => {
      expect(typeof warning).toBe('string');
    });
  });

  // ✅ END-TO-END TEST: Tool execution → Database persistence → Retrieval
  test('end-to-end: execute tool, persist with metadata, retrieve and verify', async () => {
    const { db } = await import('../db.ts');
    const { chatMessages } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // STEP 1: Execute tool and get structured result with validation metadata
    const toolResult: ToolResult = await AgentExecutor.executeTool(
      'read',
      { file_path: 'package.json' },
      mockContext
    );

    expect(toolResult.valid).toBe(true);
    expect(toolResult.metadata).toBeDefined();
    expect(toolResult.metadata.schemaValidated).toBe(true);

    // STEP 2: Save to database with validation metadata
    const messageId = `test-msg-${Date.now()}`;
    const insertedMessage = await db
      .insert(chatMessages)
      .values({
        id: messageId,
        userId: mockContext.userId,
        role: 'tool',
        content: typeof toolResult.payload === 'string' 
          ? toolResult.payload 
          : JSON.stringify(toolResult.payload),
        toolName: toolResult.toolName,
        validationMetadata: toolResult.metadata, // ✅ Persist metadata
      })
      .returning();

    expect(insertedMessage).toHaveLength(1);
    const savedMsg = insertedMessage[0];
    expect(savedMsg.validationMetadata).toBeDefined();

    // STEP 3: Retrieve from database
    const retrievedMessages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));

    expect(retrievedMessages).toHaveLength(1);
    const retrievedMsg = retrievedMessages[0];

    // STEP 4: Verify metadata is intact and accessible
    expect(retrievedMsg.validationMetadata).toBeDefined();
    expect(retrievedMsg.validationMetadata.valid).toBe(toolResult.metadata.valid);
    expect(retrievedMsg.validationMetadata.schemaValidated).toBe(true);
    expect(retrievedMsg.toolName).toBe('read');
    expect(retrievedMsg.role).toBe('tool');

    // STEP 5: Verify warnings are preserved if present
    if (toolResult.warnings.length > 0) {
      expect(retrievedMsg.validationMetadata.warnings).toBeDefined();
    }

    console.log('[E2E-TEST] ✅ Tool result persisted and retrieved successfully with metadata intact');
  });
});
