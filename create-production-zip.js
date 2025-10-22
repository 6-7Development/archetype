import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const zip = new AdmZip();

// Files and directories to include
const includePaths = [
  'client',
  'server',
  'shared',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'drizzle.config.ts',
  'tailwind.config.ts',
  'postcss.config.js',
  'render.yaml',
  'README.md',
  'replit.md',
  '.gitignore'
];

// Directories to exclude
const excludeDirs = [
  'node_modules',
  '.git',
  'dist',
  '.vite',
  '.cache',
  'attached_assets'
];

console.log('Creating production ZIP...');

includePaths.forEach(item => {
  const itemPath = path.join(process.cwd(), item);
  
  if (!fs.existsSync(itemPath)) {
    console.log(`Skipping missing: ${item}`);
    return;
  }
  
  const stats = fs.statSync(itemPath);
  
  if (stats.isDirectory()) {
    console.log(`Adding directory: ${item}/`);
    zip.addLocalFolder(itemPath, item);
  } else {
    console.log(`Adding file: ${item}`);
    zip.addLocalFile(itemPath);
  }
});

const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
const zipFilename = `archetype-production-${timestamp}.zip`;

zip.writeZip(zipFilename);

const stats = fs.statSync(zipFilename);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`\n✅ Production ZIP created: ${zipFilename}`);
console.log(`📦 Size: ${sizeMB} MB`);
console.log(`\nContents:`);
console.log(`  - Full source code (client/, server/, shared/)`);
console.log(`  - Configuration files (including render.yaml)`);
console.log(`  - Package files`);
console.log(`  - Documentation`);
console.log(`\nExcluded:`);
console.log(`  - node_modules/ (install with npm install)`);
console.log(`  - dist/ (built on deploy)`);
console.log(`  - .git/ (version control)`);
console.log(`  - User uploaded files`);
console.log(`\n🚀 Ready for deployment to Render!`);
console.log(`\nDeployment Instructions:`);
console.log(`  1. Upload ${zipFilename} to Render.com`);
console.log(`  2. Render will auto-detect render.yaml and configure everything`);
console.log(`  3. Add ANTHROPIC_API_KEY in Render Dashboard → Environment`);
console.log(`  4. Open Render Shell and run: npm run db:push`);
console.log(`  5. Visit /health to verify deployment`);
console.log(`  6. (Optional) Add Stripe keys for billing features`);
