# ระบบคำขอใช้ตำแหน่งว่าง เขตสุขภาพที่ 1

เว็บแอป Google Apps Script ให้หน่วยงานส่งคำขอใช้ตำแหน่ง 11 ประเภท (ตามบัญชีประจำเดือน) เขตพิจารณาผลในระบบ
และออก "บัญชีการขอใช้ตำแหน่งว่าง ประจำเดือน …" เป็น Google Sheet / Excel ได้ในคลิกเดียว

## 🔗 ลิงก์

- **ระบบจริง:** https://healthregion1chro.github.io/vacancy-request-gas/ — เชื่อมกับเว็บแอป Apps Script ตามลิงก์ใน `docs/config.js` (login ด้วยบัญชีที่เขตออกให้)
- **หน้าตัวอย่าง (ข้อมูลสมมติ):** https://healthregion1chro.github.io/vacancy-request-gas/demo/ — login ด้วย `admin` + รหัสอะไรก็ได้

## ติดตั้งระบบจริง

1. สร้างโปรเจกต์ Apps Script ผูกกับ Google Sheet
2. วางโค้ดจาก [`install/Code.gs`](install/Code.gs) (ไฟล์เดียว รวมหน้าเว็บไว้แล้ว)
3. รัน `setup` แล้ว Deploy เป็นเว็บแอป

รายละเอียดทั้งหมดอยู่ใน [คู่มือติดตั้ง.md](คู่มือติดตั้ง.md)

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `Code.gs` | ฝั่งเซิร์ฟเวอร์: สิทธิ์ผู้ใช้ บันทึกคำขอ พิจารณา ส่งออก |
| `Index.html` / `Styles.html` / `App.html` | หน้าเว็บ |
| `appsscript.json` | Manifest |
| `install/` | `build.ps1` รวมทุกไฟล์เป็น `install/Code.gs` ไฟล์เดียว |
| `preview/` | หน้าตัวอย่างข้อมูลสมมติ — `sh preview/build-artifact.sh` สร้าง `preview.html`, `docs/demo/` (ตัวอย่าง) และ `docs/index.html` (ระบบจริงบน GitHub Pages) |
