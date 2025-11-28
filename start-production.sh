#!/bin/bash
# Production startup script for Railway
# This ensures we use tsx to run TypeScript directly

echo "🚀 Starting LomuAI production server..."
echo "Using tsx to run TypeScript directly (no compilation needed)"

# Validate required environment variables
REQUIRED_VARS=("DATABASE_URL" "GEMINI_API_KEY" "SESSION_SECRET" "STRIPE_SECRET_KEY")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ ERROR: Missing required env var: $var"
    exit 1
  fi
done

echo "✅ All required environment variables configured"

# Start server
NODE_ENV=production npx tsx server/index.ts &
SERVER_PID=$!

# Wait for server to start (max 30 seconds)
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
  if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Server health check passed"
    wait $SERVER_PID
    exit $?
  fi
  echo "  Attempt $i/30..."
  sleep 1
done

echo "❌ Server failed to start or health check timed out"
kill $SERVER_PID 2>/dev/null
exit 1
