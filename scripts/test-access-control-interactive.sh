#!/bin/bash

# =============================================================================
# Access Control API - Interactive Test Script
# สำหรับทดสอบ API ทั้งหมดแบบ interactive
# =============================================================================

BASE_URL="http://localhost:3000/api"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=============================================="
echo "   Access Control API - Test Script"
echo "=============================================="
echo -e "${NC}"

# Login Admin
echo -e "${YELLOW}🔐 Logging in as Admin...${NC}"
ADMIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "testadmin@atsoko.com", "password": "TestPass123!"}')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.data.accessToken')

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    echo -e "${GREEN}✅ Admin login successful${NC}"
else
    echo -e "${RED}❌ Admin login failed${NC}"
    echo $ADMIN_RESPONSE | jq .
    exit 1
fi

# Login Agent
echo -e "${YELLOW}🔐 Logging in as Agent...${NC}"
AGENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "testagent@atsoko.com", "password": "TestPass123!"}')

AGENT_TOKEN=$(echo $AGENT_RESPONSE | jq -r '.data.accessToken')

if [ "$AGENT_TOKEN" != "null" ] && [ -n "$AGENT_TOKEN" ]; then
    echo -e "${GREEN}✅ Agent login successful${NC}"
else
    echo -e "${RED}❌ Agent login failed${NC}"
    echo $AGENT_RESPONSE | jq .
    exit 1
fi

echo ""
echo -e "${BLUE}Select a test to run:${NC}"
echo "1. Get Pending Properties (Admin)"
echo "2. Change Workflow Status (Admin)"
echo "3. Publish Property (Admin)"
echo "4. Unpublish Property (Admin)"
echo "5. Get Workflow History"
echo "6. Create Edit Request (Agent)"
echo "7. Create Delete Request (Agent)"
echo "8. Get All Requests"
echo "9. Process Request - Approve (Admin)"
echo "10. Process Request - Reject (Admin)"
echo "11. Get Property Notes"
echo "12. Add Note (Admin)"
echo "13. Add Note (Agent)"
echo "14. Run All Tests"
echo "0. Exit"
echo ""

read -p "Enter choice: " CHOICE

case $CHOICE in
    1)
        echo -e "\n${YELLOW}📋 Getting Pending Properties...${NC}"
        curl -s -X GET "${BASE_URL}/property-workflow/pending" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq .
        ;;
    2)
        read -p "Property ID: " PROP_ID
        read -p "Status (pending/wait_to_fix/fixed/ready_to_publish): " STATUS
        read -p "Note: " NOTE
        echo -e "\n${YELLOW}🔄 Changing Workflow Status...${NC}"
        curl -s -X PUT "${BASE_URL}/property-workflow/${PROP_ID}/status" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{\"workflow_status\": \"${STATUS}\", \"note\": \"${NOTE}\"}" | jq .
        ;;
    3)
        read -p "Property ID: " PROP_ID
        echo -e "\n${YELLOW}📢 Publishing Property...${NC}"
        curl -s -X PUT "${BASE_URL}/property-workflow/${PROP_ID}/publish" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" \
          -H "Content-Type: application/json" \
          -d '{"note": "Published via test script"}' | jq .
        ;;
    4)
        read -p "Property ID: " PROP_ID
        echo -e "\n${YELLOW}📤 Unpublishing Property...${NC}"
        curl -s -X PUT "${BASE_URL}/property-workflow/${PROP_ID}/unpublish" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" \
          -H "Content-Type: application/json" \
          -d '{"workflow_status": "pending", "note": "Unpublished for review"}' | jq .
        ;;
    5)
        read -p "Property ID: " PROP_ID
        echo -e "\n${YELLOW}📜 Getting Workflow History...${NC}"
        curl -s -X GET "${BASE_URL}/property-workflow/${PROP_ID}/history" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq .
        ;;
    6)
        read -p "Property ID (published): " PROP_ID
        read -p "Reason: " REASON
        echo -e "\n${YELLOW}✏️ Creating Edit Request...${NC}"
        curl -s -X POST "${BASE_URL}/property-requests" \
          -H "Authorization: Bearer ${AGENT_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{\"property_id\": ${PROP_ID}, \"request_type\": \"edit\", \"reason\": \"${REASON}\", \"requested_changes\": {\"price\": 100000}}" | jq .
        ;;
    7)
        read -p "Property ID (published): " PROP_ID
        read -p "Reason: " REASON
        echo -e "\n${YELLOW}🗑️ Creating Delete Request...${NC}"
        curl -s -X POST "${BASE_URL}/property-requests" \
          -H "Authorization: Bearer ${AGENT_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{\"property_id\": ${PROP_ID}, \"request_type\": \"delete\", \"reason\": \"${REASON}\"}" | jq .
        ;;
    8)
        echo -e "\n${YELLOW}📋 Getting All Requests...${NC}"
        curl -s -X GET "${BASE_URL}/property-requests" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq .
        ;;
    9)
        read -p "Request ID: " REQ_ID
        read -p "Admin Response: " RESPONSE
        echo -e "\n${YELLOW}✅ Approving Request...${NC}"
        curl -s -X PUT "${BASE_URL}/property-requests/${REQ_ID}/process" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{\"action\": \"approve\", \"admin_response\": \"${RESPONSE}\"}" | jq .
        ;;
    10)
        read -p "Request ID: " REQ_ID
        read -p "Admin Response: " RESPONSE
        echo -e "\n${YELLOW}❌ Rejecting Request...${NC}"
        curl -s -X PUT "${BASE_URL}/property-requests/${REQ_ID}/process" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{\"action\": \"reject\", \"admin_response\": \"${RESPONSE}\"}" | jq .
        ;;
    11)
        read -p "Property ID: " PROP_ID
        echo -e "\n${YELLOW}💬 Getting Notes...${NC}"
        curl -s -X GET "${BASE_URL}/property-notes/${PROP_ID}" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq .
        ;;
    12)
        read -p "Property ID: " PROP_ID
        read -p "Content: " CONTENT
        read -p "Internal (true/false): " INTERNAL
        echo -e "\n${YELLOW}📝 Adding Admin Note...${NC}"
        curl -s -X POST "${BASE_URL}/property-notes/${PROP_ID}" \
          -H "Authorization: Bearer ${ADMIN_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{\"content\": \"${CONTENT}\", \"note_type\": \"general\", \"is_internal\": ${INTERNAL}}" | jq .
        ;;
    13)
        read -p "Property ID: " PROP_ID
        read -p "Content: " CONTENT
        echo -e "\n${YELLOW}📝 Adding Agent Note...${NC}"
        curl -s -X POST "${BASE_URL}/property-notes/${PROP_ID}" \
          -H "Authorization: Bearer ${AGENT_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{\"content\": \"${CONTENT}\", \"note_type\": \"fix_response\"}" | jq .
        ;;
    14)
        echo -e "\n${YELLOW}🚀 Running all tests...${NC}"
        node scripts/test-access-control-complete.js
        ;;
    0)
        echo "Bye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        ;;
esac

echo ""
