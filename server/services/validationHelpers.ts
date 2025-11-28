/**
 * VALIDATION HELPERS - Reusable utilities for code validation and retry logic
 * 
 * Extracted from geminiOrchestrator.ts for use across HexadAI workflows.
 * Provides:
 * - File existence validation
 * - TypeScript compilation checking
 * - Generic retry logic with exponential backoff
 * - Progress tracking utilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ==================== INTERFACES ====================

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileChangeRecord {
  file: string;
  timestamp: number;
  operation: 'create' | 'modify' | 'delete';
}

export interface ValidationOptions {
  workingDir: string;
  timeout?: number; // milliseconds
  skipTypeScriptCheck?: boolean;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay?: number; // milliseconds (default: 1000)
  exponential?: boolean; // use exponential backoff (default: true)
  onRetry?: (attempt: number, error: Error) => void;
}

// ==================== FILE VALIDATION ====================

/**
 * Validate that specified files exist after operations
 * 
 * @param files - Array of file paths to check (relative to workingDir)
 * @param workingDir - Base directory for resolving file paths
 * @returns ValidationResult with errors for missing files
 */
export async function validateFileChanges(
  files: string[],
  workingDir: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!files || files.length === 0) {
    warnings.push('No files specified for validation');
    return { success: true, errors, warnings };
  }

  for (const file of files) {
    const fullPath = path.join(workingDir, file);
    
    try {
      await fs.access(fullPath);
      // File exists - success
    } catch (error: any) {
      errors.push(`Expected file not found: ${file}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate TypeScript compilation without emitting files
 * Runs `npx tsc --noEmit` on TypeScript files
 * 
 * @param files - Array of file paths to check
 * @param workingDir - Base directory for running tsc
 * @returns ValidationResult with TypeScript compilation errors
 */
export async function validateTypeScript(
  files: string[],
  workingDir: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if any TypeScript files are in the list
  const hasTypeScriptFiles = files.some(
    f => f.endsWith('.ts') || f.endsWith('.tsx')
  );

  if (!hasTypeScriptFiles) {
    warnings.push('No TypeScript files to validate');
    return { success: true, errors, warnings };
  }

  try {
    // Run TypeScript compiler in check mode
    await execAsync('npx tsc --noEmit', {
      cwd: workingDir,
      timeout: 30000, // 30 second timeout
    });

    // No errors - TypeScript check passed
    return { success: true, errors, warnings };
  } catch (error: any) {
    // TypeScript compilation errors found
    const errorOutput = error.stdout || error.stderr || error.message;
    
    // Parse TypeScript errors (basic parsing)
    const errorLines = errorOutput.split('\n').filter((line: string) => 
      line.trim() && !line.startsWith('Found ')
    );

    errors.push(...errorLines);

    return {
      success: false,
      errors,
      warnings,
    };
  }
}

/**
 * Validate both file existence and TypeScript compilation
 * 
 * @param files - Array of file paths to validate
 * @param options - Validation options
 * @returns Combined validation result
 */
export async function validateAllChanges(
  files: string[],
  options: ValidationOptions
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Check file existence
  const fileResult = await validateFileChanges(files, options.workingDir);
  errors.push(...fileResult.errors);
  warnings.push(...fileResult.warnings);

  // If files don't exist, no point checking TypeScript
  if (!fileResult.success) {
    return { success: false, errors, warnings };
  }

  // Step 2: Check TypeScript (if not skipped)
  if (!options.skipTypeScriptCheck) {
    const tsResult = await validateTypeScript(files, options.workingDir);
    errors.push(...tsResult.errors);
    warnings.push(...tsResult.warnings);

    return {
      success: tsResult.success,
      errors,
      warnings,
    };
  }

  return { success: true, errors, warnings };
}

// ==================== RETRY LOGIC ====================

/**
 * Generic retry operation with exponential backoff
 * 
 * @param operation - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the operation if successful
 * @throws Error if all retries are exhausted
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { 
    maxRetries, 
    baseDelay = 1000, 
    exponential = true,
    onRetry 
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Attempt the operation
      const result = await operation();
      return result; // Success!
    } catch (error: any) {
      lastError = error;

      // If this was the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        break;
      }

      // Calculate delay (exponential backoff or fixed delay)
      const delay = exponential 
        ? baseDelay * Math.pow(2, attempt)  // 1s, 2s, 4s, 8s...
        : baseDelay;

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  throw new Error(
    `Operation failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Retry a validation operation with custom retry logic
 * Useful for retrying file operations that may fail due to timing
 * 
 * @param validateFn - Validation function that returns ValidationResult
 * @param options - Retry configuration
 * @returns ValidationResult if successful
 * @throws Error if all retries fail
 */
export async function retryValidation(
  validateFn: () => Promise<ValidationResult>,
  options: RetryOptions
): Promise<ValidationResult> {
  return retryOperation(async () => {
    const result = await validateFn();
    
    // If validation failed, throw error to trigger retry
    if (!result.success) {
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }
    
    return result;
  }, options);
}

// ==================== PROGRESS TRACKING ====================

/**
 * Track file changes with timestamps and operations
 */
export class FileChangeTracker {
  private changes: FileChangeRecord[] = []; // Store ALL changes in order
  private modifiedFiles: Set<string> = new Set();

  /**
   * Record a file change
   */
  recordChange(file: string, operation: 'create' | 'modify' | 'delete'): void {
    // Add to history (array stores all changes, not just latest)
    this.changes.push({
      file,
      timestamp: Date.now(),
      operation,
    });

    if (operation !== 'delete') {
      this.modifiedFiles.add(file);
    } else {
      this.modifiedFiles.delete(file);
    }
  }

  /**
   * Get recent changes within a time window
   */
  getRecentChanges(windowMs: number = 60000): FileChangeRecord[] {
    const cutoff = Date.now() - windowMs;
    return this.changes
      .filter(change => change.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  }

  /**
   * Get all modified files
   */
  getModifiedFiles(): string[] {
    return Array.from(this.modifiedFiles);
  }

  /**
   * Get change count
   */
  getChangeCount(): number {
    return this.changes.length;
  }

  /**
   * Clear all tracked changes
   */
  clear(): void {
    this.changes = [];
    this.modifiedFiles.clear();
  }

  /**
   * Get changes for a specific file (most recent)
   */
  getFileHistory(file: string): FileChangeRecord | undefined {
    // Find most recent change for this file
    const fileChanges = this.changes.filter(c => c.file === file);
    return fileChanges.length > 0 ? fileChanges[fileChanges.length - 1] : undefined;
  }

  /**
   * Check if a file was recently modified
   */
  wasRecentlyModified(file: string, windowMs: number = 5000): boolean {
    const change = this.getFileHistory(file);
    if (!change) return false;
    
    return (Date.now() - change.timestamp) <= windowMs;
  }
}

// ==================== DUPLICATE SUPPRESSION ====================

/**
 * Simple deduplication tracker for operations
 * Prevents duplicate operations within a time window
 */
export class DuplicateSuppressionTracker {
  private operations: Map<string, number> = new Map();
  private readonly windowMs: number;

  constructor(windowMs: number = 5000) {
    this.windowMs = windowMs;
  }

  /**
   * Check if an operation is a duplicate (within time window)
   * Returns true if duplicate, false if new
   */
  isDuplicate(operationKey: string): boolean {
    const lastTime = this.operations.get(operationKey);
    
    if (!lastTime) {
      this.operations.set(operationKey, Date.now());
      return false;
    }

    const timeSince = Date.now() - lastTime;
    
    if (timeSince < this.windowMs) {
      // Duplicate - too soon
      return true;
    }

    // Not a duplicate - update timestamp
    this.operations.set(operationKey, Date.now());
    return false;
  }

  /**
   * Clear old entries to prevent memory leaks
   */
  cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    
    Array.from(this.operations.entries()).forEach(([key, timestamp]) => {
      if (timestamp < cutoff) {
        this.operations.delete(key);
      }
    });
  }

  /**
   * Clear all tracked operations
   */
  clear(): void {
    this.operations.clear();
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.success) {
    return 'Validation passed';
  }

  const parts: string[] = [];

  if (result.errors.length > 0) {
    parts.push('ERROR:');
    result.errors.forEach(err => {
      parts.push(`  - ${err}`);
    });
  }

  if (result.warnings.length > 0) {
    parts.push('WARNING:');
    result.warnings.forEach(warn => {
      parts.push(`  - ${warn}`);
    });
  }

  return parts.join('\n');
}

/**
 * Create an operation key for duplicate suppression
 * Combines operation type and target for uniqueness
 */
export function createOperationKey(
  operation: string,
  target: string,
  ...params: any[]
): string {
  const paramStr = params.length > 0 
    ? JSON.stringify(params) 
    : '';
  
  return `${operation}:${target}:${paramStr}`;
}
