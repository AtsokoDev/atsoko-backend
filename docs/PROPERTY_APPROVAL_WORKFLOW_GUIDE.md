# 🔄 Property Approval Workflow Guide

## คำตอบสำหรับคำถามของคุณ

### ✅ คำตอบโดยตรง

**Q: สำหรับ `pending_add` ควรใช้ API endpoint ไหน?**

**A: ใช้ `PUT /api/property-workflow/{propertyId}/publish`** ✅

**เหตุผล:**
- `pending_add` = property ใหม่ที่ยังไม่เคย published
- ข้อมูลอยู่ใน `properties` table แล้ว (ไม่ใช่แค่ version)
- `workflowApi.publish` จะ publish property โดยตรงและ mark versions เป็น approved
- `versionApi.approve` ใช้สำหรับ `pending_edit` เท่านั้น (แก้ไข property ที่ published แล้ว)

---

## 🎯 ความแตกต่างระหว่าง 2 Endpoints

### 1. `PUT /api/property-workflow/{propertyId}/publish`

**ใช้สำหรับ:**
- ✅ `pending_add` - property ใหม่ที่ agent submit มา
- ✅ `pending_add` (resubmission) - property ที่ถูก reject แล้ว submit ใหม่

**ทำอะไร:**
1. เปลี่ยน `publication_status` → `'published'`
2. เปลี่ยน `moderation_status` → `'none'`
3. Mark **ทุก pending versions** เป็น `'approved'` และ `is_live = true`
4. Archive versions เก่า
5. บันทึก workflow history
6. เพิ่ม approval note

**Code location:** `@/home/phu/Desktop/atsoko-backend/routes/property-workflow.js:182-279`

```javascript
// Simplified logic
await client.query(
    `UPDATE properties 
     SET publication_status = 'published', moderation_status = 'none'
     WHERE id = $1`,
    [id]
);

await client.query(
    `UPDATE property_versions 
     SET status = 'approved', is_live = true
     WHERE property_id = $1 AND status = 'pending'`,
    [id]
);
```

---

### 2. `PUT /api/property-versions/version/{versionId}/approve`

**ใช้สำหรับ:**
- ✅ `pending_edit` - แก้ไข property ที่ published แล้ว
- ❌ **ไม่ใช้สำหรับ** `pending_add`

**ทำอะไร:**
1. Archive current live version
2. Mark approved version เป็น `is_live = true`, `status = 'approved'`
3. **Apply version data** ไปที่ `properties` table (overwrite ข้อมูลเดิม)
4. เปลี่ยน `publication_status` → `'published'`
5. เปลี่ยน `moderation_status` → `'none'`
6. Discard versions อื่นๆ
7. Auto-regenerate titles
8. บันทึก workflow history

**Code location:** `@/home/phu/Desktop/atsoko-backend/routes/property-versions.js:458-629`

```javascript
// Simplified logic - สำคัญ: มีการ APPLY VERSION DATA
const versionData = version.version_data;
const { setClauses, params } = buildApplyVersionQuery(versionData);

await client.query(
    `UPDATE properties SET ${setClauses.join(', ')} WHERE id = $1`,
    params
);
```

---

## 🔍 ทำไม `versionApi.approve` ถึง Error สำหรับ `pending_add`?

### สาเหตุที่เป็นไปได้:

#### 1. **Version ไม่มี status = 'pending'** (สาเหตุหลัก)

```javascript
// @property-versions.js:483-489
if (version.status !== 'pending') {
    return res.status(400).json({
        error: `Cannot approve version with status '${version.status}'`
    });
}
```

**การตรวจสอบ:**
```sql
SELECT id, property_id, version_number, status, is_live 
FROM property_versions 
WHERE id = 69;
```

**ถ้า status เป็น:**
- `'approved'` = version นี้ approve ไปแล้ว
- `'archived'` = version เก่าที่ถูก archive
- `'discarded'` = version ถูกยกเลิก

#### 2. **Property ถูก approve ไปแล้วโดย `workflowApi.publish`**

จากการตรวจสอบ Property ID 5654:
```
publication_status = 'published'
moderation_status = 'none'
```

**หมายความว่า:** Property นี้ถูก approve ไปแล้ว!

