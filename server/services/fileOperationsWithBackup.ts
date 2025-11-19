/**
 * FILE OPERATIONS WITH AUTO-ROLLBACK
 * 
 * Transaction-like file operations with automatic rollback on failure.
 * Implements BRAIN-GAP-3: Auto-Rollback feature per Gemini's recommendation.
 * 
 * CRITICAL FOR DATA SAFETY:
 * - Backs up files to .temp/ before modification
 * - Auto-restores on write failure or crash
 * - Cleans up successful backups automatically
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';

const TEMP_BACKUP_DIR = path.join(process.cwd(), '.temp');

export interface FileOperation {
  operationId: string;
  originalPath: string;
  backupPath?: string;
  operation: 'write' | 'delete' | 'create';
  timestamp: Date;
}

export interface RollbackResult {
  success: boolean;
  restoredFiles: string[];
  errors: string[];
}

const ROLLBACK_METADATA_FILE = path.join(TEMP_BACKUP_DIR, 'rollback-metadata.json');

class FileOperationsWithBackup {
  // Active operations: Map<operationId, FileOperation>
  private activeOperations: Map<string, FileOperation> = new Map();
  
  // Ready promise - ensures crash recovery completes before operations
  private ready: Promise<void>;
  
  constructor() {
    // Initialize async - ensures crash recovery completes before operations
    this.ready = this.init();
  }
  
  /**
   * Async initialization - MUST complete before any file operations
   * Prevents race conditions between startup recovery and first operation
   */
  private async init(): Promise<void> {
    await this.ensureTempDir();
    // BRAIN-GAP-3 FIX: Crash recovery - sweep .temp/ on startup
    await this.performStartupCrashRecovery();
    console.log('[FILE-BACKUP] Auto-rollback system initialized with crash recovery');
  }
  
  /**
   * Write file with automatic backup and rollback support
   * Returns operation ID for tracking
   */
  async writeFileWithBackup(
    filePath: string,
    content: string,
    sessionId?: string
  ): Promise<{ success: boolean; operationId: string; error?: string }> {
    // CRITICAL: Wait for crash recovery to complete before operations
    await this.ready;
    
    const operationId = `write-${nanoid()}`;
    const absolutePath = path.resolve(process.cwd(), filePath);
    
    try {
      console.log(`[FILE-BACKUP] Starting write operation ${operationId} for ${filePath}`);
      
      // Step 1: Check if file exists and needs backup
      let backupPath: string | undefined;
      try {
        await fs.access(absolutePath);
        // File exists - create backup
        backupPath = await this.createBackup(absolutePath, operationId);
        console.log(`[FILE-BACKUP] Created backup: ${backupPath}`);
      } catch {
        // File doesn't exist - no backup needed (new file creation)
        console.log(`[FILE-BACKUP] No backup needed - creating new file: ${filePath}`);
      }
      
      // Step 2: Record operation
      const operation: FileOperation = {
        operationId,
        originalPath: absolutePath,
        backupPath,
        operation: backupPath ? 'write' : 'create',
        timestamp: new Date(),
      };
      this.activeOperations.set(operationId, operation);
      
      // Persist metadata for crash recovery
      await this.persistRollbackMetadata();
      
      // Step 3: Write the file
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');
      
      console.log(`[FILE-BACKUP] ✅ Write successful: ${filePath}`);
      
      // Step 4: Operation successful - remove from active operations
      this.activeOperations.delete(operationId);
      
      // Step 5: Update rollback metadata
      await this.persistRollbackMetadata();
      
      return { success: true, operationId };
      
    } catch (error: any) {
      console.error(`[FILE-BACKUP] ❌ Write failed for ${filePath}:`, error.message);
      
      // AUTO-ROLLBACK: Restore from backup
      await this.rollbackOperation(operationId);
      
      return {
        success: false,
        operationId,
        error: error.message,
      };
    }
  }
  
  /**
   * Delete file with automatic backup and rollback support
   */
  async deleteFileWithBackup(
    filePath: string,
    sessionId?: string
  ): Promise<{ success: boolean; operationId: string; error?: string }> {
    // CRITICAL: Wait for crash recovery to complete before operations
    await this.ready;
    
    const operationId = `delete-${nanoid()}`;
    const absolutePath = path.resolve(process.cwd(), filePath);
    
    try {
      console.log(`[FILE-BACKUP] Starting delete operation ${operationId} for ${filePath}`);
      
      // Step 1: Create backup before deletion
      const backupPath = await this.createBackup(absolutePath, operationId);
      console.log(`[FILE-BACKUP] Created backup before delete: ${backupPath}`);
      
      // Step 2: Record operation
      const operation: FileOperation = {
        operationId,
        originalPath: absolutePath,
        backupPath,
        operation: 'delete',
        timestamp: new Date(),
      };
      this.activeOperations.set(operationId, operation);
      
      // Persist metadata for crash recovery
      await this.persistRollbackMetadata();
      
      // Step 3: Delete the file
      await fs.unlink(absolutePath);
      
      console.log(`[FILE-BACKUP] ✅ Delete successful: ${filePath}`);
      
      // Step 4: Operation successful - remove from active operations
      this.activeOperations.delete(operationId);
      
      // Step 5: Update rollback metadata (CRITICAL: prevent erroneous restoration on crash)
      await this.persistRollbackMetadata();
      
      return { success: true, operationId };
      
    } catch (error: any) {
      console.error(`[FILE-BACKUP] ❌ Delete failed for ${filePath}:`, error.message);
      
      // AUTO-ROLLBACK: Restore from backup
      await this.rollbackOperation(operationId);
      
      return {
        success: false,
        operationId,
        error: error.message,
      };
    }
  }
  
  /**
   * Rollback a specific operation by restoring from backup
   */
  async rollbackOperation(operationId: string): Promise<boolean> {
    // CRITICAL: Wait for crash recovery to complete before operations
    await this.ready;
    
    const operation = this.activeOperations.get(operationId);
    
    if (!operation) {
      console.warn(`[FILE-BACKUP] No operation found to rollback: ${operationId}`);
      return false;
    }
    
    if (!operation.backupPath) {
      console.log(`[FILE-BACKUP] No backup exists for operation ${operationId} - nothing to rollback`);
      this.activeOperations.delete(operationId);
      // CRITICAL: Always persist metadata after mutating activeOperations
      await this.persistRollbackMetadata();
      return true;
    }
    
    try {
      console.log(`[FILE-BACKUP] Rolling back operation ${operationId}...`);
      
      // Restore from backup
      await fs.copyFile(operation.backupPath, operation.originalPath);
      
      console.log(`[FILE-BACKUP] ✅ Rollback successful: ${operation.originalPath} restored from ${operation.backupPath}`);
      
      // Clean up
      this.activeOperations.delete(operationId);
      
      // Update metadata
      await this.persistRollbackMetadata();
      
      return true;
    } catch (error: any) {
      console.error(`[FILE-BACKUP] ❌ Rollback failed for ${operationId}:`, error.message);
      return false;
    }
  }
  
  /**
   * Rollback all active operations (crash recovery)
   * Called when session crashes mid-operation
   */
  async rollbackAllActiveOperations(): Promise<RollbackResult> {
    // CRITICAL: Wait for crash recovery to complete before operations
    await this.ready;
    
    const restoredFiles: string[] = [];
    const errors: string[] = [];
    
    console.log(`[FILE-BACKUP] Rolling back ${this.activeOperations.size} active operations...`);
    
    for (const [operationId, operation] of Array.from(this.activeOperations.entries())) {
      try {
        if (operation.backupPath) {
          await fs.copyFile(operation.backupPath, operation.originalPath);
          restoredFiles.push(operation.originalPath);
          console.log(`[FILE-BACKUP] Restored: ${operation.originalPath}`);
        }
        this.activeOperations.delete(operationId);
      } catch (error: any) {
        errors.push(`${operation.originalPath}: ${error.message}`);
      }
    }
    
    console.log(`[FILE-BACKUP] Rollback complete: ${restoredFiles.length} restored, ${errors.length} errors`);
    
    // Update metadata after rollback
    await this.persistRollbackMetadata();
    
    return {
      success: errors.length === 0,
      restoredFiles,
      errors,
    };
  }
  
  /**
   * BRAIN-GAP-3 FIX: Startup crash recovery
   * Checks for unfinished operations in .temp/ and restores them
   */
  private async performStartupCrashRecovery(): Promise<void> {
    try {
      console.log('[FILE-BACKUP-RECOVERY] Checking for unfinished operations from crash...');
      
      // Load rollback metadata if exists
      const metadata = await this.loadRollbackMetadata();
      
      if (metadata.length === 0) {
        console.log('[FILE-BACKUP-RECOVERY] No unfinished operations found');
        return;
      }
      
      console.log(`[FILE-BACKUP-RECOVERY] Found ${metadata.length} unfinished operations - attempting recovery...`);
      
      let recovered = 0;
      for (const op of metadata) {
        try {
          if (op.backupPath && await this.fileExists(op.backupPath)) {
            // Restore from backup
            await fs.copyFile(op.backupPath, op.originalPath);
            console.log(`[FILE-BACKUP-RECOVERY] ✅ Restored ${op.originalPath} from crash backup`);
            recovered++;
          }
        } catch (error: any) {
          console.error(`[FILE-BACKUP-RECOVERY] Failed to restore ${op.originalPath}:`, error.message);
        }
      }
      
      // Clear metadata after recovery
      await this.clearRollbackMetadata();
      
      console.log(`[FILE-BACKUP-RECOVERY] Crash recovery complete: ${recovered}/${metadata.length} files restored`);
      
    } catch (error: any) {
      console.error('[FILE-BACKUP-RECOVERY] Startup crash recovery failed:', error.message);
    }
  }
  
  /**
   * Persist rollback metadata for crash recovery
   */
  private async persistRollbackMetadata(): Promise<void> {
    try {
      const operations = Array.from(this.activeOperations.values());
      await fs.writeFile(
        ROLLBACK_METADATA_FILE,
        JSON.stringify(operations, null, 2),
        'utf-8'
      );
    } catch (error: any) {
      console.error('[FILE-BACKUP] Failed to persist rollback metadata:', error.message);
    }
  }
  
  /**
   * Load rollback metadata for crash recovery
   */
  private async loadRollbackMetadata(): Promise<FileOperation[]> {
    try {
      const data = await fs.readFile(ROLLBACK_METADATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return []; // No metadata file - clean start
    }
  }
  
  /**
   * Clear rollback metadata after successful recovery
   */
  private async clearRollbackMetadata(): Promise<void> {
    try {
      await fs.unlink(ROLLBACK_METADATA_FILE);
    } catch {
      // File doesn't exist - OK
    }
  }
  
  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Commit operations - clean up backups after successful completion
   */
  async commitOperations(operationIds: string[]): Promise<void> {
    // CRITICAL: Wait for crash recovery to complete before operations
    await this.ready;
    
    console.log(`[FILE-BACKUP] Committing ${operationIds.length} operations...`);
    
    for (const operationId of operationIds) {
      const operation = this.activeOperations.get(operationId);
      if (operation?.backupPath) {
        try {
          await fs.unlink(operation.backupPath);
          console.log(`[FILE-BACKUP] Cleaned up backup: ${operation.backupPath}`);
        } catch (error: any) {
          console.warn(`[FILE-BACKUP] Failed to clean backup: ${error.message}`);
        }
      }
      this.activeOperations.delete(operationId);
    }
    
    // Update metadata after committing
    await this.persistRollbackMetadata();
  }
  
  /**
   * Get all active operations (for debugging/monitoring)
   */
  async getActiveOperations(): Promise<FileOperation[]> {
    // CRITICAL: Wait for crash recovery to complete before operations
    await this.ready;
    
    return Array.from(this.activeOperations.values());
  }
  
  /**
   * Clean up old backups (older than 24 hours)
   */
  async cleanupOldBackups(): Promise<number> {
    // CRITICAL: Wait for crash recovery to complete before operations
    await this.ready;
    
    try {
      await this.ensureTempDir();
      const files = await fs.readdir(TEMP_BACKUP_DIR);
      const now = Date.now();
      const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
      let cleaned = 0;
      
      for (const file of files) {
        const filePath = path.join(TEMP_BACKUP_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > MAX_AGE_MS) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`[FILE-BACKUP] Cleaned up ${cleaned} old backups`);
      }
      
      return cleaned;
    } catch (error: any) {
      console.error('[FILE-BACKUP] Error cleaning old backups:', error.message);
      return 0;
    }
  }
  
  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================
  
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(TEMP_BACKUP_DIR, { recursive: true });
    } catch (error: any) {
      console.error('[FILE-BACKUP] Failed to create temp directory:', error.message);
    }
  }
  
  private async createBackup(filePath: string, operationId: string): Promise<string> {
    await this.ensureTempDir();
    
    const fileName = path.basename(filePath);
    const timestamp = Date.now();
    const backupFileName = `${timestamp}-${operationId}-${fileName}`;
    const backupPath = path.join(TEMP_BACKUP_DIR, backupFileName);
    
    // Copy file to backup location
    await fs.copyFile(filePath, backupPath);
    
    return backupPath;
  }
}

// Export singleton instance
export const fileBackupService = new FileOperationsWithBackup();

// Cleanup old backups every hour
setInterval(() => {
  fileBackupService.cleanupOldBackups();
}, 60 * 60 * 1000);
