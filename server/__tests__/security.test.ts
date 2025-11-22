import { sanitizeAndTokenizeCommand, normalizePathForStorage } from '../validation/authoritativeValidator';

describe('Security Regression Tests', () => {
  describe('sanitizeAndTokenizeCommand', () => {
    test('blocks newline injection', () => {
      expect(() => sanitizeAndTokenizeCommand('rm\n-rf /')).toThrow('newline');
    });
    
    test('blocks control characters', () => {
      expect(() => sanitizeAndTokenizeCommand('ls\x00-la')).toThrow('control characters');
    });
    
    test('blocks shell operators', () => {
      expect(() => sanitizeAndTokenizeCommand('ls && rm -rf /')).toThrow('Shell operators not allowed');
    });
    
    test('blocks dangerous tokens with shell metacharacters', () => {
      expect(() => sanitizeAndTokenizeCommand('echo `whoami`')).toThrow('Invalid token');
    });
    
    test('preserves quoted args', () => {
      const tokens = sanitizeAndTokenizeCommand('git commit -m "my commit"');
      expect(tokens).toEqual(['git', 'commit', '-m', 'my commit']);
    });
    
    test('handles simple command', () => {
      const tokens = sanitizeAndTokenizeCommand('ls -la');
      expect(tokens).toEqual(['ls', '-la']);
    });
    
    test('handles command with multiple arguments', () => {
      const tokens = sanitizeAndTokenizeCommand('npm install express');
      expect(tokens).toEqual(['npm', 'install', 'express']);
    });
    
    test('blocks escaped newline injection', () => {
      expect(() => sanitizeAndTokenizeCommand('echo foo\\nrm -rf /')).toThrow();
    });
    
    test('rejects empty token arrays', () => {
      expect(() => sanitizeAndTokenizeCommand('')).toThrow('no valid tokens');
    });
  });
  
  describe('normalizePathForStorage', () => {
    test('blocks path traversal', () => {
      const result = normalizePathForStorage('../../etc/passwd', '/home/user/project');
      expect(result.safe).toBe(false);
    });
    
    test('blocks access to .git directory', () => {
      const result = normalizePathForStorage('.git/config', '/home/user/project');
      expect(result.safe).toBe(false);
    });
    
    test('blocks access to node_modules', () => {
      const result = normalizePathForStorage('node_modules/package.json', '/home/user/project');
      expect(result.safe).toBe(false);
    });
    
    test('blocks access to .env files', () => {
      const result = normalizePathForStorage('.env', '/home/user/project');
      expect(result.safe).toBe(false);
    });
    
    test('allows valid paths', () => {
      const result = normalizePathForStorage('src/index.ts', '/home/user/project');
      expect(result.safe).toBe(true);
      expect(result.normalized).toBe('src/index.ts');
    });
    
    test('normalizes paths with /', () => {
      const result = normalizePathForStorage('src/../lib/utils.ts', '/home/user/project');
      expect(result.safe).toBe(true);
      expect(result.normalized).toBe('lib/utils.ts');
    });
    
    test('blocks paths that escape project root', () => {
      const result = normalizePathForStorage('src/../../etc/passwd', '/home/user/project');
      expect(result.safe).toBe(false);
    });
    
    test('blocks Unicode homoglyph paths', () => {
      const result = normalizePathForStorage('foo９bar', '/home/project');
      expect(result.safe).toBe(false);
      expect(result.error).toContain('non-ASCII');
    });
  });
});
