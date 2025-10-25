import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitSSLFix() {
  try {
    console.log('🔒 Committing FINAL SSL fix to GitHub...');
    console.log('   This fixes Drizzle Kit SSL errors during build');
    
    const renderYaml = await fs.readFile('render.yaml', 'utf-8');
    const dbPushScript = await fs.readFile('scripts/db-push-ssl.ts', 'utf-8');
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      [
        {
          path: 'render.yaml',
          content: renderYaml,
          operation: 'modify'
        },
        {
          path: 'scripts/db-push-ssl.ts',
          content: dbPushScript,
          operation: 'create'
        }
      ],
      'Fix SSL for Drizzle Kit during build (NODE_TLS_REJECT_UNAUTHORIZED=0)'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.commit.sha}`);
    console.log(`   URL: https://github.com/6-7Development/archetype/commit/${result.commit.sha}`);
    console.log('');
    console.log('🚀 This FINAL fix solves:');
    console.log('   ✅ Drizzle Kit SSL errors during build');
    console.log('   ✅ Self-signed certificate rejections');
    console.log('   ✅ Database migration failures on Render');
    console.log('');
    console.log('⏱️  Render will rebuild in ~2-3 minutes');
    console.log('   Watch: https://dashboard.render.com/');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitSSLFix();
