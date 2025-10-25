import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitCompleteSSLFix() {
  try {
    console.log('🔒 Committing COMPLETE SSL fix to GitHub...');
    console.log('');
    
    const files = [
      {
        path: 'server/db.ts',
        content: await fs.readFile('server/db.ts', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'DEPLOY_SSL_AND_OWNER.md',
        content: await fs.readFile('DEPLOY_SSL_AND_OWNER.md', 'utf-8'),
        operation: 'create'
      }
    ];
    
    console.log('📦 Files to commit:');
    files.forEach(f => console.log(`   - ${f.path} (${f.operation})`));
    console.log('');
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      files,
      'FINAL SSL FIX: Enhanced logging + owner setup guide - FIXES DEPTH_ZERO_SELF_SIGNED_CERT'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.commit.sha}`);
    console.log(`   URL: https://github.com/6-7Development/archetype/commit/${result.commit.sha}`);
    console.log('');
    console.log('🚀 This commit fixes:');
    console.log('   ✅ SSL certificate rejection (rejectUnauthorized: false)');
    console.log('   ✅ Enhanced logging to verify SSL config');
    console.log('   ✅ Owner setup instructions included');
    console.log('');
    console.log('⏱️  Render will auto-deploy in ~2-3 minutes');
    console.log('📊 Watch: https://dashboard.render.com/');
    console.log('🌐 Live: https://archetype-x8b5.onrender.com');
    console.log('');
    console.log('🎯 After deploy, you can set the owner using:');
    console.log('   See: DEPLOY_SSL_AND_OWNER.md for instructions');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitCompleteSSLFix();
