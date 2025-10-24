#!/usr/bin/env tsx
import { GitHubService } from '../server/githubService';
import * as fs from 'fs';
import * as path from 'path';

async function testDeploy() {
  console.log('🧪 Testing Render deployment trigger...\n');

  const githubService = new GitHubService();
  const PROJECT_ROOT = process.cwd();

  // Make a tiny change to test deployment
  const testFilePath = 'client/src/pages/admin.tsx';
  const fullPath = path.join(PROJECT_ROOT, testFilePath);
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // Add a comment to trigger deployment test
  const timestamp = new Date().toISOString();
  if (!content.includes('RENDER DEPLOY TEST')) {
    content = `// RENDER DEPLOY TEST - ${timestamp}\n${content}`;
  } else {
    content = content.replace(/\/\/ RENDER DEPLOY TEST - .+/, `// RENDER DEPLOY TEST - ${timestamp}`);
  }
  
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`✓ Updated ${testFilePath} with timestamp`);

  // Commit WITHOUT [Platform-SySop] prefix
  const commitMessage = `Update deployment test timestamp

Test if Render auto-deploys commits made via GitHub API.
Timestamp: ${timestamp}`;

  try {
    const result = await githubService.commitFiles(
      [{ path: testFilePath, content }],
      commitMessage
    );
    
    console.log('\n✅ Committed to GitHub');
    console.log('📍 Commit:', result.commitHash);
    console.log('🔗 URL:', result.commitUrl);
    console.log('\n⏱️  Check Render dashboard in 1 minute:');
    console.log('   https://dashboard.render.com');
    console.log('\n   If this deploys, the issue is the [Platform-SySop] prefix');
    console.log('   If this does NOT deploy, Render has a filter against API commits');
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

testDeploy().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
