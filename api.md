# Backend API Documentation

> **Base URL**: `http://localhost:3000`  
> **Version**: 2.0.0  
> **Last Updated**: 2025-12-08

---

## 📑 Table of Contents

1. [🔐 Authentication API](#authentication-api) ⭐ NEW
2. [Properties API](#properties-api)
3. [Statistics API](#statistics-api)
4. [Upload API](#upload-api)
5. [Tips/Articles API](#tipsarticles-api)
6. [FAQ API](#faq-api)
7. [Contact Form API](#contact-form-api)
8. [Static Files](#static-files)

---

## 🔐 Authentication API

Base path: `/api/auth`

### Overview

ระบบ Authentication ใช้ JWT (JSON Web Tokens) สำหรับการยืนยันตัวตน

**Roles:**
| Role | Description |
|------|-------------|
| `admin` | ผู้ดูแลระบบ - จัดการ properties ทั้งหมด, publish, สร้าง users |
| `agent` | ตัวแทน - จัดการ properties ของ team ตัวเอง, สร้างได้เฉพาะ pending |
| `guest` | ผู้เยี่ยมชม - ดูเฉพาะ properties ที่ published, ไม่เห็นข้อมูลลับ |

**Token Expiration:**
- Access Token: 15 นาที
- Refresh Token: 7 วัน

---

### 1. POST `/api/auth/login` - Login

เข้าสู่ระบบและรับ tokens

#### Request Body

```json
{
  "email": "admin@atsoko.com",
  "password": "admin123456"
}
```

#### Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@atsoko.com",
      "name": "Administrator",
      "role": "admin",
      "team": null
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "abc123...",
    "expiresIn": "15m"
  }
}
```

#### Error Responses

```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

---

### 2. POST `/api/auth/register` - Register New User

สร้างผู้ใช้ใหม่ (Admin only)

> 🔒 **Requires**: Admin Authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "email": "agent1@atsoko.com",
  "password": "agent123",
  "name": "Agent Team A",
  "role": "agent",
  "team": "A"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | อีเมล (unique) |
| `password` | string | ✅ | รหัสผ่าน (min 6 chars) |
| `name` | string | ❌ | ชื่อผู้ใช้ |
| `role` | string | ❌ | `admin` หรือ `agent` (default: agent) |
| `team` | string | ✅ (for agent) | `A`, `B`, หรือ `C` |

#### Response

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 2,
    "email": "agent1@atsoko.com",
    "name": "Agent Team A",
    "role": "agent",
    "team": "A",
    "created_at": "2025-12-08T07:17:19.057Z"
  }
}
```

---

### 3. POST `/api/auth/logout` - Logout

ออกจากระบบและ revoke refresh token

> 🔒 **Requires**: Authentication

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body (Optional)

```json
{
  "refreshToken": "abc123..."
}
```

> **Note**: ถ้าไม่ส่ง refreshToken จะ logout จากทุกอุปกรณ์

#### Response

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 4. POST `/api/auth/refresh` - Refresh Token

รับ access token ใหม่

#### Request Body

```json
{
  "refreshToken": "abc123..."
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "expiresIn": "15m"
  }
}
```

---

### 5. GET `/api/auth/me` - Get Current User

ดึงข้อมูลผู้ใช้ปัจจุบัน

> 🔒 **Requires**: Authentication

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "admin@atsoko.com",
    "name": "Administrator",
    "role": "admin",
    "team": null
  }
}
```

---

### 6. GET `/api/auth/users` - List All Users

ดึงรายการผู้ใช้ทั้งหมด (Admin only)

> 🔒 **Requires**: Admin Authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
```

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "admin@atsoko.com",
      "name": "Administrator",
      "role": "admin",
      "team": null,
      "is_active": true,
      "created_at": "2025-12-08T07:00:00.000Z"
    },
    {
      "id": 2,
      "email": "agent1@atsoko.com",
      "name": "Agent Team A",
      "role": "agent",
      "team": "A",
      "is_active": true,
      "created_at": "2025-12-08T07:17:19.057Z"
    }
  ]
}
```

---

### 7. PUT `/api/auth/users/:id` - Update User

แก้ไขข้อมูลผู้ใช้ (Admin only)

> 🔒 **Requires**: Admin Authentication

#### Request Body

```json
{
  "name": "Updated Name",
  "role": "admin",
  "team": "B",
  "is_active": false
}
```

#### Response

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": 2,
    "email": "agent1@atsoko.com",
    "name": "Updated Name",
    "role": "admin",
    "team": "B",
    "is_active": false,
    "updated_at": "2025-12-08T08:00:00.000Z"
  }
}
```

---

### Using Authentication in Requests

#### Step 1: Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@atsoko.com", "password": "admin123456"}'
```

#### Step 2: Use Access Token

```bash
curl http://localhost:3000/api/properties \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

#### Step 3: Refresh When Expired

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "abc123..."}'
```

---

## Properties API

Base path: `/api/properties`

### Access Control

| Role | GET (list/detail) | POST | PUT | DELETE |
|------|-------------------|------|-----|--------|
| Guest | ✅ published only, no secret fields | ❌ | ❌ | ❌ |
| Agent | ✅ own team only | ✅ (pending) | ✅ (own team, pending) | ✅ (own team, pending) |
| Admin | ✅ all | ✅ all | ✅ all | ✅ all |

**Secret Fields** (hidden from Guest):
- `coordinates`
- `landlord_name`
- `landlord_contact`
- `agent_team`

---

### 1. GET `/api/properties` - List Properties

ดึงรายการ properties พร้อมกับ filters และ pagination

> 🔓 **Public Access** - แต่ Guest จะเห็นเฉพาะ published และไม่เห็น secret fields

#### Headers (Optional - for authenticated access)

```
Authorization: Bearer <access_token>
```

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `keyword` | string | ค้นหาแบบ relevance จาก `property_id`, `title`, `remarks` (FTS + fuzzy + partial) | `?keyword=warehouse` |
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
| `limit` | integer | จำนวนต่อหน้า (max 1000, `0` = no limit) | `?limit=20` |

> **Note**: Smart Price Selection - ถ้า status = "sale" จะใช้ `price_alternative` แทน `price` ในการกรอง
>
> **Search Note**: `keyword` จะจัดอันดับผลลัพธ์ตามความเกี่ยวข้อง (exact `property_id` > `title` > `remarks`) และรองรับ typo เล็กน้อย

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

### 1.1 GET `/api/properties/suggestions` - Search Suggestions (Autocomplete)

ใช้สำหรับ Search-as-you-type (dropdown ใต้ช่องค้นหา) โดยคืนเฉพาะข้อมูลเบาๆ ที่ใช้แสดงผลรายการแนะนำ

> 🔓 **Public Access** - role visibility เหมือน endpoint list

#### Headers (Optional - for authenticated access)

```
Authorization: Bearer <access_token>
```

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | คำค้นหา (ขั้นต่ำ 2 ตัวอักษร) | `?q=warehous` |
| `limit` | integer | จำนวนรายการแนะนำ (default 8, max 20) | `?limit=8` |
| `status` | string | กรองตามสถานะ | `?status=rent` |
| `type` | string | กรองตามประเภท | `?type=factory` |
| `province` | string | กรองตามจังหวัด | `?province=Bangkok` |
| `district` | string | กรองตามอำเภอ | `?district=Bang%20Bo` |
| `sub_district` | string | กรองตามตำบล | `?sub_district=Bang%20Phriang` |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1844,
      "property_id": "AT57R",
      "title": "Factory or Warehouse 220 sqm for Rent at ...",
      "subtitle": "Khlong Song, Khlong Luang, Pathum Thani",
      "type": "Factory",
      "status": "For Rent",
      "slug": "factory-or-warehouse-220-sqm-for-rent-at-...",
      "size": "220.00",
      "price": "30000.00",
      "price_alternative": null
    }
  ],
  "meta": {
    "query": "warehouse",
    "limit": 8
  }
}
```

#### Examples

```bash
# พิมพ์ค้นหาเพื่อแสดง suggestions
GET /api/properties/suggestions?q=warehouse&limit=8

