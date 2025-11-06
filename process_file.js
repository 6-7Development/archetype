#!/usr/bin/env node
const fs = require('fs');

// Read the original file
const originalContent = fs.readFileSync('./client/src/pages/platform-healing.tsx', 'utf8');
const lines = originalContent.split('\n');

console.log(`Original file has ${lines.length} lines`);

// Show what's on lines 591-593 before removal
console.log('\nContent on lines 591-593:');
console.log(`Line 591: ${lines[590] || '(empty)'}`);
console.log(`Line 592: ${lines[591] || '(empty)'}`);
console.log(`Line 593: ${lines[592] || '(empty)'}`);

// Remove lines 591-593 (array indices 590-592)
const newLines = [
  ...lines.slice(0, 590),    // Keep lines 1-590
  ...lines.slice(593)        // Keep lines 594+
];

console.log(`\nNew file will have ${newLines.length} lines (removed ${lines.length - newLines.length} lines)`);

// Write the modified content back
const modifiedContent = newLines.join('\n');
fs.writeFileSync('./client/src/pages/platform-healing.tsx', modifiedContent, 'utf8');

console.log('✅ Successfully removed Brigido badge from lines 591-593');

// Clean up this temp file
fs.unlinkSync('./process_file.js');