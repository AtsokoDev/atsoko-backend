# Atsoko - Industrial Property Platform

เว็บไซต์แพลตฟอร์มสำหรับค้นหาและจัดการอสังหาริมทรัพย์อุตสาหกรรม (โรงงานและคลังสินค้า) พร้อมระบบ Admin ที่ครบครัน

## 🌟 Features

### 🏠 Homepage
- **Hero Section** พร้อม Quick Search
- **สถิติแบบ Real-time** จากฐานข้อมูล
- **Featured Properties** แสดง properties ล่าสุด

### 🏭 Properties Page
- **Grid/List View** สลับโหมดการแสดงผล
- **Advanced Filters** กรองตาม status, type, province, size
- **Pagination** แบ่งหน้าแสดงผล
- **Property Cards** แสดงข้อมูลอย่างครบถ้วน พร้อมรูปภาพ

### 📝 Tips & Articles Page
- แสดงบทความและเคล็ดลับต่างๆ
- Card Layout ที่สวยงาม

### ❓ FAQ Page
- คำถามที่พบบ่อย แบบ Accordion
- เปิด-ปิดคำตอบได้

### 📧 Contact Page
- **Contact Form** ส่งข้อความถึง Admin
- **Rate Limiting** ป้องกัน spam
- **Email Notification** ส่งอีเมลแจ้งเตือน (ถ้าตั้งค่า Resend)

### ⚙️ Admin Panel
แผงควบคุมสำหรับจัดการข้อมูลทั้งหมด:

#### 1. Properties Management
- ✅ แสดงรายการ properties ทั้งหมด
- ✅ เพิ่ม property ใหม่
- ✅ แก้ไข property
- ✅ ลบ property
- ✅ ดูข้อมูลในรูปแบบตาราง

#### 2. Tips Management
- ✅ แสดงรายการบทความทั้งหมด
- ✅ ลบบทความ

#### 3. FAQ Management
- ✅ แสดงรายการ FAQ ทั้งหมด
- ✅ ลบ FAQ

#### 4. Contact Messages
- ✅ แสดงข้อความที่ได้รับทั้งหมด
- ✅ ลบข้อความ

## 🎨 Design Features

### UI/UX
- ✨ **Modern Glassmorphism Design**
- 🌙 **Dark Theme** ที่สวยงามและนุ่มตา
- 🎭 **Smooth Animations** ทุกการ interact
- 📱 **Fully Responsive** รองรับทุกหน้าจอ
- ⚡ **Fast Loading** แสดงผลรวดเร็ว

