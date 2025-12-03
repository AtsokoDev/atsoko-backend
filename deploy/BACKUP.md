# Backup & Restore Guide

Essential backup procedures for Atsoko Backend.

---

## Database Backup

### Manual Backup

```bash
# Full database backup
sudo -u postgres pg_dump thaiindustrialproperty_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
sudo -u postgres pg_dump thaiindustrialproperty_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Automated Daily Backups

Create backup script at `/var/www/atsoko-backend/deploy/backup-db.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/atsoko-backend"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="thaiindustrialproperty_db"
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Delete old backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
```

Make it executable:
```bash
chmod +x /var/www/atsoko-backend/deploy/backup-db.sh
```

### Setup Cron Job

```bash
crontab -e
```

Add this line for daily backup at 2 AM:
```cron
0 2 * * * /var/www/atsoko-backend/deploy/backup-db.sh >> /var/log/atsoko-backup.log 2>&1
```

---

## Database Restore

### From Uncompressed Backup

```bash
sudo -u postgres psql thaiindustrialproperty_db < backup_20240101_020000.sql
```

### From Compressed Backup

```bash
gunzip -c backup_20240101_020000.sql.gz | sudo -u postgres psql thaiindustrialproperty_db
```

### Full Database Restore (Drop & Recreate)

```bash
# Drop existing database
sudo -u postgres psql -c "DROP DATABASE thaiindustrialproperty_db;"

# Recreate database
sudo -u postgres psql -c "CREATE DATABASE thaiindustrialproperty_db;"

# Restore from backup
gunzip -c backup_20240101_020000.sql.gz | sudo -u postgres psql thaiindustrialproperty_db
```

---

## Application Files Backup

### Backup Images Directory

```bash
tar -czf /var/backups/atsoko-backend/images_$(date +%Y%m%d).tar.gz \
  /var/www/atsoko-backend/public/images/
```

### Backup Configuration

```bash
cp /var/www/atsoko-backend/.env /var/backups/atsoko-backend/.env.backup
```

---

## Remote Backup (Recommended)

### Using rsync to Remote Server

```bash
# Backup to remote server
rsync -avz /var/backups/atsoko-backend/ user@backup-server:/backups/atsoko/

# With SSH key
rsync -avz -e "ssh -i /path/to/key.pem" \
  /var/backups/atsoko-backend/ \
  user@backup-server:/backups/atsoko/
```

### Automate Remote Backup

Add to cron after local backup:
```cron
30 2 * * * rsync -avz /var/backups/atsoko-backend/ user@backup-server:/backups/atsoko/ >> /var/log/atsoko-remote-backup.log 2>&1
```

---

## Backup Strategy Recommendations

### For Production

1. **Daily Automated Backups**: Database + Critical Files
2. **Retention**: Keep 7 daily, 4 weekly, 3 monthly backups
3. **Remote Storage**: Copy to external server or cloud storage
4. **Test Restores**: Monthly test restore to verify backups work
5. **Monitor**: Check backup logs regularly

### Backup Locations

- **Local**: `/var/backups/atsoko-backend/`
- **Remote**: Cloud storage or separate server
- **Offsite**: Download critical backups weekly

---

## Disaster Recovery Plan

### Priority 1: Database
1. Restore from latest database backup
2. Verify data integrity
3. Test application connectivity

### Priority 2: Application
1. Pull latest code from Git
2. Install dependencies
3. Restore `.env` configuration
4. Restart services

### Priority 3: Images
1. Restore from image backup
2. Verify image serving

### Recovery Time Objective (RTO)
- Target: < 2 hours for full recovery
- Database only: < 30 minutes

---

## Backup Monitoring

### Check Backup Status

```bash
# List recent backups
ls -lh /var/backups/atsoko-backend/

# Check last backup age
find /var/backups/atsoko-backend/ -name "db_*.sql.gz" -mtime -1 -ls
```

### Alert if Backup Fails

Add to backup script:
```bash
if [ $? -eq 0 ]; then
    echo "Backup successful"
else
    echo "Backup FAILED!" | mail -s "Atsoko Backup Failed" your-email@example.com
fi
```

---

## Quick Reference

```bash
# Backup database
sudo -u postgres pg_dump thaiindustrialproperty_db | gzip > backup.sql.gz

# Restore database
gunzip -c backup.sql.gz | sudo -u postgres psql thaiindustrialproperty_db

# Backup images
tar -czf images.tar.gz /var/www/atsoko-backend/public/images/

# Restore images
tar -xzf images.tar.gz -C /

# List backups
ls -lh /var/backups/atsoko-backend/
```

---

**Remember: Backups are only useful if they can be restored successfully. Test your restore process regularly!**
