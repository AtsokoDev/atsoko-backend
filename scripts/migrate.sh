#!/bin/bash

# =====================================================
# Database Migration Script
# =====================================================
# Applies all pending migrations in order
# Creates schema_migrations table to track applied migrations
# =====================================================

set -e  # Exit on error

# Configuration
DB_NAME="${DB_NAME:-thaiindustrialproperty_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
MIGRATION_DIR="database/migrations"

echo "======================================"
echo "  Database Migration"
echo "======================================"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Migration Dir: $MIGRATION_DIR"
echo ""

# Check if migration directory exists
if [ ! -d "$MIGRATION_DIR" ]; then
    echo "❌ Migration directory not found: $MIGRATION_DIR"
    echo "Creating directory..."
    mkdir -p "$MIGRATION_DIR"
    echo "✅ Directory created. Add migration files to $MIGRATION_DIR"
    exit 0
fi

# Create migrations tracking table if not exists
echo "Checking migrations table..."
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
EOF

echo "✅ Migrations table ready"
echo ""

# Count migration files
migration_count=$(ls -1 $MIGRATION_DIR/*.sql 2>/dev/null | wc -l)

if [ "$migration_count" -eq 0 ]; then
    echo "ℹ️  No migration files found in $MIGRATION_DIR"
    echo "Migration complete (nothing to do)"
    exit 0
fi

echo "Found $migration_count migration file(s)"
echo ""

# Run each migration file in order
applied_count=0
skipped_count=0

for migration_file in $MIGRATION_DIR/*.sql; do
    if [ -f "$migration_file" ]; then
        migration_name=$(basename "$migration_file")
        
        # Check if already applied
        already_applied=$(PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -t -c \
            "SELECT COUNT(*) FROM schema_migrations WHERE migration_name = '$migration_name'" | tr -d ' ')
        
        if [ "$already_applied" -eq 0 ]; then
            echo "📝 Applying migration: $migration_name"
            
            # Run migration
            PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f "$migration_file"
            
            # Record migration
            PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c \
                "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name')"
            
            echo "✅ $migration_name applied successfully"
            applied_count=$((applied_count + 1))
        else
            echo "⏭️  $migration_name already applied, skipping"
            skipped_count=$((skipped_count + 1))
        fi
        echo ""
    fi
done

echo "======================================"
echo "  Migration Complete"
echo "======================================"
echo "Applied: $applied_count"
echo "Skipped: $skipped_count"
echo "Total: $migration_count"
echo ""

if [ "$applied_count" -gt 0 ]; then
    echo "✅ Database schema updated successfully"
else
    echo "ℹ️  Database schema already up to date"
fi
