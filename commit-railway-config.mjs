import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFile() {
  console.log('[COMMIT] Reading server/config/railway.ts...');
  const content = await readFile('server/config/railway.ts', 'utf-8');
  
  console.log('[COMMIT] Getting latest commit...');
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  console.log('[COMMIT] Creating blob...');
  const { data: blob } = await octokit.git.createBlob({
    owner, repo,
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64'
  });
  
  console.log('[COMMIT] Creating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: [{
      path: 'server/config/railway.ts',
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    }]
  });
  
  console.log('[COMMIT] Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Add missing railway.ts config file\n\nThe railway config file was missing from GitHub.\nThis file is required for Railway production deployment.',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  console.log('[COMMIT] Updating branch...');
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFile().catch(console.error);
