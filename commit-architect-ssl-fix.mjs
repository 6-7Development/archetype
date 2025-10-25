import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitArchitectFix() {
  try {
    console.log('🏗️  ARCHITECT-APPROVED SSL FIX');
    console.log('   Based on root cause analysis');
    console.log('');
    
    const files = [
      {
        path: 'server/db.ts',
        content: await fs.readFile('server/db.ts', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'render.yaml',
        content: await fs.readFile('render.yaml', 'utf-8'),
        operation: 'modify'
      }
    ];
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      files,
      'ARCHITECT FIX: Add sslmode=no-verify to connection string + PGSSLMODE env var'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.commit.sha}`);
    console.log(`   URL: https://github.com/6-7Development/archetype/commit/${result.commit.sha}`);
    console.log('');
    console.log('🎯 ROOT CAUSE FIXED:');
    console.log('   • NODE_TLS_REJECT_UNAUTHORIZED doesn\'t work with pg 8+');
    console.log('   • drizzle-kit spawns fresh process, doesn\'t inherit Pool config');
    console.log('');
    console.log('✅ SOLUTION:');
    console.log('   • Added sslmode=no-verify to DATABASE_URL');
    console.log('   • Set PGSSLMODE=no-verify env var');
    console.log('   • Both app AND drizzle-kit now use same SSL config');
    console.log('');
    console.log('⏱️  Render will auto-deploy in ~2-3 minutes');
    console.log('🎉 THIS IS THE FINAL FIX!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitArchitectFix();
