# Access Control System - API Documentation

## 📋 ภาพรวม

ระบบ Access Control สำหรับจัดการ properties ประกอบด้วย:
1. **Workflow Status** - ติดตามสถานะการตรวจสอบ
2. **Property Requests** - ระบบขอแก้ไข/ลบสำหรับ published properties
3. **Property Notes** - การสื่อสารระหว่าง Admin และ Agent

---

## 🔐 Roles & Permissions

### Admin
| Action | Permission |
|--------|------------|
| View all properties | ✅ |
| Add property | ✅ (auto-publish) |
| Edit any property | ✅ |
| Delete any property | ✅ |
| Publish/Unpublish | ✅ |
| Change workflow status | ✅ |
| View all requests | ✅ |
| Approve/Reject requests | ✅ |
| Add notes (including internal) | ✅ |

### Agent
| Action | Permission |
|--------|------------|
| View own team's properties | ✅ |
| Add property | ✅ (pending) |
| Edit unpublished property | ✅ |
| Delete unpublished property | ✅ |
| Edit published property | ❌ (use request) |
| Delete published property | ❌ (use request) |
| Publish/Unpublish | ❌ |
| Create edit request | ✅ |
| Create delete request | ✅ |
| Add notes | ✅ |
| Respond to fix requests | ✅ |

### Guest
| Action | Permission |
|--------|------------|
| View published properties | ✅ |
| View secret fields | ❌ |
| Any modifications | ❌ |

---

## 📊 Status Values

### Approval Status (`approve_status`)
| Status | Description |
|--------|-------------|
| `pending` | รอ Admin ตรวจสอบ |
| `published` | เผยแพร่แล้ว |
| `deleted` | ถูกลบ (soft delete) |

### Workflow Status (`workflow_status`)
| Status | Description |
|--------|-------------|
| `pending` | Agent ส่งใหม่ รอ Admin ตรวจ |
| `wait_to_fix` | Admin ขอให้แก้ไข |
| `fixed` | Agent แก้แล้ว รอ Admin ตรวจซ้ำ |
| `ready_to_publish` | Admin ตรวจแล้ว พร้อม publish |

---

## 🔄 Workflow Flow

```
Agent adds property
        ↓
workflow_status = 'pending'
approve_status = 'pending'
        ↓
Admin reviews
        ↓
    ┌───┴───┐
    ↓       ↓
  OK?     Need fix?
    ↓       ↓
ready_to_publish  wait_to_fix
    ↓       ↓
Admin publishes  Agent fixes
    ↓       ↓
published   fixed
            ↓
      Admin reviews again
```

---

## 📡 API Endpoints

### Property Workflow API

