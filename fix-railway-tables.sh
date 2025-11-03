#!/bin/sh
set -e

echo "🔧 Running FULL database migration (all tables)..."
echo "This will create ALL missing tables from migrations/0000_giant_paladin.sql"

node -e "
  const pg = require('pg');
  const fs = require('fs');
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  // Read the full migration SQL
  const sql = fs.readFileSync('migrations/0000_giant_paladin.sql', 'utf8');
  
  pool.query(sql)
    .then(() => { 
      console.log('✅ All tables created from migration'); 
      pool.end(); 
    })
    .catch(err => { 
      console.error('❌ Migration error:', err.message); 
      pool.end(); 
      process.exit(1); 
    });
"
