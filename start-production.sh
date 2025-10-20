#!/bin/bash
set -e

echo "🔧 Running database migrations..."
npm run db:push

echo "🚀 Starting production server..."
NODE_ENV=production node dist/index.js
