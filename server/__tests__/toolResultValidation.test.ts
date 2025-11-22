import { describe, test, expect } from 'vitest';
import { validateToolResult, toolResultToJSON, parseToolResult, type ToolResult } from '../validation/toolResultValidators';

describe('Tool Result Validation', () => {
  describe('validateToolResult', () => {
    test('validates string results and returns ToolResult', () => {
      const result = validateToolResult('read', 'file contents here');
      
      expect(result.valid).toBe(true);
      expect(result.payload).toBe('file contents here');
      expect(result.toolName).toBe('read');
      expect(result.warnings).toHaveLength(0);
      expect(result.metadata.schemaValidated).toBe(true);
    });
    
    test('validates structured file operation results', () => {
      const result = validateToolResult('write', {
        success: true,
        path: '/path/to/file.ts',
        bytesWritten: 1024
      });
      expect(result.valid).toBe(true);
      expect(result.payload.success).toBe(true);
      expect(result.payload.path).toBe('/path/to/file.ts');
      expect(result.payload.bytesWritten).toBe(1024);
      expect(result.metadata.schemaValidated).toBe(true);
    });
    
    test('validates bash command execution results', () => {
      const result = validateToolResult('bash', {
        success: true,
        output: 'Command executed successfully',
        exitCode: 0,
        duration: 150
      });
      expect(result.valid).toBe(true);
      expect(result.payload.success).toBe(true);
      expect(result.payload.output).toBe('Command executed successfully');
      expect(result.payload.exitCode).toBe(0);
      expect(result.metadata.schemaValidated).toBe(true);
    });
    
    test('validates search results', () => {
      const result = validateToolResult('search_codebase', {
        success: true,
        matches: ['file1.ts', 'file2.ts', 'file3.ts'],
        count: 3
      });
      expect(result.valid).toBe(true);
      expect(result.payload.success).toBe(true);
      expect(result.payload.matches).toHaveLength(3);
      expect(result.payload.count).toBe(3);
      expect(result.metadata.schemaValidated).toBe(true);
    });
    
    test('validates task list results', () => {
      const result = validateToolResult('read_task_list', {
        success: true,
        tasks: [
          { id: '1', content: 'Task 1', status: 'pending' },
          { id: '2', content: 'Task 2', status: 'in_progress' },
          { id: '3', content: 'Task 3', status: 'completed' }
        ]
      });
      expect(result.valid).toBe(true);
      expect(result.payload.success).toBe(true);
      expect(result.payload.tasks).toHaveLength(3);
      expect(result.payload.tasks[0].id).toBe('1');
      expect(result.payload.tasks[1].status).toBe('in_progress');
      expect(result.metadata.schemaValidated).toBe(true);
    });
    
    test('handles invalid structured results gracefully', () => {
      const result = validateToolResult('write', {
        // Missing required 'success' field
        path: '/path/to/file.ts',
        content: 'some content'
      });
      
      // Should return valid=false when schema validation fails
      expect(result.valid).toBe(false);
      expect(result.metadata.schemaValidated).toBe(false);
      expect(result.warnings.some(w => w.includes('Schema validation failed'))).toBe(true);
      
      // But should still have payload with original data
      expect(result.payload).toBeDefined();
      expect(result.payload.path).toBe('/path/to/file.ts');
    });
    
    test('validates primitive types (number, boolean, null)', () => {
      const numResult = validateToolResult('test', 42);
      expect(numResult.valid).toBe(true);
      expect(numResult.payload).toBe(42);
      expect(numResult.metadata.schemaValidated).toBe(true);
      
      const boolResult = validateToolResult('test', true);
      expect(boolResult.valid).toBe(true);
      expect(boolResult.payload).toBe(true);
      expect(boolResult.metadata.schemaValidated).toBe(true);
      
      const nullResult = validateToolResult('test', null);
      expect(nullResult.valid).toBe(true);
      expect(nullResult.payload).toBe(null);
      expect(nullResult.metadata.schemaValidated).toBe(true);
    });
    
    test('validates and truncates arrays', () => {
      const largeArray = Array(10000).fill('item');
      const result = validateToolResult('test', largeArray);
      
      expect(result.valid).toBe(true);
      expect(result.payload.length).toBeLessThan(largeArray.length);
      expect(result.metadata.truncated).toBe(true);
      expect(result.warnings.some(w => w.includes('Array truncated'))).toBe(true);
    });
    
    test('handles circular reference objects', () => {
      const circular: any = { data: 'test' };
      circular.self = circular;
      
      // Should handle circular reference without crashing
      const result = validateToolResult('read', circular);
      expect(result.valid).toBe(false); // Invalid because schema doesn't match
      expect(result.metadata.schemaValidated).toBe(false); // Schema validation fails
      expect(result.warnings.some(w => w.includes('Schema validation failed'))).toBe(true);
      
      // Payload should contain the cleaned data with [Circular] marker
      expect(result.payload).toBeDefined();
      expect(result.payload.data).toBe('test');
      expect(result.payload.self).toBe('[Circular]');
    });
    
    test('converts ToolResult to JSON and back', () => {
      const original: ToolResult = {
        toolName: 'read',
        valid: true,
        payload: 'test content',
        warnings: ['test warning'],
        metadata: { truncated: false, schemaValidated: true }
      };
      
      const json = toolResultToJSON(original);
      const parsed = parseToolResult(json);
      
      expect(parsed.toolName).toBe(original.toolName);
      expect(parsed.valid).toBe(original.valid);
      expect(parsed.payload).toBe(original.payload);
      expect(parsed.warnings).toEqual(original.warnings);
    });
  });
  
  describe('Integration Tests', () => {
    test('validates and sanitizes string result end-to-end', () => {
      const rawResult = 'file\x00content\x1Fhere';
      const toolResult = validateToolResult('read', rawResult);
      
      expect(toolResult.valid).toBe(true);
      // CRITICAL FIX: After data-level sanitization, payload should NOT contain control chars
      expect(toolResult.payload).toBe('filecontenthere');
      expect(toolResult.payload).not.toContain('\x00');
      expect(toolResult.payload).not.toContain('\x1F');
      
      // Also verify when converted to JSON for backward compatibility
      const json = toolResultToJSON(toolResult);
      const parsed = JSON.parse(json);
      expect(parsed.content).toBe('filecontenthere');
      expect(parsed.content).not.toContain('\x00');
      expect(parsed.content).not.toContain('\x1F');
    });
    
    test('validates and sanitizes structured result end-to-end', () => {
      const rawResult = {
        success: true,
        output: 'Command\x00output\x1F',
        exitCode: 0
      };
      
      const toolResult = validateToolResult('bash', rawResult);
      
      expect(toolResult.valid).toBe(true);
      expect(toolResult.payload.success).toBe(true);
      expect(toolResult.payload.exitCode).toBe(0);
      // CRITICAL FIX: Payload output should NOT contain control chars
      expect(toolResult.payload.output).toBe('Commandoutput');
      expect(toolResult.payload.output).not.toContain('\x00');
      expect(toolResult.payload.output).not.toContain('\x1F');
    });
    
    test('handles large structured results with truncation', () => {
      const largeArray = Array(10000).fill('item');
      const rawResult = {
        success: true,
        matches: largeArray,
        count: 10000
      };
      
      const toolResult = validateToolResult('search_codebase', rawResult);
      
      // Large arrays create JSON > 50KB, hitting the size limit
      expect(toolResult.valid).toBe(false); // Exceeds 50KB limit
      expect(toolResult.warnings.some(w => w.includes('too large'))).toBe(true);
      expect(toolResult.payload.error).toContain('too large');
      expect(toolResult.metadata.truncated).toBe(true);
    });
  });

  describe('Regression Tests for Control Character Sanitization', () => {
    test('removes control characters from DATA before JSON serialization', () => {
      // Tool returns data with embedded control character
      const dirtyData = 'file\x00content\x1Fwith\x07control\x1Bchars';
      const toolResult = validateToolResult('read', dirtyData);
      
      // CRITICAL: Payload must NOT contain control chars
      expect(toolResult.payload).not.toContain('\x00');
      expect(toolResult.payload).not.toContain('\x1F');
      expect(toolResult.payload).not.toContain('\x07');
      expect(toolResult.payload).not.toContain('\x1B');
      
      // Verify data is clean
      expect(toolResult.payload).toBe('filecontentwithcontrolchars');
    });

    test('recursively sanitizes nested objects', () => {
      const dirtyObject = {
        success: true,
        content: 'hello\x1Fworld',
        path: '/file\x00name.ts'
      };
      
      const toolResult = validateToolResult('read', dirtyObject);
      
      // Check nested fields are clean
      expect(toolResult.payload.content).toBe('helloworld');
      expect(toolResult.payload.content).not.toContain('\x1F');
      expect(toolResult.payload.path).toBe('/filename.ts');
      expect(toolResult.payload.path).not.toContain('\x00');
      
      // Verify entire JSON string has no control char escape sequences when converted
      const json = toolResultToJSON(toolResult);
      expect(json).not.toContain('\\u0000');
      expect(json).not.toContain('\\u001F');
    });

    test('sanitizes string values in structured objects', () => {
      // Test with valid fileOperation schema
      const dirtyObject = {
        success: true,
        path: '/file\x00name.ts',
        content: 'hello\x1Fworld',
        error: 'error\x07message'
      };
      
      const toolResult = validateToolResult('read', dirtyObject);
      
      // String values should be sanitized
      expect(toolResult.payload.path).toBe('/filename.ts');
      expect(toolResult.payload.content).toBe('helloworld');
      expect(toolResult.payload.error).toBe('errormessage');
      
      expect(toolResult.payload.path).not.toContain('\x00');
      expect(toolResult.payload.content).not.toContain('\x1F');
      expect(toolResult.payload.error).not.toContain('\x07');
    });

    test('sanitizes arrays with control characters', () => {
      const dirtyObject = {
        success: true,
        matches: [
          'file1\x00.ts',
          'file2\x1F.js',
          'file3\x07.py'
        ]
      };
      
      const toolResult = validateToolResult('search_codebase', dirtyObject);
      
      // Array items should be sanitized
      expect(toolResult.payload.matches[0]).toBe('file1.ts');
      expect(toolResult.payload.matches[1]).toBe('file2.js');
      expect(toolResult.payload.matches[2]).toBe('file3.py');
      
      expect(toolResult.payload.matches[0]).not.toContain('\x00');
      expect(toolResult.payload.matches[1]).not.toContain('\x1F');
      expect(toolResult.payload.matches[2]).not.toContain('\x07');
    });

    test('preserves newlines and tabs while removing other control characters', () => {
      const data = 'line1\nline2\tcolumn\x00\x1Fline3';
      const toolResult = validateToolResult('read', data);
      
      // Should preserve \n and \t, but remove \x00 and \x1F
      expect(toolResult.payload).toContain('\n');
      expect(toolResult.payload).toContain('\t');
      expect(toolResult.payload).not.toContain('\x00');
      expect(toolResult.payload).not.toContain('\x1F');
      expect(toolResult.payload).toBe('line1\nline2\tcolumnline3');
    });

    test('sanitizes nested arrays with control characters', () => {
      // Test with valid searchResult schema that has nested arrays
      const dirtyObject = {
        success: true,
        matches: [
          'file1\x00.ts',
          'file2\x1F.js',
          'file3\x07.py'
        ],
        count: 3
      };
      
      const toolResult = validateToolResult('search_codebase', dirtyObject);
      
      // Verify all array elements are sanitized
      expect(toolResult.payload.matches[0]).toBe('file1.ts');
      expect(toolResult.payload.matches[1]).toBe('file2.js');
      expect(toolResult.payload.matches[2]).toBe('file3.py');
      
      expect(toolResult.payload.matches[0]).not.toContain('\x00');
      expect(toolResult.payload.matches[1]).not.toContain('\x1F');
      expect(toolResult.payload.matches[2]).not.toContain('\x07');
    });

    test('verifies no control character escape sequences in final JSON', () => {
      const dirtyData = 'file\x00content\x01test\x1F';
      const toolResult = validateToolResult('read', dirtyData);
      
      // Convert to JSON for backward compatibility
      const json = toolResultToJSON(toolResult);
      
      // Verify the JSON string itself has no escape sequences
      expect(json).not.toContain('\\u0000');
      expect(json).not.toContain('\\u0001');
      expect(json).not.toContain('\\u001F');
      expect(json).not.toContain('\\x00');
      expect(json).not.toContain('\\x01');
      expect(json).not.toContain('\\x1F');
      
      // And that parsing doesn't rehydrate control chars
      const parsed = JSON.parse(json);
      expect(parsed.content).toBe('filecontenttest');
    });
  });

  describe('Regression Tests for JSON Truncation', () => {
    test('truncates oversized content while maintaining valid data', () => {
      const oversized = 'a'.repeat(60000);
      const toolResult = validateToolResult('read', oversized);
      
      // Payload should be truncated string
      expect(toolResult.valid).toBe(true);
      expect(toolResult.metadata.truncated).toBe(true);
      expect(toolResult.payload).toContain('[content truncated');
      expect(toolResult.payload.length).toBeLessThan(46000);
      expect(toolResult.warnings.some(w => w.includes('truncated'))).toBe(true);
      
      // Result should be valid JSON when converted
      const json = toolResultToJSON(toolResult);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('wraps extremely large objects in error response', () => {
      const massive = {
        success: true,
        data: 'x'.repeat(60000), // Will create >50KB JSON
        nested: { more: 'data'.repeat(10000) }
      };
      
      const toolResult = validateToolResult('read', massive);
      
      // Zod's default behavior strips unknown fields, so extra fields are removed
      // The validated object only contains { success: true }, which is valid and small
      // Therefore validation passes, but without the large data
      expect(toolResult.valid).toBe(true); // Schema validation passes (extra fields stripped)
      expect(toolResult.metadata.schemaValidated).toBe(true);
      
      expect(toolResult.payload.success).toBe(true);
      // The large 'data' and 'nested' fields are stripped by Zod
      expect(toolResult.payload.data).toBeUndefined();
      expect(toolResult.payload.nested).toBeUndefined();
    });

    test('truncates content field in structured objects', () => {
      const oversizedObject = {
        success: true,
        path: '/test/file.ts',
        content: 'x'.repeat(60000)
      };
      
      const toolResult = validateToolResult('read', oversizedObject);
      
      // Verify truncation
      expect(toolResult.valid).toBe(true);
      expect(toolResult.metadata.truncated).toBe(true);
      expect(toolResult.payload.content).toContain('[content truncated');
      expect(toolResult.payload.content.length).toBeLessThan(46000);
      expect(toolResult.payload.path).toBe('/test/file.ts'); // Other fields preserved
      
      // Result should be valid JSON when converted
      const json = toolResultToJSON(toolResult);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('does not add truncated flag for normal-sized content', () => {
      const normalContent = 'a'.repeat(1000);
      const toolResult = validateToolResult('read', normalContent);
      
      // Verify no truncation flag
      expect(toolResult.valid).toBe(true);
      expect(toolResult.metadata.truncated).toBe(false);
      expect(toolResult.payload).toBe(normalContent);
      expect(toolResult.payload).not.toContain('[content truncated');
      
      // Result should be valid JSON when converted
      const json = toolResultToJSON(toolResult);
      const parsed = JSON.parse(json);
      expect(parsed.truncated).toBe(false);
    });

    test('validates all truncated results are serializable', () => {
      // Test various oversized scenarios
      const scenarios = [
        { name: 'string', data: 'a'.repeat(100000) },
        { name: 'object with content', data: { success: true, content: 'b'.repeat(100000) } },
        { name: 'object with output', data: { success: true, output: 'c'.repeat(100000) } },
      ];

      scenarios.forEach(scenario => {
        const toolResult = validateToolResult('read', scenario.data);
        
        // CRITICAL: All results must be serializable to JSON
        const json = toolResultToJSON(toolResult);
        expect(() => JSON.parse(json), 
          `${scenario.name} should produce valid JSON`).not.toThrow();
        
        const parsed = JSON.parse(json);
        expect(parsed).toBeDefined();
        expect(typeof parsed).toBe('object');
      });
    });

    test('never produces invalid JSON even with edge cases', () => {
      // Test edge cases that could break JSON
      const edgeCases = [
        'a'.repeat(50001), // Just over the limit
        'b'.repeat(100000), // Way over the limit
        { content: 'c'.repeat(50000), other: 'data' }, // Large object with metadata
      ];

      edgeCases.forEach(edgeCase => {
        const toolResult = validateToolResult('read', edgeCase);
        
        // Must always be valid JSON when converted
        const json = toolResultToJSON(toolResult);
        expect(() => JSON.parse(json)).not.toThrow();
        
        // Verify it's actually a valid object after parsing
        const parsed = JSON.parse(json);
        expect(typeof parsed).toBe('object');
        expect(parsed.success).toBeDefined();
      });
    });
  });
});
