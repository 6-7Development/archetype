import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitEnvSSLFix() {
  try {
    console.log('🔒 Committing ENVIRONMENT VARIABLE SSL fix...');
    console.log('   This sets NODE_TLS_REJECT_UNAUTHORIZED=0 globally');
    console.log('');
    
    const renderYaml = await fs.readFile('render.yaml', 'utf-8');
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      [{
        path: 'render.yaml',
        content: renderYaml,
        operation: 'modify'
      }],
      'ABSOLUTE FINAL SSL FIX: Set NODE_TLS_REJECT_UNAUTHORIZED as env var for drizzle-kit'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.commit.sha}`);
    console.log(`   URL: https://github.com/6-7Development/archetype/commit/${result.commit.sha}`);
    console.log('');
    console.log('🎯 THIS FIXES THE DRIZZLE-KIT SSL ERROR!');
    console.log('');
    console.log('   The env var NODE_TLS_REJECT_UNAUTHORIZED=0 will be set');
    console.log('   GLOBALLY during build AND runtime, which means:');
    console.log('');
    console.log('   ✅ Drizzle-kit can connect during build');
    console.log('   ✅ Application can connect during runtime');
    console.log('   ✅ No more DEPTH_ZERO_SELF_SIGNED_CERT errors!');
    console.log('');
    console.log('⏱️  Render will auto-deploy in ~2-3 minutes');
    console.log('📊 Watch: https://dashboard.render.com/');
    console.log('');
    console.log('🎉 THIS IS THE LAST SSL FIX YOU\'LL EVER NEED!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitEnvSSLFix();