# Typo-tolerant search
GET /api/properties/suggestions?q=warehous&limit=8

# Suggestions + filters
GET /api/properties/suggestions?q=factory&status=rent&province=Bangkok&limit=8
```

> **Frontend Tips**
> - เรียก API เมื่อ `q.length >= 2`
> - debounce 200-300ms
> - cancel request เก่าเมื่อพิมพ์ต่อ (AbortController)

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

> 🔒 **Requires**: Authentication (Admin or Agent)

#### Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### Behavior by Role

| Role | `approve_status` | `agent_team` |
|------|------------------|---------------|
| Agent | `pending` (forced) | User's team (forced) |
| Admin | `published` (default) or custom | Custom or null |

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

> 🔒 **Requires**: Authentication (Admin or Agent)

#### Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### Permission Rules

| Role | Can Update |
|------|------------|
| Agent | เฉพาะ property ของ team ตัวเองที่ `approve_status = pending` |
| Admin | ทุก property |

> **Note**: Agent ไม่สามารถเปลี่ยน `approve_status` หรือ `agent_team` ได้

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

> 🔒 **Requires**: Authentication (Admin or Agent)

#### Headers

```
Authorization: Bearer <access_token>
```

#### Permission Rules

| Role | Can Delete |
|------|------------|
| Agent | เฉพาะ property ของ team ตัวเองที่ `approve_status = pending` |
| Admin | ทุก property |

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

> 🔒 **Requires**: Authentication (Admin)

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

> 🔒 **Requires**: Authentication (Admin)

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

> 🔒 **Requires**: Authentication (Admin)

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

> 📝 **Full Documentation**: See [TIPS_API_DOCUMENTATION.md](./TIPS_API_DOCUMENTATION.md) for complete details

### Overview

Tips API ใช้สำหรับจัดการบทความ/Blog posts พร้อมระบบ authentication และ HTML sanitization

**Access Control:**
- GET endpoints: 🔓 Public (ไม่ต้อง login)
- POST/PUT/DELETE endpoints: 🔒 Admin only

**Security Features:**
- ✅ JWT Authentication
- ✅ HTML Sanitization (DOMPurify)
- ✅ XSS Protection
- ✅ Slug Uniqueness

---

### 1. GET `/api/tips` - List Articles

ดึงรายการบทความทั้งหมด พร้อม pagination และ filter ตามสถานะการเผยแพร่

> 🔓 **Public Access** - ไม่ต้อง authentication

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | integer | หน้าที่ต้องการ (เริ่มที่ 1) | `?page=1` |
| `limit` | integer | จำนวนต่อหน้า (max 100) | `?limit=20` |
| `published` | boolean/string | กรองตามสถานะเผยแพร่ | `?published=true` หรือ `?published=all` |

**Published Logic:**
- `published=true` (default): แสดงเฉพาะที่ `published_at ≤ NOW()`
- `published=false`: แสดงเฉพาะ draft (`published_at = NULL` หรือ `published_at > NOW()`)
- `published=all`: แสดงทั้งหมด

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
      "content": "<h1>Introduction</h1><p>Safety is paramount...</p>",
      "featured_image": "/images/tips/warehouse-safety.jpg",
      "author": "John Doe",
      "published_at": "2025-01-20T10:00:00.000Z",
      "created_at": "2025-01-15T08:00:00.000Z",
      "updated_at": "2025-01-20T09:00:00.000Z"
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

#### Examples

```bash
# ดึงบทความที่ publish แล้ว (หน้าแรก)
GET /api/tips?page=1&limit=10

