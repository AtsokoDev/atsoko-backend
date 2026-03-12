# 🔄 Version Workflow & Status Flow - คู่มือฉบับเข้าใจง่าย

## 🎯 สรุปสั้นๆ ก่อน

**คำถาม:** ทำไม admin edit property แล้วสร้าง draft version แต่ approve ไม่ได้?

**คำตอบ:** เพราะ **admin ไม่ได้ใช้ version system** - admin edit property โดยตรง ไม่ผ่าน version!

---

## 📊 2 Workflows ที่แตกต่างกัน

### Workflow 1: **New Property (pending_add)** - ไม่ใช้ Version System

```
Agent Creates Property
    ↓
publication_status = 'draft'
moderation_status = 'none'
    ↓
Agent Submits (workflowApi.submit)
    ↓
moderation_status = 'pending_add'
+ สร้าง version snapshot (status = 'pending')
    ↓
Admin Approves (workflowApi.publish)
    ↓
publication_status = 'published'
moderation_status = 'none'
version status = 'approved'
```

**Key Point:** Version ถูกสร้างเพื่อ **เก็บ snapshot** เท่านั้น ไม่ได้ใช้แก้ไข

---

### Workflow 2: **Edit Published Property (pending_edit)** - ใช้ Version System

```
Property is Published
    ↓
Agent Requests Edit (versionApi.requestEdit)
    ↓
สร้าง version ใหม่
version_data = copy จาก live property
version status = 'draft'
property moderation_status = 'none' (ยังไม่เปลี่ยน)
    ↓
Agent Edits Version (versionApi.update)
    ↓
version_data ถูกแก้ไข
version status = 'draft' (ยังเป็น draft)
    ↓
Agent Submits Version (versionApi.submit)
    ↓
version status = 'pending'
property moderation_status = 'pending_edit'
    ↓
Admin Approves Version (versionApi.approve)
    ↓
version_data ถูก apply ไปที่ property
version status = 'approved'
property moderation_status = 'none'
```

**Key Point:** Version ใช้สำหรับ **แก้ไข property ที่ published แล้ว** โดยไม่กระทบ live data

---

## 🔑 ความแตกต่างหลัก

| | pending_add | pending_edit |
|---|-------------|--------------|
| **Property Status** | `draft` หรือ `unpublished` | `published` |
| **ใครแก้** | แก้ property โดยตรง | แก้ version |
| **Version Role** | เก็บ snapshot | ใช้แก้ไขจริง |
| **Submit API** | `workflowApi.submit(propertyId)` | `versionApi.submit(versionId)` |
| **Approve API** | `workflowApi.publish(propertyId)` | `versionApi.approve(versionId)` |

---

## 🚨 ปัญหาที่เกิดขึ้น: "Admin Edit แล้วสร้าง Draft Version"

### ❌ Scenario ที่ผิด

```
Property is Published
    ↓
Admin กด "Edit" ในหน้า property detail
    ↓
Frontend เรียก versionApi.requestEdit()  ❌ ผิด!
    ↓
สร้าง version (status = 'draft')
    ↓
Admin แก้ไขข้อมูล
    ↓
Admin กด "Save"
    ↓
Frontend เรียก versionApi.update()  ❌ ผิด!
    ↓
version ยังเป็น draft
    ↓
Admin กด "Approve"
    ↓
Frontend เรียก versionApi.approve()  ❌ ผิด!
    ↓
Backend Error: "Cannot approve version with status 'draft'"
```

**ปัญหา:** Admin ไม่ควรใช้ version system เลย!

---

### ✅ Scenario ที่ถูกต้อง

#### สำหรับ Admin:

```
Property is Published
    ↓
Admin กด "Edit"
    ↓
Frontend เรียก propertiesApi.update()  ✅ ถูกต้อง!
    ↓
แก้ไข property โดยตรง (ไม่ผ่าน version)
    ↓
Live property ถูกแก้ไขทันที
    ↓
ไม่ต้อง approve อะไร (admin มีสิทธิ์แก้โดยตรง)
```

#### สำหรับ Agent:

```
Property is Published
    ↓
Agent กด "Request Edit"
    ↓
Frontend เรียก versionApi.requestEdit()  ✅ ถูกต้อง!
    ↓
สร้าง version (status = 'draft')
    ↓
Agent แก้ไขข้อมูล
    ↓
Agent กด "Save Draft"
    ↓
Frontend เรียก versionApi.update()  ✅ ถูกต้อง!
    ↓
version ยังเป็น draft (ยังไม่ส่ง admin)
    ↓
Agent กด "Submit for Review"
    ↓
Frontend เรียก versionApi.submit()  ✅ ถูกต้อง!
    ↓
version status = 'pending'
property moderation_status = 'pending_edit'
    ↓
Admin กด "Approve"
    ↓
Frontend เรียก versionApi.approve()  ✅ ถูกต้อง!
    ↓
version status = 'approved'
property ถูก update ด้วย version_data
```

