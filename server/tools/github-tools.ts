/**
 * GitHub Tools - Version control and repository management for BeeHive
 * 
 * These tools allow BeeHive to commit code, create branches, and push to GitHub
 */

import { GitHubService } from '../githubService';
import * as fs from 'fs/promises';
import * as path from 'path';

const PROJECT_ROOT = process.cwd();

/**
 * Commit files to GitHub repository
 * This commits changes directly to the configured branch
 */
export async function commitToGitHub(params: {
  files: Array<{ path: string; content?: string; operation?: 'create' | 'modify' | 'delete' }>;
  message: string;
}): Promise<string> {
  try {
    const { files, message } = params;
    
    if (!files || files.length === 0) {
      return '❌ No files specified for commit';
    }
    
    const github = new GitHubService();
    
    if (!github.isConfigured()) {
      return '❌ GitHub not configured. Please set GITHUB_TOKEN and GITHUB_REPO environment variables.';
    }
    
    // Validate files and read content if not provided
    const fileChanges = await Promise.all(
      files.map(async (file) => {
        // If operation is delete, no content needed
        if (file.operation === 'delete') {
          return {
            path: file.path,
            operation: 'delete' as const,
          };
        }
        
        // If content provided, use it
        if (file.content !== undefined) {
          return {
            path: file.path,
            content: file.content,
            operation: file.operation || 'modify' as const,
          };
        }
        
        // Otherwise, read from filesystem
        const fullPath = path.join(PROJECT_ROOT, file.path);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          return {
            path: file.path,
            content,
            operation: file.operation || 'modify' as const,
          };
        } catch (error: any) {
          throw new Error(`Failed to read ${file.path}: ${error.message}`);
        }
      })
    );
    
    const result = await github.commitFiles(fileChanges, message);
    
    return `✅ Successfully committed ${files.length} file(s) to GitHub!
    
Commit: ${result.commitHash}
URL: ${result.commitUrl}

Files committed:
${files.map(f => `  - ${f.path} (${f.operation || 'modify'})`).join('\n')}`;
  } catch (error: any) {
    return `❌ Failed to commit to GitHub: ${error.message}`;
  }
}

/**
 * Create a new branch from main
 */
export async function createGitHubBranch(params: {
  branchName: string;
}): Promise<string> {
  try {
    const { branchName } = params;
    
    const github = new GitHubService();
    
    if (!github.isConfigured()) {
      return '❌ GitHub not configured. Please set GITHUB_TOKEN and GITHUB_REPO environment variables.';
    }
    
    const result = await github.createBranchFromMain(branchName);
    
    return `✅ Branch created successfully!

Branch: ${branchName}
SHA: ${result.sha}`;
  } catch (error: any) {
    return `❌ Failed to create branch: ${error.message}`;
  }
}

/**
 * Push changes to a specific branch (for PR workflow)
 */
export async function pushToBranch(params: {
  branchName: string;
  files: Array<{ path: string; content?: string; operation?: 'create' | 'modify' | 'delete' }>;
  message: string;
}): Promise<string> {
  try {
    const { branchName, files, message } = params;
    
    if (!files || files.length === 0) {
      return '❌ No files specified for push';
    }
    
    const github = new GitHubService();
    
    if (!github.isConfigured()) {
      return '❌ GitHub not configured. Please set GITHUB_TOKEN and GITHUB_REPO environment variables.';
    }
    
    // Validate files and read content if not provided
    const fileChanges = await Promise.all(
      files.map(async (file) => {
        if (file.operation === 'delete') {
          return {
            path: file.path,
            operation: 'delete' as const,
          };
        }
        
        if (file.content !== undefined) {
          return {
            path: file.path,
            content: file.content,
            operation: file.operation || 'modify' as const,
          };
        }
        
        const fullPath = path.join(PROJECT_ROOT, file.path);
        const content = await fs.readFile(fullPath, 'utf-8');
        return {
          path: file.path,
          content,
          operation: file.operation || 'modify' as const,
        };
      })
    );
    
    const result = await github.pushChangesToBranch(branchName, fileChanges, message);
    
    return `✅ Successfully pushed ${files.length} file(s) to branch '${branchName}'!
    
Commit: ${result.commitHash}
URL: ${result.commitUrl}`;
  } catch (error: any) {
    return `❌ Failed to push to branch: ${error.message}`;
  }
}

