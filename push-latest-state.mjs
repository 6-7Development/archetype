import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function pushLatestState() {
  try {
    console.log('🚀 PUSHING LATEST LOCAL STATE TO GITHUB');
    console.log('');
    
    // Get all modified files
    const files = [
      {
        path: 'client/src/components/lomu-chat.tsx',
        content: await fs.readFile('client/src/components/lomu-chat.tsx', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'client/src/pages/platform-healing.tsx',
        content: await fs.readFile('client/src/pages/platform-healing.tsx', 'utf-8'),
        operation: 'modify'
      }
    ];
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      files,
      'SYNC: Push latest Replit state to production\n\nSyncing local fixes:\n- Fixed task manager duplicate display\n- Added FileCode import\n- Removed duplicate TaskBoard from chat'
    );
    
    console.log('✅ Pushed to GitHub!');
    console.log(`   Commit: ${result.data.commit.sha.substring(0, 7)}`);
    console.log('');
    console.log('⏱️  Render will deploy in ~2-3 minutes');
    console.log('🎉 PRODUCTION WILL BE UPDATED!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

pushLatestState();
