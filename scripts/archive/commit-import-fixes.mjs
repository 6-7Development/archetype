import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

const filesToCommit = [
  'server/routes/lomuChat.ts',
  'server/routes/architectAgent.ts',
  'server/routes/tools.ts',
  'server/routes/taskRunner.ts',
  'server/routes/messageQueue.ts',
  'server/routes/autonomySettings.ts',
  'server/routes/imageGeneration.ts',
  'server/routes/dynamicIntelligence.ts',
  'server/routes/planMode.ts',
  'server/routes/designPrototype.ts',
  'server/routes/workflows.ts',
  'server/routes/automations.ts',
  'server/routes/generalAgent.ts',
  'server/routes/common.ts',
  'server/routes/diagnostics.ts',
  'server/routes/aiKnowledge.ts',
  'server/routes/chat.ts',
];

async function commitFiles() {
  console.log('[COMMIT] Reading 17 fixed files...');
  
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  console.log('[COMMIT] Creating blobs...');
  const treeItems = [];
  for (const file of filesToCommit) {
    const content = await readFile(file, 'utf-8');
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64'
    });
    treeItems.push({
      path: file,
      mode: '100644',
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
    message: 'fix(railway): Add .ts extensions to all local imports\n\nRailway uses tsx which requires explicit .ts extensions for ES\nmodules. Fixed 17 route files that were missing extensions:\n- lomuChat, architectAgent, tools, taskRunner, messageQueue\n- autonomySettings, imageGeneration, dynamicIntelligence\n- planMode, designPrototype, workflows, automations\n- generalAgent, common, diagnostics, aiKnowledge, chat\n\nThis was causing MODULE_NOT_FOUND errors on Railway deployment.',
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
