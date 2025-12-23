# 🚀 คู่มือ Deploy บน VPS (ฉบับภาษาไทย)

## ขั้นตอนที่ 1: ลบโปรเจคเดิมและ Clone ใหม่

```bash
# ย้อนกลับไปที่ parent directory
cd /var/www  # หรือ cd .. ถ้าอยู่ใน atsoko-backend

# ลบโฟลเดอร์เดิม (ระวัง! จะลบทั้งหมด)
rm -rf atsoko-backend

# Clone โปรเจคใหม่
git clone https://github.com/AtsokoDev/atsoko-backend.git

# เข้าไปในโฟลเดอร์
cd atsoko-backend
```

## ขั้นตอนที่ 2: ติดตั้ง Dependencies

```bash
npm install
```

## ขั้นตอนที่ 3: Setup Environment Variables

```bash
# คัดลอกไฟล์ .env ตัวอย่าง
cp deploy/.env.production .env

# แก้ไขไฟล์ .env ให้ตรงกับ VPS ของคุณ
nano .env
```

**ตัวอย่าง .env:**
```env
# Server
PORT=3000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=thaiindustrialproperty_db
DB_USER=atsoko_user
DB_PASSWORD=your_secure_password_here

# JWT
JWT_SECRET=your_jwt_secret_here

# CORS
FRONTEND_URL=https://yourdomain.com
```

## ขั้นตอนที่ 4: Setup Database

### 4.1 ใช้ Script อัตโนมัติ (แนะนำ)

```bash
cd deploy
chmod +x setup-database.sh
./setup-database.sh
```

Script นี้จะ:
- สร้าง database `thaiindustrialproperty_db`
- สร้าง user `atsoko_user`
- รัน schema migrations
- แสดง credentials ให้คุณคัดลอกไปใส่ใน `.env`

### 4.2 หรือทำเอง (Manual)

```bash
# เข้า PostgreSQL
sudo -u postgres psql

# สร้าง database และ user
CREATE DATABASE thaiindustrialproperty_db;
CREATE USER atsoko_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE thaiindustrialproperty_db TO atsoko_user;
\q

# กลับไปที่โฟลเดอร์หลัก
cd /var/www/atsoko-backend

# รัน migrations
npm run migrate
```

## ขั้นตอนที่ 5: Import ข้อมูล (ถ้ามี)

```bash
# ถ้ามีไฟล์ CSV และ image-mapping.json
node scripts/import-data.js

# หรือถ้ามี script อื่นๆ
node scripts/import-master-data.js
```

## ขั้นตอนที่ 6: สร้าง Admin User

```bash
npm run create-admin
```

ตามคำแนะนำเพื่อสร้าง admin account

## ขั้นตอนที่ 7: เริ่มต้น Application

### วิธีที่ 1: ใช้ PM2 (แนะนำสำหรับ Production)

```bash
# ติดตั้ง PM2 (ถ้ายังไม่มี)
npm install -g pm2

# สร้างโฟลเดอร์ logs
mkdir -p logs

# เริ่ม application
pm2 start ecosystem.config.js

# บันทึก process list
pm2 save

# ตั้งให้เริ่มอัตโนมัติเมื่อ reboot
pm2 startup
# ทำตามคำแนะนำที่แสดง

# ดู status
pm2 status

# ดู logs
pm2 logs atsoko-backend
```

### วิธีที่ 2: ใช้ Systemd

```bash
# คัดลอก service file
sudo cp deploy/atsoko-backend.service /etc/systemd/system/

# แก้ไข path ถ้าจำเป็น
sudo nano /etc/systemd/system/atsoko-backend.service

# Reload systemd
sudo systemctl daemon-reload

# เริ่ม service
sudo systemctl start atsoko-backend

# ตั้งให้เริ่มอัตโนมัติ
sudo systemctl enable atsoko-backend

# ดู status
sudo systemctl status atsoko-backend

# ดู logs
sudo journalctl -u atsoko-backend -f
```

### วิธีที่ 3: รันแบบธรรมดา (สำหรับทดสอบ)

```bash
npm start
```

## ขั้นตอนที่ 8: ทดสอบ API

```bash
# ทดสอบจาก localhost
curl http://localhost:3000/

# ทดสอบ properties endpoint
curl http://localhost:3000/api/properties

# ทดสอบจาก domain (ถ้า setup nginx แล้ว)
curl http://yourdomain.com/
```

## ขั้นตอนที่ 9: Setup Nginx (ถ้าต้องการ)

