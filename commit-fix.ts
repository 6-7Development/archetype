import { GitHubService } from './server/githubService';
import * as fs from 'fs/promises';

async function commitFix() {
  try {
    console.log('🔧 Committing Meta-SySop task cleanup fix...');
    
    const githubService = new GitHubService();
    
    // Read the changed file
    const content = await fs.readFile('./server/routes/metaSysopChat.ts', 'utf-8');
    
    const commitMessage = `fix: Meta-SySop task cleanup - prevent stuck tasks

Critical fix for Meta-SySop task management:

1. Session scoping: Cleanup now uses tracked activeTaskListId from THIS session
   (prevents marking wrong sessions complete)

2. Sequencing: Cleanup moved AFTER safety check passes
   (prevents masking genuine failures)

3. Consistent state: Uses updateTask() helper to properly update each task
   (prevents inconsistent database state)

This prevents tasks from remaining stuck when Meta-SySop exits early
(timeout, crash, etc) while preserving audit trail and preventing
data corruption.

Architect reviewed and approved for production deployment.`;

    const files = [
      {
        path: 'server/routes/metaSysopChat.ts',
        content
      }
    ];

    const result = await githubService.commitFiles(
      files,
      commitMessage
    );

    console.log('✅ Successfully committed and pushed to GitHub!');
    console.log(`   Commit SHA: ${result.commitHash}`);
    console.log(`   Commit URL: ${result.commitUrl}`);
    console.log('\n🚀 Render will now auto-deploy this fix to production');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitFix();