/**
 * Create or update a Pull Request
 */
export async function createPullRequest(params: {
  branchName: string;
  title: string;
  body: string;
}): Promise<string> {
  try {
    const { branchName, title, body } = params;
    
    const github = new GitHubService();
    
    if (!github.isConfigured()) {
      return '❌ GitHub not configured. Please set GITHUB_TOKEN and GITHUB_REPO environment variables.';
    }
    
    const result = await github.createOrUpdatePR(branchName, title, body);
    
    return `✅ ${result.isNew ? 'Created' : 'Updated'} Pull Request!

PR #${result.prNumber}
URL: ${result.prUrl}

Title: ${title}`;
  } catch (error: any) {
    return `❌ Failed to create/update PR: ${error.message}`;
  }
}

/**
 * Export entire project to a new GitHub repository
 */
export async function exportProjectToGitHub(params: {
  message?: string;
  excludePatterns?: string[];
}): Promise<string> {
  try {
    const { message = 'Initial commit from BeeHive', excludePatterns = [] } = params;
    
    const github = new GitHubService();
    
    if (!github.isConfigured()) {
      return '❌ GitHub not configured. Please set GITHUB_TOKEN and GITHUB_REPO environment variables.';
    }
    
    // Get all files in project (excluding node_modules, .git, etc.)
    const defaultExcludes = [
      'node_modules',
      '.git',
      '.env',
      '.env.local',
      'dist',
      'build',
      '.DS_Store',
      '*.log',
      ...excludePatterns,
    ];
    
    const getAllFiles = async (dir: string, baseDir: string = dir): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        // Skip excluded patterns
        if (defaultExcludes.some(pattern => 
          relativePath.includes(pattern) || entry.name.includes(pattern)
        )) {
          continue;
        }
        
        if (entry.isDirectory()) {
          files.push(...await getAllFiles(fullPath, baseDir));
        } else {
          files.push(relativePath);
        }
      }
      
      return files;
    };
    
    const allFiles = await getAllFiles(PROJECT_ROOT);
    
    if (allFiles.length === 0) {
      return '❌ No files found to export';
    }
    
    // Use streaming commit for memory efficiency
    const result = await github.streamCommitFiles(allFiles, PROJECT_ROOT, message);
    
    return `✅ Successfully exported project to GitHub!

Total files: ${allFiles.length}
Commit: ${result.commitHash}
URL: ${result.commitUrl}

Your project is now on GitHub and ready to deploy!`;
  } catch (error: any) {
    return `❌ Failed to export project: ${error.message}`;
  }
}

/**
 * Get GitHub repository status
 */
export async function getGitHubStatus(): Promise<string> {
  try {
    const github = new GitHubService();
    const status = github.getStatus();
    
    if (!status.configured) {
      return `❌ GitHub not configured

To enable GitHub integration:
1. Set GITHUB_TOKEN environment variable (create at https://github.com/settings/tokens)
2. Set GITHUB_REPO environment variable (format: "username/repo-name")
3. Optionally set GITHUB_BRANCH (default: "main")`;
    }
    
    return `✅ GitHub configured and ready!

Repository: ${status.owner}/${status.repo}
Branch: ${status.branch}
Token: ${status.hasToken ? 'Set ✓' : 'Missing ✗'}

You can now commit, push, and create PRs!`;
  } catch (error: any) {
    return `❌ Error checking GitHub status: ${error.message}`;
  }
}
