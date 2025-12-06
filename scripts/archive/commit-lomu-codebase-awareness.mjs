import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFiles() {
  const files = [
    'server/lomuSuperCore.ts',
    'server/services/conversationState.ts',
    'server/routes/lomuChat.ts',
    'server/routes/conversationState.ts',
    'server/routes/chat.ts'
  ];
  
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  const tree = [];
  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64'
    });
    tree.push({
      path: file,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }
  
  const { data: newTree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'feat(lomuai): Add codebase awareness with auto-injected replit.md context\n\nFixes LomuAI not knowing project architecture:\n1. Auto-inject replit.md into every LomuAI conversation\n2. Add file discovery workflow to system prompt\n3. LomuAI now has complete project knowledge automatically\n\nResult: LomuAI now knows files, routes, and architecture like Replit Agent',
    tree: newTree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFiles().catch(console.error);
