# 📧 Contact API Documentation

## Overview
Contact API สำหรับจัดการฟอร์มติดต่อของเว็บไซต์ รองรับการส่งข้อความ, แจ้งเตือนทางอีเมล, และจัดการข้อความโดย Admin

---

## 🔐 Authentication & Authorization

### Access Control
- **POST** (submit form): 🔓 Public (มี rate limiting)
- **GET/PUT/DELETE**: 🔒 Admin only

### Rate Limiting
- **Limit**: 5 requests ต่อ 15 นาที ต่อ IP address
- **Applies to**: POST /api/contact เท่านั้น

---

## 🗄️ Database Schema

```sql
CREATE TABLE contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  subject VARCHAR(500),
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new',
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Status Values
| Status | Description |
|--------|-------------|
| `new` | ข้อความใหม่ (default) |
| `read` | อ่านแล้ว |
| `replied` | ตอบกลับแล้ว |
| `archived` | เก็บถาวร |

---

## 📡 API Endpoints

### 1. POST /api/contact - Submit Contact Form

ส่งฟอร์มติดต่อ (Public endpoint with rate limiting)

> 🔓 **Public Access** - ไม่ต้อง authentication
> 
> ⚠️ **Rate Limited** - 5 requests ต่อ 15 นาที ต่อ IP

#### Request Body

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "0812345678",
  "subject": "Inquiry about warehouse rental",
  "message": "I'm interested in renting a warehouse in Bangkok..."
}
```

**Required fields**: `name`, `email`, `message`

**Optional fields**: `phone`, `subject`

#### Response (201)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "0812345678",
    "subject": "Inquiry about warehouse rental",
    "message": "I'm interested in renting a warehouse...",
    "status": "new",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "created_at": "2025-01-20T10:00:00.000Z",
    "updated_at": "2025-01-20T10:00:00.000Z"
  },
  "message": "Contact message submitted successfully"
}
```

#### Error Responses

```json
// 400 - Missing required fields
{
  "success": false,
  "error": "Missing required fields: name, email, message"
}

// 400 - Invalid email
{
  "success": false,
  "error": "Invalid email format"
}

// 429 - Rate limit exceeded
{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

#### Email Notification

เมื่อส่งฟอร์มสำเร็จ ระบบจะส่งอีเมลแจ้งเตือนไปยัง admin อัตโนมัติ (ถ้า config ไว้)

**Required Environment Variables:**
```env
RESEND_API_KEY=re_your_api_key
ADMIN_EMAIL=admin@yourdomain.com
EMAIL_FROM=noreply@yourdomain.com
```

**Behavior:**
- ถ้าไม่ config → แสดง warning แต่ฟอร์มยังทำงานได้
- ถ้าส่งอีเมลไม่สำเร็จ → log error แต่ฟอร์มยังทำงานได้

---

### 2. GET /api/contact - List All Messages

ดึงรายการข้อความทั้งหมด พร้อม pagination และ filter

> 🔒 **Admin Only** - ต้อง authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
```

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | กรองตามสถานะ | `?status=new` |
| `page` | integer | หน้าที่ต้องการ (default: 1) | `?page=1` |
| `limit` | integer | จำนวนต่อหน้า (default: 50, max: 100) | `?limit=50` |

**Valid status values**: `new`, `read`, `replied`, `archived`

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "0812345678",
      "subject": "Inquiry about warehouse rental",
      "message": "I'm interested in renting a warehouse...",
      "status": "new",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2025-01-20T10:00:00.000Z",
      "updated_at": "2025-01-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "pages": 1
  }
}
```

#### Examples

```bash
# ดูข้อความใหม่ทั้งหมด
GET /api/contact?status=new

# ดูข้อความที่อ่านแล้ว (หน้า 2)
GET /api/contact?status=read&page=2&limit=20

# ดูทั้งหมด
GET /api/contact?page=1&limit=50
```

---

### 3. GET /api/contact/:id - Get Single Message

ดึงข้อความเดี่ยว

> 🔒 **Admin Only** - ต้อง authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | ID ของข้อความ |

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "0812345678",
    "subject": "Inquiry about warehouse rental",
    "message": "I'm interested in renting a warehouse...",
    "status": "new",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "created_at": "2025-01-20T10:00:00.000Z",
    "updated_at": "2025-01-20T10:00:00.000Z"
  }
}
```

#### Error Response (404)

```json
{
  "success": false,
  "error": "Message not found"
}
```

---

### 4. PUT /api/contact/:id - Update Message Status

อัปเดตสถานะข้อความ

> 🔒 **Admin Only** - ต้อง authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | ID ของข้อความ |

#### Request Body

```json
{
  "status": "read"
}
```

**Valid status values**: `new`, `read`, `replied`, `archived`

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "read",
    "updated_at": "2025-01-20T11:00:00.000Z",
    ...
  },
  "message": "Message status updated successfully"
}
```

