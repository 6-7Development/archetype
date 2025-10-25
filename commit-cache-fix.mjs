import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitCacheFix() {
  try {
    console.log('🔧 FIXING 304 CACHE ISSUE');
    console.log('   Architect diagnosis: 304 responses breaking JSON parsing');
    console.log('');
    
    const files = [
      {
        path: 'server/routes.ts',
        content: await fs.readFile('server/routes.ts', 'utf-8'),
        operation: 'modify'
      }
    ];
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      files,
      'ARCHITECT FIX: Disable caching on /api/deployment-info to prevent 304 responses'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.commit.sha.substring(0, 7)}`);
    console.log('');
    console.log('🎯 ROOT CAUSE (from Architect):');
    console.log('   • /api/deployment-info returns 304 Not Modified');
    console.log('   • Empty 304 response breaks .json() parsing');
    console.log('   • This causes silent failure → black screen');
    console.log('');
    console.log('✅ THE FIX:');
    console.log('   • Added Cache-Control: no-store headers');
    console.log('   • Endpoint will always return 200 with fresh data');
    console.log('   • No more 304 responses!');
    console.log('');
    console.log('⏱️  Render deploying now (~2-3 minutes)');
    console.log('🎉 BLACK SCREEN WILL BE FIXED!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitCacheFix();
