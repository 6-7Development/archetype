const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const ZIP_NAME = `archetype-production-${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}.zip`;
const BASE_DIR = '/home/runner/workspace';

console.log('🔨 Creating production-ready ZIP:', ZIP_NAME);

// Create ZIP instance
const zip = new AdmZip();

// Essential directories to include
const directories = ['client', 'server', 'shared', 'public'];
const files = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'tailwind.config.ts',
  'postcss.config.js',
  'drizzle.config.ts',
  'components.json',
  '.gitignore',
  '.env.example',
  'render.yaml',
  'ecosystem.config.js',
  'start-production.sh',
  'README.md',
  'replit.md'
];

// Add directories
console.log('📁 Adding source code directories...');
directories.forEach(dir => {
  const dirPath = path.join(BASE_DIR, dir);
  if (fs.existsSync(dirPath)) {
    zip.addLocalFolder(dirPath, dir);
    console.log(`  ✅ Added: ${dir}/`);
  }
});

// Add individual files
console.log('📄 Adding configuration files...');
files.forEach(file => {
  const filePath = path.join(BASE_DIR, file);
  if (fs.existsSync(filePath)) {
    zip.addLocalFile(filePath);
    console.log(`  ✅ Added: ${file}`);
  }
});

// Write ZIP file
const zipPath = path.join(BASE_DIR, ZIP_NAME);
zip.writeZip(zipPath);

// Get file size
const stats = fs.statSync(zipPath);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n✅ ZIP created successfully!');
console.log(`📦 File: ${ZIP_NAME}`);
console.log(`📊 Size: ${fileSizeMB} MB`);
console.log(`📍 Location: ${zipPath}`);

