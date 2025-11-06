// Cleanup script to remove stale Git lock file
import fs from 'fs';
import path from 'path';

const lockFile = path.join(process.cwd(), '.git', 'index.lock');

try {
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
    console.log('✅ Successfully removed .git/index.lock');
  } else {
    console.log('ℹ️  No lock file found');
  }
} catch (error) {
  console.error('❌ Failed to remove lock file:', error.message);
  process.exit(1);
}
