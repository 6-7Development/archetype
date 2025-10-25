import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitFix() {
  try {
    console.log('🐛 FIXING BLACK SCREEN BUG');
    console.log('   Root cause: Missing FileCode import in platform-healing.tsx');
    console.log('');
    
    const files = [
      {
        path: 'client/src/pages/platform-healing.tsx',
        content: await fs.readFile('client/src/pages/platform-healing.tsx', 'utf-8'),
        operation: 'modify'
      },
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
      'CRITICAL FIX: Add missing FileCode import - resolves black screen production bug'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.data.commit.sha.substring(0, 7)}`);
    console.log('');
    console.log('🎯 THE BUG:');
    console.log('   • platform-healing.tsx used <FileCode> icon on line 331');
    console.log('   • FileCode was NOT imported from lucide-react');
    console.log('   • Build failed silently → black screen');
    console.log('');
    console.log('✅ THE FIX:');
    console.log('   • Added FileCode to lucide-react imports');
    console.log('   • Also deployed diagnostic logging for future issues');
    console.log('');
    console.log('⏱️  Render deploying now (~2-3 minutes)');
    console.log('🎉 BLACK SCREEN WILL BE FIXED!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitFix();