#### Get Pending Properties (Admin)
```http
GET /api/property-workflow/pending
```
**Query Parameters:**
- `workflow_status` - Filter by status
- `page`, `limit` - Pagination

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {...},
  "summary": {
    "pending": 5,
    "wait_to_fix": 2,
    "fixed": 1,
    "ready_to_publish": 3
  }
}
```

#### Update Workflow Status (Admin)
```http
PUT /api/property-workflow/:id/status
```
**Request Body:**
```json
{
  "workflow_status": "wait_to_fix",
  "note": "Please fix the price and update images"
}
```

#### Publish Property (Admin)
```http
PUT /api/property-workflow/:id/publish
```
**Prerequisite:** `workflow_status = 'ready_to_publish'`

#### Unpublish Property (Admin)
```http
PUT /api/property-workflow/:id/unpublish
```
**Request Body:**
```json
{
  "workflow_status": "wait_to_fix",
  "note": "Need to update pricing"
}
```

#### Get Workflow History
```http
GET /api/property-workflow/:id/history
```

---

### Property Requests API

#### List Requests
```http
GET /api/property-requests
```
**Query Parameters:**
- `status` - `pending` | `approved` | `rejected`
- `request_type` - `edit` | `delete`
- `page`, `limit` - Pagination

#### Create Edit Request (Agent)
```http
POST /api/property-requests
```
**Request Body:**
```json
{
  "property_id": 123,
  "request_type": "edit",
  "reason": "Need to update price due to market change",
  "requested_changes": {
    "price": 50000,
    "remarks": "Updated pricing for 2025"
  }
}
```

#### Create Delete Request (Agent)
```http
POST /api/property-requests
```
**Request Body:**
```json
{
  "property_id": 123,
  "request_type": "delete",
  "reason": "Property is no longer available"
}
```

#### Process Request (Admin)
```http
PUT /api/property-requests/:id/process
```
**Request Body:**
```json
{
  "action": "approve",
  "admin_response": "Approved. Changes applied."
}
```
or
```json
{
  "action": "reject",
  "admin_response": "Please provide more details about the price change."
}
```

#### Get Request Detail
```http
GET /api/property-requests/:id
```

---

### Property Notes API

#### Get Notes for Property
```http
GET /api/property-notes/:propertyId
```

#### Add Note
```http
POST /api/property-notes/:propertyId
```
**Request Body:**
```json
{
  "content": "I've fixed the issues you mentioned",
  "note_type": "fix_response"
}
```

**Note Types:**
- `general` - General note
- `fix_request` - Admin requesting fix (auto-created)
- `fix_response` - Agent responding to fix request
- `approval` - Approval note
- `rejection` - Rejection note

**Special Behavior:**
- When agent adds `fix_response` note while `workflow_status = 'wait_to_fix'`, status auto-updates to `fixed`
- Admin can create `is_internal: true` notes that agents cannot see

#### Delete Note
```http
DELETE /api/property-notes/:propertyId/:noteId
```
- Admin can delete any note
- Agent can delete own notes within 24 hours

---

## 🗄️ Database Tables

### New Tables

#### `property_requests`
```sql
- id (SERIAL PRIMARY KEY)
- property_id (FK -> properties)
- request_type ('edit' | 'delete')
- status ('pending' | 'approved' | 'rejected')
- requested_by (FK -> users)
- reason (TEXT)
- requested_changes (JSONB)
- admin_response (TEXT)
- processed_by (FK -> users)
- created_at, updated_at, processed_at
```

#### `property_notes`
```sql
- id (SERIAL PRIMARY KEY)
- property_id (FK -> properties)
- request_id (FK -> property_requests, optional)
- author_id (FK -> users)
- note_type (enum)
- content (TEXT)
- is_internal (BOOLEAN)
- created_at
```

#### `workflow_history`
```sql
- id (SERIAL PRIMARY KEY)
- property_id (FK -> properties)
- previous_workflow_status, new_workflow_status
- previous_approval_status, new_approval_status
- changed_by (FK -> users)
- reason (TEXT)
- created_at
```

### Modified Tables

#### `properties` (new column)
```sql
- workflow_status VARCHAR(50) DEFAULT 'pending'
```

---

## 🚀 Running Migration

```bash
# Run the migration
psql -h localhost -U postgres -d your_database -f database/access-control-migration.sql
```

Or use the run-migration script:
```bash
node database/run-migration.js access-control-migration.sql
```

---

## 🧪 Testing

```bash
# Test workflow API
curl -X GET http://localhost:3000/api/property-workflow/pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Test creating a request
curl -X POST http://localhost:3000/api/property-requests \
  -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"property_id": 1, "request_type": "edit", "reason": "Need update", "requested_changes": {"price": 100000}}'
```

---

## 📌 Golden Rules

1. **Agent ไม่สามารถ publish ได้เอง** - ต้องรอ Admin เท่านั้น
2. **ก่อน publish = แก้ได้ / หลัง publish = ต้องขอ Request**
3. **Admin ควบคุม workflow_status และ approve_status**
4. **ทุกการแก้หลัง publish มีร่องรอย (request + note + history)**
