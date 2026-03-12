# 🔍 Root Cause Analysis: Data Inconsistency ยังเกิดซ้ำ

## 🚨 ปัญหาที่พบ

**อาการ:** หลังแก้ไข database แล้ว พอ agent submit pending_edit อีกครั้ง ปัญหาก็เกิดซ้ำ
- Property: `moderation_status = 'pending_edit'`
- Version: `status = 'draft'` (ไม่เปลี่ยนเป็น `'pending'`)

**ผลกระทบ:** Admin ไม่สามารถ approve/reject ได้ → Error "No pending version found"

---

## ✅ Backend Code ถูกต้องแล้ว

### Code ที่ตรวจสอบ: `PUT /api/property-versions/version/:versionId/submit`

```javascript
// @property-versions.js:351-364

// 1. เปลี่ยน version status เป็น pending ✅
await client.query(
    `UPDATE property_versions SET status = 'pending', updated_at = NOW() WHERE id = $1`,
    [versionId]
);

// 2. เปลี่ยน property moderation_status ✅
const pubStatus = version.publication_status;
const newModStatus = pubStatus === 'published' ? 'pending_edit' : 'pending_add';

await client.query(
    `UPDATE properties SET moderation_status = $1, updated_at = NOW() WHERE id = $2`,
    [newModStatus, version.property_id]
);
```

**Backend ทำงานถูกต้อง:**
- ✅ เปลี่ยน version `status = 'pending'`
- ✅ เปลี่ยน property `moderation_status = 'pending_edit'`
- ✅ ทำใน transaction (COMMIT ทั้งคู่พร้อมกัน)

---

## 🐛 ต้นเหตุที่แท้จริง: Frontend ไม่ได้เรียก `versionApi.submit()`

### Scenario ที่ทำให้เกิดปัญหา:

```
1. Agent กด "Request Edit"
   → Frontend เรียก versionApi.requestEdit()
   → Backend สร้าง version (status = 'draft')
   → Property moderation_status = 'none' (ยังไม่เปลี่ยน)

2. Agent แก้ไขข้อมูล
   → Frontend เรียก versionApi.update()
   → Version version_data ถูกแก้ไข
   → Version status = 'draft' (ยังไม่เปลี่ยน)

3. Agent กด "Submit for Review" ❌ แต่ Frontend ไม่ได้เรียก versionApi.submit()
   → แทนที่จะเรียก versionApi.submit(versionId)
   → Frontend เรียก propertiesApi.update() หรือ workflowApi.submit()
   → Property moderation_status เปลี่ยนเป็น 'pending_edit' ผิดพลาด
   → Version status ยังเป็น 'draft' (ไม่เปลี่ยน)

4. ผลลัพธ์:
   → Property: moderation_status = 'pending_edit' ✅
   → Version: status = 'draft' ❌ (ควรเป็น 'pending')
   → Data inconsistency!
```

---

## 🔍 วิธีตรวจสอบว่า Frontend เรียก API ผิด

### Test Case:

```bash
# 1. Agent request edit
POST /api/property-versions/{propertyId}/request-edit
→ สร้าง version (status = 'draft')

# 2. Agent update version
PUT /api/property-versions/version/{versionId}
→ แก้ไข version_data

# 3. Agent submit version (ต้องเรียก API นี้!)
PUT /api/property-versions/version/{versionId}/submit
→ version status = 'pending'
→ property moderation_status = 'pending_edit'
```

### ตรวจสอบ Network Tab:

เมื่อ agent กด "Submit for Review" ควรเห็น:
```
✅ PUT /api/property-versions/version/{versionId}/submit
```

ถ้าเห็น:
```
❌ PUT /api/properties/{id}
❌ PUT /api/property-workflow/{id}/submit
```
= Frontend เรียก API ผิด!

---

## 🔧 วิธีแก้ที่ถูกต้อง

### Frontend ต้องแก้ไข:

```javascript
// ❌ WRONG - ทำให้เกิด data inconsistency
const handleSubmitForReview = async () => {
  // ผิด: เรียก workflowApi.submit() หรือ propertiesApi.update()
  await workflowApi.submit(propertyId);  // ❌
  // หรือ
  await propertiesApi.update(propertyId, { 
    moderation_status: 'pending_edit'  // ❌ อันตราย!
  });
};

// ✅ CORRECT - ใช้ versionApi.submit()
const handleSubmitForReview = async () => {
  // ถูกต้อง: เรียก versionApi.submit()
  await versionApi.submit(versionId);  // ✅
  // Backend จะเปลี่ยนทั้ง version status และ property moderation_status
};
```

---

## 🎯 Frontend Implementation Guide

### ตรวจสอบว่าควรใช้ API ไหน:

```javascript
const handleSubmit = async (property, formData) => {
  const { publication_status, moderation_status } = property;
  
  // Case 1: Draft/Unpublished property (ไม่ใช้ version system)
  if (['draft', 'unpublished'].includes(publication_status)) {
    // แก้ไข property โดยตรง
    await propertiesApi.update(property.id, formData);
    
    // Submit for review
    await workflowApi.submit(property.id);
    return;
  }
  
  // Case 2: Published property (ต้องใช้ version system)
  if (publication_status === 'published') {
    // 1. Request edit (ถ้ายังไม่มี draft version)
    let version = await versionApi.getLatest(property.id);
    if (!version || version.status !== 'draft') {
      const res = await versionApi.requestEdit(property.id);
      version = res.data.data;
    }
    
    // 2. Update version
    await versionApi.update(version.id, { updates: formData });
    
    // 3. Submit version (สำคัญ!)
    await versionApi.submit(version.id);  // ✅ ต้องเรียก API นี้!
    return;
  }
};
```