```bash
# คัดลอก nginx config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/atsoko-backend

# แก้ไข domain
sudo nano /etc/nginx/sites-available/atsoko-backend
# เปลี่ยน server_name เป็น domain ของคุณ

# Enable site
sudo ln -s /etc/nginx/sites-available/atsoko-backend /etc/nginx/sites-enabled/

# ทดสอบ config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## ขั้นตอนที่ 10: Setup SSL (แนะนำ)

```bash
# ติดตั้ง certbot
sudo apt install -y certbot python3-certbot-nginx

# ขอ SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot จะ setup auto-renewal ให้อัตโนมัติ
```

---

## 🔄 สำหรับ Deploy ครั้งต่อไป (Update โค้ด)

เมื่อมีการแก้ไขโค้ดและ push ไป GitHub แล้ว:

```bash
cd /var/www/atsoko-backend/deploy
./deploy.sh
```

Script นี้จะ:
1. Pull โค้ดล่าสุดจาก GitHub
2. Install dependencies ใหม่
3. Restart application อัตโนมัติ
4. ทำ health check

---

## 🛠️ คำสั่งที่ใช้บ่อย

### ดู Status

```bash
# PM2
pm2 status
pm2 logs atsoko-backend
pm2 monit

# Systemd
sudo systemctl status atsoko-backend
sudo journalctl -u atsoko-backend -f
```

### Restart Application

```bash
# PM2
pm2 restart atsoko-backend

# Systemd
sudo systemctl restart atsoko-backend
```

### Stop Application

```bash
# PM2
pm2 stop atsoko-backend

# Systemd
sudo systemctl stop atsoko-backend
```

### ดู Database

```bash
# เข้า PostgreSQL
sudo -u postgres psql -d thaiindustrialproperty_db

# ดูจำนวน properties
SELECT COUNT(*) FROM properties;

# ดู master data
SELECT * FROM master_types;
SELECT * FROM master_statuses;
```

### Backup Database

```bash
cd /var/www/atsoko-backend/deploy
chmod +x backup-db.sh
./backup-db.sh
```

---

## ❗ แก้ปัญหาที่พบบ่อย

### 1. Port 3000 ถูกใช้งานอยู่

```bash
# หา process ที่ใช้ port 3000
lsof -i :3000

# หรือ
netstat -tlnp | grep 3000

# Kill process
kill -9 <PID>
```

### 2. Database connection failed

```bash
# ตรวจสอบ PostgreSQL ทำงานหรือไม่
sudo systemctl status postgresql

# ตรวจสอบ .env file
cat .env

# ทดสอบเชื่อมต่อ database
psql -U atsoko_user -d thaiindustrialproperty_db -h localhost
```

### 3. Permission denied

```bash
# ตั้งค่า permissions
sudo chown -R www-data:www-data /var/www/atsoko-backend

# หรือถ้าใช้ user อื่น
sudo chown -R $USER:$USER /var/www/atsoko-backend
```

### 4. Nginx 502 Bad Gateway

```bash
# ตรวจสอบ app ทำงานหรือไม่
curl http://localhost:3000/

# ดู nginx error log
sudo tail -f /var/log/nginx/error.log

# ตรวจสอบ SELinux (CentOS)
sudo setsebool -P httpd_can_network_connect 1
```

---

## 📊 Monitoring

### ดู Resource Usage

```bash
# CPU และ Memory
htop

# Disk usage
df -h

# Database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('thaiindustrialproperty_db'));"
```

### Setup Health Check

```bash
cd /var/www/atsoko-backend/deploy
chmod +x health-check.sh
./health-check.sh
```

---

## 🔒 Security Checklist

- [ ] เปลี่ยน password ใน .env ให้แข็งแรง
- [ ] ตั้งค่า firewall (UFW หรือ firewalld)
- [ ] ติดตั้ง SSL certificate
- [ ] ตั้งค่า .env permissions: `chmod 600 .env`
- [ ] Disable root SSH login
- [ ] ใช้ SSH key แทน password
- [ ] Update server เป็นประจำ: `sudo apt update && sudo apt upgrade`
- [ ] Setup automatic backups

---

## 📞 ติดต่อ Support

หากพบปัญหา:
1. ตรวจสอบ logs ก่อน
2. ดู troubleshooting section
3. ตรวจสอบ GitHub issues
4. ติดต่อทีมพัฒนา

---

**🎉 ขอให้ Deploy สำเร็จ!**
