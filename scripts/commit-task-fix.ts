#!/usr/bin/env tsx

/**
 * Commit task-management.ts fix to GitHub
 */

import { GitHubService } from '../server/githubService';
import * as fs from 'fs';
import * as path from 'path';

async function commitTaskFix() {
  console.log('🚀 Committing task progress fix to GitHub...\n');

  // Check environment variables
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = process.env.GITHUB_REPO;
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.error('❌ Missing required environment variables:');
    console.error('   - GITHUB_TOKEN:', GITHUB_TOKEN ? '✓' : '✗');
    console.error('   - GITHUB_REPO:', GITHUB_REPO ? '✓' : '✗');
    process.exit(1);
  }

  const [owner, repo] = GITHUB_REPO.split('/');
  if (!owner || !repo) {
    console.error('❌ Invalid GITHUB_REPO format. Expected: "owner/repo"');
    process.exit(1);
  }

  console.log('📋 Repository:', GITHUB_REPO);
  console.log('🌿 Branch:', GITHUB_BRANCH);
  console.log('');

  const githubService = new GitHubService();

  // File to commit
  const modifiedFiles = ['server/tools/task-management.ts'];

  console.log('📝 Preparing to commit:\n');

  interface FileChange {
    path: string;
    content: string;
    operation?: 'create' | 'modify' | 'delete';
  }
  
  const changes: FileChange[] = [];
  const PROJECT_ROOT = process.cwd();

  for (const filePath of modifiedFiles) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`   ⚠️  ${filePath} (not found, skipping)`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    changes.push({ path: filePath, content });
    console.log(`   ✓ ${filePath} (${content.length} bytes)`);
  }

  if (changes.length === 0) {
    console.error('\n❌ No files to commit!');
    process.exit(1);
  }

  console.log(`\n📦 Committing to GitHub...`);

  const commitMessage = 'Fix task progress to count completed_pending_review as done';

  try {
    const result = await githubService.commitFiles(changes, commitMessage);
    
    console.log('\n✅ SUCCESS! Changes committed to GitHub\n');
    console.log('📍 Commit:', result.commitHash);
    console.log('🔗 URL:', result.commitUrl);
    console.log('\n🚀 Railway will auto-deploy from this commit');
    console.log('⏱️  Deployment typically takes 2-3 minutes');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Commit failed:', error.message);
    if (error.response) {
      console.error('GitHub API Error:', error.response.data);
    }
    process.exit(1);
  }
}

commitTaskFix().catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