#### Error Responses

```json
// 400 - Missing status
{
  "success": false,
  "error": "Status is required"
}

// 400 - Invalid status
{
  "success": false,
  "error": "Invalid status. Must be one of: new, read, replied, archived"
}

// 404 - Message not found
{
  "success": false,
  "error": "Message not found"
}
```

---

### 5. DELETE /api/contact/:id - Delete Message

ลบข้อความ

> 🔒 **Admin Only** - ต้อง authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | ID ของข้อความ |

#### Response

```json
{
  "success": true,
  "message": "Message deleted successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    ...
  }
}
```

#### Error Response (404)

```json
{
  "success": false,
  "error": "Message not found"
}
```

---

## 🎨 Frontend Integration

### 1. Public Contact Form (ไม่ต้อง login)

#### HTML Form

```html
<form id="contactForm">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <input type="tel" name="phone" placeholder="Phone (optional)">
  <input type="text" name="subject" placeholder="Subject (optional)">
  <textarea name="message" placeholder="Your Message" required></textarea>
  <button type="submit">Send Message</button>
</form>

<div id="message"></div>
```

#### JavaScript (Vanilla)

```javascript
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    name: e.target.name.value,
    email: e.target.email.value,
    phone: e.target.phone.value,
    subject: e.target.subject.value,
    message: e.target.message.value
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('message').innerHTML = 
        '<p class="success">Message sent successfully!</p>';
      e.target.reset();
    } else {
      document.getElementById('message').innerHTML = 
        `<p class="error">${data.error}</p>`;
    }
  } catch (error) {
    document.getElementById('message').innerHTML = 
      '<p class="error">Failed to send message. Please try again.</p>';
  }
});
```

#### React Example

```jsx
import { useState } from 'react';

function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch('http://localhost:3000/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setStatus({ type: 'success', message: 'Message sent successfully!' });
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      } else {
        setStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to send message. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="name"
        value={formData.name}
        onChange={handleChange}
        placeholder="Your Name"
        required
      />
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="Your Email"
        required
      />
      <input
        type="tel"
        name="phone"
        value={formData.phone}
        onChange={handleChange}
        placeholder="Phone (optional)"
      />
      <input
        type="text"
        name="subject"
        value={formData.subject}
        onChange={handleChange}
        placeholder="Subject (optional)"
      />
      <textarea
        name="message"
        value={formData.message}
        onChange={handleChange}
        placeholder="Your Message"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Message'}
      </button>
      
      {status.message && (
        <div className={`alert alert-${status.type}`}>
          {status.message}
        </div>
      )}
    </form>
  );
}
```

#### Vue Example

