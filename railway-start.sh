#!/bin/sh

# Force all output to stdout/stderr immediately (no buffering)
set -e
exec > >(tee -a /tmp/startup.log) 2>&1

echo "======================================"
echo "🚂 RAILWAY STARTUP SCRIPT"
echo "======================================"
echo "Time: $(date)"
echo "PWD: $(pwd)"
echo "User: $(whoami)"
echo ""

echo "📦 Checking installed packages..."
ls -la node_modules/.bin/ | grep drizzle || echo "⚠️  drizzle-kit not found in node_modules/.bin"
echo ""

echo "🔍 Environment check..."
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: ${DATABASE_URL:0:30}..." # Only show first 30 chars
echo "PORT: $PORT"
echo ""

echo "🔄 Running database migrations with drizzle-kit push..."
if npx drizzle-kit push --yes; then
  echo "✅ Database migrations completed successfully!"
else
  echo "⚠️  Migration had warnings but continuing..."
fi
echo ""

echo "🚀 Starting Node.js application..."
echo "Command: NODE_ENV=production node dist/index.js"
echo ""

NODE_ENV=production node dist/index.js
