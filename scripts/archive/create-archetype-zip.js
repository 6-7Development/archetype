const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const zip = new AdmZip();
const rootDir = process.cwd();

// Directories to exclude
const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.cache', '.config'];
const excludeFiles = ['.replit', 'create-archetype-zip.js', 'archetype-source.zip'];

function shouldInclude(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  
  // Exclude hidden files at root level (but allow nested ones like client/src/.eslintrc)
  const parts = relativePath.split(path.sep);
  if (parts[0].startsWith('.') && excludeFiles.includes(parts[0])) {
    return false;
  }
  
  // Exclude specific directories
  for (const dir of excludeDirs) {
    if (relativePath.startsWith(dir + path.sep) || relativePath === dir) {
      return false;
    }
  }
  
  // Exclude log files
  if (filePath.endsWith('.log')) {
    return false;
  }
  
  return true;
}

function addDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    
    if (!shouldInclude(fullPath)) {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      addDirectory(fullPath);
    } else {
      const relativePath = path.relative(rootDir, fullPath);
      zip.addLocalFile(fullPath, path.dirname(relativePath));
    }
  }
}

console.log('Creating Archetype source zip...');
addDirectory(rootDir);
zip.writeZip(path.join(rootDir, 'archetype-source.zip'));
console.log('✓ Created archetype-source.zip');
