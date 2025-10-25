import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitOwnerEndpoint() {
  try {
    console.log('🔧 Committing owner setup endpoint...');
    console.log('   Creates simple API to set yourself as owner');
    console.log('');
    
    const files = [
      {
        path: 'server/routes/owner-setup.ts',
        content: await fs.readFile('server/routes/owner-setup.ts', 'utf-8'),
        operation: 'create'
      },
      {
        path: 'server/storage.ts',
        content: await fs.readFile('server/storage.ts', 'utf-8'),
        operation: 'modify'
      },
      {
        path: 'server/routes.ts',
        content: await fs.readFile('server/routes.ts', 'utf-8'),
        operation: 'modify'
      }
    ];
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      files,
      'Add owner setup API endpoint - No database access needed!'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.commit.sha}`);
    console.log(`   URL: https://github.com/6-7Development/archetype/commit/${result.commit.sha}`);
    console.log('');
    console.log('🎯 NEW ENDPOINTS:');
    console.log('   POST /api/setup-owner - Make yourself owner (admin only)');
    console.log('   GET /api/owner-status - Check current owner');
    console.log('');
    console.log('📋 HOW TO USE:');
    console.log('   1. Login as admin on production site');
    console.log('   2. Open browser console');
    console.log('   3. Run: fetch("/api/setup-owner", {method:"POST"}).then(r=>r.json())');
    console.log('   4. Done! You are now the owner!');
    console.log('');
    console.log('⏱️  Render will auto-deploy in ~2-3 minutes');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitOwnerEndpoint();
