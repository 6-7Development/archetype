import { readFile } from 'fs/promises';

const lomuChatContent = await readFile('server/routes/lomuChat.ts', 'utf-8');

// Count tool definitions (in tools array)
const toolDefinitions = lomuChatContent.match(/name:\s*['"][^'"]+['"]/g) || [];
console.log(`\n📊 TOOL DEFINITIONS IN ARRAY: ${toolDefinitions.length} tools`);
console.log('First 10 tools:', toolDefinitions.slice(0, 10).map(t => t.match(/'([^']+)'/)?.[1]).join(', '));

// Count tool execution handlers (else if blocks)
const executionHandlers = lomuChatContent.match(/} else if \(name === ['"][^'"]+['"]\)/g) || [];
console.log(`\n🔧 TOOL EXECUTION HANDLERS: ${executionHandlers.length} handlers`);
console.log('First 10 handlers:', executionHandlers.slice(0, 10).map(h => h.match(/'([^']+)'/)?.[1]).join(', '));

// Critical 6 tools check
const critical6 = ['bash', 'edit', 'grep', 'packager_tool', 'restart_workflow', 'get_latest_lsp_diagnostics'];
console.log(`\n✅ CRITICAL 6 TOOLS CHECK:`);
for (const tool of critical6) {
  const hasDef = lomuChatContent.includes(`name: '${tool}'`);
  const hasHandler = lomuChatContent.includes(`name === '${tool}'`);
  const status = (hasDef && hasHandler) ? '✅' : '❌';
  console.log(`${status} ${tool}: ${hasDef ? 'Defined' : 'MISSING DEF'} | ${hasHandler ? 'Handler' : 'MISSING HANDLER'}`);
}

// Check platformHealing implementations
const platformHealingContent = await readFile('server/platformHealing.ts', 'utf-8');
console.log(`\n🛠️ PLATFORM HEALING IMPLEMENTATIONS:`);
const implementations = [
  'executeBashCommand',
  'editPlatformFile', 
  'grepPlatformFiles',
  'installPackages',
  'getLSPDiagnostics'
];
for (const impl of implementations) {
  const hasImpl = platformHealingContent.includes(`async ${impl}(`);
  console.log(`${hasImpl ? '✅' : '❌'} ${impl}`);
}
