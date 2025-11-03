import { Octokit } from '@octokit/rest';
import { readFile } from 'fs/promises';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitFiles() {
  console.log('[COMMIT] Reading files...');
  const [sqlContent, startupContent] = await Promise.all([
    readFile('add-missing-columns.sql', 'utf-8'),
    readFile('railway-start.sh', 'utf-8')
  ]);
  
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  const blobs = await Promise.all([
    octokit.git.createBlob({ owner, repo, content: Buffer.from(sqlContent).toString('base64'), encoding: 'base64' }),
    octokit.git.createBlob({ owner, repo, content: Buffer.from(startupContent).toString('base64'), encoding: 'base64' })
  ]);
  
  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree: [
      { path: 'add-missing-columns.sql', mode: '100644', type: 'blob', sha: blobs[0].data.sha },
      { path: 'railway-start.sh', mode: '100755', type: 'blob', sha: blobs[1].data.sha }
    ]
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'fix(db): Add missing folder_id columns to files and file_uploads\n\nRailway database was missing folder_id columns in files and\nfile_uploads tables, causing "column folder_id does not exist"\nerror during startup database connection test.\n\nAdded SQL migration to safely add columns if missing.',
    tree: tree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitFiles().catch(console.error);
