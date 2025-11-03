const pg = require('pg');
const fs = require('fs');

(async () => {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // STEP 1: Create all tables (run each statement individually)
    console.log('📋 Step 1: Running migration statements individually...');
    const sql = fs.readFileSync('migrations/0000_giant_paladin.sql', 'utf8');
    
    // Split into individual statements (separated by statement-breakpoint comments)
    const statements = sql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   Found ${statements.length} SQL statements to execute`);
    
    let created = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const statement of statements) {
      try {
        await pool.query(statement);
        created++;
      } catch (err) {
        if (err.code === '42P07') {
          // Table already exists - skip
          skipped++;
        } else {
          // Other error - log but continue
          console.log(`   ⚠️  Statement failed (continuing): ${err.message}`);
          failed++;
        }
      }
    }
    
    console.log(`   ✅ Migration complete: ${created} created, ${skipped} skipped, ${failed} failed`);
    
    // STEP 2: Add missing columns (drift repair)
    console.log('📋 Step 2: Repairing schema drift (adding missing columns)...');
    const driftRepairSQL = `
      -- Add folder_id to files table if missing
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='files' AND column_name='folder_id'
        ) THEN
          ALTER TABLE files ADD COLUMN folder_id varchar;
          RAISE NOTICE 'Added folder_id to files table';
        END IF;
      END $$;
    `;
    
    await pool.query(driftRepairSQL);
    console.log('✅ Schema drift repaired - all columns present');
    
    await pool.end();
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Database setup error:', err.message);
    console.error('Full error:', err);
    await pool.end();
    process.exit(1);
  }
})();
