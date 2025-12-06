import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

const zip = new AdmZip();

// Strict exclusions - only what's absolutely not needed
const excludePatterns = [
  'node_modules',
  '.git',
  'dist',
  '.cache',
  '.replit',
  '.config',
  '.upm',
  '.local',
  'replit.nix',
  'create-clean-zip.ts',
  'archetype-project.zip',
  'attached_assets',
  'package-lock.json',
];

function shouldExclude(filePath: string): boolean {
  // Check exclude patterns
  if (excludePatterns.some(pattern => filePath.includes(pattern))) {
    return true;
  }
  
  // Exclude image files
  if (filePath.endsWith('.png') || 
      filePath.endsWith('.jpg') || 
      filePath.endsWith('.jpeg') ||
      filePath.endsWith('.log')) {
    return true;
  }
  
  return false;
}

function isValidPath(filePath: string): boolean {
  // Ensure no absolute paths or traversal
  if (filePath.startsWith('/') || filePath.includes('..')) {
    console.warn(`⚠️ Invalid path detected: ${filePath}`);
    return false;
  }
  return true;
}

let filesAdded = 0;
let filesSkipped = 0;

function addDirectory(dirPath: string, zipPath: string = '') {
  if (!fs.existsSync(dirPath)) return;
  
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const zipFilePath = path.join(zipPath, file);
    
    // Skip excluded items
    if (shouldExclude(fullPath)) {
      filesSkipped++;
      return;
    }
    
    // Validate path
    if (!isValidPath(zipFilePath)) {
      filesSkipped++;
      return;
    }
    
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      addDirectory(fullPath, zipFilePath);
    } else {
      try {
        zip.addLocalFile(fullPath, zipPath);
        filesAdded++;
        
        // Log important files
        if (filesAdded <= 10 || filesAdded % 20 === 0) {
          console.log(`  Added: ${zipFilePath}`);
        }
      } catch (error) {
        console.error(`❌ Failed to add ${fullPath}:`, error);
        filesSkipped++;
      }
    }
  });
}

console.log('🔧 Creating clean, validated ZIP file for Archetype...\n');

addDirectory('.');

zip.writeZip('archetype-project.zip');

const stats = fs.statSync('archetype-project.zip');
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n✅ ZIP Creation Complete!');
console.log(`📦 File: archetype-project.zip`);
console.log(`📊 Size: ${fileSizeMB} MB`);
console.log(`✅ Files added: ${filesAdded}`);
console.log(`⏭️  Files skipped: ${filesSkipped}`);

if (parseFloat(fileSizeMB) > 50) {
  console.warn('\n⚠️ WARNING: File is over 50MB limit!');
} else {
  console.log('\n✅ File is under 50MB limit - ready to upload!');
}
