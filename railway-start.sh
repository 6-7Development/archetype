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
echo "🔧 Running database migration and drift repair..."
node railway-db-setup.cjs

# Check if database setup succeeded
if [ $? -ne 0 ]; then
  echo "❌ Database setup failed"
  exit 1
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
echo "PORT: ${PORT:-8080}"
echo "DATABASE_URL: ${DATABASE_URL:+✓ SET (hidden for security)}"
echo "GEMINI_API_KEY: ${GEMINI_API_KEY:+✓ SET}"
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:+✓ SET}"
echo "GITHUB_REPO: ${GITHUB_REPO}"
echo "SESSION_SECRET: ${SESSION_SECRET:+✓ SET}"
echo ""

# Validate required environment variables
MISSING_VARS=""
if [ -z "$DATABASE_URL" ]; then
  MISSING_VARS="$MISSING_VARS DATABASE_URL"
fi
if [ -z "$GEMINI_API_KEY" ]; then
  MISSING_VARS="$MISSING_VARS GEMINI_API_KEY"
fi
if [ -z "$SESSION_SECRET" ]; then
  MISSING_VARS="$MISSING_VARS SESSION_SECRET"
fi

if [ -n "$MISSING_VARS" ]; then
  echo "❌ CRITICAL: Missing required environment variables:$MISSING_VARS"
  echo "   Set these in Railway dashboard before deploying."
  exit 1
fi
echo "✅ All required environment variables are set"
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
