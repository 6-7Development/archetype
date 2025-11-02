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

echo "🔍 Checking for dist/public directory (frontend)..."
if [ -d "dist/public" ]; then
  echo "✅ dist/public directory exists (frontend build)"
else
  echo "❌ dist/public directory NOT found!"
  echo "Frontend build is missing - run 'npm run build' first"
  exit 1
fi

echo ""
echo "🗑️ Dropping old tables with incorrect schema..."
# Run Node script to drop old healing tables (they have wrong ID types)
node drop-old-tables.js || echo "⚠️ Could not drop old tables (may not exist)"

echo ""
echo "🔧 Creating healing tables with correct schema..."
# Create healing tables via SQL (drizzle-kit push is unreliable on Railway)
if command -v psql &> /dev/null; then
  psql "$DATABASE_URL" -f create-healing-tables.sql
  echo "✅ Healing tables created via SQL"
else
  echo "⚠️ psql not found, using node-postgres..."
  node -e "
    const pg = require('pg');
    const fs = require('fs');
    const pool = new pg.Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    const sql = fs.readFileSync('create-healing-tables.sql', 'utf8');
    pool.query(sql)
      .then(() => { console.log('✅ Tables created'); process.exit(0); })
      .catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
  "
fi

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
