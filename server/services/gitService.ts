import simpleGit, { SimpleGit, LogResult, StatusResult } from 'simple-git';
import path from 'path';

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: string[];
}

export interface GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  branch: string;
}

export interface GitAuthor {
  name: string;
  email: string;
}

export class GitService {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async initRepo(projectPath: string): Promise<void> {
    const git = simpleGit(projectPath);
    await git.init();
  }

  async getHistory(limit: number = 50): Promise<GitCommit[]> {
    try {
      const log: LogResult = await this.git.log({ maxCount: limit });
      
      const commits: GitCommit[] = await Promise.all(
        log.all.map(async (commit) => {
          // Get files changed in this commit
          const diffSummary = await this.git.diffSummary([`${commit.hash}^`, commit.hash]).catch(() => ({ files: [] }));
          const files = diffSummary.files?.map(f => f.file) || [];

          return {
            hash: commit.hash,
            author: commit.author_name,
            email: commit.author_email,
            date: new Date(commit.date),
            message: commit.message,
            files,
          };
        })
      );

      return commits;
    } catch (error) {
      console.error('[GIT-SERVICE] Error getting history:', error);
      return [];
    }
  }

  async getDiff(filePath?: string): Promise<string> {
    try {
      if (filePath) {
        return await this.git.diff([filePath]);
      }
      return await this.git.diff();
    } catch (error) {
      console.error('[GIT-SERVICE] Error getting diff:', error);
      return '';
    }
  }

  async getDiffBetweenCommits(commit1: string, commit2: string, filePath?: string): Promise<string> {
    try {
      if (filePath) {
        return await this.git.diff([commit1, commit2, '--', filePath]);
      }
      return await this.git.diff([commit1, commit2]);
    } catch (error) {
      console.error('[GIT-SERVICE] Error getting diff between commits:', error);
      return '';
    }
  }

  async stageFiles(files: string[]): Promise<void> {
    await this.git.add(files);
  }

  async commit(message: string, author: GitAuthor): Promise<string> {
    try {
      const result = await this.git.commit(message, undefined, {
        '--author': `${author.name} <${author.email}>`,
      });
      return result.commit;
    } catch (error) {
      console.error('[GIT-SERVICE] Error committing:', error);
      throw error;
    }
  }

  async getBranches(): Promise<string[]> {
    try {
      const branches = await this.git.branch();
      return branches.all;
    } catch (error) {
      console.error('[GIT-SERVICE] Error getting branches:', error);
      return [];
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const branches = await this.git.branch();
      return branches.current;
    } catch (error) {
      console.error('[GIT-SERVICE] Error getting current branch:', error);
      return 'main';
    }
  }

  async createBranch(branchName: string): Promise<void> {
    await this.git.checkoutLocalBranch(branchName);
  }

  async checkoutBranch(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  async getStatus(): Promise<GitStatus> {
    try {
      const status: StatusResult = await this.git.status();
      
      return {
        modified: status.modified,
        added: status.created,
        deleted: status.deleted,
        untracked: status.not_added,
        branch: status.current || 'main',
      };
    } catch (error) {
      console.error('[GIT-SERVICE] Error getting status:', error);
      return {
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
        branch: 'main',
      };
    }
  }

  async getCommitFiles(commitHash: string): Promise<string[]> {
    try {
      const diffSummary = await this.git.diffSummary([`${commitHash}^`, commitHash]);
      return diffSummary.files?.map(f => f.file) || [];
    } catch (error) {
      console.error('[GIT-SERVICE] Error getting commit files:', error);
      return [];
    }
  }

  async getFileDiffForCommit(commitHash: string, filePath: string): Promise<string> {
    try {
      return await this.git.show([`${commitHash}:${filePath}`]);
    } catch (error) {
      console.error('[GIT-SERVICE] Error getting file diff for commit:', error);
      return '';
    }
  }
}

// Singleton instance for platform repo
export const platformGitService = new GitService(process.cwd());