### Color System
- **Primary**: Indigo (#6366f1)
- **Secondary**: Purple (#8b5cf6)
- **Success**: Green (#10b981)
- **Danger**: Red (#ef4444)
- **Dark Background**: Slate (#0f172a)

## 🚀 การใช้งาน

### เปิดเว็บไซต์

1. ตรวจสอบให้แน่ใจว่า backend server รันอยู่:
```bash
npm start
```

2. เปิดไฟล์ `index.html` ในเบราว์เซอร์:
```bash
# วิธีที่ 1: เปิดโดยตรง
open index.html  # macOS
xdg-open index.html  # Linux
start index.html  # Windows

# วิธีที่ 2: ใช้ http-server (แนะนำ)
npx http-server -p 8080
# จากนั้นเปิด http://localhost:8080
```

### Navigation

เมนูด้านบนมี 6 sections:
- **Home** - หน้าหลัก
- **Properties** - รายการอสังหาฯ
- **Tips & Articles** - บทความ
- **FAQ** - คำถามที่พบบ่อย
- **Contact** - ติดต่อเรา
- **Admin** - แผงควบคุม (สำหรับผู้ดูแล)

### การค้นหา Properties

1. ใช้ **Quick Search** ที่หน้า Home
2. หรือไปที่ **Properties Page** แล้วใช้ Filters:
   - Status (For Rent/For Sale)
   - Type (Warehouse/Factory)
   - Province
   - Min/Max Size

### การจัดการข้อมูล (Admin)

1. คลิก **Admin** ในเมนู
2. เลือก Tab ที่ต้องการ (Properties/Tips/FAQ/Contacts)
3. สำหรับ Properties:
   - คลิก **Add Property** เพื่อเพิ่มใหม่
   - คลิก **Edit icon** เพื่อแก้ไข
   - คลิก **Delete icon** เพื่อลบ

## 📁 ไฟล์ทั้งหมด

```
atsoko-backend/
├── index.html          # หน้าเว็บหลัก (Production)
├── styles.css          # CSS สำหรับหน้าเว็บหลัก
├── app.js              # JavaScript สำหรับหน้าเว็บหลัก
│
├── api-tester.html     # เครื่องมือทดสอบ API
├── api-tester.css      # CSS สำหรับ API tester
├── api-tester.js       # JavaScript สำหรับ API tester
│
└── API_TESTER_README.md  # คู่มือใช้งาน API Tester
```

## 🔧 Configuration

### API URL
แก้ไขที่ไฟล์ `app.js`:
```javascript
const API_URL = 'http://localhost:3000/api';
```

### Image URL
รูปภาพจะถูกโหลดจาก:
```
http://localhost:3000/images/{filename}
```

## 📊 Data Flow

```
Frontend (index.html)
    ↓
JavaScript (app.js)
    ↓
API Calls (fetch)
    ↓
Backend (http://localhost:3000/api)
    ↓
PostgreSQL Database
```

## ✨ Key Functions

### Properties
```javascript
loadPropertiesPage()      // โหลดหน้า properties
applyFilters()            // ใช้ filters
clearFilters()            // ล้าง filters
viewProperty(id)          // ดู property รายละเอียด
```

### Admin
```javascript
showAddPropertyForm()     // แสดงฟอร์มเพิ่ม
saveProperty(event)       // บันทึก property
editProperty(id)          // แก้ไข property
deletePropertyAdmin(id)   // ลบ property
```

### Utilities
```javascript
formatPrice(price)        // จัดรูปแบบราคา
formatDate(dateString)    // จัดรูปแบบวันที่
showToast(message, type)  // แสดง notification
```

## 🎯 Features Coming Soon

- [ ] Property Detail Page
- [ ] Image Upload in Admin
- [ ] User Authentication
- [ ] Advanced Search
- [ ] Map View
- [ ] Favorites/Wishlist
- [ ] Property Comparison

## 🌐 Browser Support

- ✅ Chrome/Edge (แนะนำ)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## 🐛 Known Issues

1. ยังไม่มี Authentication - ใครก็เข้า Admin ได้
2. รูปภาพบาง properties อาจไม่แสดงถ้ายังไม่ได้อัปโหลด
3. Coordinates ถูกเปิดเผยทั้งหมด

## 📝 Notes

### Security (สำหรับ Production)
- ⚠️ ต้องเพิ่ม Authentication ก่อน deploy
- ⚠️ ใช้ HTTPS
- ⚠️ ซ่อน sensitive data เช่น exact coordinates
- ⚠️ เพิ่ม CORS configuration
- ⚠️ รัน backend ด้วย PM2 หรือ systemd

### Performance
- รูปภาพถูกแปลงเป็น WebP อัตโนมัติ (ถ้าอัปโหลดผ่าน API)
- Lazy loading สำหรับรูปภาพ
- Pagination จำกัดข้อมูลต่อหน้า

## 🤝 Integration

เว็บไซต์นี้ integrate กับ Backend APIs:
- Properties API
- Statistics API
- Tips/Articles API
- FAQ API
- Contact Form API

ดู `API_TESTER_README.md` สำหรับรายละเอียด API

## 💡 Tips

1. **Testing**: ใช้ `api-tester.html` ทดสอบ API ก่อนใช้งานจริง
2. **Development**: ใช้ Browser DevTools ดู Console สำหรับ errors
3. **Debugging**: เปิด Network tab ดู API requests/responses
4. **Performance**: ใช้ Lighthouse ตรวจสอบประสิทธิภาพ

---

Made with ❤️ for Atsoko Industrial Property Platform
