#!/bin/sh
set -e

echo "======================================"
echo "🚂 RAILWAY STARTUP SCRIPT"
echo "======================================"
echo "Time: $(date)"
echo ""

echo "🔄 Running database migrations with drizzle-kit..."
npx drizzle-kit push

echo ""
echo "✅ Database migrations completed successfully!"
echo ""

echo "🚀 Starting Node.js application..."
NODE_ENV=production node dist/index.js
