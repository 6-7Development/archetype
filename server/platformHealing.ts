import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getGitHubService, isGitHubServiceAvailable } from './githubService';
import { storage } from './storage';

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

      // Check if git is available and this is a git repository
      try {
        const { stdout: branches } = await execFileAsync('git', ['branch', '--list'], { cwd: this.PROJECT_ROOT });
        if (!branches.includes(branchName)) {
          throw new Error(`Backup branch ${branchName} not found`);
        }

        await execFileAsync('git', ['stash'], { cwd: this.PROJECT_ROOT });
        
        await execFileAsync('git', ['reset', '--hard', branchName], { cwd: this.PROJECT_ROOT });

        console.log(`[PLATFORM-ROLLBACK] ✅ Rolled back to backup: ${sanitizedId}`);
      } catch (gitError: any) {
        // Handle git not installed
        if (gitError.code === 'ENOENT') {
          console.warn('[PLATFORM-ROLLBACK] ⚠️ Git not installed - rollback not possible');
          throw new Error('Rollback requires git, which is not installed in this environment');
        }
        // Handle not a git repository (Docker containers in production)
        if (gitError.code === 128 || gitError.message?.includes('not a git repository')) {
          console.warn('[PLATFORM-ROLLBACK] ⚠️ Not a git repository - rollback not possible in production');
          console.warn('[PLATFORM-ROLLBACK] Production deployments use GitHub API for changes');
          throw new Error('Rollback is not available in production. Use GitHub API to revert changes.');
        }
        throw gitError;
      }
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
      // Gracefully handle git not being available
      if (error.code === 'ENOENT') {
        console.warn('[PLATFORM-BACKUP] ⚠️ Git not available - cannot list backups');
        return [];
      }
      console.error('[PLATFORM-BACKUP] List backups failed:', error);
      return [];
    }
  }

  async listPlatformDirectory(directory: string = '.'): Promise<Array<{ name: string; type: 'file' | 'dir' }>> {
    try {
      if (path.isAbsolute(directory)) {
        throw new Error('Absolute paths are not allowed');
      }
      
      const fullPath = path.resolve(this.PROJECT_ROOT, directory);
      
      if (!fullPath.startsWith(this.PROJECT_ROOT + path.sep) && fullPath !== this.PROJECT_ROOT) {
        throw new Error('Invalid directory path - path traversal detected');
      }

      // Check if directory exists
      try {
        await fs.access(fullPath);
      } catch (error: any) {
        // Directory doesn't exist - in production, fetch from GitHub for source directories
        if (process.env.NODE_ENV === 'production' && (directory.startsWith('client/') || directory === 'client')) {
          console.log(`[PLATFORM-LIST-DIR] 🔄 Source directory not in production build, fetching from GitHub: ${directory}`);
          
          if (!isGitHubServiceAvailable()) {
            throw new Error(`Directory "${directory}" not available in production build and GitHub service not configured`);
          }
          
          const githubService = getGitHubService();
          const entries = await githubService.listDirectoryEntries(directory);
          console.log(`[PLATFORM-LIST-DIR] ✅ Fetched ${entries.length} entries from GitHub directory: ${directory}`);
          return entries;
        } else if (process.env.NODE_ENV === 'production') {
          console.warn(`[PLATFORM-LIST-DIR] ⚠️ Directory not found in production: ${directory}`);
          return [];
        }
        throw new Error(`Directory not found: ${directory}`);
      }

      // Local filesystem - return immediate children with type metadata
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      return entries
        .filter(entry => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'dir' as const : 'file' as const
        }));
    } catch (error: any) {
      throw new Error(`Failed to list directory: ${error.message}`);
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

      // Try filesystem first
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        return content;
      } catch (fsError: any) {
        // In production, if file is in client/ (source files), fetch from GitHub
        if (process.env.NODE_ENV === 'production' && filePath.startsWith('client/')) {
          console.log(`[PLATFORM-READ] 🔄 Source file not in production build, fetching from GitHub: ${filePath}`);
          
          if (!isGitHubServiceAvailable()) {
            throw new Error(`File not found in production build and GitHub service not available: ${filePath}`);
          }
          
          const githubService = getGitHubService();
          const content = await githubService.getFileContent(filePath);
          console.log(`[PLATFORM-READ] ✅ Fetched ${filePath} from GitHub (${content.length} bytes)`);
          return content;
        }
        
        // Otherwise, throw the original error
        throw fsError;
      }
    } catch (error: any) {
      throw new Error(`Failed to read platform file ${filePath}: ${error.message}`);
    }
  }

  async writePlatformFile(filePath: string, content: string): Promise<{ success: boolean; message: string; commitHash?: string; commitUrl?: string }> {
    // CRITICAL: Validate content before ANY processing
    if (content === undefined || content === null) {
      console.error(`[PLATFORM-WRITE] ❌ REJECTED: undefined/null content for ${filePath}`);
      throw new Error(`Cannot write file with undefined or null content: ${filePath}`);
    }
    
    if (typeof content !== 'string') {
      console.error(`[PLATFORM-WRITE] ❌ REJECTED: non-string content (${typeof content}) for ${filePath}`);
      throw new Error(`Content must be a string, got ${typeof content}: ${filePath}`);
    }
    
    // Log validated content
    console.log(`[PLATFORM-WRITE] ✅ Content validated for ${filePath}`);
    console.log(`[PLATFORM-WRITE] Content length: ${content.length} bytes`);
    console.log(`[PLATFORM-WRITE] Content type: ${typeof content}`);
    
    // Validate file path
    if (path.isAbsolute(filePath)) {
      throw new Error('Absolute paths are not allowed');
    }
    
    const fullPath = path.resolve(this.PROJECT_ROOT, filePath);
    
    if (!fullPath.startsWith(this.PROJECT_ROOT + path.sep) && fullPath !== this.PROJECT_ROOT) {
      throw new Error('Invalid file path - path traversal detected');
    }

    // Dangerous files that should never be modified by SySop
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

    // PRODUCTION MODE: Check maintenance mode and use GitHub service
    if (process.env.NODE_ENV === 'production') {
      // Check maintenance mode status
      const maintenanceMode = await storage.getMaintenanceMode();
      
      if (!maintenanceMode.enabled) {
        throw new Error(
          `❌ PLATFORM MODIFICATIONS DISABLED IN PRODUCTION\n\n` +
          `Platform file writes require MAINTENANCE MODE to be enabled.\n\n` +
          `Why maintenance mode is required:\n` +
          `• Render uses ephemeral containers - direct file changes are lost on restart\n` +
          `• Changes must be committed to GitHub to persist\n` +
          `• Auto-deployment will apply changes to production\n\n` +
          `To enable platform modifications:\n` +
          `1. Ask the platform owner to enable maintenance mode\n` +
          `2. Maintenance mode commits changes directly to GitHub\n` +
          `3. Render auto-deploys from GitHub commits\n\n` +
          `Attempted to modify: ${filePath}`
        );
      }

      // Check if GitHub service is configured
      if (!isGitHubServiceAvailable()) {
        throw new Error(
          `❌ GITHUB SERVICE NOT CONFIGURED\n\n` +
          `Maintenance mode is enabled, but GitHub integration is missing.\n\n` +
          `Required environment variables:\n` +
          `• GITHUB_TOKEN - GitHub personal access token with repo permissions\n` +
          `• GITHUB_REPO - Repository in format "username/repo-name"\n` +
          `• GITHUB_BRANCH - Target branch (default: "main")\n\n` +
          `Contact the platform owner to configure GitHub integration.`
        );
      }

      // Validate content before committing
      if (content === undefined || content === null) {
        throw new Error(`Cannot commit file with undefined or null content: ${filePath}`);
      }

      // Use GitHub service to commit the file
      try {
        const githubService = getGitHubService();
        const commitMessage = `Update ${filePath} via Platform-SySop`;
        
        console.log(`[PLATFORM-WRITE] 🔧 Committing to GitHub: ${filePath}`);
        console.log(`[PLATFORM-WRITE] Maintenance mode: ENABLED`);
        console.log(`[PLATFORM-WRITE] Reason: ${maintenanceMode.reason}`);
        console.log(`[PLATFORM-WRITE] Content to commit: ${content.length} bytes`);
        
        const result = await githubService.commitFile(filePath, content, commitMessage);
        
        console.log(`[PLATFORM-WRITE] ✅ Committed to GitHub successfully`);
        console.log(`[PLATFORM-WRITE] Commit: ${result.commitHash}`);
        console.log(`[PLATFORM-WRITE] URL: ${result.commitUrl}`);
        console.log(`[PLATFORM-WRITE] ⏳ Render will auto-deploy from GitHub...`);
        
        return {
          success: true,
          message: `File committed to GitHub successfully. Render will auto-deploy shortly.`,
          commitHash: result.commitHash,
          commitUrl: result.commitUrl,
        };
      } catch (error: any) {
        console.error('[PLATFORM-WRITE] ❌ GitHub commit failed:', error);
        throw new Error(`Failed to commit to GitHub: ${error.message}`);
      }
    }
    
    // DEVELOPMENT MODE: Write directly to filesystem
    try {
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(fullPath, content, 'utf-8');

      console.log(`[PLATFORM-HEAL] Wrote platform file: ${filePath}`);
      
      return {
        success: true,
        message: `File written successfully in development mode.`,
      };
    } catch (error: any) {
      throw new Error(`Failed to write platform file ${filePath}: ${error.message}`);
    }
  }

  async createPlatformFile(filePath: string, content: string): Promise<{ success: boolean; message: string; commitHash?: string; commitUrl?: string }> {
    // CRITICAL: Validate content before ANY processing
    if (content === undefined || content === null) {
      console.error(`[PLATFORM-CREATE] ❌ REJECTED: undefined/null content for ${filePath}`);
      throw new Error(`Cannot create file with undefined or null content: ${filePath}`);
    }
    
    if (typeof content !== 'string') {
      console.error(`[PLATFORM-CREATE] ❌ REJECTED: non-string content (${typeof content}) for ${filePath}`);
      throw new Error(`Content must be a string, got ${typeof content}: ${filePath}`);
    }
    
    // Validate file path
    if (path.isAbsolute(filePath)) {
      throw new Error('Absolute paths are not allowed');
    }
    
    const fullPath = path.resolve(this.PROJECT_ROOT, filePath);
    
    if (!fullPath.startsWith(this.PROJECT_ROOT + path.sep) && fullPath !== this.PROJECT_ROOT) {
      throw new Error('Invalid file path - path traversal detected');
    }

    // Check if file already exists
    try {
      await fs.access(fullPath);
      throw new Error(`File already exists: ${filePath}. Use writePlatformFile to modify existing files.`);
    } catch (error: any) {
      // File doesn't exist - good, we can create it
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Dangerous files that should never be created by SySop
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
      throw new Error(`Creating ${filePath} is not allowed for safety reasons`);
    }

    // PRODUCTION MODE: Check maintenance mode and use GitHub service
    if (process.env.NODE_ENV === 'production') {
      const maintenanceMode = await storage.getMaintenanceMode();
      
      if (!maintenanceMode.enabled) {
        throw new Error(
          `❌ PLATFORM MODIFICATIONS DISABLED IN PRODUCTION\n\n` +
          `Platform file creation requires MAINTENANCE MODE to be enabled.\n\n` +
          `To enable platform modifications:\n` +
          `1. Ask the platform owner to enable maintenance mode\n` +
          `2. Maintenance mode commits changes directly to GitHub\n` +
          `3. Render auto-deploys from GitHub commits\n\n` +
          `Attempted to create: ${filePath}`
        );
      }

      if (!isGitHubServiceAvailable()) {
        throw new Error(
          `❌ GITHUB SERVICE NOT CONFIGURED\n\n` +
          `Maintenance mode is enabled, but GitHub integration is missing.\n\n` +
          `Contact the platform owner to configure GitHub integration.`
        );
      }

      try {
        const githubService = getGitHubService();
        const commitMessage = `Create ${filePath} via Platform-SySop`;
        
        console.log(`[PLATFORM-CREATE] 🔧 Committing to GitHub: ${filePath}`);
        console.log(`[PLATFORM-CREATE] Content to commit: ${content.length} bytes`);
        
        const result = await githubService.commitFile(filePath, content, commitMessage);
        
        console.log(`[PLATFORM-CREATE] ✅ Committed to GitHub successfully`);
        
        return {
          success: true,
          message: `File created and committed to GitHub successfully.`,
          commitHash: result.commitHash,
          commitUrl: result.commitUrl,
        };
      } catch (error: any) {
        console.error('[PLATFORM-CREATE] ❌ GitHub commit failed:', error);
        throw new Error(`Failed to commit to GitHub: ${error.message}`);
      }
    }
    
    // DEVELOPMENT MODE: Write directly to filesystem
    try {
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(fullPath, content, 'utf-8');

      console.log(`[PLATFORM-CREATE] Created platform file: ${filePath}`);
      
      return {
        success: true,
        message: `File created successfully in development mode.`,
      };
    } catch (error: any) {
      throw new Error(`Failed to create platform file ${filePath}: ${error.message}`);
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

      // Helper to recursively collect files from directory entries
      const collectFilesFromGitHub = async (dirPath: string): Promise<string[]> => {
        const githubService = getGitHubService();
        const entries = await githubService.listDirectoryEntries(dirPath);
        const files: string[] = [];
        
        for (const entry of entries) {
          const relativePath = dirPath ? `${dirPath}/${entry.name}` : entry.name;
          
          if (entry.type === 'file') {
            files.push(relativePath);
          } else if (entry.type === 'dir') {
            // Recursively collect files from subdirectory
            const subFiles = await collectFilesFromGitHub(relativePath);
            files.push(...subFiles);
          }
        }
        
        return files;
      };

      // Check if directory exists (especially important in production where client/ doesn't exist)
      try {
        await fs.access(fullPath);
      } catch (error: any) {
        // Directory doesn't exist - in production, fetch from GitHub for source directories
        if (process.env.NODE_ENV === 'production' && (directory.startsWith('client/') || directory === 'client')) {
          console.log(`[PLATFORM-LIST] 🔄 Source directory not in production build, fetching from GitHub: ${directory}`);
          
          if (!isGitHubServiceAvailable()) {
            throw new Error(`Directory "${directory}" not available in production build and GitHub service not configured`);
          }
          
          const files = await collectFilesFromGitHub(directory);
          console.log(`[PLATFORM-LIST] ✅ Fetched ${files.length} files from GitHub directory: ${directory}`);
          return files;
        } else if (process.env.NODE_ENV === 'production') {
          console.warn(`[PLATFORM-LIST] ⚠️ Directory not found in production: ${directory}`);
          return [];
        }
        throw new Error(`Directory not found: ${directory}`);
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
    // PRODUCTION MODE: Use GitHub service
    if (process.env.NODE_ENV === 'production') {
      if (!isGitHubServiceAvailable()) {
        throw new Error('GitHub service not configured for production commits');
      }

      try {
        const githubService = getGitHubService();
        
        // Map changes to file changes with content
        // Include creates/modifies (with contentAfter) and deletes (without content)
        const fileChanges = changes
          .filter(c => {
            // Include deletes
            if (c.operation === 'delete') return true;
            // Include creates/modifies with valid contentAfter
            if ((c.operation === 'create' || c.operation === 'modify') && c.contentAfter !== undefined && c.contentAfter !== null) return true;
            return false;
          })
          .map(c => {
            // For deletes, omit content entirely
            if (c.operation === 'delete') {
              return {
                path: c.path,
                operation: c.operation
              };
            }
            // For creates/modifies, include content
            return {
              path: c.path,
              content: c.contentAfter!,
              operation: c.operation
            };
          });
        
        if (fileChanges.length === 0) {
          console.log('[PLATFORM-HEAL] No file modifications to commit');
          return '';
        }

        console.log(`[PLATFORM-HEAL] Committing ${fileChanges.length} file(s) to GitHub...`);
        
        const commitMessage = `${message}\n\nChanges:\n${changes.map(c => `- ${c.operation} ${c.path}`).join('\n')}`;
        
        const result = await githubService.commitFiles(fileChanges, commitMessage);
        
        console.log(`[PLATFORM-HEAL] ✅ Committed to GitHub: ${result.commitHash}`);
        
        return result.commitHash;
      } catch (error: any) {
        console.error('[PLATFORM-HEAL] ❌ GitHub commit failed:', error);
        throw new Error(`Failed to commit to GitHub: ${error.message}`);
      }
    }

    // DEVELOPMENT MODE: Use local git
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

  async previewWrite(filePath: string, newContent: string): Promise<string> {
    try {
      // Try to read current file content
      let currentContent = '';
      try {
        currentContent = await this.readPlatformFile(filePath);
      } catch (error: any) {
        // File doesn't exist - this is a new file
        currentContent = '';
      }

      // Generate simple line-by-line diff
      return this.generateDiff(filePath, currentContent, newContent);
    } catch (error: any) {
      console.error('[PLATFORM-PREVIEW] Failed to generate diff:', error);
      return `Error generating diff: ${error.message}`;
    }
  }

  private generateDiff(filePath: string, oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const diffLines: string[] = [];
    diffLines.push(`--- ${filePath} (before)`);
    diffLines.push(`+++ ${filePath} (after)`);
    diffLines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);

    // Simple diff: show all old lines as removed, all new lines as added
    // This is not a perfect diff algorithm but works for preview purposes
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine !== undefined && newLine !== undefined) {
        if (oldLine === newLine) {
          // Line unchanged
          diffLines.push(` ${oldLine}`);
        } else {
          // Line changed
          diffLines.push(`-${oldLine}`);
          diffLines.push(`+${newLine}`);
        }
      } else if (oldLine !== undefined) {
        // Line removed
        diffLines.push(`-${oldLine}`);
      } else if (newLine !== undefined) {
        // Line added
        diffLines.push(`+${newLine}`);
      }
    }

    return diffLines.join('\n');
  }

  async validateSafety(): Promise<{ safe: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check diff for dangerous patterns (works in both dev and production)
      const diff = await this.getDiff();

      if (diff.includes('DATABASE_URL') || diff.includes('ANTHROPIC_API_KEY')) {
        issues.push('Changes appear to expose secrets');
      }

      if (diff.includes('DROP TABLE') || diff.includes('DELETE FROM')) {
        issues.push('Changes contain destructive database operations');
      }

      // Git-specific checks (only in development where .git exists)
      try {
        const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], { cwd: this.PROJECT_ROOT });
        const modifiedFiles = status.split('\n').filter(l => l.trim());
        
        if (modifiedFiles.some(f => f.includes('.git/'))) {
          issues.push('Changes attempt to modify .git directory');
        }
      } catch (gitError: any) {
        // Git not available (production) - skip git-specific checks
        if (!gitError.message?.includes('not a git repository')) {
          console.warn('[SAFETY] Git check failed:', gitError.message);
        }
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
