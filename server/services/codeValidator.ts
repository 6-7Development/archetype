/**
 * CODE VALIDATOR - Pre-Commit Quality Gates
 * 
 * Prevents LomuAI from committing broken code by running comprehensive validation
 * BEFORE any git commit. This ensures production-ready code quality.
 * 
 * Validation Steps:
 * 1. TypeScript compilation check (syntax errors, type errors)
 * 2. ESLint validation (code quality, best practices)
 * 3. Escape character validation (prevent double-escaping bugs)
 * 4. Git diff sanity check (detect suspicious changes)
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

const execFileAsync = promisify(execFile);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    typescript: boolean;
    eslint: boolean;
    escapeChars: boolean;
    gitDiff: boolean;
  };
}

export class CodeValidator {
  private PROJECT_ROOT: string;
  private validationCache = new Map<string, { hash: string; result: boolean; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache lifetime

  constructor(projectRoot: string = process.cwd()) {
    this.PROJECT_ROOT = projectRoot;
    
    // Clean expired cache entries every minute
    setInterval(() => this.cleanExpiredCache(), 60 * 1000);
  }

  /**
   * Run all pre-commit validation checks
   */
  async validateBeforeCommit(filePaths: string[]): Promise<ValidationResult> {
    console.log('[CODE-VALIDATOR] 🔍 Running pre-commit validation...');
    console.log(`[CODE-VALIDATOR] Files to validate: ${filePaths.join(', ')}`);

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {
        typescript: false,
        eslint: false,
        escapeChars: false,
        gitDiff: false,
      },
    };

    // 1. TypeScript Compilation Check
    await this.checkTypeScript(result);

    // 2. Escape Character Validation (critical for preventing LomuAI's specific bug)
    await this.checkEscapeCharacters(filePaths, result);

    // 3. Git Diff Sanity Check
    await this.checkGitDiff(filePaths, result);

    // 4. ESLint (optional - don't fail on warnings)
    await this.checkESLint(filePaths, result);

    // Mark as invalid if any errors exist
    result.valid = result.errors.length === 0;

    if (!result.valid) {
      console.error('[CODE-VALIDATOR] ❌ Validation FAILED');
      console.error('[CODE-VALIDATOR] Errors:', result.errors);
    } else {
      console.log('[CODE-VALIDATOR] ✅ All validation checks passed');
      if (result.warnings.length > 0) {
        console.warn('[CODE-VALIDATOR] ⚠️  Warnings:', result.warnings);
      }
    }

    return result;
  }

  /**
   * Check TypeScript compilation
   */
  private async checkTypeScript(result: ValidationResult): Promise<void> {
    try {
      console.log('[CODE-VALIDATOR] 🔍 Checking TypeScript compilation...');
      
      // Run tsc --noEmit to check for type errors without generating files
      await execFileAsync('npx', ['tsc', '--noEmit'], { 
        cwd: this.PROJECT_ROOT,
        timeout: 30000, // 30 second timeout
      });
      
      result.checks.typescript = true;
      console.log('[CODE-VALIDATOR] ✅ TypeScript compilation passed');
    } catch (error: any) {
      result.checks.typescript = false;
      
      // Parse TypeScript errors
      const output = error.stdout || error.stderr || error.message;
      const errorLines = output.split('\n').filter((line: string) => 
        line.includes('error TS') || line.includes('ERROR')
      );
      
      if (errorLines.length > 0) {
        result.errors.push(`TypeScript compilation failed:\n${errorLines.slice(0, 10).join('\n')}`);
      } else {
        result.errors.push(`TypeScript compilation failed: ${error.message}`);
      }
      
      console.error('[CODE-VALIDATOR] ❌ TypeScript errors found');
    }
  }

  /**
   * Check for double-escaped characters (LomuAI's specific bug)
   * SMART DETECTION: Only flag literal strings in source output, not regex/JSON encoding
   */
  private async checkEscapeCharacters(filePaths: string[], result: ValidationResult): Promise<void> {
    try {
      console.log('[CODE-VALIDATOR] 🔍 Checking for malformed escape sequences...');
      
      // SCOPED PATTERNS: Only catch LomuAI's specific bug (literal \\n in string operations)
      const suspiciousPatterns = [
        {
          pattern: /\.join\(['"]\\\\n['"]\)/,  // .join('\\n') - should be .join('\n')
          name: "Array join with double-escaped newline",
          severity: 'error'
        },
        {
          pattern: /\.replace\([^,]+,\s*['"]\\\\n['"]\)/,  // .replace(x, '\\n') - should be '\n'
          name: "String replace with double-escaped newline",
          severity: 'error'
        },
        {
          pattern: /}\s*\\n\s*}/,  // Literal \n} at end of block (LomuAI's exact bug)
          name: "Literal backslash-n at closing brace",
          severity: 'error'
        },
      ];

      const issues: string[] = [];

      for (const filePath of filePaths) {
        // Only check code files
        if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) {
          continue;
        }

        try {
          const fullPath = path.resolve(this.PROJECT_ROOT, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          
          for (const { pattern, name, severity } of suspiciousPatterns) {
            // Use non-global regex to avoid lastIndex issues
            const regex = new RegExp(pattern.source);  // Create fresh regex without /g flag
            
            lines.forEach((line, index) => {
              if (regex.test(line)) {
                const lineNum = index + 1;
                const snippet = line.trim().substring(0, 80);
                issues.push(
                  `${filePath}:${lineNum} - ${name}\n  ${snippet}`
                );
              }
            });
          }
        } catch (readError: any) {
          console.warn(`[CODE-VALIDATOR] ⚠️  Could not read ${filePath}: ${readError.message}`);
        }
      }

      if (issues.length > 0) {
        result.checks.escapeChars = false;
        result.errors.push(
          `Malformed escape sequences detected (LomuAI bug pattern):\n${issues.join('\n')}\n\n` +
          `HINT: These patterns indicate double-escaped newlines that will cause syntax errors.\n` +
          `Example fix: .join('\\\\n') should be .join('\\n')`
        );
        console.error('[CODE-VALIDATOR] ❌ Malformed escape sequences found');
      } else {
        result.checks.escapeChars = true;
        console.log('[CODE-VALIDATOR] ✅ No malformed escape sequences found');
      }
    } catch (error: any) {
      console.error('[CODE-VALIDATOR] ⚠️  Escape character check failed:', error.message);
      result.warnings.push(`Escape character check failed: ${error.message}`);
    }
  }

  /**
   * Check git diff for suspicious changes
   */
  private async checkGitDiff(filePaths: string[], result: ValidationResult): Promise<void> {
    try {
      console.log('[CODE-VALIDATOR] 🔍 Checking git diff...');
      
      const suspiciousPatterns = [
        /\\\\n\}/g,         // Literal \n} (common LomuAI bug)
        /\\n\}/g,           // Literal newline escape at end of block
        /}\s*\\n\s*}/g,     // Closing brace followed by literal \n
      ];

      for (const filePath of filePaths) {
        try {
          // Get git diff for this file
          const { stdout: diff } = await execFileAsync('git', ['diff', 'HEAD', filePath], {
            cwd: this.PROJECT_ROOT,
          });
          
          if (!diff) {
            continue; // No changes
          }

          // Check for suspicious patterns in the diff
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(diff)) {
              result.warnings.push(
                `${filePath}: Git diff contains suspicious pattern: ${pattern.source}`
              );
            }
          }
        } catch (diffError: any) {
          // File might be new - that's okay
          if (!diffError.message.includes('does not have any commits yet')) {
            console.warn(`[CODE-VALIDATOR] ⚠️  Could not get diff for ${filePath}: ${diffError.message}`);
          }
        }
      }

      result.checks.gitDiff = true;
      console.log('[CODE-VALIDATOR] ✅ Git diff check passed');
    } catch (error: any) {
      console.error('[CODE-VALIDATOR] ⚠️  Git diff check failed:', error.message);
      result.warnings.push(`Git diff check failed: ${error.message}`);
    }
  }

  /**
   * Check ESLint (optional - warnings only)
   */
  private async checkESLint(filePaths: string[], result: ValidationResult): Promise<void> {
    try {
      console.log('[CODE-VALIDATOR] 🔍 Running ESLint...');
      
      // Only lint code files
      const codeFiles = filePaths.filter(fp => fp.match(/\.(ts|tsx|js|jsx)$/));
      
      if (codeFiles.length === 0) {
        result.checks.eslint = true;
        return;
      }

      // Run ESLint
      await execFileAsync('npx', ['eslint', '--quiet', ...codeFiles], {
        cwd: this.PROJECT_ROOT,
        timeout: 20000, // 20 second timeout
      });
      
      result.checks.eslint = true;
      console.log('[CODE-VALIDATOR] ✅ ESLint passed');
    } catch (error: any) {
      // ESLint failures are warnings, not errors
      const output = error.stdout || error.stderr || error.message;
      result.warnings.push(`ESLint warnings: ${output.substring(0, 500)}`);
      result.checks.eslint = false;
      console.warn('[CODE-VALIDATOR] ⚠️  ESLint warnings found (non-blocking)');
    }
  }

  /**
   * Calculate SHA-256 hash of file content for cache validation
   */
  private async getFileHash(filePath: string): Promise<string> {
    try {
      const fullPath = path.resolve(this.PROJECT_ROOT, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      // If file doesn't exist or can't be read, return empty hash
      return '';
    }
  }

  /**
   * Clean expired cache entries to prevent memory leaks
   */
  private cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    // Convert to array to avoid iterator issues
    const entries = Array.from(this.validationCache.entries());
    for (const [filePath, cacheEntry] of entries) {
      if (now - cacheEntry.timestamp > this.CACHE_TTL) {
        this.validationCache.delete(filePath);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[CODE-VALIDATOR] 🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Quick validation for single file (used by write_platform_file)
   * SMART DETECTION: Only flag literal strings in source output, not regex/JSON encoding
   * CACHING: Uses file hash to avoid redundant validation of unchanged files
   */
  async validateSingleFile(filePath: string, content: string): Promise<ValidationResult> {
    console.log(`[CODE-VALIDATOR] 🔍 Quick validation for: ${filePath}`);

    // Only validate code files
    if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      console.log('[CODE-VALIDATOR] ⏭️  Skipping non-code file');
      return {
        valid: true,
        errors: [],
        warnings: [],
        checks: {
          typescript: false,
          eslint: false,
          escapeChars: true,
          gitDiff: true,
        },
      };
    }

    // Check cache
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    const cached = this.validationCache.get(filePath);
    
    if (cached && cached.hash === contentHash) {
      console.log(`[CODE-VALIDATOR] ✅ Using cached validation result for ${filePath}`);
      return {
        valid: cached.result,
        errors: cached.result ? [] : ['Previous validation failed (from cache)'],
        warnings: [],
        checks: {
          typescript: cached.result,
          eslint: cached.result,
          escapeChars: cached.result,
          gitDiff: cached.result,
        },
      };
    }

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {
        typescript: false,
        eslint: false,
        escapeChars: true,
        gitDiff: true,
      },
    };

    // SCOPED PATTERNS: Only catch LomuAI's specific bug (literal \\n in string operations)
    const suspiciousPatterns = [
      {
        pattern: /\.join\(['"]\\\\n['"]\)/,
        name: "Array join with double-escaped newline (.join('\\\\n'))",
        hint: "Should be .join('\\n')"
      },
      {
        pattern: /\.replace\([^,]+,\s*['"]\\\\n['"]\)/,
        name: "String replace with double-escaped newline (.replace(x, '\\\\n'))",
        hint: "Should be .replace(x, '\\n')"
      },
      {
        pattern: /}\s*\\n\s*}/,
        name: "Literal backslash-n at closing brace (}\\n})",
        hint: "Should be two separate lines with closing braces"
      },
    ];

    const lines = content.split('\n');
    const issues: string[] = [];

    for (const { pattern, name, hint } of suspiciousPatterns) {
      // Use non-global regex to avoid lastIndex issues
      const regex = new RegExp(pattern.source);
      
      lines.forEach((line, index) => {
        if (regex.test(line)) {
          const lineNum = index + 1;
          const snippet = line.trim().substring(0, 80);
          issues.push(
            `Line ${lineNum}: ${name}\n  ${snippet}\n  HINT: ${hint}`
          );
        }
      });
    }

    if (issues.length > 0) {
      result.checks.escapeChars = false;
      result.valid = false;
      result.errors.push(
        `Malformed escape sequences detected in ${filePath}:\n${issues.join('\n\n')}\n\n` +
        `These patterns will cause syntax errors when the file is loaded.`
      );
      console.error('[CODE-VALIDATOR] ❌ Quick validation FAILED');
    } else {
      console.log('[CODE-VALIDATOR] ✅ Quick validation passed');
    }

    // Cache the result
    this.validationCache.set(filePath, {
      hash: contentHash,
      result: result.valid,
      timestamp: Date.now()
    });

    return result;
  }
  
  /**
   * Clear validation cache for specific file or all files
   * Useful when files are modified externally or to force re-validation
   */
  clearCache(filePath?: string) {
    if (filePath) {
      this.validationCache.delete(filePath);
      console.log(`[CODE-VALIDATOR] 🧹 Cleared cache for ${filePath}`);
    } else {
      const size = this.validationCache.size;
      this.validationCache.clear();
      console.log(`[CODE-VALIDATOR] 🧹 Cleared entire validation cache (${size} entries)`);
    }
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      size: this.validationCache.size,
      entries: Array.from(this.validationCache.entries()).map(([path, entry]) => ({
        path,
        hash: entry.hash.substring(0, 8) + '...',
        valid: entry.result,
        age: Math.floor((Date.now() - entry.timestamp) / 1000) + 's'
      }))
    };
  }
}

// Export singleton instance
export const codeValidator = new CodeValidator();
