# 📧 Contact API - 

สรุปการแก้ไขและการใช้งาน

## ✅ สิ่งที่แก้ไขเสร็จแล้ว

### 1. เพิ่ม Authentication & Authorization
- ✅ GET/PUT/DELETE ต้อง login ด้วย **Admin** เท่านั้น
- ✅ POST (submit form) เปิดให้ทุกคนใช้ได้ (Public)
- ✅ ใช้ JWT token authentication

### 2. แก้ SQL Injection
- ✅ เปลี่ยนจาก string interpolation → parameterized query
- ✅ ใช้ `$1, $2, $3` แทน `${variable}`

### 3. Features ที่มีอยู่แล้ว
- ✅ Rate Limiting (5 requests/15min)
- ✅ Email Notification (Resend API)
- ✅ IP Tracking
- ✅ Status Management

---

## 📂 ไฟล์ที่แก้ไข

1. **routes/contact.js** - เพิ่ม auth + แก้ SQL injection
2. **docs/CONTACT_API_DOCUMENTATION.md** - เอกสารฉบับเต็ม

---

## 🎯 API Endpoints

### Public Endpoint (ไม่ต้อง login)

#### POST /api/contact - ส่งฟอร์มติดต่อ

**Rate Limit:** 5 requests ต่อ 15 นาที ต่อ IP

```javascript
// ตัวอย่างการใช้งาน
const response = await fetch('http://localhost:3000/api/contact', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '0812345678',
    subject: 'Inquiry about warehouse',
    message: 'I am interested in...'
  })
});

const data = await response.json();
console.log(data);
```

**Required:** `name`, `email`, `message`

**Optional:** `phone`, `subject`

---

### Admin Endpoints (ต้อง login)

#### 1. GET /api/contact - ดูรายการข้อความ

```javascript
const token = localStorage.getItem('admin_token');

const response = await fetch('http://localhost:3000/api/contact?status=new&page=1', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
console.log(data.data); // รายการข้อความ
console.log(data.pagination); // ข้อมูล pagination
```

**Query Parameters:**
- `status` - กรองตามสถานะ (new, read, replied, archived)
- `page` - หน้าที่ต้องการ (default: 1)
- `limit` - จำนวนต่อหน้า (default: 50, max: 100)

---

#### 2. GET /api/contact/:id - ดูข้อความเดี่ยว

```javascript
const token = localStorage.getItem('admin_token');

const response = await fetch('http://localhost:3000/api/contact/1', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
console.log(data.data); // ข้อมูลข้อความ
```

---

#### 3. PUT /api/contact/:id - อัปเดตสถานะ

```javascript
const token = localStorage.getItem('admin_token');

const response = await fetch('http://localhost:3000/api/contact/1', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'read' // new, read, replied, archived
  })
});

const data = await response.json();
console.log(data.message); // "Message status updated successfully"
```

---

#### 4. DELETE /api/contact/:id - ลบข้อความ

```javascript
const token = localStorage.getItem('admin_token');

const response = await fetch('http://localhost:3000/api/contact/1', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
console.log(data.message); // "Message deleted successfully"
```

---

## 🎨 Frontend Examples

### 1. Contact Form (Public)

#### React Component

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
        setStatus({ type: 'success', message: 'ส่งข้อความสำเร็จ!' });
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      } else {
        setStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="ชื่อ"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        required
      />
      <input
        type="email"
        placeholder="อีเมล"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required
      />
      <input
        type="tel"
        placeholder="เบอร์โทร (ไม่บังคับ)"
        value={formData.phone}
        onChange={(e) => setFormData({...formData, phone: e.target.value})}
      />
      <input
        type="text"
        placeholder="หัวข้อ (ไม่บังคับ)"
        value={formData.subject}
        onChange={(e) => setFormData({...formData, subject: e.target.value})}
      />
      <textarea
        placeholder="ข้อความ"
        value={formData.message}
        onChange={(e) => setFormData({...formData, message: e.target.value})}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'กำลังส่ง...' : 'ส่งข้อความ'}
      </button>
      
      {status.message && (
        <div className={`alert alert-${status.type}`}>
          {status.message}
        </div>
      )}
    </form>
  );
}

