#!/bin/bash

# ===========================================
# LOCAL DATABASE EXPORT SCRIPT
# ===========================================
# This script exports the complete local database
# into a single SQL file for transfer to VPS
#
# Usage: ./scripts/export-db-local.sh
# Output: exports/db-export-YYYY-MM-DD-HHMMSS.sql
# ===========================================

# Configuration - Update these if different
DB_NAME="${DB_NAME:-thaiindustrialproperty_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Create exports directory if it doesn't exist
EXPORT_DIR="exports"
mkdir -p "$EXPORT_DIR"

# Generate filename with timestamp
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
EXPORT_FILE="$EXPORT_DIR/db-export-$TIMESTAMP.sql"

echo "=============================================="
echo "  LOCAL DATABASE EXPORT SCRIPT"
echo "=============================================="
echo ""
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Output: $EXPORT_FILE"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "❌ Error: pg_dump is not installed or not in PATH"
    exit 1
fi

# Check database connection
echo "🔍 Checking database connection..."
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    echo "❌ Error: Cannot connect to database. Please check:"
    echo "   - PostgreSQL is running"
    echo "   - Database '$DB_NAME' exists"
    echo "   - Credentials are correct"
    exit 1
fi
echo "✅ Database connection OK"
echo ""

# Start export
echo "📦 Starting export..."
echo ""

# Export with custom format options for clean import
# --clean: adds DROP statements before CREATE
# --if-exists: prevents errors if objects don't exist
# --no-owner: skip ownership commands (VPS might have different user)
# --no-privileges: skip GRANT/REVOKE (VPS might have different permissions)
# --inserts: use INSERT instead of COPY (more compatible)

pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --format=plain \
    --encoding=UTF8 \
    --file="$EXPORT_FILE" \
    2>&1

if [ $? -eq 0 ]; then
    # Get file size
    FILE_SIZE=$(du -h "$EXPORT_FILE" | cut -f1)
    
    # Count tables exported
    TABLE_COUNT=$(grep -c "CREATE TABLE" "$EXPORT_FILE" || echo "0")
    
    echo ""
    echo "=============================================="
    echo "✅ EXPORT SUCCESSFUL!"
    echo "=============================================="
    echo ""
    echo "📁 File: $EXPORT_FILE"
    echo "📊 Size: $FILE_SIZE"
    echo "📋 Tables: $TABLE_COUNT"
    echo ""
    echo "📝 Tables exported:"
    grep "CREATE TABLE" "$EXPORT_FILE" | sed 's/CREATE TABLE /  - /' | sed 's/ ($//'
    echo ""
    echo "=============================================="
    echo "📤 NEXT STEPS:"
    echo "=============================================="
    echo ""
    echo "⚠️  อย่าลืมรัน command นี้เพื่อส่งไฟล์ไป VPS:"
    echo ""
    echo "   scp exports/db-export-latest.sql root@117.18.127.181:/var/www/atsoko-backend/exports/"
    echo ""
    echo "=============================================="
    echo "📥 จากนั้นบน VPS ให้รัน:"
    echo "   ./scripts/import-db-vps.sh exports/db-export-latest.sql"
    echo "=============================================="
    echo "⚠️  อย่าลืมรัน "pm2 status" เพื่อดู status Web"
    echo "⚠️  อย่าลืมรัน "pm2 restart atsoko-backend" เพื่อ Restart Web"
    echo "=============================================="
    # Also create a latest link for convenience
    LATEST_LINK="$EXPORT_DIR/db-export-latest.sql"
    rm -f "$LATEST_LINK"
    cp "$EXPORT_FILE" "$LATEST_LINK"
    echo ""
    echo "💡 TIP: Also saved as $LATEST_LINK for convenience"
    
else
    echo ""
    echo "❌ Export failed! Please check the error messages above."
    exit 1
fi
