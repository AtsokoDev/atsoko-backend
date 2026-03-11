# 🔄 Complete Property Workflow Documentation

## Frontend Implementation - Agent to Admin Flow

---

## 📊 Overview

```
Agent Creates → Agent Submits → Admin Reviews → Admin Approves → Published
     ↓              ↓                ↓               ↓              ↓
   Draft      Pending Add      Review Page      Workflow      Live Site
```

---

## 🎯 Scenario 1: New Property Submission (pending_add)

### **Flow Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│ AGENT: Create New Property                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Create Draft Property                                   │
│ Page: /properties/new                                           │
│ API: POST /api/properties                                       │
│ Code: src/app/properties/new/page.js:43                        │
├─────────────────────────────────────────────────────────────────┤
│ const res = await propertiesApi.create(data);                  │
│                                                                  │
│ Result:                                                          │
│ - publication_status = 'draft'                                  │
│ - moderation_status = 'none'                                    │
│ - Property saved in database                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Upload Images (if any)                                  │
│ API: POST /api/upload                                           │
│ Code: src/app/properties/new/page.js:50-96                     │
├─────────────────────────────────────────────────────────────────┤
│ const formData = new FormData();                               │
│ formData.append('property_id', newProperty.id);                │
│ pendingImages.forEach(file => formData.append('images', file));│
│                                                                  │
│ const uploadRes = await uploadApi.uploadImages(formData);      │
│                                                                  │
│ // Update property with image sequence                          │
│ await propertiesApi.update(newProperty.id, {                   │
│     images: finalImages                                         │
│ });                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Submit for Review                                       │
│ API: PUT /api/property-workflow/{id}/submit                    │
│ Code: src/app/properties/new/page.js:115                       │
├─────────────────────────────────────────────────────────────────┤
│ await workflowApi.submit(newProperty.id);                      │
│                                                                  │
│ Backend Actions:                                                 │
│ - moderation_status = 'pending_add'                             │
│ - Creates version with status = 'pending'                       │
│ - Copies property data to version.version_data                  │
│ - Records workflow history                                      │
│                                                                  │
│ Result:                                                          │
│ - Property appears in Admin's "Review Center"                   │
│ - Agent sees "Awaiting Review" status                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ADMIN: Review Property                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Admin Opens Review Page                                 │
│ Page: /pending/{id}                                             │
│ Code: src/app/pending/[id]/page.js:162-237                     │
├─────────────────────────────────────────────────────────────────┤
│ // Load property                                                │
│ const propRes = await propertiesApi.getById(propertyId);       │
│                                                                  │
│ // Load pending version                                         │
│ const versionsRes = await versionApi.getAll(propertyId);       │
│ const pendingVer = versions.find(v => v.status === 'pending'); │
│                                                                  │
│ // Display property form with pending data                      │
│ <PropertyForm                                                   │
│     property={property}                                         │
│     pendingData={pendingVersion?.version_data || property}     │
│ />                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5A: Admin Edits & Updates (Optional)                       │
│ API: PUT /api/property-versions/version/{versionId}            │
│ Code: src/app/pending/[id]/page.js:262-316                     │
├─────────────────────────────────────────────────────────────────┤
│ const handleUpdateForm = async (data) => {                     │
│     const modStatus = getModerationStatus(property);           │
│                                                                  │
│     if (pendingVersion?.id && modStatus === 'pending_add') {   │
│         // Update pending version                               │
│         await versionApi.update(pendingVersion.id, {           │
│             updates: data                                       │
│         });                                                      │
│     } else {                                                     │
│         // Update property directly                             │
│         await propertiesApi.update(propertyId, data);          │
│     }                                                            │
│ };                                                               │
│                                                                  │
│ // Triggered by "Update Changes" button                         │
│ onClick={() => formRef.current?.save(false)}                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5B: Admin Approves                                         │
│ API: PUT /api/property-workflow/{id}/publish                   │
│ Code: src/app/pending/[id]/page.js:320-377                     │
├─────────────────────────────────────────────────────────────────┤
│ const handleApprove = async () => {                            │
│     const modStatus = getModerationStatus(property);           │
│                                                                  │
│     if (modStatus === 'pending_add') {                          │
│         // ✅ Correct endpoint for pending_add                  │
│         await workflowApi.publish(propertyId, {                │
│             note: adminComment || 'Approved'                    │
│         });                                                      │
│     }                                                            │
│ };                                                               │
│                                                                  │
│ Backend Actions:                                                 │
│ - publication_status = 'published'                              │
│ - moderation_status = 'none'                                    │
│ - All pending versions → status = 'approved', is_live = true   │
│ - Records approval in workflow history                          │
│ - Adds admin note                                               │
│                                                                  │
│ Result:                                                          │
│ - Property is LIVE on website                                   │
│ - Agent sees "Published" status                                 │
│ - Property removed from Review Center                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ✅ PUBLISHED
```

---

## 🎯 Scenario 2: Admin Rejects Property (Return for Revision)

```
┌─────────────────────────────────────────────────────────────────┐
│ Admin Reviews Property (moderation_status = 'pending_add')      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Admin Clicks "Return for Revision"                      │
│ API: PUT /api/property-versions/version/{versionId}/reject     │
│ Code: src/app/pending/[id]/page.js:411-477                     │
├─────────────────────────────────────────────────────────────────┤
│ const handleReturn = async () => {                             │
│     if (pendingVersion?.id) {                                   │
│         await versionApi.reject(pendingVersion.id, {           │
│             action: 'return',                                   │
│             note: adminComment                                  │
│         });                                                      │
│     } else {                                                     │
│         // Fallback: no version, update property directly       │
│         await propertiesApi.update(propertyId, {               │
│             moderation_status: 'rejected_add'                   │
│         });                                                      │
│     }                                                            │
│                                                                  │
│     // Add note for agent                                       │
│     await noteApi.add(propertyId, {                            │
│         content: fullComment,                                   │
│         note_type: 'fix_request',                              │
│         is_internal: false                                      │
│     });                                                          │
│ };                                                               │
│                                                                  │
│ Backend Actions:                                                 │
│ - moderation_status = 'rejected_add'                            │
│ - Version status = 'rejected'                                   │
│ - Records rejection in workflow history                         │
│                                                                  │
│ Result:                                                          │
│ - Property appears in Agent's "Action Required"                 │
│ - Agent sees rejection note                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ AGENT: Fix Issues and Resubmit                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Agent Edits Property                                     │
│ Page: /properties/{id}                                          │
│ API: PUT /api/properties/{id}                                  │
│ Code: src/app/properties/[id]/page.js:267-416                  │
├─────────────────────────────────────────────────────────────────┤
│ const handleSubmit = async (data) => {                         │
│     // Update property directly (not version)                   │
│     await propertiesApi.update(propertyId, data);              │
│                                                                  │
│     // moderation_status stays 'rejected_add'                   │
│ };                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Agent Resubmits                                          │
│ API: PUT /api/property-workflow/{id}/submit                    │
│ Code: src/app/properties/page.js:777-803                       │
├─────────────────────────────────────────────────────────────────┤
│ const handleResubmit = async (property) => {                   │
│     const modStatus = getModerationStatus(property);           │
│                                                                  │
│     if (modStatus === 'rejected_edit') {                        │
│         // Has pending version - submit version                 │
│         const latestRes = await versionApi.getLatest(id);      │
│         await versionApi.submit(latestRes.data.data.id);       │
│     } else {                                                     │
│         // rejected_add - submit property                       │
│         await workflowApi.submit(property.id);                 │
│     }                                                            │
│ };                                                               │
│                                                                  │
│ Backend Actions:                                                 │
│ - moderation_status = 'pending_add' (back to pending)          │
│ - Creates NEW version with status = 'pending'                   │
│ - Old rejected version stays as status = 'rejected'             │
│ - Records resubmission in workflow history                      │
│                                                                  │
│ Result:                                                          │
│ - Property back in Admin's "Review Center"                      │
│ - Admin can see diff between rejected and resubmitted          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    (Back to Admin Review)
```

---

## 🎯 Scenario 3: Edit Published Property (pending_edit)

```
┌─────────────────────────────────────────────────────────────────┐
│ Property is Published (publication_status = 'published')        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Agent Requests Edit                                      │
│ API: POST /api/property-versions/{propertyId}/request-edit     │
│ Code: src/app/properties/page.js:655-672                       │
├─────────────────────────────────────────────────────────────────┤
│ const handleRequestEdit = async (property) => {                │
│     // Create pending version from live data                    │
│     await versionApi.requestEdit(property.id, {                │
│         reason: 'Agent requested edit'                          │
│     });                                                          │
│                                                                  │
│     // Navigate to edit page                                    │
│     router.push(`/properties/${property.id}`);                 │
│ };                                                               │
│                                                                  │
│ Backend Actions:                                                 │
│ - Creates new version                                           │
│ - Copies live property data to version.version_data            │
│ - Version status = 'draft' (not submitted yet)                  │
│ - moderation_status stays 'none' (not submitted yet)            │
│                                                                  │
│ Result:                                                          │
│ - Agent can edit version without affecting live property        │
│ - Live property still visible on website                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Agent Edits Version                                      │
│ Page: /properties/{id}                                          │
│ API: PUT /api/property-versions/version/{versionId}            │
│ Code: src/app/properties/[id]/page.js:370-384                  │
├─────────────────────────────────────────────────────────────────┤
│ const handleSubmit = async (data) => {                         │
│     if (isEditingPendingVersion && pendingVersion?.id) {       │
│         // Update version (not property)                        │
│         await versionApi.update(pendingVersion.id, {           │
│             updates: data                                       │
│         });                                                      │
│     }                                                            │
│ };                                                               │
│                                                                  │
│ Backend Actions:                                                 │
│ - Updates version.version_data                                  │
│ - Version status stays 'draft'                                  │
│ - Live property unchanged                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Agent Submits Version for Review                        │
│ API: PUT /api/property-versions/version/{versionId}/submit     │
│ Code: src/app/properties/[id]/page.js:520-545                  │
├─────────────────────────────────────────────────────────────────┤
│ const handleSubmitVersion = async () => {                      │
│     // Submit the version for review                            │
│     await versionApi.submit(pendingVersion.id);                │
│ };                                                               │
│                                                                  │
│ Backend Actions:                                                 │
│ - Version status = 'pending'                                    │
│ - Property moderation_status = 'pending_edit'                   │
│ - Records submission in workflow history                        │
│                                                                  │
│ Result:                                                          │
│ - Version appears in Admin's "Review Center"                    │
│ - Live property still published (unchanged)                     │
│ - Agent sees "Edit Pending" status                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ADMIN: Review Edit Request                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Admin Reviews Changes                                   │
│ Page: /pending/{id}                                             │
│ Code: src/app/pending/[id]/page.js:174-194                     │
├─────────────────────────────────────────────────────────────────┤
│ // Load property (live data)                                    │
│ const propRes = await propertiesApi.getById(propertyId);       │
│                                                                  │
│ // Load pending version                                         │
│ const latestRes = await versionApi.getLatest(propertyId);      │
│                                                                  │
│ // Get diff between live and pending                            │
│ const diffRes = await versionApi.getDiff(version.id);          │
│                                                                  │
│ // Display side-by-side comparison                              │
│ <PropertyForm property={property} readOnly />  // Live          │
│ <PropertyForm                                   // Pending      │
│     property={property}                                         │
│     pendingData={pendingVersion.version_data}                  │
│     highlightedFields={changedFields}                           │
│ />                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Admin Approves Edit                                      │
│ API: PUT /api/property-versions/version/{versionId}/approve    │
│ Code: src/app/pending/[id]/page.js:353-376                     │
├─────────────────────────────────────────────────────────────────┤
│ const handleApprove = async () => {                            │
│     const modStatus = getModerationStatus(property);           │
│                                                                  │
│     if (modStatus === 'pending_edit' && pendingVersion?.id) {  │
│         // ✅ Correct endpoint for pending_edit                 │
│         await versionApi.approve(pendingVersion.id, {          │
│             note: adminComment || 'Approved'                    │
│         });                                                      │
│     }                                                            │
│ };                                                               │
│                                                                  │
│ Backend Actions:                                                 │
│ - Archives current live version (is_live = false)               │
│ - Applies version.version_data to properties table             │
│ - Version status = 'approved', is_live = true                   │
│ - publication_status = 'published'                              │
│ - moderation_status = 'none'                                    │
│ - Auto-regenerates titles                                       │
│ - Records approval in workflow history                          │
│                                                                  │
│ Result:                                                          │
│ - Live property updated with new data                           │
│ - Property still published                                      │
│ - Old version archived for history                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ✅ PUBLISHED (Updated)
```

---

## 📋 API Endpoints Summary

### **Property APIs** (`propertiesApi`)

| Method | Endpoint | Used For | Code Location |
|--------|----------|----------|---------------|
| `POST` | `/api/properties` | Create new draft property | `properties/new/page.js:43` |
| `GET` | `/api/properties/{id}` | Get property details | `pending/[id]/page.js:166` |
| `PUT` | `/api/properties/{id}` | Update property data | `properties/[id]/page.js:384` |
| `DELETE` | `/api/properties/{id}` | Soft delete property | - |

**When to use:**
- ✅ Creating new draft
- ✅ Updating `rejected_add` property (before resubmit)
- ✅ Updating property without version (old flow)
- ❌ Don't use for `pending_edit` (use `versionApi` instead)

---

### **Workflow APIs** (`workflowApi`)

| Method | Endpoint | Used For | Code Location |
|--------|----------|----------|---------------|
| `PUT` | `/api/property-workflow/{id}/submit` | Submit property for review | `properties/new/page.js:115` |
| `PUT` | `/api/property-workflow/{id}/publish` | Approve `pending_add` | `pending/[id]/page.js:352` |
| `PUT` | `/api/property-workflow/{id}/unpublish` | Unpublish property | `properties/[id]/page.js:1326` |

**When to use:**
- ✅ `submit`: Agent submits draft → `pending_add`
- ✅ `submit`: Agent resubmits `rejected_add` → `pending_add`
- ✅ `publish`: Admin approves `pending_add` → `published`
- ✅ `unpublish`: Admin unpublishes property
- ❌ Don't use `publish` for `pending_edit` (use `versionApi.approve`)

---

### **Version APIs** (`versionApi`)

| Method | Endpoint | Used For | Code Location |
|--------|----------|----------|---------------|
| `GET` | `/api/property-versions/{propertyId}` | Get version history | `pending/[id]/page.js:199` |
| `GET` | `/api/property-versions/{propertyId}/latest` | Get latest pending version | `properties/page.js:784` |
| `POST` | `/api/property-versions/{propertyId}/request-edit` | Create pending version from live | `properties/page.js:658` |
| `PUT` | `/api/property-versions/version/{versionId}` | Update pending version | `pending/[id]/page.js:298` |
| `PUT` | `/api/property-versions/version/{versionId}/submit` | Submit version for review | `properties/[id]/page.js:533` |
| `GET` | `/api/property-versions/version/{versionId}/diff` | Get diff between live and pending | `pending/[id]/page.js:182` |
| `PUT` | `/api/property-versions/version/{versionId}/approve` | Approve `pending_edit` | `pending/[id]/page.js:362` |
| `PUT` | `/api/property-versions/version/{versionId}/reject` | Reject version | `pending/[id]/page.js:420` |

**When to use:**
- ✅ `requestEdit`: Agent wants to edit published property
- ✅ `update`: Agent edits pending version (draft)
- ✅ `submit`: Agent submits version for review (`pending_edit`)
- ✅ `approve`: Admin approves `pending_edit`
- ✅ `reject`: Admin rejects any version
- ❌ Don't use `approve` for `pending_add` (use `workflowApi.publish`)

---

## ⚠️ Common Mistakes & Fixes

### ❌ Mistake 1: Using `versionApi.approve` for `pending_add`

```javascript
// ❌ WRONG
if (modStatus === 'pending_add') {
    await versionApi.approve(versionId);  // Will fail!
}
```

```javascript
// ✅ CORRECT
if (modStatus === 'pending_add') {
    await workflowApi.publish(propertyId);
}
```

**Why:** `pending_add` properties should be approved via workflow API, not version API.

---

### ❌ Mistake 2: Using `workflowApi.publish` for `pending_edit`

```javascript
// ❌ WRONG
if (modStatus === 'pending_edit') {
    await workflowApi.publish(propertyId);  // Won't apply version changes!
}
```

```javascript
// ✅ CORRECT
if (modStatus === 'pending_edit' && versionId) {
    await versionApi.approve(versionId);
}
```

**Why:** `pending_edit` needs to apply version changes to property, which only `versionApi.approve` does.

---

### ❌ Mistake 3: Updating property instead of version for `pending_edit`

```javascript
// ❌ WRONG - Agent editing published property
await propertiesApi.update(propertyId, data);  // Directly modifies live!
```

```javascript
// ✅ CORRECT
// 1. Create version first
await versionApi.requestEdit(propertyId);

