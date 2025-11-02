import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFile() {
  console.log('[COMMIT] Reading LOCAL railway-start.sh...');
  const content = await readFile('railway-start.sh', 'utf-8');
  
  console.log('[COMMIT] Verifying it uses tsx...');
  if (!content.includes('npx tsx server/index.ts')) {
    console.error('ERROR: Local file doesnt have tsx command!');
    process.exit(1);
  }
  console.log('✓ Confirmed tsx command present');
  
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
      path: 'railway-start.sh',
      mode: '100755',
      type: 'blob',
      sha: blob.sha
    }]
  });
  
  console.log('[COMMIT] Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Use tsx to run TypeScript directly\n\nFixed startup script to use npx tsx server/index.ts instead of\nnode dist/index.js. Server code is TypeScript and runs directly\nvia tsx runtime - no compilation to dist/index.js needed.',
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
