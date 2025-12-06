import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFiles() {
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  const content = await readFile('server/lomuSuperCore.ts', 'utf-8');
  const { data: blob } = await octokit.git.createBlob({
    owner, repo,
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64'
  });
  
  const { data: newTree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: [{
      path: 'server/lomuSuperCore.ts',
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    }]
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'feat(lomuai): Add all 6 critical dev tools to system prompt\n\nEnhances system prompt with explicit tool guidance:\n- Added bash, edit, grep, packager_tool, restart_workflow, get_latest_lsp_diagnostics\n- Added workflow best practices (use edit over rewrites, run LSP before commits)\n- Verified all 36 tools are defined and working with Gemini\n\nResult: LomuAI now knows about all developer tools like Replit Agent',
    tree: newTree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
}

commitFiles().catch(console.error);