// 2. Update version
await versionApi.update(versionId, { updates: data });

// 3. Submit version
await versionApi.submit(versionId);
```

**Why:** Editing published properties should go through version system to preserve live data.

---

### ❌ Mistake 4: Not loading `pendingData` in PropertyForm

```javascript
// ❌ WRONG - Form shows old property data
<PropertyForm
    property={property}
    onSubmit={handleUpdate}
/>
```

```javascript
// ✅ CORRECT - Form shows pending version data
<PropertyForm
    property={property}
    pendingData={pendingVersion?.version_data || property}
    onSubmit={handleUpdate}
/>
```

**Why:** Admin needs to see and edit the pending version data, not the old property data.

---

## 🔍 Decision Tree: Which API to Use?

```
What are you trying to do?
│
├─ Create new property
│  └─ propertiesApi.create() ✅
│
├─ Submit draft for review
│  └─ workflowApi.submit(propertyId) ✅
│
├─ Approve pending_add
│  └─ workflowApi.publish(propertyId) ✅
│
├─ Edit published property
│  ├─ Step 1: versionApi.requestEdit(propertyId) ✅
│  ├─ Step 2: versionApi.update(versionId, data) ✅
│  └─ Step 3: versionApi.submit(versionId) ✅
│
├─ Approve pending_edit
│  └─ versionApi.approve(versionId) ✅
│
├─ Update rejected_add property
│  ├─ Step 1: propertiesApi.update(propertyId, data) ✅
│  └─ Step 2: workflowApi.submit(propertyId) ✅
│
└─ Reject any pending
   └─ versionApi.reject(versionId, { action: 'return' }) ✅
