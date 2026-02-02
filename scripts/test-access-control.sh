#!/bin/bash

# =====================================================
# Test Access Control API
# =====================================================

API_URL="http://localhost:3000/api"

echo "================================"
echo "Testing Access Control API"
echo "================================"
echo ""

# Test 1: Get pending properties (requires admin token)
echo "1. Testing /property-workflow/pending endpoint..."
RESULT=$(curl -s -w "\n%{http_code}" "${API_URL}/property-workflow/pending" 2>/dev/null)
HTTP_CODE=$(echo "$RESULT" | tail -n1)
echo "   HTTP Status: $HTTP_CODE (expected: 401 without token)"
echo ""

# Test 2: Check property requests endpoint
echo "2. Testing /property-requests endpoint..."
RESULT=$(curl -s -w "\n%{http_code}" "${API_URL}/property-requests" 2>/dev/null)
HTTP_CODE=$(echo "$RESULT" | tail -n1)
echo "   HTTP Status: $HTTP_CODE (expected: 401 without token)"
echo ""

# Test 3: Check property notes endpoint
echo "3. Testing /property-notes/1 endpoint..."
RESULT=$(curl -s -w "\n%{http_code}" "${API_URL}/property-notes/1" 2>/dev/null)
HTTP_CODE=$(echo "$RESULT" | tail -n1)
echo "   HTTP Status: $HTTP_CODE (expected: 401 without token)"
echo ""

# Test 4: Check if properties endpoint still works
echo "4. Testing /properties endpoint (public)..."
RESULT=$(curl -s "${API_URL}/properties?limit=1" 2>/dev/null | jq -r '.success')
echo "   Response success: $RESULT"
echo ""

# Test 5: Check property with workflow_status field
echo "5. Checking if workflow_status field is present..."
RESULT=$(curl -s "${API_URL}/properties?limit=1" 2>/dev/null | jq -r '.data[0].workflow_status')
echo "   workflow_status: $RESULT"
echo ""

# Test 6: Check sorting still works
echo "6. Testing sorting functionality..."
RESULT=$(curl -s "${API_URL}/properties?limit=1&sort=price&order=asc" 2>/dev/null | jq -r '.sorting.sort')
echo "   Sort by: $RESULT"
echo ""

echo "================================"
echo "API Tests Complete!"
echo "================================"
echo ""
echo "To test with authentication, first get a token:"
echo "  curl -X POST ${API_URL}/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\": \"admin@example.com\", \"password\": \"password\"}'"
echo ""
