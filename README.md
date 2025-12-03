# Backend API Demo (Node.js + PostgreSQL)

API สำหรับจัดการข้อมูล Users และ Products ด้วย PostgreSQL

## การติดตั้ง

1. ติดตั้ง dependencies
```bash
npm install
```

2. ตั้งค่า PostgreSQL
- สร้าง database ชื่อ `demo_db`
- แก้ไขค่าใน `.env` ให้ตรงกับ database ของคุณ

**ข้อมูล Database สำหรับ Demo:**
```
Host: localhost
Port: 5432
Database: demo_db
Username: postgres
Password: postgres
```

3. สร้างตารางและข้อมูลตัวอย่าง
```bash
psql -U postgres -d demo_db -f database/schema.sql
```

## การรัน

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## การ Import ข้อมูล

### 1. สร้าง schema ใหม่
```bash
sudo -u postgres psql -d demo_db -f database/schema-new.sql
```

### 2. Download และแปลงรูปภาพ
```bash
node scripts/download-images.js
```

### 3. Import ข้อมูลจาก CSV
```bash
node scripts/import-data.js
```

## API Endpoints

### Properties
- `GET /api/properties` - ดึงข้อมูล properties ทั้งหมด (รองรับ filters)
  - Query params: `type`, `province`, `district`, `min_price`, `max_price`, `min_size`, `max_size`, `page`, `limit`
- `GET /api/properties/:id` - ดึงข้อมูล property ตาม ID หรือ property_id

### Statistics
- `GET /api/stats` - ดึงสถิติข้อมูล properties

### Images
- `GET /images/:filename` - ดึงรูปภาพ

## ตัวอย่างการใช้งาน

### ดึงข้อมูล Properties ทั้งหมด
```bash
curl http://localhost:3000/api/properties
```

### ค้นหา Properties ตาม Province
```bash
curl "http://localhost:3000/api/properties?province=Bangkok&page=1&limit=10"
```

### ดึงสถิติ
```bash
curl http://localhost:3000/api/stats
```
# atsoko-backend
