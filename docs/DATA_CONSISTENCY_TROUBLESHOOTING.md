# 🔍 Data Consistency Troubleshooting Guide

## ปัญหา: ข้อมูลที่สร้างใหม่ไม่แสดงหรือแสดงไม่เสถียร

### สาเหตุที่พบและแก้ไขแล้ว

#### ✅ 1. Database Connection Pool Configuration (แก้ไขแล้ว)

**ปัญหา:** `config/database.js` ไม่มีการตั้งค่า connection pool ที่เหมาะสม ทำให้เกิด stale connections

**การแก้ไข:**
```javascript
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'demo_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,                          // จำนวน connection สูงสุด
  idleTimeoutMillis: 30000,         // ปิด idle connection หลัง 30 วินาที
  connectionTimeoutMillis: 2000,    // timeout สำหรับการเชื่อมต่อใหม่
  allowExitOnIdle: false,           // ไม่ให้ pool ปิดเมื่อไม่มี connection
  statement_timeout: 30000,         // timeout สำหรับ SQL statement
  query_timeout: 30000,             // timeout สำหรับ query
});
```

**ทำไมต้องแก้:**
- **Stale Connections:** Connection ที่ค้างนานอาจอ่านข้อมูลเก่าจาก cache
- **Connection Leaks:** ไม่มี timeout ทำให้ connection ค้างไม่ปล่อยกลับ pool
- **Performance:** ไม่มีการจำกัดจำนวน connection

### สาเหตุที่เป็นไปได้อื่นๆ

#### 2. Frontend Caching (สาเหตุที่น่าจะเป็นมากที่สุด)

**ตรวจสอบ:**
```bash
# ทดสอบ API โดยตรง
curl "http://localhost:3000/api/properties?limit=5&sort=updated_at" | jq '.data[0]'
```

**ถ้า API แสดงข้อมูลใหม่ แต่ Frontend ไม่แสดง = Frontend Cache Issue**

**วิธีแก้:**
- Hard refresh browser: `Ctrl + Shift + R` (Windows/Linux) หรือ `Cmd + Shift + R` (Mac)
- Clear React Query / SWR cache
- Disable Service Worker ชั่วคราว
- ตรวจสอบ `staleTime` และ `cacheTime` ใน React Query config

#### 3. Query Filters ที่ซ่อนข้อมูลใหม่

**ตรวจสอบ:**
- `publication_status` ต้องเป็น `'published'` ถึงจะแสดงในหน้า public
- `deleted_at` ต้องเป็น `NULL`
- `moderation_status` อาจมีผลต่อการแสดงผล

**ตัวอย่าง Query ที่ถูกต้อง:**
```sql
SELECT * FROM properties 
WHERE publication_status = 'published' 
  AND deleted_at IS NULL
ORDER BY updated_at DESC;
```

#### 4. Transaction Isolation Issues

**ตรวจสอบ:** ถ้าใช้ transaction ต้องแน่ใจว่า `COMMIT` แล้วก่อนที่จะ query

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... update operations
  await client.query('COMMIT');  // ต้อง commit ก่อน!
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

#### 5. Browser Cache Headers

**ตรวจสอบ Response Headers:**
```bash
curl -I http://localhost:3000/api/properties
```

**ต้องไม่มี:**
- `Cache-Control: max-age=...` (ค่าสูง)
- `ETag` ที่ไม่เปลี่ยน

### 🧪 วิธีทดสอบปัญหา

#### Test 1: ทดสอบ Backend โดยตรง
```bash
cd /home/phu/Desktop/atsoko-backend
node scripts/diagnose-data-issues.js
```

#### Test 2: ทดสอบ Live Updates
```bash
node scripts/test-live-updates.js
```

#### Test 3: Manual Testing Flow

1. **อัพเดทข้อมูล** ใน admin panel
2. **ทดสอบ API ทันที:**
   ```bash
   curl "http://localhost:3000/api/properties?limit=5&sort=updated_at" | jq '.data[0].property_id'
   ```
3. **เช็คผลลัพธ์:**
   - ✅ ถ้าเห็นข้อมูลใหม่ = Backend ทำงานถูกต้อง → ปัญหาอยู่ที่ Frontend
   - ❌ ถ้าไม่เห็นข้อมูลใหม่ = Backend มีปัญหา → ดูขั้นตอนด้านล่าง

### 🔧 วิธีแก้ไขทีละขั้นตอน

#### ขั้นตอนที่ 1: Restart Backend (สำคัญ!)
```bash
# หยุด backend ที่รันอยู่
pkill -f "node server.js"

# รัน backend ใหม่
cd /home/phu/Desktop/atsoko-backend
npm start
```

**หรือถ้าใช้ nodemon:**
```bash
npm run dev
```

#### ขั้นตอนที่ 2: Clear Frontend Cache

**ในเบราว์เซอร์:**
1. กด `Ctrl + Shift + R` (hard refresh)
2. เปิด DevTools → Application → Clear storage
3. Reload หน้าใหม่

**ถ้าใช้ React Query:**
```javascript
// ใน component
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
queryClient.invalidateQueries(['properties']);
```

#### ขั้นตอนที่ 3: ตรวจสอบ Database

```sql
-- ดูข้อมูลล่าสุด
SELECT property_id, title, updated_at, publication_status, deleted_at
FROM properties 
ORDER BY updated_at DESC 
LIMIT 10;

-- ตรวจสอบว่ามี stale connections หรือไม่
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections
FROM pg_stat_activity 
WHERE datname = 'thaiindustrialproperty_db';
```

### 📊 Monitoring & Debugging

#### ดู Pool Status (เพิ่มใน server.js)
```javascript
// เพิ่มใน server.js
setInterval(() => {
  console.log('Pool status:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 60000); // ทุก 1 นาที
```

#### Enable Query Logging
```javascript
// ใน config/database.js
pool.on('connect', (client) => {
  console.log('New client connected');
});

pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});
```

### ✅ Checklist สำหรับแก้ปัญหา

- [x] แก้ไข database pool configuration
- [ ] Restart backend server
- [ ] Clear browser cache (Ctrl+Shift+R)
- [ ] ทดสอบ API โดยตรงด้วย curl
- [ ] ตรวจสอบ publication_status ของข้อมูลใหม่
- [ ] ตรวจสอบ frontend caching strategy
- [ ] ตรวจสอบ transaction commits
- [ ] Monitor pool connections

### 🎯 Expected Behavior

**หลังแก้ไข:**
1. สร้าง/อัพเดทข้อมูลใหม่
2. ข้อมูลปรากฏ**ทันที**ใน API response
3. Frontend แสดงข้อมูลใหม่ภายใน 1-2 วินาที (ขึ้นกับ polling/refetch interval)

### 📝 Additional Notes

- Pool settings ที่แก้ไขจะมีผลเมื่อ restart server เท่านั้น
- ถ้าปัญหายังคงอยู่หลัง restart → ปัญหาน่าจะอยู่ที่ frontend cache
- ใช้ `ORDER BY updated_at DESC` เพื่อให้ข้อมูลใหม่ขึ้นก่อน
- ตรวจสอบว่า `updated_at` ถูก set อัตโนมัติเมื่อมีการ UPDATE

### 🆘 ถ้ายังแก้ไม่ได้

รัน diagnostic script และส่งผลลัพธ์:
```bash
node scripts/test-live-updates.js > debug-output.txt
```

จากนั้นตรวจสอบว่า:
1. API response มีข้อมูลใหม่หรือไม่
2. Frontend request ไปที่ API จริงหรือใช้ cache
3. มี error ใน browser console หรือไม่
