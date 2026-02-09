# 🐛 Image Upload/Delete Bug Fix

## 📋 Problem Description

### Scenario:
1. **Initial state**: Property has images `['img1.jpg', 'img2.jpg']`
2. **User deletes** `img2.jpg` (clicks X button)
3. **User adds** `img3.jpg` (uploads new image)
4. **User clicks** Update

### ❌ Wrong Result:
- Images shown: `['img2.jpg', 'img3.jpg']` 
- **img1.jpg disappeared!**

### ✅ Expected Result:
- Images shown: `['img1.jpg', 'img3.jpg']`

---

## 🔍 Root Cause Analysis

### Frontend Flow (Before Fix):
```javascript
// Step 1: Update property with existingImages
updateData.images = existingImages;  // ['img1.jpg']
await propertiesApi.update(id, updateData);

// Step 2: Upload new images
if (pendingImages.length > 0) {
    const formData = new FormData();
    formData.append('property_id', property.id);
    pendingImages.forEach(file => {
        formData.append('images', file);
    });
    await uploadApi.uploadImages(formData);
}
```

### Backend Behavior (Before Fix):
**File**: `/routes/upload.js` - `POST /api/upload/images`

```javascript
// Line 215: Get current images from DATABASE
const currentImages = property.images || [];  
// At this point: ['img1.jpg', 'img2.jpg'] (from database)

// Line 237-253: Upload new images
for (const file of req.files) {
    const filename = `${prefix}${nextNumber}.webp`;
    newFilenames.push(filename);  // ['img3.jpg']
    nextNumber++;
}

// Line 256-261: Merge with currentImages
const allImages = [...currentImages];  // ['img1.jpg', 'img2.jpg']
newFilenames.forEach(filename => {
    if (!allImages.includes(filename)) {
        allImages.push(filename);  // ['img1.jpg', 'img2.jpg', 'img3.jpg']
    }
});

// Line 263-266: Update database
await pool.query(
    'UPDATE properties SET images = $1',
    [JSON.stringify(allImages)]  // ❌ Saves ['img1.jpg', 'img2.jpg', 'img3.jpg']
);
```

### 🎯 The Problem:
1. Frontend updates property with `images = ['img1.jpg']` (Step 1)
2. Backend upload endpoint reads `currentImages` from database
3. **Race condition**: If Step 2 happens before database is updated, it reads old data `['img1.jpg', 'img2.jpg']`
4. Backend appends new image → `['img1.jpg', 'img2.jpg', 'img3.jpg']`
5. Backend overwrites the property images → deleted image reappears!

---

## ✅ Solution Implemented

### 1. Frontend Changes (Already Done by User)
**File**: `src/app/properties/[id]/page.js`

Changed the order of operations:

```javascript
// ✅ NEW: Upload images FIRST, then update property

// Step 1: Upload new images with existing_images[] parameter
let finalImages = [...existingImages];
if (pendingImages && pendingImages.length > 0) {
    const formData = new FormData();
    formData.append('property_id', property.id);
    
    // Send existing images to preserve
    existingImages.forEach(img => {
        formData.append('existing_images[]', img);
    });
    
    // Send new images to upload
    pendingImages.forEach(file => {
        formData.append('images', file);
    });

    const uploadRes = await uploadApi.uploadImages(formData);
    finalImages = uploadRes.data.data.images;  // Get final array from backend
}

// Step 2: Update property with final images
updateData.images = finalImages;
await propertiesApi.update(resolvedParams.id, updateData);
```

### 2. Backend Changes
**File**: `/routes/upload.js` - `POST /api/upload/images`

#### Changes Made:

1. **Accept `existing_images` parameter** (line 183):
```javascript
const { property_id, existing_images } = req.body;
```