---

## 🛡️ Backend Validation (แนะนำให้เพิ่ม)

### ป้องกันการเปลี่ยน moderation_status โดยตรง:

```javascript
// ใน propertiesApi.update() ควรเพิ่ม validation:

router.put('/:id', authenticate, authorize(['admin', 'agent']), async (req, res) => {
  const data = req.body;
  
  // ป้องกัน agent เปลี่ยน moderation_status โดยตรง
  if (req.user.role === 'agent') {
    if (data.moderation_status) {
      return res.status(403).json({
        success: false,
        error: 'Agents cannot change moderation_status directly. Use workflow APIs instead.'
      });
    }
  }
  
  // ... rest of update logic
});
```

---

## 📊 Comparison: ถูก vs ผิด

### ❌ ทำให้เกิด Data Inconsistency:

```javascript
// Agent submit published property for review
const handleSubmit = async () => {
  // 1. Update property
  await propertiesApi.update(propertyId, formData);
  
  // 2. Submit property (ผิด!)
  await workflowApi.submit(propertyId);
  // หรือ
  await propertiesApi.update(propertyId, {
    moderation_status: 'pending_edit'  // อันตราย!
  });
  
  // ผลลัพธ์:
  // - property.moderation_status = 'pending_edit' ✅
  // - version.status = 'draft' ❌ (ไม่เปลี่ยน)
  // = Data inconsistency!
};
```

### ✅ ถูกต้อง:

```javascript
// Agent submit published property for review
const handleSubmit = async () => {
  // 1. Request edit (create draft version)
  const version = await versionApi.requestEdit(propertyId);
  
  // 2. Update version
  await versionApi.update(version.id, { updates: formData });
  
  // 3. Submit version (สำคัญ!)
  await versionApi.submit(version.id);
  
  // ผลลัพธ์:
  // - property.moderation_status = 'pending_edit' ✅
  // - version.status = 'pending' ✅
  // = ถูกต้อง!
};
```

---

## 🔍 วิธีตรวจสอบว่า Frontend ทำถูกหรือไม่

### Test Steps:

1. **Agent request edit published property**
   ```
   Network Tab ควรเห็น:
   POST /api/property-versions/{propertyId}/request-edit ✅
   ```

2. **Agent update version**
   ```
   Network Tab ควรเห็น:
   PUT /api/property-versions/version/{versionId} ✅
   ```

3. **Agent submit for review**
   ```
   Network Tab ควรเห็น:
   PUT /api/property-versions/version/{versionId}/submit ✅
   
   ถ้าเห็น:
   PUT /api/property-workflow/{id}/submit ❌ ผิด!
   PUT /api/properties/{id} ❌ ผิด!
   ```

4. **Check database**
   ```sql
   SELECT 
     p.property_id,
     p.moderation_status,
     pv.status as version_status
   FROM properties p
   JOIN property_versions pv ON p.id = pv.property_id
   WHERE p.property_id = 'AT64R'
   ORDER BY pv.version_number DESC LIMIT 1;
   
   Expected:
   moderation_status | version_status
   ------------------+----------------
   pending_edit      | pending        ✅
   
   Wrong:
   moderation_status | version_status
   ------------------+----------------
   pending_edit      | draft          ❌
   ```

---

## 🎯 สรุป

### ต้นเหตุที่แท้จริง:
**Frontend ไม่ได้เรียก `versionApi.submit(versionId)`**

### ผลกระทบ:
- Property `moderation_status` เปลี่ยนเป็น `'pending_edit'`
- Version `status` ยังเป็น `'draft'` (ไม่เปลี่ยน)
- Data inconsistency → Admin ไม่สามารถ approve/reject ได้

### วิธีแก้:
1. ✅ **Frontend:** เรียก `versionApi.submit(versionId)` เมื่อ submit published property
2. ✅ **Backend:** เพิ่ม validation ป้องกันการเปลี่ยน `moderation_status` โดยตรง (optional)

### การแก้ database เป็นแค่:
❌ **แก้ที่ปลายเหตุ** - แก้ผลลัพธ์ที่เกิดขึ้นแล้ว  
✅ **ต้องแก้ที่ต้นเหตุ** - แก้ไข Frontend ให้เรียก API ที่ถูกต้อง

---

## 📝 Action Items

### สำหรับ Frontend Team:

1. **ตรวจสอบ code ที่จัดการ "Submit for Review"**
   - หา function ที่ถูกเรียกเมื่อกด submit button
   - ตรวจสอบว่าเรียก API ไหน

2. **แก้ไขให้เรียก `versionApi.submit(versionId)`**
   - สำหรับ published properties เท่านั้น
   - Draft/unpublished ใช้ `workflowApi.submit(propertyId)` ตามเดิม

3. **ทดสอบ:**
   - Request edit published property
   - Update version
   - Submit for review
   - Check Network Tab → ต้องเห็น `PUT /api/property-versions/version/{versionId}/submit`
   - Check database → version status ต้องเป็น `'pending'`

### สำหรับ Backend Team (Optional):

1. **เพิ่ม validation ใน `propertiesApi.update()`**
   - ป้องกัน agent เปลี่ยน `moderation_status` โดยตรง
   - Force ให้ใช้ workflow APIs

2. **เพิ่ม logging**
   - Log เมื่อมีการเปลี่ยน `moderation_status`
   - ช่วยตรวจสอบว่า API ไหนถูกเรียก

---

**ปัญหาจะหายถาวรเมื่อ Frontend เรียก API ที่ถูกต้อง!**
