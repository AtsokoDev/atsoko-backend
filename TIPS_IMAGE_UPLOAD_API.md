# 🖼️ Tips Image Upload API

## สรุป
API สำหรับ upload รูปภาพสำหรับบทความ Tips โดยมี 2 ประเภท:
1. **Featured Image** - รูปหน้าปกบทความ (1600px)
2. **Content Image** - รูปในเนื้อหาบทความ (1200px)

---

## 📋 Endpoints

### 1. POST /api/upload/tips-image
Upload รูปหน้าปก (Featured Image) สำหรับบทความ

**Request:**
```http
POST /api/upload/tips-image
Content-Type: multipart/form-data

FormData:
- image: <file> (required)
- article_id: <number> (optional)
```

**Response:**
```json
{
  "success": true,
  "message": "Featured image uploaded successfully",
  "data": {
    "filename": "tips_1737532800000.webp",
    "url": "/images/tips/tips_1737532800000.webp",
    "full_url": "http://localhost:3000/images/tips/tips_1737532800000.webp",
    "article_id": 123
  }
}
```

**Features:**
- ✅ Compress รูปภาพ (เก็บขนาดเดิม)
- ✅ แปลงเป็น WebP (quality 85%)
- ✅ ไม่มี watermark
- ✅ ถ้าส่ง article_id มา จะอัปเดต featured_image ใน database อัตโนมัติ
- ✅ รองรับ JPEG, PNG, WebP, GIF
- ✅ จำกัดขนาด 10MB

---

### 2. POST /api/upload/tips-content-image
Upload รูปภาพในเนื้อหาบทความ (สำหรับ Rich Text Editor)

**Request:**
```http
POST /api/upload/tips-content-image
Content-Type: multipart/form-data

FormData:
- image: <file> (required)
```

**Response:**
```json
{
  "success": true,
  "message": "Content image uploaded successfully",
  "data": {
    "filename": "tips_content_1737532800000.webp",
    "url": "/images/tips/tips_content_1737532800000.webp",
    "full_url": "http://localhost:3000/images/tips/tips_content_1737532800000.webp"
  }
}
```

**Features:**
- ✅ Compress รูปภาพ (เก็บขนาดเดิม)
- ✅ แปลงเป็น WebP (quality 80%)
- ✅ ไม่มี watermark
- ✅ เหมาะสำหรับรูปในบทความ
- ✅ รองรับ JPEG, PNG, WebP, GIF
- ✅ จำกัดขนาด 10MB

---

### 3. DELETE /api/upload/tips-image/:filename
ลบรูปภาพ Tips

**Request:**
```http
DELETE /api/upload/tips-image/tips_1737532800000.webp
```

