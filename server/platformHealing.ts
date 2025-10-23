import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execFileAsync = promisify(execFile);

// Get the project root directory reliably in both development and production
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In dev: __dirname = /path/to/project/server, so go up 1 level
// In prod: __dirname = /path/to/project/dist, so go up 1 level  
const PROJECT_ROOT = path.resolve(__dirname, '..');

interface PlatformBackup {
  id: string;
  timestamp: string;
  commitHash: string;
  branch: string;
  description: string;
}

interface FileChange {
  path: string;
  operation: 'create' | 'modify' | 'delete';
  contentBefore?: string;
  contentAfter?: string;
}

export class PlatformHealingService {
  private readonly PROJECT_ROOT = PROJECT_ROOT;
  private readonly BACKUP_BRANCH_PREFIX = 'backup/meta-sysop-';
  
  constructor() {
    // Log PROJECT_ROOT for debugging
    console.log(`[PLATFORM-HEALING] PROJECT_ROOT: ${this.PROJECT_ROOT}`);
  }
  
  private sanitizeBackupId(backupId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(backupId)) {
      throw new Error('Invalid backup ID format');
    }
    return backupId;
  }

  async createBackup(description: string): Promise<PlatformBackup> {
    try {
      const timestamp = new Date().toISOString();
      const backupId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const branchName = `${this.BACKUP_BRANCH_PREFIX}${backupId}`;

      // Try git operations, but don't fail if git unavailable
      try {
        await execFileAsync('git', ['add', '-A'], { cwd: this.PROJECT_ROOT });
        
        const commitMessage = `[Meta-SySop Backup] ${description}`;
        
        try {
          await execFileAsync('git', [
            '-c', 'user.name=Meta-SySop',
            '-c', 'user.email=meta-sysop@archetype.platform',
            'commit', '-m', commitMessage
          ], { cwd: this.PROJECT_ROOT });
        } catch (commitError: any) {
          if (commitError.message.includes('nothing to commit')) {
            console.log('[PLATFORM-BACKUP] No changes to commit');
          } else {
            throw commitError;
          }
        }
        
        const { stdout: commitHash } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: this.PROJECT_ROOT });
        await execFileAsync('git', ['branch', branchName], { cwd: this.PROJECT_ROOT });

        console.log(`[PLATFORM-BACKUP] ✅ Created backup: ${backupId}`);

        return {
          id: backupId,
          timestamp,
          commitHash: commitHash.trim(),
          branch: branchName,
          description,
        };
      } catch (gitError: any) {
        // Git not available (Render) - create dummy backup and continue
        console.warn(`[PLATFORM-BACKUP] ⚠️ Git unavailable, skipping backup: ${gitError.message}`);
        return {
          id: backupId,
          timestamp,
          commitHash: 'no-git',
          branch: 'no-git',
          description: `${description} (git unavailable)`,
        };
      }
    } catch (error: any) {
      console.error('[PLATFORM-BACKUP] ❌ Backup system error:', error);
      // Return dummy backup instead of throwing
      return {
        id: `fallback-${Date.now()}`,
        timestamp: new Date().toISOString(),
        commitHash: 'error',
        branch: 'error',
        description: `Backup failed: ${error.message}`,
      };
    }
  }

  async rollback(backupId: string): Promise<void> {
    try {
      const sanitizedId = this.sanitizeBackupId(backupId);
      const branchName = `${this.BACKUP_BRANCH_PREFIX}${sanitizedId}`;

      const { stdout: branches } = await execFileAsync('git', ['branch', '--list'], { cwd: this.PROJECT_ROOT });
      if (!branches.includes(branchName)) {
        throw new Error(`Backup branch ${branchName} not found`);
      }

      await execFileAsync('git', ['stash'], { cwd: this.PROJECT_ROOT });
      
      await execFileAsync('git', ['reset', '--hard', branchName], { cwd: this.PROJECT_ROOT });

      console.log(`[PLATFORM-ROLLBACK] Rolled back to backup: ${sanitizedId}`);
    } catch (error: any) {
      console.error('[PLATFORM-ROLLBACK] Rollback failed:', error);
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  async listBackups(): Promise<PlatformBackup[]> {
    try {
      const { stdout } = await execFileAsync('git', ['branch', '--list'], { cwd: this.PROJECT_ROOT });
      const backupBranches = stdout
        .split('\n')
        .map(b => b.trim())
        .filter(b => b.startsWith(this.BACKUP_BRANCH_PREFIX));

      const backups: PlatformBackup[] = [];
      for (const branch of backupBranches) {
        const backupId = branch.replace(this.BACKUP_BRANCH_PREFIX, '');
        const { stdout: commitHash } = await execFileAsync('git', ['rev-parse', branch], { cwd: this.PROJECT_ROOT });
        const { stdout: commitMsg } = await execFileAsync('git', ['log', '-1', '--pretty=%B', branch], { cwd: this.PROJECT_ROOT });

        backups.push({
          id: backupId,
          timestamp: new Date().toISOString(),
          commitHash: commitHash.trim(),
          branch,
          description: commitMsg.trim(),
        });
      }

      return backups;
    } catch (error: any) {
      console.error('[PLATFORM-BACKUP] List backups failed:', error);
      return [];
    }
  }

  async readPlatformFile(filePath: string): Promise<string> {
    try {
      if (path.isAbsolute(filePath)) {
        throw new Error('Absolute paths are not allowed');
      }
      
      const fullPath = path.resolve(this.PROJECT_ROOT, filePath);
      
      if (!fullPath.startsWith(this.PROJECT_ROOT + path.sep) && fullPath !== this.PROJECT_ROOT) {
        throw new Error('Invalid file path - path traversal detected');
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      throw new Error(`Failed to read platform file ${filePath}: ${error.message}`);
    }
  }

  async writePlatformFile(filePath: string, content: string): Promise<void> {
    // CRITICAL: Platform modifications are DISABLED in production (Render)
    // Render has an ephemeral filesystem - changes are lost on container restart
    // Users must use local development environment for platform modifications
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `❌ PLATFORM MODIFICATIONS DISABLED IN PRODUCTION\n\n` +
        `Platform file writes are disabled on Render because:\n` +
        `• Render uses ephemeral containers - file changes are lost on restart\n` +
        `• The real codebase is in GitHub, not on this running server\n` +
        `• Changes here won't persist or affect the actual platform\n\n` +
        `To modify Archetype's code:\n` +
        `1. Clone the repository locally\n` +
        `2. Run in development mode (npm run dev)\n` +
        `3. Make changes and push to GitHub\n` +
        `4. Redeploy on Render to apply changes\n\n` +
        `Attempted to modify: ${filePath}`
      );
    }
    
    try {
      if (path.isAbsolute(filePath)) {
        throw new Error('Absolute paths are not allowed');
      }
      
      const fullPath = path.resolve(this.PROJECT_ROOT, filePath);
      
      if (!fullPath.startsWith(this.PROJECT_ROOT + path.sep) && fullPath !== this.PROJECT_ROOT) {
        throw new Error('Invalid file path - path traversal detected');
      }

      const dangerousPatterns = [
        /\.git\//,
        /node_modules\//,
        /\.env$/,
        /package\.json$/,
        /package-lock\.json$/,
        /vite\.config\.ts$/,
        /server\/vite\.ts$/,
        /drizzle\.config\.ts$/,
      ];

      if (dangerousPatterns.some(pattern => pattern.test(filePath))) {
        throw new Error(`Modifying ${filePath} is not allowed for safety reasons`);
      }

      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(fullPath, content, 'utf-8');

      console.log(`[PLATFORM-HEAL] Wrote platform file: ${filePath}`);
    } catch (error: any) {
      throw new Error(`Failed to write platform file ${filePath}: ${error.message}`);
    }
  }

  async deletePlatformFile(filePath: string): Promise<void> {
    // CRITICAL: Platform modifications are DISABLED in production (Render)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `❌ PLATFORM MODIFICATIONS DISABLED IN PRODUCTION\n\n` +
        `Platform file operations are disabled on Render.\n` +
        `Use local development environment to modify Archetype's codebase.\n\n` +
        `Attempted to delete: ${filePath}`
      );
    }
    
    try {
      if (path.isAbsolute(filePath)) {
        throw new Error('Absolute paths are not allowed');
      }
      
      const fullPath = path.resolve(this.PROJECT_ROOT, filePath);
      
      if (!fullPath.startsWith(this.PROJECT_ROOT + path.sep) && fullPath !== this.PROJECT_ROOT) {
        throw new Error('Invalid file path - path traversal detected');
      }

      const dangerousPatterns = [
        /\.git\//,
        /node_modules\//,
        /\.env$/,
        /package\.json$/,
        /package-lock\.json$/,
        /vite\.config\.ts$/,
        /server\/vite\.ts$/,
        /drizzle\.config\.ts$/,
      ];

      if (dangerousPatterns.some(pattern => pattern.test(filePath))) {
        throw new Error(`Deleting ${filePath} is not allowed for safety reasons`);
      }

      await fs.unlink(fullPath);

      console.log(`[PLATFORM-HEAL] Deleted platform file: ${filePath}`);
    } catch (error: any) {
      throw new Error(`Failed to delete platform file ${filePath}: ${error.message}`);
    }
  }

  async listPlatformFiles(directory: string = '.'): Promise<string[]> {
    try {
      if (path.isAbsolute(directory)) {
        throw new Error('Absolute paths are not allowed');
      }
      
      const fullPath = path.resolve(this.PROJECT_ROOT, directory);
      
      if (!fullPath.startsWith(this.PROJECT_ROOT + path.sep) && fullPath !== this.PROJECT_ROOT) {
        throw new Error('Invalid directory path - path traversal detected');
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      const files: string[] = [];
      for (const entry of entries) {
        const relativePath = path.join(directory, entry.name);
        
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          const subFiles = await this.listPlatformFiles(relativePath);
          files.push(...subFiles);
        } else {
          files.push(relativePath);
        }
      }

      return files;
    } catch (error: any) {
      throw new Error(`Failed to list platform files: ${error.message}`);
    }
  }

  async commitChanges(message: string, changes: FileChange[]): Promise<string> {
    try {
      await execFileAsync('git', ['add', '-A'], { cwd: this.PROJECT_ROOT });

      const commitMessage = `[Meta-SySop] ${message}\n\nChanges:\n${changes.map(c => `- ${c.operation} ${c.path}`).join('\n')}`;

      await execFileAsync('git', [
        '-c', 'user.name=Meta-SySop',
        '-c', 'user.email=meta-sysop@archetype.platform',
        'commit', '-m', commitMessage
      ], { cwd: this.PROJECT_ROOT });

      const { stdout: commitHash } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: this.PROJECT_ROOT });

      console.log(`[PLATFORM-HEAL] Auto-committed changes: ${commitHash.trim()}`);

      return commitHash.trim();
    } catch (error: any) {
      if (error.message.includes('nothing to commit')) {
        console.log('[PLATFORM-HEAL] No changes to commit');
        return '';
      }
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }

  async pushToRemote(): Promise<void> {
    try {
      await execFileAsync('git', ['push', 'origin', 'main'], { cwd: this.PROJECT_ROOT });
      console.log('[PLATFORM-HEAL] Pushed changes to remote (will trigger Render deployment)');
    } catch (error: any) {
      throw new Error(`Failed to push to remote: ${error.message}`);
    }
  }

  async getDiff(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['diff'], { cwd: this.PROJECT_ROOT });
      return stdout;
    } catch (error: any) {
      return '';
    }
  }

  async validateSafety(): Promise<{ safe: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const diff = await this.getDiff();

      if (diff.includes('DATABASE_URL') || diff.includes('ANTHROPIC_API_KEY')) {
        issues.push('Changes appear to expose secrets');
      }

      if (diff.includes('DROP TABLE') || diff.includes('DELETE FROM')) {
        issues.push('Changes contain destructive database operations');
      }

      const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], { cwd: this.PROJECT_ROOT });
      const modifiedFiles = status.split('\n').filter(l => l.trim());
      
      if (modifiedFiles.some(f => f.includes('.git/'))) {
        issues.push('Changes attempt to modify .git directory');
      }

      return {
        safe: issues.length === 0,
        issues,
      };
    } catch (error: any) {
      issues.push(`Safety validation failed: ${error.message}`);
      return { safe: false, issues };
    }
  }
}

export const platformHealing = new PlatformHealingService();
