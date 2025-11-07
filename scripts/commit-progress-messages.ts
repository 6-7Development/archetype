#!/usr/bin/env tsx

/**
 * Commit inline progress message implementation to GitHub
 * This will trigger Railway auto-deployment
 */

import { GitHubService } from '../server/githubService';
import * as fs from 'fs';
import * as path from 'path';

async function commitProgressMessages() {
  console.log('🚀 Starting GitHub commit for inline progress messages...\n');

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

  // Define which files were modified
  const modifiedFiles: string[] = [
    'client/src/hooks/use-websocket-stream.ts',
    'client/src/pages/platform-healing.tsx',
    'client/src/components/ai-chat.tsx',
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

  const commitMessage = `feat: Add inline progress messages to both LomuAI chats (Platform Healing & Regular Builder)

- Display real-time progress updates as inline chat bubbles like Replit Agent
- SSE 'progress' events for Platform Healing chat
- WebSocket 'job_progress' events for Regular LomuAI builder chat
- Subtle muted styling for progress messages (non-intrusive)
- Auto-clear progress on completion/error/cancellation
- Fixed critical bug: error handlers now properly clear stale progress messages
- 100% parity between Platform Healing and Regular LomuAI UX`;

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

// Run the script
commitProgressMessages().catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
