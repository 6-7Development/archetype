const pg = require('pg');
const fs = require('fs');
const path = require('path'); // Import the path module

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

    // STEP 2: Add missing columns (drift repair) - OPTIONAL
    console.log('📋 Step 2: Repairing schema drift (adding missing columns)...');
    const addMissingColumnsPath = path.join(__dirname, 'add-missing-columns.sql');
    if (fs.existsSync(addMissingColumnsPath)) {
      const addMissingColumnsSQL = fs.readFileSync(addMissingColumnsPath, 'utf-8');
      await pool.query(addMissingColumnsSQL);
      console.log('✅ Schema drift repaired - all columns present');
    } else {
      console.log('⚠️  add-missing-columns.sql not found - skipping drift repair (optional)');
    }

    // Execute incident category migration
    console.log('📋 Step 3: Adding incident category columns...');
    const addIncidentCategoryPath = path.join(__dirname, 'migrations/add-incident-category.sql');
    if (fs.existsSync(addIncidentCategoryPath)) {
      const addIncidentCategorySQL = fs.readFileSync(addIncidentCategoryPath, 'utf-8');
      await pool.query(addIncidentCategorySQL);
      console.log('✅ Incident category columns added');
    } else {
      console.log('⚠️ Incident category migration not found - skipping');
    }

    await pool.end();
    process.exit(0);

  } catch (err) {
    console.error('❌ Database setup error:', err.message);
    console.error('Full error:', err);
    await pool.end();
    process.exit(1);
  }
})();