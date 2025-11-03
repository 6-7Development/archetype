import { Octokit } from '@octokit/rest';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');
const branch = process.env.GITHUB_BRANCH || 'main';

async function commitMigrations() {
  console.log('[COMMIT] Reading migrations folder...');
  
  // Read all migration files
  const migrationFiles = await readdir('migrations');
  const metaFiles = await readdir('migrations/meta');
  
  console.log(`Found ${migrationFiles.length} migration files, ${metaFiles.length} meta files`);
  
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refData.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  
  // Create blobs for all files
  const blobs = [];
  const tree = [];
  
  // Main migration files
  for (const file of migrationFiles) {
    if (file === 'meta') continue; // Skip meta directory
    const content = await readFile(join('migrations', file), 'utf-8');
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64'
    });
    tree.push({
      path: `migrations/${file}`,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }
  
  // Meta files
  for (const file of metaFiles) {
    const content = await readFile(join('migrations/meta', file), 'utf-8');
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64'
    });
    tree.push({
      path: `migrations/meta/${file}`,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }
  
  console.log(`Creating tree with ${tree.length} files...`);
  
  const { data: newTree } = await octokit.git.createTree({
    owner, repo,
    base_tree: latestCommit.tree.sha,
    tree
  });
  
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'feat(db): Add Drizzle migrations folder to Git\n\nThe migrations/ folder was missing from Git, causing Railway\nbuild failure: "ERROR: /migrations: not found"\n\nThis folder contains the complete database schema migration\n(0000_giant_paladin.sql) that creates all 80+ tables.\n\nRequired for Railway deployment.',
    tree: newTree.sha,
    parents: [latestCommitSha],
    author: { name: 'LomuAI', email: 'lomu-ai@archetype.platform' }
  });
  
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  
  console.log(`✅ Committed: ${commit.sha.substring(0,7)}`);
  console.log(`🔗 https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

commitMigrations().catch(console.error);
