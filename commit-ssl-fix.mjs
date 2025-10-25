import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitFix() {
  try {
    console.log('🔧 Committing SSL fix to GitHub...');
    
    const content = await fs.readFile('server/routes/auth.ts', 'utf-8');
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      [{
        path: 'server/routes/auth.ts',
        content: content,
        operation: 'modify'
      }],
      'Fix session store SSL for production database (use pool instead of conString)'
    );
    
    console.log('✅ Committed!');
    console.log(`   SHA: ${result.commit.sha}`);
    console.log(`   URL: https://github.com/6-7Development/archetype/commit/${result.commit.sha}`);
    console.log('🚀 Render will auto-deploy');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitFix();
