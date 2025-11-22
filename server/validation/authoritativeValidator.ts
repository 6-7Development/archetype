import { parse as parseShellCommand } from 'shell-quote';
import * as path from 'path';

/**
 * AUTHORITATIVE command validator - ALL services MUST use this
 * Returns safe tokens array for use with spawn()
 */
export function sanitizeAndTokenizeCommand(cmd: string): string[] {
  // Block newlines explicitly (highest risk)
  if (/[\n\r]/.test(cmd)) {
    throw new Error('Command rejected: contains newline characters');
  }
  
  // Block control characters
  if (/[\x00-\x1F\x7F]/.test(cmd)) {
    throw new Error('Command rejected: contains control characters');
  }
  
  // Parse with shell-quote (preserves quoting)
  let tokens: any[];
  try {
    tokens = parseShellCommand(cmd);
  } catch (e: any) {
    throw new Error(`Invalid command syntax: ${e.message}`);
  }
  
  // NEW: Re-validate EACH token AFTER parsing (catches escaped newlines)
  const stringTokens: string[] = [];
  for (const token of tokens) {
    if (typeof token === 'string') {
      // CRITICAL: Check for control chars AFTER shell-quote expansion
      if (/[\x00-\x1F\x7F]/.test(token)) {
        throw new Error(`Token contains control characters after parsing: ${token.substring(0, 20)}`);
      }
      if (/[\n\r]/.test(token)) {
        throw new Error(`Token contains newlines after parsing: ${token.substring(0, 20)}`);
      }
      if (/[;&|><`$()]/.test(token)) {
        throw new Error(`Token contains shell metacharacters: ${token.substring(0, 20)}`);
      }
      stringTokens.push(token);
    } else {
      // Shell operators (objects) are rejected
      throw new Error(`Shell operators not allowed: ${JSON.stringify(token)}`);
    }
  }
  
  // NEW: Guard against empty token array
  if (stringTokens.length === 0) {
    throw new Error('Command produced no valid tokens');
  }
  
  return stringTokens; // Safe to use with spawn()
}

/**
 * AUTHORITATIVE path validator - ALL storage operations MUST use this
 * Returns safe path segments for storage
 */
export function normalizePathForStorage(userPath: string, projectRoot: string): {
  safe: boolean;
  normalized: string;
  error?: string;
} {
  // NEW: Enforce ASCII-only (blocks Unicode homoglyphs)
  if (/[^\x00-\x7F]/.test(userPath)) {
    return { 
      safe: false, 
      normalized: userPath, 
      error: 'Path contains non-ASCII characters (Unicode homoglyphs blocked)' 
    };
  }
  
  // Remove traversal attempts
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolutePath = path.resolve(projectRoot, normalized);
  
  // Ensure within project root
  if (!absolutePath.startsWith(projectRoot + path.sep)) {
    return { safe: false, normalized, error: 'Path escapes project root' };
  }
  
  // Block sensitive directories (exact match, not substring)
  const segments = normalized.split(/[/\\]/);
  const forbidden = ['.git', 'node_modules', '.env', 'dist', 'build'];
  if (segments.some(seg => forbidden.includes(seg))) {
    return { 
      safe: false, 
      normalized, 
      error: `Access to sensitive directory blocked: ${segments.find(s => forbidden.includes(s))}` 
    };
  }
  
  return { safe: true, normalized: path.relative(projectRoot, absolutePath) };
}
