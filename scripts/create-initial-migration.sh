#!/bin/bash

# =====================================================
# Create Initial Migration from Current Schema
# =====================================================
# This script exports the current database schema
# and creates the first migration file
# =====================================================

set -e

DB_NAME="${DB_NAME:-thaiindustrialproperty_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
MIGRATION_DIR="database/migrations"

echo "======================================"
echo "  Create Initial Migration"
echo "======================================"
echo ""

# Create migration directory if not exists
mkdir -p "$MIGRATION_DIR"

# Generate migration filename
MIGRATION_FILE="$MIGRATION_DIR/001_initial_schema.sql"

if [ -f "$MIGRATION_FILE" ]; then
    echo "⚠️  Warning: $MIGRATION_FILE already exists"
    read -p "Overwrite? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 0
    fi
fi

echo "Exporting schema from database: $DB_NAME"
echo ""

# Export schema only (no data)
PGPASSWORD=$DB_PASSWORD pg_dump \
    -U $DB_USER \
    -h $DB_HOST \
    -p $DB_PORT \
    -d $DB_NAME \
    --schema-only \
    --no-owner \
    --no-privileges \
    > "$MIGRATION_FILE"

echo "✅ Schema exported to: $MIGRATION_FILE"
echo ""

# Add header to migration file
temp_file=$(mktemp)
cat > "$temp_file" <<EOF
-- =====================================================
-- Migration: Initial Schema
-- =====================================================
-- Created: $(date +"%Y-%m-%d %H:%M:%S")
-- Description: Initial database schema
-- =====================================================

EOF

cat "$MIGRATION_FILE" >> "$temp_file"
mv "$temp_file" "$MIGRATION_FILE"

echo "✅ Migration file created successfully"
echo ""
echo "Next steps:"
echo "1. Review the migration file: $MIGRATION_FILE"
echo "2. Test the migration: ./scripts/migrate.sh"
echo "3. Commit to Git: git add $MIGRATION_FILE"
