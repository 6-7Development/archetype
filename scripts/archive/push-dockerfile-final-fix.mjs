import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function pushDockerfileFinalFix() {
  try {
    console.log('🔧 PUSHING FINAL DOCKERFILE FIX');
    console.log('');
    
    // Read current Dockerfile
    let dockerfile = await fs.readFile('Dockerfile', 'utf-8');
    
    // The problem: vite builds to /app/dist/public but we're copying /app/dist
    // Fix: Copy the built files to the correct location
    
    const oldLine = '# Copy built frontend from builder stage\nCOPY --from=frontend-builder /app/dist ./dist';
    const newLine = '# Copy built frontend from builder stage\nCOPY --from=frontend-builder /app/dist/public ./dist/public';
    
    dockerfile = dockerfile.replace(oldLine, newLine);
    
    const files = [{
      path: 'Dockerfile',
      content: dockerfile,
      operation: 'modify'
    }];
    
    console.log('📤 Pushing Dockerfile fix...');
    console.log('   • Fixed: COPY --from=frontend-builder /app/dist/public ./dist/public');
    console.log('');
    
    const githubService = new GitHubService();
    
    const commitMessage = `fix: Copy frontend build from correct vite output path

🐛 **Problem:**
Vite builds to \`dist/public\` but Dockerfile was copying from \`dist\`.
This caused the frontend files to be in the wrong location.

✅ **Solution:**
Changed: \`COPY --from=frontend-builder /app/dist ./dist\`
To: \`COPY --from=frontend-builder /app/dist/public ./dist/public\`

Now frontend files are at the correct path that the server expects.

🎯 **Impact:**
- Frontend files now in correct location
- Server can serve static files properly
- Build should complete successfully`;
    
    const result = await githubService.commitFiles(files, commitMessage);
    
    console.log('✅ Dockerfile fix pushed!');
    console.log('   📝 Commit: ' + result.data.commit.sha.substring(0, 7));
    console.log('');
    console.log('⏱️  Railway deploying now...');
    console.log('🎉 THIS SHOULD BE THE FINAL FIX!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

pushDockerfileFinalFix();
