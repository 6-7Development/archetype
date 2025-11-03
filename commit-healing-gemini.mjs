import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFiles() {
  // Read files
  const healingContent = await readFile('server/routes/healing.ts', 'utf-8');
  const replitMdContent = await readFile('replit.md', 'utf-8');
  
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  // Create blobs
  const { data: healingBlob } = await octokit.git.createBlob({
    owner, repo,
    content: Buffer.from(healingContent).toString('base64'),
    encoding: 'base64'
  });
  
  const { data: replitBlob } = await octokit.git.createBlob({
    owner, repo,
    content: Buffer.from(replitMdContent).toString('base64'),
    encoding: 'base64'
  });
  
  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: [
      {
        path: 'server/routes/healing.ts',
        mode: '100644',
        type: 'blob',
        sha: healingBlob.sha
      },
      {
        path: 'replit.md',
        mode: '100644',
        type: 'blob',
        sha: replitBlob.sha
      }
    ]
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'feat(healing-chat): Switch to Gemini 2.5 Flash with multi-turn tool execution\n\nPrevious Issue:\n- Healing chat used single-turn aiHealingService\n- AI would request tools but never see the results\n- Conversation ended after first response (no tool continuation)\n- User saw "I\'ll help you" but no actual action\n\nChanges:\n- Replaced Claude single-turn with Gemini 2.5 Flash streaming\n- Implemented proper multi-turn tool execution loop (max 5 iterations)\n- Tools: read_platform_file, write_platform_file, search_platform_files\n- Tool results fed back to AI for continued work\n- Token tracking: Gemini is 97% cheaper ($0.10/$0.40 vs $3/$15 per 1M tokens)\n\nCost Strategy:\n- Gemini: Normal healing chat operations (cost-effective)\n- Claude: Reserved for emergency architect consultations (root-initiated)\n\nTesting: Local verification pending Railway deployment',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFiles().catch(console.error);