เมื่อใช้ `workflowApi.publish`:
```javascript
// @property-workflow.js:228-232
await client.query(
    `UPDATE property_versions 
     SET status = 'approved', is_live = true
     WHERE property_id = $1 AND status = 'pending'`,
    [id]
);
```

Version ID 69 ถูกเปลี่ยนเป็น `status = 'approved'` แล้ว → ไม่สามารถ approve อีกครั้งได้

---

## 📊 Decision Tree: ใช้ API ไหน?

```
Property Status?
│
├─ moderation_status = 'pending_add'
│  └─ ใช้: workflowApi.publish(propertyId)
│     ✅ Correct endpoint
│
├─ moderation_status = 'pending_edit'
│  └─ ใช้: versionApi.approve(versionId)
│     ✅ Correct endpoint
│
├─ moderation_status = 'pending_delete'
│  └─ ใช้: propertiesApi.delete(propertyId)
│     (soft delete)
│
└─ moderation_status = 'none'
   └─ ❌ Nothing to approve
```

---

## 🎓 Version Lifecycle

### Scenario 1: New Property (pending_add)

```
1. Agent creates draft property
   └─ publication_status = 'draft'
   └─ moderation_status = 'none'

2. Agent submits for review
   └─ workflowApi.submit(propertyId)
   └─ moderation_status = 'pending_add'
   └─ Creates version with status = 'pending'

3. Admin approves
   └─ workflowApi.publish(propertyId) ✅
   └─ publication_status = 'published'
   └─ moderation_status = 'none'
   └─ Version status = 'approved', is_live = true
```

### Scenario 2: Edit Published Property (pending_edit)

```
1. Property is published
   └─ publication_status = 'published'
   └─ moderation_status = 'none'

2. Agent requests edit
   └─ versionApi.requestEdit(propertyId)
   └─ Creates new version from live data
   └─ Version status = 'pending'

3. Agent edits version
   └─ versionApi.update(versionId, changes)
   └─ Version version_data updated

4. Agent submits version
   └─ versionApi.submit(versionId)
   └─ moderation_status = 'pending_edit'

5. Admin approves
   └─ versionApi.approve(versionId) ✅
   └─ Applies version_data to properties table
   └─ moderation_status = 'none'
   └─ Version status = 'approved', is_live = true
```

### Scenario 3: Rejected and Resubmit

```
1. Admin rejects pending_add
   └─ versionApi.reject(versionId, { action: 'return' })
   └─ moderation_status = 'rejected_add'
   └─ Version status = 'rejected'

2. Agent fixes issues
   └─ propertiesApi.update(propertyId, fixes)
   └─ (edits property directly, not version)

3. Agent resubmits
   └─ workflowApi.submit(propertyId)
   └─ moderation_status = 'pending_add'
   └─ Creates NEW version with status = 'pending'

4. Admin approves
   └─ workflowApi.publish(propertyId) ✅
   └─ publication_status = 'published'
   └─ moderation_status = 'none'
```

---

## 💻 Frontend Implementation Guide

### ✅ Correct Implementation

```typescript
// types.ts
type ModerationStatus = 
  | 'none'
  | 'pending_add' 
  | 'pending_edit' 
  | 'pending_delete'
  | 'rejected_add'
  | 'rejected_edit'
  | 'rejected_delete';

interface Property {
  id: number;
  property_id: string;
  publication_status: 'draft' | 'published' | 'unpublished' | 'deleted';
  moderation_status: ModerationStatus;
}

// approval.service.ts
export const approveProperty = async (
  property: Property,
  versionId?: number
) => {
  const { id, moderation_status } = property;

  switch (moderation_status) {
    case 'pending_add':
      // New property submission
      return workflowApi.publish(id);

    case 'pending_edit':
      // Edit to published property
      if (!versionId) {
        throw new Error('versionId required for pending_edit');
      }
      return versionApi.approve(versionId);

    case 'pending_delete':
      // Soft delete request
      return propertiesApi.delete(id);

    default:
      throw new Error(`Cannot approve property with status: ${moderation_status}`);
  }
};
```

### ❌ Wrong Implementation (Your Current Code)

```typescript
// ❌ Don't do this
const handleApprove = async () => {
  if (pendingVersion) {
    // This will fail for pending_add!
    await versionApi.approve(pendingVersion.id);
  }
};
```

### ✅ Correct Implementation

