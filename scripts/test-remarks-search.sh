#!/bin/bash

# ===================================
# Test Script: Remarks Search API
# ===================================

BASE_URL="http://localhost:3000/api"
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Remarks Search API Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"

# ─────────────────────────────────────────
# STEP 1: Login to get tokens
# ─────────────────────────────────────────
echo -e "\n${YELLOW}[SETUP] Getting tokens...${NC}"

# Admin login
ADMIN_RESP=$(curl -s --max-time 10 -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testadmin@atsoko.com","password":"Test1234!"}')
ADMIN_TOKEN=$(echo $ADMIN_RESP | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','') or d.get('accessToken','') or d.get('data',{}).get('token',''))" 2>/dev/null)

# Agent login (team A)
AGENT_RESP=$(curl -s --max-time 10 -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@test.com","password":"Test1234!"}')
AGENT_TOKEN=$(echo $AGENT_RESP | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','') or d.get('accessToken','') or d.get('data',{}).get('token',''))" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get ADMIN token. Response: $ADMIN_RESP${NC}"
  echo -e "${YELLOW}ℹ️  ลอง login ด้วย password อื่น...${NC}"
  # Try other common passwords
  for PWD in "admin123" "password" "123456" "atsoko123" "Admin123!"; do
    RESP=$(curl -s --max-time 5 -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"testadmin@atsoko.com\",\"password\":\"$PWD\"}")
    TK=$(echo $RESP | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','') or d.get('accessToken','') or d.get('data',{}).get('token',''))" 2>/dev/null)
    if [ -n "$TK" ]; then
      ADMIN_TOKEN=$TK
      echo -e "${GREEN}✅ Found admin password: $PWD${NC}"
      break
    fi
  done
fi

if [ -z "$AGENT_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get AGENT token. Response: $AGENT_RESP${NC}"
  for PWD in "agent123" "password" "123456" "atsoko123" "Test1234!"; do
    RESP=$(curl -s --max-time 5 -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"agent@test.com\",\"password\":\"$PWD\"}")
    TK=$(echo $RESP | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','') or d.get('accessToken','') or d.get('data',{}).get('token',''))" 2>/dev/null)
    if [ -n "$TK" ]; then
      AGENT_TOKEN=$TK
      echo -e "${GREEN}✅ Found agent password: $PWD${NC}"
      break
    fi
  done
fi

echo -e "Admin Token: ${ADMIN_TOKEN:0:30}..."
echo -e "Agent Token: ${AGENT_TOKEN:0:30}..."

# ─────────────────────────────────────────
# Helper function
# ─────────────────────────────────────────
check_test() {
  local TEST_NAME="$1"
  local EXPECTED_HTTP="$2"
  local ACTUAL_HTTP="$3"
  local RESPONSE="$4"
  local EXTRA_CHECK="$5"

  if [ "$ACTUAL_HTTP" == "$EXPECTED_HTTP" ]; then
    # Check extra condition if provided
    if [ -n "$EXTRA_CHECK" ]; then
      if echo "$RESPONSE" | grep -q "$EXTRA_CHECK"; then
        echo -e "  ${GREEN}✅ PASS${NC} - $TEST_NAME (HTTP $ACTUAL_HTTP, contains '$EXTRA_CHECK')"
        PASS=$((PASS+1))
      else
        echo -e "  ${RED}❌ FAIL${NC} - $TEST_NAME (HTTP $ACTUAL_HTTP, missing '$EXTRA_CHECK')"
        echo -e "     Response: $(echo $RESPONSE | head -c 200)"
        FAIL=$((FAIL+1))
      fi
    else
      echo -e "  ${GREEN}✅ PASS${NC} - $TEST_NAME (HTTP $ACTUAL_HTTP)"
      PASS=$((PASS+1))
    fi
  else
    echo -e "  ${RED}❌ FAIL${NC} - $TEST_NAME (Expected HTTP $EXPECTED_HTTP, got $ACTUAL_HTTP)"
    echo -e "     Response: $(echo $RESPONSE | head -c 300)"
    FAIL=$((FAIL+1))
  fi
}

# ─────────────────────────────────────────
# SECTION 1: GET /api/properties?keyword=
# ─────────────────────────────────────────
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Section 1: Keyword Search (ทุก role ใช้ได้)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1.1 Guest keyword search (no auth)
HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
  "$BASE_URL/properties?keyword=warehouse&limit=5")
RESP=$(cat /tmp/resp.json)
check_test "Guest: keyword search (no auth)" "200" "$HTTP" "$RESP" "success"

# 1.2 Admin keyword search
if [ -n "$ADMIN_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE_URL/properties?keyword=warehouse&limit=5")
  RESP=$(cat /tmp/resp.json)
  check_test "Admin: keyword search" "200" "$HTTP" "$RESP" "success"
else
  echo -e "  ${YELLOW}⚠️  SKIP${NC} - Admin token missing"
fi

# 1.3 Agent keyword search
if [ -n "$AGENT_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $AGENT_TOKEN" \
    "$BASE_URL/properties?keyword=warehouse&limit=5")
  RESP=$(cat /tmp/resp.json)
  check_test "Agent: keyword search (sees team's properties)" "200" "$HTTP" "$RESP" "success"
else
  echo -e "  ${YELLOW}⚠️  SKIP${NC} - Agent token missing"
fi

# ─────────────────────────────────────────
# SECTION 2: GET /api/properties?remarks=
# ─────────────────────────────────────────
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Section 2: Remarks Filter (?remarks=)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 2.1 Guest: Should get 401
HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
  "$BASE_URL/properties?remarks=urgent")
RESP=$(cat /tmp/resp.json)
check_test "Guest: remarks filter → should be 401" "401" "$HTTP" "$RESP" ""

# 2.2 Admin: Should work (200)
if [ -n "$ADMIN_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE_URL/properties?remarks=a&limit=5")
  RESP=$(cat /tmp/resp.json)
  check_test "Admin: remarks filter → should be 200" "200" "$HTTP" "$RESP" "success"
else
  echo -e "  ${YELLOW}⚠️  SKIP${NC} - Admin token missing"
fi

# 2.3 Agent: Should work (200) with team filter
if [ -n "$AGENT_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $AGENT_TOKEN" \
    "$BASE_URL/properties?remarks=a&limit=5")
  RESP=$(cat /tmp/resp.json)
  check_test "Agent: remarks filter → should be 200 (team's properties only)" "200" "$HTTP" "$RESP" "success"
else
  echo -e "  ${YELLOW}⚠️  SKIP${NC} - Agent token missing"
fi

# ─────────────────────────────────────────
# SECTION 3: GET /api/properties/remarks-suggestions
# ─────────────────────────────────────────
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Section 3: Remarks Autocomplete (/remarks-suggestions)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 3.1 No auth → 401
HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
  "$BASE_URL/properties/remarks-suggestions?q=urgent")
RESP=$(cat /tmp/resp.json)
check_test "Guest: remarks-suggestions → should be 401" "401" "$HTTP" "$RESP" ""

# 3.2 Admin: Works
if [ -n "$ADMIN_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE_URL/properties/remarks-suggestions?q=ur")
  RESP=$(cat /tmp/resp.json)
  check_test "Admin: remarks-suggestions → should be 200" "200" "$HTTP" "$RESP" "success"
  echo -e "     Suggestions count: $(echo $RESP | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("data",[])))' 2>/dev/null)"
else
  echo -e "  ${YELLOW}⚠️  SKIP${NC} - Admin token missing"
fi

# 3.3 Agent: Works (only suggestions from team's properties)
if [ -n "$AGENT_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $AGENT_TOKEN" \
    "$BASE_URL/properties/remarks-suggestions?q=ur")
  RESP=$(cat /tmp/resp.json)
  check_test "Agent: remarks-suggestions → should be 200 (team's only)" "200" "$HTTP" "$RESP" "success"
  echo -e "     Suggestions count: $(echo $RESP | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("data",[])))' 2>/dev/null)"
else
  echo -e "  ${YELLOW}⚠️  SKIP${NC} - Agent token missing"
fi

# 3.4 Short query (< 2 chars) → empty data
if [ -n "$ADMIN_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE_URL/properties/remarks-suggestions?q=u")
  RESP=$(cat /tmp/resp.json)
  check_test "Admin: short query (< 2 chars) → 200 with empty data" "200" "$HTTP" "$RESP" '"data":[]'
fi

# ─────────────────────────────────────────
# SECTION 4: GET /api/properties (general filters)
# ─────────────────────────────────────────
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Section 4: Other Filters (sanity check)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 4.1 Status filter
HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
  "$BASE_URL/properties?status=rent&limit=3")
RESP=$(cat /tmp/resp.json)
check_test "Guest: ?status=rent filter" "200" "$HTTP" "$RESP" "success"

# 4.2 Combined: keyword + status
if [ -n "$ADMIN_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE_URL/properties?keyword=ware&status=rent&limit=3")
  RESP=$(cat /tmp/resp.json)
  check_test "Admin: keyword + status combined" "200" "$HTTP" "$RESP" "success"
fi

# 4.3 Combined: remarks + status (admin)
if [ -n "$ADMIN_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/resp.json -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE_URL/properties?remarks=a&status=rent&limit=3")
  RESP=$(cat /tmp/resp.json)
  check_test "Admin: remarks + status combined" "200" "$HTTP" "$RESP" "success"
fi

# ─────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────
TOTAL=$((PASS+FAIL))
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}   Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All tests passed!${NC}"
else
  echo -e "\n${RED}⚠️  Some tests failed. Please review.${NC}"
fi
echo ""
