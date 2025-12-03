# คู่มือติดตั้ง Docker

คู่มือติดตั้ง Docker Desktop สำหรับใช้งาน Development Environment

---

## 📋 ก่อนเริ่มติดตั้ง

ตรวจสอบ System Requirements ของ OS ที่ใช้:

### Windows
- Windows 10 64-bit: Pro, Enterprise, หรือ Education (Build 19041 ขึ้นไป)
- หรือ Windows 11 64-bit
- WSL 2 feature enabled
- RAM อย่างน้อย 4GB

### macOS
- macOS 11 Big Sur ขึ้นไป
- RAM อย่างน้อย 4GB
- สำหรับ Mac M1/M2: รองรับแล้ว

### Linux (Ubuntu/Debian)
- Ubuntu 20.04 LTS ขึ้นไป
- หรือ Debian 10 ขึ้นไป
- 64-bit OS
- Kernel 3.10 ขึ้นไป

---

## 🪟 Windows

### วิธีที่ 1: ติดตั้ง Docker Desktop (แนะนำ)

#### 1. Enable WSL 2

เปิด PowerShell ในโหมด Administrator แล้วรันคำสั่ง:

```powershell
wsl --install
```

หรือถ้าติดปัญหา ให้รันทีละคำสั่ง:

```powershell
# Enable Windows Subsystem for Linux
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart computer
Restart-Computer

# หลัง restart ให้ตั้ง WSL 2 เป็น default
wsl --set-default-version 2
```

#### 2. ดาวน์โหลด Docker Desktop

1. ไปที่ https://www.docker.com/products/docker-desktop/
2. คลิก "Download for Windows"
3. รันไฟล์ `Docker Desktop Installer.exe`

#### 3. ติดตั้ง

1. Double-click `Docker Desktop Installer.exe`
2. ทำตามขั้นตอน installer
3. เลือก "Use WSL 2 instead of Hyper-V" (แนะนำ)
4. รอให้ติดตั้งเสร็จ
5. Restart computer

#### 4. เปิดใช้งาน Docker Desktop

1. เปิด Docker Desktop จาก Start Menu
2. รอให้ Docker Engine เริ่มทำงาน (ประมาณ 1-2 นาที)
3. เมื่อเห็น "Docker Desktop is running" แสดงว่าพร้อมใช้งาน

#### 5. ตรวจสอบการติดตั้ง

เปิด PowerShell หรือ Command Prompt แล้วรัน:

```bash
docker --version
docker-compose --version
docker run hello-world
```

ถ้าขึ้น "Hello from Docker!" แสดงว่าติดตั้งสำเร็จ ✅

---

## 🍎 macOS

### ติดตั้ง Docker Desktop

#### 1. ดาวน์โหลด

ไปที่ https://www.docker.com/products/docker-desktop/

เลือกให้ตรกับ chip ของเครื่อง:
- **Apple Silicon (M1/M2/M3)** - Download for Apple Silicon
- **Intel Chip** - Download for Intel

#### 2. ติดตั้ง

1. เปิดไฟล์ `Docker.dmg` ที่ดาวน์โหลดมา
2. ลาก Docker icon ไปที่ Applications folder
3. เปิด Docker จาก Applications

#### 3. ให้สิทธิ์

1. Docker จะขอสิทธิ์ privileged access
2. ใส่ password ของ macOS
3. รอให้ Docker Engine เริ่มทำงาน

#### 4. ตรวจสอบการติดตั้ง

เปิด Terminal แล้วรัน:

```bash
docker --version
docker-compose --version
docker run hello-world
```

ถ้าขึ้น "Hello from Docker!" แสดงว่าติดตั้งสำเร็จ ✅

---

## 🐧 Linux (Ubuntu/Debian)

### วิธีที่ 1: ติดตั้ง Docker Engine (แนะนำสำหรับ Linux)

#### 1. ถอน version เก่า (ถ้ามี)

```bash
sudo apt-get remove docker docker-engine docker.io containerd runc
```

