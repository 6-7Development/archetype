const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const zip = new AdmZip();
const rootDir = process.cwd();

const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.cache', '.config', 'attached_assets'];
const excludeFiles = ['.replit'];

function shouldInclude(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  const parts = relativePath.split(path.sep);
  
  if (parts[0].startsWith('.') && excludeFiles.includes(parts[0])) return false;
  for (const dir of excludeDirs) {
    if (relativePath.startsWith(dir + path.sep) || relativePath === dir) return false;
  }
  if (filePath.endsWith('.log') || filePath.endsWith('.zip') || filePath.endsWith('.cjs')) return false;
  
  return true;
}

function addDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (!shouldInclude(fullPath)) continue;
    
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
console.log('✓ archetype-source.zip created!');
const stats = fs.statSync('archetype-source.zip');
console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
