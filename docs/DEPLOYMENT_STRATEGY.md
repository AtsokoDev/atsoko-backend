# 🚀 Deployment Strategy: Local ↔ VPS

## 🎯 ปัญหาปัจจุบัน

### Current Workflow:
```
1. Test/Develop on Local
2. Push code to GitHub
3. Pull code on VPS
4. Export DB from Local → Import to VPS (ทับทั้งหมด)
```

### ⚠️ ปัญหาที่เกิดขึ้น:

1. **Data Loss**
   - ข้อมูลใหม่ที่สร้างบน VPS หาย (ถูกทับด้วย local DB)
   - ทีมงานที่ test บน VPS สร้างข้อมูล → หายหมด

2. **Image Mismatch**
   - DB reference รูปภาพที่ไม่มีจริงบน VPS
   - หรือมีรูปภาพบน VPS แต่ไม่มี reference ใน DB

3. **No Rollback**
   - ถ้า deploy แล้วมีปัญหา ย้อนกลับยาก

---

## ✅ Solution: Database Migration Strategy

### แนวคิด: **ใช้ Migration Scripts แทนการ Export/Import ทั้งหมด**

```
❌ เดิม: Export ทั้ง DB → Import ทับ (data loss)
✅ ใหม่: Run Migration Scripts → เปลี่ยนแค่ schema/structure
```

---

## 📋 Recommended Workflow

### 1. **Separate Schema Changes from Data**

#### Schema Changes (Structure):
- เปลี่ยน table structure
- เพิ่ม/ลบ columns
- เพิ่ม indexes
- เปลี่ยน constraints

#### Data Changes:
- Insert/Update/Delete ข้อมูล
- ควรทำผ่าน application (API)
- หรือใช้ data migration scripts เฉพาะเจาะจง

---

### 2. **Migration-Based Deployment**

```
Local Development:
├─ 1. Develop feature
├─ 2. Create migration script
├─ 3. Test migration on local
├─ 4. Commit code + migration script
└─ 5. Push to GitHub

VPS Deployment:
├─ 1. Pull code from GitHub
├─ 2. Backup VPS database (safety)
├─ 3. Run migration scripts
├─ 4. Restart application
└─ 5. Verify deployment
```

---

## 🔧 Implementation

### Directory Structure:

```
atsoko-backend/
├─ database/
│  ├─ migrations/
│  │  ├─ 001_initial_schema.sql
│  │  ├─ 002_add_version_system.sql
│  │  ├─ 003_add_category_tags.sql
│  │  └─ ... (numbered migrations)
│  ├─ seeds/
│  │  ├─ dev_seed.sql (test data for local)
│  │  └─ prod_seed.sql (initial data for production)
│  └─ rollback/
│     ├─ 002_rollback.sql
│     └─ 003_rollback.sql
├─ scripts/
│  ├─ migrate.sh (run migrations)
│  ├─ backup-db.sh (backup before deploy)
│  └─ rollback.sh (rollback if needed)
└─ uploads/
   └─ .gitkeep (track folder, not files)
```

---

## 📝 Migration Script Example

### Create Migration: `database/migrations/004_add_new_column.sql`

```sql
-- Migration: Add new column to properties table
-- Date: 2026-03-12
-- Author: Dev Team

-- Check if migration already applied
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'new_column'
    ) THEN
        -- Add new column
        ALTER TABLE properties 
        ADD COLUMN new_column VARCHAR(255);
        
        -- Add index if needed
        CREATE INDEX idx_properties_new_column 
        ON properties(new_column);
        
        RAISE NOTICE 'Migration 004 applied successfully';
    ELSE
        RAISE NOTICE 'Migration 004 already applied, skipping';
    END IF;
END $$;
```

### Rollback Script: `database/rollback/004_rollback.sql`

```sql
-- Rollback Migration 004
-- Remove new_column from properties

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'new_column'
    ) THEN
        DROP INDEX IF EXISTS idx_properties_new_column;
        ALTER TABLE properties DROP COLUMN new_column;
        RAISE NOTICE 'Migration 004 rolled back successfully';
    ELSE
        RAISE NOTICE 'Migration 004 not applied, nothing to rollback';
    END IF;
END $$;
```

---

## 🖼️ Image/Upload Management Strategy

### Problem:
- Local uploads ≠ VPS uploads
- DB references images that don't exist

### Solution Options:

#### Option 1: **Shared Storage (Recommended for Production)**

```
Local Development:
└─ Use S3/Cloud Storage (same bucket as VPS)
   → Images accessible from both environments

VPS Production:
└─ Use S3/Cloud Storage
   → No image sync needed
```