---

## 📋 Version Status Flow (สำหรับ Agent)

```
draft
  ↓ (agent submit version)
pending
  ↓ (admin approve)
approved
```

```
draft
  ↓ (admin reject)
rejected
  ↓ (agent fix and resubmit)
pending
  ↓ (admin approve)
approved
```

```
draft
  ↓ (agent cancel)
discarded
```

---

## 🎭 Role-Based Workflows

### Admin Workflow (ไม่ใช้ Version System)

#### Create New Property
```
POST /api/properties
→ publication_status = 'published' (auto-publish)
→ moderation_status = 'none'
```

#### Edit Published Property
```
PUT /api/properties/{id}
→ แก้ไข property โดยตรง
→ ไม่ต้อง approve
→ ไม่สร้าง version
```

#### Delete Property
```
DELETE /api/properties/{id}
→ soft delete (publication_status = 'deleted')
```

---

### Agent Workflow (ใช้ Version System สำหรับ Published Properties)

#### Create New Property
```
1. POST /api/properties
   → publication_status = 'draft'
   → moderation_status = 'none'

2. PUT /api/property-workflow/{id}/submit
   → moderation_status = 'pending_add'
   → สร้าง version snapshot (status = 'pending')

3. Admin: PUT /api/property-workflow/{id}/publish
   → publication_status = 'published'
   → moderation_status = 'none'
```

#### Edit Draft Property (ยังไม่ published)
```
PUT /api/properties/{id}
→ แก้ไข property โดยตรง
→ ไม่ต้องใช้ version
```

#### Edit Published Property (ต้องใช้ Version System)
```
1. POST /api/property-versions/{propertyId}/request-edit
   → สร้าง version (status = 'draft')
   → copy property data → version_data

2. PUT /api/property-versions/version/{versionId}
   → แก้ไข version_data
   → version status = 'draft' (ยังไม่ submit)

3. PUT /api/property-versions/version/{versionId}/submit
   → version status = 'pending'
   → property moderation_status = 'pending_edit'

4. Admin: PUT /api/property-versions/version/{versionId}/approve
   → version_data → apply to property
   → version status = 'approved'
   → property moderation_status = 'none'
```

---

## 🔧 Frontend Implementation Guide

### ตรวจสอบ Role และ Property Status

```javascript
const canEditDirectly = (user, property) => {
  // Admin แก้ไขได้โดยตรงเสมอ
  if (user.role === 'admin') {
    return true;
  }
  
  // Agent แก้ไขได้โดยตรงเฉพาะ draft/unpublished
  if (user.role === 'agent') {
    return ['draft', 'unpublished'].includes(property.publication_status);
  }
  
  return false;
};

const needsVersionSystem = (user, property) => {
  // Agent แก้ไข published property → ต้องใช้ version system
  return user.role === 'agent' && property.publication_status === 'published';
};
```

### Edit Property Logic

```javascript
const handleEdit = async (property) => {
  if (canEditDirectly(user, property)) {
    // แก้ไข property โดยตรง
    await propertiesApi.update(property.id, formData);
    
  } else if (needsVersionSystem(user, property)) {
    // ใช้ version system
    
    // 1. สร้าง version (ถ้ายังไม่มี)
    let version = await versionApi.getLatest(property.id);
    if (!version || version.status !== 'draft') {
      const res = await versionApi.requestEdit(property.id);
      version = res.data.data;
    }
    
    // 2. แก้ไข version
    await versionApi.update(version.id, { updates: formData });
    
    // 3. Submit version (เมื่อพร้อม)
    await versionApi.submit(version.id);
  }
};
```

### Admin Review Page Logic

```javascript
const handleAdminAction = async (property, action) => {
  const modStatus = property.moderation_status;
  
  if (modStatus === 'pending_add') {
    // New property submission
    if (action === 'approve') {
      await workflowApi.publish(property.id);
    } else if (action === 'reject') {
      // Find pending version
      const versions = await versionApi.getAll(property.id);
      const pendingVer = versions.find(v => v.status === 'pending');
      if (pendingVer) {
        await versionApi.reject(pendingVer.id, { action: 'return', note });
      }
    }
    
  } else if (modStatus === 'pending_edit') {
    // Edit request
    // Find pending version (NOT draft!)
    const versions = await versionApi.getAll(property.id);
    const pendingVer = versions.find(v => v.status === 'pending');
    
    if (!pendingVer) {
      throw new Error('No pending version found');
    }
    
    if (action === 'approve') {
      await versionApi.approve(pendingVer.id);
    } else if (action === 'reject') {
      await versionApi.reject(pendingVer.id, { action: 'return', note });
    }
  }
};
```

