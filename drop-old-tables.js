// Drop old healing tables with wrong schema on Railway
// This runs BEFORE drizzle-kit push to allow clean recreation

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : undefined
});

async function dropOldTables() {
  try {
    console.log('[DROP-TABLES] Dropping old healing tables with incorrect schema...');
    
    await pool.query('DROP TABLE IF EXISTS ai_fix_attempts CASCADE;');
    console.log('[DROP-TABLES] ✅ Dropped ai_fix_attempts');
    
    await pool.query('DROP TABLE IF EXISTS platform_incidents CASCADE;');
    console.log('[DROP-TABLES] ✅ Dropped platform_incidents');
    
    await pool.query('DROP TABLE IF EXISTS healing_targets CASCADE;');
    console.log('[DROP-TABLES] ✅ Dropped healing_targets');
    
    console.log('[DROP-TABLES] ✅ All old tables dropped successfully');
    process.exit(0);
  } catch (error) {
    console.error('[DROP-TABLES] ❌ Error:', error.message);
    console.error('[DROP-TABLES] Continuing anyway...');
    process.exit(0); // Exit cleanly even on error
  }
}

dropOldTables();
