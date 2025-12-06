import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFile() {
  console.log('[COMMIT] Reading parallelSubagentQueue.ts...');
  const content = await readFile('server/services/parallelSubagentQueue.ts', 'utf-8');
  
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  const { data: blob } = await octokit.git.createBlob({
    owner, repo,
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64'
  });
  
  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: [{
      path: 'server/services/parallelSubagentQueue.ts',
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    }]
  });
  
  const { data: commit} = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Add missing parallelSubagentQueue.ts file\n\nThis file exists locally but was missing from GitHub,\ncausing Railway deployment to fail with MODULE_NOT_FOUND.',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFile().catch(console.error);
