# VPS Deployment Infrastructure

Complete deployment infrastructure for production VPS deployment.

## 📁 Contents

- **nginx.conf** - Nginx reverse proxy configuration
- **atsoko-backend.service** - Systemd service file
- **ecosystem.config.js** - PM2 cluster configuration
- **.env.production** - Production environment template
- **setup-database.sh** - PostgreSQL setup script
- **deploy.sh** - Automated deployment script
- **DEPLOYMENT.md** - Complete deployment guide
- **BACKUP.md** - Backup and restore procedures

## 🚀 Quick Start

1. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for initial setup
2. Use `setup-database.sh` to configure PostgreSQL
3. Configure `.env` with your database credentials
4. Use `deploy.sh` for future updates

## 📋 Server Requirements

- Ubuntu 20.04+ (or similar Linux distro)
- Node.js 18+
- PostgreSQL 12+
- Nginx
- 4 CPU cores, 8GB RAM, 60GB SSD (as per VPS spec)

## 🔒 Security

- Change default passwords in `.env.production`
- Setup SSL certificate with Let's Encrypt
- Configure firewall (UFW)
- Regular security updates

## 📊 Monitoring

Check service status:
```bash
systemctl status atsoko-backend
journalctl -u atsoko-backend -f
```

## 🆘 Support

See [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section.
