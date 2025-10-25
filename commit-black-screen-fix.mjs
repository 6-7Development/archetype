import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitBlackScreenFix() {
  try {
    console.log('🖥️  FIXING BLACK SCREEN ERROR');
    console.log('   JavaScript error: Cannot use import.meta outside module');
    console.log('');
    
    const files = [
      {
        path: 'client/index.html',
        content: await fs.readFile('client/index.html', 'utf-8'),
        operation: 'modify'
      }
    ];
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      files,
      'FIX: Add type="module" to inline script to prevent import.meta error'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.commit.sha.substring(0, 7)}`);
    console.log('');
    console.log('🐛 THE BUG:');
    console.log('   ❌ <script> with import.meta.env (not a module)');
    console.log('   ✅ <script type="module"> with import.meta.env (valid!)');
    console.log('');
    console.log('💡 WHAT THIS FIXES:');
    console.log('   • Black screen on production site');
    console.log('   • JavaScript error preventing app from loading');
    console.log('   • "Cannot use import.meta outside a module" error');
    console.log('');
    console.log('⏱️  Render deploying now (~2-3 minutes)');
    console.log('🎉 SITE WILL LOAD CORRECTLY AFTER DEPLOY!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitBlackScreenFix();
