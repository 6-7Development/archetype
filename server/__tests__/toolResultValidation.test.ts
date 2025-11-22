import { describe, test, expect } from 'vitest';
import { validateToolResult, sanitizeToolResultForPersistence } from '../validation/toolResultValidators';

describe('Tool Result Validation', () => {
  describe('validateToolResult', () => {
    test('validates string results from read tool', () => {
      const result = validateToolResult('read', 'file contents here');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toContain('file contents here');
      
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.content).toBe('file contents here');
      expect(parsed.toolName).toBe('read');
    });
    
    test('validates structured file operation results', () => {
      const result = validateToolResult('write', {
        success: true,
        path: '/path/to/file.ts',
        bytesWritten: 1024
      });
      expect(result.valid).toBe(true);
      
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.path).toBe('/path/to/file.ts');
      expect(parsed.bytesWritten).toBe(1024);
    });
    
    test('validates bash command execution results', () => {
      const result = validateToolResult('bash', {
        success: true,
        output: 'Command executed successfully',
        exitCode: 0,
        duration: 150
      });
      expect(result.valid).toBe(true);
      
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.output).toBe('Command executed successfully');
      expect(parsed.exitCode).toBe(0);
    });
    
    test('validates search results', () => {
      const result = validateToolResult('search_codebase', {
        success: true,
        matches: ['file1.ts', 'file2.ts', 'file3.ts'],
        count: 3
      });
      expect(result.valid).toBe(true);
      
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.matches).toHaveLength(3);
      expect(parsed.count).toBe(3);
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
      
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.tasks).toHaveLength(3);
      expect(parsed.tasks[0].id).toBe('1');
      expect(parsed.tasks[1].status).toBe('in_progress');
    });
    
    test('handles invalid structured results gracefully', () => {
      const result = validateToolResult('write', {
        // Missing required 'success' field
        path: '/path/to/file.ts',
        content: 'some content'
      });
      
      // Should return valid=false when schema validation fails
      expect(result.valid).toBe(false);
      expect(result.schemaValid).toBe(false);
      expect(result.sanitized).toBeDefined();
      
      // But should still be parseable JSON with warning
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true); // Default fallback
      expect(parsed.toolName).toBe('write');
      expect(parsed.schemaValidationWarning).toBeDefined();
    });
    
    test('handles non-string, non-object results', () => {
      const result = validateToolResult('read', 12345);
      
      // Numbers are converted to strings, which is valid
      expect(result.valid).toBe(true);
      expect(result.schemaValid).toBe(true);
      expect(result.sanitized).toBeDefined();
      
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.content).toBe('12345');
    });
    
    test('handles null results', () => {
      const result = validateToolResult('read', null);
      
      // Null is converted to string, which is valid
      expect(result.valid).toBe(true);
      expect(result.schemaValid).toBe(true);
      expect(result.sanitized).toBeDefined();
      
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.content).toBe('null');
    });
    
    test('handles undefined results', () => {
      const result = validateToolResult('read', undefined);
      
      // Undefined is converted to string, which is valid
      expect(result.valid).toBe(true);
      expect(result.schemaValid).toBe(true);
      expect(result.sanitized).toBeDefined();
      
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.content).toBe('undefined');
    });
    
    test('handles circular reference objects', () => {
      const circular: any = { data: 'test' };
      circular.self = circular;
      
      // Should handle circular reference without crashing
      const result = validateToolResult('read', circular);
      expect(result.valid).toBe(false); // Invalid because schema doesn't match
      expect(result.schemaValid).toBe(false); // Schema validation fails
      expect(result.sanitized).toBeDefined();
      
      // Verify result can be parsed (no JSON errors)
      expect(() => JSON.parse(result.sanitized)).not.toThrow();
      
      // Should include schema validation warning
      const parsed = JSON.parse(result.sanitized);
      expect(parsed.schemaValidationWarning).toBeDefined();
    });
  });
  
  describe('sanitizeToolResultForPersistence (DEPRECATED)', () => {
    test('no longer removes control characters (deprecated behavior)', () => {
      const dirty = 'hello\x00world\x01test\x1Fdata\x7F';
      const result = sanitizeToolResultForPersistence(dirty);
      
      // DEPRECATED: This function no longer removes control characters
      // Control character removal now happens in validateToolResult
      expect(result).toBe(dirty);
    });
    
    test('preserves all characters including control chars', () => {
      const text = 'line1\nline2\tcolumn2\x00\x1F\nline3';
      const result = sanitizeToolResultForPersistence(text);
      
      // Deprecated function no longer sanitizes
      expect(result).toBe(text);
    });
    
    test('truncates overly long results', () => {
      const long = 'a'.repeat(100000);
      const truncated = sanitizeToolResultForPersistence(long, 50000);
      
      expect(truncated.length).toBeLessThanOrEqual(50020); // 50000 + truncation message
      expect(truncated).toContain('[truncated]');
      expect(truncated.endsWith('... [truncated]')).toBe(true);
    });
    
    test('respects custom maxLength', () => {
      const text = 'a'.repeat(1000);
      const truncated = sanitizeToolResultForPersistence(text, 500);
      
      expect(truncated.length).toBeLessThanOrEqual(520); // 500 + truncation message
      expect(truncated).toContain('[truncated]');
    });
    
    test('does not truncate short results', () => {
      const text = 'This is a short result';
      const result = sanitizeToolResultForPersistence(text);
      
      expect(result).toBe(text);
      expect(result).not.toContain('[truncated]');
    });
    
    test('handles empty strings', () => {
      const result = sanitizeToolResultForPersistence('');
      expect(result).toBe('');
    });
  });
  
  describe('Integration Tests', () => {
    test('validates and sanitizes string result end-to-end', () => {
      const rawResult = 'file\x00content\x1Fhere';
      const validation = validateToolResult('read', rawResult);
      const sanitized = sanitizeToolResultForPersistence(validation.sanitized);
      
      expect(validation.valid).toBe(true);
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x1F');
      
      const parsed = JSON.parse(sanitized);
      // CRITICAL FIX: After data-level sanitization, parsed content should NOT contain control chars
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
      
      const validation = validateToolResult('bash', rawResult);
      const sanitized = sanitizeToolResultForPersistence(validation.sanitized);
      
      expect(validation.valid).toBe(true);
      
      const parsed = JSON.parse(sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.exitCode).toBe(0);
      // CRITICAL FIX: Parsed output should NOT contain control chars
      expect(parsed.output).toBe('Commandoutput');
      expect(parsed.output).not.toContain('\x00');
      expect(parsed.output).not.toContain('\x1F');
    });
    
    test('handles large structured results with truncation', () => {
      const largeArray = Array(10000).fill('item');
      const rawResult = {
        success: true,
        matches: largeArray,
        count: 10000
      };
      
      const validation = validateToolResult('search_codebase', rawResult);
      
      // Large arrays create JSON > 50KB, hitting the size limit
      expect(validation.valid).toBe(false); // Exceeds 50KB limit
      expect(validation.error).toBe('Result too large after validation');
      expect(validation.sanitized).toBeDefined();
      expect(() => JSON.parse(validation.sanitized)).not.toThrow();
      
      // The error response includes truncated flag
      const parsed = JSON.parse(validation.sanitized);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('too large');
      expect(parsed.truncated).toBe(true);
    });
  });

  describe('Regression Tests for Control Character Sanitization', () => {
    test('removes control characters from DATA before JSON serialization', () => {
      // Tool returns data with embedded control character
      const dirtyData = 'file\x00content\x1Fwith\x07control\x1Bchars';
      const validation = validateToolResult('read', dirtyData);
      
      // Parse the JSON to get the actual data
      const parsed = JSON.parse(validation.sanitized);
      
      // CRITICAL: Parsed content must NOT contain control chars
      expect(parsed.content).not.toContain('\x00');
      expect(parsed.content).not.toContain('\x1F');
      expect(parsed.content).not.toContain('\x07');
      expect(parsed.content).not.toContain('\x1B');
      
      // Verify data is clean
      expect(parsed.content).toBe('filecontentwithcontrolchars');
    });

    test('recursively sanitizes nested objects', () => {
      const dirtyObject = {
        success: true,
        content: 'hello\x1Fworld',
        path: '/file\x00name.ts'
      };
      
      const validation = validateToolResult('read', dirtyObject);
      const parsed = JSON.parse(validation.sanitized);
      
      // Check nested fields are clean
      expect(parsed.content).toBe('helloworld');
      expect(parsed.content).not.toContain('\x1F');
      expect(parsed.path).toBe('/filename.ts');
      expect(parsed.path).not.toContain('\x00');
      
      // Verify entire JSON string has no control char escape sequences
      expect(validation.sanitized).not.toContain('\\u0000');
      expect(validation.sanitized).not.toContain('\\u001F');
    });

    test('sanitizes string values in structured objects', () => {
      // Test with valid fileOperation schema
      const dirtyObject = {
        success: true,
        path: '/file\x00name.ts',
        content: 'hello\x1Fworld',
        error: 'error\x07message'
      };
      
      const validation = validateToolResult('read', dirtyObject);
      const parsed = JSON.parse(validation.sanitized);
      
      // String values should be sanitized
      expect(parsed.path).toBe('/filename.ts');
      expect(parsed.content).toBe('helloworld');
      expect(parsed.error).toBe('errormessage');
      
      expect(parsed.path).not.toContain('\x00');
      expect(parsed.content).not.toContain('\x1F');
      expect(parsed.error).not.toContain('\x07');
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
      
      const validation = validateToolResult('search_codebase', dirtyObject);
      const parsed = JSON.parse(validation.sanitized);
      
      // Array items should be sanitized
      expect(parsed.matches[0]).toBe('file1.ts');
      expect(parsed.matches[1]).toBe('file2.js');
      expect(parsed.matches[2]).toBe('file3.py');
      
      expect(parsed.matches[0]).not.toContain('\x00');
      expect(parsed.matches[1]).not.toContain('\x1F');
      expect(parsed.matches[2]).not.toContain('\x07');
    });

    test('preserves newlines and tabs while removing other control characters', () => {
      const data = 'line1\nline2\tcolumn\x00\x1Fline3';
      const validation = validateToolResult('read', data);
      const parsed = JSON.parse(validation.sanitized);
      
      // Should preserve \n and \t, but remove \x00 and \x1F
      expect(parsed.content).toContain('\n');
      expect(parsed.content).toContain('\t');
      expect(parsed.content).not.toContain('\x00');
      expect(parsed.content).not.toContain('\x1F');
      expect(parsed.content).toBe('line1\nline2\tcolumnline3');
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
      
      const validation = validateToolResult('search_codebase', dirtyObject);
      const parsed = JSON.parse(validation.sanitized);
      
      // Verify all array elements are sanitized
      expect(parsed.matches[0]).toBe('file1.ts');
      expect(parsed.matches[1]).toBe('file2.js');
      expect(parsed.matches[2]).toBe('file3.py');
      
      expect(parsed.matches[0]).not.toContain('\x00');
      expect(parsed.matches[1]).not.toContain('\x1F');
      expect(parsed.matches[2]).not.toContain('\x07');
    });

    test('verifies no control character escape sequences in final JSON', () => {
      const dirtyData = 'file\x00content\x01test\x1F';
      const validation = validateToolResult('read', dirtyData);
      
      // Verify the JSON string itself has no escape sequences
      expect(validation.sanitized).not.toContain('\\u0000');
      expect(validation.sanitized).not.toContain('\\u0001');
      expect(validation.sanitized).not.toContain('\\u001F');
      expect(validation.sanitized).not.toContain('\\x00');
      expect(validation.sanitized).not.toContain('\\x01');
      expect(validation.sanitized).not.toContain('\\x1F');
      
      // And that parsing doesn't rehydrate control chars
      const parsed = JSON.parse(validation.sanitized);
      expect(parsed.content).toBe('filecontenttest');
    });
  });

  describe('Regression Tests for JSON Truncation', () => {
    test('truncates oversized content while maintaining valid JSON', () => {
      const oversized = 'a'.repeat(60000);
      const validation = validateToolResult('read', oversized);
      
      // Result should be valid JSON
      expect(() => JSON.parse(validation.sanitized)).not.toThrow();
      
      // Parse and check structure
      const parsed = JSON.parse(validation.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.truncated).toBe(true);
      expect(parsed.content).toContain('[content truncated');
      expect(parsed.content.length).toBeLessThan(46000);
    });

    test('wraps extremely large objects in error response', () => {
      const massive = {
        success: true,
        data: 'x'.repeat(60000), // Will create >50KB JSON
        nested: { more: 'data'.repeat(10000) }
      };
      
      const validation = validateToolResult('read', massive);
      
      // Should be valid JSON
      expect(() => JSON.parse(validation.sanitized)).not.toThrow();
      
      // Zod's default behavior strips unknown fields, so extra fields are removed
      // The validated object only contains { success: true }, which is valid and small
      // Therefore validation passes, but without the large data
      expect(validation.valid).toBe(true); // Schema validation passes (extra fields stripped)
      expect(validation.schemaValid).toBe(true);
      
      const parsed = JSON.parse(validation.sanitized);
      expect(parsed.success).toBe(true);
      // The large 'data' and 'nested' fields are stripped by Zod
      expect(parsed.data).toBeUndefined();
      expect(parsed.nested).toBeUndefined();
    });

    test('truncates content field in structured objects', () => {
      const oversizedObject = {
        success: true,
        path: '/test/file.ts',
        content: 'x'.repeat(60000)
      };
      
      const validation = validateToolResult('read', oversizedObject);
      
      // Should be valid JSON
      expect(() => JSON.parse(validation.sanitized)).not.toThrow();
      
      // Parse and verify truncation
      const parsed = JSON.parse(validation.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.truncated).toBe(true);
      expect(parsed.content).toContain('[content truncated');
      expect(parsed.content.length).toBeLessThan(46000);
      expect(parsed.path).toBe('/test/file.ts'); // Other fields preserved
    });

    test('does not add truncated flag for normal-sized content', () => {
      const normalContent = 'a'.repeat(1000);
      const validation = validateToolResult('read', normalContent);
      
      // Should be valid JSON
      expect(() => JSON.parse(validation.sanitized)).not.toThrow();
      
      // Parse and verify no truncation flag
      const parsed = JSON.parse(validation.sanitized);
      expect(parsed.success).toBe(true);
      expect(parsed.truncated).toBe(false);
      expect(parsed.content).toBe(normalContent);
      expect(parsed.content).not.toContain('[content truncated');
    });

    test('validates all truncated results are parseable JSON', () => {
      // Test various oversized scenarios
      const scenarios = [
        { name: 'string', data: 'a'.repeat(100000) },
        { name: 'object with content', data: { success: true, content: 'b'.repeat(100000) } },
        { name: 'object with output', data: { success: true, output: 'c'.repeat(100000) } },
      ];

      scenarios.forEach(scenario => {
        const validation = validateToolResult('read', scenario.data);
        
        // CRITICAL: All results must be valid JSON
        expect(() => JSON.parse(validation.sanitized), 
          `${scenario.name} should produce valid JSON`).not.toThrow();
        
        const parsed = JSON.parse(validation.sanitized);
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
        const validation = validateToolResult('read', edgeCase);
        
        // Must always be valid JSON
        expect(() => JSON.parse(validation.sanitized)).not.toThrow();
        
        // Verify it's actually a valid object after parsing
        const parsed = JSON.parse(validation.sanitized);
        expect(typeof parsed).toBe('object');
        expect(parsed.success).toBeDefined();
      });
    });
  });
});
