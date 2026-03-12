#!/bin/bash

# =====================================================
# Quick Deploy Script
# =====================================================
# รัน script เดียว deploy ทั้ง local และ VPS
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "  🚀 Quick Deploy (Local + VPS)"
echo "======================================"
echo ""

# Step 1: Push code to GitHub
echo -e "${BLUE}Step 1/2: Pushing to GitHub...${NC}"
echo ""

# ตรวจสอบว่ามี git-merge.sh หรือไม่
if [ ! -f "git-merge.sh" ]; then
    echo -e "${RED}❌ git-merge.sh not found${NC}"
    exit 1
fi

# รัน git-merge.sh
./git-merge.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git push failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Code pushed to GitHub${NC}"
echo ""

# ถามว่าจะ deploy ไป VPS หรือไม่
echo -e "${YELLOW}📦 พร้อม deploy ไป VPS${NC}"
read -p "ดำเนินการต่อ? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "ยกเลิก VPS deployment"
    echo -e "${GREEN}✅ Local deployment เสร็จสิ้น${NC}"
    exit 0
fi

# Step 2: Deploy to VPS
echo ""
echo -e "${BLUE}Step 2/2: Deploying to VPS...${NC}"
echo ""

# ตรวจสอบว่ามี vps-deploy.sh หรือไม่
if [ ! -f "scripts/vps-deploy.sh" ]; then
    echo -e "${RED}❌ scripts/vps-deploy.sh not found${NC}"
    exit 1
fi

# รัน vps-deploy.sh
chmod +x scripts/vps-deploy.sh
./scripts/vps-deploy.sh

echo ""
echo "======================================"
echo "  🎉 Deployment Complete!"
echo "======================================"
echo ""
echo "Summary:"
echo "  ✅ Code pushed to GitHub"
echo "  ✅ VPS updated and restarted"
echo "  ✅ Migrations applied"
echo ""
