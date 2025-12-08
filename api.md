# Backend API Documentation

> **Base URL**: `http://localhost:3000`  
> **Version**: 1.0.0  
> **Last Updated**: 2025-12-08

---

## 📑 Table of Contents

1. [Properties API](#properties-api)
2. [Statistics API](#statistics-api)
3. [Upload API](#upload-api)
4. [Tips/Articles API](#tipsarticles-api)
5. [FAQ API](#faq-api)
6. [Contact Form API](#contact-form-api)
7. [Static Files](#static-files)

---

## Properties API

Base path: `/api/properties`

### 1. GET `/api/properties` - List Properties

ดึงรายการ properties ทั้งหมด พร้อมกับ filters และ pagination

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `keyword` | string | ค้นหาจากชื่อ (title) | `?keyword=warehouse` |
| `status` | string | กรองตามสถานะ | `?status=rent` หรือ `?status=sale` |
| `type` | string | กรองตามประเภท | `?type=warehouse` หรือ `?type=factory` |
| `province` | string | กรองตามจังหวัด | `?province=Bangkok` |
| `district` | string | กรองตามอำเภอ | `?district=Bang%20Bo` |
| `sub_district` | string | กรองตามตำบล | `?sub_district=Bang%20Phriang` |
| `min_size` | number | พื้นที่ขั้นต่ำ (sqm) | `?min_size=100` |
| `max_size` | number | พื้นที่สูงสุด (sqm) | `?max_size=500` |
| `min_price` | number | ราคาขั้นต่ำ | `?min_price=10000` |
| `max_price` | number | ราคาสูงสุด | `?max_price=50000` |
| `features` | array/string | กรองตาม features (comma-separated) | `?features=With Office area,Security guard` |
| `min_height` | number | Clear height ขั้นต่ำ (m) | `?min_height=8` |
| `max_height` | number | Clear height สูงสุด (m) | `?max_height=12` |
| `floor_load` | string | Floor loading | `?floor_load=3 tons` |
| `page` | integer | หน้าที่ต้องการ (เริ่มที่ 1) | `?page=1` |
| `limit` | integer | จำนวนต่อหน้า (max 100) | `?limit=20` |

> **Note**: Smart Price Selection - ถ้า status = "sale" จะใช้ `price_alternative` แทน `price` ในการกรอง

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "property_id": "AT1R",
      "title": "Warehouse 288 sqm for RENT...",
      "type": "Warehouse",
      "status": "For Rent",
      "province": "Bangkok",
      "district": "Saphan Sung",
      "sub_district": "Saphan Sung",
      "price": "35000.00",
      "size": "288.00",
      "clear_height": "7m",
      "features": "Detached building",
      "floor_load": "",
      "coordinates": "13.744306, 100.707444",
      "images": ["AT1R_1.webp", "AT1R_2.webp"],
      "created_at": "2025-12-04T07:16:11.957Z",
      "updated_at": "2025-12-04T07:45:53.174Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1846,
    "pages": 923
  },
  "filters": {
    "keyword": "warehouse",
    "status": "rent",
    "price_range": { "min": "10000", "max": "50000", "field": "price" },
    "size_range": { "min": "100", "max": "500" },
    "height_range": {}
  }
}
```

#### Examples

```bash
# ดึงทั้งหมดหน้าแรก
GET /api/properties?page=1&limit=20

# ค้นหา warehouse ใน Bangkok
GET /api/properties?keyword=warehouse&province=Bangkok

# กรองตามราคาและพื้นที่
GET /api/properties?min_price=20000&max_price=50000&min_size=200&max_size=1000

# รวม filters หลายตัว
GET /api/properties?status=rent&type=warehouse&province=Bangkok&min_size=300
```

---

### 2. GET `/api/properties/:id` - Get Property by ID

ดึงข้อมูล property รายการเดียว

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string/number | ID ของ property (รองรับทั้ง numeric id และ property_id) |

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "property_id": "AT1R",
    "title": "Warehouse 288 sqm for RENT at Saphan Sung...",
    "date": "2021-02-08T17:00:00.000Z",
    "type": "Warehouse",
    "status": "For Rent",
    "province": "Bangkok",
    "district": "Saphan Sung",
    "price": "35000.00",
    "price_postfix": "month",
    "size": "288.00",
    "size_prefix": "sqm",
    "clear_height": "7m",
    "features": "Detached building",
    "coordinates": "13.744306, 100.707444",
    "images": ["AT1R_1.webp", "AT1R_2.webp"],
    ...
  }
}
```

#### Examples

```bash
# ดึงโดยใช้ numeric ID
GET /api/properties/1

# ดึงโดยใช้ property_id
GET /api/properties/AT1R
```

#### Error Response

```json
{
  "success": false,
  "error": "Property not found"
}
```

---

### 3. POST `/api/properties` - Create Property

สร้าง property ใหม่

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Request Body (Required Fields)

```json
{
  "title": "Test Property",
  "type": "Warehouse",
  "province": "Bangkok",
  "price": 5000,
  "size": 100,
  "status": "For Rent"
}
```

#### Optional Fields

```json
{
  "date": "2025-12-08",
  "labels": "Purple zone",
  "country": "Thailand",
  "district": "Bang Bo",
  "sub_district": "Bang Phriang",
  "location": "13.538084,100.8025907,15",
  "price_postfix": "Month",
  "size_prefix": "sqm",
  "terms_conditions": "Minimum 3 years contract...",
  "warehouse_length": "24 m x 12 m",
  "electricity_system": "3 Phase 30/100 Amp",
  "clear_height": "7m",
  "features": ["With Office area", "Security guard"],
  "landlord_name": "John Doe",
  "landlord_contact": "0812345678",
  "agent_team": "A",
  "coordinates": "13.744306, 100.707444",
  "floor_load": "3 tons per sqm",
  "land_size": "500.00",
  "land_postfix": "sqm",
  "remarks": "Ready to move in",
  "slug": "warehouse-test-001",
  "images": ["image1.webp"]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1862,
    "property_id": "AT1862R",
    "title": "Test Property",
    "type": "Warehouse",
    "status": "For Rent",
    ...
  },
  "message": "Property created successfully"
}
```

> **Note**: `property_id` จะถูก auto-generate ในรูปแบบ `AT{id}{status_code}` โดย status_code = R (Rent), S (Sale), SR (Rent & Sale)

---

### 4. PUT `/api/properties/:id` - Update Property

แก้ไขข้อมูล property

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string/number | ID ของ property (รองรับทั้ง numeric id และ property_id) |

#### Request Body (ใส่เฉพาะฟิลด์ที่ต้องการแก้)

```json
{
  "title": "Updated Test Property",
  "price": 8000,
  "status": "For Sale"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1862,
    "property_id": "AT1862R",
    "title": "Updated Test Property",
    "price": "8000.00",
    "updated_at": "2025-12-08T02:43:26.580Z",
    ...
  },
  "message": "Property updated successfully"
}
```

> **Note**: `updated_at` จะถูก update อัตโนมัติ

---

### 5. DELETE `/api/properties/:id` - Delete Property

ลบ property

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string/number | ID ของ property (รองรับทั้ง numeric id และ property_id) |

#### Response

```json
{
  "success": true,
  "message": "Property deleted successfully",
  "data": {
    "id": 1862,
    "property_id": "AT1862R",
    ...
  }
}
```

---

## Statistics API

Base path: `/api/stats`

### GET `/api/stats` - Get Statistics

ดึงสถิติรวมของ properties

#### Response

```json
{
  "success": true,
  "data": {
    "overview": {
      "total_properties": "1846",
      "total_types": "2",
      "total_provinces": "45",
      "avg_price": "123456.78",
      "avg_size": "1234.56"
    },
    "by_type": [
      { "type": "Warehouse", "count": "850" },
      { "type": "Factory", "count": "996" }
    ],
    "by_province": [
      { "province": "Bangkok", "count": "218" },
      { "province": "Samut Prakan", "count": "156" },
      ...
    ]
  }
}
```

#### Example

```bash
GET /api/stats
```

---

## Upload API

Base path: `/api/upload`

### 1. POST `/api/upload/image` - Upload Single Image

อัปโหลดรูปเดียว

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Request

- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `image` (file): ไฟล์รูปภาพ
  - `property_id` (number): ID ของ property

#### Response

```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "filename": "AT1862R_1.webp",
    "path": "/images/AT1862R_1.webp",
    "property_id": "1862",
    "status_code": "R",
    "image_number": 1
  }
}
```

#### Example (curl)

```bash
curl -X POST http://localhost:3000/api/upload/image \
  -F "image=@/path/to/image.jpg" \
  -F "property_id=1862"
```

#### Features

- รับไฟล์รูปใดก็ได้ (จะแปลงเป็น WebP อัตโนมัติ)
- Resize สูงสุด 2000px (รักษา aspect ratio)
- คุณภาพ WebP 80%
- ตั้งชื่อไฟล์อัตโนมัติ: `AT{property_id}{status_code}_{number}.webp`
- อัปเดต `images` array ใน database

---

### 2. POST `/api/upload/images` - Upload Multiple Images

อัปโหลดหลายรูปพร้อมกัน (สูงสุด 20 รูป)

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Request

- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `images` (files): ไฟล์รูปภาพหลายไฟล์
  - `property_id` (number): ID ของ property

#### Response

```json
{
  "success": true,
  "message": "3 images uploaded successfully",
  "data": {
    "property_id": "1862",
    "status_code": "R",
    "images": [
      {
        "filename": "AT1862R_1.webp",
        "path": "/images/AT1862R_1.webp",
        "number": 1
      },
      {
        "filename": "AT1862R_2.webp",
        "path": "/images/AT1862R_2.webp",
        "number": 2
      },
      {
        "filename": "AT1862R_3.webp",
        "path": "/images/AT1862R_3.webp",
        "number": 3
      }
    ],
    "total_images": 3
  }
}
```

#### Example (curl)

```bash
curl -X POST http://localhost:3000/api/upload/images \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "images=@/path/to/image3.jpg" \
  -F "property_id=1862"
```

---

### 3. DELETE `/api/upload/image/:filename` - Delete Image

ลบรูปภาพ

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `filename` | string | ชื่อไฟล์ (ต้องตรงตามรูปแบบ `AT{number}{R\|S\|SR}_{number}.webp`) |

#### Response

```json
{
  "success": true,
  "message": "Image deleted successfully",
  "data": {
    "filename": "AT1862R_1.webp"
  }
}
```

#### Example

```bash
DELETE /api/upload/image/AT1862R_1.webp
```

---

## Tips/Articles API

Base path: `/api/tips`

### 1. GET `/api/tips` - List Articles

ดึงรายการบทความทั้งหมด พร้อม pagination และ filter ตามสถานะการเผยแพร่

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | integer | หน้าที่ต้องการ (เริ่มที่ 1) | `?page=1` |
| `limit` | integer | จำนวนต่อหน้า (max 100) | `?limit=20` |
| `published` | boolean/string | กรองตามสถานะเผยแพร่ | `?published=true` หรือ `?published=all` |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "warehouse-safety-tips",
      "title": "5 Essential Warehouse Safety Tips",
      "excerpt": "Learn the most important safety practices...",
      "content": "Full article content here...",
      "featured_image": "/images/tips/warehouse-safety.jpg",
      "author": "John Doe",
      "published_at": "2025-12-08T03:00:00.000Z",
      "created_at": "2025-12-07T10:00:00.000Z",
      "updated_at": "2025-12-07T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### 2. GET `/api/tips/:slug` - Get Article by Slug

ดึงบทความเดียวโดยใช้ slug

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "warehouse-safety-tips",
    "title": "5 Essential Warehouse Safety Tips",
    "excerpt": "Learn the most important safety practices...",
    "content": "Full article content here...",
    "featured_image": "/images/tips/warehouse-safety.jpg",
    "author": "John Doe",
    "published_at": "2025-12-08T03:00:00.000Z",
    "created_at": "2025-12-07T10:00:00.000Z",
    "updated_at": "2025-12-07T10:00:00.000Z"
  }
}
```

---

### 3. POST `/api/tips` - Create Article

สร้างบทความใหม่

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Request Body

```json
{
  "slug": "warehouse-safety-tips",
  "title": "5 Essential Warehouse Safety Tips",
  "excerpt": "Learn the most important safety practices...",
  "content": "Full article content here...",
  "featured_image": "/images/tips/warehouse-safety.jpg",
  "author": "John Doe",
  "published_at": "2025-12-08T03:00:00.000Z"
}
```

**Required fields**: `slug`, `title`, `content`

---

### 4. PUT `/api/tips/:id` - Update Article

แก้ไขบทความ

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

---

### 5. DELETE `/api/tips/:id` - Delete Article

ลบบทความ

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

---

## FAQ API

Base path: `/api/faq`

### 1. GET `/api/faq` - List FAQs

ดึงรายการคำถามทั้งหมด เรียงตาม display_order

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `category` | string | กรองตาม category | `?category=General` |
| `is_active` | boolean/string | กรองตามสถานะ active | `?is_active=true` |
| `page` | integer | หน้าที่ต้องการ | `?page=1` |
| `limit` | integer | จำนวนต่อหน้า (max 100) | `?limit=100` |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "question": "How do I rent a warehouse?",
      "answer": "To rent a warehouse, you can browse our listings...",
      "category": "General",
      "display_order": 1,
      "is_active": true,
      "created_at": "2025-12-07T08:00:00.000Z",
      "updated_at": "2025-12-07T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 25,
    "pages": 1
  }
}
```

---

### 2. GET `/api/faq/:id` - Get FAQ by ID

ดึงคำถามเดียว

---

### 3. POST `/api/faq` - Create FAQ

สร้างคำถามใหม่

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Request Body

```json
{
  "question": "How do I rent a warehouse?",
  "answer": "To rent a warehouse, you can browse our listings...",
  "category": "General",
  "display_order": 1,
  "is_active": true
}
```

**Required fields**: `question`, `answer`

---

### 4. PUT `/api/faq/:id` - Update FAQ

แก้ไขคำถาม

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

---

### 5. DELETE `/api/faq/:id` - Delete FAQ

ลบคำถาม

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

---

## Contact Form API

Base path: `/api/contact`

### 1. POST `/api/contact` - Submit Contact Form

ส่งฟอร์มติดต่อ (Public endpoint with rate limiting)

**Rate Limit**: 5 requests per 15 minutes per IP

**Email Notification**: ✅ Sends email to admin using Resend (requires configuration)

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
    "created_at": "2025-12-08T03:15:00.000Z",
    "updated_at": "2025-12-08T03:15:00.000Z"
  },
  "message": "Contact message submitted successfully"
}
```

#### Error Response (Rate Limit)

```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

---

### 2. GET `/api/contact` - List Messages (Admin)

ดึงรายการข้อความทั้งหมด

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | กรองตามสถานะ | `?status=new` |
| `page` | integer | หน้าที่ต้องการ | `?page=1` |
| `limit` | integer | จำนวนต่อหน้า (max 100) | `?limit=50` |

**Valid status values**: `new`, `read`, `replied`, `archived`

---

### 3. GET `/api/contact/:id` - Get Message (Admin)

ดึงข้อความเดียว

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

---

### 4. PUT `/api/contact/:id` - Update Status (Admin)

อัปเดตสถานะข้อความ

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

#### Request Body

```json
{
  "status": "replied"
}
```

**Valid status values**: `new`, `read`, `replied`, `archived`

---

### 5. DELETE `/api/contact/:id` - Delete Message (Admin)

ลบข้อความ

> ⚠️ **TODO**: ต้องเพิ่ม authentication middleware

---

### Email Notification Configuration

Contact form submissions automatically send email notifications to admin using **Resend**.

#### Required Environment Variables

```env
RESEND_API_KEY=re_your_api_key_here
ADMIN_EMAIL=admin@yourdomain.com
EMAIL_FROM=noreply@yourdomain.com  # or onboarding@resend.dev for testing
```

#### Setup Instructions

1. Create account at [resend.com](https://resend.com) (free tier: 100 emails/day)
2. Get API key from Dashboard → API Keys
3. Add variables to `.env` file
4. Restart server

See `RESEND_SETUP.md` for detailed setup guide.

#### Email Features

- ✅ Professional HTML template
- ✅ Includes all form data (name, email, phone, subject, message)
- ✅ Timestamp in Thailand timezone
- ✅ IP address for spam tracking
- ✅ Graceful error handling (form still works if email fails)

#### Behavior

- **If configured**: Email sent to `ADMIN_EMAIL` on every form submission
- **If not configured**: Warning logged, form data still saved to database
- **If email fails**: Error logged, form submission still succeeds

---

## Static Files

### Serving Images

รูปภาพทั้งหมดจะถูก serve อยู่ที่ `/images/`

#### URL Format

```
http://localhost:3000/images/{filename}
```

#### Example

```
http://localhost:3000/images/AT1R_1.webp
http://localhost:3000/images/AT1862R_2.webp
```

---

## Error Responses

ทุก endpoint จะส่ง error ในรูปแบบเดียวกัน:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - สำเร็จ |
| 201 | Created - สร้างสำเร็จ |
| 400 | Bad Request - ข้อมูลไม่ถูกต้อง |
| 404 | Not Found - ไม่พบข้อมูล |
| 409 | Conflict - ข้อมูลซ้ำ (duplicate property_id, slug) |
| 500 | Internal Server Error - เกิดข้อผิดพลาดในระบบ |

---

## Validation Rules

### Properties

- **Required fields**: `title`, `type`, `province`, `price`, `size`, `status`
- **Page**: ต้อง ≥ 1
- **Limit**: ต้อง 1-100
- **Numeric values**: ต้องเป็นตัวเลขบวก (price, size, height)

### Upload

- **Max file size**: 10 MB
- **Allowed types**: image/* (jpg, png, gif, webp, etc.)
- **Max files**: 20 files per upload (for multiple upload)
- **Filename pattern**: `AT{property_id}{R|S|SR}_{number}.webp`

---

## Development Notes

### Authentication

⚠️ **ปัจจุบัน POST, PUT, DELETE endpoints ยังไม่มี authentication**  
ควรเพิ่ม middleware ก่อน deploy production:

```javascript
// TODO: Add authentication middleware
router.post('/', authenticateToken, async (req, res) => {
  // ...
});
```

### Coordinates Privacy

⚠️ **Coordinates ถูกเปิดเผยทั้งหมดในปัจจุบัน**  
พิจารณา:
- Approximate coordinates สำหรับ public users
- Exact coordinates สำหรับ authenticated users
- หรือ Field selection (?fields=...)

---

## Testing

ดู [test_report.md](./test_report.md) สำหรับผลการทดสอบ API ทั้งหมด

---

## Change Log

- **2025-12-08**: Initial API documentation
- **2025-12-04**: API v1.0.0 deployed

---

**For more information, contact the development team.**
