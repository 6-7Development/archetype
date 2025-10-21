#!/bin/bash

# Archetype Production Deployment ZIP Creator
# Includes all necessary files for Render deployment

ZIP_NAME="archetype-production-$(date +%Y%m%d-%H%M%S).zip"
TEMP_DIR="/tmp/archetype-deploy"

echo "🔨 Creating production-ready ZIP: $ZIP_NAME"

# Clean up temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Copy essential directories
echo "📁 Copying source code..."
cp -r client "$TEMP_DIR/"
cp -r server "$TEMP_DIR/"
cp -r shared "$TEMP_DIR/"
cp -r public "$TEMP_DIR/"

# Copy essential files
echo "📄 Copying configuration files..."
cp package.json "$TEMP_DIR/"
cp package-lock.json "$TEMP_DIR/"
cp tsconfig.json "$TEMP_DIR/"
cp vite.config.ts "$TEMP_DIR/"
cp tailwind.config.ts "$TEMP_DIR/"
cp postcss.config.js "$TEMP_DIR/"
cp drizzle.config.ts "$TEMP_DIR/"
cp components.json "$TEMP_DIR/"
cp .gitignore "$TEMP_DIR/"

# Copy deployment files
cp .env.example "$TEMP_DIR/"
cp render.yaml "$TEMP_DIR/"
cp ecosystem.config.js "$TEMP_DIR/"
cp start-production.sh "$TEMP_DIR/"
cp README.md "$TEMP_DIR/"

# Copy documentation
echo "📚 Copying documentation..."
cp replit.md "$TEMP_DIR/"
cp DEPLOYMENT_GUIDE.md "$TEMP_DIR/" 2>/dev/null || true
cp RENDER_DEPLOYMENT_QUICKSTART.md "$TEMP_DIR/" 2>/dev/null || true

# Create the ZIP file
echo "📦 Creating ZIP archive..."
cd /tmp
zip -r "/home/runner/workspace/$ZIP_NAME" archetype-deploy -q

# Clean up
rm -rf "$TEMP_DIR"

echo "✅ ZIP created successfully: $ZIP_NAME"
echo "📊 Size: $(du -h /home/runner/workspace/$ZIP_NAME | cut -f1)"

