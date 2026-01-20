# 📝 สรุปการแก้ไข Tips API

## 🎯 สิ่งที่แก้ไข

### 1. ✅ เพิ่ม Authentication & Authorization
**ปัญหาเดิม:** ใครก็สามารถสร้าง/แก้ไข/ลบบทความได้

**แก้ไขแล้ว:**
- เฉพาะ **Admin** เท่านั้นที่สามารถ POST/PUT/DELETE ได้
- ใช้ middleware `authenticate` + `authorize(['admin'])`
- ต้องส่ง JWT token ใน header: `Authorization: Bearer <token>`

**ตัวอย่าง:**
```javascript
// เดิม (ไม่ปลอดภัย)
router.post('/', async (req, res) => { ... });

// ใหม่ (ปลอดภัย)
router.post('/', authenticate, authorize(['admin']), async (req, res) => { ... });
```

---

### 2. ✅ เพิ่ม HTML Sanitization
**ปัญหาเดิม:** รับ HTML มาเก็บตรงๆ เสี่ยง XSS attack

**แก้ไขแล้ว:**
- ติดตั้ง `isomorphic-dompurify`
- Sanitize HTML ก่อนบันทึกลง database
- อนุญาตเฉพาะ HTML tags ที่ปลอดภัย

**ตัวอย่าง:**
```javascript
// Input จาก Admin Panel
const content = "<script>alert('hack')</script><h1>Title</h1>";

// หลัง Sanitize
const sanitized = "<h1>Title</h1>"; // ลบ <script> ออก
```

**Tags ที่อนุญาต:**
- หัวข้อ: `h1, h2, h3, h4, h5, h6`
- ข้อความ: `p, br, strong, em, u`
- รายการ: `ul, ol, li`
- อื่นๆ: `a, img, blockquote, code, pre, table`

---

### 3. ✅ แก้ไข SQL Injection Bug
**ปัญหาเดิม:** ใช้ string interpolation ใน SQL query

**แก้ไขแล้ว:**
```javascript
// เดิม (อันตราย)
query += ` LIMIT ${paramCount} OFFSET ${paramCount + 1}`;

// ใหม่ (ปลอดภัย)
query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
params.push(validatedLimit, offset);
```

---

### 4. ✅ Published Logic (เดิมมีอยู่แล้ว)
**การทำงาน:**
- `published_at = NULL` → Draft (ไม่แสดง)
- `published_at = อนาคต` → Scheduled (ยังไม่แสดง)
- `published_at ≤ ปัจจุบัน` → Published (แสดงแล้ว)

**ตัวอย่าง:**
```javascript
// Draft
{ published_at: null }

// Scheduled (จะแสดง 31 ธ.ค. 2025)
{ published_at: "2025-12-31T00:00:00Z" }

// Published (แสดงแล้ว)
{ published_at: "2025-01-20T10:00:00Z" }
```

---

### 5. ✅ Slug Uniqueness (เดิมมีอยู่แล้ว)
**การทำงาน:**
- Database มี constraint `UNIQUE` บน `slug`
- ป้องกัน duplicate URL
- ถ้า slug ซ้ำจะ return error 409

---

## 📦 Dependencies ที่เพิ่ม

```bash
npm install sanitize-html
```

**Note:** ใช้ `sanitize-html` ซึ่งเป็น pure Node.js library ที่ไม่มี dependency conflict

---

## 🔄 การเปลี่ยนแปลงในโค้ด

### ไฟล์: `routes/tips.js`

#### 1. เพิ่ม imports
```javascript
const { authenticate, authorize } = require('../middleware/auth');
const sanitizeHtml = require('sanitize-html');
```

#### 2. เพิ่ม middleware ใน POST/PUT/DELETE
```javascript
// POST
router.post('/', authenticate, authorize(['admin']), async (req, res) => {

// PUT
router.put('/:id', authenticate, authorize(['admin']), async (req, res) => {

// DELETE
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
```

#### 3. เพิ่ม sanitization ใน POST
```javascript
const sanitizedContent = sanitizeHtml(content, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', ...],
    allowedAttributes: {
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title'],
        '*': ['class', 'id']
    }
});
```

#### 4. เพิ่ม sanitization ใน PUT
```javascript
if (field === 'content') {
    params.push(sanitizeHtml(data[field], { ... }));
} else {
    params.push(data[field]);
}
```

---

## 🎨 Rich Text Editor (Frontend)

