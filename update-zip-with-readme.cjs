const AdmZip = require('adm-zip');
const path = require('path');

const ZIP_NAME = 'archetype-production-2025-10-21.zip';
const BASE_DIR = '/home/runner/workspace';
const zipPath = path.join(BASE_DIR, ZIP_NAME);

console.log('📝 Adding deployment README to ZIP...');

// Open existing ZIP
const zip = new AdmZip(zipPath);

// Add deployment README
const readmePath = path.join(BASE_DIR, 'DEPLOYMENT_README_FINAL.md');
zip.addLocalFile(readmePath, '', 'DEPLOYMENT_README.md');

// Save ZIP
zip.writeZip(zipPath);

console.log('✅ Updated ZIP with deployment instructions');

