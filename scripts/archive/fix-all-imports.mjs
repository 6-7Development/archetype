import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';

// Files that need .ts extensions added to local imports
const filesToFix = [
  'server/routes/lomuChat.ts',
  'server/routes/architectAgent.ts',
  'server/routes/tools.ts',
  'server/routes/taskRunner.ts',
  'server/routes/messageQueue.ts',
  'server/routes/autonomySettings.ts',
  'server/routes/imageGeneration.ts',
  'server/routes/dynamicIntelligence.ts',
  'server/routes/planMode.ts',
  'server/routes/designPrototype.ts',
  'server/routes/workflows.ts',
  'server/routes/automations.ts',
  'server/routes/generalAgent.ts',
  'server/routes/common.ts',
  'server/routes/diagnostics.ts',
  'server/routes/aiKnowledge.ts',
  'server/routes/chat.ts',
];

let totalFixed = 0;

for (const file of filesToFix) {
  try {
    let content = await readFile(file, 'utf-8');
    const originalContent = content;
    
    // Fix imports: from '../something' -> from '../something.ts'
    // Fix imports: from './something' -> from './something.ts'
    // Only for local imports (starting with . or ..)
    content = content.replace(
      /from ['"](\.\.[/][^'"]+)(?<!\.ts)['"]/g,
      "from '$1.ts'"
    );
    content = content.replace(
      /from ['"](\.[/][^'"]+)(?<!\.ts)['"]/g,
      "from '$1.ts'"
    );
    
    if (content !== originalContent) {
      await writeFile(file, content, 'utf-8');
      const lines = content.split('\n').length;
      console.log(`✅ Fixed: ${file}`);
      totalFixed++;
    } else {
      console.log(`⏭️  Skipped: ${file} (no changes needed)`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${file}:`, error.message);
  }
}

console.log(`\n📊 Total files fixed: ${totalFixed}`);
