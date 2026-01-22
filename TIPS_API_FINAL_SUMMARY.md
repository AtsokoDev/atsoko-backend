# 📚 Tips API - สรุปสำหรับ Frontend Developer

## � Oveนrview

Tips API สำหรับจัดการบทความ/blog posts พร้อมระบบ upload รูปภาพ

**Base URL:** `http://localhost:3000`

---

## 📋 API Endpoints ทั้งหมด

### 🔓 Public Endpoints (ไม่ต้อง login)

#### 1. GET /api/tips - ดูรายการบทความ

```http
GET /api/tips?page=1&limit=20&published=true
```

**Query Parameters:**
- `page` (number, optional) - หน้าที่ต้องการ (default: 1)
- `limit` (number, optional) - จำนวนต่อหน้า (default: 20, max: 100)
- `published` (boolean|string, optional) - กรองตามสถานะ
  - `true` = เฉพาะที่ publish แล้ว (default)
  - `false` = draft/scheduled
  - `"all"` = ทั้งหมด

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "my-article",
      "title": "My Article Title",
      "excerpt": "Short description",
      "content": "<h1>HTML content</h1><p>Text...</p>",
      "featured_image": "/images/tips/tips_1234567890.webp",
      "author": "John Doe",
      "published_at": "2025-01-20T10:00:00Z",
      "created_at": "2025-01-20T09:00:00Z",
      "updated_at": "2025-01-20T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

---

#### 2. GET /api/tips/:slug - ดูบทความเดี่ยว

```http
GET /api/tips/my-article-slug
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "my-article-slug",
    "title": "My Article Title",
    "excerpt": "Short description",
    "content": "<h1>HTML content</h1>",
    "featured_image": "/images/tips/tips_1234567890.webp",
    "author": "John Doe",
    "published_at": "2025-01-20T10:00:00Z",
    "created_at": "2025-01-20T09:00:00Z",
    "updated_at": "2025-01-20T09:00:00Z"
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Article not found"
}
```

---

### 🔒 Admin Endpoints (ต้อง login + role = admin)

#### 3. POST /api/tips - สร้างบทความใหม่

```http
POST /api/tips
Headers:
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

Body:
{
  "slug": "my-article",              // required, ต้องไม่ซ้ำ
  "title": "My Article Title",       // required
  "content": "<h1>HTML content</h1>", // required
  "excerpt": "Short description",    // optional
  "featured_image": "/images/tips/tips_1234567890.webp", // optional
  "author": "John Doe",              // optional
  "published_at": "2025-01-20T10:00:00Z" // optional (null = draft)
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "my-article",
    "title": "My Article Title",
    // ... ฟิลด์อื่นๆ
  },
  "message": "Article created successfully"
}
```

**Errors:**
- `400` - Missing required fields (slug, title, content)
- `401` - Access denied (ไม่มี token)
- `403` - Insufficient permissions (ไม่ใช่ admin)
- `409` - Slug already exists (slug ซ้ำ)

---

#### 4. PUT /api/tips/:id - แก้ไขบทความ

```http
PUT /api/tips/1
Headers:
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

Body: (ส่งเฉพาะฟิลด์ที่ต้องการแก้)
{
  "title": "Updated Title",
  "content": "<h1>Updated content</h1>",
  "published_at": "2025-01-22T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "my-article",
    "title": "Updated Title",
    // ... ฟิลด์อื่นๆ
  },
  "message": "Article updated successfully"
}
```

**Errors:**
- `400` - Request body is empty / No valid fields to update
- `401` - Access denied
- `403` - Insufficient permissions
- `404` - Article not found
- `409` - Duplicate slug

---

#### 5. DELETE /api/tips/:id - ลบบทความ

```http
DELETE /api/tips/1
Headers:
  Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Article deleted successfully",
  "data": {
    "id": 1,
    "slug": "my-article",
    // ... ฟิลด์อื่นๆ
  }
}
```

**Errors:**
- `401` - Access denied
- `403` - Insufficient permissions
- `404` - Article not found

---

## 🖼️ Image Upload Endpoints

### 6. POST /api/upload/tips-image - Upload รูปหน้าปก

```http
POST /api/upload/tips-image
Content-Type: multipart/form-data

FormData:
- image: <file> (required)
- article_id: <number> (optional)
```

