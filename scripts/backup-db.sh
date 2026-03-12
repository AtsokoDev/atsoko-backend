#!/bin/bash

# =====================================================
# Database Backup Script
# =====================================================
# Creates a backup of the database before deployment
# Keeps last 10 backups automatically
# =====================================================

set -e

# Configuration
DB_NAME="${DB_NAME:-thaiindustrialproperty_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="backups"
MAX_BACKUPS=10

echo "======================================"
echo "  Database Backup"
echo "======================================"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo ""

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.sql"

echo "Creating backup: $BACKUP_FILE"
echo ""

# Create backup
PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME > "$BACKUP_FILE"

# Compress backup
echo "Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

echo "✅ Backup created successfully: $BACKUP_FILE"
echo ""

# Get backup size
backup_size=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup size: $backup_size"
echo ""

# Clean old backups (keep last MAX_BACKUPS)
backup_count=$(ls -1 $BACKUP_DIR/backup-*.sql.gz 2>/dev/null | wc -l)

if [ "$backup_count" -gt "$MAX_BACKUPS" ]; then
    echo "Cleaning old backups (keeping last $MAX_BACKUPS)..."
    ls -1t $BACKUP_DIR/backup-*.sql.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
    echo "✅ Old backups cleaned"
    echo ""
fi

echo "======================================"
echo "  Backup Information"
echo "======================================"
echo "File: $BACKUP_FILE"
echo "Size: $backup_size"
echo ""
echo "To restore this backup:"
echo "gunzip -c $BACKUP_FILE | psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME"
echo ""
echo "Available backups:"
ls -lht $BACKUP_DIR/backup-*.sql.gz | head -n 5
