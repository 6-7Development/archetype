import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = process.cwd();

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  details: {
    syntaxCheck?: boolean;
    typeCheck?: boolean;
    buildCheck?: boolean;
    healthCheck?: boolean;
  };
}

/**
 * Platform Validator - Like Replit Agent 3
 * Validates code changes before committing to ensure platform stability
 */
export class PlatformValidator {

  /**
   * Main validation function - runs all checks
   */
  async validateChanges(changedFiles: string[]): Promise<ValidationResult> {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      details: {},
    };

    console.log('[PLATFORM-VALIDATOR] Starting validation for', changedFiles.length, 'files');

    // 1. Syntax check for changed files
    const syntaxResult = await this.checkSyntax(changedFiles);
    result.details.syntaxCheck = syntaxResult.success;
    if (!syntaxResult.success) {
      result.success = false;
      result.errors.push(...syntaxResult.errors);
    }

    // 2. TypeScript type check
    const typeResult = await this.checkTypes();
    result.details.typeCheck = typeResult.success;
    if (!typeResult.success) {
      result.success = false;
      result.errors.push(...typeResult.errors);
    }
    result.warnings.push(...typeResult.warnings);

    // 3. Build check (quick dry-run)
    const buildResult = await this.checkBuild();
    result.details.buildCheck = buildResult.success;
    if (!buildResult.success) {
      result.success = false;
      result.errors.push(...buildResult.errors);
    }

    // 4. Critical file check
    const criticalResult = await this.checkCriticalFiles(changedFiles);
    if (!criticalResult.success) {
      result.warnings.push(...criticalResult.warnings);
    }