export default ContactForm;
```

---

### 2. Admin Message List (Admin Panel)

#### React Component

```jsx
import { useState, useEffect } from 'react';

function MessageList() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('new');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    fetchMessages();
  }, [filter, page]);

  const fetchMessages = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');

    try {
      const response = await fetch(
        `http://localhost:3000/api/contact?status=${filter}&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessages(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    const token = localStorage.getItem('admin_token');

    try {
      const response = await fetch(`http://localhost:3000/api/contact/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        fetchMessages(); // Refresh list
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const deleteMessage = async (id) => {
    if (!confirm('ต้องการลบข้อความนี้หรือไม่?')) return;

    const token = localStorage.getItem('admin_token');

    try {
      const response = await fetch(`http://localhost:3000/api/contact/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        fetchMessages(); // Refresh list
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Contact Messages</h2>
      
      {/* Filter */}
      <div className="filters">
        <button onClick={() => setFilter('new')}>New ({pagination.total})</button>
        <button onClick={() => setFilter('read')}>Read</button>
        <button onClick={() => setFilter('replied')}>Replied</button>
        <button onClick={() => setFilter('archived')}>Archived</button>
      </div>

      {/* Message List */}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Subject</th>
            <th>Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {messages.map(msg => (
            <tr key={msg.id}>
              <td>{msg.name}</td>
              <td>{msg.email}</td>
              <td>{msg.subject || '-'}</td>
              <td>{new Date(msg.created_at).toLocaleDateString('th-TH')}</td>
              <td>
                <select
                  value={msg.status}
                  onChange={(e) => updateStatus(msg.id, e.target.value)}
                >
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="replied">Replied</option>
                  <option value="archived">Archived</option>
                </select>
              </td>
              <td>
                <button onClick={() => deleteMessage(msg.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>Page {page} of {pagination.pages}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page === pagination.pages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default MessageList;
```

---

## 📧 Email Configuration

### Setup Resend

1. สมัครที่ [resend.com](https://resend.com)
2. สร้าง API key
3. เพิ่มใน `.env`:

```env
RESEND_API_KEY=re_your_api_key_here
ADMIN_EMAIL=admin@yourdomain.com
EMAIL_FROM=noreply@yourdomain.com
```

4. Restart server

### Email Features

- ✅ ส่งอีเมลแจ้งเตือน admin อัตโนมัติ
- ✅ Professional HTML template
- ✅ แสดงข้อมูลครบถ้วน
- ✅ Graceful degradation (ถ้าไม่ config ฟอร์มยังทำงานได้)

---

## 🔒 Security Features

### 1. Rate Limiting
- **Limit:** 5 requests ต่อ 15 นาที ต่อ IP
- **Purpose:** ป้องกัน spam

### 2. Authentication
- GET/PUT/DELETE ต้อง login ด้วย admin
- ใช้ JWT token

### 3. Email Validation
- ตรวจสอบรูปแบบอีเมล

### 4. IP Tracking
- เก็บ IP address และ User-Agent
- ใช้สำหรับติดตาม spam

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
          throw new Error(data.error || 'ข้อมูลไม่ถูกต้อง');
        case 429:
          throw new Error('ส่งข้อความบ่อยเกินไป กรุณารอสักครู่');
        default:
          throw new Error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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

## 📊 สรุป

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
| Authentication | ✅ Fixed | Admin only |

---

## 🎯 การใช้งานใน Frontend

### 1. Public Contact Form
- ใช้ POST /api/contact
- ไม่ต้อง authentication
- มี rate limiting (5 req/15min)

### 2. Admin Panel
- ต้อง login ก่อน (POST /api/auth/login)
- เก็บ token ใน localStorage
- ใช้ token ใน Authorization header
- สามารถดู/แก้ไข/ลบข้อความได้

---

## 📚 เอกสารเพิ่มเติม

อ่านเอกสารฉบับเต็มได้ที่:
- **docs/CONTACT_API_DOCUMENTATION.md** - เอกสารละเอียด (EN)
- **CONTACT_API_SUMMARY_TH.md** - ไฟล์นี้ (TH)

---

**Contact API พร้อมใช้งานแล้ว!** 🎉
