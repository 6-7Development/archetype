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
    { path: 'railway-db-setup.cjs', content: await readFile('railway-db-setup.cjs', 'utf-8') },
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
      { path: 'railway-db-setup.cjs', mode: '100644', type: 'blob', sha: blobs[1].data.sha },
      { path: 'Dockerfile', mode: '100644', type: 'blob', sha: blobs[2].data.sha }
    ]
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(railway): Rename db setup to .cjs for CommonJS compatibility\n\nProblem: package.json has "type": "module" so .js files are\ntreated as ES modules. railway-db-setup.js used require() which\ncaused "ReferenceError: require is not defined in ES module scope".\n\nSolution (architect-approved): Rename to .cjs extension so Node\ntreats it as CommonJS even with "type": "module" in package.json.\n\nThis fixes the crash loop once and for all.\n\nFixes: ReferenceError: require is not defined',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFiles().catch(console.error);
