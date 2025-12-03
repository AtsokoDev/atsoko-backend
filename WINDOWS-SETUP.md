# คู่มือเริ่มต้นสำหรับ Windows (CMD/PowerShell)

คู่มือสำหรับ Developer ที่ใช้ Windows

---

## ✅ ตรวจสอบว่าติดตั้ง Docker แล้ว

เปิด **Command Prompt (CMD)** หรือ **PowerShell** แล้วรัน:

```cmd
docker --version
docker-compose --version
```

ถ้าขึ้น version แสดงว่าพร้อมใช้งาน ✅

ถ้ายังไม่มี Docker → อ่าน [DOCKER-INSTALL.md](./DOCKER-INSTALL.md#-windows)

---

## 🚀 เริ่มใช้งาน (5 ขั้นตอน)

### ขั้นที่ 1: เปิด Command Prompt หรือ PowerShell

กด `Win + R` → พิมพ์ `cmd` → Enter

หรือ

กด `Win + X` → เลือก **Windows PowerShell**

---

### ขั้นที่ 2: ไปที่โฟลเดอร์โปรเจกต์

```cmd
cd Desktop\atsoko-backend
```

หรือถ้า clone repo:
```cmd
git clone <repository-url>
cd atsoko-backend
```

---

### ขั้นที่ 3: Copy ไฟล์ environment

**CMD:**
```cmd
copy .env.docker .env
```

**PowerShell:**
```powershell
Copy-Item .env.docker .env
```

---

### ขั้นที่ 4: Start Docker Containers

```cmd
docker-compose up -d
```

รอประมาณ 2-3 นาที (ครั้งแรก)

---

### ขั้นที่ 5: Import ข้อมูล

```cmd
docker-compose exec backend node scripts/import-data.js
```

---

## ✅ ทดสอบว่าใช้งานได้

เปิด browser ไปที่: **http://localhost:3000**

ควรเห็น:
```json
{"message":"Backend API is running","version":"1.0.0","status":"OK"}
```

---

## 💻 คำสั่งที่ใช้ประจำวัน (Windows)

### เริ่มทำงาน

```cmd
REM เปิด Docker Desktop ก่อน
REM จากนั้นรัน:
cd Desktop\atsoko-backend
docker-compose up -d
```

### ดู logs

```cmd
docker-compose logs -f backend
```

กด `Ctrl+C` เพื่อหยุดดู

### หยุดทำงาน

```cmd
docker-compose down
```

### เช็คสถานะ containers

```cmd
docker-compose ps
```

### Restart backend

```cmd
docker-compose restart backend
```

### เข้า database

```cmd
docker-compose exec postgres psql -U postgres -d thaiindustrialproperty_db
```

พิมพ์ `\q` แล้วกด Enter เพื่อออกจาก psql

---

## 🔧 คำสั่งอื่นๆ ที่มีประโยชน์

### ดู Docker images

```cmd
docker images
```

### ดู containers ทั้งหมด

```cmd
docker ps -a
```

### ลบ containers และ volumes ทั้งหมด (เริ่มใหม่)

```cmd
docker-compose down -v
docker-compose up -d --build
docker-compose exec backend node scripts/import-data.js
```

### ติดตั้ง npm package ใหม่

```cmd
docker-compose exec backend npm install <package-name>
```

---

## 🐛 แก้ปัญหา Windows

### ปัญหา: "docker-compose: command not found" หรือ "docker: command not found"

**แก้:**
1. เปิด Docker Desktop
2. รอให้ Docker Engine เริ่มทำงาน (ดู icon ใน system tray)
3. ลองรันคำสั่งใหม่

### ปัญหา: "Error response from daemon"

**แก้:**
1. คลิกขวาที่ Docker Desktop icon (system tray)
2. เลือก **Restart**
3. รอ 1-2 นาที
4. ลองรันใหม่

### ปัญหา: Port 3000 ถูกใช้แล้ว

**เช็คว่าโปรแกรมไหนใช้ port 3000:**
```cmd
netstat -ano | findstr :3000
```

**ปิดโปรแกรมที่ใช้ port นั้น หรือ เปลี่ยน port:**

แก้ไขไฟล์ `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # ใช้ 3001 แทน
```

### ปัญหา: "Access denied" หรือ "Permission denied"

**แก้:**
- เปิด CMD/PowerShell แบบ **Run as Administrator**
- คลิกขวา → Run as administrator

### ปัญหา: ไฟล์ .env ไม่ถูก copy

**CMD:**
```cmd
REM แน่ใจว่าอยู่ในโฟลเดอร์ถูกต้อง
cd Desktop\atsoko-backend

REM ลองใหม่
copy .env.docker .env

REM ตรวจสอบว่ามีไฟล์แล้ว
dir .env
```

**PowerShell:**
```powershell
# Copy ไฟล์
Copy-Item .env.docker .env

# ตรวจสอบ
Get-Item .env
```

---

## 📝 เทคนิคสำหรับ Windows

### ใช้ Autocomplete ใน PowerShell

พิมพ์ชื่อไฟล์/โฟลเดอร์บางส่วน แล้วกด `Tab`

ตัวอย่าง:
```powershell
cd Desk<Tab>      # จะเติมเป็น Desktop
cd atsoko<Tab>    # จะเติมเป็น atsoko-backend
```

### Copy คำสั่งจาก Terminal

1. เลือกข้อความที่ต้องการ copy
2. คลิกขวา → เลือก **Copy**
3. หรือกด `Enter` (ใน CMD บางเวอร์ชัน)

### เปิด Terminal ในโฟลเดอร์ปัจจุบัน

1. เปิด File Explorer
2. ไปที่โฟลเดอร์ `atsoko-backend`
3. กด `Shift + คลิกขวา` ในพื้นที่ว่าง
4. เลือก **Open PowerShell window here** หรือ **Open command window here**

---

## 📁 Path ใน Windows

### Path แบบ Backslash

Windows ใช้ `\` (backslash):
```cmd
cd C:\Users\YourName\Desktop\atsoko-backend
```

### Path แบบ Forward slash (PowerShell)

PowerShell รองรับ `/` ได้:
```powershell
cd C:/Users/YourName/Desktop/atsoko-backend
```

---

## ✅ Checklist สำหรับ Windows Users

- [ ] Docker Desktop ติดตั้งแล้วและเปิดอยู่
- [ ] รัน `docker --version` ได้
- [ ] รัน `docker-compose --version` ได้
- [ ] Copy `.env.docker` เป็น `.env` แล้ว (ใช้คำสั่ง `copy`)
- [ ] รัน `docker-compose up -d` สำเร็จ
- [ ] Import data แล้ว
- [ ] เปิด http://localhost:3000 ได้

---

## 🔗 ลิงก์ที่เป็นประโยชน์

### เอกสารเพิ่มเติม:
- [QUICK-START.md](./QUICK-START.md) - คู่มือเริ่มต้นทั่วไป
- [DOCKER-INSTALL.md](./DOCKER-INSTALL.md) - ติดตั้ง Docker
- [DOCKER-DEV.md](./DOCKER-DEV.md) - รายละเอียดการใช้ Docker

### Docker Desktop for Windows:
- Download: https://www.docker.com/products/docker-desktop/
- Documentation: https://docs.docker.com/desktop/windows/

---

## 💡 Tips สำหรับ Windows

1. **ใช้ PowerShell มากกว่า CMD** - มี feature มากกว่า
2. **ติดตั้ง Windows Terminal** - Terminal ที่ดีกว่า (ฟรีใน Microsoft Store)
3. **เปิด Docker Desktop ทิ้งไว้** - จะได้ไม่ต้องเปิดทุกครั้ง
4. **ใช้ Git Bash** - ถ้าคุ้นเคยกับ Linux commands

---

**สำเร็จแล้ว! เริ่ม development ได้เลย** 🎉
