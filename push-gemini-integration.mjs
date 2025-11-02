import { GitHubService } from './server/githubService.js';
import fs from 'fs/promises';

async function pushGeminiIntegration() {
  try {
    console.log('🚀 PUSHING GEMINI 2.5 FLASH INTEGRATION TO GITHUB');
    console.log('');
    
    // All modified files for Gemini integration
    const filesToPush = [
      'server/gemini.ts',
      'server/lib/gemini-wrapper.ts',
      'server/routes/lomuChat.ts',
      'server/services/lomuJobManager.ts',
      'server/storage.ts',
      'replit.md'
    ];
    
    console.log('📦 Collecting modified files...');
    const files = [];
    
    for (const filePath of filesToPush) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        files.push({
          path: filePath,
          content: content,
          operation: 'modify'
        });
        console.log(`   ✓ ${filePath}`);
      } catch (error) {
        console.log(`   ⚠️  Skipped ${filePath} (not found or new file)`);
      }
    }
    
    console.log('');
    console.log(`📤 Pushing ${files.length} files to GitHub...`);
    
    const githubService = new GitHubService();
    
    const commitMessage = `feat: Migrate LomuAI to Gemini 2.5 Flash (97% cost reduction)

🎯 Hybrid AI Model Strategy:
- LomuAI: Google Gemini 2.5 Flash ($0.10/$0.40 per 1M tokens)
- I AM Architect: Claude Sonnet 4 ($3/$15 per 1M tokens)
- Direct Google API integration (Railway-independent)

✅ Features:
- Full streaming support with WebSocket broadcasting
- Robust tool calling (handles all edge cases)
- Comprehensive error handling
- Token counting and usage tracking

🔧 Critical Fixes:
- Tool calling format (single wrapper for all tools)
- Model version (gemini-2.5-flash, not 2.0)
- Multi-block tool result handling (structured objects)
- Single-text/primitive wrapping (all responses are objects)
- TypeScript compilation error in storage.ts

🧪 Verification:
- ✅ Architect approved (comprehensive review)
- ✅ No TypeScript/LSP errors
- ✅ Server running successfully
- ✅ All tool result paths return valid objects

💰 Impact: 97% cost savings on LomuAI operations while maintaining expert-level quality for architectural reviews.`;
    
    const result = await githubService.commitFiles(files, commitMessage);
    
    console.log('');
    console.log('✅ Successfully pushed to GitHub!');
    console.log(`   📝 Commit: ${result.data.commit.sha.substring(0, 7)}`);
    console.log(`   🌿 Branch: main`);
    console.log('');
    console.log('⏱️  Railway will auto-deploy in ~2-3 minutes');
    console.log('🎉 PRODUCTION DEPLOYMENT STARTING!');
    console.log('');
    console.log('📊 Changes Summary:');
    console.log('   • New: server/gemini.ts (direct Google API integration)');
    console.log('   • New: server/lib/gemini-wrapper.ts (Gemini utilities)');
    console.log('   • Modified: server/routes/lomuChat.ts (switched to Gemini)');
    console.log('   • Modified: server/services/lomuJobManager.ts (Gemini integration)');
    console.log('   • Fixed: server/storage.ts (TypeScript type error)');
    console.log('   • Updated: replit.md (hybrid AI strategy docs)');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error pushing to GitHub:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

pushGeminiIntegration();
