
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = process.cwd();

function log(message: string) {
  console.log(`[DEPLOY] ${message}`);
}

function exec(command: string): string {
  try {
    return execSync(command, { 
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

async function main() {
  log('🚀 Starting deployment to Render...');
  
  // Check for uncommitted changes
  log('📋 Checking for uncommitted changes...');
  const status = exec('git status --porcelain');
  
  if (!status.trim()) {
    log('✅ No changes to commit. Everything is up to date.');
    log('💡 Pushing latest commit to trigger Render deployment...');
  } else {
    log(`📝 Found ${status.split('\n').filter(l => l.trim()).length} file(s) with changes`);
    
    // Stage all changes
    log('📦 Staging all changes...');
    exec('git add -A');
    
    // Create commit
    const timestamp = new Date().toISOString();
    const commitMessage = `Deploy: Full platform update - ${timestamp}`;
    log(`💾 Creating commit: "${commitMessage}"`);
    exec(`git commit -m "${commitMessage}"`);
  }
  
  // Push to GitHub
  log('🔄 Pushing to GitHub (triggers Render auto-deploy)...');
  const branch = process.env.GITHUB_BRANCH || 'main';
  exec(`git push origin ${branch}`);
  
  log('✅ SUCCESS! Changes pushed to GitHub');
  log('');
  log('📍 Next Steps:');
  log('   1. Render will detect the push within 30 seconds');
  log('   2. Build process will start (3-5 minutes)');
  log('   3. Deployment will complete (1-2 minutes)');
  log('   4. Total time: ~5-8 minutes');
  log('');
  log('🔗 Monitor deployment:');
  log('   - Render Dashboard: https://dashboard.render.com');
  log('   - Live Site: https://archetype-x8b5.onrender.com');
  log('');
  log('✨ Deployment initiated successfully!');
}

main().catch(error => {
  console.error('[DEPLOY ERROR]', error.message);
  process.exit(1);
});
