import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFix() {
  console.log('[COMMIT] Reading files...');
  
  const files = [
    'server/middleware/memoryMonitor.ts',
    'server/routes/architectAgent.ts',
    'server/routes/lomuChat.ts'
  ];
  
  const changes = await Promise.all(files.map(async (filePath) => {
    const content = await readFile(filePath, 'utf-8');
    return { path: filePath, content, operation: 'modify' };
  }));
  
  console.log('[COMMIT] Getting latest commit...');
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  console.log('[COMMIT] Creating blobs...');
  const treeEntries = await Promise.all(changes.map(async (change) => {
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(change.content).toString('base64'),
      encoding: 'base64'
    });
    return { path: change.path, mode: '100644', type: 'blob', sha: blob.sha };
  }));
  
  console.log('[COMMIT] Creating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: treeEntries
  });
  
  console.log('[COMMIT] Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Add .ts extension to railway config imports\n\nFixes ERR_MODULE_NOT_FOUND error on Railway deployment.\nTsx requires explicit .ts extension for ES module imports.',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  console.log('[COMMIT] Updating branch...');
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFix().catch(console.error);
