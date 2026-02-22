# Remarks Search & Autocomplete API Documentation

## สรุปการเปลี่ยนแปลง

ระบบค้นหา Remarks สำหรับ **Admin และ Agent** (ทั้งสอง role ใช้ได้)

---

## 1. Autocomplete Endpoint

### Endpoint
```
GET /api/properties/remarks-suggestions
```

### Authentication
- **Required:** Yes (Bearer Token)
- **Role Required:** Admin หรือ Agent (ต้อง login แล้ว)
- **Role-based visibility:**
  - **Admin:** เห็น suggestions จาก properties ทั้งหมด
  - **Agent:** เห็น suggestions จาก properties ของ team ตัวเองเท่านั้น

### Query Parameters
| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `q`       | string | Yes      | คำค้นหา (ต้องมีอย่างน้อย 2 ตัวอักษร) |

### Response Format

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    "urgent - need to fix roof",
    "urgent - owner wants quick sale",
    "urgent contact before Friday"
  ]
}
```

**Empty Result (200 OK):**
```json
{
  "success": true,
  "data": []
}
```

**Unauthorized (401):**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Server Error (500):**
```json
{
  "success": false,
  "error": "Failed to fetch suggestions"
}
```

### ตัวอย่างการใช้งาน

**Admin Request:**
```bash
curl -X GET "https://api.example.com/api/properties/remarks-suggestions?q=urgent" \
  -H "Authorization: Bearer ADMIN_TOKEN"
# → Returns suggestions from ALL properties
```

**Agent Request:**
```bash
curl -X GET "https://api.example.com/api/properties/remarks-suggestions?q=urgent" \
  -H "Authorization: Bearer AGENT_TOKEN"
# → Returns suggestions from agent's TEAM properties only
```

### Features
- ✅ ค้นหา remarks ที่ตรงกับคำค้นหา (case-insensitive)
- ✅ ส่งกลับเฉพาะค่าที่ไม่ซ้ำกัน (DISTINCT)
- ✅ เรียงลำดับตามตัวอักษร (ORDER BY)
- ✅ จำกัดผลลัพธ์สูงสุด 10 รายการ
- ✅ ป้องกัน SQL Injection ด้วย sanitizePattern()
- ✅ ตรวจสอบความยาวคำค้นหาขั้นต่ำ (2 ตัวอักษร)
- ✅ Agent เห็นแค่ suggestions ของ team ตัวเอง

---

## 2. Remarks Filter ใน Main Endpoint

### Endpoint
```
GET /api/properties
```

### Query Parameter

| Parameter | Type   | Required | Description                    | Access            |
|-----------|--------|----------|--------------------------------|-------------------|
| `remarks` | string | No       | ค้นหาใน remarks field เท่านั้น | Admin + Agent     |

### Role-based Behavior

| Role  | พฤติกรรม |
|-------|----------|
| Admin | เห็น properties ทั้งหมดที่ remarks ตรงกับคำค้นหา |
| Agent | เห็นเฉพาะ properties ของ team ตัวเองที่ remarks ตรงกับคำค้นหา |
| Guest | ❌ 401 Unauthorized |

### ตัวอย่างการใช้งาน

**Admin:**
```bash
curl -X GET "https://api.example.com/api/properties?remarks=urgent" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Agent:**
```bash
curl -X GET "https://api.example.com/api/properties?remarks=urgent" \
  -H "Authorization: Bearer AGENT_TOKEN"
# → Returns only agent's team properties with matching remarks
```

---

## 3. Keyword Search (รวม Remarks)

### Endpoint
```
GET /api/properties?keyword=xxx
```

`keyword` parameter ค้นหาใน **3 fields พร้อมกัน**:
1. `title`
2. `property_id`
3. `remarks`

**Role-based visibility เหมือนกัน** — agent เห็นแค่ team ของตัวเอง

---

## สรุปเปรียบเทียบ Search Methods

| Method | Endpoint | Fields ที่ค้นหา | Access |
|--------|----------|-----------------|--------|
| `keyword=xxx` | `GET /api/properties` | title + property_id + remarks | ทุกคน (guest เห็นเฉพาะ published) |
| `remarks=xxx` | `GET /api/properties` | remarks เฉพาะ | Admin + Agent (ต้อง login) |
| `q=xxx` | `GET /api/properties/remarks-suggestions` | remarks (autocomplete) | Admin + Agent (ต้อง login) |

---

## Security Features

### 1. Authentication & Authorization
- ✅ ทุก remarks endpoint ต้อง authenticate
- ✅ Agent เห็นแค่ properties ของ team ตัวเอง (role-based filter)
- ✅ Guest ไม่สามารถ filter/suggest remarks ได้

### 2. Input Validation
- ✅ ตรวจสอบความยาวคำค้นหาขั้นต่ำ (2 ตัวอักษร)
- ✅ Sanitize input ด้วย `sanitizePattern()` function
- ✅ Escape special characters (`%`, `_`) เพื่อป้องกัน SQL Injection

### 3. Performance
- ✅ จำกัดผลลัพธ์ autocomplete ที่ 10 รายการ
- ✅ ใช้ DISTINCT เพื่อลดข้อมูลซ้ำ

---

## Frontend Integration

### Search Box เดียว (ช่อง keyword ปัจจุบัน)
```javascript
// ใช้ keyword= ค้นได้ทั้ง title, property_id, remarks
const searchProperties = async (keyword) => {
  const response = await fetch(
    `/api/properties?keyword=${encodeURIComponent(keyword)}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return response.json();
};
```

### Remarks-only Search (ถ้าจะแยก)
```javascript
// ใช้ remarks= ค้นเฉพาะ remarks field
const searchByRemarks = async (remarksQuery) => {
  const response = await fetch(
    `/api/properties?remarks=${encodeURIComponent(remarksQuery)}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return response.json();
};
```

### Autocomplete สำหรับ Remarks
```javascript
const fetchRemarksSuggestions = async (q) => {
  if (q.length < 2) return [];
  const response = await fetch(
    `/api/properties/remarks-suggestions?q=${encodeURIComponent(q)}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json();
  return data.data || [];
};
```

---

## Changelog

### Version 1.2.0 (2026-02-22)

**Changed:**
- ✅ ลบ Admin-only restriction จาก `remarks-suggestions` endpoint
- ✅ ลบ Admin-only restriction จาก `?remarks=` filter
- ✅ Agent สามารถใช้ทั้ง 2 features ได้แล้ว (เห็นแค่ team ของตัวเอง)
- ✅ Guest ยังคง unauthorized (401) สำหรับ remarks-specific features

### Version 1.1.0 (2026-02-13)
- ✅ `GET /api/properties/remarks-suggestions` - Autocomplete endpoint (Admin only เดิม)
- ✅ `remarks` query parameter ใน `GET /api/properties` (Admin only เดิม)
- ✅ `keyword` parameter ค้นหาใน title, property_id, และ remarks
