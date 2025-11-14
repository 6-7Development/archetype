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

  constructor(projectRoot: string = process.cwd()) {
    this.PROJECT_ROOT = projectRoot;
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
   */
  private async checkEscapeCharacters(filePaths: string[], result: ValidationResult): Promise<void> {
    try {
      console.log('[CODE-VALIDATOR] 🔍 Checking for double-escaped characters...');
      
      const suspiciousPatterns = [
        /\\\\n/g,           // Double-escaped newlines: \\n (should be \n)
        /\\\\t/g,           // Double-escaped tabs: \\t (should be \t)
        /\\\\r/g,           // Double-escaped carriage return: \\r (should be \r)
        /'\\\\n'/g,         // In single quotes: '\\n' (should be '\n')
        /"\\\\n"/g,         // In double quotes: "\\n" (should be "\n")
        /join\('\\\\n'\)/g, // Array join with escaped newline
        /replace\(.*?, '\\\\n'\)/g, // Regex replace with escaped newline
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
          
          for (const pattern of suspiciousPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              const lines = content.split('\n');
              const lineNumbers: number[] = [];
              
              lines.forEach((line, index) => {
                if (pattern.test(line)) {
                  lineNumbers.push(index + 1);
                }
              });
              
              issues.push(
                `${filePath}:${lineNumbers.join(',')} - Found double-escaped characters: ${matches[0]}`
              );
            }
          }
        } catch (readError: any) {
          console.warn(`[CODE-VALIDATOR] ⚠️  Could not read ${filePath}: ${readError.message}`);
        }
      }

      if (issues.length > 0) {
        result.checks.escapeChars = false;
        result.errors.push(
          `Double-escaped characters detected (LomuAI bug):\n${issues.join('\n')}\n\n` +
          `HINT: Replace \\\\n with \\n, \\\\t with \\t, etc.`
        );
        console.error('[CODE-VALIDATOR] ❌ Double-escaped characters found');
      } else {
        result.checks.escapeChars = true;
        console.log('[CODE-VALIDATOR] ✅ No double-escaped characters found');
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
   * Quick validation for single file (used by write_platform_file)
   */
  async validateSingleFile(filePath: string, content: string): Promise<ValidationResult> {
    console.log(`[CODE-VALIDATOR] 🔍 Quick validation for: ${filePath}`);

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

    // Check for double-escaped characters in content before writing
    const suspiciousPatterns = [
      { pattern: /\\\\n/g, name: '\\\\n (should be \\n)' },
      { pattern: /\\\\t/g, name: '\\\\t (should be \\t)' },
      { pattern: /\\\\r/g, name: '\\\\r (should be \\r)' },
      { pattern: /}\s*\\n\s*}/g, name: '}\\n} (malformed closing braces)' },
    ];

    for (const { pattern, name } of suspiciousPatterns) {
      if (pattern.test(content)) {
        result.errors.push(
          `Content contains double-escaped characters: ${name}\n` +
          `This will cause syntax errors. Fix the content before writing.`
        );
      }
    }

    result.checks.escapeChars = result.errors.length === 0;
    result.valid = result.errors.length === 0;

    if (!result.valid) {
      console.error('[CODE-VALIDATOR] ❌ Quick validation FAILED');
      console.error('[CODE-VALIDATOR] Errors:', result.errors);
    } else {
      console.log('[CODE-VALIDATOR] ✅ Quick validation passed');
    }

    return result;
  }
}

// Export singleton instance
export const codeValidator = new CodeValidator();
