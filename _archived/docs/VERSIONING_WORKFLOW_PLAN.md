# Versioning & Workflow System — Implementation Plan

> วันที่สร้าง: 2 มีนาคม 2026
> สถานะ: Implementation Ready

---

## สารบัญ

1. [เปรียบเทียบระบบเดิม vs ระบบใหม่](#1-เปรียบเทียบระบบเดิม-vs-ระบบใหม่)
2. [State Model ใหม่](#2-state-model-ใหม่)
3. [Database Changes](#3-database-changes)
4. [Workflow Flows](#4-workflow-flows)
5. [API Changes](#5-api-changes)
6. [Permission Model](#6-permission-model)
7. [Frontend Impact](#7-frontend-impact)

---

## 1. เปรียบเทียบระบบเดิม vs ระบบใหม่

### Status Fields

| ด้าน | ระบบเดิม | ระบบใหม่ |
|------|----------|----------|
| Publication | `approve_status` ('pending' / 'published' / 'deleted') | `publication_status` ('draft' / 'published' / 'unpublished' / 'deleted') |
| Moderation | `workflow_status` ('pending' / 'wait_to_fix' / 'fixed' / 'ready_to_publish') | `moderation_status` ('none' / 'pending_add' / 'pending_edit' / 'pending_delete' / 'rejected_add' / 'rejected_edit' / 'rejected_delete') |

### Workflow

| Flow | ระบบเดิม | ระบบใหม่ |
|------|----------|----------|
| Agent Add | POST → pending + pending ทันที | POST → draft + none → agent แก้ได้อิสระ → Submit → pending + pending_add |
| Agent Edit Live | ❌ blocked, ต้อง submit request_changes JSON | ✅ สร้าง pending version, แก้ได้ทันที, live ยังโชว์ |
| Admin Review | เห็นแค่ requested_changes JSON ดิบ | เห็น diff: live version vs pending version |
| Return for Revision | เปลี่ยน workflow_status เป็น wait_to_fix | moderation_status = rejected_edit, agent แก้ version เดิมต่อ |
| Revert | ❌ ไม่มี | ✅ สร้าง version ใหม่จาก version เก่า |
| Delete Published | Soft delete (approve_status='deleted') / Unpublish → pending | Request delete → admin เลือก unpublish หรือ soft delete |
| Delete Unpublished | ⚠️ Hard delete ออกจาก DB | ✅ Soft delete ทุกกรณี (deleted_at) |

### Versioning

| ด้าน | ระบบเดิม | ระบบใหม่ |
|------|----------|----------|
| Version History | ❌ ไม่มี (มีแค่ workflow_history สำหรับ status change) | ✅ property_versions table เก็บ snapshot ทุก version |
| Live vs Pending | ใช้ record เดียว ทับกัน | แยก Live Version กับ Pending Version ใน property_versions |
| Diff View | ❌ ไม่มี | ✅ API ส่ง diff structure (field, old, new) |
| Audit Trail | แค่ status change log | Version snapshot + changed_by + reason ทุกครั้ง |

### Permission

| สิทธิ์ | ระบบเดิม | ระบบใหม่ |
|--------|----------|----------|
| Agent แก้ Draft | ✅ (draft ไม่มี แต่ pending แก้ได้) | ✅ Draft + Rejected = แก้ได้อิสระ |
| Agent แก้ Live | ❌ blocked + ส่ง JSON request | ✅ สร้าง pending version, แก้ใน version |
| Admin Edit Live | ✅ แก้ตรง ไม่แจ้ง pending | ✅ แก้ตรง + auto-discard pending versions + log |
| Admin Override | ✅ แก้ได้ แต่ไม่ invalidate pending | ✅ แก้ได้ + invalidate stale pending |
| Audit | workflow_history (status only) | property_versions (full snapshot) + workflow_history |

---

## 2. State Model ใหม่

### publication_status (การแสดงผลต่อสาธารณะ)

```
draft        → ยังไม่เคย publish, agent เตรียมข้อมูล
published    → live บนเว็บ, public เห็น
unpublished  → เคย live แล้ว, ถูกนำออกชั่วคราว
deleted      → soft delete, ซ่อนจากทุกที่
```

### moderation_status (การตรวจอนุมัติ)

```
none             → ไม่มีอะไรรอ review
pending_add      → รอ admin อนุมัติการเพิ่มใหม่
pending_edit     → รอ admin อนุมัติการแก้ไข
pending_delete   → รอ admin อนุมัติการลบ
rejected_add     → admin return for revision (เพิ่มใหม่)
rejected_edit    → admin return for revision (แก้ไข)
rejected_delete  → admin ปฏิเสธการลบ
```

### State Combinations ที่เป็นไปได้

| publication_status | moderation_status | หมายถึง |
|---|---|---|
| draft | none | Agent กำลังเตรียมข้อมูล |
| draft | pending_add | Agent submit แล้ว รอ admin |
| draft | rejected_add | Admin return ให้แก้ |
| published | none | Live ปกติ |
| published | pending_edit | มี pending version รอ review |
| published | pending_delete | รอ admin อนุมัติลบ |
| published | rejected_edit | Agent ถูก return edit |
| published | rejected_delete | Admin ปฏิเสธลบ |
| unpublished | none | เคย live, ถูกนำออก |
| unpublished | pending_add | unpublished ขอ republish |
| deleted | none | Soft deleted |

---

## 3. Database Changes

### 3.1 เพิ่ม columns ใน properties

```sql
ALTER TABLE properties ADD COLUMN publication_status VARCHAR(20) DEFAULT 'draft';
ALTER TABLE properties ADD COLUMN moderation_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE properties ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE properties ADD COLUMN deleted_by INTEGER REFERENCES users(id);
```

### 3.2 สร้าง property_versions table

```sql
CREATE TABLE property_versions (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_data JSONB NOT NULL,          -- snapshot ของ property ทั้ง record
    is_live BOOLEAN DEFAULT false,        -- version นี้เป็น live อยู่ไหม
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'archived', 'discarded'
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_by_role VARCHAR(20),
    reason TEXT,
    admin_note TEXT,
    reverted_from_version INTEGER,        -- ถ้า revert มา อ้างอิง version ต้นทาง
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, version_number)
);
```

### 3.3 เพิ่ม stale tracking ใน property_requests

```sql
ALTER TABLE property_requests ADD COLUMN stale_since TIMESTAMP;
ALTER TABLE property_requests ADD COLUMN live_snapshot_at_request JSONB;
```

### 3.4 Migrate data เก่า

```sql
-- Map approve_status → publication_status
UPDATE properties SET publication_status = 'published' WHERE approve_status = 'published';
UPDATE properties SET publication_status = 'draft' WHERE approve_status = 'pending';
UPDATE properties SET publication_status = 'deleted' WHERE approve_status = 'deleted';

-- Map workflow_status → moderation_status
UPDATE properties SET moderation_status = 'none' WHERE publication_status = 'published';
UPDATE properties SET moderation_status = 'pending_add' WHERE publication_status = 'draft';
UPDATE properties SET moderation_status = 'none' WHERE publication_status = 'deleted';
```

---

## 4. Workflow Flows

### 4.1 Add Property (Agent)

```
1. POST /api/properties
   → publication_status = 'draft'
   → moderation_status = 'none'
   → Agent แก้ได้อิสระ (PUT /api/properties/:id)

2. PUT /api/property-workflow/:id/submit
   → moderation_status = 'pending_add'
   → สร้าง version v1 (snapshot)
   → Lock property จาก agent

3. Admin Review:
   A. Approve & Publish
      → publication_status = 'published'
      → moderation_status = 'none'
      → version v1: is_live = true, status = 'approved'

   B. Return for Revision
      → moderation_status = 'rejected_add'
      → Unlock ให้ agent แก้ได้

   C. Reject Completely
      → publication_status = 'deleted'
      → moderation_status = 'none'
```

### 4.2 Edit Property (Agent แก้ Live)

```
1. POST /api/property-versions/:propertyId/request-edit
   → สร้าง pending version (copy จาก live)
   → moderation_status = 'pending_edit'
   → Live ยังแสดงต่อสาธารณะ

2. PUT /api/property-versions/:versionId
   → Agent แก้ pending version ได้เลย
   → Live version ไม่กระทบ

3. PUT /api/property-versions/:versionId/submit
   → Lock version จาก agent

4. Admin Review:
   A. Approve
      → Apply pending version → live
      → version เก่า: is_live = false, status = 'archived'
      → version ใหม่: is_live = true, status = 'approved'
      → moderation_status = 'none'

   B. Return for Revision
      → moderation_status = 'rejected_edit'
      → Unlock pending version ให้ agent แก้ต่อ

   C. Reject
      → version: status = 'rejected'
      → moderation_status = 'none'
      → Live คงเดิม
```

### 4.3 Delete Property (Agent ลบ Live)

```
1. POST /api/property-requests
   → request_type = 'delete'
   → moderation_status = 'pending_delete'
   → ยัง Live อยู่

2. Admin Review:
   A. Approve & Unpublish (Default)
      → publication_status = 'unpublished'
      → moderation_status = 'none'

   B. Approve & Delete (Hard)
      → publication_status = 'deleted'
      → deleted_at = NOW()

   C. Reject
      → moderation_status = 'none'
      → กลับไป Published ปกติ
```

### 4.4 Admin Direct Actions

```
Admin Add    → publication_status = 'published', moderation_status = 'none' (ทันที)
Admin Edit   → แก้ live ตรงๆ + สร้าง version (archived) + discard pending versions
Admin Delete → soft delete ทันที (publication_status = 'deleted')
Admin Unpublish → publication_status = 'unpublished'
```

---

## 5. API Changes

### APIs ใหม่ทั้งหมด

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | `/api/property-versions/:propertyId/request-edit` | Agent สร้าง pending version จาก live |
| GET | `/api/property-versions/:propertyId` | ดู version history ของ property |
| GET | `/api/property-versions/:propertyId/latest` | ดู pending version ล่าสุด |
| PUT | `/api/property-versions/:versionId` | Agent แก้ pending version |
| PUT | `/api/property-versions/:versionId/submit` | Agent submit version เพื่อ review |
| GET | `/api/property-versions/:versionId/diff` | ดู diff ระหว่าง live กับ pending |
| PUT | `/api/property-versions/:versionId/approve` | Admin approve version |
| PUT | `/api/property-versions/:versionId/reject` | Admin reject/return version |
| PUT | `/api/property-versions/:versionId/revert` | Admin revert ไปเป็น version นี้ |
| PUT | `/api/property-workflow/:id/submit` | Agent submit draft เพื่อ review |

### APIs ที่แก้ไข

| Endpoint | เปลี่ยนแปลง |
|----------|------------|
| `GET /api/properties` | filter ด้วย `publication_status` แทน `approve_status` |
| `GET /api/properties/:id` | เพิ่ม pending_version info ใน response |
| `POST /api/properties` | Agent → draft, Admin → published |
| `PUT /api/properties/:id` | เช็ค publication_status + moderation_status + auto discard stale |
| `DELETE /api/properties/:id` | Soft delete ทุกกรณี |
| `GET /api/property-workflow/pending` | filter ด้วย moderation_status |
| `PUT /api/property-workflow/:id/publish` | ใช้ publication_status |
| `PUT /api/property-workflow/:id/unpublish` | ใช้ publication_status = 'unpublished' |
| `PUT /api/property-requests/:id/process` | Mark stale + snapshot logic |

---

## 6. Permission Model

### canModifyProperty (ใหม่)

```javascript
// Admin: แก้ได้ทุก property ทุก status
// Agent:
//   - Draft + moderation = none/rejected_add → แก้ได้
//   - Unpublished + moderation = none → แก้ได้
//   - Published → ต้อง request edit (สร้าง pending version)
//   - moderation = pending_* → locked, แก้ไม่ได้
```

### canDeleteProperty (ใหม่)

```javascript
// Admin: ลบได้ทุกอัน (soft delete)
// Agent:
//   - Draft → ลบได้ (soft delete)
//   - Unpublished → ลบได้ (soft delete)
//   - Published → ต้อง request delete
```

---

## 7. Frontend Impact — สิ่งที่ Frontend ต้องปรับ

### 7.1 Status Field Migration (สำคัญที่สุด)

**ทุกที่ที่ใช้ `approve_status` ต้องเปลี่ยนเป็น `publication_status`:**

```javascript
// เดิม
if (property.approve_status === 'published') { ... }

// ใหม่
if (property.publication_status === 'published') { ... }
```

**ทุกที่ที่ใช้ `workflow_status` ต้องเปลี่ยนเป็น `moderation_status`:**

```javascript
// เดิม: 'pending', 'wait_to_fix', 'fixed', 'ready_to_publish'
// ใหม่: 'none', 'pending_add', 'pending_edit', 'pending_delete',
//        'rejected_add', 'rejected_edit', 'rejected_delete'
```

### 7.2 Agent UI Changes

**My Listings Page:**

| State | ปุ่มที่ต้องแสดง | Action |
|-------|----------------|--------|
| draft + none | "Edit", "Submit for Review", "Delete" | PUT, PUT /submit, DELETE |
| draft + pending_add | (Read-only) "Pending Review" badge | - |
| draft + rejected_add | "Edit" (fix issues), "Resubmit" | PUT, PUT /submit |
| published + none | "Request Edit", "Request Delete" | POST version, POST request |
| published + pending_edit | "View Pending Changes" (read-only) | GET version |
| published + rejected_edit | "Edit Pending Version" | PUT version |
| unpublished + none | "Edit", "Request Republish", "Delete" | PUT, PUT /submit, DELETE |

**Edit Page:**
- ใช้หน้า edit เดียว
- ถ้า published + pending_edit → โหลด pending version data แทน live data
- ถ้า draft → โหลด property data ตรง
- ถ้า locked (pending_add/pending_edit submitted) → disable fields

### 7.3 Admin UI Changes

**Review Center:**

| Section | Data Source | Filters |
|---------|-----------|---------|
| Pending Add | properties WHERE moderation_status = 'pending_add' | publication_status = 'draft' |
| Pending Edit | property_versions WHERE status = 'pending' | publication_status = 'published' |
| Pending Delete | property_requests WHERE request_type = 'delete' AND status = 'pending' | publication_status = 'published' |

**Review Page (Pending Edit):**
- Split view: Live (ซ้าย) vs Pending Changes (ขวา)
- Highlight diff fields
- API: `GET /api/property-versions/:versionId/diff`
- Response format:
```json
{
  "diff": [
    { "field": "price", "old": 120000, "new": 150000 },
    { "field": "location", "old": "นิคมเดิม", "new": "นิคมใหม่" }
  ],
  "live_version": { ... },
  "pending_version": { ... }
}
```

**Review Page (Pending Add):**
- แสดง property data ทั้งหมด (ไม่มี diff เพราะเป็นของใหม่)
- ปุ่ม: Approve & Publish, Return for Revision, Reject

### 7.4 Filter & Table Changes

**Properties Table Columns:**
```
// เดิม: approve_status, workflow_status
// ใหม่: publication_status, moderation_status

// Filter dropdown values:
publication_status: ['draft', 'published', 'unpublished', 'deleted']
moderation_status: ['none', 'pending_add', 'pending_edit', 'pending_delete',
                    'rejected_add', 'rejected_edit', 'rejected_delete']
```

### 7.5 Badge/Status Display Mapping

```javascript
const PUBLICATION_BADGES = {
  draft: { label: 'Draft', color: 'gray' },
  published: { label: 'Published', color: 'green' },
  unpublished: { label: 'Unpublished', color: 'orange' },
  deleted: { label: 'Deleted', color: 'red' }
};

const MODERATION_BADGES = {
  none: null, // ไม่ต้องแสดง
  pending_add: { label: 'Pending Review', color: 'blue' },
  pending_edit: { label: 'Edit Pending', color: 'blue' },
  pending_delete: { label: 'Delete Pending', color: 'red' },
  rejected_add: { label: 'Revision Required', color: 'yellow' },
  rejected_edit: { label: 'Edit Returned', color: 'yellow' },
  rejected_delete: { label: 'Delete Rejected', color: 'gray' }
};
```

### 7.6 API Call Summary for Frontend

```javascript
// === Agent Actions ===
// Create draft
POST /api/properties  → { publication_status: 'draft', moderation_status: 'none' }

// Edit draft
PUT /api/properties/:id

// Submit draft for review
PUT /api/property-workflow/:id/submit

// Request edit on live
POST /api/property-versions/:propertyId/request-edit

// Edit pending version
PUT /api/property-versions/:versionId

// Submit pending version for review
PUT /api/property-versions/:versionId/submit

// Request delete live
POST /api/property-requests  → { request_type: 'delete' }

// Delete draft/unpublished
DELETE /api/properties/:id

// === Admin Actions ===
// Approve & publish new
PUT /api/property-versions/:versionId/approve

// Approve edit
PUT /api/property-versions/:versionId/approve

// Return for revision
PUT /api/property-versions/:versionId/reject  → { action: 'return' }

// Reject completely
PUT /api/property-versions/:versionId/reject  → { action: 'reject' }

// Direct edit live
PUT /api/properties/:id  (admin สามารถแก้ได้ตรง)

// Process delete request
PUT /api/property-requests/:id/process

// View diff
GET /api/property-versions/:versionId/diff

// View version history
GET /api/property-versions/:propertyId

// Revert to version
PUT /api/property-versions/:versionId/revert
```

---

## Backward Compatibility Note

ระหว่าง transition period เราจะเก็บทั้ง `approve_status` + `publication_status` และ `workflow_status` + `moderation_status` ไว้คู่กัน โดย response จะส่งทั้งสอง field เพื่อให้ frontend migrate ได้ทีละส่วน

```javascript
// Response จะมีทั้ง:
{
  approve_status: 'published',     // legacy (deprecated)
  workflow_status: 'ready_to_publish', // legacy (deprecated)
  publication_status: 'published', // new
  moderation_status: 'none'        // new
}
```
