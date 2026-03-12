#!/bin/bash

# =====================================================
# Local Deployment Script
# =====================================================
# สำหรับรันบน Local เมื่อมีการเปลี่ยน schema
# จะสร้าง migration file และ push ไป GitHub
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "  🚀 Local Deployment"
echo "======================================"
echo ""

# ตรวจสอบว่ามี migration ใหม่หรือไม่
MIGRATION_DIR="database/migrations"
mkdir -p "$MIGRATION_DIR"

# นับจำนวน migration files
migration_count=$(ls -1 $MIGRATION_DIR/*.sql 2>/dev/null | wc -l)

if [ "$migration_count" -eq 0 ]; then
    echo -e "${YELLOW}ℹ️  ไม่มี migration files${NC}"
    echo "ถ้ามีการเปลี่ยน schema ให้สร้าง migration file ก่อน"
    echo ""
    read -p "ต้องการสร้าง migration ใหม่? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # ถามชื่อ migration
        read -p "📝 ชื่อ migration (เช่น add_new_column): " MIGRATION_NAME
        if [ -z "$MIGRATION_NAME" ]; then
            echo -e "${RED}❌ ชื่อ migration ไม่สามารถว่างได้${NC}"
            exit 1
        fi
        
        # หาเลข migration ถัดไป
        NEXT_NUM=$(printf "%03d" $((migration_count + 1)))
        MIGRATION_FILE="$MIGRATION_DIR/${NEXT_NUM}_${MIGRATION_NAME}.sql"
        
        # สร้าง template
        cat > "$MIGRATION_FILE" <<EOF
-- =====================================================
-- Migration: ${MIGRATION_NAME}
-- =====================================================
-- Created: $(date +"%Y-%m-%d %H:%M:%S")
-- Description: TODO - อธิบายการเปลี่ยนแปลง
-- =====================================================

-- TODO: เขียน SQL migration ตรงนี้
-- ตัวอย่าง:
-- ALTER TABLE properties ADD COLUMN new_column VARCHAR(255);

-- เช็คว่า migration ถูก apply แล้วหรือยัง
DO \$\$
BEGIN
    -- TODO: เขียน logic ตรงนี้
    RAISE NOTICE 'Migration ${NEXT_NUM} applied successfully';
END \$\$;
EOF
        
        echo -e "${GREEN}✅ สร้าง migration file: $MIGRATION_FILE${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  กรุณาแก้ไขไฟล์ migration ก่อน commit${NC}"
        echo "เปิดไฟล์: $MIGRATION_FILE"
        exit 0
    else
        echo "ยกเลิก"
        exit 0
    fi
fi

# ทดสอบ migration บน local
echo -e "${BLUE}🧪 ทดสอบ migration บน local...${NC}"
./scripts/migrate.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Migration ล้มเหลว กรุณาแก้ไขก่อน deploy${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration ทดสอบสำเร็จ${NC}"
echo ""

# ถามว่าจะ commit และ push หรือไม่
echo -e "${YELLOW}📦 พร้อม commit และ push ไป GitHub${NC}"
read -p "ดำเนินการต่อ? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "ยกเลิก"
    exit 0
fi

# เรียก git-merge.sh
echo ""
echo -e "${BLUE}🔄 เรียก git-merge.sh...${NC}"
./git-merge.sh

echo ""
echo -e "${GREEN}✅ Local deployment เสร็จสิ้น${NC}"
echo ""
echo "Next step: รัน VPS deployment"
echo "  ./scripts/vps-deploy.sh"
