// Temporary script to find Brigido in platform-healing.tsx
const fs = require('fs');

try {
  const content = fs.readFileSync('./client/src/pages/platform-healing.tsx', 'utf8');
  const lines = content.split('\n');
  
  console.log(`File has ${lines.length} lines`);
  
  // Search for Brigido (case insensitive)
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes('brigido')) {
      console.log(`Line ${index + 1}: ${line}`);
    }
  });
  
  // Also check around lines 591-593
  console.log('\nLines 589-595:');
  for (let i = 588; i < 595; i++) {
    if (lines[i]) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
} catch (error) {
  console.error('Error:', error.message);
}