**Features:**
- ✅ Compress รูปภาพ (เก็บขนาดเดิม)
- ✅ แปลงเป็น WebP (quality 85%)
- ✅ ไม่มี watermark
- ✅ รองรับ JPEG, PNG, WebP, GIF
- ✅ จำกัดขนาด 10MB
- ✅ ถ้าส่ง article_id มา จะอัปเดต featured_image ใน database อัตโนมัติ

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

**Errors:**
- `400` - No image file provided / Invalid file type / File size too large

---

### 7. POST /api/upload/tips-content-image - Upload รูปในบทความ

```http
POST /api/upload/tips-content-image
Content-Type: multipart/form-data

FormData:
- image: <file> (required)
```

**Features:**
- ✅ Compress รูปภาพ (เก็บขนาดเดิม)
- ✅ แปลงเป็น WebP (quality 80%)
- ✅ ไม่มี watermark
- ✅ เหมาะสำหรับ Rich Text Editor

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

---

### 8. DELETE /api/upload/tips-image/:filename - ลบรูปภาพ

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

**Errors:**
- `400` - Invalid filename format
- `404` - Image not found

---

## 🔑 Authentication

### Login ก่อนใช้งาน Admin Endpoints

```http
POST /api/auth/login
Content-Type: application/json

Body:
{
  "email": "admin@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

**จากนั้นใช้ token ใน Header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📅 Published Logic

บทความมี 3 สถานะ:

1. **Draft** - `published_at = null`
   - ไม่แสดงใน public endpoints
   - แสดงเฉพาะใน admin panel

2. **Scheduled** - `published_at = วันที่อนาคต`
   - ไม่แสดงใน public endpoints (ยัง)
   - จะแสดงอัตโนมัติเมื่อถึงเวลา

3. **Published** - `published_at ≤ ปัจจุบัน`
   - แสดงใน public endpoints
   - เรียงตาม published_at (ใหม่สุดก่อน)

---

## 💻 ตัวอย่างโค้ด Frontend

### 1. ดูรายการบทความ (Vue.js)

```vue
<template>
  <div>
    <div v-for="article in articles" :key="article.id">
      <img :src="article.featured_image" :alt="article.title">
      <h2>{{ article.title }}</h2>
      <p>{{ article.excerpt }}</p>
      <router-link :to="`/tips/${article.slug}`">อ่านต่อ</router-link>
    </div>
    
    <!-- Pagination -->
    <button @click="prevPage" :disabled="page === 1">ก่อนหน้า</button>
    <span>หน้า {{ page }} / {{ totalPages }}</span>
    <button @click="nextPage" :disabled="page === totalPages">ถัดไป</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      articles: [],
      page: 1,
      limit: 10,
      totalPages: 0
    };
  },
  mounted() {
    this.fetchArticles();
  },
  methods: {
    async fetchArticles() {
      const response = await fetch(
        `http://localhost:3000/api/tips?page=${this.page}&limit=${this.limit}`
      );
      const data = await response.json();
      
      if (data.success) {
        this.articles = data.data;
        this.totalPages = data.pagination.pages;
      }
    },
    prevPage() {
      if (this.page > 1) {
        this.page--;
        this.fetchArticles();
      }
    },
    nextPage() {
      if (this.page < this.totalPages) {
        this.page++;
        this.fetchArticles();
      }
    }
  }
};
</script>
```

---

### 2. ดูบทความเดี่ยว (Vue.js)

```vue
<template>
  <div v-if="article">
    <img :src="article.featured_image" :alt="article.title">
    <h1>{{ article.title }}</h1>
    <p class="meta">
      โดย {{ article.author }} | 
      {{ formatDate(article.published_at) }}
    </p>
    
    <!-- แสดง HTML content -->
    <div v-html="article.content"></div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      article: null
    };
  },
  mounted() {
    this.fetchArticle();
  },
  methods: {
    async fetchArticle() {
      const slug = this.$route.params.slug;
      const response = await fetch(`http://localhost:3000/api/tips/${slug}`);
      const data = await response.json();
      
      if (data.success) {
        this.article = data.data;
      }
    },
    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('th-TH');
    }
  }
};
</script>
```

---

### 3. สร้างบทความ (Admin Panel - Vue.js)

```vue
<template>
  <div>
    <h1>สร้างบทความใหม่</h1>
    
    <form @submit.prevent="createArticle">
      <!-- Slug -->
      <div>
        <label>Slug (URL):</label>
        <input v-model="form.slug" required>
      </div>
      
      <!-- Title -->
      <div>
        <label>หัวข้อ:</label>
        <input v-model="form.title" required>
      </div>
      
      <!-- Excerpt -->
      <div>
        <label>คำอธิบายสั้น:</label>
        <textarea v-model="form.excerpt"></textarea>
      </div>
      
      <!-- Featured Image -->
      <div>
        <label>รูปหน้าปก:</label>
        <input type="file" @change="uploadFeaturedImage" accept="image/*">
        <img v-if="form.featured_image" :src="form.featured_image" style="max-width: 200px;">
      </div>
      
      <!-- Content (Rich Text Editor) -->
      <div>
        <label>เนื้อหา:</label>
        <div id="editor"></div>
      </div>
      
      <!-- Author -->
      <div>
        <label>ผู้เขียน:</label>
        <input v-model="form.author">
      </div>
      
      <!-- Published At -->
      <div>
        <label>เผยแพร่เมื่อ:</label>
        <input type="datetime-local" v-model="form.published_at">
        <small>เว้นว่างไว้ = Draft</small>
      </div>
      
      <button type="submit">สร้างบทความ</button>
    </form>
  </div>
