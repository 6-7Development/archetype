/**
 * Railway Database Setup Script
 * Runs SQL migrations to ensure database tables exist before starting the application
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🔧 Railway Database Setup');
  console.log('========================');
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL is configured');
  
  // Create pool with SSL for production
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
  });
  
  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connected at:', result.rows[0].current_time);
    
    // Run migrations
    console.log('📦 Running database migrations...');
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      console.log(`   Found ${files.length} SQL migration files`);
      
      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        // Split by statement breakpoint and execute each statement
        const statements = sql.split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        console.log(`   📄 ${file} (${statements.length} statements)`);
        
        for (const statement of statements) {
          try {
            await client.query(statement);
          } catch (err) {
            // Ignore "already exists" errors, log others
            if (err.message.includes('already exists') || 
                err.message.includes('duplicate key') ||
                err.code === '42P07' || // relation already exists
                err.code === '42710') { // duplicate object
              // Table/index already exists, skip silently
            } else {
              console.log(`      ⚠️ Statement skipped: ${err.message.substring(0, 80)}`);
            }
          }
        }
      }
      
      console.log('✅ Migrations complete');
    } else {
      console.log('⚠️ No migrations directory found');
    }
    
    client.release();
    console.log('✅ Database setup complete');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    // Don't exit - let the main app handle connection retries
    console.log('⚠️ Continuing with startup - app will retry connection');
  } finally {
    await pool.end();
  }
}

setupDatabase().catch(console.error);