**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "data": {
    "filename": "tips_1737532800000.webp"
  }
}
```

---

## 🎯 การใช้งาน

### 1. Upload Featured Image (รูปหน้าปก)

#### JavaScript/Fetch
```javascript
const uploadFeaturedImage = async (file, articleId = null) => {
  const formData = new FormData();
  formData.append('image', file);
  if (articleId) {
    formData.append('article_id', articleId);
  }

  const response = await fetch('http://localhost:3000/api/upload/tips-image', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  return data.data.url; // "/images/tips/tips_1737532800000.webp"
};

// ใช้งาน
const fileInput = document.querySelector('#featured-image');
const file = fileInput.files[0];
const imageUrl = await uploadFeaturedImage(file, 123);
```

#### cURL
```bash
curl -X POST http://localhost:3000/api/upload/tips-image \
  -F "image=@/path/to/image.jpg" \
  -F "article_id=123"
```

---

### 2. Upload Content Image (รูปในบทความ)

#### JavaScript/Fetch
```javascript
const uploadContentImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('http://localhost:3000/api/upload/tips-content-image', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  return data.data.url;
};
```

#### cURL
```bash
curl -X POST http://localhost:3000/api/upload/tips-content-image \
  -F "image=@/path/to/image.jpg"
```

---

### 3. Integration กับ Rich Text Editor (Quill.js)

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
</head>
<body>
  <div id="editor"></div>
  
  <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
  <script>
    // Custom image handler
    function imageHandler() {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();

      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        // Show loading
        const range = this.quill.getSelection(true);
        this.quill.insertText(range.index, 'Uploading image...');

        try {
          // Upload image
          const formData = new FormData();
          formData.append('image', file);

          const response = await fetch('http://localhost:3000/api/upload/tips-content-image', {
            method: 'POST',
            body: formData
          });

          const data = await response.json();

          if (data.success) {
            // Remove loading text
            this.quill.deleteText(range.index, 'Uploading image...'.length);
            
            // Insert image
            this.quill.insertEmbed(range.index, 'image', data.data.url);
            this.quill.setSelection(range.index + 1);
          } else {
            alert('Upload failed: ' + data.error);
          }
        } catch (error) {
          console.error('Upload error:', error);
          alert('Upload failed');
        }
      };
    }

    // Initialize Quill with custom image handler
    const quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: {
          container: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            ['link', 'image'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }]
          ],
          handlers: {
            image: imageHandler
          }
        }
      }
    });

    // Get HTML content when saving
    function saveArticle() {
      const content = quill.root.innerHTML;
      console.log(content); // HTML with image URLs
      
      // Send to Tips API
      fetch('http://localhost:3000/api/tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN'
        },
        body: JSON.stringify({
          slug: 'my-article',
          title: 'My Article',
          content: content,
          featured_image: '/images/tips/tips_1737532800000.webp'
        })
      });
    }
  </script>
</body>
</html>
```

---

### 4. Integration กับ Vue.js

```vue
<template>
  <div>
    <!-- Featured Image Upload -->
    <div class="featured-image">
      <input 
        type="file" 
        @change="uploadFeaturedImage" 
        accept="image/*"
      />
      <img v-if="featuredImageUrl" :src="featuredImageUrl" />
    </div>

    <!-- Rich Text Editor -->
    <div id="editor"></div>

    <button @click="saveArticle">Save Article</button>
  </div>
</template>

<script>
import Quill from 'quill';

export default {
  data() {
    return {
      quill: null,
      featuredImageUrl: null,
      articleId: null
    };
  },
  mounted() {
    this.initEditor();
  },
  methods: {
    async uploadFeaturedImage(event) {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('image', file);
      if (this.articleId) {
        formData.append('article_id', this.articleId);
      }

      try {
        const response = await fetch('http://localhost:3000/api/upload/tips-image', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (data.success) {
          this.featuredImageUrl = data.data.url;
        }
      } catch (error) {
        console.error('Upload error:', error);
      }
    },

    initEditor() {
      this.quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
          toolbar: {
            container: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline'],
              ['link', 'image'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }]
            ],
            handlers: {
              image: this.imageHandler
            }
          }
        }
      });
    },

    imageHandler() {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();

      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
          const response = await fetch('http://localhost:3000/api/upload/tips-content-image', {
            method: 'POST',
            body: formData
          });

          const data = await response.json();

          if (data.success) {
            const range = this.quill.getSelection(true);
            this.quill.insertEmbed(range.index, 'image', data.data.url);
            this.quill.setSelection(range.index + 1);
          }
        } catch (error) {
          console.error('Upload error:', error);
        }
      };
    },

    async saveArticle() {
      const content = this.quill.root.innerHTML;

      const response = await fetch('http://localhost:3000/api/tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN'
        },
        body: JSON.stringify({
          slug: 'my-article',
          title: 'My Article',
          content: content,
          featured_image: this.featuredImageUrl
        })
      });

      const data = await response.json();
      console.log('Article saved:', data);
    }
  }
};
</script>
```

---

## 📁 File Structure

```
public/
└── images/
    └── tips/
        ├── tips_1737532800000.webp          (Featured image)
        ├── tips_1737532801000.webp          (Featured image)
        ├── tips_content_1737532802000.webp  (Content image)
        └── tips_content_1737532803000.webp  (Content image)
```

---

## 🔒 Security Notes

**⚠️ TODO: เพิ่ม Authentication**

ปัจจุบัน endpoints เหล่านี้ยังไม่มี authentication ควรเพิ่ม middleware:

```javascript
const { authenticate, authorize } = require('../middleware/auth');

// เพิ่ม auth middleware
router.post('/tips-image', 
  authenticate, 
  authorize(['admin']), 
  upload.single('image'), 
  handleUploadError, 
  async (req, res) => {
    // ...
  }
);
```

---

## 📊 Image Specifications

### Featured Image (รูปหน้าปก)
- **Compression:** WebP format, quality 85%
- **Dimensions:** เก็บขนาดเดิม (ไม่ resize)
- **Max File Size:** 10MB (before processing)
- **Typical Result:** ลดขนาดไฟล์ 60-80%
- **Use Case:** Hero image, thumbnail

### Content Image (รูปในบทความ)
- **Compression:** WebP format, quality 80%
- **Dimensions:** เก็บขนาดเดิม (ไม่ resize)
- **Max File Size:** 10MB (before processing)
- **Typical Result:** ลดขนาดไฟล์ 60-80%
- **Use Case:** Images within article content

### Supported Input Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)

---

## 🚨 Error Codes

| Code | Error | สาเหตุ | แก้ไข |
|------|-------|--------|------|
| 400 | No image file provided | ไม่ได้ส่งไฟล์มา | ส่งไฟล์ใน FormData |
| 400 | Invalid file type | ไฟล์ไม่ใช่รูปภาพ | ใช้ JPEG/PNG/WebP/GIF |
| 400 | File size too large | ไฟล์ใหญ่เกิน 10MB | ลดขนาดไฟล์ |
| 400 | Invalid filename format | ชื่อไฟล์ไม่ถูกต้อง (DELETE) | ใช้ชื่อที่ได้จาก API |
| 404 | Image not found | ไม่เจอไฟล์ (DELETE) | ตรวจสอบชื่อไฟล์ |
| 500 | Failed to upload image | Server error | ลองใหม่อีกครั้ง |

---

## ✅ Testing

### Test Featured Image Upload
```bash
# 1. Prepare test image
curl -o test.jpg https://picsum.photos/2000/1500

# 2. Upload
curl -X POST http://localhost:3000/api/upload/tips-image \
  -F "image=@test.jpg" \
  -F "article_id=1"

# 3. Check result
# Should return URL like: /images/tips/tips_1737532800000.webp

# 4. View image
open http://localhost:3000/images/tips/tips_1737532800000.webp
```

### Test Content Image Upload
```bash
curl -X POST http://localhost:3000/api/upload/tips-content-image \
  -F "image=@test.jpg"
```

### Test Delete
```bash
curl -X DELETE http://localhost:3000/api/upload/tips-image/tips_1737532800000.webp
```

---

## 🎯 สรุป

### ✅ สิ่งที่ได้
1. **POST /api/upload/tips-image** - Upload รูปหน้าปก (WebP 85%, เก็บขนาดเดิม)
2. **POST /api/upload/tips-content-image** - Upload รูปในบทความ (WebP 80%, เก็บขนาดเดิม)
3. **DELETE /api/upload/tips-image/:filename** - ลบรูปภาพ
4. Auto compress + WebP conversion (ไม่ resize)
5. ไม่มี watermark
6. เก็บใน `/public/images/tips/`

### ⏳ สิ่งที่ควรทำต่อ
1. เพิ่ม authentication middleware (admin only)
2. เพิ่ม rate limiting
3. เพิ่ม image optimization options
4. เพิ่ม bulk upload support

---

**พร้อมใช้งานแล้ว!** 🎉