```

---

## 📊 Status Transitions

### Property `moderation_status`

```
none → pending_add → none (approved)
  ↓         ↓
  ↓    rejected_add → pending_add (resubmit)
  ↓
pending_edit → none (approved)
  ↓
rejected_edit → pending_edit (resubmit)
```

### Version `status`

```
draft → pending → approved
  ↓        ↓
cancel  rejected → pending (resubmit)
```

---

## 🎯 Best Practices

### 1. **Always check `moderation_status` before choosing API**

```javascript
const modStatus = getModerationStatus(property);

if (modStatus === 'pending_add') {
    // Use workflow API
} else if (modStatus === 'pending_edit') {
    // Use version API
}
```

### 2. **Use version system for published properties**

```javascript
// ✅ CORRECT
if (property.publication_status === 'published') {
    await versionApi.requestEdit(propertyId);
    // Edit version, not property
}
```

### 3. **Load pending version data in forms**

```javascript
<PropertyForm
    property={property}
    pendingData={pendingVersion?.version_data}
/>
```

### 4. **Refresh router after mutations**

```javascript
await workflowApi.publish(propertyId);
router.refresh();  // Clear Next.js cache
router.push('/pending');
```

### 5. **Emit events for sidebar updates**

```javascript
await workflowApi.publish(propertyId);
eventEmitter.emit(EVENTS.SIDEBAR_REFRESH);
```

---

## 🔧 Debugging Checklist

When something doesn't work:

- [ ] Check `moderation_status` - using correct API?
- [ ] Check `publication_status` - should use version system?
- [ ] Check if version exists - `pendingVersion?.id`
- [ ] Check version `status` - is it 'pending'?
- [ ] Check PropertyForm `pendingData` prop - showing correct data?
- [ ] Check network tab - which API was called?
- [ ] Check backend response - what error message?
- [ ] Check database - what's the actual status?

---

## 📝 Summary Table

| Scenario | Agent Action | API Used | Admin Action | API Used |
|----------|-------------|----------|--------------|----------|
| **New Property** | Create draft | `propertiesApi.create` | - | - |
| | Submit for review | `workflowApi.submit` | - | - |
| | - | - | Approve | `workflowApi.publish` ✅ |
| **Edit Published** | Request edit | `versionApi.requestEdit` | - | - |
| | Edit version | `versionApi.update` | - | - |
| | Submit version | `versionApi.submit` | - | - |
| | - | - | Approve edit | `versionApi.approve` ✅ |
| **Rejected** | Fix issues | `propertiesApi.update` | - | - |
| | Resubmit | `workflowApi.submit` | - | - |
| | - | - | Reject | `versionApi.reject` |

---

**Last Updated:** 2026-03-11  
**Frontend Version:** Next.js 16.0.8  
**Backend API:** Property Workflow + Version System
