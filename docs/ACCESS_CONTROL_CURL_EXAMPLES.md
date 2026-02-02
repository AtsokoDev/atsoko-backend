# Access Control API - cURL Examples for Frontend

เอกสารนี้รวม cURL ตัวอย่างทุก endpoint สำหรับ Access Control System

---

## 📌 ข้อมูลพื้นฐาน

```bash
# Base URL
BASE_URL="http://localhost:3000/api"

# Test Credentials
ADMIN_EMAIL="testadmin@atsoko.com"
ADMIN_PASSWORD="TestPass123!"
AGENT_EMAIL="testagent@atsoko.com"
AGENT_PASSWORD="TestPass123!"
```

---

## 🔐 Authentication

### 1. Login (Admin/Agent)

```bash
# Admin Login
curl -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin@atsoko.com",
    "password": "TestPass123!"
  }'

# Agent Login
curl -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testagent@atsoko.com",
    "password": "TestPass123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 4,
      "email": "testadmin@atsoko.com",
      "name": "Test Admin",
      "role": "admin",
      "team": "Admin Team"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "75563f29201b381359b63521f9c3a4f3...",
    "expiresIn": "15m"
  }
}
```

### 2. Refresh Token

```bash
curl -X POST "${BASE_URL}/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

---

## 📋 Property Workflow API (Admin Only)

### 3. Get Pending Properties

```bash
# Get all pending properties
curl -X GET "${BASE_URL}/property-workflow/pending" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# With filters
curl -X GET "${BASE_URL}/property-workflow/pending?workflow_status=wait_to_fix&page=1&limit=20" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1844,
      "property_id": "AT8R",
      "title": "Factory for Rent",
      "agent_team": "Team A",
      "approve_status": "pending",
      "workflow_status": "pending",
      "created_at": "2026-01-15T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  },
  "summary": {
    "pending": 2,
    "wait_to_fix": 1,
    "fixed": 1,
    "ready_to_publish": 1
  }
}
```

### 4. Change Workflow Status (Admin)

```bash
# Set to wait_to_fix (ขอให้ Agent แก้ไข)
curl -X PUT "${BASE_URL}/property-workflow/1844/status" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_status": "wait_to_fix",
    "note": "กรุณาแก้ไขราคาและอัพเดทรูปภาพ"
  }'

# Set to fixed (Agent แก้แล้ว)
curl -X PUT "${BASE_URL}/property-workflow/1844/status" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_status": "fixed",
    "note": "Agent ได้แก้ไขตามที่ขอแล้ว"
  }'

# Set to ready_to_publish
curl -X PUT "${BASE_URL}/property-workflow/1844/status" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_status": "ready_to_publish",
    "note": "พร้อมเผยแพร่"
  }'
```

**Valid workflow_status values:**
- `pending` - รอตรวจสอบ
- `wait_to_fix` - รอ Agent แก้ไข
- `fixed` - Agent แก้แล้ว
- `ready_to_publish` - พร้อมเผยแพร่

### 5. Publish Property (Admin)

```bash
curl -X PUT "${BASE_URL}/property-workflow/1844/publish" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "อนุมัติและเผยแพร่แล้ว"
  }'
```

**⚠️ หมายเหตุ:** Property ต้องมี `workflow_status = 'ready_to_publish'` ก่อนถึงจะ publish ได้

### 6. Unpublish Property (Admin)

```bash
curl -X PUT "${BASE_URL}/property-workflow/1844/unpublish" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_status": "wait_to_fix",
    "note": "ต้องอัพเดทราคาก่อนเผยแพร่ใหม่"
  }'
```

**Valid workflow_status when unpublishing:** `pending` หรือ `wait_to_fix`

### 7. Get Workflow History

```bash
curl -X GET "${BASE_URL}/property-workflow/1844/history" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "property_id": 1844,
      "previous_workflow_status": "pending",
      "new_workflow_status": "wait_to_fix",
      "changed_by_name": "Test Admin",
      "reason": "กรุณาแก้ไขราคา",
      "created_at": "2026-02-02T..."
    }
  ]
}
```

---

## 📝 Property Requests API

### 8. List All Requests

```bash
# Admin - ดูทั้งหมด
curl -X GET "${BASE_URL}/property-requests" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Agent - ดูเฉพาะของ team ตัวเอง
curl -X GET "${BASE_URL}/property-requests" \
  -H "Authorization: Bearer ${AGENT_TOKEN}"

