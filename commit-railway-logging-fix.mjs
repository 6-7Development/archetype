import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFile() {
  const content = await readFile('server/routes/healing.ts', 'utf-8');
  
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
      path: 'server/routes/healing.ts',
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    }]
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Reduce healing chat logging to prevent Railway log spam\n\nChanges:\n- Silence debug logs in production (NODE_ENV=production)\n- Limit file search results to 100 files max (was unlimited)\n- Keep only essential logs (file writes, errors)\n- Reduce token tracking verbosity in production\n\nFixes Railway exceeding logging limit issue',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFile().catch(console.error);
