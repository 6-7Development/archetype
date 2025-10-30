import { GitHubService } from '../server/githubService';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function fixGitHubDeployment() {
  console.log('🚀 Fixing GitHub deployment by pushing correct files...');
  
  const githubService = new GitHubService();
  
  // Read all 6 files from Replit
  const files = [
    'server/routes/chat.ts',
    'server/routes/lomuChat.ts',
    'server/platformRoutes.ts',
    'server/db.ts',
    'client/src/components/lomu-chat.tsx',
    'shared/schema.ts',
  ];
  
  const changes = files.map(filePath => {
    const fullPath = resolve(process.cwd(), filePath);
    const content = readFileSync(fullPath, 'utf-8');
    console.log(`✅ Read ${filePath} (${content.length} bytes)`);
    return {
      path: filePath,
      content,
      operation: 'modify' as const,
    };
  });
  
  const result = await githubService.commitFiles(
    changes,
    'Sync Replit to GitHub: Fix imports, Meta-SySop fixes, TaskBoard integration'
  );
  
  console.log('✅ SUCCESS!');
  console.log(`Commit: ${result.commitHash}`);
  console.log(`URL: ${result.commitUrl}`);
  console.log('🚀 Render will auto-deploy in 2-3 minutes');
}

fixGitHubDeployment().catch(console.error);
