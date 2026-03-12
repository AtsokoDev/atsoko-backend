# 🚀 Quick Start Guide - Deployment

## 📋 สารบัญ

1. [Setup ครั้งแรก](#setup-ครั้งแรก)
2. [Workflow ปกติ (ไม่มีการเปลี่ยน Schema)](#workflow-ปกติ)
3. [Workflow เมื่อมีการเปลี่ยน Schema](#workflow-เมื่อมีการเปลี่ยน-schema)
4. [Scripts ที่มี](#scripts-ที่มี)

---

## 🔧 Setup ครั้งแรก

### 1. ติดตั้ง sshpass (Optional - สำหรับ auto password)

```bash
sudo apt-get install sshpass
```

หรือใช้ SSH key แทน (แนะนำ):
```bash
ssh-copy-id root@117.18.127.181
```

### 2. ตั้งค่า VPS password

แก้ไขไฟล์: `scripts/vps-deploy.sh`

```bash
# หาบรรทัดนี้
VPS_PASSWORD=""  # ⚠️ ใส่ password ตรงนี้

# เปลี่ยนเป็น
VPS_PASSWORD="your_password_here"
```

**⚠️ สำคัญ:** ถ้าใช้ SSH key ไม่ต้องใส่ password

### 3. สร้าง Initial Migration (ครั้งเดียว)

```bash
# สร้าง migration จาก schema ปัจจุบัน
./scripts/create-initial-migration.sh

# Commit migration file
git add database/migrations/001_initial_schema.sql
git commit -m "feat: add initial migration"
```

### 4. ทดสอบ Migration System

```bash
# ทดสอบบน local
./scripts/migrate.sh

# ตรวจสอบว่าทำงาน
psql -U postgres -d thaiindustrialproperty_db -c "SELECT * FROM schema_migrations;"
```

---

## 🔄 Workflow ปกติ (ไม่มีการเปลี่ยน Schema)

### วิธีที่ 1: ใช้ Script เดิม (git-merge.sh)

```bash
# 1. git add และ commit ก่อน
git add .
git commit -m "feat: your changes"

# 2. รัน git-merge.sh
./git-merge.sh

# 3. Deploy ไป VPS
./scripts/vps-deploy.sh
```

### วิธีที่ 2: ใช้ Quick Deploy (แนะนำ)

```bash
# 1. git add และ commit ก่อน
git add .
git commit -m "feat: your changes"

# 2. รัน script เดียวจบ
./scripts/quick-deploy.sh
```

**Script นี้จะ:**
1. รัน `git-merge.sh` (push to GitHub)
2. ถามว่าจะ deploy VPS หรือไม่
3. ถ้าตอบ y → deploy ไป VPS อัตโนมัติ

---

## 🔧 Workflow เมื่อมีการเปลี่ยน Schema

### Step 1: สร้าง Migration File

```bash
# วิธีที่ 1: สร้างด้วยตัวเอง
vim database/migrations/002_add_new_column.sql
```

**Template:**
```sql
-- =====================================================
-- Migration: Add New Column
-- =====================================================
-- Created: 2026-03-12
-- Description: เพิ่ม column ใหม่
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'new_column'
    ) THEN
        ALTER TABLE properties ADD COLUMN new_column VARCHAR(255);
        RAISE NOTICE 'Migration applied successfully';
    ELSE
        RAISE NOTICE 'Migration already applied, skipping';
    END IF;
END $$;
```

### Step 2: ทดสอบ Migration บน Local

```bash
# ทดสอบ migration
./scripts/migrate.sh

# ตรวจสอบว่าทำงาน
psql -U postgres -d thaiindustrialproperty_db -c "\d properties"
```

### Step 3: Commit และ Push

```bash
# Add migration file
git add database/migrations/002_add_new_column.sql

# Commit
git commit -m "feat: add new column migration"

# Push ด้วย git-merge.sh
./git-merge.sh
```

### Step 4: Deploy ไป VPS

```bash
# Deploy ไป VPS
./scripts/vps-deploy.sh
```

**Script นี้จะ:**
1. SSH ไป VPS อัตโนมัติ
2. Backup database
3. Pull code ใหม่
4. Run migrations
5. Restart application

---

## 📜 Scripts ที่มี

### 1. `git-merge.sh` (เดิม)
**ใช้เมื่อ:** Push code ไป GitHub

```bash
./git-merge.sh
```

**ทำอะไร:**
- Commit changes (ถ้ามี staged files)
- Push phu/dev → develop → main
- Switch accounts อัตโนมัติ

**⚠️ ต้อง:** git add และ commit ก่อน (ถ้ามี changes)

---

### 2. `scripts/vps-deploy.sh` ⭐ ใหม่
**ใช้เมื่อ:** Deploy ไป VPS

```bash
./scripts/vps-deploy.sh
```

**ทำอะไร:**
- SSH to VPS อัตโนมัติ
- cd /var/www/atsoko-backend
- Backup database
- Pull code
- Install dependencies
- Run migrations
- Restart PM2

**⚠️ ต้อง:** Push code ไป GitHub ก่อน

---

### 3. `scripts/quick-deploy.sh` ⭐ ใหม่
**ใช้เมื่อ:** Deploy ทั้ง Local + VPS ในคำสั่งเดียว

```bash
./scripts/quick-deploy.sh
```

**ทำอะไร:**
1. รัน `git-merge.sh`
2. ถามว่าจะ deploy VPS หรือไม่
3. รัน `vps-deploy.sh` (ถ้าตอบ y)

**⚠️ ต้อง:** git add และ commit ก่อน

---

### 4. `scripts/migrate.sh`
**ใช้เมื่อ:** ทดสอบ migrations บน local

```bash
./scripts/migrate.sh
```

**ทำอะไร:**
- รัน migration files ทั้งหมด
- เก็บ history ใน `schema_migrations` table
- Skip migrations ที่รันแล้ว

---

### 5. `scripts/backup-db.sh`
**ใช้เมื่อ:** Backup database ก่อน deploy

```bash
./scripts/backup-db.sh
```

**ทำอะไร:**
- สร้าง backup file: `backups/backup-YYYY-MM-DD-HHMMSS.sql.gz`
- เก็บ 10 backups ล่าสุด
- ลบ backups เก่าอัตโนมัติ

---

### 6. `scripts/create-initial-migration.sh`
**ใช้เมื่อ:** สร้าง initial migration (ครั้งแรกเท่านั้น)

```bash
./scripts/create-initial-migration.sh
```

**ทำอะไร:**
- Export schema ปัจจุบัน
- สร้าง `database/migrations/001_initial_schema.sql`

---

## 🎯 Workflow แนะนำ

### สำหรับการเปลี่ยนโค้ดปกติ:

```bash
# 1. เขียนโค้ด
# 2. Test บน local
npm run dev

# 3. Commit
git add .
git commit -m "feat: your feature"

# 4. Deploy (เลือกวิธีใดวิธีหนึ่ง)

# วิธีที่ 1: แยก steps
./git-merge.sh
./scripts/vps-deploy.sh

# วิธีที่ 2: รัน script เดียว (แนะนำ)
./scripts/quick-deploy.sh
```

---

### สำหรับการเปลี่ยน Schema:

```bash
# 1. สร้าง migration file
vim database/migrations/002_your_migration.sql

# 2. ทดสอบ migration
./scripts/migrate.sh

# 3. ทดสอบ application
npm run dev

# 4. Commit migration
git add database/migrations/002_your_migration.sql
git commit -m "feat: add migration for new feature"

# 5. Deploy
./scripts/quick-deploy.sh
```

---

## 🔍 Troubleshooting

### ปัญหา: SSH ถาม password ทุกครั้ง

**วิธีแก้:**
```bash
# Setup SSH key (แนะนำ)
ssh-copy-id root@117.18.127.181

# หรือติดตั้ง sshpass และใส่ password ใน vps-deploy.sh
sudo apt-get install sshpass
```

---

### ปัญหา: Migration ล้มเหลว

**วิธีแก้:**
```bash
# 1. ตรวจสอบ migration file
cat database/migrations/XXX_your_migration.sql

# 2. ทดสอบ SQL โดยตรง
psql -U postgres -d thaiindustrialproperty_db -f database/migrations/XXX_your_migration.sql

# 3. แก้ไข migration file
vim database/migrations/XXX_your_migration.sql

# 4. ลองใหม่
./scripts/migrate.sh
```

---

### ปัญหา: VPS deployment ล้มเหลว

**วิธีแก้:**
```bash
# 1. SSH เข้า VPS เอง
ssh root@117.18.127.181

# 2. ไปที่ project
cd /var/www/atsoko-backend

# 3. ตรวจสอบ logs
pm2 logs

# 4. ตรวจสอบ git status
git status
git log -1

# 5. รัน migration เอง
./scripts/migrate.sh

# 6. Restart
pm2 restart all
```

---

## 📊 Comparison: เดิม vs ใหม่

| | เดิม | ใหม่ |
|---|------|------|
| **Push Code** | `./git-merge.sh` | `./git-merge.sh` (เหมือนเดิม) |
| **Deploy VPS** | SSH manual | `./scripts/vps-deploy.sh` |
| **Schema Changes** | Export/Import DB | Migration scripts |
| **Data Loss** | ❌ มี | ✅ ไม่มี |
| **Rollback** | ❌ ยาก | ✅ ง่าย |
| **Auto Deploy** | ❌ ไม่มี | ✅ มี (`quick-deploy.sh`) |

---

## 🎯 สรุป

### ใช้ Script ไหน?

```
มีการเปลี่ยน Schema?
│
├─ ❌ ไม่มี
│  └─ ./scripts/quick-deploy.sh (แนะนำ)
│     หรือ
│     ./git-merge.sh + ./scripts/vps-deploy.sh
│
└─ ✅ มี
   ├─ 1. สร้าง migration file
   ├─ 2. ./scripts/migrate.sh (ทดสอบ)
   ├─ 3. git add + commit
   └─ 4. ./scripts/quick-deploy.sh
```

### Flow ที่ง่ายที่สุด:

```bash
# ทุกครั้งที่ต้องการ deploy:

# 1. Commit changes
git add .
git commit -m "your message"

# 2. รัน script เดียว
./scripts/quick-deploy.sh

# เสร็จ! 🎉
```

---

**Happy Deploying! 🚀**