# With filters
curl -X GET "${BASE_URL}/property-requests?status=pending&request_type=edit&page=1&limit=20" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

**Filter options:**
- `status`: `pending` | `approved` | `rejected`
- `request_type`: `edit` | `delete`

### 9. Create Edit Request (Agent)

```bash
curl -X POST "${BASE_URL}/property-requests" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": 1844,
    "request_type": "edit",
    "reason": "ต้องการอัพเดทราคาตามสภาพตลาด",
    "requested_changes": {
      "price": 50000,
      "price_alternative": 15000000,
      "remarks": "ปรับราคาใหม่ 2026"
    }
  }'
```

**⚠️ หมายเหตุ:** ใช้สำหรับ published properties เท่านั้น (unpublished สามารถแก้ตรงได้)

### 10. Create Delete Request (Agent)

```bash
curl -X POST "${BASE_URL}/property-requests" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": 1844,
    "request_type": "delete",
    "reason": "ทรัพย์สินนี้ขายออกแล้ว ไม่ต้องการแสดงอีกต่อไป"
  }'
```

### 11. Get Request Detail

```bash
curl -X GET "${BASE_URL}/property-requests/1" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "property_id": 1844,
    "property_code": "AT8R",
    "property_title": "Factory for Rent",
    "request_type": "edit",
    "status": "pending",
    "reason": "ต้องการอัพเดทราคาตามสภาพตลาด",
    "requested_changes": {
      "price": 50000
    },
    "requested_by_name": "Test Agent",
    "created_at": "2026-02-02T...",
    "notes": [...]
  }
}
```

### 12. Process Request - Approve (Admin)

```bash
curl -X PUT "${BASE_URL}/property-requests/1/process" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "admin_response": "อนุมัติ ได้ปรับราคาให้แล้ว"
  }'
```

### 13. Process Request - Reject (Admin)

```bash
curl -X PUT "${BASE_URL}/property-requests/1/process" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject",
    "admin_response": "กรุณาแนบเอกสารยืนยันเพิ่มเติม"
  }'
```

---

## 💬 Property Notes API

### 14. Get Notes for Property

```bash
# Admin - ดูทุก note รวม internal
curl -X GET "${BASE_URL}/property-notes/1844" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Agent - ดูเฉพาะ non-internal notes
curl -X GET "${BASE_URL}/property-notes/1844" \
  -H "Authorization: Bearer ${AGENT_TOKEN}"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "property_id": 1844,
      "note_type": "fix_request",
      "content": "กรุณาแก้ไขราคา",
      "is_internal": false,
      "author_name": "Test Admin",
      "author_role": "admin",
      "created_at": "2026-02-02T..."
    }
  ]
}
```

### 15. Add Note (Admin - General)

```bash
curl -X POST "${BASE_URL}/property-notes/1844" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "ทรัพย์สินนี้ดูดีมาก พร้อมเผยแพร่",
    "note_type": "general",
    "is_internal": false
  }'
```

### 16. Add Internal Note (Admin Only)

```bash
curl -X POST "${BASE_URL}/property-notes/1844" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "หมายเหตุภายใน: ต้องตรวจสอบราคากับฝ่ายขาย",
    "note_type": "general",
    "is_internal": true
  }'
```

**⚠️ หมายเหตุ:** Internal notes จะไม่แสดงให้ Agent เห็น

### 17. Add Fix Response Note (Agent)

```bash
curl -X POST "${BASE_URL}/property-notes/1844" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "ได้อัพเดทราคาและรูปภาพตามที่ขอแล้วครับ",
    "note_type": "fix_response"
  }'
```

**⚠️ หมายเหตุ:** ถ้า property มี `workflow_status = 'wait_to_fix'` จะเปลี่ยนเป็น `fixed` อัตโนมัติ

**Valid note_type:**
- `general` - หมายเหตุทั่วไป
- `fix_request` - ขอให้แก้ไข (Admin)
- `fix_response` - ตอบกลับการแก้ไข (Agent)
- `approval` - หมายเหตุอนุมัติ
- `rejection` - หมายเหตุปฏิเสธ

### 18. Delete Note

