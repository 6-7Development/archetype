#!/bin/bash
set -e  # Exit on error

echo "======================================"
echo "🚂 RAILWAY STARTUP SCRIPT - DEBUG MODE"
echo "======================================"
echo "Time: $(date)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo ""

echo "📁 Current directory: $(pwd)"
echo "📂 Listing root files:"
ls -la
echo ""

echo "🔍 Checking for server/public directory (frontend)..."
if [ -d "server/public" ]; then
  echo "✅ server/public directory exists (frontend build)"
else
  echo "❌ server/public directory NOT found!"
  echo "Frontend build is missing - run 'npm run build' first"
  exit 1
fi

echo ""
echo "🔧 Running FULL database migration (all tables)..."
# Run the complete Drizzle migration that creates ALL tables
node -e "
  const pg = require('pg');
  const fs = require('fs');
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  // Read the full migration SQL (creates all 80+ tables)
  const sql = fs.readFileSync('migrations/0000_giant_paladin.sql', 'utf8');
  
  pool.query(sql)
    .then(() => { 
      console.log('✅ All database tables created successfully'); 
      pool.end(); 
    })
    .catch(err => { 
      // If tables already exist, that's fine - continue
      if (err.code === '42P07') {
        console.log('ℹ️  Tables already exist - skipping migration');
        pool.end();
      } else {
        console.error('❌ Migration error:', err.message); 
        pool.end(); 
        process.exit(1); 
      }
    });
"

echo ""
echo "🔄 Running database migrations with drizzle-kit..."

# Add SSL params to DATABASE_URL for drizzle-kit (production needs sslmode=no-verify)
if [ "$NODE_ENV" = "production" ]; then
  if [[ ! "$DATABASE_URL" =~ sslmode ]]; then
    export DATABASE_URL="${DATABASE_URL}?sslmode=no-verify"
    echo "✅ Added sslmode=no-verify to DATABASE_URL for drizzle-kit"
  fi
fi

# Skip drizzle-kit push on Railway (causes interactive prompts that block deployment)
# All table creation happens via SQL files above
echo "⚠️ Skipping drizzle-kit push (Railway deployment - avoiding interactive prompts)"
echo "✅ Database schema ready!"

echo ""
echo "🔍 Environment Check:"
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"
echo "DATABASE_URL: ${DATABASE_URL:+✓ SET (hidden for security)}"
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:+✓ SET}"
echo "GITHUB_REPO: ${GITHUB_REPO}"
echo "GITHUB_BRANCH: ${GITHUB_BRANCH}"
echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+✓ SET}"
echo ""

echo "📄 Ensuring replit.md is available..."
if [ ! -f "replit.md" ]; then
  echo "⚠️  replit.md not found in root, extracting from git..."
  if git show HEAD:replit.md > replit.md 2>/dev/null; then
    echo "✅ Extracted replit.md from git"
  else
    echo "❌ Could not find replit.md in git either"
  fi
else
  echo "✅ replit.md already present"
fi
echo ""

echo "🚀 Starting Node.js application with debug wrapper..."
echo "Command: sh debug-start.sh"
echo ""

sh debug-start.sh
