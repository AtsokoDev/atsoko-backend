# 🧪 Tips API - ตัวอย่างการใช้งาน

## 📋 Table of Contents
1. [Setup & Authentication](#setup--authentication)
2. [Public Endpoints (ไม่ต้อง login)](#public-endpoints)
3. [Admin Endpoints (ต้อง login)](#admin-endpoints)
4. [Frontend Integration](#frontend-integration)
5. [Error Handling](#error-handling)

---

## Setup & Authentication

### 1. Login เพื่อรับ Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTY0...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

**เก็บ token ไว้ใช้:**
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Public Endpoints

### 1. ดูรายการบทความทั้งหมด

```bash
# แสดงหน้าแรก (10 รายการ)
curl http://localhost:3000/api/tips?page=1&limit=10

# แสดงเฉพาะที่ publish แล้ว (default)
curl http://localhost:3000/api/tips?published=true

# แสดงเฉพาะ draft
curl http://localhost:3000/api/tips?published=false

# แสดงทั้งหมด
curl http://localhost:3000/api/tips?published=all
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "how-to-rent-factory-thailand",
      "title": "How to Rent a Factory in Thailand",
      "excerpt": "Complete guide for renting industrial properties",
      "content": "<h1>Introduction</h1><p>Renting a factory...</p>",
      "featured_image": "https://example.com/factory.jpg",
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

### 2. ดูบทความเดี่ยว (ตาม slug)

```bash
curl http://localhost:3000/api/tips/how-to-rent-factory-thailand
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "how-to-rent-factory-thailand",
    "title": "How to Rent a Factory in Thailand",
    "content": "<h1>Introduction</h1><p>Content here...</p>",
    ...
  }
}
```

---

## Admin Endpoints

### 1. สร้างบทความใหม่ (Draft)

```bash
curl -X POST http://localhost:3000/api/tips \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "factory-rental-tips",
    "title": "5 Tips for Renting a Factory",
    "excerpt": "Essential tips you need to know",
    "content": "<h1>Tip 1: Location</h1><p>Choose the right location...</p><h2>Tip 2: Size</h2><p>Calculate your space needs...</p>",
    "author": "Jane Smith"
  }'
```

**Note:** ไม่ใส่ `published_at` = บันทึกเป็น draft

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "slug": "factory-rental-tips",
    "title": "5 Tips for Renting a Factory",
    "published_at": null,
    ...
  },
  "message": "Article created successfully"
}
```

### 2. สร้างบทความและ Publish ทันที

```bash
curl -X POST http://localhost:3000/api/tips \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "warehouse-vs-factory",
    "title": "Warehouse vs Factory: What is the Difference?",
    "excerpt": "Understanding the key differences",
    "content": "<h1>Introduction</h1><p>Many people confuse...</p>",
    "featured_image": "https://example.com/warehouse-factory.jpg",
    "author": "John Doe",
    "published_at": "2025-01-20T10:00:00.000Z"
  }'
```

### 3. สร้างบทความแบบ Scheduled (เผยแพร่ในอนาคต)

```bash
curl -X POST http://localhost:3000/api/tips \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "industrial-trends-2026",
    "title": "Industrial Property Trends 2026",
    "content": "<h1>Predictions for 2026</h1><p>...</p>",
    "published_at": "2026-01-01T00:00:00.000Z"
  }'
```

**Note:** บทความจะแสดงอัตโนมัติเมื่อถึงวันที่ 1 ม.ค. 2026

### 4. แก้ไขบทความ (Partial Update)

```bash
# แก้เฉพาะ title
curl -X PUT http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "10 Tips for Renting a Factory (Updated)"
  }'

# แก้หลายฟิลด์พร้อมกัน
curl -X PUT http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "10 Tips for Renting a Factory",
    "excerpt": "Updated excerpt with more details",
    "content": "<h1>Updated Content</h1><p>New content...</p>"
  }'
```

### 5. Publish บทความ Draft

```bash
curl -X PUT http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "published_at": "2025-01-20T10:00:00.000Z"
  }'
```

### 6. เปลี่ยนบทความเป็น Draft (Unpublish)

```bash
curl -X PUT http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "published_at": null
  }'
```

### 7. ลบบทความ

```bash
curl -X DELETE http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Article deleted successfully",
  "data": {
    "id": 2,
    "slug": "factory-rental-tips",
    ...
  }
}
```

---

## Frontend Integration

### JavaScript/Fetch API

#### 1. ดึงรายการบทความ
```javascript
async function getArticles(page = 1, limit = 10) {
  const response = await fetch(
    `http://localhost:3000/api/tips?page=${page}&limit=${limit}`
  );
  const data = await response.json();
  
  if (data.success) {
    console.log('Articles:', data.data);
    console.log('Total pages:', data.pagination.pages);
  }
}
```

#### 2. ดึงบทความเดี่ยว
```javascript
async function getArticle(slug) {
  const response = await fetch(`http://localhost:3000/api/tips/${slug}`);
  const data = await response.json();
  
  if (data.success) {
    // แสดง HTML content
    document.getElementById('article-content').innerHTML = data.data.content;
  }
}
```

#### 3. สร้างบทความ (Admin)
```javascript
async function createArticle(articleData, token) {
  const response = await fetch('http://localhost:3000/api/tips', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(articleData)
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Article created:', data.data);
  } else {
    console.error('Error:', data.error);
  }
}