# ดึง draft ทั้งหมด
GET /api/tips?published=false

# ดึงทั้งหมด (published + draft)
GET /api/tips?published=all
```

---

### 2. GET `/api/tips/:slug` - Get Article by Slug

ดึงบทความเดียวโดยใช้ slug

> 🔓 **Public Access** - ไม่ต้อง authentication

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | string | URL-friendly identifier (เช่น `warehouse-safety-tips`) |

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "warehouse-safety-tips",
    "title": "5 Essential Warehouse Safety Tips",
    "excerpt": "Learn the most important safety practices...",
    "content": "<h1>Introduction</h1><p>Safety is paramount...</p>",
    "featured_image": "/images/tips/warehouse-safety.jpg",
    "author": "John Doe",
    "published_at": "2025-01-20T10:00:00.000Z",
    "created_at": "2025-01-15T08:00:00.000Z",
    "updated_at": "2025-01-20T09:00:00.000Z"
  }
}
```

#### Error Response (404)

```json
{
  "success": false,
  "error": "Article not found"
}
```

#### Example

```bash
GET /api/tips/warehouse-safety-tips
```

---

### 3. POST `/api/tips` - Create Article

สร้างบทความใหม่

> 🔒 **Requires**: Admin Authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "slug": "warehouse-safety-tips",
  "title": "5 Essential Warehouse Safety Tips",
  "excerpt": "Learn the most important safety practices...",
  "content": "<h1>Introduction</h1><p>Safety is paramount...</p>",
  "featured_image": "/images/tips/warehouse-safety.jpg",
  "author": "John Doe",
  "published_at": "2025-01-20T10:00:00.000Z"
}
```

**Required fields**: `slug`, `title`, `content`

**Optional fields**: `excerpt`, `featured_image`, `author`, `published_at`

**Published Logic:**
- ถ้าไม่ใส่ `published_at` → บันทึกเป็น draft
- ถ้าใส่ `published_at = NULL` → draft
- ถ้าใส่ `published_at = อนาคต` → scheduled (จะแสดงอัตโนมัติเมื่อถึงเวลา)
- ถ้าใส่ `published_at ≤ ปัจจุบัน` → published ทันที

**HTML Sanitization:**
- Content จะถูก sanitize อัตโนมัติด้วย DOMPurify
- อนุญาตเฉพาะ HTML tags ที่ปลอดภัย (h1-h6, p, strong, em, ul, ol, li, a, img, etc.)
- ลบ `<script>`, `<iframe>`, และ tags อันตรายอื่นๆ

#### Response (201)

```json
{
  "success": true,
  "data": {
    "id": 2,
    "slug": "warehouse-safety-tips",
    "title": "5 Essential Warehouse Safety Tips",
    "content": "<h1>Introduction</h1><p>Safety is paramount...</p>",
    ...
  },
  "message": "Article created successfully"
}
```

#### Error Responses

```json
// 400 - Missing required fields
{
  "success": false,
  "error": "Missing required fields: slug, title, content"
}

