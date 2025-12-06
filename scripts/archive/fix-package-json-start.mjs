import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function fixPackageJsonStart() {
  try {
    console.log('🔧 FIXING PACKAGE.JSON START SCRIPT');
    console.log('');
    
    // Read current package.json
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    
    // Update scripts
    packageJson.scripts.build = 'vite build';
    packageJson.scripts.start = 'NODE_ENV=production tsx server/index.ts';
    
    const files = [{
      path: 'package.json',
      content: JSON.stringify(packageJson, null, 2) + '\n',
      operation: 'modify'
    }];
    
    console.log('📤 Pushing package.json fix...');
    console.log('   • build: "vite build" (frontend only)');
    console.log('   • start: "tsx server/index.ts" (run from TypeScript)');
    console.log('');
    
    const githubService = new GitHubService();
    
    const commitMessage = `fix: Run server from TypeScript source instead of bundled dist/index.js

🐛 **Problem:**
Dockerfile change removed esbuild backend build, so dist/index.js doesn't exist.
Railway crashes with "dist/index.js NOT found!"

✅ **Solution:**
1. build script: "vite build" only (frontend)
2. start script: "tsx server/index.ts" (run TypeScript directly)

This matches dev approach and eliminates need for esbuild bundling.

🎯 **Impact:**
- Fixes Railway crash loop
- Server runs from TypeScript source (cleaner)
- No more esbuild complexity
- Consistent with local dev environment`;
    
    const result = await githubService.commitFiles(files, commitMessage);
    
    console.log('✅ Package.json fix pushed!');
    console.log('   📝 Commit: ' + result.data.commit.sha.substring(0, 7));
    console.log('');
    console.log('⏱️  Railway will auto-deploy in ~2-3 minutes');
    console.log('🎉 SERVER SHOULD START SUCCESSFULLY NOW!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixPackageJsonStart();
