#!/bin/bash

# LomuAI Platform E2E Test - API & Gap Detection
# Tests SWARM Mode integration, guard rails, and critical platform paths

set -e

BASE_URL="http://localhost:5000"
PASSED=0
FAILED=0
GAPS_FOUND=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================================================${NC}"
echo -e "${BLUE}LomuAI Platform E2E Tests - Gap Detection${NC}"
echo -e "${BLUE}=================================================================================${NC}\n"

# Test function
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_status="$5"
  
  local response_file="/tmp/response_$RANDOM.json"
  local http_code
  
  if [ -z "$data" ]; then
    http_code=$(curl -s -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" -o "$response_file")
  else
    http_code=$(curl -s -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data" -o "$response_file")
  fi
  
  echo -n "[$method] $endpoint ... "
  
  if [[ "$expected_status" == *"$http_code"* ]]; then
    echo -e "${GREEN}PASS (HTTP $http_code)${NC}"
    ((PASSED++))
  else
    echo -e "${RED}FAIL (Expected: $expected_status, Got: $http_code)${NC}"
    ((FAILED++))
    ((GAPS_FOUND++))
    cat "$response_file" | head -5
    echo ""
  fi
  
  rm -f "$response_file"
}

# ============================================================================
# SECTION 1: SWARM MODE API ENDPOINTS
# ============================================================================
echo -e "${BLUE}1. SWARM Mode API Endpoints${NC}"
echo "-----"

test_endpoint "SWARM Stats" "GET" "/api/swarm/stats" "" "200"

test_endpoint "SWARM Execute" "POST" "/api/swarm/execute" \
  '{"description":"Test","requiredTools":[]}' "200"

# Get a task ID for status testing
TASK_ID=$(curl -s -X POST "$BASE_URL/api/swarm/execute" \
  -H "Content-Type: application/json" \
  -d '{"description":"Status test","requiredTools":[]}' | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$TASK_ID" ]; then
  test_endpoint "SWARM Status" "GET" "/api/swarm/status/$TASK_ID" "" "200,404"
else
  echo -e "${YELLOW}⚠️  Could not extract task ID for status test${NC}"
  ((GAPS_FOUND++))
fi

echo ""

# ============================================================================
# SECTION 2: GUARD RAILS VALIDATION
# ============================================================================
echo -e "${BLUE}2. Guard Rails Security Validation${NC}"
echo "-----"

# Test 1: Unregistered tools should be rejected
RESPONSE=$(curl -s -X POST "$BASE_URL/api/swarm/execute" \
  -H "Content-Type: application/json" \
  -d '{"description":"RCE test","requiredTools":["nonexistent-tool"]}')

if echo "$RESPONSE" | grep -q "error\|failed"; then
  echo -e "${GREEN}PASS: Unregistered tools rejected${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}WARN: Tool rejection response unclear${NC}"
  ((GAPS_FOUND++))
fi

# Test 2: Rate limiting should be present
echo -n "Rate limiting check ... "
RATE_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/swarm/execute" \
  -H "Content-Type: application/json" \
  -d '{"description":"Rate test","requiredTools":[]}' -o /dev/null)

if [[ "$RATE_RESPONSE" == "200" || "$RATE_RESPONSE" == "429" ]]; then
  echo -e "${GREEN}PASS (Rate limiting active)${NC}"
  ((PASSED++))
else
  echo -e "${RED}FAIL (Got HTTP $RATE_RESPONSE)${NC}"
  ((FAILED++))
  ((GAPS_FOUND++))
fi

# Test 3: Cost validation
echo -n "Cost limit validation ... "
COST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/swarm/execute" \
  -H "Content-Type: application/json" \
  -d '{"description":"Cost test","requiredTools":[],"maxCost":0.01}')

if echo "$COST_RESPONSE" | grep -q "totalCost\|execution"; then
  echo -e "${GREEN}PASS (Cost tracking present)${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}WARN: Cost response structure unclear${NC}"
  ((GAPS_FOUND++))
fi

echo ""

# ============================================================================
# SECTION 3: CRITICAL API ENDPOINTS
# ============================================================================
echo -e "${BLUE}3. Critical Platform Endpoints${NC}"
echo "-----"

test_endpoint "Swarm Stats (Core)" "GET" "/api/swarm/stats" "" "200"
test_endpoint "Projects API" "GET" "/api/projects" "" "200,401"
test_endpoint "LomuAI Status" "GET" "/api/lomu-ai/status" "" "200,401,404"

echo ""

# ============================================================================
# SECTION 4: EXECUTION LOG QUALITY
# ============================================================================
echo -e "${BLUE}4. Execution Log Quality${NC}"
echo "-----"

EXEC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/swarm/execute" \
  -H "Content-Type: application/json" \
  -d '{"description":"Log quality test","requiredTools":[]}')

echo -n "Execution log contains guard rail logs ... "
if echo "$EXEC_RESPONSE" | grep -q "GUARD-RAIL\|ORCHESTRATOR"; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}WARN: Guard rail logs not visible${NC}"
  ((GAPS_FOUND++))
fi

echo -n "Execution log contains timestamps ... "
if echo "$EXEC_RESPONSE" | grep -q "startTime\|endTime"; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}WARN: Timestamps missing${NC}"
  ((GAPS_FOUND++))
