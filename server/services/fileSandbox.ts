import { db } from '../db';
import { projectSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File Sandbox Manager - Isolates file operations to active project
 * Prevents cross-project data leakage
 */
class FileSandboxManager {
  /**
   * Get the upload path for a project
   */
  getProjectPath(projectId: string): string {
    return path.join(process.cwd(), 'uploads', projectId);
  }

  /**
   * Get the user's active project ID
   */
  async getActiveProjectId(userId: string): Promise<string | null> {
    const [session] = await db
      .select()
      .from(projectSessions)
      .where(eq(projectSessions.userId, userId))
      .limit(1);

    return session?.activeProjectId || null;
  }

  /**
   * Validate that a file path belongs to the user's active project
   */
  async validateAccess(userId: string, filePath: string): Promise<boolean> {
    const activeProjectId = await this.getActiveProjectId(userId);
    
    if (!activeProjectId) {
      console.warn('[FILE-SANDBOX] No active project for user:', userId);
      return false;
    }

    const projectPath = this.getProjectPath(activeProjectId);
    const normalizedPath = path.normalize(filePath);
    const normalizedProjectPath = path.normalize(projectPath);

    // Ensure file path is within project directory
    const isWithinProject = normalizedPath.startsWith(normalizedProjectPath);
    
    if (!isWithinProject) {
      console.warn('[FILE-SANDBOX] Access denied - file outside project:', {
        userId,
        activeProjectId,
        filePath,
        projectPath,
      });
    }

    return isWithinProject;
  }

  /**
   * Safely read a file from user's active project
   */
  async readFile(userId: string, filePath: string): Promise<string> {
    const hasAccess = await this.validateAccess(userId, filePath);
    
    if (!hasAccess) {
      throw new Error('Access denied: File is not in your active project');
    }

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error: any) {
      console.error('[FILE-SANDBOX] Error reading file:', error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Safely write a file to user's active project
   */
  async writeFile(userId: string, filePath: string, content: string): Promise<void> {
    const hasAccess = await this.validateAccess(userId, filePath);
    
    if (!hasAccess) {
      throw new Error('Access denied: Cannot write file outside your active project');
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, content, 'utf-8');
      console.log('[FILE-SANDBOX] File written:', filePath);
    } catch (error: any) {
      console.error('[FILE-SANDBOX] Error writing file:', error);
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Safely delete a file from user's active project
   */
  async deleteFile(userId: string, filePath: string): Promise<void> {
    const hasAccess = await this.validateAccess(userId, filePath);
    
    if (!hasAccess) {
      throw new Error('Access denied: Cannot delete file outside your active project');
    }

    try {
      await fs.unlink(filePath);
      console.log('[FILE-SANDBOX] File deleted:', filePath);
    } catch (error: any) {
      console.error('[FILE-SANDBOX] Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * List files in user's active project directory
   */
  async listFiles(userId: string, directoryPath?: string): Promise<string[]> {
    const activeProjectId = await this.getActiveProjectId(userId);
    
    if (!activeProjectId) {
      throw new Error('No active project');
    }

    const projectPath = this.getProjectPath(activeProjectId);
    const targetPath = directoryPath || projectPath;

    const hasAccess = await this.validateAccess(userId, targetPath);
    if (!hasAccess) {
      throw new Error('Access denied: Directory is not in your active project');
    }

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      return entries.map(entry => entry.name);
    } catch (error: any) {
      console.error('[FILE-SANDBOX] Error listing files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }
}

// Export singleton instance
export const fileSandbox = new FileSandboxManager();
