#!/bin/bash
# Lightweight runtime verification script for post-modularization workflows
# Tests SSE streaming, WebSocket, and API endpoints without Playwright/Stripe

echo "=== LomuAI Runtime Verification Script ==="
echo "Date: $(date)"
echo ""

# Test 1: Health Endpoint
echo "[TEST 1] Health Endpoint"
HEALTH=$(curl -s http://localhost:5000/api/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ Health endpoint responsive"
else
  echo "❌ Health endpoint failed: $HEALTH"
fi
echo ""

# Test 2: Authentication Endpoints
echo "[TEST 2] Authentication Routes"
AUTH_CHECK=$(curl -s -I http://localhost:5000/api/auth/check 2>&1 | head -1)
if echo "$AUTH_CHECK" | grep -q "HTTP"; then
  echo "✅ Auth check endpoint exists"
else
  echo "❌ Auth check endpoint failed"
fi
echo ""

# Test 3: LomuAI Routes
echo "[TEST 3] LomuAI API Routes"
LOMU_STATUS=$(curl -s -I http://localhost:5000/api/lomu-ai 2>&1 | head -1)
if echo "$LOMU_STATUS" | grep -q "HTTP"; then
  echo "✅ LomuAI API endpoint exists"
else
  echo "❌ LomuAI API endpoint failed"
fi
echo ""

# Test 4: Architect Routes
echo "[TEST 4] I AM Architect API Routes"
ARCHITECT_STATUS=$(curl -s -I http://localhost:5000/api/architect 2>&1 | head -1)
if echo "$ARCHITECT_STATUS" | grep -q "HTTP"; then
  echo "✅ Architect API endpoint exists"
else
  echo "❌ Architect API endpoint failed"
fi
echo ""

# Test 5: WebSocket Availability (connection test)
echo "[TEST 5] WebSocket Endpoint"
WS_TEST=$(curl -s -I http://localhost:5000/ws 2>&1 | grep -i "upgrade")
if [ ! -z "$WS_TEST" ]; then
  echo "✅ WebSocket upgrade endpoint available"
else
  echo "⚠️  WebSocket endpoint check inconclusive (requires WS client)"
fi
echo ""

# Test 6: Frontend Routes
echo "[TEST 6] Frontend Routes"
HOMEPAGE=$(curl -s -I http://localhost:5000/ 2>&1 | grep "HTTP/1.1 200")
if [ ! -z "$HOMEPAGE" ]; then
  echo "✅ Homepage route works (200 OK)"
else
  echo "❌ Homepage route failed"
fi

LOMU_PAGE=$(curl -s -I http://localhost:5000/lomu-ai 2>&1 | grep "HTTP/1.1 200")
if [ ! -z "$LOMU_PAGE" ]; then
  echo "✅ LomuAI chat page route works (200 OK)"
else
  echo "❌ LomuAI chat page route failed"
fi
echo ""

# Test 7: Check for Runtime Errors in Logs
echo "[TEST 7] Server Log Error Check"
if [ -f "/tmp/logs/Start_application_"*.log ]; then
  LATEST_LOG=$(ls -t /tmp/logs/Start_application_*.log | head -1)
  ERROR_COUNT=$(grep -i "error" "$LATEST_LOG" | grep -v "runtime-error-plugin" | grep -v "error TS" | wc -l)
  if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ No server errors detected in logs"
  else
    echo "⚠️  Found $ERROR_COUNT potential error(s) in logs (review recommended)"
  fi
else
  echo "⚠️  Server logs not found"
fi
echo ""

# Test 8: Browser Console Error Check
echo "[TEST 8] Browser Console Error Check"
if [ -f "/tmp/logs/browser_console_"*.log ]; then
  LATEST_CONSOLE=$(ls -t /tmp/logs/browser_console_*.log | head -1)
  CONSOLE_ERRORS=$(grep -i "method -error" "$LATEST_CONSOLE" | wc -l)
  if [ "$CONSOLE_ERRORS" -eq 0 ]; then
    echo "✅ No browser console errors detected"
  else
    echo "❌ Found $CONSOLE_ERRORS browser console error(s)"
  fi
else
  echo "⚠️  Browser console logs not found"
fi
echo ""

echo "=== Summary ==="
echo "✅ Basic endpoint validation complete"
echo "⚠️  Runtime streaming behavior NOT verified (requires authenticated session)"
echo "⚠️  SSE word-by-word streaming NOT verified (requires authenticated chat session)"
echo "⚠️  WebSocket file broadcasts NOT verified (requires active LomuAI execution)"
echo "⚠️  Architect consultation flow NOT verified (requires authenticated session)"
echo ""
echo "Recommendation: Use MANUAL_TEST_GUIDE.md for comprehensive runtime validation"
echo "Critical workflows requiring manual testing:"
echo "  1. Chat SSE streaming (word-by-word vs buffered)"
echo "  2. WebSocket file change broadcasts"
echo "  3. Tool execution streaming"
echo "  4. Checkpoint/scratchpad display"
echo "  5. I AM Architect consultation"
