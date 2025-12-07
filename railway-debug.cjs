/**
 * Railway Debug Script
 * Run with: node railway-debug.cjs
 * Diagnoses deployment issues on Railway
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function debug() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           RAILWAY DEPLOYMENT DEBUG REPORT                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`📁 Working Directory: ${process.cwd()}`);
  console.log(`🖥️  Node Version: ${process.version}`);
  console.log('');

  // 1. Environment Variables Check
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('1️⃣  ENVIRONMENT VARIABLES');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const envVars = {
    'NODE_ENV': process.env.NODE_ENV,
    'PORT': process.env.PORT,
    'DATABASE_URL': process.env.DATABASE_URL ? '✅ SET (hidden)' : '❌ MISSING',
    'GEMINI_API_KEY': process.env.GEMINI_API_KEY ? '✅ SET' : '❌ MISSING',
    'SESSION_SECRET': process.env.SESSION_SECRET ? '✅ SET' : '❌ MISSING',
    'GITHUB_TOKEN': process.env.GITHUB_TOKEN ? '✅ SET' : '⚠️ OPTIONAL',
    'GITHUB_REPO': process.env.GITHUB_REPO || '⚠️ NOT SET',
  };
  
  for (const [key, value] of Object.entries(envVars)) {
    console.log(`   ${key}: ${value}`);
  }
  console.log('');

  // 2. File System Check
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('2️⃣  FILE SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const criticalPaths = [
    'server/index.ts',
    'server/public',
    'server/public/index.html',
    'server/public/assets',
    'shared/schema.ts',
    'migrations',
    'drizzle.config.ts',
    'package.json',
  ];
  
  for (const p of criticalPaths) {
    const exists = fs.existsSync(p);
    const stat = exists ? fs.statSync(p) : null;
    const type = stat ? (stat.isDirectory() ? 'DIR' : 'FILE') : '';
    const size = stat && !stat.isDirectory() ? `${stat.size} bytes` : '';
    console.log(`   ${exists ? '✅' : '❌'} ${p} ${type} ${size}`);
  }
  
  // Check server/public contents
  if (fs.existsSync('server/public')) {
    const publicFiles = fs.readdirSync('server/public');
    console.log(`   📂 server/public contains: ${publicFiles.length} items`);
    publicFiles.slice(0, 5).forEach(f => console.log(`      - ${f}`));
    if (publicFiles.length > 5) console.log(`      ... and ${publicFiles.length - 5} more`);
  }
  console.log('');

  // 3. Database Check
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('3️⃣  DATABASE CONNECTION');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    
    try {
      const client = await pool.connect();
      const timeResult = await client.query('SELECT NOW() as time');
      console.log(`   ✅ Connected at: ${timeResult.rows[0].time}`);
      
      // Check tables
      const tablesResult = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      console.log(`   📊 Tables found: ${tablesResult.rows.length}`);
      
      // Check critical tables
      const criticalTables = ['users', 'chat_messages', 'projects', 'files', 'audit_logs', 'usage_metrics'];
      for (const table of criticalTables) {
        const exists = tablesResult.rows.some(r => r.table_name === table);
        console.log(`      ${exists ? '✅' : '❌'} ${table}`);
      }
      
      client.release();
      await pool.end();
    } catch (err) {
      console.log(`   ❌ Connection failed: ${err.message}`);
    }
  } else {
    console.log('   ⚠️ DATABASE_URL not set - skipping database check');
  }
  console.log('');

  // 4. Port Binding Test
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('4️⃣  PORT BINDING TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const port = parseInt(process.env.PORT || '8080');
  console.log(`   Testing port: ${port}`);
  
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', debug: true }));
  });
  
  try {
    await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.listen(port, '0.0.0.0', () => {
        console.log(`   ✅ Successfully bound to 0.0.0.0:${port}`);
        resolve();
      });
    });
    
    // Quick health check
    await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/',
        method: 'GET',
      }, (res) => {
        console.log(`   ✅ Self-test HTTP response: ${res.statusCode}`);
        resolve();
      });
      req.on('error', (e) => {
        console.log(`   ⚠️ Self-test failed: ${e.message}`);
        resolve();
      });
      req.end();
    });
    
    server.close();
    console.log(`   ✅ Port ${port} released`);
  } catch (err) {
    console.log(`   ❌ Port binding failed: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.log('   💡 Port is already in use - server may already be running');
    }
  }
  console.log('');

  // 5. Migrations Check
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('5️⃣  MIGRATIONS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (fs.existsSync('migrations')) {
    const files = fs.readdirSync('migrations').filter(f => f.endsWith('.sql'));
    console.log(`   📄 SQL files found: ${files.length}`);
    files.forEach(f => {
      const size = fs.statSync(path.join('migrations', f)).size;
      console.log(`      - ${f} (${size} bytes)`);
    });
  } else {
    console.log('   ❌ No migrations directory found');
  }
  console.log('');

  // 6. Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const issues = [];
  
  if (!process.env.DATABASE_URL) issues.push('DATABASE_URL missing');
  if (!process.env.GEMINI_API_KEY) issues.push('GEMINI_API_KEY missing');
  if (!process.env.SESSION_SECRET) issues.push('SESSION_SECRET missing');
  if (!fs.existsSync('server/public/index.html')) issues.push('Frontend build missing');
  if (!fs.existsSync('server/index.ts')) issues.push('Server entry point missing');
  
  if (issues.length === 0) {
    console.log('   ✅ No critical issues detected');
    console.log('   💡 If still failing, check application logs for runtime errors');
  } else {
    console.log('   ❌ Issues found:');
    issues.forEach(i => console.log(`      - ${i}`));
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏁 DEBUG COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
}

debug().catch(err => {
  console.error('Debug script failed:', err);
  process.exit(1);
});
