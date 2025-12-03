#!/bin/bash

# Automated Database Backup Script
# Run daily via cron: 0 2 * * * /var/www/atsoko-backend/deploy/backup-db.sh

set -e

# Configuration
BACKUP_DIR="/var/backups/atsoko-backend"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="thaiindustrialproperty_db"
DB_USER="atsoko_user"
RETENTION_DAYS=7
LOG_FILE="/var/log/atsoko-backup.log"

# Load environment variables if .env exists
if [ -f "/var/www/atsoko-backend/.env" ]; then
    source /var/www/atsoko-backend/.env
    DB_PASSWORD=$DB_PASSWORD
fi

# Create backup directory
mkdir -p $BACKUP_DIR

# Log start
echo "[$(date)] Starting backup..." >> $LOG_FILE

# Backup database
BACKUP_FILE="$BACKUP_DIR/db_$DATE.sql.gz"
PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_FILE

# Check if backup was successful
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
    echo "[$(date)] ✅ Backup completed: $BACKUP_FILE ($BACKUP_SIZE)" >> $LOG_FILE
    
    # Delete old backups
    DELETED=$(find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    if [ $DELETED -gt 0 ]; then
        echo "[$(date)] 🗑️  Deleted $DELETED old backup(s)" >> $LOG_FILE
    fi
    
    # Show current backups
    BACKUP_COUNT=$(ls -1 $BACKUP_DIR/db_*.sql.gz 2>/dev/null | wc -l)
    echo "[$(date)] 📊 Total backups: $BACKUP_COUNT" >> $LOG_FILE
    
    exit 0
else
    echo "[$(date)] ❌ Backup FAILED!" >> $LOG_FILE
    
    # Send alert (uncomment and configure)
    # echo "Database backup failed on $(hostname)" | mail -s "ALERT: Backup Failed" your-email@example.com
    
    exit 1
fi
