
import { GitHubService } from '../server/githubService';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Meta-SySop Self-Deployment Script
 * Enables platform to update itself without Replit intervention
 */

async function deployMetaSySopUpdates() {
  console.log('🚀 Meta-SySop Self-Deployment System');
  console.log('════════════════════════════════════════');
  
  // Verify GitHub configuration
  const hasToken = !!process.env.GITHUB_TOKEN;
  const hasRepo = !!process.env.GITHUB_REPO;
  
  if (!hasToken || !hasRepo) {
    console.error('❌ GitHub not configured!');
    console.error('\nSetup instructions:');
    console.error('1. GITHUB_TOKEN=ghp_... (from https://github.com/settings/tokens)');
    console.error('2. GITHUB_REPO=owner/repo-name');
    process.exit(1);
  }
  
  const github = new GitHubService();
  const PROJECT_ROOT = process.cwd();
  
  // Files to deploy (Meta-SySop modified files)
  const filesToDeploy = [
    'server/routes/metaSysopChat.ts',
    'server/routes/common.ts',
    'client/src/components/meta-sysop-chat.tsx',
    'client/src/components/task-board.tsx',
    'client/src/components/mobile-workspace.tsx',
    'client/src/pages/platform-healing.tsx',
  ];
  
  console.log(`\n📦 Preparing ${filesToDeploy.length} files for deployment...`);
  
  const files = [];
  for (const filePath of filesToDeploy) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      files.push({ path: filePath, content });
      console.log(`✅ ${filePath}`);
    } catch (error) {
      console.warn(`⚠️  Skipped ${filePath} (not found)`);
    }
  }
  
  if (files.length === 0) {
    console.error('❌ No files to deploy!');
    process.exit(1);
  }
  
  // Commit to GitHub
  const commitMessage = `Meta-SySop: Unified AI logic, mobile fixes, self-update capability`;
  console.log(`\n📤 Committing to GitHub...`);
  console.log(`Message: ${commitMessage}`);
  
  try {
    const result = await github.commitFiles(files, commitMessage);
    
    console.log('\n✅ Deployment successful!');
    console.log(`Commit: ${result.commitHash}`);
    console.log(`URL: ${result.commitUrl}`);
    console.log('\n🚀 Render will auto-deploy in 2-3 minutes');
    console.log('🎯 Archetype can now self-update without Replit!');
    
  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

deployMetaSySopUpdates();
