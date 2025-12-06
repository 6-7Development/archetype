import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFiles() {
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  const files = [
    { path: 'railway-start.sh', content: await readFile('railway-start.sh', 'utf-8') },
    { path: 'railway-db-setup.js', content: await readFile('railway-db-setup.js', 'utf-8') },
    { path: 'Dockerfile', content: await readFile('Dockerfile', 'utf-8') }
  ];
  
  const blobs = await Promise.all(files.map(f => 
    octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(f.content).toString('base64'),
      encoding: 'base64'
    })
  ));
  
  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: [
      { path: 'railway-start.sh', mode: '100755', type: 'blob', sha: blobs[0].data.sha },
      { path: 'railway-db-setup.js', mode: '100644', type: 'blob', sha: blobs[1].data.sha },
      { path: 'Dockerfile', mode: '100644', type: 'blob', sha: blobs[2].data.sha }
    ]
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Use dedicated JS file for sequential DB setup\n\nProblem: Heredoc in bash may have shell compatibility issues\ncausing async execution to not work correctly.\n\nSolution: Extract database setup to railway-db-setup.js file\nwith proper async/await. This ensures:\n1. Migration completes first\n2. Drift repair runs after\n3. No shell interpretation issues\n\nThis is a cleaner, more reliable approach.',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFiles().catch(console.error);
