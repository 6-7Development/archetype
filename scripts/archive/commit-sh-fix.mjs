import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFiles() {
  console.log('[COMMIT] Reading fixed scripts...');
  
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  const files = [
    { path: 'debug-start.sh', mode: '100755' },
    { path: 'railway-start.sh', mode: '100755' }
  ];
  
  const treeItems = [];
  for (const file of files) {
    const content = await readFile(file.path, 'utf-8');
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64'
    });
    treeItems.push({
      path: file.path,
      mode: file.mode,
      type: 'blob',
      sha: blob.sha
    });
  }
  
  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: treeItems
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Use sh instead of bash for Alpine Linux\n\nAlpine Linux (Railway Docker image) doesnt have bash installed.\nChanged debug-start.sh and railway-start.sh to use sh instead.\n\nThis fixes: railway-start.sh: line 97: bash: not found',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFiles().catch(console.error);
