import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';

const zipPath = './attached_assets/archetype-fixed_1761414953680.zip';
const extractPath = '/tmp/chatgpt-review';

async function extractZip() {
  try {
    console.log('📦 Reading ZIP file...');
    const zipData = await fs.readFile(zipPath);
    const zip = await JSZip.loadAsync(zipData);
    
    console.log('🗑️  Cleaning extract directory...');
    await fs.rm(extractPath, { recursive: true, force: true });
    await fs.mkdir(extractPath, { recursive: true });

    console.log('📂 Extracting files...');
    let fileCount = 0;
    for (const [filename, file] of Object.entries(zip.files)) {
      const filePath = path.join(extractPath, filename);
      
      if (file.dir) {
        await fs.mkdir(filePath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const content = await file.async('nodebuffer');
        await fs.writeFile(filePath, content);
        fileCount++;
      }
    }
    
    console.log(`✅ Extracted ${fileCount} files to: ${extractPath}`);
    
    // List contents
    const contents = await fs.readdir(extractPath);
    console.log('\n📁 Top-level contents:', contents.join(', '));
    
    // Look for documentation
    const allFiles = Object.keys(zip.files);
    const docFiles = allFiles.filter(f => 
      (f.toLowerCase().includes('readme') || 
       f.toLowerCase().includes('change') ||
       f.toLowerCase().includes('fix') ||
       f.toLowerCase().endsWith('.md') ||
       f.toLowerCase().includes('notes')) &&
      !f.includes('node_modules')
    ).slice(0, 15);
    
    if (docFiles.length > 0) {
      console.log('\n📄 Documentation/Notes found:');
      docFiles.forEach(f => console.log('  -', f));
      
      // Read first markdown file if exists
      const firstMd = docFiles.find(f => f.endsWith('.md'));
      if (firstMd) {
        const mdFile = zip.file(firstMd);
        if (mdFile) {
          const content = await mdFile.async('string');
          console.log(`\n📝 Contents of ${firstMd}:`);
          console.log('─'.repeat(60));
          console.log(content.substring(0, 2000)); // First 2000 chars
          if (content.length > 2000) {
            console.log('\n... (truncated)');
          }
          console.log('─'.repeat(60));
        }
      }
    }
    
    // Check for modified server files
    const serverFiles = allFiles.filter(f => f.startsWith('server/') && f.endsWith('.ts')).slice(0, 20);
    if (serverFiles.length > 0) {
      console.log('\n🔧 Server files included:');
      serverFiles.forEach(f => console.log('  -', f));
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

extractZip();
