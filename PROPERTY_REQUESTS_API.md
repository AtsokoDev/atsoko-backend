# ✅ Backend: Property Requests API

**สถานะ:** ✅ พร้อมใช้งานแล้ว (มี API ครบ)

---

## 📋 API Endpoints

### 1. **POST /api/property-requests** ✅
**สร้าง Edit/Delete Request (Agent only)**

**Request Body:**
```json
{
  "property_id": 123,          // required: ID ของ property (numeric ID จาก database)
  "request_type": "edit",      // required: "edit" หรือ "delete"
  "reason": "Need to update price because...",  // optional แต่แนะนำให้ส่ง
  "requested_changes": {...}   // required สำหรับ edit, optional สำหรับ delete
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "edit request created successfully",
  "data": {
    "id": 456,
    "property_id": 123,
    "request_type": "edit",
    "status": "pending",
    "requested_by": 5,
    "reason": "Need to update price...",
    "created_at": "2026-02-05T01:00:00.000Z"
  }
}
```

**Validation:**
- ✅ ตรวจสอบว่า property มีจริง
- ✅ ตรวจสอบว่า agent เป็นคนใน team เดียวกับ property
- ✅ **สำคัญ:** รองรับแค่ `published` properties เท่านั้น
  - Unpublished properties → แก้/ลบได้ตรงๆ ไม่ต้อง request
  - Published properties → ต้อง request ผ่าน admin
- ✅ ตรวจสอบว่าไม่มี pending request ซ้ำ

---

### 2. **GET /api/property-requests** ✅
**ดู Requests ทั้งหมด**

**Query Parameters:**
- `status`: "pending", "approved", "rejected"
- `request_type`: "edit", "delete"
- `page`: pagination
- `limit`: items per page (default: 20)

**Access:**
- Admin: เห็นทั้งหมด
- Agent: เห็นแค่ team ตัวเอง

---

### 3. **PUT /api/property-requests/:id/process** ✅
**Approve/Reject Request (Admin only)**

**Request Body:**
```json
{
  "action": "approve",  // "approve" หรือ "reject"
  "admin_response": "Approved because..."
}
```

---

### 4. **GET /api/property-requests/:id** ✅
**ดูรายละเอียด Request แบบละเอียด**

---

## ⚠️ สิ่งที่ Frontend ต้องรู้

### **property_id vs property_code**

Backend ใช้ **2 IDs:**
1. **`id`** (numeric) - Database internal ID
2. **`property_id`** (string) - Property code (e.g., "AT123R")

**ตัวอย่าง Property:**
```json
{
  "id": 789,               // ← ใช้ตัวนี้ส่งไป API
  "property_id": "AT123R", // ← แสดงให้ user เห็น
  "title": "Factory...",
  "approve_status": "published"
}
```

**สำคัญ:** เวลาเรียก API ต้องส่ง **numeric `id`** ไม่ใช่ `property_id` string!

```javascript
// ❌ ผิด
POST /api/property-requests
{
  "property_id": "AT123R",  // ผิด! นี่คือ property_code
  "request_type": "delete",
  "reason": "..."
}

// ✅ ถูก
POST /api/property-requests
{
  "property_id": 789,  // ถูก! นี่คือ numeric ID
  "request_type": "delete",
  "reason": "..."
}
```

---

## 🧪 ทดสอบ API

### Test 1: Create Delete Request
```bash
curl -X POST http://localhost:3000/api/property-requests \
  -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": 789,
    "request_type": "delete",
    "reason": "Property sold"
  }'
```

### Test 2: Create Edit Request
```bash
curl -X POST http://localhost:3000/api/property-requests \
  -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  -H "Content-Type": application/json" \
  -d '{
    "property_id": 789,
    "request_type": "edit",
    "reason": "Need to update price",
    "requested_changes": {
      "price": 100000,
      "size": 500
    }
  }'
```

### Test 3: Get All Requests
```bash
curl -X GET "http://localhost:3000/api/property-requests?status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ สรุป

**Backend พร้อมแล้ว 100%! ✅**

**API ที่มี:**
- ✅ POST /api/property-requests - สร้าง request
- ✅ GET /api/property-requests - ดูรายการ
- ✅ GET /api/property-requests/:id - ดูรายละเอียด
- ✅ PUT /api/property-requests/:id/process - approve/reject (admin)

**Features:**
- ✅ Agent สร้าง edit/delete request ได้
- ✅ ป้องกัน pending request ซ้ำ
- ✅ รองรับแค่ published properties
- ✅ Team-based access control
- ✅ Auto-create notes เมื่อสร้าง request
- ✅ Soft delete แทนการลบจริง
- ✅ Workflow history tracking

**Frontend ต้องทำ:**
1. ✅ ส่ง `property_id` เป็น **numeric ID** (ไม่ใช่ property_code string)
2. ✅ เพิ่ม Authorization header (Bearer token)
3. ✅ Handle success/error responses

---

**ตัวอย่าง Frontend Code:**

```javascript
// ✅ ถูกต้อง
async function submitDeleteRequest(property) {
  const response = await fetch('/api/property-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      property_id: property.id,  // ← numeric ID
      request_type: 'delete',
      reason: deleteReason
    })
  });
  
  const data = await response.json();
  if (data.success) {
    alert('Delete request submitted!');
  }
}

async function submitEditRequest(property) {
  const response = await fetch('/api/property-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      property_id: property.id,  // ← numeric ID
      request_type': 'edit',
      reason: editReason,
      requested_changes: null  // optional สำหรับ simple edit request
    })
  });
  
  const data = await response.json();
  if (data.success) {
    alert('Edit request submitted!');
  }
}
```

---

**หมายเหตุ:** ถ้า frontend ยังไม่มี `property.id` ให้เพิ่มใน API response ของ GET /api/properties
