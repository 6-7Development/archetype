const pg = require('pg');
const fs = require('fs');

(async () => {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // STEP 1: Create all tables (or skip if they exist)
    console.log('📋 Step 1: Running full migration (creating all tables)...');
    const sql = fs.readFileSync('migrations/0000_giant_paladin.sql', 'utf8');
    
    try {
      await pool.query(sql);
      console.log('✅ All database tables created successfully');
    } catch (err) {
      if (err.code === '42P07') {
        console.log('ℹ️  Tables already exist - continuing to drift repair');
      } else {
        throw err;
      }
    }
    
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

      -- Add folder_id to file_uploads table if missing
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='file_uploads' AND column_name='folder_id'
        ) THEN
          ALTER TABLE file_uploads ADD COLUMN folder_id varchar;
          RAISE NOTICE 'Added folder_id to file_uploads table';
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
