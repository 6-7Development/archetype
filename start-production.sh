#!/bin/bash
# Production startup script for Railway
# This ensures we use tsx to run TypeScript directly
echo "🚀 Starting Archetype production server..."
echo "Using tsx to run TypeScript directly (no compilation needed)"
NODE_ENV=production npx tsx server/index.ts
