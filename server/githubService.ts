import { Octokit } from '@octokit/rest';
import { exponentialBackoffWithJitter } from './services/rateLimiter'; // P1-GAP-3: Import backoff utility

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
   * MEMORY-OPTIMIZED: Batches blob creation to prevent OOM on large changesets
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
        // MEMORY OPTIMIZATION: Process in batches to prevent OOM
        const BLOB_BATCH_SIZE = 25; // Create 25 blobs at a time
        const treeEntries: Array<{
          path: string;
          mode: '100644';
          type: 'blob';
          sha: string | null;
        }> = [];

        console.log(`[GITHUB-SERVICE] Creating blobs in batches (${BLOB_BATCH_SIZE} per batch)...`);

        for (let i = 0; i < changes.length; i += BLOB_BATCH_SIZE) {
          const batch = changes.slice(i, i + BLOB_BATCH_SIZE);
          const batchNum = Math.floor(i / BLOB_BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(changes.length / BLOB_BATCH_SIZE);
          
          console.log(`[GITHUB-SERVICE] Processing blob batch ${batchNum}/${totalBatches} (${batch.length} files)`);

          const batchEntries = await Promise.all(
            batch.map(async (change, index) => {
              const globalIndex = i + index;
              console.log(`[GITHUB-SERVICE] Processing file ${globalIndex + 1}/${changes.length}: ${change.path}`);

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

              // CRITICAL: Validate content before blob creation
              if (change.content === undefined || change.content === null) {
                console.error(`[GITHUB-SERVICE] ❌ REJECTED: File ${change.path} has undefined/null content`);
                throw new Error(`File ${change.path} has undefined/null content (${typeof change.content})`);
              }
              
              if (typeof change.content !== 'string') {
                console.error(`[GITHUB-SERVICE] ❌ REJECTED: File ${change.path} has invalid content type: ${typeof change.content}`);
                throw new Error(`File ${change.path} must have string content, got ${typeof change.content}`);
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

          treeEntries.push(...batchEntries);

          // Allow garbage collection between batches
          if (global.gc && i + BLOB_BATCH_SIZE < changes.length) {
            global.gc();
          }
        }

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

        // P1-GAP-3: Enhanced retry with exponential backoff + jitter
        if (attempt < retries - 1) {
          // Detect rate limiting or server errors
          const status = error.status || error.response?.status;
          const isRateLimitError = status === 429 || error.message?.toLowerCase().includes('rate limit');
          const isServerError = status === 503 || status === 502 || status === 500;
          
          if (isRateLimitError) {
            console.warn(`[GITHUB-SERVICE] ⏱️ Rate limit detected - using backoff...`);
          } else if (isServerError) {
            console.warn(`[GITHUB-SERVICE] ⏱️ Server error (${status}) - retrying...`);
          }
          
          // Use exponentialBackoffWithJitter from rate limiter (supports jitter for better retry)
          await exponentialBackoffWithJitter(attempt, 2000); // 2s base delay
        }
      }
    }

    throw new Error(`Failed to commit after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * STREAMING COMMIT: Stream files to GitHub without loading all into memory
   * Reads files one-by-one, creates blobs, keeps only SHA references
   * Memory usage: O(1) instead of O(total file size)
   */
  async streamCommitFiles(filePaths: string[], rootDir: string, message: string, retries = 3): Promise<CommitResult> {
    const fs = await import('fs/promises');
    const path = await import('path');
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[GITHUB-SERVICE-STREAM] Streaming ${filePaths.length} file(s) to GitHub (attempt ${attempt + 1}/${retries})`);

        // Step 1: Get the latest commit
        const latestCommitSha = await this.getLatestCommit();
        console.log(`[GITHUB-SERVICE-STREAM] Latest commit: ${latestCommitSha}`);

        // Step 2: Get the tree of the latest commit
        const { data: latestCommit } = await this.octokit.git.getCommit({
          owner: this.owner,
          repo: this.repo,
          commit_sha: latestCommitSha,
        });

        // Step 3: STREAM files and create blobs - keep only SHA references
        const STREAM_BATCH_SIZE = 10; // Process 10 files at a time to balance speed and memory
        const treeEntries: Array<{
          path: string;
          mode: '100644';
          type: 'blob';
          sha: string;
        }> = [];

        console.log(`[GITHUB-SERVICE-STREAM] Creating blobs in streaming batches (${STREAM_BATCH_SIZE} files per batch)...`);

        for (let i = 0; i < filePaths.length; i += STREAM_BATCH_SIZE) {
          const batch = filePaths.slice(i, i + STREAM_BATCH_SIZE);
          const batchNum = Math.floor(i / STREAM_BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(filePaths.length / STREAM_BATCH_SIZE);
          
          console.log(`[GITHUB-SERVICE-STREAM] Processing batch ${batchNum}/${totalBatches} (${batch.length} files)`);

          // Process batch: read file → create blob → discard content → keep SHA only
          const batchEntries = await Promise.all(
            batch.map(async (filePath) => {
              const fullPath = path.join(rootDir, filePath);
              
              // Detect binary vs text files by extension
              const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.wav'];
              const isBinary = binaryExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
              
              if (isBinary) {
                // Binary files: read as Buffer and encode as base64
                const buffer = await fs.readFile(fullPath);
                const base64Content = buffer.toString('base64');
                
                const { data: blob } = await this.octokit.git.createBlob({
                  owner: this.owner,
                  repo: this.repo,
                  content: base64Content,
                  encoding: 'base64',
                });

                return {
                  path: filePath,
                  mode: '100644' as const,
                  type: 'blob' as const,
                  sha: blob.sha,
                };
              } else {
                // Text files: read as UTF-8 and let Octokit handle encoding
                const content = await fs.readFile(fullPath, 'utf-8');
                
                const { data: blob } = await this.octokit.git.createBlob({
                  owner: this.owner,
                  repo: this.repo,
                  content: content,
                  encoding: 'utf-8' as 'utf-8',
                });

                return {
                  path: filePath,
                  mode: '100644' as const,
                  type: 'blob' as const,
                  sha: blob.sha,
                };
              }
            })
          );

          treeEntries.push(...batchEntries);

          // Force garbage collection after each batch if available
          if (global.gc) {
            global.gc();
          }

          // Progress logging
          console.log(`[GITHUB-SERVICE-STREAM] Progress: ${treeEntries.length}/${filePaths.length} files processed`);
        }

        console.log(`[GITHUB-SERVICE-STREAM] ✅ All ${treeEntries.length} blobs created. Building tree...`);

        // Step 4: Create a new tree with all the blob SHAs
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

        console.log(`[GITHUB-SERVICE-STREAM] ✅ Successfully streamed ${filePaths.length} file(s)`);
        console.log(`[GITHUB-SERVICE-STREAM] Commit: ${newCommit.sha}`);
        console.log(`[GITHUB-SERVICE-STREAM] URL: ${commitUrl}`);

        return {
          commitHash: newCommit.sha,
          commitUrl,
        };
      } catch (error: any) {
        lastError = error;
        console.error(`[GITHUB-SERVICE-STREAM] Attempt ${attempt + 1} failed:`, error.message);

        if (attempt < retries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, attempt);
          console.log(`[GITHUB-SERVICE-STREAM] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to stream commit after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
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

  // ============================================================
  // PR WORKFLOW METHODS (Phase 2)
  // ============================================================

  /**
   * Create a new branch from main for PR workflow
   * @param branchName - Name of the branch to create (e.g., "lomu-ai/fix-123")
   * @returns The created branch reference
   */
  async createBranchFromMain(branchName: string): Promise<{ ref: string; sha: string }> {
    try {
      console.log(`[GITHUB-PR] Creating branch: ${branchName} from ${this.branch}`);

      // Get the latest commit SHA from main
      const mainSha = await this.getLatestCommit();

      // Create the new branch reference
      const { data } = await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: mainSha,
      });

      console.log(`[GITHUB-PR] ✅ Branch created: ${branchName} at ${mainSha.substring(0, 7)}`);

      return {
        ref: data.ref,
        sha: data.object.sha,
      };
    } catch (error: any) {
      // If branch already exists, get its current SHA
      if (error.status === 422 && error.message.includes('Reference already exists')) {
        console.log(`[GITHUB-PR] Branch ${branchName} already exists, fetching current SHA`);
        const { data } = await this.octokit.repos.getBranch({
          owner: this.owner,
          repo: this.repo,
          branch: branchName,
        });
        return {
          ref: `refs/heads/${branchName}`,
          sha: data.commit.sha,
        };
      }

      console.error(`[GITHUB-PR] Failed to create branch ${branchName}:`, error.message);
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  /**
   * Push changes to a specific branch (for PR workflow)
   * @param branchName - Target branch name
   * @param files - Files to commit
   * @param commitMessage - Commit message
   * @returns Commit result
   */
  async pushChangesToBranch(
    branchName: string,
    files: FileChange[],
    commitMessage: string
  ): Promise<CommitResult> {
    try {
      console.log(`[GITHUB-PR] Pushing ${files.length} file(s) to branch: ${branchName}`);

      // Get the latest commit SHA from the target branch
      const { data: branchData } = await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: branchName,
      });
      const latestCommitSha = branchData.commit.sha;

      // Get the tree of the latest commit
      const { data: latestCommit } = await this.octokit.git.getCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: latestCommitSha,
      });

      // Create tree entries for each changed file
      const treeEntries = await Promise.all(
        files.map(async (change) => {
          if (change.operation === 'delete') {
            return {
              path: change.path,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: null as any,
            };
          }

          if (!change.content) {
            throw new Error(`File ${change.path} has no content`);
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

      // Create a new tree
      const { data: newTree } = await this.octokit.git.createTree({
        owner: this.owner,
        repo: this.repo,
        base_tree: latestCommit.tree.sha,
        tree: treeEntries,
      });

      // Create a new commit
      const { data: newCommit } = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message: `[LomuAI PR] ${commitMessage}`,
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // Update the branch reference
      await this.octokit.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branchName}`,
        sha: newCommit.sha,
      });

      const commitUrl = `https://github.com/${this.owner}/${this.repo}/commit/${newCommit.sha}`;

      console.log(`[GITHUB-PR] ✅ Pushed to ${branchName}: ${newCommit.sha.substring(0, 7)}`);

      return {
        commitHash: newCommit.sha,
        commitUrl,
      };
    } catch (error: any) {
      console.error(`[GITHUB-PR] Failed to push to branch ${branchName}:`, error.message);
      throw new Error(`Failed to push to branch: ${error.message}`);
    }
  }

  /**
   * Create a new PR or update existing one
   * @param branchName - Source branch name
   * @param title - PR title
   * @param body - PR description
   * @returns PR number and URL
   */
  async createOrUpdatePR(
    branchName: string,
    title: string,
    body: string
  ): Promise<{ prNumber: number; prUrl: string; isNew: boolean }> {
    try {
      console.log(`[GITHUB-PR] Creating/updating PR for branch: ${branchName}`);

      // Check if a PR already exists for this branch
      const { data: existingPRs } = await this.octokit.pulls.list({
        owner: this.owner,
        repo: this.repo,
        head: `${this.owner}:${branchName}`,
        state: 'open',
      });

      if (existingPRs.length > 0) {
        // Update existing PR
        const existingPR = existingPRs[0];
        console.log(`[GITHUB-PR] Updating existing PR #${existingPR.number}`);

        await this.octokit.pulls.update({
          owner: this.owner,
          repo: this.repo,
          pull_number: existingPR.number,
          title,
          body,
        });

        return {
          prNumber: existingPR.number,
          prUrl: existingPR.html_url,
          isNew: false,
        };
      }

      // Create new PR
      const { data: newPR } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        head: branchName,
        base: this.branch,
      });

      console.log(`[GITHUB-PR] ✅ Created PR #${newPR.number}: ${newPR.html_url}`);

      return {
        prNumber: newPR.number,
        prUrl: newPR.html_url,
        isNew: true,
      };
    } catch (error: any) {
      console.error(`[GITHUB-PR] Failed to create/update PR:`, error.message);
      throw new Error(`Failed to create/update PR: ${error.message}`);
    }
  }

  /**
   * Get PR status, checks, and preview URL from comments
   * @param prNumber - PR number
   * @returns PR status information including preview URL if available
   */
  async getPRStatus(prNumber: number): Promise<{
    state: string;
    mergeable: boolean | null;
    checksStatus: 'pending' | 'success' | 'failure' | 'unknown';
    previewUrl?: string;
  }> {
    try {
      console.log(`[GITHUB-PR] Fetching status for PR #${prNumber}`);

      // Get PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      // Get check runs for the PR
      const { data: checkRuns } = await this.octokit.checks.listForRef({
        owner: this.owner,
        repo: this.repo,
        ref: pr.head.sha,
      });

      // Determine overall check status
      let checksStatus: 'pending' | 'success' | 'failure' | 'unknown' = 'unknown';
      if (checkRuns.total_count === 0) {
        checksStatus = 'pending';
      } else {
        const allSuccess = checkRuns.check_runs.every((run) => run.conclusion === 'success');
        const anyFailure = checkRuns.check_runs.some((run) => run.conclusion === 'failure');
        if (anyFailure) {
          checksStatus = 'failure';
        } else if (allSuccess) {
          checksStatus = 'success';
        } else {
          checksStatus = 'pending';
        }
      }

      // Try to extract preview URL from PR comments
      let previewUrl: string | undefined;
      try {
        const { data: comments } = await this.octokit.issues.listComments({
          owner: this.owner,
          repo: this.repo,
          issue_number: prNumber,
        });

        // Look for Railway preview deployment comment
        const previewComment = comments.find((c) => 
          c.body?.includes('Preview Deployment') || c.body?.includes('Preview URL')
        );

        if (previewComment?.body) {
          // Extract URL from markdown link format: [text](url)
          const urlMatch = previewComment.body.match(/\*\*Preview URL:\*\*\s+(.+)/);
          if (urlMatch) {
            previewUrl = urlMatch[1].trim();
          }
        }
      } catch (commentError) {
        console.warn(`[GITHUB-PR] Could not fetch comments for PR #${prNumber}`);
      }

      console.log(`[GITHUB-PR] PR #${prNumber} status:`, {
        state: pr.state,
        mergeable: pr.mergeable,
        checksStatus,
        previewUrl: previewUrl ? '✅' : '❌',
      });

      return {
        state: pr.state,
        mergeable: pr.mergeable,
        checksStatus,
        previewUrl,
      };
    } catch (error: any) {
      console.error(`[GITHUB-PR] Failed to get PR status:`, error.message);
      throw new Error(`Failed to get PR status: ${error.message}`);
    }
  }

  /**
   * Merge a PR (auto-merge when tests pass)
   * @param prNumber - PR number to merge
   * @returns Merge result
   */
  async mergePR(prNumber: number): Promise<{ merged: boolean; sha: string; message: string }> {
    try {
      console.log(`[GITHUB-PR] Attempting to merge PR #${prNumber}`);

      // Check if PR is mergeable
      const status = await this.getPRStatus(prNumber);
      if (!status.mergeable) {
        throw new Error('PR is not mergeable (conflicts or other issues)');
      }

      if (status.checksStatus === 'failure') {
        throw new Error('Cannot merge PR with failing checks');
      }

      if (status.checksStatus === 'pending') {
        console.log(`[GITHUB-PR] ⚠️ Checks still pending for PR #${prNumber}`);
      }

      // Merge the PR
      const { data: mergeResult } = await this.octokit.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: 'squash', // Use squash merge for cleaner history
      });

      console.log(`[GITHUB-PR] ✅ Merged PR #${prNumber}: ${mergeResult.sha?.substring(0, 7)}`);

      return {
        merged: mergeResult.merged,
        sha: mergeResult.sha || '',
        message: mergeResult.message || 'PR merged successfully',
      };
    } catch (error: any) {
      console.error(`[GITHUB-PR] Failed to merge PR #${prNumber}:`, error.message);
      throw new Error(`Failed to merge PR: ${error.message}`);
    }
  }

  /**
   * Close a PR without merging (when tests fail)
   * @param prNumber - PR number to close
   * @returns Close result
   */
  async closePR(prNumber: number): Promise<{ closed: boolean }> {
    try {
      console.log(`[GITHUB-PR] Closing PR #${prNumber} without merging`);

      await this.octokit.pulls.update({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        state: 'closed',
      });

      console.log(`[GITHUB-PR] ✅ Closed PR #${prNumber}`);

      return { closed: true };
    } catch (error: any) {
      console.error(`[GITHUB-PR] Failed to close PR #${prNumber}:`, error.message);
      throw new Error(`Failed to close PR: ${error.message}`);
    }
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

// Helper function to fetch recent commits for deployment awareness
export async function fetchRecentCommits(count: number = 10): Promise<any[]> {
  if (!isGitHubServiceAvailable()) {
    console.log('[GITHUB-SERVICE] GitHub not configured, returning empty commits');
    return [];
  }
  
  try {
    const service = getGitHubService();
    const commits = await service.getRecentCommits('main', count);
    return commits;
  } catch (error) {
    console.error('[GITHUB-SERVICE] Failed to fetch recent commits:', error);
    return [];
  }
}