```typescript
// ✅ Do this instead
const handleApprove = async () => {
  const { moderation_status } = property;

  if (moderation_status === 'pending_add') {
    // Use workflow API for new properties
    await workflowApi.publish(property.id);
  } else if (moderation_status === 'pending_edit' && pendingVersion) {
    // Use version API for edits
    await versionApi.approve(pendingVersion.id);
  } else {
    throw new Error('Invalid approval state');
  }
};
```

---

## 🔧 Debugging Your Specific Case

### Test Case: Property ID 5654, Version ID 69

**Current State:**
```sql
-- Property
SELECT id, property_id, publication_status, moderation_status 
FROM properties WHERE id = 5654;
-- Result: published, none

-- Version
SELECT id, version_number, status, is_live 
FROM property_versions WHERE id = 69;
-- Likely: status = 'approved' (already approved)
```

**What Happened:**
1. Agent submitted property → `moderation_status = 'pending_add'`
2. Version created → `status = 'pending'`
3. Admin used `workflowApi.publish(5654)` ✅
4. Property → `publication_status = 'published'`, `moderation_status = 'none'`
5. Version → `status = 'approved'`, `is_live = true`
6. Later tried `versionApi.approve(69)` ❌
7. Error: "Cannot approve version with status 'approved'"

**Solution:**
- Property is already approved ✅
- No action needed
- Frontend should show "Approved" status, not "Approve" button

---

## 📝 Summary Table

| Scenario | moderation_status | Correct API | Wrong API |
|----------|------------------|-------------|-----------|
| New property submission | `pending_add` | `workflowApi.publish(propertyId)` | ❌ `versionApi.approve(versionId)` |
| Resubmit after rejection | `pending_add` | `workflowApi.publish(propertyId)` | ❌ `versionApi.approve(versionId)` |
| Edit published property | `pending_edit` | `versionApi.approve(versionId)` | ❌ `workflowApi.publish(propertyId)` |
| Delete request | `pending_delete` | `propertiesApi.delete(propertyId)` | - |

---

## ✅ Action Items for Frontend Team

### 1. Fix Approval Logic

```typescript
// Before
const approve = () => versionApi.approve(versionId);

// After
const approve = () => {
  if (property.moderation_status === 'pending_add') {
    return workflowApi.publish(property.id);
  } else if (property.moderation_status === 'pending_edit') {
    return versionApi.approve(versionId);
  }
};
```

### 2. Add Status Checks

```typescript
const canApprove = (property: Property) => {
  return ['pending_add', 'pending_edit', 'pending_delete'].includes(
    property.moderation_status
  );
};
```

### 3. Handle Already Approved

```typescript
if (property.moderation_status === 'none' && 
    property.publication_status === 'published') {
  // Already approved - show success message
  return <Badge>Approved</Badge>;
}
```

---

## 🆘 Error Handling

```typescript
try {
  await approveProperty(property, versionId);
} catch (error) {
  if (error.message.includes("Cannot approve version with status")) {
    // Version already approved
    toast.error('This property has already been approved');
    // Refresh property data
    refetch();
  } else if (error.message.includes("Version not found")) {
    // Version doesn't exist
    toast.error('Version not found. Property may have been approved already.');
  } else {
    toast.error('Failed to approve property');
  }
}
```

---

## 🎯 คำตอบสำหรับคำถามทั้งหมด

### a) สำหรับ pending_add ควรใช้ endpoint ไหน?
**→ `workflowApi.publish(propertyId)`** ✅

### b) ความแตกต่างระหว่าง 2 endpoints?
- **publish**: Approve property โดยตรง (สำหรับ pending_add)
- **approve**: Apply version changes (สำหรับ pending_edit)

### c) มี scenario ไหนที่ต้องใช้ versionApi.approve?
**→ `pending_edit` เท่านั้น** (แก้ไข property ที่ published แล้ว)

### d) pending_edit กับ pending_add ควรใช้ logic เดียวกันหรือต่างกัน?
**→ ต่างกัน!**
- `pending_add` → `workflowApi.publish`
- `pending_edit` → `versionApi.approve`

### Error ที่เกิดขึ้นเป็น bug หรือ expected?
**→ Expected behavior** ✅
- Version ถูก approve ไปแล้วโดย `workflowApi.publish`
- ไม่สามารถ approve ซ้ำได้
- Frontend ควรตรวจสอบ status ก่อนแสดงปุ่ม Approve
