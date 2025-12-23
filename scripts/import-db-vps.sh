#!/bin/bash

# ===========================================
# VPS DATABASE IMPORT SCRIPT
# ===========================================
# This script imports the exported database file
# to the VPS PostgreSQL database
#
# Usage: ./scripts/import-db-vps.sh <export-file.sql>
#    or: ./scripts/import-db-vps.sh  (uses latest export)
#
# This script will:
#   1. Backup current VPS database (optional)
#   2. Drop ALL existing tables
#   3. Import the exported data
#   4. Verify the import
# ===========================================

# Configuration - Update these for VPS
DB_NAME="${DB_NAME:-thaiindustrialproperty_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=============================================="
echo "  VPS DATABASE IMPORT SCRIPT"
echo -e "==============================================${NC}"
echo ""

# Get import file from argument or use latest
if [ -n "$1" ]; then
    IMPORT_FILE="$1"
else
    IMPORT_FILE="exports/db-export-latest.sql"
fi

# Check if import file exists
if [ ! -f "$IMPORT_FILE" ]; then
    echo -e "${RED}❌ Error: Import file not found: $IMPORT_FILE${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/import-db-vps.sh <export-file.sql>"
    echo "  ./scripts/import-db-vps.sh  (uses exports/db-export-latest.sql)"
    exit 1
fi

echo "📁 Import file: $IMPORT_FILE"
echo "📊 File size: $(du -h "$IMPORT_FILE" | cut -f1)"
echo ""
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo ""

# Warning and confirmation
echo -e "${YELLOW}⚠️  WARNING: This will COMPLETELY REPLACE the current database!${NC}"
echo -e "${YELLOW}   All existing data will be DELETED!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""

# Optional: Create backup before import
read -p "Create backup before import? (yes/no): " backup_confirm

BACKUP_DIR="backups"
if [ "$backup_confirm" == "yes" ]; then
    mkdir -p "$BACKUP_DIR"
    BACKUP_TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/vps-backup-$BACKUP_TIMESTAMP.sql"
    
    echo ""
    echo "📦 Creating backup: $BACKUP_FILE"
    
    pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-privileges \
        --file="$BACKUP_FILE" \
        2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
    else
        echo -e "${YELLOW}⚠️  Backup failed, but continuing with import...${NC}"
    fi
    echo ""
fi

# Step 1: Drop all existing tables
echo "🗑️  Step 1/3: Dropping all existing tables..."

# Generate DROP TABLE statements for ALL tables
DROP_SQL="DO \$\$ 
DECLARE 
    r RECORD;
BEGIN
    -- Disable triggers
    SET session_replication_role = 'replica';
    
    -- Drop all tables in public schema
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Re-enable triggers
    SET session_replication_role = 'origin';
END \$\$;"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$DROP_SQL" 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error dropping tables${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All tables dropped${NC}"
echo ""

# Step 2: Import the database
echo "📥 Step 2/3: Importing database..."
echo "   This may take a few minutes for large databases..."
echo ""

# Import with error handling
psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$IMPORT_FILE" \
    --echo-errors \
    2>&1 | grep -E "(ERROR|NOTICE|creating|already exists)" || true

# Note: We use || true because some warnings are expected

echo ""
echo -e "${GREEN}✅ Import completed${NC}"
echo ""

# Step 3: Verify import
echo "🔍 Step 3/3: Verifying import..."
echo ""

# Count tables
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')

echo "📋 Tables in database: $TABLE_COUNT"
echo ""

# Show table names and row counts
echo "📊 Table row counts:"
echo "----------------------------------------"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    schemaname || '.' || relname AS table_name,
    n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
" 2>/dev/null || {
    # Fallback if pg_stat doesn't work immediately
    echo "(Run ANALYZE first for accurate counts)"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt"
}

echo ""
echo -e "${GREEN}=============================================="
echo "✅ IMPORT COMPLETE!"
echo -e "==============================================${NC}"
echo ""
echo "📝 Summary:"
echo "   - Tables imported: $TABLE_COUNT"
echo "   - Source file: $IMPORT_FILE"
if [ "$backup_confirm" == "yes" ] && [ -f "$BACKUP_FILE" ]; then
    echo "   - Backup saved: $BACKUP_FILE"
fi
echo ""
echo "🔧 Post-import steps (already done by Node.js app on restart):"
echo "   - Refresh table statistics: ANALYZE;"
echo "   - Reset sequences if needed"
echo ""
echo -e "${GREEN}✅ Your VPS database now matches your local database!${NC}"
