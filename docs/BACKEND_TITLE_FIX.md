# Backend Fix: Title Auto-Regeneration

**วันที่:** 2026-02-05  
**ปัญหา:** Title ไม่อัพเดทเมื่อเปลี่ยน location

---

## ✅ สิ่งที่แก้ไข

### 1. ไฟล์ `routes/properties.js` (บรรทัด 1152-1220)

**ปัญหาเดิม:**
- ตอน update property มันอัพเดทแค่ `title_en`, `title_th`, `title_zh`
- แต่**ไม่ได้อัพเดท** ฟิลด์ `title` (ฟิลด์หลักที่ frontend ใช้)

**แก้ไข:**
```javascript
// เดิม - อัพเดทแค่ 3 ฟิลด์
await pool.query(
    'UPDATE properties SET title_en = $1, title_th = $2, title_zh = $3 WHERE id = $4',
    [..., updatedProperty.id]
);

// ใหม่ - อัพเดททั้ง 4 ฟิลด์
await pool.query(
    'UPDATE properties SET title = $1, title_en = $2, title_th = $3, title_zh = $4 WHERE id = $5',
    [..., updatedProperty.id]
);

// อัพเดท response ด้วย
result.rows[0].title = generatedTitles.title_en; // เพิ่มบรรทัดนี้
```

**ผลลัพธ์:**
- ✅ ตอนนี้ `title` จะอัพเดทตามด้วยเมื่อเปลี่ยน location
- ✅ Frontend จะได้ title ใหม่ทันทีในการตอบกลับ

### 2. เพิ่ม Debug Logs

เพิ่ม console.log เพื่อดูว่าระบบ regenerate title หรือไม่:

```javascript
console.log('[UPDATE PROPERTY] Title Regeneration Check:');
console.log('  - Fields updated:', fieldsToUpdate);
console.log('  - Needs regeneration?', needsTitleRegeneration);
console.log('[UPDATE PROPERTY] ✅ Titles updated successfully');
```

---

## 🧪 Test Script

**ไฟล์:** `scripts/test-title-update.js`

**วิธีใช้:**
```bash
# เปิด backend server ก่อน
npm start

# รัน test (terminal ใหม่)
node scripts/test-title-update.js
```

**ผลลัพธ์ที่ควรเห็น:**
```
✅ Login successful
✅ Found property: AT1R
📝 Updating property location...
✅ SUCCESS: Title contains new location!
```

---

## 📋 Frontend ต้องดูอะไร

### ✅ ตรวจสอบว่าแก้แล้ว (ใน PropertyForm.js)

**ต้องมีโค้ดนี้:**
```javascript
// ก่อนส่งไป Backend ต้อง delete title fields
delete processedData.title;
delete processedData.title_en;
delete processedData.title_th;
delete processedData.title_zh;
```

**เหตุผล:** ถ้า frontend ส่ง title fields ไป backend จะใช้ค่าที่ส่งมา ไม่ได้ regenerate

---

### 🧪 ทดสอบ Integration

1. **Edit property** และเปลี่ยน location (province/district/sub_district)
2. **Save** 
3. **ตรวจสอบ:**
   - Title ที่แสดงใน UI ต้องมี location ใหม่
   - ไม่ต้อง refresh หน้า title ควรอัพเดททันที
   - Check Network tab → Response ต้องมี `title` ที่อัพเดทแล้ว

---

### 🔍 Debug (ถ้ามีปัญหา)

**ใน Browser DevTools:**

1. **Network Tab → PUT request**
   - ✅ Request body ต้อง**ไม่มี** `title`, `title_en`, `title_th`, `title_zh`
   - ✅ Request body ต้อง**มี** `province`, `district`, `sub_district` ค่าใหม่

2. **Network Tab → Response**
   - ✅ Response ต้องมี `title` ที่อัพเดทแล้ว
   - ✅ Title ต้องมี location ใหม่

**Backend Logs (ถ้าเข้าถึงได้):**
```
[UPDATE PROPERTY] Title Regeneration Check:
[UPDATE PROPERTY] Regenerating titles with data: {...}
[UPDATE PROPERTY] ✅ Titles updated successfully
```

---

## 🎯 สรุป

**ที่แก้:**
- ✅ `routes/properties.js` - เพิ่มการอัพเดท `title` field
- ✅ เพิ่ม debug logs
- ✅ สร้าง test script

**Frontend ต้องทำ:**
- ✅ ตรวจสอบว่า delete title fields ก่อนส่ง (ควรแก้แล้ว)
- 🧪 ทดสอบ integration ว่า title อัพเดทถูกต้อง
- 🔍 ถ้ามีปัญหา ดู Network tab + Backend logs

**ไฟล์ที่เปลี่ยน:**
- `routes/properties.js` (แก้ไขหลัก)
- `scripts/test-title-update.js` (ใหม่ - สำหรับ test)

---

**สถานะ:** ✅ แก้เสร็จแล้ว  
**ต้องทำต่อ:** Test integration กับ frontend
