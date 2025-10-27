#!/bin/bash
# Force deploy to Railway - commits and pushes all changes to GitHub
# Railway will auto-deploy when it detects the push

set -e

echo "🚀 ARCHETYPE DEPLOYMENT SCRIPT"
echo "==============================="
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not a git repository. This script must run on Replit (development)."
    echo "   Railway doesn't have git - it builds from GitHub."
    exit 1
fi

# Get commit message from argument or use default
COMMIT_MSG="${1:-Enhanced Meta-SySop - Railway deployment, dual-mode UI, and admin rescue mode}"

echo "📝 Commit message: $COMMIT_MSG"
echo ""

# Configure git if needed
git config user.email "meta-sysop@archetype.dev" 2>/dev/null || true
git config user.name "Meta-SySop Deployment" 2>/dev/null || true

# Stage all changes
echo "📦 Staging changes..."
git add -A

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "✅ No changes to commit - already up to date!"
    exit 0
fi

# Show what will be committed
echo ""
echo "📋 Files to commit:"
git diff --staged --name-status
echo ""

# Commit changes
echo "💾 Creating commit..."
git commit -m "$COMMIT_MSG"

# Push to GitHub
echo "📤 Pushing to GitHub main branch..."
git push origin main

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "🚂 Railway will auto-deploy in 2-3 minutes"
echo "   Monitor at: https://railway.app"
echo ""
