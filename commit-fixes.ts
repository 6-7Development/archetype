#!/usr/bin/env tsx

import { GitHubService, FileChange } from './server/githubService';
import * as fs from 'fs/promises';

async function commitAllFixes() {
  console.log('📦 Preparing to commit all platform-healing fixes...');
  
  try {
    const github = new GitHubService();
    
    // Read all modified files
    const filesToCommit: FileChange[] = [
      {
        path: 'server/db.ts',
        content: await fs.readFile('server/db.ts', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'Dockerfile',
        content: await fs.readFile('Dockerfile', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'server/platformHealing.ts',
        content: await fs.readFile('server/platformHealing.ts', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'server/routes/metaSysopChat.ts',
        content: await fs.readFile('server/routes/metaSysopChat.ts', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'client/src/pages/platform-healing.tsx',
        content: await fs.readFile('client/src/pages/platform-healing.tsx', 'utf-8'),
        operation: 'modify'
      }
    ];
    
    console.log(`✅ Read ${filesToCommit.length} files`);
    
    // Commit all changes in a single commit
    const commitMessage = `fix: Platform healing chat and production fixes

- Database timeout fixes (5s → 30s, connection pooling, idle timeout 30s)
- Git installed in Docker for Meta-SySop commit/push functionality
- Platform healing production compatibility (git availability checks)
- Meta-SySop conversational chat (post-tool text buffering)
- Content aggregation with 30-second window (no duplicate bubbles)
- Removed auto-commit/auto-push toggles from UI
- Removed non-functional chatbar buttons (Build, AI Assist, Attach)
- listPlatformFiles handles missing directories in production

All fixes verified by architect and ready for deployment.`;
    
    console.log('\n📝 Committing to GitHub...');
    const result = await github.commitFiles(filesToCommit, commitMessage);
    
    console.log('\n✅ SUCCESS!');
    console.log(`Commit Hash: ${result.commitHash}`);
    console.log(`Commit URL: ${result.commitUrl}`);
    console.log('\n🚀 Railway will auto-deploy in ~2-3 minutes');
    console.log(`Monitor at: https://railway.app/`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ COMMIT FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

commitAllFixes();
