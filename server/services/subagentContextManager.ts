import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

/**
 * Subagent Context Manager - Prevents conflicts in parallel execution
 * Maintains shared codebase state + file locking for all running subagents
 */

export interface SubagentContext {
  projectId: string;
  userId: string;
  executionId: string; // Unique ID for this parallel execution batch
  fileSnapshot: Map<string, { content: string; hash: string; locked: boolean }>;
  codebaseHash: string;
  lockedFiles: Map<string, { subagentId: string; timestamp: number }>;
  mainAgentLockedFiles: Set<string>;
}

// In-memory storage of active contexts per execution
const activeContexts = new Map<string, SubagentContext>();

// Calculate file hash for change detection
function calculateHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Initialize a new execution context with current codebase snapshot
 */
export async function initializeExecutionContext(
  projectId: string,
  userId: string,
  projectRoot: string = '/home/runner/workspace'
): Promise<SubagentContext> {
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const fileSnapshot = new Map<string, { content: string; hash: string; locked: boolean }>();
  
  try {
    // Read all project files into snapshot
    const fileList = await listProjectFiles(projectRoot);
    let combinedHash = '';

    for (const filePath of fileList) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = calculateHash(content);
        fileSnapshot.set(filePath, { content, hash, locked: false });
        combinedHash += hash;
      } catch (err) {
        console.warn(`[SUBAGENT-CONTEXT] Could not read ${filePath}:`, err);
      }
    }

    const codebaseHash = calculateHash(combinedHash);
    const context: SubagentContext = {
      projectId,
      userId,
      executionId,
      fileSnapshot,
      codebaseHash,
      lockedFiles: new Map(),
      mainAgentLockedFiles: new Set(),
    };

    activeContexts.set(executionId, context);
    console.log(`[SUBAGENT-CONTEXT] Initialized execution ${executionId}: ${fileSnapshot.size} files, hash ${codebaseHash.slice(0, 8)}`);
    
    return context;
  } catch (error) {
    console.error('[SUBAGENT-CONTEXT] Failed to initialize context:', error);
    throw error;
  }
}

/**
 * Lock files for exclusive subagent access
 */
export async function acquireFileLocks(
  executionId: string,
  subagentId: string,
  filesToLock: string[]
): Promise<{ success: boolean; lockedFiles: string[]; conflicts?: string[] }> {
  const context = activeContexts.get(executionId);
  if (!context) {
    return { success: false, lockedFiles: [], conflicts: ['Execution context not found'] };
  }

  const conflicts: string[] = [];
  const locked: string[] = [];

  for (const file of filesToLock) {
    // Check if already locked by another subagent
    if (context.lockedFiles.has(file) && context.lockedFiles.get(file)!.subagentId !== subagentId) {
      conflicts.push(`${file} is locked by ${context.lockedFiles.get(file)!.subagentId}`);
      continue;
    }

    // Check if main agent locked it
    if (context.mainAgentLockedFiles.has(file)) {
      conflicts.push(`${file} is locked by main agent`);
      continue;
    }

    // Acquire lock
    context.lockedFiles.set(file, { subagentId, timestamp: Date.now() });
    locked.push(file);
  }

  console.log(`[SUBAGENT-CONTEXT] Subagent ${subagentId.slice(0, 8)} locked ${locked.length} files (${conflicts.length} conflicts)`);
  
  return { success: conflicts.length === 0, lockedFiles: locked, conflicts: conflicts.length > 0 ? conflicts : undefined };
}

/**
 * Release file locks when subagent completes
 */
export async function releaseFileLocks(executionId: string, subagentId: string): Promise<void> {
  const context = activeContexts.get(executionId);
  if (!context) return;

  let releasedCount = 0;
  for (const [file, lock] of context.lockedFiles.entries()) {
    if (lock.subagentId === subagentId) {
      context.lockedFiles.delete(file);
      releasedCount++;
    }
  }

  console.log(`[SUBAGENT-CONTEXT] Subagent ${subagentId.slice(0, 8)} released ${releasedCount} locks`);
}

/**
 * Detect if subagent modified locked files or created conflicts
 */
export async function validateSubagentChanges(
  executionId: string,
  subagentId: string,
  modifiedFiles: Map<string, string>
): Promise<{ valid: boolean; conflicts: string[] }> {
  const context = activeContexts.get(executionId);
  if (!context) {
    return { valid: false, conflicts: ['Execution context not found'] };
  }

  const conflicts: string[] = [];

  for (const [filePath, newContent] of modifiedFiles.entries()) {
    const snapshot = context.fileSnapshot.get(filePath);
    
    // Check if file was changed by another subagent since snapshot
    if (snapshot) {
      const newHash = calculateHash(newContent);
      const originalHash = snapshot.hash;
      
      // If hashes differ and subagent didn't lock it, there's a conflict
      if (newHash !== originalHash && !context.lockedFiles.has(filePath)) {
        conflicts.push(`${filePath}: Hash mismatch (not locked)`);
      }
    }
  }

  const valid = conflicts.length === 0;
  console.log(`[SUBAGENT-CONTEXT] Validated ${subagentId.slice(0, 8)}: ${valid ? 'valid' : `${conflicts.length} conflicts`}`);
  
  return { valid, conflicts };
}

/**
 * Mark files as locked by main agent to prevent subagent writes
 */
export function lockFilesForMainAgent(executionId: string, files: string[]): void {
  const context = activeContexts.get(executionId);
  if (!context) return;

  for (const file of files) {
    context.mainAgentLockedFiles.add(file);
  }
  
  console.log(`[SUBAGENT-CONTEXT] Main agent locked ${files.length} files`);
}

/**
 * Cleanup execution context when done
 */
export function cleanupExecutionContext(executionId: string): void {
  activeContexts.delete(executionId);
  console.log(`[SUBAGENT-CONTEXT] Cleaned up execution ${executionId}`);
}

/**
 * Get current context (for debugging/monitoring)
 */
export function getExecutionContext(executionId: string): SubagentContext | undefined {
  return activeContexts.get(executionId);
}

/**
 * Helper: List all files in project
 */
async function listProjectFiles(projectRoot: string, maxDepth = 5, currentDepth = 0): Promise<string[]> {
  const files: string[] = [];
  const ignorePatterns = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.env',
    '.env.local',
    '.DS_Store',
  ];

  if (currentDepth >= maxDepth) return files;

  try {
    const entries = await fs.readdir(projectRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (ignorePatterns.some(pattern => entry.name.includes(pattern))) {
        continue;
      }

      const fullPath = path.join(projectRoot, entry.name);
      
      if (entry.isFile()) {
        files.push(fullPath);
      } else if (entry.isDirectory()) {
        const subFiles = await listProjectFiles(fullPath, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    console.warn(`[SUBAGENT-CONTEXT] Could not read directory ${projectRoot}:`, error);
  }

  return files;
}
