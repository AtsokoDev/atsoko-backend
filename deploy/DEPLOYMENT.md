# VPS Deployment Guide

Complete step-by-step guide to deploy Atsoko Backend to your VPS.

## Server Specifications

- CPU: Intel Xeon 4 Core
- RAM: 8 GB
- SSD: 60 GB
- OS: Linux (Ubuntu 20.04+ recommended)
- Control Panel: Vesta/DirectAdmin

---

## Prerequisites

### 1. Initial Server Access

SSH into your VPS:
```bash
ssh root@your-vps-ip
```

### 2. Update System

```bash
apt update && apt upgrade -y
```

---

## Step 1: Install Required Software

### Install Node.js (v18 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
node --version  # Should show v18.x.x
npm --version
```

### Install PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

### Install Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### Install Git

```bash
apt install -y git
```

### Install PM2 (Optional - Process Manager)

```bash
npm install -g pm2
```

---

## Step 2: Setup Application Directory

### Create Application User (Optional but recommended)

```bash
# If not using www-data
useradd -m -s /bin/bash atsoko
usermod -aG sudo atsoko
```

### Create Application Directory

```bash
mkdir -p /var/www/atsoko-backend
cd /var/www/atsoko-backend
```

### Clone Repository

```bash
# If using Git
git clone https://github.com/your-username/atsoko-backend.git .

# OR upload files via SCP/FTP to /var/www/atsoko-backend
```

### Install Dependencies

```bash
npm install --production
```

---

## Step 3: Setup Database

### Run Database Setup Script

```bash
cd /var/www/atsoko-backend/deploy
chmod +x setup-database.sh
./setup-database.sh
```

This will:
- Create database `thaiindustrialproperty_db`
- Create user `atsoko_user` with secure password
- Run schema migration
- Display credentials to add to `.env`

### Import Data

```bash
# Copy your CSV and image-mapping.json files to the app directory
cd /var/www/atsoko-backend

# Copy .env.production to .env and update with database credentials
cp deploy/.env.production .env
nano .env  # Edit with the credentials from setup-database.sh

# Run import script
node scripts/import-data.js
```

---

## Step 4: Configure Nginx

### Copy Nginx Configuration

```bash
cp /var/www/atsoko-backend/deploy/nginx.conf /etc/nginx/sites-available/atsoko-backend
```

### Edit Configuration

```bash
nano /etc/nginx/sites-available/atsoko-backend
```

Update:
- `server_name` → your domain (e.g., `api.yourdomain.com`)
- `root` → `/var/www/atsoko-backend` (already correct)

### Enable Site

```bash
ln -s /etc/nginx/sites-available/atsoko-backend /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl reload nginx
```

---

## Step 5: Setup Application Service

### Method A: Using Systemd (Recommended)

```bash
# Copy service file
cp /var/www/atsoko-backend/deploy/atsoko-backend.service /etc/systemd/system/

# Set correct permissions
chown -R www-data:www-data /var/www/atsoko-backend

# Reload systemd and start service
systemctl daemon-reload
systemctl start atsoko-backend
systemctl enable atsoko-backend

# Check status
systemctl status atsoko-backend
```

### Method B: Using PM2

```bash
cd /var/www/atsoko-backend
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

---

## Step 6: Setup SSL Certificate (Optional but Recommended)

### Install Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically:
- Obtain SSL certificate
- Update Nginx configuration
- Setup auto-renewal

---

## Step 7: Verify Deployment

### Test API

```bash
# Local test
curl http://localhost:3000/

# Domain test
curl http://yourdomain.com/
```

### Check Service Status

```bash
# Systemd
systemctl status atsoko-backend

# PM2
pm2 status

# Nginx
systemctl status nginx
```

### View Logs

```bash
# Systemd logs
journalctl -u atsoko-backend -f

# PM2 logs
pm2 logs atsoko-backend

# Nginx logs
tail -f /var/log/nginx/atsoko-backend.access.log
tail -f /var/log/nginx/atsoko-backend.error.log
```

---

## Step 8: Setup Firewall

### Configure UFW (if not using DirectAdmin firewall)

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
ufw status
```

---

## Deployment Workflow

### For Future Updates

Use the deployment script:

```bash
cd /var/www/atsoko-backend/deploy
./deploy.sh
```

This will:
1. Pull latest code from git
2. Install new dependencies
3. Restart the service
4. Run health check

---

## Monitoring & Maintenance

### Check Resource Usage

```bash
# CPU and Memory
htop

# Disk usage
df -h

# Database size
du -sh /var/lib/postgresql
```

### Database Monitoring

```bash
# Connect to database
sudo -u postgres psql -d thaiindustrialproperty_db

# Check table sizes
SELECT pg_size_pretty(pg_total_relation_size('properties')) as size;

# Check row count
SELECT COUNT(*) FROM properties;
```

### Log Rotation

Logs are automatically rotated by systemd/PM2, but you can configure:

```bash
# For systemd
journalctl --vacuum-time=7d  # Keep 7 days of logs

# For PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
journalctl -u atsoko-backend -n 50

# Check if port 3000 is available
lsof -i :3000

# Check Node.js path
which node  # Update ExecStart in service file if different
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
systemctl status postgresql

# Test connection
psql -U atsoko_user -d thaiindustrialproperty_db

# Check .env file
cat /var/www/atsoko-backend/.env
```

### Nginx 502 Bad Gateway

```bash
# Check if app is running
systemctl status atsoko-backend
curl http://localhost:3000/

# Check Nginx error log
tail -f /var/log/nginx/atsoko-backend.error.log
```

---

## Security Checklist

- [ ] PostgreSQL password is strong and unique
- [ ] `.env` file has secure permissions (chmod 600)
- [ ] Firewall is enabled and configured
- [ ] SSL certificate is installed
- [ ] Regular backups are configured (see BACKUP.md)
- [ ] Server is regularly updated (`apt update && apt upgrade`)
- [ ] Non-root user is used for deployment
- [ ] SSH key authentication is enabled (disable password login)

---

## Performance Tuning

### PostgreSQL Optimization

Edit `/etc/postgresql/*/main/postgresql.conf`:

```ini
# For 8GB RAM server
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1  # For SSD
work_mem = 32MB
min_wal_size = 1GB
max_wal_size = 4GB
```

Restart PostgreSQL:
```bash
systemctl restart postgresql
```

### Node.js Cluster Mode

Using PM2 cluster mode with 2 instances (already configured in ecosystem.config.js):
```bash
pm2 start deploy/ecosystem.config.js
```

---

## Support

For issues or questions:
1. Check logs first
2. Review this documentation
3. Check GitHub issues
4. Contact support

---

**🎉 Congratulations! Your Atsoko Backend is now deployed and running on VPS!**
