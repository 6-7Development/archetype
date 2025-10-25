import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitFix() {
  try {
    console.log('🔧 Committing WebSocket protocol fix to GitHub...');
    
    const content = await fs.readFile('vite.config.ts', 'utf-8');
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      [{
        path: 'vite.config.ts',
        content: content,
        operation: 'modify'
      }],
      'Fix WebSocket protocol for Replit HTTPS (wss instead of ws)'
    );
    
    console.log('✅ Committed successfully!');
    console.log(`   SHA: ${result.commit.sha}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitFix();