2. **Use `existing_images` if provided** (line 217-229):
```javascript
// Use existing_images from request if provided, otherwise use current images from database
// This allows frontend to control which images to keep (e.g., after deleting some)
let baseImages = [];
if (existing_images) {
    // existing_images can be array or comma-separated string
    baseImages = Array.isArray(existing_images) 
        ? existing_images 
        : (typeof existing_images === 'string' ? existing_images.split(',').filter(img => img.trim()) : []);
    console.log('[UPLOAD IMAGES] Using existing_images from request:', baseImages);
} else {
    // Fallback to database images
    baseImages = property.images || [];
    console.log('[UPLOAD IMAGES] Using images from database:', baseImages);
}
```

3. **Merge with baseImages instead of currentImages** (line 252-259):
```javascript
// Merge: baseImages (from request or database) + newFilenames
const allImages = [...baseImages];
newFilenames.forEach(filename => {
    if (!allImages.includes(filename)) {
        allImages.push(filename);
    }
});
```

4. **Return final images array** (line 270):
```javascript
res.json({
    success: true,
    message: `${uploadedFiles.length} images uploaded successfully`,
    data: {
        property_id: property_id,
        status_code: statusCode,
        images: allImages,  // ✅ Return final images array for frontend
        uploaded: uploadedFiles,
        total_images: allImages.length
    }
});
```

---

## 🎯 How It Works Now

### Example Scenario:

**Initial state**: `images = ['img1.jpg', 'img2.jpg']`

1. **User deletes img2.jpg**
   - Frontend: `existingImages = ['img1.jpg']`

2. **User adds img3.jpg**
   - Frontend: `pendingImages = [File3]`

3. **User clicks Update**

### Frontend Request:
```javascript
POST /api/upload/images
FormData:
  - property_id: 123
  - existing_images[]: 'img1.jpg'  // ✅ Explicitly tell backend to keep this
  - images: File3                   // ✅ New file to upload
```

### Backend Processing:
```javascript
// Step 1: Read existing_images from request
baseImages = ['img1.jpg']  // ✅ From request, not database

// Step 2: Upload new images
newFilenames = ['img3.jpg']

// Step 3: Merge
allImages = ['img1.jpg', 'img3.jpg']  // ✅ Correct!

// Step 4: Update database
UPDATE properties SET images = '["img1.jpg", "img3.jpg"]'

// Step 5: Return to frontend
return { images: ['img1.jpg', 'img3.jpg'] }
```

### Frontend Update:
```javascript
// Receive final images from backend
finalImages = ['img1.jpg', 'img3.jpg']

// Update property
updateData.images = finalImages
await propertiesApi.update(id, updateData)
```

### ✅ Result:
- Images: `['img1.jpg', 'img3.jpg']`
- **img2.jpg is gone** (as expected)
- **img1.jpg is preserved** (as expected)
- **img3.jpg is added** (as expected)

---

## 📝 Testing Checklist

- [ ] **Test 1**: Delete an image, then update → Verify image is deleted
- [ ] **Test 2**: Add a new image, then update → Verify image is added
- [ ] **Test 3**: Delete img2, add img3, then update → Verify img1 and img3 remain
- [ ] **Test 4**: Delete all images, add new ones → Verify only new images appear
- [ ] **Test 5**: Add multiple images at once → Verify all are added
- [ ] **Test 6**: Delete multiple images, add multiple new ones → Verify correct final state

---

## 🚀 Deployment Notes

### Files Modified:
1. ✅ `/routes/upload.js` - Backend upload endpoint
2. ✅ `src/app/properties/[id]/page.js` - Frontend edit page (already done by user)

### Backward Compatibility:
✅ **Yes** - The `existing_images` parameter is optional:
- If provided: Use it (new behavior)
- If not provided: Fallback to database images (old behavior)

### Breaking Changes:
❌ **None** - Existing API calls will continue to work

---

## 📚 Related Files

- `/routes/upload.js` - Upload endpoint (✅ Fixed)
- `/routes/properties.js` - Property CRUD (no changes needed)
- `src/app/properties/[id]/page.js` - Frontend edit page (✅ Fixed by user)
- `src/components/PropertyForm.js` - Form component (no changes needed)

---

**Status**: ✅ **Backend Fix Complete** - Ready for testing!