```vue
<template>
  <form @submit.prevent="submitForm">
    <input
      v-model="formData.name"
      type="text"
      placeholder="Your Name"
      required
    />
    <input
      v-model="formData.email"
      type="email"
      placeholder="Your Email"
      required
    />
    <input
      v-model="formData.phone"
      type="tel"
      placeholder="Phone (optional)"
    />
    <input
      v-model="formData.subject"
      type="text"
      placeholder="Subject (optional)"
    />
    <textarea
      v-model="formData.message"
      placeholder="Your Message"
      required
    />
    <button type="submit" :disabled="loading">
      {{ loading ? 'Sending...' : 'Send Message' }}
    </button>
    
    <div v-if="status.message" :class="`alert alert-${status.type}`">
      {{ status.message }}
    </div>
  </form>
</template>

<script>
export default {
  data() {
    return {
      formData: {
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      },
      status: { type: '', message: '' },
      loading: false
    };
  },
  methods: {
    async submitForm() {
      this.loading = true;
      this.status = { type: '', message: '' };

      try {
        const response = await fetch('http://localhost:3000/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.formData)
        });

        const data = await response.json();

        if (data.success) {
          this.status = { type: 'success', message: 'Message sent successfully!' };
          this.formData = { name: '', email: '', phone: '', subject: '', message: '' };
        } else {
          this.status = { type: 'error', message: data.error };
        }
      } catch (error) {
        this.status = { type: 'error', message: 'Failed to send message. Please try again.' };
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

---

### 2. Admin Panel (ต้อง login)

#### List Messages

```javascript
async function getMessages(status = null, page = 1) {
  const token = localStorage.getItem('admin_token');
  
  let url = `http://localhost:3000/api/contact?page=${page}&limit=50`;
  if (status) {
    url += `&status=${status}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Messages:', data.data);
    console.log('Total:', data.pagination.total);
  }
}

// ใช้งาน
getMessages('new', 1); // ดูข้อความใหม่หน้าแรก
```

#### Get Single Message

```javascript
async function getMessage(id) {
  const token = localStorage.getItem('admin_token');
  
  const response = await fetch(`http://localhost:3000/api/contact/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Message:', data.data);
  }
}
```

#### Update Status

```javascript
async function updateMessageStatus(id, status) {
  const token = localStorage.getItem('admin_token');
  
  const response = await fetch(`http://localhost:3000/api/contact/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Status updated:', data.data);
  }
}

// ใช้งาน
updateMessageStatus(1, 'read'); // เปลี่ยนเป็น read
updateMessageStatus(1, 'replied'); // เปลี่ยนเป็น replied
```

#### Delete Message

```javascript
async function deleteMessage(id) {
  const token = localStorage.getItem('admin_token');
  
  if (!confirm('Are you sure you want to delete this message?')) {
    return;
  }
  
  const response = await fetch(`http://localhost:3000/api/contact/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Message deleted');
  }
}
```

---

## 🔒 Security Features

### 1. Rate Limiting
- **Limit**: 5 requests ต่อ 15 นาที ต่อ IP
- **Applies to**: POST /api/contact
- **Purpose**: ป้องกัน spam และ abuse

### 2. Email Validation
- ตรวจสอบรูปแบบอีเมลด้วย regex
- ป้องกันอีเมลที่ไม่ถูกต้อง

### 3. IP Tracking
- เก็บ IP address และ User-Agent
- ใช้สำหรับติดตาม spam และวิเคราะห์พฤติกรรม

### 4. Authentication
- GET/PUT/DELETE ต้อง login ด้วย admin account
- ใช้ JWT token authentication

---

## 📧 Email Configuration

### Setup Resend

1. สมัครที่ [resend.com](https://resend.com) (free tier: 100 emails/day)
2. สร้าง API key
3. เพิ่มใน `.env`:

```env
RESEND_API_KEY=re_your_api_key_here
ADMIN_EMAIL=admin@yourdomain.com
EMAIL_FROM=noreply@yourdomain.com
```

4. Restart server

### Email Template

อีเมลที่ส่งไปยัง admin จะมี:
- ✅ Professional HTML design
- ✅ ข้อมูลครบถ้วน (name, email, phone, subject, message)
- ✅ Timestamp (Thailand timezone)
- ✅ IP address (สำหรับติดตาม spam)

---

## 🧪 Testing

### Test Contact Form (Public)

```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "0812345678",
    "subject": "Test Message",
    "message": "This is a test message"
  }'
```

### Test Rate Limiting

```bash
# ส่ง 6 ครั้งติดกัน (ครั้งที่ 6 จะถูก block)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/contact \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@test.com","message":"Test"}';
  echo "\nRequest $i";
done
```

### Test Admin Endpoints

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@atsoko.com","password":"admin123456"}' \
  | jq -r '.data.accessToken')

# 2. List messages
curl -s http://localhost:3000/api/contact \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 3. Get single message
curl -s http://localhost:3000/api/contact/1 \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 4. Update status
curl -s -X PUT http://localhost:3000/api/contact/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"read"}' | jq '.'

# 5. Delete message
curl -s -X DELETE http://localhost:3000/api/contact/1 \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## 🚨 Error Handling

### Frontend Error Handler

```javascript
async function submitContactForm(formData) {
  try {
    const response = await fetch('http://localhost:3000/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (!response.ok) {
      switch (response.status) {
        case 400:
          throw new Error(data.error || 'Invalid form data');
        case 429:
          throw new Error('Too many requests. Please try again later.');
        default:
          throw new Error('Failed to send message');
      }
    }

    return data;
  } catch (error) {
    console.error('Contact form error:', error);
    throw error;
  }
}
```

---

## 📊 Summary

| Feature | Status | Note |
|---------|--------|------|
| POST (submit form) | ✅ Public | Rate limited |
| GET (list messages) | ✅ Admin only | Protected |
| GET (single message) | ✅ Admin only | Protected |
| PUT (update status) | ✅ Admin only | Protected |
| DELETE (delete message) | ✅ Admin only | Protected |
| Rate Limiting | ✅ Active | 5 req/15min |
| Email Notification | ✅ Active | Resend API |
| IP Tracking | ✅ Active | Stored in DB |
| SQL Injection | ✅ Fixed | Parameterized queries |

---

**Contact API พร้อมใช้งานแล้ว!** 🎉
