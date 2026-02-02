# Property Sorting API Documentation

## ภาพรวม
API นี้รองรับการเรียงลำดับ (sorting) properties ได้หลายแบบ โดยใช้ query parameters `sort` และ `order`

## Parameters

### `sort` (string, optional)
ฟิลด์ที่ต้องการใช้ในการเรียงลำดับ

**ค่าที่รองรับ:**
- `created_at` (default) - เรียงตามวันที่สร้าง
- `price` - เรียงตามราคา (จะเลือกใช้ `price` หรือ `price_alternative` อัตโนมัติตาม status)
- `id` - เรียงตาม property ID

**Default:** `created_at`

### `order` (string, optional)
ลำดับการเรียง

**ค่าที่รองรับ:**
- `desc` (default) - จากมากไปน้อย / ใหม่ไปเก่า
- `asc` - จากน้อยไปมาก / เก่าไปใหม่

**Default:** `desc`

## ตัวอย่างการใช้งาน

### 1. เรียงตามวันที่ (New > Old)
```bash
GET /api/properties?sort=created_at&order=desc
```
- เรียงจาก property ที่สร้างใหม่ไปเก่า (default behavior)

### 2. เรียงตามวันที่ (Old > New)
```bash
GET /api/properties?sort=created_at&order=asc
```
- เรียงจาก property ที่สร้างเก่าไปใหม่

### 3. เรียงตามราคา (Low to High) - For Rent
```bash
GET /api/properties?status=rent&sort=price&order=asc
```
- เรียงราคา (rent) จากต่ำไปสูง
- ใช้ฟิลด์ `price` สำหรับ For Rent

### 4. เรียงตามราคา (High to Low) - For Rent
```bash
GET /api/properties?status=rent&sort=price&order=desc
```
- เรียงราคา (rent) จากสูงไปต่ำ

### 5. เรียงตามราคา (Low to High) - For Sale
```bash
GET /api/properties?status=sale&sort=price&order=asc
```
- เรียงราคา (sale) จากต่ำไปสูง
- ใช้ฟิลด์ `price_alternative` สำหรับ For Sale

### 6. เรียงตามราคา (High to Low) - For Sale
```bash
GET /api/properties?status=sale&sort=price&order=desc
```
- เรียงราคา (sale) จากสูงไปต่ำ

### 7. ใช้ร่วมกับ filters อื่นๆ
```bash
GET /api/properties?province=Bangkok&type=Factory&sort=price&order=asc&limit=10
```
- กรองตาม province และ type
- เรียงตามราคา จากต่ำไปสูง
- จำกัดผลลัพธ์ 10 รายการ

## Response Format

API จะส่งข้อมูล sorting ใน response object:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1843,
    "pages": 93
  },
  "filters": {
    "keyword": null,
    "status": "rent",
    ...
  },
  "sorting": {
    "sort": "price",
    "order": "ASC"
  }
}
```

## การทำงานของ Price Sorting

เมื่อใช้ `sort=price` ระบบจะเลือกฟิลด์ราคาอัตโนมัติตาม `status`:

| Status | ฟิลด์ที่ใช้ | คำอธิบาย |
|--------|------------|----------|
| For Rent | `price` | ราคาเช่า |
| For Sale | `price_alternative` | ราคาขาย |
| For Rent & Sale | `price` (default) | ราคาเช่า (ถ้าไม่ระบุ status) |

**หมายเหตุ:** ถ้าต้องการเรียงตามราคาขาย ควรใช้ `status=sale` ด้วยเสมอ

## Validation

- ถ้าส่งค่า `sort` ที่ไม่รองรับ -> จะใช้ `created_at` แทน
- ถ้าส่งค่า `order` ที่ไม่รองรับ -> จะใช้ `desc` แทน
- การ validation เป็นแบบ silent (ไม่ error แต่ใช้ค่า default)

## ตัวอย่าง Response

### Success Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1137,
      "property_id": "AT1348R",
      "price": "22000.00",
      "status": "For Rent",
      "created_at": "2025-12-04T07:16:12.895Z"
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 1773,
    "pages": 355
  },
  "sorting": {
    "sort": "price",
    "order": "ASC"
  }
}
```

## สรุปการใช้งาน

| การใช้งาน | Parameters |
|-----------|------------|
| ใหม่ > เก่า (default) | `sort=created_at&order=desc` หรือไม่ต้องส่ง |
| เก่า > ใหม่ | `sort=created_at&order=asc` |
| ราคาต่ำ > สูง | `sort=price&order=asc` |
| ราคาสูง > ต่ำ | `sort=price&order=desc` |

## หมายเหตุสำหรับ Frontend

1. **Default Sorting**: ถ้าไม่ส่ง parameters จะเรียงแบบ `created_at DESC`
2. **Price Field**: ระบบจะเลือก price field อัตโนมัติตาม status
3. **Response Validation**: ตรวจสอบ `sorting` object ใน response เพื่อ confirm ค่าที่ใช้จริง
4. **URL State**: แนะนำให้เก็บ `sort` และ `order` ใน URL query params เพื่อให้ shareable
