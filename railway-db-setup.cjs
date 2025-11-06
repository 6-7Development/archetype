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

    // STEP 4: Create new tables for v2.0 features (GitHub integration + Code intelligence)
    console.log('📋 Step 4: Creating v2.0 feature tables (project_env_vars, file_index)...');
    
    try {
      // Create project_env_vars table for deployment environment variables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_env_vars (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR NOT NULL,
          key VARCHAR(255) NOT NULL,
          value TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_project_env_vars_project ON project_env_vars(project_id);
      `);
      
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_env_vars_unique ON project_env_vars(project_id, key);
      `);
      
      console.log('   ✅ project_env_vars table created');
      
      // Create file_index table for code intelligence system
      await pool.query(`
        CREATE TABLE IF NOT EXISTS file_index (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR,
          file_path TEXT NOT NULL,
          language VARCHAR(50) NOT NULL,
          imports JSONB DEFAULT '[]'::jsonb,
          exports JSONB DEFAULT '[]'::jsonb,
          functions JSONB DEFAULT '[]'::jsonb,
          classes JSONB DEFAULT '[]'::jsonb,
          types JSONB DEFAULT '[]'::jsonb,
          imported_by JSONB DEFAULT '[]'::jsonb,
          dependencies JSONB DEFAULT '[]'::jsonb,
          complexity INTEGER NOT NULL DEFAULT 0,
          lines_of_code INTEGER NOT NULL DEFAULT 0,
          content_hash VARCHAR(64) NOT NULL,
          indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_file_index_project ON file_index(project_id);
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_file_index_path ON file_index(file_path);
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_file_index_language ON file_index(language);
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_file_index_hash ON file_index(content_hash);
      `);
      
      console.log('   ✅ file_index table created');
      console.log('✅ All v2.0 feature tables ready!');
      
    } catch (err) {
      if (err.code === '42P07') {
        console.log('   ℹ️  v2.0 tables already exist - skipping');
      } else {
        console.log(`   ⚠️  v2.0 table creation warning: ${err.message}`);
      }
    }

    // STEP 5: Add missing columns to users table (schema drift repair)
    console.log('📋 Step 5: Adding missing columns to users table...');
    
    try {
      // Add billing_status column if it doesn't exist
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'trial';
      `);
      
      // Add stripe_customer_id column if it doesn't exist
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
      `);
      
      console.log('✅ Missing user columns added successfully');
    } catch (err) {
      console.log(`   ⚠️  User column addition warning: ${err.message}`);
    }

    // STEP 6: Create platform owner account
    console.log('📋 Step 6: Creating platform owner account...');
    
    try {
      const bcrypt = require('bcrypt');
      const ROOT_EMAIL = 'root@getdc360.com';
      const ROOT_PASSWORD = 'admin123@*';
      const SALT_ROUNDS = 12;
      
      // Hash password
      const hashedPassword = await bcrypt.hash(ROOT_PASSWORD, SALT_ROUNDS);
      
      // Check if root account exists
      const existing = await pool.query(
        'SELECT id, email, is_owner FROM users WHERE email = $1',
        [ROOT_EMAIL]
      );
      
      if (existing.rows.length > 0) {
        // Update existing account
        await pool.query(`
          UPDATE users 
          SET password = $1, role = 'admin', is_owner = true, updated_at = NOW()
          WHERE email = $2
        `, [hashedPassword, ROOT_EMAIL]);
        
        console.log('   ✅ Root owner account updated');
      } else {
        // Create new account
        await pool.query(`
          INSERT INTO users (email, password, first_name, last_name, role, is_owner, created_at, updated_at)
          VALUES ($1, $2, 'Root', 'Admin', 'admin', true, NOW(), NOW())
        `, [ROOT_EMAIL, hashedPassword]);
        
        console.log('   ✅ Root owner account created');
      }
      
      console.log(`   📧 Email: ${ROOT_EMAIL}`);
      console.log('   🔑 Password: admin123@*');
      console.log('✅ Platform owner ready!');
      
    } catch (err) {
      console.log(`   ⚠️  Owner account warning: ${err.message}`);
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