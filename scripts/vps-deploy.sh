#!/bin/bash

# =====================================================
# VPS Deployment Script
# =====================================================
# Auto SSH to VPS, pull code, run migrations, restart
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# ========================================
# CONFIGURATION - แก้ตรงนี้
# ========================================
VPS_HOST="117.18.127.181"
VPS_USER="root"
VPS_PASSWORD="4b90e6l4dQR3lgMiBlRvN3"  # ⚠️ ใส่ password ตรงนี้ (หรือใช้ SSH key)
VPS_PROJECT_PATH="/var/www/atsoko-backend"
# ========================================

echo "======================================"
echo "  🚀 VPS Deployment"
echo "======================================"
echo "VPS: $VPS_USER@$VPS_HOST"
echo "Path: $VPS_PROJECT_PATH"
echo ""

# ตรวจสอบว่ามี sshpass หรือไม่ (สำหรับ auto password)
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}⚠️  sshpass ไม่ได้ติดตั้ง${NC}"
    echo "ติดตั้งด้วย: sudo apt-get install sshpass"
    echo ""
    echo "หรือใช้ SSH key แทน (แนะนำ):"
    echo "  ssh-copy-id $VPS_USER@$VPS_HOST"
    echo ""
    USE_SSHPASS=false
else
    USE_SSHPASS=true
fi

# สร้าง deployment script ที่จะรันบน VPS
DEPLOY_SCRIPT=$(cat <<'EOF'
#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  🚀 VPS Deployment Started"
echo "======================================"
echo "Time: $(date)"
echo ""

# Step 1: Backup database
echo -e "${BLUE}Step 1/5: Backing up database...${NC}"
if [ -f "scripts/backup-db.sh" ]; then
    chmod +x scripts/backup-db.sh
    ./scripts/backup-db.sh
    echo -e "${GREEN}✅ Backup completed${NC}"
else
    echo -e "${YELLOW}⚠️  Backup script not found${NC}"
fi

# Step 2: Pull latest code
echo ""
echo -e "${BLUE}Step 2/5: Pulling latest code...${NC}"
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"
git pull origin $CURRENT_BRANCH
echo -e "${GREEN}✅ Code updated${NC}"

# Step 3: Install dependencies
echo ""
echo -e "${BLUE}Step 3/5: Installing dependencies...${NC}"
npm ci
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 4: Run migrations
echo ""
echo -e "${BLUE}Step 4/5: Running migrations...${NC}"
if [ -f "scripts/migrate.sh" ]; then
    chmod +x scripts/migrate.sh
    ./scripts/migrate.sh
    echo -e "${GREEN}✅ Migrations completed${NC}"
else
    echo -e "${YELLOW}⚠️  Migration script not found${NC}"
fi

# Step 5: Restart application
echo ""
echo -e "${BLUE}Step 5/5: Restarting application...${NC}"
if command -v pm2 &> /dev/null; then
    # Restart specific app by name
    pm2 restart atsoko-backend
    echo -e "${GREEN}✅ Application restarted${NC}"
    echo ""
    pm2 status
else
    echo -e "${YELLOW}⚠️  PM2 not found${NC}"
fi

echo ""
echo "======================================"
echo "  ✅ Deployment Complete"
echo "======================================"
echo "Time: $(date)"
echo ""
EOF
)

# รัน deployment บน VPS
echo -e "${BLUE}🔄 Connecting to VPS...${NC}"
echo ""

if [ "$USE_SSHPASS" = true ] && [ -n "$VPS_PASSWORD" ]; then
    # ใช้ sshpass (auto password)
    echo "$DEPLOY_SCRIPT" | sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "cd $VPS_PROJECT_PATH && bash -s"
elif [ -n "$VPS_PASSWORD" ]; then
    # ไม่มี sshpass - ต้องใส่ password เอง
    echo -e "${YELLOW}⚠️  กรุณาใส่ password เมื่อถูกถาม${NC}"
    echo "$DEPLOY_SCRIPT" | ssh $VPS_USER@$VPS_HOST "cd $VPS_PROJECT_PATH && bash -s"
else
    # ใช้ SSH key
    echo "$DEPLOY_SCRIPT" | ssh $VPS_USER@$VPS_HOST "cd $VPS_PROJECT_PATH && bash -s"
fi

echo ""
echo -e "${GREEN}🎉 VPS Deployment เสร็จสิ้น!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. ตรวจสอบ application: http://$VPS_HOST"
echo "2. ตรวจสอบ logs: ssh $VPS_USER@$VPS_HOST 'cd $VPS_PROJECT_PATH && pm2 logs'"
echo "3. ทดสอบ features สำคัญ"
