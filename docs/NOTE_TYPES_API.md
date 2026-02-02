# Note Types API - คู่มือสำหรับ Frontend

## 📋 สรุป

ตอนนี้ `note_type` (หมวดหมู่ของ comment) เป็นแบบ **dynamic** - Admin สามารถเพิ่ม/แก้ไข/ลบได้

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/note-types` | ไม่จำเป็น | ดูรายการ note types ทั้งหมด |
| GET | `/api/note-types/:code` | ไม่จำเป็น | ดู note type ตาม code |
| POST | `/api/note-types` | Admin | เพิ่ม note type ใหม่ |
| PUT | `/api/note-types/:code` | Admin | แก้ไข note type |
| DELETE | `/api/note-types/:code` | Admin | ลบ note type (soft delete) |
| PUT | `/api/note-types/:code/restore` | Admin | restore note type ที่ลบแล้ว |

---

## 📥 Response Format

### GET /api/note-types

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "general",
      "name_th": "ทั่วไป",
      "name_en": "General",
      "description": "หมายเหตุทั่วไป",
      "color": null,
      "icon": null,
      "allowed_roles": ["admin", "agent"],
      "is_active": true,
      "sort_order": 1
    }
  ]
}
```

---

## 🛠️ Frontend Implementation

### 1. Load Note Types (ตอนเปิดแอป)

```javascript
// services/noteTypeService.js
export async function getNoteTypes() {
  const response = await fetch('/api/note-types');
  const data = await response.json();
  return data.data; // Array of note types
}
```

### 2. แสดง Dropdown เลือก Note Type

```jsx
// components/NoteTypeSelect.jsx
function NoteTypeSelect({ value, onChange, userRole }) {
  const [noteTypes, setNoteTypes] = useState([]);

  useEffect(() => {
    getNoteTypes().then(setNoteTypes);
  }, []);

  // Filter by user's role
  const availableTypes = noteTypes.filter(
    type => type.allowed_roles.includes(userRole)
  );

  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {availableTypes.map(type => (
        <option key={type.code} value={type.code}>
          {type.name_th}
        </option>
      ))}
    </select>
  );
}
```

### 3. Admin - จัดการ Note Types

```jsx
// pages/admin/NoteTypesManagement.jsx
function NoteTypesManagement() {
  const [noteTypes, setNoteTypes] = useState([]);
  
  // Load all (including inactive for admin)
  useEffect(() => {
    fetch('/api/note-types', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setNoteTypes(data.data));
  }, []);

  // Create new
  const createNoteType = async (newType) => {
    await fetch('/api/note-types', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(newType)
    });
  };

  // Update
  const updateNoteType = async (code, updates) => {
    await fetch(`/api/note-types/${code}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
  };

  // Delete (soft)
  const deleteNoteType = async (code) => {
    await fetch(`/api/note-types/${code}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  };
}
```

---

## 📤 cURL Examples

### ดู Note Types ทั้งหมด
```bash
curl http://localhost:3000/api/note-types
```

### เพิ่ม Note Type ใหม่ (Admin)
```bash
curl -X POST http://localhost:3000/api/note-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "question",
    "name_th": "คำถาม",
    "name_en": "Question",
    "description": "สำหรับถามคำถาม",
    "allowed_roles": ["admin", "agent"],
    "color": "#3498db",
    "sort_order": 6
  }'
```

### แก้ไขชื่อ Note Type (Admin)
```bash
# เปลี่ยนชื่อ rejection → not_approved
curl -X PUT http://localhost:3000/api/note-types/rejection \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name_th": "ไม่อนุมัติ",
    "name_en": "Not Approved",
    "new_code": "not_approved"
  }'
```

### ลบ Note Type (Soft Delete)
```bash
curl -X DELETE http://localhost:3000/api/note-types/rejection \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Restore Note Type
```bash
curl -X PUT http://localhost:3000/api/note-types/rejection/restore \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 📊 Note Type Fields

| Field | Type | Required | คำอธิบาย |
|-------|------|----------|----------|
| `code` | string | ✅ | รหัส (lowercase, underscore เท่านั้น) |
| `name_th` | string | ✅ | ชื่อภาษาไทย |
| `name_en` | string | ❌ | ชื่อภาษาอังกฤษ |
| `description` | string | ❌ | คำอธิบาย |
| `color` | string | ❌ | สี (hex code สำหรับ UI) |
| `icon` | string | ❌ | ชื่อ icon |
| `allowed_roles` | array | ❌ | Roles ที่ใช้ได้ (default: ['admin', 'agent']) |
| `sort_order` | number | ❌ | ลำดับการแสดง |
| `is_active` | boolean | ❌ | เปิด/ปิดใช้งาน |

---

## 🎨 UI Design Suggestions

### Admin Settings Page

```
┌──────────────────────────────────────────────────────────┐
│  จัดการหมวดหมู่ Comment                    [+ เพิ่มใหม่] │
├──────────────────────────────────────────────────────────┤
│  ☰  ทั่วไป (general)          Admin, Agent    [แก้ไข]   │
│  ☰  ขอให้แก้ไข (fix_request)  Admin           [แก้ไข]   │
│  ☰  ตอบกลับการแก้ไข           Agent           [แก้ไข]   │
│  ☰  อนุมัติ (approval)        Admin           [แก้ไข]   │
│  ☰  ปฏิเสธ (rejection)        Admin           [ลบ]     │
└──────────────────────────────────────────────────────────┘
```

### Note Type Form

```
┌──────────────────────────────────────────────────────────┐
│  แก้ไขหมวดหมู่ Comment                                    │
├──────────────────────────────────────────────────────────┤
│  Code: [rejection___________]                            │
│                                                          │
│  ชื่อภาษาไทย: [ไม่อนุมัติ________]                          │
│                                                          │
│  ชื่อภาษาอังกฤษ: [Not Approved___]                         │
│                                                          │
│  คำอธิบาย: [หมายเหตุเมื่อไม่อนุมัติ]                          │
│                                                          │
│  ใช้ได้โดย:                                                │
│    [✓] Admin                                             │
│    [ ] Agent                                             │
│                                                          │
│  สี: [#e74c3c] 🔴                                         │
│                                                          │
│                              [ยกเลิก]  [บันทึก]           │
└──────────────────────────────────────────────────────────┘
```

---

## ⚠️ หมายเหตุสำคัญ

1. **code ต้องเป็น lowercase และ underscore เท่านั้น** เช่น `my_new_type`

2. **ลบแบบ soft delete** - แค่ซ่อนไม่ให้เลือก แต่ notes เก่ายังแสดงได้

3. **เปลี่ยน code ได้** - ใช้ `new_code` ใน PUT request (notes เก่าจะถูก update ให้อัตโนมัติ)

4. **Frontend ควร cache** - เก็บ note types ไว้ใน state/store ไม่ต้อง fetch ทุกครั้ง
