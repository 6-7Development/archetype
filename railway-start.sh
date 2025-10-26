#!/bin/sh
set -e

echo "🔄 Running database migrations..."
npx drizzle-kit push --yes || echo "⚠️  Migration warning (continuing anyway)"

echo "🚀 Starting application..."
NODE_ENV=production node dist/index.js
