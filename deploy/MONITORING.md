# Monitoring & Maintenance Guide

Comprehensive guide for monitoring and maintaining your Atsoko Backend deployment.

---

## Daily Monitoring

### Health Check Script

Run the health check script:
```bash
cd /var/www/atsoko-backend/deploy
./health-check.sh
```

This checks:
- ✅ Service status (Nginx, PostgreSQL, Node.js)
- ✅ API endpoint response
- ✅ Database connectivity
- ✅ Disk usage
- ✅ Memory usage

### Automated Health Checks

Add to crontab for hourly checks:
```bash
crontab -e
```

Add:
```cron
0 * * * * /var/www/atsoko-backend/deploy/health-check.sh
```

---

## Service Monitoring

### Check Service Status

```bash
# Systemd
systemctl status atsoko-backend
systemctl status nginx
systemctl status postgresql

# PM2
pm2 status
pm2 monit  # Real-time monitoring
```

### View Logs

```bash
# Application logs (systemd)
journalctl -u atsoko-backend -f

# Application logs (PM2)
pm2 logs atsoko-backend

# Nginx access logs
tail -f /var/log/nginx/atsoko-backend.access.log

# Nginx error logs
tail -f /var/log/nginx/atsoko-backend.error.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log
```

---

## Resource Monitoring

### CPU & Memory

```bash
# Real-time monitoring
htop

# Check top processes
top

# Memory usage
free -h

# Check specific process
ps aux | grep node
```

### Disk Usage

```bash
# Overall disk usage
df -h

# Directory sizes
du -sh /var/www/atsoko-backend/*
du -sh /var/lib/postgresql/*

# Find large files
find / -type f -size +100M 2>/dev/null
```

### Database Size

```bash
# Connect to database
sudo -u postgres psql -d thaiindustrialproperty_db

# Check size
SELECT pg_size_pretty(pg_database_size('thaiindustrialproperty_db'));

# Check table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Performance Monitoring

### API Response Times

```bash
# Test API endpoint response time
time curl http://localhost:3000/

# Detailed timing
curl -w "@-" -o /dev/null -s http://localhost:3000/ << 'EOF'
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_redirect:  %{time_redirect}\n
time_starttransfer:  %{time_starttransfer}\n
time_total:  %{time_total}\n
EOF
```

### Database Query Performance

```bash
# Enable query logging (in postgresql.conf)
log_min_duration_statement = 100  # Log queries > 100ms

# View slow queries
sudo tail -f /var/log/postgresql/postgresql-*.log | grep "duration:"
```

### Nginx Stats

```bash
# Active connections
curl http://localhost/nginx_status  # If stub_status is enabled

# Parse access log for stats
awk '{print $9}' /var/log/nginx/atsoko-backend.access.log | sort | uniq -c | sort -rn
```

---

## Alerts & Notifications

### Setup Email Alerts

Install mailutils:
```bash
apt install -y mailutils
```

Test email:
```bash
echo "Test alert" | mail -s "Test from Atsoko Backend" your-email@example.com
```

### Alert on Service Failure

Edit systemd service:
```bash
nano /etc/systemd/system/atsoko-backend.service
```

Add:
```ini
[Service]
OnFailure=service-failed@%n.service
```

Create alert service:
```bash
nano /etc/systemd/system/service-failed@.service
```

```ini
[Unit]
Description=Send alert on service failure

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'echo "Service %i failed!" | mail -s "Alert: Service Failure" your-email@example.com'
```

---

## Automated Monitoring Setup

### Monitoring Script

Create `/var/www/atsoko-backend/deploy/monitor.sh`:

```bash
#!/bin/bash

# Run health check and alert on failure
/var/www/atsoko-backend/deploy/health-check.sh

if [ $? -ne 0 ]; then
    echo "Health check failed on $(hostname) at $(date)" | \
        mail -s "ALERT: Atsoko Backend Health Check Failed" your-email@example.com
fi
```

Add to crontab:
```cron
*/15 * * * * /var/www/atsoko-backend/deploy/monitor.sh
```

---

## Maintenance Tasks

### Weekly Maintenance

```bash
# Update packages
apt update && apt upgrade -y

# Clean old logs
journalctl --vacuum-time=7d
find /var/log -name "*.log.*" -mtime +30 -delete

# Vacuum database
sudo -u postgres vacuumdb -d thaiindustrialproperty_db -v

# Check for security updates
apt list --upgradable
```

### Monthly Maintenance

```bash
# Analyze database
sudo -u postgres psql -d thaiindustrialproperty_db -c "ANALYZE VERBOSE;"

# Check for broken packages
dpkg --configure -a
apt-get check

# Review backup status
ls -lh /var/backups/atsoko-backend/
```

---

## Security Monitoring

### Check Failed Login Attempts

```bash
# SSH login attempts
grep "Failed password" /var/log/auth.log | tail -20

# Count by IP
grep "Failed password" /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn
```

### Monitor Running Processes

```bash
# Check for suspicious processes
ps aux | grep -E "crypto|miner"

# Check network connections
netstat -tuln | grep ESTABLISHED
ss -tuln
```

### Check Firewall Status

```bash
ufw status verbose
iptables -L -n
```

---

## Troubleshooting Commands

```bash
# Check port usage
lsof -i :3000
lsof -i :80
lsof -i :443

# Check DNS resolution
dig yourdomain.com
nslookup yourdomain.com

# Test database connection
PGPASSWORD=your_password psql -U atsoko_user -h localhost -d thaiindustrialproperty_db -c "SELECT 1;"

# Check service dependencies
systemctl list-dependencies atsoko-backend

# Check system errors
dmesg | tail -50
journalctl -p err -b
```

---

## Monitoring Tools (Optional)

### Install htop
```bash
apt install htop
```

### Install iotop (disk I/O)
```bash
apt install iotop
iotop
```

### Install nethogs (network usage)
```bash
apt install nethogs
nethogs
```

### Simple Uptime Monitoring

Use external services:
- UptimeRobot (free tier)
- Pingdom
- StatusCake

Configure to ping: `https://yourdomain.com/`

---

## Dashboard Recommendations

For more advanced monitoring, consider:
- **Grafana + Prometheus** - Full monitoring stack
- **Netdata** - Simple real-time monitoring
- **PM2 Plus** - If using PM2 (paid)
- **New Relic** - APM monitoring (free tier available)

---

**Regular monitoring ensures your application stays healthy and performant!**
