# ✅ Backend Ready: Property Requests API

**วันที่:** 2026-02-05  
**สถานะ:** ✅ Backend พร้อมใช้งาน 100%

---

## 🎯 สรุปสั้นๆ

### ✅ Backend มี API แล้ว

**Endpoint:** `POST /api/property-requests`

**รองรับ:**
- ✅ Edit requests (request_type: 'edit')
- ✅ Delete requests (request_type: 'delete')
- ✅ Team-based access control
- ✅ รองรับเฉพาะ published properties
- ✅ ป้องกัน duplicate pending requests

---

## 📝 Frontend ต้องส่งอะไร

```javascript
// Delete Request
POST /api/property-requests
{
  "property_id": 1802,  // ← numeric ID (ไม่ใช่ "AT2029R")
  "request_type": "delete",
  "reason": "Property sold"
}

// Edit Request
POST /api/property-requests
{
  "property_id": 1802,  // ← numeric ID
  "request_type": "edit",
  "reason": "Need to update price"
}
```

**⚠️ สำคัญ:** 
- ใช้ `property.id` (numeric: 1802) 
- **ไม่ใช่** `property.property_id` (string: "AT2029R")

---

## ✅ ตัวอย่าง Property Object

จาก `GET /api/properties`:
```json
{
  "id": 1802,               // ← ใช้ตัวนี้ส่งไป API
  "property_id": "AT2029R", // ← แสดงให้ user เห็น
  "title": "Factory...",
  "approve_status": "published"
}
```

---

## 🧪 Test

```bash
# Test Delete Request
curl -X POST http://localhost:3000/api/property-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": 1802,
    "request_type": "delete",
    "reason": "Property sold"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "delete request created successfully",
  "data": { ... }
}
```

---

## ✅ สรุป

✅ **Backend:** พร้อมแล้ว - No changes needed  
✅ **API:** POST /api/property-requests ใช้งานได้  
✅ **Format:** ตรงกับที่ frontend ต้องการ  
✅ **Access:** Agent สร้าง request ได้

**Frontend:** ใช้ได้เลย! แค่ส่ง `property.id` (numeric) 

**เอกสารเพิ่มเติม:** `PROPERTY_REQUESTS_API.md`
