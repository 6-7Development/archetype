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
  
  // Extract string tokens, reject operators
  const stringTokens: string[] = [];
  for (const token of tokens) {
    if (typeof token === 'string') {
      // Re-check each token
      if (/[\x00-\x1F\x7F\n\r]/.test(token) || /[;&|><`$()]/.test(token)) {
        throw new Error(`Invalid token: ${token.substring(0, 20)}`);
      }
      stringTokens.push(token);
    } else {
      // Shell operators (objects) are rejected
      throw new Error(`Shell operators not allowed: ${JSON.stringify(token)}`);
    }
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
  // First normalize and resolve to check for path traversal
  const normalized = path.normalize(userPath);
  const absolutePath = path.resolve(projectRoot, normalized);
  
  // Ensure within project root (must start with projectRoot + separator)
  const projectRootWithSep = projectRoot.endsWith(path.sep) ? projectRoot : projectRoot + path.sep;
  if (!absolutePath.startsWith(projectRootWithSep) && absolutePath !== projectRoot) {
    return { safe: false, normalized, error: 'Path escapes project root' };
  }
  
  // Get the relative path for further checks
  const relativePath = path.relative(projectRoot, absolutePath);
  
  // Block sensitive directories
  const forbidden = ['.git', 'node_modules', '.env', 'dist', 'build'];
  if (forbidden.some(dir => relativePath.includes(dir))) {
    return { safe: false, normalized: relativePath, error: 'Access to sensitive directory blocked' };
  }
  
  return { safe: true, normalized: relativePath };
}
