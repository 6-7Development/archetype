#!/bin/bash

# ===================================================================
# Production Owner Setup Script
# ===================================================================
# This script helps set up the platform owner for Meta-SySop access
# ===================================================================

echo "🔧 ARCHETYPE PRODUCTION OWNER SETUP"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "This script will help you configure Meta-SySop access for production."
echo ""
echo "📋 Prerequisites:"
echo "  1. Access to Render dashboard (https://dashboard.render.com)"
echo "  2. Access to production PostgreSQL database"
echo "  3. Your production account email"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
read -p "Press Enter to continue..."
echo ""

# Step 1: Get database URL
echo "📍 Step 1: Get Production Database URL"
echo "─────────────────────────────────────────────────────────────"
echo "1. Go to Render dashboard"
echo "2. Open your PostgreSQL database"
echo "3. Click 'Connect' → 'External Connection'"
echo "4. Copy the 'External Database URL'"
echo ""
read -p "Paste your database URL: " DB_URL
echo ""

# Step 2: Get owner email
echo "📧 Step 2: Specify Owner Email"
echo "─────────────────────────────────────────────────────────────"
echo "Enter the email of the account that should have owner access:"
read -p "Owner email: " OWNER_EMAIL
echo ""

# Step 3: Show SQL to run
echo "📝 Step 3: Run This SQL on Production Database"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Run this command:"
echo ""
echo "psql \"$DB_URL\" -c \"UPDATE users SET is_owner = true WHERE email = '$OWNER_EMAIL'; SELECT id, email, is_owner FROM users WHERE is_owner = true;\""
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Or copy this SQL and run it in Render's database console:"
echo ""
echo "UPDATE users SET is_owner = true WHERE email = '$OWNER_EMAIL';"
echo "SELECT id, email, is_owner FROM users WHERE is_owner = true;"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "✅ After running the SQL:"
echo "  1. Restart your Render service"
echo "  2. Log in with $OWNER_EMAIL"
echo "  3. Navigate to Platform Healing"
echo "  4. Test Meta-SySop with a simple task"
echo ""
echo "═══════════════════════════════════════════════════════════════"

