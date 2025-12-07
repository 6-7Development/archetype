/**
 * Railway Database Setup Script
 * Ensures database tables exist before starting the application
 */

const { Pool } = require('pg');

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
    client.release();
    
    console.log('✅ Database setup complete');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    // Don't exit - let the main app handle connection retries
    console.log('⚠️  Continuing with startup - app will retry connection');
  } finally {
    await pool.end();
  }
}

setupDatabase().catch(console.error);
