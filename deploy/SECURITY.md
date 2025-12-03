# Security Hardening Guide

Essential security measures for production deployment.

---

## SSL/TLS Certificate (HTTPS)

### Install Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
# For single domain
certbot --nginx -d yourdomain.com

# For multiple domains
certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

### Auto-Renewal

Certbot automatically sets up renewal. Test it:
```bash
certbot renew --dry-run
```

Check renewal timer:
```bash
systemctl status certbot.timer
```

---

## Firewall Configuration

### Setup UFW

```bash
# Install
apt install ufw

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow essential services
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# Enable firewall
ufw enable

# Check status
ufw status verbose
```

### Rate Limiting SSH

Prevent brute force attacks:
```bash
ufw limit 22/tcp
```

---

## SSH Hardening

### Disable Password Authentication

Edit `/etc/ssh/sshd_config`:
```bash
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

Restart SSH:
```bash
systemctl restart ssh
```

### Setup SSH Keys

On your local machine:
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
ssh-copy-id user@your-vps-ip
```

### Change SSH Port (Optional)

Edit `/etc/ssh/sshd_config`:
```
Port 2222  # Use non-standard port
```

Update firewall:
```bash
ufw allow 2222/tcp
ufw delete allow 22/tcp
```

---

## PostgreSQL Security

### Create Strong Password

```bash
# Generate secure password
openssl rand -base64 32
```

### Restrict PostgreSQL Access

Edit `/etc/postgresql/*/main/pg_hba.conf`:
```
# Local connections only
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
```

Restart PostgreSQL:
```bash
systemctl restart postgresql
```

### Regular Updates

```bash
# Backup first!
sudo -u postgres pg_dump thaiindustrialproperty_db > backup.sql

# Update PostgreSQL
apt update && apt upgrade postgresql
```

---

## Application Security

### Environment Variables

Secure `.env` file:
```bash
chmod 600 /var/www/atsoko-backend/.env
chown www-data:www-data /var/www/atsoko-backend/.env
```

### CORS Configuration

Edit `server.js` to restrict CORS:
```javascript
const cors = require('cors');

const corsOptions = {
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### Rate Limiting in Application

Install express-rate-limit:
```bash
npm install express-rate-limit
```

Add to `server.js`:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Nginx Security Headers

Already included in nginx.conf:
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

Add more headers:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

---

## Automated Security Updates

### Enable Unattended Upgrades

```bash
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

Configure `/etc/apt/apt.conf.d/50unattended-upgrades`:
```
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
```

---

## Fail2Ban (Intrusion Prevention)

### Install Fail2Ban

```bash
apt install fail2ban
```

### Configure Jail

Create `/etc/fail2ban/jail.local`:
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/atsoko-backend.error.log
```

Start Fail2Ban:
```bash
systemctl enable fail2ban
systemctl start fail2ban
```

Check status:
```bash
fail2ban-client status
fail2ban-client status sshd
```

---

## File Permissions

### Set Correct Ownership

```bash
chown -R www-data:www-data /var/www/atsoko-backend
chmod -R 755 /var/www/atsoko-backend
chmod 600 /var/www/atsoko-backend/.env
```

### Protect Config Files

```bash
chmod 600 /etc/nginx/sites-available/atsoko-backend
chmod 600 /etc/systemd/system/atsoko-backend.service
```

---

## Regular Security Audits

### Check Open Ports

```bash
netstat -tuln
ss -tuln
nmap localhost
```

### Check Running Services

```bash
systemctl list-units --type=service --state=running
```

### Check for Rootkits

```bash
apt install rkhunter
rkhunter --update
rkhunter --check
```

### Security Scanning

```bash
# Install Lynis
apt install lynis

# Run security audit
lynis audit system
```

---

## Backup Encryption

### Encrypt Backups

```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 backup.sql.gz

# Decrypt backup
gpg --decrypt backup.sql.gz.gpg > backup.sql.gz
```

### Store Encryption Key Securely

Never store GPG passphrase in scripts. Use environment variables:
```bash
export GPG_PASSPHRASE="your-secure-passphrase"
```

---

## Monitoring for Security

### Check Auth Logs

```bash
# Failed SSH attempts
grep "Failed password" /var/log/auth.log | tail -20

# Successful SSH logins
grep "Accepted" /var/log/auth.log | tail -20
```

### Database Access Logs

Enable logging in PostgreSQL:
```
log_connections = on
log_disconnections = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

---

## Security Checklist

- [ ] SSL/TLS certificate installed and auto-renewal configured
- [ ] Firewall (UFW) enabled and configured
- [ ] SSH key authentication enabled, password auth disabled
- [ ] PostgreSQL restricted to localhost only
- [ ] Strong database passwords (32+ characters)
- [ ] `.env` file has secure permissions (chmod 600)
- [ ] CORS properly configured for your frontend domain
- [ ] Rate limiting enabled (Nginx and/or application)
- [ ] Security headers configured in Nginx
- [ ] Fail2Ban installed and configured
- [ ] Automated security updates enabled
- [ ] Regular backups encrypted and stored offsite
- [ ] File permissions properly set
- [ ] Regular security audits scheduled
- [ ] Monitoring and alerting configured

---

## Incident Response Plan

### If Compromised

1. **Isolate**: Disconnect from network
2. **Assess**: Check logs for intrusion
3. **Backup**: Save current state for forensics
4. **Restore**: From clean backup
5. **Update**: All passwords and keys
6. **Patch**: Any vulnerabilities
7. **Monitor**: Increased monitoring

### Important Logs

- `/var/log/auth.log` - Authentication attempts
- `/var/log/nginx/*.log` - Web access logs
- `/var/log/postgresql/*.log` - Database logs
- `journalctl -u atsoko-backend` - Application logs

---

**Security is an ongoing process, not a one-time setup. Review and update regularly!**