// 401 - Not authenticated
{
  "success": false,
  "error": "Access denied. No token provided."
}

// 403 - Not admin
{
  "success": false,
  "error": "Access denied. Insufficient permissions."
}

// 409 - Duplicate slug
{
  "success": false,
  "error": "Article with this slug already exists"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/api/tips \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "warehouse-safety-tips",
    "title": "5 Essential Warehouse Safety Tips",
    "content": "<h1>Introduction</h1><p>Content here...</p>",
    "published_at": "2025-01-20T10:00:00.000Z"
  }'
```

---

### 4. PUT `/api/tips/:id` - Update Article

แก้ไขบทความ (partial update)

> 🔒 **Requires**: Admin Authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | ID ของบทความ |

#### Request Body (ใส่เฉพาะฟิลด์ที่ต้องการแก้)

```json
{
  "title": "10 Essential Warehouse Safety Tips (Updated)",
  "content": "<h1>Updated Content</h1><p>New content...</p>"
}
```

**Allowed fields**: `slug`, `title`, `excerpt`, `content`, `featured_image`, `author`, `published_at`

**Note:**
- `updated_at` จะถูกอัปเดตอัตโนมัติ
- Content จะถูก sanitize อัตโนมัติ

#### Response

```json
{
  "success": true,
  "data": {
    "id": 2,
    "title": "10 Essential Warehouse Safety Tips (Updated)",
    "updated_at": "2025-01-20T11:00:00.000Z",
    ...
  },
  "message": "Article updated successfully"
}
```

#### Error Responses

```json
// 400 - Empty body
{
  "success": false,
  "error": "Request body is empty"
}

// 404 - Article not found
{
  "success": false,
  "error": "Article not found"
}

// 409 - Duplicate slug
{
  "success": false,
  "error": "Duplicate slug"
}
```

#### Examples

```bash
# แก้เฉพาะ title
curl -X PUT http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'

# Publish draft
curl -X PUT http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"published_at": "2025-01-20T10:00:00.000Z"}'

