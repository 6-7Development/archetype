#!/bin/sh
# Debug wrapper for Railway startup - captures all errors

set -e  # Exit on error

echo "=========================================="
echo "DEBUG MODE - VERBOSE ERROR CAPTURE"
echo "=========================================="
echo ""

echo "Step 1: Verify server directory exists..."
if [ ! -d "server" ]; then
  echo "ERROR: server/ directory not found!"
  ls -la
  exit 1
fi
echo "server/ directory exists"
echo ""

echo "Step 2: Verify server/index.ts exists..."
if [ ! -f "server/index.ts" ]; then
  echo "ERROR: server/index.ts not found!"
  ls -la server/
  exit 1
fi
echo "server/index.ts exists"
echo ""

echo "Step 3: Check Node.js and tsx availability..."
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "tsx location: $(which npx)"
echo ""

echo "Step 4: Verify environment variables..."
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"
echo "DATABASE_URL: ${DATABASE_URL:+SET}"
echo ""

echo "Step 5: Test tsx can load..."
if ! npx tsx --version; then
  echo "ERROR: tsx not available!"
  npm list tsx 2>/dev/null || echo "tsx not installed"
  exit 1
fi
echo "tsx is available"
echo ""

echo "Step 6: Starting server with tsx..."
echo "Command: npx tsx server/index.ts"
echo "=========================================="
echo ""

# Run tsx directly (tee causes issues with exit codes in sh)
exec npx tsx server/index.ts
