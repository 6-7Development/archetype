const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'pages', 'platform-healing.tsx');

console.log('🔧 LomuAI: Removing Brigido badge from platform-healing.tsx');

try {
  // Read the current file content
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log(`📄 Original file: ${lines.length} lines`);
  
  // Show context around lines 591-593
  console.log('\n📍 Content around target lines:');
  for (let i = 588; i < 596; i++) {
    const lineNum = i + 1;
    const line = lines[i] || '';
    const marker = (lineNum >= 591 && lineNum <= 593) ? '❌ REMOVE' : '  ';
    console.log(`${marker} ${lineNum.toString().padStart(3, ' ')}: ${line}`);
  }
  
  // Remove lines 591-593 (indices 590-592)
  const newLines = [
    ...lines.slice(0, 590),  // Lines 1-590
    ...lines.slice(593)      // Lines 594+
  ];
  
  console.log(`\n✂️  Removed ${lines.length - newLines.length} lines`);
  console.log(`📄 New file: ${newLines.length} lines`);
  
  // Write the corrected content
  const correctedContent = newLines.join('\n');
  fs.writeFileSync(filePath, correctedContent, 'utf8');
  
  console.log('✅ Successfully removed Brigido badge');
  console.log('🏷️  Commit message: "Remove Brigido badge - LomuAI"');
  
} catch (error) {
  console.error('❌ Error processing file:', error.message);
  process.exit(1);
}

// Clean up this script
setTimeout(() => {
  try {
    fs.unlinkSync(__filename);
    console.log('🧹 Cleaned up temporary script');
  } catch (e) {
    // Ignore cleanup errors
  }
}, 100);