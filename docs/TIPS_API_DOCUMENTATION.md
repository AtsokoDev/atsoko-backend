# 📝 Tips API Documentation

## Overview
Tips API เป็น RESTful API สำหรับจัดการบทความ/Blog posts ของเว็บไซต์ รองรับการสร้าง แก้ไข ลบ และแสดงบทความ พร้อมระบบ authentication และ authorization

---

## 🔐 Authentication & Authorization

### การทำงาน
- **GET endpoints** (ดูบทความ): เปิดให้ทุกคนเข้าถึงได้ (Public)
- **POST/PUT/DELETE endpoints**: ต้อง login และมี role = `admin` เท่านั้น

### วิธีใช้งาน
ส่ง JWT token ใน header:
```
Authorization: Bearer <your_jwt_token>
```

### Response Codes
- `401 Unauthorized`: ไม่มี token หรือ token ไม่ถูกต้อง
- `403 Forbidden`: Login แล้วแต่ไม่มีสิทธิ์ (ไม่ใช่ admin)

---

## 🗄️ Database Schema

```sql
CREATE TABLE tips (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image VARCHAR(500),
  author VARCHAR(255),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Field Descriptions
| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL | Primary key (auto-increment) |
| `slug` | VARCHAR(255) | URL-friendly identifier (unique) เช่น `how-to-rent-factory` |
| `title` | VARCHAR(500) | หัวข้อบทความ |
| `excerpt` | TEXT | เนื้อหาย่อ/สรุป (optional) |
| `content` | TEXT | เนื้อหาเต็ม (รองรับ HTML) |
| `featured_image` | VARCHAR(500) | URL รูปภาพหลัก (optional) |
| `author` | VARCHAR(255) | ชื่อผู้เขียน (optional) |
| `published_at` | TIMESTAMP | วันที่เผยแพร่ (NULL = draft) |
| `created_at` | TIMESTAMP | วันที่สร้าง (auto) |
| `updated_at` | TIMESTAMP | วันที่แก้ไขล่าสุด (auto) |

---

## 📡 API Endpoints

### 1. GET /api/tips - List all articles
**Access:** Public (ไม่ต้อง login)

**Query Parameters:**
- `page` (optional): หน้าที่ต้องการ (default: 1)
- `limit` (optional): จำนวนรายการต่อหน้า (default: 20, max: 100)
- `published` (optional): กรองตามสถานะ
  - `true` (default): แสดงเฉพาะที่ publish แล้ว
  - `false`: แสดงเฉพาะ draft
  - `all`: แสดงทั้งหมด

**Example Request:**
```bash
GET /api/tips?page=1&limit=10&published=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "how-to-rent-factory",
      "title": "How to Rent a Factory in Thailand",
      "excerpt": "Complete guide...",
      "content": "<h1>Title</h1><p>Content...</p>",
      "featured_image": "https://example.com/image.jpg",
      "author": "John Doe",
      "published_at": "2025-01-20T10:00:00.000Z",
      "created_at": "2025-01-15T08:00:00.000Z",
      "updated_at": "2025-01-20T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

---

### 2. GET /api/tips/:slug - Get single article
**Access:** Public (ไม่ต้อง login)

**Example Request:**
```bash
GET /api/tips/how-to-rent-factory
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "how-to-rent-factory",
    "title": "How to Rent a Factory in Thailand",
    "content": "<h1>Title</h1><p>Content...</p>",
    ...
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Article not found"
}
```

---

### 3. POST /api/tips - Create new article
**Access:** 🔒 Admin only

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "slug": "how-to-rent-factory",
  "title": "How to Rent a Factory in Thailand",
  "excerpt": "Complete guide for renting factories",
  "content": "<h1>Introduction</h1><p>This is a guide...</p>",
  "featured_image": "https://example.com/image.jpg",
  "author": "John Doe",
  "published_at": "2025-01-20T10:00:00.000Z"
}
```

**Required Fields:**
- `slug` ✅
- `title` ✅
- `content` ✅

**Optional Fields:**
- `excerpt`
- `featured_image`
- `author`
- `published_at` (ถ้าไม่ใส่ = draft)

**Response (201):**
```json
{
  "success": true,
  "data": { ... },
  "message": "Article created successfully"
}
```

**Error Responses:**
- `400`: Missing required fields
- `401`: Not authenticated
- `403`: Not admin
- `409`: Slug already exists

---

### 4. PUT /api/tips/:id - Update article
**Access:** 🔒 Admin only

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Example Request:**
```bash
PUT /api/tips/1
```

**Request Body (partial update):**
```json
{
  "title": "Updated Title",
  "content": "<h1>Updated Content</h1>"
}
```

**Allowed Fields:**
- `slug`
- `title`
- `excerpt`
- `content`
- `featured_image`
- `author`
- `published_at`

**Note:** `updated_at` จะถูกอัปเดตอัตโนมัติ

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Article updated successfully"
}
```

**Error Responses:**
- `400`: Empty body or no valid fields
- `401`: Not authenticated
- `403`: Not admin
- `404`: Article not found
- `409`: Duplicate slug

---

### 5. DELETE /api/tips/:id - Delete article
**Access:** 🔒 Admin only

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Example Request:**
```bash
DELETE /api/tips/1
```

