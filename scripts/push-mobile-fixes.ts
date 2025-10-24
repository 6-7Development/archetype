#!/usr/bin/env tsx
/**
 * Push mobile chat fixes to GitHub
 */

import { GitHubService } from '../server/githubService';
import * as fs from 'fs';
import * as path from 'path';

async function pushFixes() {
  console.log('🚀 Pushing mobile chat fixes to GitHub...\n');

  const githubService = new GitHubService();
  const PROJECT_ROOT = process.cwd();

  // Files to commit
  const filesToCommit = [
    'client/src/components/meta-sysop-chat.tsx',
    'client/src/components/ai-chat.tsx',
    'client/src/components/mobile-workspace.tsx',
    'client/index.html',
    'client/src/pages/admin.tsx',
  ];

  const changes = [];

  for (const filePath of filesToCommit) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      changes.push({ path: filePath, content });
      console.log(`✓ ${filePath}`);
    }
  }

  const commitMessage = `Fix mobile chat input visibility + cache busting

- Fixed mobile chat input pushed off-screen issue
- Applied flex-shrink-0 to chat input containers
- Added min-h-0 to scrollable parents
- Implemented cache-busting HTTP headers
- Added deployment test marker to admin page

Mobile users can now access chat input on all screen sizes.`;

  try {
    const result = await githubService.commitFiles(changes, commitMessage);
    console.log('\n✅ SUCCESS!');
    console.log('📍 Commit:', result.commitHash);
    console.log('🔗 URL:', result.commitUrl);
    console.log('\n🚀 Render will auto-deploy in 2-3 minutes');
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

pushFixes().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
