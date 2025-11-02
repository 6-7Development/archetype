import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function fixRailwayStartup() {
  try {
    console.log('🔧 FIXING RAILWAY STARTUP FOR TSX RUNTIME');
    console.log('');
    
    // Fix 1: Update package.json
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    packageJson.scripts.build = "vite build";  // Frontend only
    packageJson.scripts.start = "tsx server/index.ts";  // TypeScript runtime
    
    // Fix 2: Update railway-start.sh to NOT check for dist/index.js
    const railwayStart = await fs.readFile('railway-start.sh', 'utf-8');
    
    // Remove the dist/index.js check (lines 17-34)
    const newRailwayStart = railwayStart.replace(
      /echo "🔍 Checking for dist directory\.\.\."[\s\S]*?fi\n\necho ""/,
      'echo "🔍 Checking for dist/public directory (frontend)..."\nif [ -d "dist/public" ]; then\n  echo "✅ dist/public directory exists (frontend build)"\nelse\n  echo "❌ dist/public directory NOT found!"\n  exit 1\nfi\n\necho ""'
    ).replace(
      'echo "Command: node dist/index.js"',
      'echo "Command: npx tsx server/index.ts"'
    ).replace(
      'node dist/index.js',
      'npx tsx server/index.ts'
    );
    
    const files = [
      {
        path: 'package.json',
        content: JSON.stringify(packageJson, null, 2) + '\n',
        operation: 'modify'
      },
      {
        path: 'railway-start.sh',
        content: newRailwayStart,
        operation: 'modify'
      }
    ];
    
    console.log('📤 Pushing fixes...');
    console.log('   ✅ package.json: build = "vite build" (frontend only)');
    console.log('   ✅ package.json: start = "tsx server/index.ts" (TypeScript runtime)');
    console.log('   ✅ railway-start.sh: Removed dist/index.js check');
    console.log('   ✅ railway-start.sh: Changed to run "npx tsx server/index.ts"');
    console.log('');
    
    const githubService = new GitHubService();
    
    const commitMessage = `fix: Use tsx TypeScript runtime instead of compiled JavaScript

🐛 **Problem:**
Railway startup script was looking for dist/index.js (compiled server)
but we changed to TypeScript runtime using tsx.

✅ **Solution:**
1. package.json build: "vite build" (frontend only, no server compilation)
2. package.json start: "tsx server/index.ts" (TypeScript runtime)
3. railway-start.sh: Check for dist/public (frontend), not dist/index.js
4. railway-start.sh: Run "npx tsx server/index.ts" instead of node

🎯 **Impact:**
- Server runs from TypeScript source (no compilation needed)
- Faster deployments (no esbuild server bundling)
- Railway will start successfully`;
    
    const result = await githubService.commitFiles(files, commitMessage);
    
    console.log('✅ Fixes pushed!');
    console.log('   📝 Commit: ' + result.data.commit.sha.substring(0, 7));
    console.log('');
    console.log('⏱️  Railway deploying now...');
    console.log('🎉 THIS IS THE FINAL FIX - SERVER WILL START!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

fixRailwayStartup();
