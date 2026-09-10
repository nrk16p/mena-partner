# Driver Partner: สถานะคนขับ/พ้นสภาพ/สถานะรถ/Catalog รายคัน — Design

วันที่ 2026-09-10 · อนุมัติโดยผู้ใช้ (ledger อัตโนมัติ + ปุ่มปิดเอง, catalog 1 หน้า)

## 1. คนขับ: แยก Active 2 แบบ + พ้นสภาพ (หน้า /drivers)

แท็บ: ทั้งหมด · Active (ผ่อนชำระ) · Active (ปิดงวดแล้ว) · พ้นสภาพ · ไม่ใช้งาน(อื่นๆ)
Deep-link `/drivers?status=paying|paidoff|exit|inactive|` (sidebar highlight ตาม query)

**ปิดงวดแล้ว (paidoff)** — คำนวณฝั่ง server ใน `GET /api/drivers` (เพิ่ม field `installmentState`):
1. contract (จับคู่ `drivers.contractCode` → `contracts.contractCode`) `status === "completed"` → paidoff
2. else driver_ledger ที่ `contractCode` เดียวกัน, `source.type === "vehicle_installment"`, status ∉ {cancelled}:
   ถ้ามี และทุกใบ `status === "paid"` หรือ `paidAmount >= principal - 0.005` → paidoff
   ถ้ามีและยังเหลือ → paying
3. else ไม่มี ledger ค่างวด: ไม่มีสัญญาในระบบ → paying (คนขับใหม่/รหัสหาไม่เจอ ไม่ถือว่าปิดงวด); `contracts.monthlyInstallment > 0` → paying, ไม่งั้น paidoff
ปุ่ม "ปิดงวด (ผ่อนครบ)" ในหน้าสัญญา → `contracts.status = "completed"` (+ log activity) — เฉพาะ admin/finance

**พ้นสภาพ (exit)** — drivers ใหม่: `exitType: "paid_exit" | "early_exit"`, `exitReason: string`, `endDate`.
ปุ่ม "พ้นสภาพ" ในพาเนลคนขับ (edit) เปิด dialog: ประเภท / เหตุผล / วันที่ →
`POST /api/drivers/[id]/exit` ทำในคำขอเดียว:
- drivers: status=inactive, exitType, exitReason, endDate, workHistory push {role:"exit", to:endDate, note}
- contract ของ contractCode (ถ้า active): paid_exit → completed, early_exit → terminated (+ endDate)
- paid_exit: vehicle_master (ทะเบียนจากสัญญา) status=inactive
- early_exit: master_price_list ทะเบียนนั้น saleStatus="review" (ถ้ายังไม่ ready)
- activity_log entity driver action "exit"
ทุกอย่างสิทธิ์ admin+ (hasPerm "masterdata")

## 2. รถ: 3 สถานะ (หน้า /vehicles)

`GET /api/vehicles` เพิ่ม field `fleetState: "working" | "ready" | "preparing" | "inactive"`:
- inactive: vehicle.status === "inactive"
- working: ทะเบียน (normPlate) อยู่ในสัญญา active
- ready: ไม่มีสัญญา + master_price_list.saleStatus === "ready"
- preparing: ที่เหลือ (repair15/30/review/null/ไม่มีแถวราคา)
แท็บ: ทั้งหมด · รถวิ่งงานอยู่ · รถพร้อมขาย · รถอยู่ระหว่างดำเนินการ · ไม่ใช้งาน (นับจากชุดเต็ม ไม่ใช่ชุดที่กรองแล้ว)
คอลัมน์สถานะแสดง badge fleetState + saleStatus ย่อย (รอซ่อม 15/30 วัน ฯลฯ)

## 3. Sidebar

ระบบสัญญา: คนขับ (/drivers) · พ้นสภาพ (/drivers?status=exit) · รถ · ราคาขาย · สัญญา
activeHref: แยก path?query — item ที่มี query ต้อง match ทั้ง path และ query ทุกคู่; item ไม่มี query ชนะเฉพาะเมื่อไม่มี item ที่ query match. ใช้ useSearchParams ห่อ Suspense ใน sidebar (client comp).
command-palette + module-status เพิ่มรายการเดียวกัน

## 4. Catalog รายคัน (1 หน้า A4)

`lib/catalog-pdf.ts` (pdfmake, Sarabun, ธีมทองเดียวกับ quotation-pdf):
- หัว: โลโก้ + สโลแกน (config)
- รูปหลัก photos.front/photoUrl (fetch → base64, fallback กรอบ placeholder "ยังไม่มีรูป") + แถวรูปมุมอื่น ≤4
- ข้อมูลรถ: ยี่ห้อ รุ่น เบอร์รถ ทะเบียน ปีจดทะเบียน (พ.ศ.) ลักษณะ/ประเภท สี เครื่องยนต์
- ราคา: ราคาขาย / ดาวน์ / เงินสด / ผ่อนดาวน์ n งวด / ไฟแนนซ์ n งวด / hero "เพียงเดือนละ"
- โปรโมชั่น: pro1/pro2/pro3 จาก promotion_master (บรรทัดจาก /api/promotions/master builder)
- จุดขาย + ติดต่อ + เงื่อนไข (config)
`catalog_config` (doc เดียว id "default"): tagline, sellingPoints[], contactName, contactPhone, contactLine, terms[] — แก้ที่ `/quotations/catalog-settings` (admin)
Routes: `GET /api/catalog/[plate]/pdf` · `GET /api/catalog/pdf?status=ready` (รวมทุกคันพร้อมขาย 1 หน้า/คัน)
ปุ่ม: price-list แถวละ "Catalog" + ปุ่มหัวตาราง "Catalog รถพร้อมขาย (n)"; sidebar ระบบขาย "Catalog รถ" → หน้า /catalog (ลิสต์รถพร้อมขาย + เตือนไม่มีรูป + ปุ่มตั้งค่า template)
รูปจาก DO Spaces public URL — fetch ฝั่ง server, timeout 5s/รูป, ข้ามถ้าล้มเหลว

## Testing
- tsc + next build ทุกขั้น
- Playwright local (cookie trick, SUPERADMIN_EMAILS env) ตรวจแท็บ/นับ/ปุ่มพ้นสภาพ (ใช้คนขับทดสอบแล้วลบ)
- catalog: curl PDF ของทะเบียนที่มีรูปและไม่มีรูป เปิดตรวจด้วย pdftoppm
