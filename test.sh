#!/bin/bash
# JSON Healing Integration Tests
# Runs vitest test suite for robustExtractAndHeal() function
#
# Usage:
#   ./test.sh           Run all tests
#   ./test.sh --watch   Run tests in watch mode
#   ./test.sh --ui      Run tests with UI

set -e  # Exit on first failure

echo "🧪 Running JSON Healing Integration Tests..."
echo ""

# Run vitest with proper error handling
if npx vitest run; then
  echo ""
  echo "✅ All tests passed!"
  exit 0
else
  echo ""
  echo "❌ Tests failed! Fix issues before committing."
  exit 1
fi
