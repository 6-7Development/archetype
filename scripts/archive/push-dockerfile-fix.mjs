import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function pushDockerfileFix() {
  try {
    console.log('🔧 PUSHING DOCKERFILE FIX TO GITHUB');
    console.log('');
    
    const filePath = 'Dockerfile';
    const content = await fs.readFile(filePath, 'utf-8');
    
    const files = [{
      path: filePath,
      content: content,
      operation: 'modify'
    }];
    
    console.log('📤 Pushing Dockerfile fix...');
    
    const githubService = new GitHubService();
    
    const commitMessage = `fix: Separate frontend and backend builds in Dockerfile

🐛 **Problem:** 
Frontend-builder stage was running full \`npm run build\` which includes BOTH:
- \`vite build\` (frontend) ✅
- \`esbuild server/index.ts\` (backend) ❌

This caused esbuild to try bundling server code during frontend build,
failing when resolving Gemini imports in server files.

✅ **Solution:**
Frontend-builder stage now ONLY builds frontend:
- Changed \`RUN npm run build\` → \`RUN npx vite build\`
- Copy only frontend-required files (client, shared, vite config)
- No server code in frontend stage

🎯 **Impact:**
- Fixes Railway deployment failure
- Proper separation of concerns
- Faster frontend build (doesn't bundle server)
- Backend runs from TypeScript source (as intended)`;
    
    const result = await githubService.commitFiles(files, commitMessage);
    
    console.log('');
    console.log('✅ Dockerfile fix pushed to GitHub!');
    console.log('   📝 Commit: ' + result.data.commit.sha.substring(0, 7));
    console.log('   🌿 Branch: main');
    console.log('');
    console.log('⏱️  Railway will auto-deploy in ~2-3 minutes');
    console.log('🎉 DEPLOYMENT SHOULD SUCCEED NOW!');
    console.log('');
    console.log('📊 What Changed:');
    console.log('   • Frontend stage: Only builds frontend (npx vite build)');
    console.log('   • Removed server code from frontend-builder');
    console.log('   • Production stage still gets full server TypeScript');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error pushing fix:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

pushDockerfileFix();
