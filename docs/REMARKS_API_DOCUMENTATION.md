# Remarks Search & Autocomplete API Documentation

## สรุปการเปลี่ยนแปลง

เพิ่มฟีเจอร์ใหม่สำหรับ Admin ในการค้นหาและ autocomplete ใน remarks field

---

## 1. Autocomplete Endpoint (ใหม่)

### Endpoint
```
GET /api/properties/remarks-suggestions
```

### Authentication
- **Required:** Yes (Bearer Token)
- **Role Required:** Admin only
- **Response:** 403 Forbidden สำหรับ non-admin users

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

**Forbidden (403):**
```json
{
  "success": false,
  "error": "Only admins can search remarks"
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

**Request:**
```bash
curl -X GET "https://api.example.com/api/properties/remarks-suggestions?q=urgent" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
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

### Features
- ✅ ค้นหา remarks ที่ตรงกับคำค้นหา (case-insensitive)
- ✅ ส่งกลับเฉพาะค่าที่ไม่ซ้ำกัน (DISTINCT)
- ✅ เรียงลำดับตามตัวอักษร (ORDER BY)
- ✅ จำกัดผลลัพธ์สูงสุด 10 รายการ
- ✅ ป้องกัน SQL Injection ด้วย sanitizePattern()
- ✅ ตรวจสอบความยาวคำค้นหาขั้นต่ำ (2 ตัวอักษร)

---

## 2. Remarks Filter (แก้ไข)

### Endpoint
```
GET /api/properties
```

### เพิ่ม Query Parameter ใหม่

| Parameter | Type   | Required | Description                    | Access      |
|-----------|--------|----------|--------------------------------|-------------|
| `remarks` | string | No       | ค้นหาใน remarks field เท่านั้น | Admin only  |

### ตัวอย่างการใช้งาน

**Request:**
```bash
curl -X GET "https://api.example.com/api/properties?remarks=urgent" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "property_id": "AT123R",
      "title": "Warehouse in Bangkok",
      "remarks": "urgent - need to fix roof",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  },
  "filters": {
    "keyword": null,
    "remarks": "urgent",
    "property_id": null,
    ...
  },
  "sorting": {
    "sort": "updated_at",
    "order": "DESC"
  }
}
```

### Features
- ✅ Filter เฉพาะ properties ที่มี remarks ตรงกับคำค้นหา
- ✅ ใช้ ILIKE pattern matching (case-insensitive)
- ✅ Admin-only access (403 สำหรับ non-admin)
- ✅ ป้องกัน SQL Injection
- ✅ รวมกับ filters อื่นๆ ได้

---

## 3. Keyword Search (แก้ไขเดิม)

### การเปลี่ยนแปลง
ตอนนี้ `keyword` parameter จะค้นหาใน **3 fields พร้อมกัน**:
1. `title`
2. `property_id`
3. `remarks`

### ตัวอย่าง

**Request:**
```bash
curl -X GET "https://api.example.com/api/properties?keyword=urgent"
```

**ผลลัพธ์:** จะแสดง properties ที่มีคำว่า "urgent" ใน title, property_id, หรือ remarks

---

## Security Features

### 1. Authentication & Authorization
- ✅ ทั้ง 2 endpoints ต้อง authenticate
- ✅ เช็ค admin role ก่อนทำงาน
- ✅ ส่ง 403 Forbidden สำหรับ non-admin users

### 2. Input Validation
- ✅ ตรวจสอบความยาวคำค้นหาขั้นต่ำ (2 ตัวอักษร)
- ✅ Sanitize input ด้วย `sanitizePattern()` function
- ✅ Escape special characters (`%`, `_`) เพื่อป้องกัน SQL Injection

### 3. Performance
- ✅ จำกัดผลลัพธ์ autocomplete ที่ 10 รายการ
- ✅ ใช้ DISTINCT เพื่อลดข้อมูลซ้ำ
- ✅ Index บน remarks field (แนะนำ)

---

## Database Considerations

### แนะนำให้สร้าง Index
```sql
-- เพิ่ม index สำหรับเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX idx_properties_remarks ON properties USING gin (remarks gin_trgm_ops);

-- หรือใช้ btree index ธรรมดา
CREATE INDEX idx_properties_remarks ON properties (remarks);
```

---

## Frontend Integration

### 1. Autocomplete Component

```javascript
// ตัวอย่าง React Autocomplete
const [suggestions, setSuggestions] = useState([]);
const [loading, setLoading] = useState(false);

const fetchSuggestions = async (query) => {
  if (query.length < 2) {
    setSuggestions([]);
    return;
  }
  
  setLoading(true);
  try {
    const response = await fetch(
      `/api/properties/remarks-suggestions?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
    );
    const data = await response.json();
    setSuggestions(data.data || []);
  } catch (error) {
    console.error('Failed to fetch suggestions:', error);
    setSuggestions([]);
  } finally {
    setLoading(false);
  }
};

// Debounce สำหรับประสิทธิภาพ
const debouncedFetch = debounce(fetchSuggestions, 300);
```

### 2. Filter by Remarks

```javascript
// ตัวอย่างการ filter
const searchByRemarks = async (remarksQuery) => {
  const response = await fetch(
    `/api/properties?remarks=${encodeURIComponent(remarksQuery)}`,
    {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    }
  );
  const data = await response.json();
  return data;
};
```

---

## Testing

### Test Cases

#### 1. Autocomplete Endpoint
```bash
# Test 1: Valid query
curl -X GET "http://localhost:3000/api/properties/remarks-suggestions?q=urgent" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Test 2: Short query (< 2 chars)
curl -X GET "http://localhost:3000/api/properties/remarks-suggestions?q=u" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Test 3: Non-admin user (should return 403)
curl -X GET "http://localhost:3000/api/properties/remarks-suggestions?q=urgent" \
  -H "Authorization: Bearer AGENT_TOKEN"

# Test 4: No authentication (should return 401)
curl -X GET "http://localhost:3000/api/properties/remarks-suggestions?q=urgent"
```

#### 2. Remarks Filter
```bash
# Test 1: Admin filter by remarks
curl -X GET "http://localhost:3000/api/properties?remarks=urgent" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Test 2: Non-admin filter (should return 403)
curl -X GET "http://localhost:3000/api/properties?remarks=urgent" \
  -H "Authorization: Bearer AGENT_TOKEN"

# Test 3: Combined filters
curl -X GET "http://localhost:3000/api/properties?remarks=urgent&status=rent" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Changelog

### Version 1.1.0 (2026-02-13)

**Added:**
- ✅ `GET /api/properties/remarks-suggestions` - Autocomplete endpoint สำหรับ admin
- ✅ `remarks` query parameter ใน `GET /api/properties` - Filter เฉพาะ remarks
- ✅ Admin-only access control สำหรับทั้ง 2 features
- ✅ Input validation และ sanitization

**Modified:**
- ✅ `keyword` parameter ตอนนี้ค้นหาใน title, property_id, และ remarks พร้อมกัน
- ✅ Response filters object รวม `remarks` field

**Security:**
- ✅ Role-based access control (Admin only)
- ✅ SQL injection protection
- ✅ Input validation

---

## Notes

1. **Frontend ไม่ต้องแก้อะไรเลย** สำหรับ keyword search (ยังส่ง `keyword` parameter เหมือนเดิม)
2. **Autocomplete และ Remarks Filter** เป็น features ใหม่สำหรับ Admin เท่านั้น
3. **แนะนำให้สร้าง Index** บน remarks field เพื่อเพิ่มประสิทธิภาพ
4. **Debounce** autocomplete requests ใน frontend เพื่อลดโหลด server
