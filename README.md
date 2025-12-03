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

**ข้อมูล Database สำหรับ## Development

### Quick Start with Docker (Recommended)

```bash
# Clone and setup
git clone <repo-url>
cd atsoko-backend
cp .env.docker .env

# Start everything
docker-compose up -d

# Import data
docker-compose exec backend node scripts/import-data.js
```

See [TEAM-DEV.md](./TEAM-DEV.md) for team development guide.
See [DOCKER-DEV.md](./DOCKER-DEV.md) for Docker setup details.

### Local Development (Without Docker)

1. Install PostgreSQL 12+
2. Install Node.js 18+
3. Create database and run `database/schema.sql`
4. Copy `.env.example` to `.env` and configure
5. Run `npm install`
6. Run `node scripts/import-data.js`
7. Run `npm run dev`

## Deployment

For production deployment to VPS, see [deploy/DEPLOYMENT.md](./deploy/DEPLOYMENT.md).

Quick deployment overview:
- SSL/HTTPS with Let's Encrypt
- Nginx reverse proxy
- Systemd service or PM2
- Automated backups
- Health monitoring
- Security hardening

## API Documentation

### Endpoints

#### `GET /`
Health check endpoint

#### `GET /api/properties`
Get all properties with pagination and filtering

Query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `type` - Filter by type (Factory, Warehouse)
- `province` - Filter by province
- `district` - Filter by district
- `min_price` - Minimum price
- `max_price` - Maximum price
- `min_size` - Minimum size (sqm)
- `max_size` - Maximum size (sqm)

#### `GET /api/properties/:id`
Get single property by ID

#### `GET /api/stats`
Get statistics (total properties, by type, by province)

## Project Structure

```
atsoko-backend/
├── config/          # Database configuration
├── database/        # SQL schema
├── deploy/          # Deployment files & documentation
├── routes/          # API routes
├── scripts/         # Data import scripts
├── public/          # Static files (images)
└── server.js        # Main application file
```

## Contributing

1. Create feature branch
2. Make changes
3. Test locally with Docker
4. Submit Pull Request

## License

ISC
sudo -u postgres psql -d demo_db -f database/schema-new.sql

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