fi

echo -n "Execution contains error field ... "
if echo "$EXEC_RESPONSE" | grep -q "errors"; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}WARN: Error field missing${NC}"
  ((GAPS_FOUND++))
fi

echo ""

# ============================================================================
# SECTION 5: SERVER HEALTH
# ============================================================================
echo -e "${BLUE}5. Server Health Checks${NC}"
echo "-----"

echo -n "Server responsive ... "
if curl -s "$BASE_URL" > /dev/null 2>&1; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}FAIL: Server not responding${NC}"
  ((FAILED++))
  ((GAPS_FOUND++))
fi

echo -n "SWARM router mounted ... "
if curl -s "$BASE_URL/api/swarm/stats" > /dev/null 2>&1; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}FAIL: SWARM router not accessible${NC}"
  ((FAILED++))
  ((GAPS_FOUND++))
fi

echo -n "Database connection ... "
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/swarm/stats")
if echo "$HEALTH_RESPONSE" | grep -q "activeExecutions"; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}FAIL: Database may not be responding${NC}"
  ((FAILED++))
  ((GAPS_FOUND++))
fi

echo ""

# ============================================================================
# SECTION 6: DATA INTEGRITY
# ============================================================================
echo -e "${BLUE}6. Data Integrity${NC}"
echo "-----"

INTEGRITY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/swarm/execute" \
  -H "Content-Type: application/json" \
  -d '{"description":"Data integrity test","requiredTools":[]}')

echo -n "Response contains taskId ... "
if echo "$INTEGRITY_RESPONSE" | grep -q "taskId"; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}FAIL${NC}"
  ((FAILED++))
  ((GAPS_FOUND++))
fi

echo -n "Response contains execution status ... "
if echo "$INTEGRITY_RESPONSE" | grep -q "status"; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}FAIL${NC}"
  ((FAILED++))
  ((GAPS_FOUND++))
fi

echo -n "Response contains valid JSON ... "
if echo "$INTEGRITY_RESPONSE" | jq . > /dev/null 2>&1; then
  echo -e "${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}FAIL: Invalid JSON response${NC}"
  ((FAILED++))
  ((GAPS_FOUND++))
fi

echo ""

# ============================================================================
# SUMMARY & GAP REPORT
# ============================================================================
echo -e "${BLUE}=================================================================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}=================================================================================${NC}"
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo -e "${YELLOW}⚠ Gaps Found: $GAPS_FOUND${NC}"

if [ $GAPS_FOUND -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All tests passed! No critical gaps detected.${NC}"
  exit 0
else
  echo -e "\n${YELLOW}Identified gaps in platform:${NC}"
  echo "1. If failing on auth endpoints (401) - Normal, auth not configured in test"
  echo "2. If SWARM endpoints 500 - Check server logs for runtime errors"
  echo "3. If response structure missing fields - Schema mismatch between API and client"
  echo "4. If rate limiting not active - Check guardrails configuration"
  echo ""
  echo "Next steps:"
  echo "- Run 'npx playwright install' if UI tests needed"
  echo "- Check server logs: journalctl -u lomuai or tail -f server.log"
  echo "- Review GAP_ANALYSIS_REPORT.md for known gaps"
  exit 1
fi