// ใช้งาน
createArticle({
  slug: 'my-article',
  title: 'My Article',
  content: '<h1>Hello</h1>',
  published_at: new Date().toISOString()
}, 'your_token_here');
```

### React Example

```jsx
import { useState, useEffect } from 'react';

function ArticleList() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/tips?page=1&limit=10')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setArticles(data.data);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {articles.map(article => (
        <article key={article.id}>
          <h2>{article.title}</h2>
          <p>{article.excerpt}</p>
          <div dangerouslySetInnerHTML={{ __html: article.content }} />
        </article>
      ))}
    </div>
  );
}
```

### Vue Example

```vue
<template>
  <div>
    <article v-for="article in articles" :key="article.id">
      <h2>{{ article.title }}</h2>
      <p>{{ article.excerpt }}</p>
      <div v-html="article.content"></div>
    </article>
  </div>
</template>

<script>
export default {
  data() {
    return {
      articles: []
    };
  },
  async mounted() {
    const response = await fetch('http://localhost:3000/api/tips');
    const data = await response.json();
    if (data.success) {
      this.articles = data.data;
    }
  }
};
</script>
```

### Quill.js Integration (Admin Panel)

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
</head>
<body>
  <div id="editor-container"></div>
  <button onclick="saveArticle()">Save Article</button>

  <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
  <script>
    // Initialize Quill
    const quill = new Quill('#editor-container', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          ['link', 'image'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['blockquote', 'code-block']
        ]
      }
    });

    async function saveArticle() {
      const content = quill.root.innerHTML;
      const token = localStorage.getItem('admin_token');
      
      const response = await fetch('http://localhost:3000/api/tips', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slug: 'my-article',
          title: 'My Article',
          content: content,
          published_at: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Article saved!');
      } else {
        alert('Error: ' + data.error);
      }
    }
  </script>
</body>
</html>
```

---

## Error Handling

### 1. Handle 401 (Unauthorized)
```javascript
async function createArticle(data, token) {
  const response = await fetch('http://localhost:3000/api/tips', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (response.status === 401) {
    // Token expired or invalid
    alert('Please login again');
    window.location.href = '/login';
    return;
  }

  const result = await response.json();
  return result;
}
```

### 2. Handle 403 (Forbidden)
```javascript
if (response.status === 403) {
  alert('You do not have permission to perform this action');
  return;
}
```

### 3. Handle 409 (Duplicate Slug)
```javascript
const result = await response.json();

if (response.status === 409) {
  alert('This slug already exists. Please choose a different one.');
  return;
}
```

### 4. Complete Error Handler
```javascript
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      switch (response.status) {
        case 400:
          throw new Error(data.error || 'Bad request');
        case 401:
          // Redirect to login
          window.location.href = '/login';
          throw new Error('Unauthorized');
        case 403:
          throw new Error('You do not have permission');
        case 404:
          throw new Error('Article not found');
        case 409:
          throw new Error('Slug already exists');
        default:
          throw new Error('Server error');
      }
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    alert(error.message);
    throw error;
  }
}

// ใช้งาน
try {
  const result = await apiRequest('http://localhost:3000/api/tips', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(articleData)
  });
  console.log('Success:', result);
} catch (error) {
  // Error already handled
}
```

---

## Testing Checklist

### Public Endpoints
- [ ] GET /api/tips - ดึงรายการบทความ
- [ ] GET /api/tips?published=true - เฉพาะ published
- [ ] GET /api/tips?published=false - เฉพาะ draft
- [ ] GET /api/tips/:slug - ดึงบทความเดี่ยว
- [ ] Pagination ทำงานถูกต้อง

### Admin Endpoints (ต้อง login)
- [ ] POST /api/tips - สร้างบทความ draft
- [ ] POST /api/tips - สร้างบทความ published
- [ ] POST /api/tips - สร้างบทความ scheduled
- [ ] PUT /api/tips/:id - แก้ไขบทความ
- [ ] PUT /api/tips/:id - Publish draft
- [ ] PUT /api/tips/:id - Unpublish article
- [ ] DELETE /api/tips/:id - ลบบทความ

### Security
- [ ] POST/PUT/DELETE ไม่มี token → 401
- [ ] POST/PUT/DELETE ใช้ agent token → 403
- [ ] HTML sanitization ทำงาน (ลบ <script>)
- [ ] Duplicate slug → 409

### Frontend
- [ ] แสดงรายการบทความ
- [ ] แสดง HTML content ถูกต้อง
- [ ] Rich text editor ทำงาน
- [ ] สร้าง/แก้ไข/ลบบทความได้

---

## 🎉 สรุป

เอกสารนี้แสดงตัวอย่างการใช้งาน Tips API ครบทุกกรณี:
- ✅ Public endpoints (ไม่ต้อง auth)
- ✅ Admin endpoints (ต้อง auth)
- ✅ Frontend integration (React, Vue, Vanilla JS)
- ✅ Rich text editor (Quill.js)
- ✅ Error handling

มีคำถามเพิ่มเติม? ถามได้เลยครับ! 😊
