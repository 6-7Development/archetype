import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';
import path from 'path';

interface FileChange {
  path: string;
  content: string;
  operation?: 'create' | 'modify' | 'delete';
}

async function commitFiles(octokit: Octokit, owner: string, repo: string, branch: string, changes: FileChange[], message: string) {
  console.log(`[GITHUB] Committing ${changes.length} file(s)...`);
  
  // Step 1: Get the latest commit
  const { data: refData } = await octokit.repos.getBranch({ owner, repo, branch });
  const latestCommitSha = refData.commit.sha;
  console.log(`[GITHUB] Latest commit: ${latestCommitSha}`);
  
  // Step 2: Get the tree of the latest commit
  const { data: latestCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  
  // Step 3: Create blobs for each file
  const treeEntries = await Promise.all(
    changes.map(async (change) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
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
  
  // Step 4: Create a new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: latestCommit.tree.sha,
    tree: treeEntries,
  });
  
  // Step 5: Create a new commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: `[Platform-SySop] ${message}`,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });
  
  // Step 6: Update the branch reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });
  
  return {
    commitHash: newCommit.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
  };
}

async function deployFix() {
  try {
    console.log('🚀 Starting deployment of Meta-SySop directory listing fix...\n');
    
    const token = process.env.GITHUB_TOKEN;
    const repoString = process.env.GITHUB_REPO || '';
    const branch = process.env.GITHUB_BRANCH || 'main';
    
    if (!token || !repoString) {
      throw new Error('GITHUB_TOKEN and GITHUB_REPO environment variables required');
    }
    
    const [owner, repo] = repoString.split('/');
    const octokit = new Octokit({ auth: token });
    
    console.log(`📦 Repository: ${owner}/${repo}`);
    console.log(`🌿 Branch: ${branch}\n`);
    
    // Read changed files
    const files = [
      'server/platformHealing.ts',
      'server/githubService.ts',
      'server/routes/metaSysopChat.ts'
    ];
    
    const changes = await Promise.all(
      files.map(async (filePath) => {
        const fullPath = path.join(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        console.log(`✅ Read ${filePath} (${content.length} bytes)`);
        return {
          path: filePath,
          content,
          operation: 'modify' as const
        };
      })
    );
    
    console.log(`\n📝 Committing ${changes.length} files to GitHub...`);
    const result = await commitFiles(octokit, owner, repo, branch, changes, 'Fix Meta-SySop directory listing - non-recursive with type metadata');
    
    console.log(`\n✅ Successfully committed to GitHub!`);
    console.log(`   Commit: ${result.commitHash}`);
    console.log(`   URL: ${result.commitUrl}`);
    console.log(`\n🚂 Railway will auto-deploy from this commit shortly...`);
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

deployFix();