</template>

<script>
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export default {
  data() {
    return {
      quill: null,
      form: {
        slug: '',
        title: '',
        excerpt: '',
        content: '',
        featured_image: '',
        author: '',
        published_at: ''
      }
    };
  },
  mounted() {
    this.initEditor();
  },
  methods: {
    initEditor() {
      this.quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
          toolbar: {
            container: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline'],
              ['link', 'image'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['blockquote', 'code-block']
            ],
            handlers: {
              image: this.imageHandler
            }
          }
        }
      });
    },
    
    // Upload featured image
    async uploadFeaturedImage(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('http://localhost:3000/api/upload/tips-image', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        this.form.featured_image = data.data.url;
      }
    },
    
    // Upload content image (for Quill)
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
      };
    },
    
    // Create article
    async createArticle() {
      // Get HTML content from Quill
      this.form.content = this.quill.root.innerHTML;
      
      // Convert datetime-local to ISO string
      if (this.form.published_at) {
        this.form.published_at = new Date(this.form.published_at).toISOString();
      } else {
        this.form.published_at = null;
      }
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:3000/api/tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(this.form)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('สร้างบทความสำเร็จ!');
        this.$router.push(`/tips/${data.data.slug}`);
      } else {
        alert('Error: ' + data.error);
      }
    }
  }
};
</script>
```

---

### 4. แก้ไขบทความ (Admin Panel)

```javascript
async updateArticle(articleId, updates) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`http://localhost:3000/api/tips/${articleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates)
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Updated:', data.data);
  }
}

// ตัวอย่างการใช้งาน
updateArticle(1, {
  title: 'Updated Title',
  content: '<h1>New content</h1>'
});
```

---

### 5. ลบบทความ (Admin Panel)

```javascript
async deleteArticle(articleId) {
  if (!confirm('แน่ใจว่าต้องการลบบทความนี้?')) return;
  
  const token = localStorage.getItem('token');
  
  const response = await fetch(`http://localhost:3000/api/tips/${articleId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    alert('ลบบทความสำเร็จ!');
    // Redirect or refresh list
  }
}
```

---

## 🔒 Security Features

### 1. HTML Sanitization
Backend จะ sanitize HTML อัตโนมัติก่อนบันทึก:

```javascript
// Input (อันตราย)
"<script>alert('XSS')</script><h1>Title</h1>"