# Unpublish (เปลี่ยนเป็น draft)
curl -X PUT http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"published_at": null}'
```

---

### 5. DELETE `/api/tips/:id` - Delete Article

ลบบทความ

> 🔒 **Requires**: Admin Authentication

#### Headers

```
Authorization: Bearer <admin_access_token>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | ID ของบทความ |

#### Response

```json
{
  "success": true,
  "message": "Article deleted successfully",
  "data": {
    "id": 2,
    "slug": "warehouse-safety-tips",
    ...
  }
}
```

#### Error Response (404)

```json
{
  "success": false,
  "error": "Article not found"
}
```

#### Example

```bash
curl -X DELETE http://localhost:3000/api/tips/2 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### Rich Text Editor Integration

Tips API รองรับ HTML content ใน field `content` สำหรับใช้กับ Rich Text Editor

**แนะนำ Editor:**
- Quill.js (เบา, ใช้ง่าย)
- TinyMCE (ฟีเจอร์เยอะ)
- CKEditor (มาตรฐานอุตสาหกรรม)

**Frontend Display:**
```html
<!-- React -->
<div dangerouslySetInnerHTML={{ __html: article.content }} />

<!-- Vue -->
<div v-html="article.content"></div>

<!-- Vanilla JS -->
<div id="article"></div>
<script>
  document.getElementById('article').innerHTML = article.content;
</script>
```

**ดูตัวอย่างเพิ่มเติม:** [TIPS_API_EXAMPLES.md](./TIPS_API_EXAMPLES.md)

---

### Security Notes

1. **HTML Sanitization**: ทุก HTML content จะถูก sanitize ด้วย DOMPurify ก่อนบันทึก
2. **XSS Protection**: ลบ `<script>`, `<iframe>`, และ tags อันตรายอื่นๆ อัตโนมัติ
3. **Admin Only**: เฉพาะ admin เท่านั้นที่สร้าง/แก้ไข/ลบได้
4. **Slug Uniqueness**: Database constraint ป้องกัน duplicate URL

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

> 🔒 **Requires**: Authentication (Admin)

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

> 🔒 **Requires**: Authentication (Admin)

---

### 5. DELETE `/api/faq/:id` - Delete FAQ

ลบคำถาม

> 🔒 **Requires**: Authentication (Admin)

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

> 🔒 **Requires**: Authentication (Admin)

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

> 🔒 **Requires**: Authentication (Admin)

---

### 4. PUT `/api/contact/:id` - Update Status (Admin)

อัปเดตสถานะข้อความ

> 🔒 **Requires**: Authentication (Admin)

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

> 🔒 **Requires**: Authentication (Admin)

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

### Authentication ✅

Authentication system has been implemented using JWT tokens.

**Endpoints requiring authentication:**
- All POST, PUT, DELETE operations on Properties, Upload, Tips, FAQ, Contact
- User management (Admin only)

**Public endpoints:**
- GET Properties (filtered by approve_status for guests)
- GET Tips, FAQ (read-only)
- POST Contact form

### Secret Fields Protection ✅

The following fields are automatically hidden from unauthenticated users (Guest):
- `coordinates`
- `landlord_name`
- `landlord_contact`
- `agent_team`

### Team-Based Access ✅

Agents can only access properties belonging to their assigned team (A, B, or C).

---

## Testing

ดู [test_report.md](./test_report.md) สำหรับผลการทดสอบ API ทั้งหมด

---

## Change Log

- **2025-01-20**: Updated Tips API (v2.1.0)
  - ✅ Added authentication & authorization (Admin only for CUD operations)
  - ✅ Added HTML sanitization with DOMPurify
  - ✅ Fixed SQL injection vulnerability
  - ✅ Enhanced security with XSS protection
  - ✅ Added comprehensive documentation
- **2025-12-08**: Added Authentication API (v2.0.0)
  - JWT-based authentication with access/refresh tokens
  - Role-based access control (Admin, Agent, Guest)
  - Secret field protection for unauthenticated users
  - Team-based filtering for Agent role
- **2025-12-08**: Initial API documentation
- **2025-12-04**: API v1.0.0 deployed

---

**For more information, contact the development team.**

