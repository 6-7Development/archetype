import { execSync } from 'child_process';
import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function syncPackageLock() {
  try {
    console.log('🔧 SYNCING PACKAGE-LOCK.JSON');
    console.log('');
    
    // Run npm install to regenerate package-lock.json
    console.log('📦 Running npm install to sync lock file...');
    execSync('npm install', { stdio: 'inherit' });
    
    console.log('');
    console.log('📤 Reading updated package-lock.json...');
    const packageLock = await fs.readFile('package-lock.json', 'utf-8');
    
    const files = [{
      path: 'package-lock.json',
      content: packageLock,
      operation: 'modify'
    }];
    
    console.log('📤 Pushing package-lock.json to GitHub...');
    
    const githubService = new GitHubService();
    
    const commitMessage = `fix: Sync package-lock.json with package.json

🐛 **Problem:**
package-lock.json was out of sync after package.json changes.
Railway build failing with "Missing: @google/generative-ai@0.24.1 from lock file"

✅ **Solution:**
Regenerated package-lock.json via npm install to sync with package.json changes.

🎯 **Impact:**
- npm ci will work in Railway builds
- All dependencies properly locked
- Build should complete successfully`;
    
    const result = await githubService.commitFiles(files, commitMessage);
    
    console.log('');
    console.log('✅ Package-lock.json synced and pushed!');
    console.log('   📝 Commit: ' + result.data.commit.sha.substring(0, 7));
    console.log('');
    console.log('⏱️  Railway deploying now...');
    console.log('🎉 BUILD SHOULD SUCCEED THIS TIME!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout.toString());
    if (error.stderr) console.error('STDERR:', error.stderr.toString());
    process.exit(1);
  }
}

syncPackageLock();
