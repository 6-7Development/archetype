import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function commitFix() {
  try {
    console.log('🐛 FIXING TASK MANAGER BUG');
    console.log('   Root cause: Duplicate task displays causing confusion');
    console.log('');
    
    const files = [
      {
        path: 'client/src/components/meta-sysop-chat.tsx',
        content: await fs.readFile('client/src/components/meta-sysop-chat.tsx', 'utf-8'),
        operation: 'modify'
      }
    ];
    
    const githubService = new GitHubService();
    
    const result = await githubService.commitFiles(
      files,
      'FIX: Remove duplicate TaskBoard display in Meta-SySop chat\n\nThe platform-healing page was showing TWO task displays:\n1. AgentProgress component at the top\n2. TaskBoard inside the chat component\n\nBoth were polling /api/platform/tasks and showing conflicting info.\nRemoved the duplicate TaskBoard from chat - now only shows AgentProgress.'
    );
    
    console.log('✅ Committed to GitHub!');
    console.log(`   Commit: ${result.data.commit.sha.substring(0, 7)}`);
    console.log('');
    console.log('🎯 THE BUG:');
    console.log('   • platform-healing.tsx showed AgentProgress ("0 / 5 tasks")');
    console.log('   • meta-sysop-chat.tsx ALSO showed TaskBoard ("Task Progress 2/6")');
    console.log('   • Both polling same endpoint → conflicting displays');
    console.log('');
    console.log('✅ THE FIX:');
    console.log('   • Removed TaskBoard from inside chat component');
    console.log('   • Removed unused imports and task polling');
    console.log('   • Now only AgentProgress displays at top');
    console.log('');
    console.log('⏱️  Render deploying now (~2-3 minutes)');
    console.log('🎉 TASK MANAGER UI FIXED!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

commitFix();
