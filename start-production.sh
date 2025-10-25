#!/bin/bash
set -e

# Set production environment for migrations
export NODE_ENV=production

echo "🔧 Running database migrations..."
# CRITICAL FIX: Add sslmode=no-verify for Render PostgreSQL (self-signed certs)
# Using proper PostgreSQL SSL syntax (not ssl=true which doesn't work)
if [[ "$DATABASE_URL" == *"?"* ]]; then
  export DATABASE_URL="${DATABASE_URL}&sslmode=no-verify"
else
  export DATABASE_URL="${DATABASE_URL}?sslmode=no-verify"
fi
echo "📝 Modified DATABASE_URL to include sslmode=no-verify"
npm run db:push

echo "🚀 Starting production server..."
node dist/index.js
