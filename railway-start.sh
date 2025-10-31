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

echo "🔍 Checking for dist directory..."
if [ -d "dist" ]; then
  echo "✅ dist directory exists"
  echo "📂 Contents:"
  ls -la dist/ || echo "Failed to list dist contents"
  
  if [ -f "dist/index.js" ]; then
    echo "✅ dist/index.js found"
  else
    echo "❌ dist/index.js NOT found!"
    exit 1
  fi
else
  echo "❌ dist directory NOT found!"
  echo "📂 Available directories:"
  ls -d */ || echo "No directories found"
  exit 1
fi

echo ""
echo "🔄 Running database migrations..."
# Add SSL params to DATABASE_URL for drizzle-kit (production needs sslmode=no-verify)
if [ "$NODE_ENV" = "production" ]; then
  if [[ ! "$DATABASE_URL" =~ sslmode ]]; then
    export DATABASE_URL="${DATABASE_URL}?sslmode=no-verify"
    echo "✅ Added sslmode=no-verify to DATABASE_URL for drizzle-kit"
  fi
fi

# Skip drizzle-kit entirely on Railway - it's too unreliable with schema detection
# The app will handle table creation via drizzle ORM on startup
echo "⏭️ Skipping drizzle-kit push (Railway schema detection issues)"
echo "✅ Database schema will be created by application on startup"

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

echo "🚀 Starting Node.js application..."
echo "Command: node dist/index.js"
echo ""

node dist/index.js
