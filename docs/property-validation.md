# Property POST Validation Rules

## ✅ Required Fields (บังคับทุกครั้ง)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `type` | string | ประเภท property | "Warehouse", "Factory" |
| `province` | string | จังหวัด | "Bangkok", "Samut Prakan" |
| `district` | string | อำเภอ | "Bang Bo", "Saphan Sung" |
| `sub_district` | string | ตำบล | "Bang Phriang", "Saphan Sung" |
| `size` | number | ขนาดพื้นที่ (sqm) | 288, 1500.50 |
| `status` | string | สถานะ | "For Rent", "For Sale", "For Rent & Sale" |

## 💰 Price Validation (ตาม Status)

### 1. Status = "For Rent"
**ต้องมี:** `price` (ราคาเช่า)

```json
{
  "status": "For Rent",
  "price": 50000
}
```

### 2. Status = "For Sale"
**ต้องมี:** `price_alternative` (ราคาขาย)

```json
{
  "status": "For Sale",
  "price_alternative": 15000000
}
```

### 3. Status = "For Rent & Sale"
**ต้องมีทั้งคู่:** `price` (ราคาเช่า) และ `price_alternative` (ราคาขาย)

```json
{
  "status": "For Rent & Sale",
  "price": 50000,
  "price_alternative": 15000000
}
```

## 🔓 Optional Fields

<details>
<summary><b>ข้อมูลทั่วไป</b></summary>

- `title` - ชื่อ (auto-generate ถ้าไม่ใส่)
- `date` - วันที่
- `labels` - ป้ายกำกับ
- `country` - ประเทศ
- `location` - ที่อยู่
</details>

<details>
<summary><b>ราคาและขนาดเพิ่มเติม</b></summary>

- `price_postfix` - หน่วยราคา (Month, Year)
- `size_prefix` - หน่วยขนาด (sqm, rai)
- `land_size` - ขนาดที่ดิน
- `land_postfix` - หน่วยที่ดิน
</details>

<details>
<summary><b>รายละเอียดทางเทคนิค</b></summary>

- `terms_conditions` - เงื่อนไข (รองรับ format `X|Y|Z`)
- `warehouse_length` - ขนาดโกดัง (24m x 12m)
- `electricity_system` - ระบบไฟฟ้า
- `clear_height` - ความสูงเพดาน (8m)
- `floor_load` - น้ำหนักบรรทุกพื้น (3 tons per sqm)
- `features` - คุณสมบัติ (array)
</details>

<details>
<summary><b>ข้อมูลเจ้าของและตัวแทน</b></summary>

- `landlord_name` - ชื่อเจ้าของ
- `landlord_contact` - เบอร์ติดต่อ
- `agent_team` - ทีมตัวแทน
</details>

<details>
<summary><b>อื่นๆ</b></summary>

- `coordinates` - พิกัด GPS
- `remarks` - หมายเหตุ
- `slug` - URL slug
- `images` - รูปภาพ (array)
- `type_id`, `status_id`, `subdistrict_id` - IDs จาก master tables
- `title_en`, `title_th`, `title_zh` - ชื่อหลายภาษา
</details>

## 📝 ตัวอย่าง Request

### For Rent (Minimum)
```json
{
  "type": "Warehouse",
  "province": "Bangkok",
  "district": "Saphan Sung",
  "sub_district": "Saphan Sung",
  "size": 288,
  "status": "For Rent",
  "price": 35000
}
```

### For Sale (Minimum)
```json
{
  "type": "Factory",
  "province": "Samut Prakan",
  "district": "Bang Bo",
  "sub_district": "Bang Phriang",
  "size": 1500,
  "status": "For Sale",
  "price_alternative": 25000000
}
```

### For Rent & Sale (Full)
```json
{
  "type": "Warehouse",
  "province": "Bangkok",
  "district": "Saphan Sung",
  "sub_district": "Saphan Sung",
  "size": 288,
  "status": "For Rent & Sale",
  "price": 35000,
  "price_postfix": "Month",
  "price_alternative": 15000000,
  "warehouse_length": "24m x 12m",
  "electricity_system": "3 Phase 15/45 Amp (Upgradable)",
  "clear_height": "7m",
  "features": ["With Office area", "Security guard"],
  "floor_load": "3 tons per sqm",
  "landlord_name": "Mr. Smith",
  "landlord_contact": "0812345678",
  "coordinates": "13.744306, 100.707444"
}
```

## ❌ Error Messages

### Missing Required Fields
```json
{
  "success": false,
  "error": "Missing required fields: district, sub_district"
}
```

### Missing Price for Rent
```json
{
  "success": false,
  "error": "Status \"For Rent\" requires price field"
}
```

### Missing Price for Sale
```json
{
  "success": false,
  "error": "Status \"For Sale\" requires price_alternative field"
}
```

### Missing Both Prices for Rent & Sale
```json
{
  "success": false,
  "error": "Status \"For Rent & Sale\" requires both price (rent) and price_alternative (sale)"
}
```

## 🔐 Role-Based Behavior

### Agent
- `agent_team` → auto-set to agent's team
- `approve_status` → auto-set to "pending"

### Admin
- `agent_team` → can set or leave null
- `approve_status` → default "published" (can override)

## 🎯 Auto-Generated
- `property_id` - e.g., AT1862R
- `title` - if not provided
- `title_en`, `title_th`, `title_zh` - if not provided