### ไม่ต้องแก้ Backend!
Backend รับ HTML string มาเก็บตรงๆ ไม่ต้องแก้อะไร

### ที่ต้องแก้: Frontend

#### 1. Admin Panel - ใช้ Rich Text Editor

**ติดตั้ง Quill.js:**
```html
<link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
<script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
```

**เปลี่ยนจาก textarea → Quill:**
```html
<!-- เดิม -->
<textarea v-model="content"></textarea>

<!-- ใหม่ -->
<div id="editor"></div>

<script>
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

// เมื่อ Save
const htmlContent = quill.root.innerHTML;
// ส่ง htmlContent ไปยัง API
</script>
```

#### 2. Frontend Display - แสดง HTML

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

## 🔐 วิธีใช้งาน API (สำหรับ Admin)

### 1. Login ก่อน
```bash
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "password"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. สร้างบทความ (ต้องใส่ token)
```bash
POST /api/tips
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json

Body:
{
  "slug": "my-article",
  "title": "My Article",
  "content": "<h1>Title</h1><p>Content</p>",
  "published_at": "2025-01-20T10:00:00Z"
}
```

### 3. แก้ไขบทความ
```bash
PUT /api/tips/1
Headers:
  Authorization: Bearer <token>

Body:
{
  "title": "Updated Title"
}
```

### 4. ลบบทความ
```bash
DELETE /api/tips/1
Headers:
  Authorization: Bearer <token>
```

---

## 🚨 Error Codes

| Code | Error | สาเหตุ | แก้ไข |
|------|-------|--------|------|
| 400 | Missing required fields | ไม่ส่ง slug/title/content | ส่งครบ |
| 401 | Access denied | ไม่มี token | Login ก่อน |
| 403 | Insufficient permissions | ไม่ใช่ admin | ใช้ admin account |
| 404 | Article not found | ไม่มี article นี้ | ตรวจสอบ ID |
| 409 | Slug already exists | slug ซ้ำ | เปลี่ยน slug |

---

## 📊 เปรียบเทียบ Before/After

### Before (ไม่ปลอดภัย)
```javascript
// ❌ ใครก็เรียกได้
router.post('/', async (req, res) => {
    const { content } = req.body;
    // ❌ เก็บ HTML ตรงๆ (เสี่ยง XSS)
    await pool.query('INSERT INTO tips (content) VALUES ($1)', [content]);
});
```

### After (ปลอดภัย)
```javascript
// ✅ เฉพาะ admin
router.post('/', authenticate, authorize(['admin']), async (req, res) => {
    const { content } = req.body;
    // ✅ Sanitize HTML ก่อน
    const sanitized = sanitizeHtml(content, { ... });
    await pool.query('INSERT INTO tips (content) VALUES ($1)', [sanitized]);
});
```

---

## ✅ Checklist

### Backend
- [x] เพิ่ม authentication middleware
- [x] เพิ่ม authorization (admin only)
- [x] ติดตั้ง DOMPurify
- [x] Sanitize HTML ใน POST
- [x] Sanitize HTML ใน PUT
- [x] แก้ SQL injection bug
- [x] เขียน documentation

### Frontend (ต้องทำต่อ)
- [ ] ติดตั้ง Rich Text Editor (Quill.js)
- [ ] เปลี่ยน textarea → Editor ใน Admin Panel
- [ ] เปลี่ยน `{{ }}` → `v-html` ใน Display Page
- [ ] ทดสอบสร้าง/แก้ไขบทความ
- [ ] ทดสอบแสดงผล HTML

---

## 🎯 สรุป

### สิ่งที่ทำเสร็จแล้ว (Backend)
1. ✅ เพิ่ม auth protection (admin only)
2. ✅ เพิ่ม HTML sanitization (ป้องกัน XSS)
3. ✅ แก้ SQL injection bug
4. ✅ Published logic ทำงานถูกต้อง
5. ✅ Slug uniqueness ทำงานถูกต้อง

### สิ่งที่ต้องทำต่อ (Frontend)
1. ⏳ เพิ่ม Rich Text Editor ใน Admin Panel
2. ⏳ แสดง HTML ใน Frontend Display

### ไม่ต้องแก้
- ❌ Database schema (ใช้เดิมได้)
- ❌ API endpoints (ใช้เดิมได้)
- ❌ Response format (เหมือนเดิม)

---

## 📞 ติดต่อ

มีคำถามเพิ่มเติม? ถามได้เลยครับ! 😊