---

## 🐛 Common Bugs & Fixes

### Bug 1: "Cannot approve version with status 'draft'"

**สาเหตุ:** Frontend โหลด draft version แทน pending version

```javascript
// ❌ Wrong
const version = await versionApi.getLatest(propertyId);
await versionApi.approve(version.id); // Error if version is draft!

// ✅ Correct
const versions = await versionApi.getAll(propertyId);
const pendingVer = versions.find(v => v.status === 'pending');
if (pendingVer) {
  await versionApi.approve(pendingVer.id);
}
```

---

### Bug 2: Admin สร้าง Draft Version แทนแก้ไข Property โดยตรง

**สาเหตุ:** Frontend ใช้ version system สำหรับ admin

```javascript
// ❌ Wrong - Admin shouldn't use version system
if (user.role === 'admin') {
  await versionApi.requestEdit(propertyId); // Wrong!
}

// ✅ Correct - Admin edits directly
if (user.role === 'admin') {
  await propertiesApi.update(propertyId, formData);
}
```

---

### Bug 3: Agent แก้ไข Published Property โดยตรง

**สาเหตุ:** Frontend ไม่ใช้ version system

```javascript
// ❌ Wrong - Agent editing published property directly
if (property.publication_status === 'published') {
  await propertiesApi.update(propertyId, formData); // Wrong!
}

// ✅ Correct - Use version system
if (property.publication_status === 'published') {
  const version = await versionApi.requestEdit(propertyId);
  await versionApi.update(version.id, { updates: formData });
  await versionApi.submit(version.id);
}
```

---

## 📊 Decision Tree: Which API to Use?

```
Who is editing?
│
├─ ADMIN
│  │
│  ├─ Creating new property?
│  │  └─ POST /api/properties (auto-published)
│  │
│  ├─ Editing any property?
│  │  └─ PUT /api/properties/{id} (direct edit)
│  │
│  └─ Reviewing agent submission?
│     ├─ pending_add → PUT /api/property-workflow/{id}/publish
│     └─ pending_edit → PUT /api/property-versions/version/{versionId}/approve
│
└─ AGENT
   │
   ├─ Creating new property?
   │  ├─ POST /api/properties (creates draft)
   │  └─ PUT /api/property-workflow/{id}/submit
   │
   ├─ Editing draft/unpublished?
   │  └─ PUT /api/properties/{id} (direct edit)
   │
   └─ Editing published property?
      ├─ POST /api/property-versions/{propertyId}/request-edit
      ├─ PUT /api/property-versions/version/{versionId}
      └─ PUT /api/property-versions/version/{versionId}/submit
```

---

## 🎯 สรุปสำคัญ

### 1. **Admin ไม่ใช้ Version System**
- Admin แก้ไข property โดยตรงเสมอ
- ไม่ต้อง submit, ไม่ต้อง approve
- ไม่สร้าง version

### 2. **Agent ใช้ Version System เฉพาะ Published Properties**
- Draft/Unpublished → แก้ไขโดยตรง
- Published → ต้องใช้ version system

### 3. **Version Status Flow**
- `draft` = agent กำลังแก้ไขอยู่ (ยังไม่ submit)
- `pending` = agent submit แล้ว รอ admin review
- `approved` = admin approve แล้ว
- `rejected` = admin reject แล้ว

### 4. **Approve/Reject ได้เฉพาะ Pending Version**
- ไม่สามารถ approve/reject draft version ได้
- Frontend ต้องหา pending version โดยตรง

### 5. **pending_add vs pending_edit**
- `pending_add` = property ใหม่ → ใช้ `workflowApi.publish`
- `pending_edit` = แก้ไข published → ใช้ `versionApi.approve`

---

## 🔍 Debugging Checklist

เมื่อเจอปัญหา version workflow:

- [ ] User role คืออะไร? (admin หรือ agent)
- [ ] Property publication_status คืออะไร? (draft, published, unpublished)
- [ ] Property moderation_status คืออะไร? (none, pending_add, pending_edit)
- [ ] Version status คืออะไร? (draft, pending, approved, rejected)
- [ ] Frontend เรียก API ไหน? (properties, workflow, version)
- [ ] Admin ควรแก้ไข property โดยตรงหรือไม่?
- [ ] Agent ควรใช้ version system หรือไม่?

---

**Last Updated:** 2026-03-12  
**Backend Version:** Property Workflow + Version System v2
