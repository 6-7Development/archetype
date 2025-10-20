#!/bin/bash
set -e

# Set production environment for migrations
export NODE_ENV=production

echo "🔧 Running database migrations..."
# Add SSL parameters to DATABASE_URL for drizzle-kit (Render PostgreSQL requires SSL)
if [[ "$DATABASE_URL" == *"?"* ]]; then
  export DATABASE_URL="${DATABASE_URL}&ssl=true"
else
  export DATABASE_URL="${DATABASE_URL}?ssl=true"
fi
npm run db:push

echo "🚀 Starting production server..."
node dist/index.js
