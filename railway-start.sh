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
echo "🔄 Running database migrations with drizzle-kit..."
if npx drizzle-kit push; then
  echo "✅ Database migrations completed successfully!"
else
  echo "⚠️  Database migration failed, but continuing..."
fi

echo ""
echo "🔍 Environment Check:"
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"
echo "DATABASE_URL: ${DATABASE_URL:0:30}... (truncated)"
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:+✓ SET}"
echo "GITHUB_REPO: ${GITHUB_REPO}"
echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+✓ SET}"
echo ""

echo "🚀 Starting Node.js application..."
echo "Command: node dist/index.js"
echo ""

node dist/index.js
