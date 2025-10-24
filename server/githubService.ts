import { Octokit } from '@octokit/rest';

interface FileChange {
  path: string;
  content: string;
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

        // Step 3: Create blobs for each changed file
        const blobs = await Promise.all(
          changes.map(async (change, index) => {
            console.log(`[GITHUB-SERVICE] Processing file ${index + 1}/${changes.length}: ${change.path}`);
            console.log(`[GITHUB-SERVICE] Content type: ${typeof change.content}`);
            console.log(`[GITHUB-SERVICE] Content defined: ${change.content !== undefined && change.content !== null}`);
            console.log(`[GITHUB-SERVICE] Content length: ${change.content?.length || 0} bytes`);
            
            // Only reject undefined/null, allow empty strings
            if (change.content === undefined || change.content === null) {
              throw new Error(`File ${change.path} has undefined/null content (${typeof change.content})`);
            }
            
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
          tree: blobs,
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
