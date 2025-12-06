import { spawn } from 'child_process';

console.log('Starting drizzle-kit push...\n');

const child = spawn('npm', ['run', 'db:push'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

let output = '';
let questionCount = 0;

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // Auto-answer prompts by pressing Enter (accept default)
  if (text.includes('❯') || text.includes('table created') || text.includes('renamed')) {
    questionCount++;
    console.log(`\n[AUTO-ANSWER ${questionCount}] Pressing Enter to accept default...\n`);
    child.stdin.write('\n');
  }
  
  // If asking for confirmation, say yes
  if (text.toLowerCase().includes('execute') || text.toLowerCase().includes('apply')) {
    console.log('\n[AUTO-CONFIRM] Typing y...\n');
    child.stdin.write('y\n');
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('close', (code) => {
  console.log(`\n\nProcess exited with code: ${code}`);
  
  if (output.includes('Successfully') || output.includes('✓') || code === 0) {
    console.log('✅ Migration appears successful!');
  } else {
    console.log('⚠️  Check output above for status');
  }
});

// Timeout after 60 seconds
setTimeout(() => {
  console.log('\n⏱️  Timeout reached, killing process...');
  child.kill();
}, 60000);