**Pros:**
- ✅ No sync needed
- ✅ Scalable
- ✅ CDN support
- ✅ Automatic backup

**Cons:**
- ❌ Need cloud service (cost)

#### Option 2: **Separate Storage + Placeholder Images**

```
Local Development:
├─ Use local uploads/
└─ DB references: /uploads/image.jpg

VPS Production:
├─ Use VPS uploads/
└─ DB references: /uploads/image.jpg
```

**Handle missing images in frontend:**
```javascript
<img 
  src={imageUrl} 
  onError={(e) => {
    e.target.src = '/placeholder.jpg';
  }}
/>
```

**Pros:**
- ✅ Simple
- ✅ No cloud service needed

**Cons:**
- ❌ Images not synced
- ❌ Need placeholder handling

#### Option 3: **Git LFS for Test Images (Development Only)**

```bash
# Track uploads folder with Git LFS
git lfs track "uploads/**"
git add .gitattributes
git add uploads/
git commit -m "Add test images with LFS"
```

**Pros:**
- ✅ Images synced via Git
- ✅ Good for test data

**Cons:**
- ❌ Not for production (large repo)
- ❌ LFS quota limits

---

## 🎯 Recommended Setup

### For Your Use Case:

#### Local Development:
```
1. Use local database
2. Use local uploads/ folder
3. Test with placeholder/dummy images
4. Create migration scripts for schema changes
```

#### VPS Staging/Production:
```
1. Use VPS database (separate from local)
2. Use VPS uploads/ folder OR S3
3. Real data from team testing
4. Apply migration scripts (not full DB import)
```

---

## 📜 Migration Scripts

### `scripts/migrate.sh`

```bash
#!/bin/bash

# Database Migration Script
# Applies all pending migrations in order

set -e  # Exit on error

DB_NAME="${DB_NAME:-thaiindustrialproperty_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
MIGRATION_DIR="database/migrations"

echo "======================================"
echo "  Database Migration"
echo "======================================"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo ""

# Create migrations table if not exists
psql -U $DB_USER -h $DB_HOST -d $DB_NAME <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
EOF

# Run each migration file
for migration_file in $MIGRATION_DIR/*.sql; do
    if [ -f "$migration_file" ]; then
        migration_name=$(basename "$migration_file")
        
        # Check if already applied
        already_applied=$(psql -U $DB_USER -h $DB_HOST -d $DB_NAME -t -c \
            "SELECT COUNT(*) FROM schema_migrations WHERE migration_name = '$migration_name'")
        
        if [ "$already_applied" -eq 0 ]; then
            echo "Applying migration: $migration_name"
            psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f "$migration_file"
            
            # Record migration
            psql -U $DB_USER -h $DB_HOST -d $DB_NAME -c \
                "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name')"
            
            echo "✅ $migration_name applied successfully"
        else
            echo "⏭️  $migration_name already applied, skipping"
        fi
    fi
done

echo ""
echo "======================================"
echo "  Migration Complete"
echo "======================================"
```

### `scripts/backup-db.sh`

```bash
#!/bin/bash

# Backup Database Before Deployment

set -e

DB_NAME="${DB_NAME:-thaiindustrialproperty_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
BACKUP_DIR="backups"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.sql"

echo "======================================"
echo "  Database Backup"
echo "======================================"
echo "Creating backup: $BACKUP_FILE"

pg_dump -U $DB_USER -h $DB_HOST -d $DB_NAME > "$BACKUP_FILE"

echo "✅ Backup created successfully"
echo ""
echo "To restore:"
echo "psql -U $DB_USER -h $DB_HOST -d $DB_NAME < $BACKUP_FILE"
```

### `scripts/deploy.sh` (Complete Deployment Script)

```bash
#!/bin/bash

# Complete Deployment Script for VPS

set -e

echo "======================================"
echo "  Deployment Started"
echo "======================================"

# 1. Backup database
echo "Step 1: Backing up database..."
./scripts/backup-db.sh

# 2. Pull latest code
echo ""
echo "Step 2: Pulling latest code..."
git pull origin main

# 3. Install dependencies
echo ""
echo "Step 3: Installing dependencies..."
npm install

# 4. Run migrations
echo ""
echo "Step 4: Running database migrations..."
./scripts/migrate.sh

# 5. Restart application
echo ""
echo "Step 5: Restarting application..."
pm2 restart ecosystem.config.js

echo ""
echo "======================================"
echo "  Deployment Complete"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Verify application is running: pm2 status"
echo "2. Check logs: pm2 logs"
echo "3. Test critical features"
```

---

## 🔄 Deployment Workflow

