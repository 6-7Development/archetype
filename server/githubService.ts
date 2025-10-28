import { Octokit } from '@octokit/rest';

interface FileChange {
  path: string;
  content?: string; // Optional - not required for delete operations
  operation?: 'create' | 'modify' | 'delete';
}

interface CommitResult {
  commitHash: string;
  commitUrl: string;
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    const repoString = process.env.GITHUB_REPO || '';
    this.branch = process.env.GITHUB_BRANCH || 'main';

    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    if (!repoString) {
      throw new Error('GITHUB_REPO environment variable is required (format: "username/repo-name")');
    }

    const [owner, repo] = repoString.split('/');
    if (!owner || !repo) {
      throw new Error('GITHUB_REPO must be in format "username/repo-name"');
    }

    this.owner = owner;
    this.repo = repo;
    this.octokit = new Octokit({ auth: token });

    console.log(`[GITHUB-SERVICE] Initialized for ${owner}/${repo} on branch ${this.branch}`);
  }

  /**
   * Get the latest commit hash from the branch
   */
  async getLatestCommit(): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: this.branch,
      });

      return data.commit.sha;
    } catch (error: any) {
      console.error('[GITHUB-SERVICE] Failed to get latest commit:', error.message);
      throw new Error(`Failed to get latest commit: ${error.message}`);
    }
  }

  /**
   * Get file content from GitHub repository
   */
  async getFileContent(filePath: string): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        ref: this.branch,
      });

      // Ensure data is a file, not a directory or symlink
      if (!('content' in data) || Array.isArray(data)) {
        throw new Error(`Path ${filePath} is not a file`);
      }

      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return content;
    } catch (error: any) {
      console.error(`[GITHUB-SERVICE] Failed to get file content for ${filePath}:`, error.message);
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * List immediate directory contents from GitHub repository
   * Returns entry names with type metadata (matches local fs behavior)
   */
  async listDirectoryEntries(directoryPath: string = ''): Promise<Array<{ name: string; type: 'file' | 'dir' }>> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: directoryPath,
        ref: this.branch,
      });

      // Ensure data is a directory listing
      if (!Array.isArray(data)) {
        throw new Error(`Path ${directoryPath} is not a directory`);
      }

      // Return immediate entries with type metadata
      return data
        .filter(entry => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map(entry => ({
          name: entry.name,
          type: entry.type === 'dir' ? 'dir' as const : 'file' as const
        }));
    } catch (error: any) {
      console.error(`[GITHUB-SERVICE] Failed to list directory ${directoryPath}:`, error.message);
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Commit a single file to the repository
   */
  async commitFile(filePath: string, content: string, message: string): Promise<CommitResult> {
    console.log(`[GITHUB-SERVICE] commitFile called with path: ${filePath}`);
    console.log(`[GITHUB-SERVICE] Content type: ${typeof content}`);
    console.log(`[GITHUB-SERVICE] Content defined: ${content !== undefined}`);
    console.log(`[GITHUB-SERVICE] Content length: ${content?.length || 0} bytes`);
    return this.commitFiles([{ path: filePath, content }], message);
  }

  /**
   * Commit multiple files to the repository in a single commit
   * Uses GitHub's tree API for atomic multi-file commits
   */
  async commitFiles(changes: FileChange[], message: string, retries = 3): Promise<CommitResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[GITHUB-SERVICE] Committing ${changes.length} file(s) (attempt ${attempt + 1}/${retries})`);

        // Step 1: Get the latest commit
        const latestCommitSha = await this.getLatestCommit();
        console.log(`[GITHUB-SERVICE] Latest commit: ${latestCommitSha}`);

        // Step 2: Get the tree of the latest commit
        const { data: latestCommit } = await this.octokit.git.getCommit({
          owner: this.owner,
          repo: this.repo,
          commit_sha: latestCommitSha,
        });

        // Step 3: Create tree entries for each changed file (blobs for creates/modifies, nulls for deletes)
        const treeEntries = await Promise.all(
          changes.map(async (change, index) => {
            console.log(`[GITHUB-SERVICE] Processing file ${index + 1}/${changes.length}: ${change.path}`);
            console.log(`[GITHUB-SERVICE] Operation: ${change.operation || 'modify'}`);

            // Handle delete operations - create tree entry with sha: null
            if (change.operation === 'delete') {
              console.log(`[GITHUB-SERVICE] DELETE operation - creating tree entry with sha: null`);
              return {
                path: change.path,
                mode: '100644' as const,
                type: 'blob' as const,
                sha: null as any, // GitHub API requires null for deletes
              };
            }

            // Handle create/modify operations - create blob
            console.log(`[GITHUB-SERVICE] Content type: ${typeof change.content}`);
            console.log(`[GITHUB-SERVICE] Content defined: ${change.content !== undefined && change.content !== null}`);
            console.log(`[GITHUB-SERVICE] Content length: ${change.content?.length || 0} bytes`);

            // CRITICAL: Validate content before blob creation
            if (change.content === undefined || change.content === null) {
              console.error(`[GITHUB-SERVICE] ❌ REJECTED: File ${change.path} has undefined/null content`);
              throw new Error(`File ${change.path} has undefined/null content (${typeof change.content})`);
            }
            
            if (typeof change.content !== 'string') {
              console.error(`[GITHUB-SERVICE] ❌ REJECTED: File ${change.path} has invalid content type: ${typeof change.content}`);
              throw new Error(`File ${change.path} must have string content, got ${typeof change.content}`);
            }
            
            console.log(`[GITHUB-SERVICE] ✅ Content validated for ${change.path}`);

            const { data: blob } = await this.octokit.git.createBlob({
              owner: this.owner,
              repo: this.repo,
              content: Buffer.from(change.content).toString('base64'),
              encoding: 'base64',
            });
            return {
              path: change.path,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: blob.sha,
            };
          })
        );

        // Step 4: Create a new tree with the changed files
        const { data: newTree } = await this.octokit.git.createTree({
          owner: this.owner,
          repo: this.repo,
          base_tree: latestCommit.tree.sha,
          tree: treeEntries,
        });

        // Step 5: Create a new commit
        const { data: newCommit } = await this.octokit.git.createCommit({
          owner: this.owner,
          repo: this.repo,
          message: `[Platform-SySop] ${message}`,
          tree: newTree.sha,
          parents: [latestCommitSha],
        });

        // Step 6: Update the branch reference
        await this.octokit.git.updateRef({
          owner: this.owner,
          repo: this.repo,
          ref: `heads/${this.branch}`,
          sha: newCommit.sha,
        });

        const commitUrl = `https://github.com/${this.owner}/${this.repo}/commit/${newCommit.sha}`;

        console.log(`[GITHUB-SERVICE] ✅ Successfully committed ${changes.length} file(s)`);
        console.log(`[GITHUB-SERVICE] Commit: ${newCommit.sha}`);
        console.log(`[GITHUB-SERVICE] URL: ${commitUrl}`);

        return {
          commitHash: newCommit.sha,
          commitUrl,
        };
      } catch (error: any) {
        lastError = error;
        console.error(`[GITHUB-SERVICE] Commit attempt ${attempt + 1} failed:`, error.message);

        if (attempt < retries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, attempt);
          console.log(`[GITHUB-SERVICE] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to commit after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Get recent commits from the repository
   */
  async getRecentCommits(branch: string = 'main', count: number = 10): Promise<any[]> {
    try {
      const { data: commits } = await this.octokit.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        sha: branch,
        per_page: count,
      });

      return commits;
    } catch (error: any) {
      console.error('[GITHUB-SERVICE] Failed to get recent commits:', error.message);
      throw new Error(`Failed to get recent commits: ${error.message}`);
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
  }

  /**
   * Get configuration status for diagnostics
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      hasToken: !!process.env.GITHUB_TOKEN,
    };
  }
}

// Singleton instance
let githubServiceInstance: GitHubService | null = null;

export function getGitHubService(): GitHubService {
  if (!githubServiceInstance) {
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
      throw new Error(
        'GitHub service not configured. Required environment variables:\n' +
        '  - GITHUB_TOKEN (GitHub personal access token with repo permissions)\n' +
        '  - GITHUB_REPO (format: "username/repo-name")\n' +
        '  - GITHUB_BRANCH (optional, default: "main")'
      );
    }
    githubServiceInstance = new GitHubService();
  }
  return githubServiceInstance;
}

// Check if GitHub service is available
export function isGitHubServiceAvailable(): boolean {
  return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}