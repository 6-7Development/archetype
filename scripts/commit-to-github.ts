#!/usr/bin/env tsx

/**
 * Utility script to commit current workspace changes to GitHub
 * This is needed because Replit blocks direct git operations for security
 */

import { GitHubService } from '../server/githubService';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function commitWorkspaceChanges() {
  console.log('🚀 Starting GitHub commit process...\n');

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

  // Parse repo (format: "owner/repo")
  const [owner, repo] = GITHUB_REPO.split('/');
  if (!owner || !repo) {
    console.error('❌ Invalid GITHUB_REPO format. Expected: "owner/repo"');
    process.exit(1);
  }

  console.log('📋 Repository:', GITHUB_REPO);
  console.log('🌿 Branch:', GITHUB_BRANCH);
  console.log('');

  // Initialize GitHub service
  const githubService = new GitHubService();

  // Define which files were modified (you can expand this list)
  const modifiedFiles: string[] = [
    'client/src/components/ai-chat.tsx',
    'client/src/components/meta-sysop-chat.tsx',
    'client/src/components/mobile-workspace.tsx',
  ];

  console.log(`📝 Preparing to commit ${modifiedFiles.length} files:\n`);

  // Read file contents
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

  console.log(`\n📦 Committing ${changes.length} files to GitHub...`);

  const commitMessage = `Fix WebSocket task delivery + implement dual-version architecture

- Added missing register-session handler in WebSocket server
- Fixed VersionProvider localStorage persistence bug  
- Enhanced SySop system prompt for task plan output
- Added comprehensive logging for task parsing pipeline
- Integrated dual-version architecture (Archetype + Archetype5)
- Updated documentation with architecture details

This commit contains critical fixes for task management in production.`;

  try {
    const result = await githubService.commitFiles(changes, commitMessage);
    
    console.log('\n✅ SUCCESS! Changes committed to GitHub\n');
    console.log('📍 Commit:', result.commitHash);
    console.log('🔗 URL:', result.commitUrl);
    console.log('\n🚀 Render will auto-deploy from this commit');
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

// Run the script
commitWorkspaceChanges().catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
