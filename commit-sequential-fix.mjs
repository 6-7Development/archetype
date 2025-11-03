import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFile() {
  console.log('[COMMIT] Reading railway-start.sh...');
  const content = await readFile('railway-start.sh', 'utf-8');
  
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
      path: 'railway-start.sh',
      mode: '100755',
      type: 'blob',
      sha: blob.sha
    }]
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Ensure migration completes BEFORE drift repair\n\nRoot cause: Migration and drift repair were TWO separate node\nprocesses. Promises were async, so bash continued to drift repair\nBEFORE migration completed, causing "relation file_uploads does\nnot exist" error.\n\nFix: Combined into SINGLE node process with async/await to ensure:\n1. Migration runs and COMPLETES\n2. Then drift repair runs\n3. Sequential execution guaranteed\n\nThis is the actual final fix.',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFile().catch(console.error);