#### 2. ติดตั้ง dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
```

#### 3. เพิ่ม Docker's GPG key

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

#### 4. เพิ่ม Docker repository

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

#### 5. ติดตั้ง Docker Engine

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

#### 6. เพิ่ม user ของคุณเข้า docker group (ไม่ต้องใช้ sudo)

```bash
sudo usermod -aG docker $USER
```

**สำคัญ:** ต้อง logout แล้ว login ใหม่ หรือรัน:

```bash
newgrp docker
```

#### 7. เริ่มและ enable Docker service

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

#### 8. ตรวจสอบการติดตั้ง

```bash
docker --version
docker compose version
docker run hello-world
```

ถ้าขึ้น "Hello from Docker!" แสดงว่าติดตั้งสำเร็จ ✅

### วิธีที่ 2: ติดตั้ง Docker Desktop for Linux (Optional)

สำหรับผู้ที่ต้องการ GUI:

```bash
# ดาวน์โหลดจาก
# https://docs.docker.com/desktop/install/linux-install/

# ติดตั้ง (Ubuntu)
sudo apt install ./docker-desktop-<version>-<arch>.deb
```

---

## 🔧 การตั้งค่าเพิ่มเติม (Optional แต่แนะนำ)

### เพิ่ม Memory สำหรับ Docker (ถ้าเครื่องมี RAM มาก)

**Windows/macOS (Docker Desktop):**
1. เปิด Docker Desktop
2. Settings → Resources → Advanced
3. ตั้งค่า:
   - Memory: 4-8 GB (ขึ้นอยู่กับ RAM เครื่อง)
   - CPUs: 2-4 cores
4. คลิก "Apply & Restart"

**Linux:**
แก้ไข `/etc/docker/daemon.json`:

```json
{
  "default-ulimits": {
    "memlock": {
      "hard": -1,
      "soft": -1
    }
  }
}
```

จากนั้นรัน:
```bash
sudo systemctl restart docker
```

---

## 🧪 ทดสอบว่า Docker ใช้งานได้

### 1. ทดสอบคำสั่งพื้นฐาน

```bash
# ดู version
docker --version

# ดู Docker info
docker info

# ทดสอบ run container
docker run hello-world

# ดู images
docker images

# ดู containers
docker ps -a
```

### 2. ทดสอบ Docker Compose

```bash
# ดู version
docker-compose --version
# หรือ
docker compose version
```

---

## ❓ แก้ปัญหาที่พบบ่อย

### Windows: "WSL 2 installation is incomplete"

**แก้ไข:**
1. ดาวน์โหลด WSL 2 kernel update: https://aka.ms/wsl2kernel
2. ติดตั้งและ restart Docker Desktop

### macOS: "Docker Desktop requires macOS 11 or newer"

**แก้ไข:**
- อัพเดท macOS ให้เป็นเวอร์ชั่นใหม่กว่า
- หรือติดตั้ง Docker Toolbox (เวอร์ชั่นเก่า)

### Linux: "permission denied" เมื่อรัน docker

**แก้ไข:**
```bash
sudo usermod -aG docker $USER
newgrp docker
# หรือ logout และ login ใหม่
```

### Docker Desktop ไม่เปิด / ค้าง

**แก้ไข:**
1. ปิด Docker Desktop
2. ลบ Docker temp files:
   - Windows: `%APPDATA%/Docker`
   - macOS: `~/Library/Containers/com.docker.docker`
3. เปิด Docker Desktop ใหม่

### Container รันไม่ได้ / Network error

**แก้ไข:**
```bash
# Restart Docker
# Windows/macOS: จาก Docker Desktop → Restart
# Linux:
sudo systemctl restart docker
```

---

## 📚 Resource เพิ่มเติม

- [Docker Documentation](https://docs.docker.com/)
- [Docker Desktop Manual](https://docs.docker.com/desktop/)
- [Docker Hub](https://hub.docker.com/) - Container images

---

## ✅ Checklist ก่อนเริ่ม Development

หลังติดตั้ง Docker เสร็จแล้ว ตรวจสอบว่า:

- [ ] Docker daemon รันอยู่ (Docker Desktop เปิดอยู่)
- [ ] รัน `docker --version` ได้
- [ ] รัน `docker-compose version` ได้
- [ ] รัน `docker run hello-world` สำเร็จ
- [ ] (Linux) สามารถรัน docker โดยไม่ต้องใช้ sudo

ถ้าทุกอย่างผ่านแล้ว พร้อมใช้งาน Docker! 🎉

**ขั้นตอนต่อไป:** อ่าน [DOCKER-DEV.md](./DOCKER-DEV.md) เพื่อเริ่ม development ด้วย Docker