```bash
# Agent - ลบ note ตัวเองได้ภายใน 24 ชม.
curl -X DELETE "${BASE_URL}/property-notes/1844/5" \
  -H "Authorization: Bearer ${AGENT_TOKEN}"

# Admin - ลบ note ใดก็ได้
curl -X DELETE "${BASE_URL}/property-notes/1844/5" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

---

## 🏠 Properties API (with Access Control)

### 19. Get Properties (Public/Guest)

```bash
# ไม่ต้อง token - ดูได้เฉพาะ published
curl -X GET "${BASE_URL}/properties?limit=10"

# With filters
curl -X GET "${BASE_URL}/properties?status=rent&province=สมุทรปราการ&sort=price&order=asc"

# Authenticated user - ดูได้ทั้งหมด (รวม unpublished ของ team)
curl -X GET "${BASE_URL}/properties?limit=10" \
  -H "Authorization: Bearer ${AGENT_TOKEN}"
```

### 20. Edit Property (Agent - Unpublished Only)

```bash
# Agent แก้ไข unpublished property ได้โดยตรง
curl -X PUT "${BASE_URL}/properties/1844" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 45000,
    "remarks": "อัพเดทราคาใหม่"
  }'
```

**Response เมื่อพยายามแก้ Published Property:**
```json
{
  "success": false,
  "error": "Published properties cannot be edited directly. Please use the Edit Request feature.",
  "requiresRequest": true
}
```

### 21. Delete Property (Agent - Unpublished Only)

```bash
# Agent ลบ unpublished property ได้โดยตรง
curl -X DELETE "${BASE_URL}/properties/1844" \
  -H "Authorization: Bearer ${AGENT_TOKEN}"
```

**Response เมื่อพยายามลบ Published Property:**
```json
{
  "success": false,
  "error": "Published properties cannot be deleted directly. Please use the Delete Request feature.",
  "requiresRequest": true
}
```

### 22. Edit/Delete Property (Admin - Any)

```bash
# Admin แก้ไขได้ทุก property
curl -X PUT "${BASE_URL}/properties/1844" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 55000,
    "approve_status": "published"
  }'

# Admin ลบได้ทุก property
curl -X DELETE "${BASE_URL}/properties/1844" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

---

## 🔄 Workflow Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ Agent เพิ่ม Property                                        │
│ → workflow_status = 'pending', approve_status = 'pending'  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Admin ตรวจสอบ                                               │
│ ├─ OK → PUT /status { workflow_status: "ready_to_publish" } │
│ └─ ต้องแก้ → PUT /status { workflow_status: "wait_to_fix" } │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent แก้ไข (ถ้ามี wait_to_fix)                              │
│ → POST /property-notes { note_type: "fix_response" }        │
│ → Auto: workflow_status เปลี่ยนเป็น 'fixed'                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Admin เผยแพร่                                               │
│ → PUT /property-workflow/:id/publish                        │
│ → approve_status = 'published'                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ หลังเผยแพร่ - ต้องใช้ Request System                        │
│ → Agent: POST /property-requests { request_type: "edit" }   │
│ → Admin: PUT /property-requests/:id/process { action }     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚨 Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied. Insufficient permissions."
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Property not found"
}
```

---

## 🔑 Quick Token Setup

```bash
# Get Admin Token
ADMIN_TOKEN=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "testadmin@atsoko.com", "password": "TestPass123!"}' \
  | jq -r '.data.accessToken')

echo "Admin Token: ${ADMIN_TOKEN}"

# Get Agent Token
AGENT_TOKEN=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "testagent@atsoko.com", "password": "TestPass123!"}' \
  | jq -r '.data.accessToken')

echo "Agent Token: ${AGENT_TOKEN}"
```

---

## 📊 Status Reference

### approve_status
| Value | คำอธิบาย |
|-------|----------|
| `pending` | รอ Admin อนุมัติ |
| `published` | เผยแพร่แล้ว |
| `deleted` | ถูกลบ (soft delete) |

### workflow_status
| Value | คำอธิบาย |
|-------|----------|
| `pending` | Agent ส่งมาใหม่ |
| `wait_to_fix` | Admin ขอให้แก้ไข |
| `fixed` | Agent แก้แล้ว |
| `ready_to_publish` | พร้อมเผยแพร่ |

### request_type
| Value | คำอธิบาย |
|-------|----------|
| `edit` | ขอแก้ไข |
| `delete` | ขอลบ |

### request status
| Value | คำอธิบาย |
|-------|----------|
| `pending` | รอ Admin ตรวจ |
| `approved` | อนุมัติแล้ว |
| `rejected` | ปฏิเสธ |
