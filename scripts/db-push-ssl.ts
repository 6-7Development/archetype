#!/usr/bin/env tsx
/**
 * Drizzle DB Push with SSL Support
 * Handles self-signed certificates in production (Render PostgreSQL)
 */

import { spawn } from 'child_process';

// In production, disable strict SSL for self-signed certs
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('🔒 SSL certificate validation relaxed for production database');
}

console.log('📊 Pushing database schema...');
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

// Run drizzle-kit push
const drizzle = spawn('npx', ['drizzle-kit', 'push', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

drizzle.on('close', (code) => {
  process.exit(code || 0);
});
