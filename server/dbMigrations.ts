import { pool } from './db';

/**
 * Auto-create missing database tables on Railway/production
 * This runs on app startup to ensure all required tables exist
 * Bypasses drizzle-kit migration issues on Railway
 */
export async function ensureTablesExist(): Promise<void> {
  try {
    console.log('[DB-MIGRATIONS] Checking for missing tables...');
    
    // Create platform_incidents table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_incidents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(50) NOT NULL DEFAULT 'medium',
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP,
        error_message TEXT,
        error_stack TEXT,
        context JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[DB-MIGRATIONS] ✅ platform_incidents table ready');

    // Create healing_targets table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS healing_targets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(100) NOT NULL,
        description TEXT,
        file_patterns TEXT[],
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[DB-MIGRATIONS] ✅ healing_targets table ready');

    // Create ai_fix_attempts table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_fix_attempts (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES platform_incidents(id) ON DELETE CASCADE,
        target_id INTEGER REFERENCES healing_targets(id) ON DELETE SET NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        confidence_score DECIMAL(3,2),
        changes_summary TEXT,
        verification_passed BOOLEAN,
        deployed BOOLEAN NOT NULL DEFAULT false,
        commit_hash VARCHAR(40),
        rollback_hash VARCHAR(40),
        error_message TEXT,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[DB-MIGRATIONS] ✅ ai_fix_attempts table ready');

    // Ensure default healing target exists (Platform Code)
    const { rows } = await pool.query(`
      SELECT id FROM healing_targets WHERE name = 'Platform Code' LIMIT 1;
    `);

    if (rows.length === 0) {
      await pool.query(`
        INSERT INTO healing_targets (name, type, description, file_patterns, enabled)
        VALUES (
          'Platform Code',
          'platform',
          'LomuAI platform source code - autonomous self-healing system',
          ARRAY['server/**/*', 'client/**/*', 'shared/**/*'],
          true
        )
        ON CONFLICT (name) DO NOTHING;
      `);
      console.log('[DB-MIGRATIONS] ✅ Created default healing target: Platform Code');
    } else {
      console.log('[DB-MIGRATIONS] ✅ Default healing target already exists');
    }

    console.log('[DB-MIGRATIONS] All required tables verified ✅');
  } catch (error: any) {
    console.error('[DB-MIGRATIONS] ❌ Failed to create tables:', error);
    throw error;
  }
}
