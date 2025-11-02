#!/bin/bash
# Debug wrapper for Railway startup - captures all errors

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

echo "=========================================="
echo "🔍 DEBUG MODE - VERBOSE ERROR CAPTURE"
echo "=========================================="
echo ""

# Trap errors and display them
trap 'catch_error $? $LINENO' ERR

catch_error() {
  echo ""
  echo "❌❌❌ ERROR CAUGHT ❌❌❌"
  echo "Exit Code: $1"
  echo "Line Number: $2"
  echo "Command: $BASH_COMMAND"
  echo "=========================================="
  exit $1
}

echo "📋 Step 1: Verify server directory exists..."
if [ ! -d "server" ]; then
  echo "❌ ERROR: server/ directory not found!"
  ls -la
  exit 1
fi
echo "✅ server/ directory exists"
echo ""

echo "📋 Step 2: Verify server/index.ts exists..."
if [ ! -f "server/index.ts" ]; then
  echo "❌ ERROR: server/index.ts not found!"
  ls -la server/
  exit 1
fi
echo "✅ server/index.ts exists"
echo ""

echo "📋 Step 3: Check Node.js and tsx availability..."
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "tsx location: $(which npx)"
echo ""

echo "📋 Step 4: Verify environment variables..."
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"
echo "DATABASE_URL: ${DATABASE_URL:+✓ SET}"
echo ""

echo "📋 Step 5: Test tsx can load..."
npx tsx --version || {
  echo "❌ ERROR: tsx not available!"
  npm list tsx || echo "tsx not installed"
  exit 1
}
echo "✅ tsx is available"
echo ""

echo "📋 Step 6: Starting server with tsx..."
echo "Command: npx tsx server/index.ts"
echo "=========================================="
echo ""

# Run tsx with verbose error output
npx tsx server/index.ts 2>&1 | tee /tmp/server.log || {
  EXIT_CODE=$?
  echo ""
  echo "❌❌❌ SERVER CRASHED ❌❌❌"
  echo "Exit code: $EXIT_CODE"
  echo "=========================================="
  echo "📄 Last 50 lines of output:"
  tail -50 /tmp/server.log
  echo "=========================================="
  exit $EXIT_CODE
}