### Local Development:

```bash
# 1. Make changes
# 2. Create migration if schema changed
vim database/migrations/005_my_changes.sql

# 3. Test migration locally
./scripts/migrate.sh

# 4. Test application
npm run dev

# 5. Commit and push
git add .
git commit -m "feat: add new feature with migration"
git push origin main
```

### VPS Deployment:

```bash
# SSH to VPS
ssh user@your-vps

# Navigate to project
cd /path/to/atsoko-backend

# Run deployment script
./scripts/deploy.sh

# Or manual steps:
# 1. Backup
./scripts/backup-db.sh

# 2. Pull code
git pull origin main

# 3. Install deps
npm install

# 4. Run migrations
./scripts/migrate.sh

# 5. Restart
pm2 restart all
```

---

## 🖼️ Image Handling Recommendations

### Short-term (Current Setup):

1. **Accept that images will be different**
   ```javascript
   // Frontend: Handle missing images gracefully
   <img 
     src={imageUrl} 
     onError={(e) => e.target.src = '/placeholder.jpg'}
     alt={property.title}
   />
   ```

2. **Use .gitignore for uploads**
   ```gitignore
   # .gitignore
   uploads/*
   !uploads/.gitkeep
   ```

3. **Document test images**
   ```
   # README.md
   ## Test Images
   - Local: Use dummy images in uploads/
   - VPS: Team can upload real images
   - Images are NOT synced between environments
   ```

### Long-term (Production Ready):

1. **Use Cloud Storage (S3/Cloudflare R2)**
   ```javascript
   // config/upload.js
   const storage = process.env.NODE_ENV === 'production'
     ? s3Storage  // Use S3 in production
     : localStorage;  // Use local in development
   ```

2. **Benefits:**
   - ✅ Same images everywhere
   - ✅ CDN support
   - ✅ Automatic backup
   - ✅ Scalable

---

## 📊 Comparison: Current vs Recommended

| Aspect | Current (Full DB Export) | Recommended (Migrations) |
|--------|-------------------------|--------------------------|
| **Data Loss** | ❌ VPS data lost | ✅ VPS data preserved |
| **Schema Changes** | ✅ Works | ✅ Works better |
| **Rollback** | ❌ Difficult | ✅ Easy |
| **Team Testing** | ❌ Data conflicts | ✅ No conflicts |
| **Version Control** | ❌ No history | ✅ Git history |
| **Images** | ❌ Mismatch | ✅ Handled properly |

---

## 🎯 Action Plan

### Immediate (This Week):

1. **Create migration scripts for existing schema**
   ```bash
   # Export current schema only (no data)
   pg_dump -U postgres -d thaiindustrialproperty_db --schema-only > database/migrations/001_initial_schema.sql
   ```

2. **Create deployment scripts**
   - `scripts/migrate.sh`
   - `scripts/backup-db.sh`
   - `scripts/deploy.sh`

3. **Update .gitignore**
   ```gitignore
   uploads/*
   !uploads/.gitkeep
   backups/
   exports/
   ```

4. **Document workflow**
   - Add deployment guide to README
   - Share with team

### Short-term (Next Sprint):

1. **Test migration workflow**
   - Create test migration
   - Deploy to VPS
   - Verify no data loss

2. **Add image placeholders**
   - Frontend handling for missing images
   - Document image strategy

### Long-term (Future):

1. **Implement cloud storage**
   - Setup S3/Cloudflare R2
   - Migrate existing images
   - Update upload logic

2. **CI/CD Pipeline**
   - Automated testing
   - Automated migrations
   - Automated deployment

---

## 🚨 Important Notes

### DO:
- ✅ Always backup before deployment
- ✅ Test migrations on local first
- ✅ Use migration scripts for schema changes
- ✅ Keep VPS data separate from local
- ✅ Document all changes

### DON'T:
- ❌ Import full DB from local to VPS (data loss!)
- ❌ Commit uploads/ to Git (large repo)
- ❌ Deploy without backup
- ❌ Skip migration testing
- ❌ Assume images will sync automatically

---

## 📝 Summary

**Current Problem:**
- Full DB export/import → data loss
- Image mismatch between environments

**Solution:**
1. **Use migration scripts** instead of full DB export
2. **Keep VPS data separate** from local
3. **Handle images gracefully** with placeholders
4. **Long-term:** Use cloud storage for images

**Benefits:**
- ✅ No data loss
- ✅ Team can test on VPS safely
- ✅ Easy rollback
- ✅ Version controlled schema changes
- ✅ Professional deployment workflow

---

**Next Step:** Create migration scripts and test deployment workflow!
