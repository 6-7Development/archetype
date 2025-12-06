import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

const filesToCommit = [
  { path: 'debug-start.sh', mode: '100755' },
  { path: 'railway-start.sh', mode: '100755' },
  { path: 'Dockerfile', mode: '100644' }
];

async function commitFiles() {
  console.log('[COMMIT] Reading debug files...');
  
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  console.log('[COMMIT] Creating blobs...');
  const treeItems = [];
  for (const file of filesToCommit) {
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
  
  console.log('[COMMIT] Creating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: treeItems
  });
  
  console.log('[COMMIT] Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'debug(railway): Add verbose error capture script\n\nCreated debug-start.sh to capture exact error messages and\nstack traces from Railway deployment failures. This wraps the\ntsx command with:\n- Step-by-step verification\n- Error trapping with stack traces\n- Verbose output logging\n- Clear error messages\n\nThis will help diagnose the ongoing Railway crash issues.',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  console.log('[COMMIT] Updating branch...');
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFiles().catch(console.error);
