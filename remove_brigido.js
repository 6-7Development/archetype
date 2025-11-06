const fs = require('fs');
const path = require('path');

const filePath = './client/src/pages/platform-healing.tsx';

try {
  // Read the file
  console.log('Reading platform-healing.tsx...');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log(`File has ${lines.length} lines`);
  
  // Find and show lines 591-593 (0-indexed: 590-592)
  console.log('\nLines 591-593 before removal:');
  for (let i = 590; i < 593; i++) {
    if (lines[i]) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
  
  // Remove lines 591-593 (0-indexed: 590-592)
  const newLines = [
    ...lines.slice(0, 590),  // Lines before 591
    ...lines.slice(593)      // Lines after 593
  ];
  
  console.log(`\nAfter removal: ${newLines.length} lines (removed ${lines.length - newLines.length} lines)`);
  
  // Write the modified content back
  const newContent = newLines.join('\n');
  fs.writeFileSync(filePath, newContent, 'utf8');
  
  console.log('✅ Brigido badge removed from lines 591-593');
  console.log('File saved successfully!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}

// Clean up this script
try {
  fs.unlinkSync(__filename);
  console.log('🧹 Cleanup: Removed temporary script');
} catch (e) {
  // Ignore cleanup errors
}