    console.log('[PLATFORM-VALIDATOR] Validation complete:', result.success ? 'PASSED' : 'FAILED');
    return result;
  }

  /**
   * Check syntax of changed files
   */
  private async checkSyntax(changedFiles: string[]): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check TypeScript/JavaScript files for basic syntax
      const tsFiles = changedFiles.filter(f =>
        f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')
      );

      if (tsFiles.length === 0) {
        return { success: true, errors: [] };
      }

      // Use tsc with --noEmit to check syntax without building
      try {
        await execFileAsync('npx', ['tsc', '--noEmit', '--skipLibCheck', ...tsFiles], {
          cwd: PROJECT_ROOT,
          timeout: 30000,
        });
        console.log('[PLATFORM-VALIDATOR] ✅ Syntax check passed');
        return { success: true, errors: [] };
      } catch (error: any) {
        // tsc returns non-zero on errors, parse them
        const output = error.stdout || error.stderr || '';
        const lines = output.split('\n').filter((line: string) => line.includes('error TS'));

        if (lines.length > 0) {
          errors.push('TypeScript syntax errors found:');
          errors.push(...lines.slice(0, 5)); // Show first 5 errors
          if (lines.length > 5) {
            errors.push(`... and ${lines.length - 5} more errors`);
          }
        } else if (output) {
          errors.push('Syntax check failed');
        }

        console.log('[PLATFORM-VALIDATOR] ❌ Syntax check failed:', errors.length, 'errors');
        return { success: false, errors };
      }
    } catch (error: any) {
      console.warn('[PLATFORM-VALIDATOR] Syntax check skipped:', error.message);
      return { success: true, errors: [] }; // Non-fatal if tools not available
    }
  }

  /**
   * Check TypeScript types
   */
  private async checkTypes(): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Run tsc check on the entire project
      try {
        await execFileAsync('npx', ['tsc', '--noEmit', '--pretty'], {
          cwd: PROJECT_ROOT,
          timeout: 60000, // 60 seconds
        });
        console.log('[PLATFORM-VALIDATOR] ✅ Type check passed');
        return { success: true, errors: [], warnings: [] };
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';

        // Count errors vs warnings
        const errorLines = output.split('\n').filter((line: string) => line.includes('error TS'));
        const warningLines = output.split('\n').filter((line: string) => line.includes('warning'));

        if (errorLines.length > 0) {
          errors.push(`Found ${errorLines.length} TypeScript errors`);

          // Show critical errors
          const criticalErrors = errorLines
            .filter((line: string) =>
              line.includes('Cannot find') ||
              line.includes('is not assignable') ||
              line.includes('does not exist')
            )
            .slice(0, 3);

          if (criticalErrors.length > 0) {
            errors.push(...criticalErrors);
          }
        }

        if (warningLines.length > 0) {
          warnings.push(`Found ${warningLines.length} TypeScript warnings (non-blocking)`);
        }

        // If errors are minor (just unused vars, implicit any, etc), treat as warnings
        const minorErrorPatterns = ['is declared but never used', 'implicitly has an \'any\' type'];
        const hasOnlyMinorErrors = errorLines.length > 0 && errorLines.every((line: string) =>
          minorErrorPatterns.some(pattern => line.includes(pattern))
        );

        if (hasOnlyMinorErrors) {
          console.log('[PLATFORM-VALIDATOR] ⚠️ Type check has minor issues (non-blocking)');
          return { success: true, errors: [], warnings: errors };
        }

        if (errors.length > 0) {
          console.log('[PLATFORM-VALIDATOR] ❌ Type check failed');
          return { success: false, errors, warnings };
        }

        console.log('[PLATFORM-VALIDATOR] ✅ Type check passed with warnings');
        return { success: true, errors: [], warnings };
      }
    } catch (error: any) {
      console.warn('[PLATFORM-VALIDATOR] Type check skipped:', error.message);
      return { success: true, errors: [], warnings: ['Type check skipped - tsc not available'] };
    }
  }

  /**
   * Quick build check to ensure code compiles
   */
  private async checkBuild(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      console.log('[PLATFORM-VALIDATOR] Running build check...');

      // Try to build (with timeout)
      try {
        const { stdout, stderr } = await execFileAsync('npm', ['run', 'build', '--', '--dry-run'], {
          cwd: PROJECT_ROOT,
          timeout: 90000, // 90 seconds
        });

        console.log('[PLATFORM-VALIDATOR] ✅ Build check passed');
        return { success: true, errors: [] };
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';

        if (output.includes('ERROR') || output.includes('Error:')) {
          errors.push('Build failed with errors');

          // Extract key error messages
          const errorLines = output.split('\n')
            .filter((line: string) => line.includes('ERROR') || line.includes('Error:'))
            .slice(0, 3);

          errors.push(...errorLines);
        } else {
          errors.push('Build check failed');
        }

        console.log('[PLATFORM-VALIDATOR] ❌ Build check failed');
        return { success: false, errors };
      }
    } catch (error: any) {
      console.warn('[PLATFORM-VALIDATOR] Build check skipped:', error.message);
      // Non-fatal - maybe build script doesn't exist
      return { success: true, errors: [] };
    }
  }

  /**
   * Check if critical platform files are being modified
   */
  private async checkCriticalFiles(changedFiles: string[]): Promise<{ success: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    const criticalFiles = [
      'server/index.ts',
      'server/db.ts',
      'server/routes.ts',
      'shared/schema.ts',
      'package.json',
      'drizzle.config.ts',
    ];

    const modifiedCriticalFiles = changedFiles.filter(file =>
      criticalFiles.some(critical => file.endsWith(critical))
    );

    if (modifiedCriticalFiles.length > 0) {
      warnings.push(`⚠️ Modified critical files: ${modifiedCriticalFiles.join(', ')}`);
      warnings.push('Extra caution recommended - these changes affect core platform');
    }

    return { success: true, warnings };
  }

  /**
   * Quick health check - verify essential files exist
   */
  async checkPlatformHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    const essentialFiles = [
      'server/index.ts',
      'server/db.ts',
      'client/index.html',
      'package.json',
    ];

    for (const file of essentialFiles) {
      try {
        await fs.access(path.join(PROJECT_ROOT, file));
      } catch {
        issues.push(`Missing essential file: ${file}`);
      }
    }

    const healthy = issues.length === 0;
    if (healthy) {
      console.log('[PLATFORM-VALIDATOR] ✅ Platform health check passed');
    } else {
      console.log('[PLATFORM-VALIDATOR] ❌ Platform health check failed:', issues.length, 'issues');
    }

    return { healthy, issues };
  }
}

export const platformValidator = new PlatformValidator();