// Output (ปลอดภัย)
"<h1>Title</h1>"
```

**Tags ที่อนุญาต:**
- หัวข้อ: `h1, h2, h3, h4, h5, h6`
- ข้อความ: `p, br, strong, em, u`
- รายการ: `ul, ol, li`
- อื่นๆ: `a, img, blockquote, code, pre, table, div, span`

### 2. Authentication
- ใช้ JWT token
- Token expires ใน 15 นาที (ตรวจสอบใน middleware)
- เฉพาะ role = `admin` เท่านั้นที่สร้าง/แก้ไข/ลบได้

### 3. SQL Injection Protection
- ใช้ parameterized queries ($1, $2, $3)
- ไม่มี string interpolation

---

## 🚨 Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common Error Codes

| Code | Error | สาเหตุ | แก้ไข |
|------|-------|--------|------|
| 400 | Missing required fields | ไม่ส่ง slug/title/content | ส่งครบทุกฟิลด์ที่ required |
| 400 | Invalid page/limit | page/limit ไม่ถูกต้อง | ใช้ตัวเลขบวก |
| 401 | Access denied | ไม่มี token | Login ก่อน |
| 403 | Insufficient permissions | ไม่ใช่ admin | ใช้ admin account |
| 404 | Article not found | ไม่มี article นี้ | ตรวจสอบ ID/slug |
| 409 | Slug already exists | slug ซ้ำ | เปลี่ยน slug ใหม่ |
| 500 | Database error | Server error | ลองใหม่อีกครั้ง |

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

## ✅ Checklist สำหรับ Frontend

### หน้า Public (ไม่ต้อง login)
- [ ] หน้ารายการบทความ (GET /api/tips)
  - [ ] แสดงรายการบทความ
  - [ ] Pagination
  - [ ] แสดงรูป featured_image
  - [ ] Link ไปหน้าบทความเดี่ยว
  
- [ ] หน้าบทความเดี่ยว (GET /api/tips/:slug)
  - [ ] แสดงหัวข้อ, ผู้เขียน, วันที่
  - [ ] แสดงรูป featured_image
  - [ ] แสดง content ด้วย v-html
  - [ ] Handle 404 (บทความไม่เจอ)

### หน้า Admin (ต้อง login)
- [ ] Login page (POST /api/auth/login)
  - [ ] Form login
  - [ ] เก็บ token ใน localStorage
  - [ ] Redirect หลัง login สำเร็จ
  
- [ ] สร้างบทความ (POST /api/tips)
  - [ ] Form ครบทุกฟิลด์
  - [ ] Rich Text Editor (Quill.js)
  - [ ] Upload featured image
  - [ ] Upload content images (ใน editor)
  - [ ] เลือก published_at (หรือเว้นว่าง = draft)
  - [ ] Handle errors
  
- [ ] แก้ไขบทความ (PUT /api/tips/:id)
  - [ ] โหลดข้อมูลเดิม
  - [ ] Form แก้ไข
  - [ ] Rich Text Editor
  - [ ] Upload รูปใหม่
  - [ ] Save changes
  
- [ ] ลบบทความ (DELETE /api/tips/:id)
  - [ ] Confirm dialog
  - [ ] ลบและ redirect

---

## 🎯 สรุป

### ✅ Backend พร้อมใช้งาน
1. ✅ Tips CRUD API (GET, POST, PUT, DELETE)
2. ✅ Image Upload API (featured + content)
3. ✅ Authentication & Authorization
4. ✅ HTML Sanitization (ป้องกัน XSS)
5. ✅ SQL Injection Protection
6. ✅ Published Logic (draft/scheduled/published)
7. ✅ Pagination
8. ✅ Error Handling

### 📝 Frontend ต้องทำ
1. หน้ารายการบทความ (public)
2. หน้าบทความเดี่ยว (public)
3. Login page (admin)
4. สร้างบทความ (admin)
5. แก้ไขบทความ (admin)
6. ลบบทความ (admin)
7. Rich Text Editor integration (Quill.js)
8. Image upload integration

---

## 📚 เอกสารเพิ่มเติม

- **TIPS_IMAGE_UPLOAD_API.md** - รายละเอียด Image Upload API
- **docs/TIPS_API_DOCUMENTATION.md** - เอกสารฉบับเต็ม (EN)
- **docs/TIPS_API_EXAMPLES.md** - ตัวอย่างเพิ่มเติม (EN)
- **Frontend_TEST/tips-image-upload-test.html** - หน้าทดสอบ upload

---

## 🚀 เริ่มต้นใช้งาน

```bash
# 1. Start server
npm run dev

# 2. Test API
curl http://localhost:3000/api/tips

# 3. Test image upload
open Frontend_TEST/tips-image-upload-test.html
```

**พร้อมทำ Frontend แล้ว!** 🎉
