import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitDiagnostics() {
  try {
    console.log('🔧 DEPLOYING EMERGENCY DIAGNOSTICS');
    console.log('   Adding console.log statements to track app initialization');
    console.log('');
    
    const files = [
      {
        path: 'client/src/main.tsx',
        content: await fs.readFile('client/src/main.tsx', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'client/src/App.tsx',
        content: await fs.readFile('client/src/App.tsx', 'utf-8'),
        operation: 'modify'
      }
    ];
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      files,
      'EMERGENCY: Add diagnostic logging to track black screen issue'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.data.commit.sha.substring(0, 7)}`);
    console.log('');
    console.log('📋 WHAT THIS DOES:');
    console.log('   • Logs when main.tsx starts');
    console.log('   • Logs when App component renders');
    console.log('   • Logs when providers initialize');
    console.log('   • Shows white error message if root element missing');
    console.log('');
    console.log('⏱️  Render deploying now (~2-3 minutes)');
    console.log('');
    console.log('📱 NEXT STEPS FOR USER:');
    console.log('   1. Wait for Render deployment to complete');
    console.log('   2. Open https://archetype-x8b5.onrender.com');
    console.log('   3. Open browser console (F12)');
    console.log('   4. Send screenshot of console logs');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitDiagnostics();