**Response:**
```json
{
  "success": true,
  "message": "Article deleted successfully",
  "data": { ... }
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: Not admin
- `404`: Article not found

---

## 🔒 Security Features

### 1. HTML Sanitization
ทุกครั้งที่บันทึก `content` จะผ่านการ sanitize ด้วย **DOMPurify** เพื่อป้องกัน XSS attacks

**Allowed HTML Tags:**
```
p, br, strong, em, u, h1, h2, h3, h4, h5, h6,
ul, ol, li, a, img, blockquote, code, pre, hr,
table, thead, tbody, tr, th, td, div, span
```

**Allowed Attributes:**
```
href, src, alt, title, class, id, target, rel
```

**ตัวอย่าง:**
```javascript
// Input (อันตราย)
"<script>alert('XSS')</script><p>Hello</p>"

// Output (ปลอดภัย)
"<p>Hello</p>"
```

### 2. Role-Based Access Control (RBAC)
- ใช้ middleware `authenticate` + `authorize(['admin'])`
- ตรวจสอบ JWT token และ role ของ user
- เฉพาะ admin เท่านั้นที่สร้าง/แก้ไข/ลบได้

### 3. Slug Uniqueness
- Database constraint: `UNIQUE` บน `slug`
- ป้องกัน duplicate URL
- Error code: `23505`

---

## 📅 Published Logic

### Draft vs Published
- **Draft**: `published_at` = `NULL` หรือเป็นวันที่ในอนาคต
- **Published**: `published_at` ≤ ปัจจุบัน

### ตัวอย่าง
```javascript
// Draft (ยังไม่แสดง)
{ published_at: null }
{ published_at: "2025-12-31T00:00:00Z" } // อนาคต

// Published (แสดงแล้ว)
{ published_at: "2025-01-20T10:00:00Z" } // อดีต
```

### Query Filter
```sql
-- Published only
WHERE published_at IS NOT NULL AND published_at <= NOW()

-- Draft only
WHERE published_at IS NULL OR published_at > NOW()
```

---

## 🎨 Rich Text Editor Integration

### Frontend Implementation

#### 1. Admin Panel (Create/Edit)
ใช้ **Quill.js** หรือ Rich Text Editor อื่นๆ

```html
<!-- Include Quill -->
<link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
<script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>

<!-- Editor Container -->
<div id="editor"></div>

<script>
// Initialize Quill
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      ['link', 'image'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }]
    ]
  }
});

// Get HTML content
const htmlContent = quill.root.innerHTML;

// Send to API
fetch('/api/tips', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    slug: 'my-article',
    title: 'My Article',
    content: htmlContent // HTML string
  })
});
</script>
```

#### 2. Frontend Display
แสดง HTML ที่ได้จาก API

**React:**
```jsx
<div dangerouslySetInnerHTML={{ __html: article.content }} />
```

**Vue:**
```vue
<div v-html="article.content"></div>
```

**Vanilla JS:**
```javascript
document.getElementById('article').innerHTML = article.content;
```

---

## 🧪 Testing Examples

### 1. Create Article (Admin)
```bash
curl -X POST http://localhost:3000/api/tips \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-article",
    "title": "Test Article",
    "content": "<h1>Hello World</h1><p>This is a test.</p>",
    "published_at": "2025-01-20T10:00:00Z"
  }'
```

### 2. List Published Articles (Public)
```bash
curl http://localhost:3000/api/tips?page=1&limit=10
```

### 3. Get Single Article (Public)
```bash
curl http://localhost:3000/api/tips/test-article
```

### 4. Update Article (Admin)
```bash
curl -X PUT http://localhost:3000/api/tips/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title"
  }'
```

### 5. Delete Article (Admin)
```bash
curl -X DELETE http://localhost:3000/api/tips/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🚨 Common Errors

### 1. Unauthorized (401)
```json
{
  "success": false,
  "error": "Access denied. No token provided."
}
```
**Solution:** ส่ง JWT token ใน Authorization header

### 2. Forbidden (403)
```json
{
  "success": false,
  "error": "Access denied. Insufficient permissions."
}
```
**Solution:** ต้อง login ด้วย admin account

### 3. Duplicate Slug (409)
```json
{
  "success": false,
  "error": "Article with this slug already exists"
}
```
**Solution:** เปลี่ยน slug ให้ unique

### 4. Missing Fields (400)
```json
{
  "success": false,
  "error": "Missing required fields: slug, title, content"
}
```
**Solution:** ส่ง slug, title, content ครบ

---

## 📊 Summary

| Feature | Status |
|---------|--------|
| ✅ CRUD Operations | Implemented |
| ✅ Authentication | JWT-based |
| ✅ Authorization | Admin-only for CUD |
| ✅ HTML Sanitization | DOMPurify |
| ✅ Slug Uniqueness | Database constraint |
| ✅ Published Logic | Timestamp-based |
| ✅ Pagination | Supported |
| ✅ Rich Text Support | HTML in content field |

---

## 🔄 Changelog

### Version 1.1 (2025-01-20)
- ✅ เพิ่ม authentication & authorization
- ✅ เพิ่ม HTML sanitization (DOMPurify)
- ✅ แก้ไข SQL injection vulnerability
- ✅ เพิ่ม documentation

### Version 1.0 (Initial)
- ✅ Basic CRUD operations
- ✅ Pagination support
- ✅ Published/draft filtering
