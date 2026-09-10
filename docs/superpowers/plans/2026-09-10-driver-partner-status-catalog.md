# Driver Partner Status + Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แยกสถานะคนขับ (ผ่อนชำระ/ปิดงวด/พ้นสภาพ), สถานะรถ 3 แบบ, flow พ้นสภาพครบชุด, และ Catalog PDF รายคัน 1 หน้า

**Architecture:** สถานะที่ derive ทั้งหมดคำนวณฝั่ง API (installmentState บน driver, fleetState บน vehicle) จาก contracts + driver_ledger + master_price_list; หน้า list แค่กรองตาม field. พ้นสภาพ = endpoint เดียวทำหลาย collection. Catalog = pdfmake module ใหม่ตามแบบ quotation-pdf + config doc.

**Tech Stack:** Next.js 16 App Router, MongoDB, pdfmake (lib/pdfmake-printer.ts), Sarabun font, lucide-react, Playwright (verify)

**Spec:** docs/superpowers/specs/2026-09-10-driver-partner-status-catalog-design.md

## Global Constraints
- ห้าม useSearchParams โดยไม่ห่อ Suspense (Vercel prerender ล้ม) — หน้า list อ่าน window.location ใน useEffect ตาม pattern contracts/new
- Page files ห้าม export อะไรนอกจาก default/metadata
- ปีแสดง "2026/2569" ผ่าน lib/utils formatDate; เอกสาร PDF ใช้ พ.ศ.
- ปุ่มยืนยัน/แจ้งเตือนใช้ shared UX (useConfirm/toast) ไม่ใช้ window.confirm
- ทุก task: `npx tsc --noEmit -p .` ผ่าน แล้ว commit (ไม่ push จนกว่าผู้ใช้สั่ง)
- Plate matching ใช้ normPlate (ตัด "สบ." prefix) ทุกจุดที่ join

## File map
- Modify `app/api/vehicles/route.ts` — GET เพิ่ม fleetState
- Modify `app/vehicles/page.tsx` — แท็บ 3 สถานะ + badge
- Create `lib/driver-state.ts` — computeInstallmentStates(db, contractCodes[]) → Map<code, "paying"|"paidoff">
- Modify `app/api/drivers/route.ts` — GET เพิ่ม installmentState + status=paying|paidoff|exit
- Modify `app/drivers/page.tsx` — แท็บใหม่ + ?status deep-link + ปุ่มพ้นสภาพ + dialog
- Create `app/api/drivers/[id]/exit/route.ts` — POST พ้นสภาพ
- Modify `app/api/contracts/[id]/route.ts` หรือ create `app/api/contracts/[id]/close/route.ts` — ปิดงวด
- Modify `app/contracts/[id]/page.tsx` — ปุ่มปิดงวด
- Modify `components/sidebar.tsx`, `components/command-palette.tsx`, `lib/module-status.ts`
- Create `lib/catalog-pdf.ts`, `lib/catalog-config.ts`
- Create `app/api/catalog/[plate]/pdf/route.ts`, `app/api/catalog/pdf/route.ts`, `app/api/catalog/config/route.ts`
- Create `app/catalog/page.tsx` (ลิสต์รถพร้อมขาย + ตั้งค่า template)
- Modify `app/price-list/page.tsx` — ปุ่ม Catalog
- Modify `types/index.ts` — Driver exitType/exitReason, Vehicle fleetState (response only)

---

### Task 1: Vehicle fleetState (API + tabs)
**Files:** app/api/vehicles/route.ts, app/vehicles/page.tsx, types/index.ts
- [ ] API GET: โหลด contracts active (licensePlate) + master_price_list (licensePlate, saleStatus) → set/Map by normPlate; map ทุกคันเป็น fleetState ตาม spec §2; คืน saleStatus ด้วย
- [ ] page: StatusFilter = "" | "working" | "ready" | "preparing" | "inactive"; นับจาก items เต็ม; badge คอลัมน์สถานะ (working เขียว/ready ทอง/preparing เหลือง/inactive เทา + saleStatus ย่อย)
- [ ] verify: curl /api/vehicles นับ working=63 ready=18 (≈) ; tsc; commit

### Task 2: Driver installmentState (lib + API + tabs + deep-link)
**Files:** lib/driver-state.ts, app/api/drivers/route.ts, app/drivers/page.tsx, types/index.ts
- [ ] lib: `computeInstallmentStates(db, codes: string[]): Promise<Map<string,"paying"|"paidoff">>` ตาม spec §1 ลำดับ 1-3
- [ ] API GET: status=paying|paidoff → filter status active แล้วกรองด้วย map; status=exit → {status:"inactive", exitType:{$exists:true}}; status=inactive → inactive ไม่มี exitType; ทุกกรณีแนบ installmentState ให้ active
- [ ] page: แท็บ ทั้งหมด/Active (ผ่อนชำระ)/Active (ปิดงวดแล้ว)/พ้นสภาพ/ไม่ใช้งาน; อ่าน ?status ตอน mount (ใน effect เดียวกับ ?new) และ sync URL เมื่อเปลี่ยนแท็บ (replaceState); นับแท็บจาก /api/drivers/counts (endpoint ใหม่เล็กๆ ใน route เดียวกัน ?counts=1) เพื่อไม่นับจากชุดที่กรอง
- [ ] คอลัมน์สถานะ: active → badge "ผ่อนชำระ"/"ปิดงวดแล้ว"; inactive+exitType → "พ้นสภาพ · ผ่อนหมด"/"พ้นสภาพ · ปลด/คืนรถ"
- [ ] verify Playwright แท็บ 5 อัน + counts; commit

### Task 3: ปิดงวดเอง (contract completed)
**Files:** app/api/contracts/[id]/close/route.ts, app/contracts/[id]/page.tsx
- [ ] POST close: hasPerm(role,"masterdata") ; set status "completed", completedAt; activity_log entity contract action "close"; 409 ถ้าไม่ active. POST reopen (body {reopen:true}) → active
- [ ] page: ปุ่ม "ปิดงวด (ผ่อนครบ)" ใกล้ progress ค่างวด + confirm; แสดง badge สิ้นสุด; ปุ่ม "เปิดใหม่" admin
- [ ] verify curl; commit

### Task 4: พ้นสภาพ flow
**Files:** app/api/drivers/[id]/exit/route.ts, app/drivers/page.tsx (dialog), types/index.ts
- [ ] types: Driver + exitType?: "paid_exit"|"early_exit", exitReason?, exitedAt?
- [ ] POST exit body {exitType, exitReason, endDate}: validate; tx-less sequential updates ตาม spec §1 (driver → contract → vehicle/price-list → activity_log); คืน summary {contractCode, contractStatus, vehicleAction}
- [ ] UI: ในพาเนล edit (isEdit && status active) ปุ่มแดง "พ้นสภาพ" → dialog (radio 2 ประเภท + textarea เหตุผล + ThaiDateInput วันที่ default วันนี้) → POST → toast สรุป → reload
- [ ] verify Playwright ด้วยคนขับทดสอบสร้างใหม่ (ไม่มีสัญญา) แล้วลบทิ้ง; commit

### Task 5: Sidebar/palette/module-status
**Files:** components/sidebar.tsx, components/command-palette.tsx, lib/module-status.ts
- [ ] sidebar: item "พ้นสภาพ" href "/drivers?status=exit" (icon UserMinus); activeHref รองรับ query: parse href → {path, params}; match = pathname match && ทุก param ตรง searchParams; เลือก item ที่ params มากสุด; ใช้ useSearchParams ใน inner component ห่อ Suspense
- [ ] ระบบขาย: "Catalog รถ" href "/catalog" (icon BookImage) — เพิ่มใน MODULE_STATUS + palette
- [ ] commit

### Task 6: Catalog config + PDF lib + routes
**Files:** lib/catalog-config.ts, lib/catalog-pdf.ts, app/api/catalog/config/route.ts, app/api/catalog/[plate]/pdf/route.ts, app/api/catalog/pdf/route.ts, next.config (trace fonts ให้ route ใหม่)
- [ ] config: `CatalogConfig {tagline, sellingPoints: string[], contactName, contactPhone, contactLine, terms: string[]}` + DEFAULT; getCatalogConfig(db) upsert default; GET/PUT (PUT admin)
- [ ] `loadCatalogVehicle(db, plate)` → {vehicle, price, promo} (normPlate join) ; `buildCatalogDoc(items: CatalogVehicle[], cfg, images: Map<url,dataUrl>)` 1 หน้า/คัน pageBreak; `fetchImageDataUrl(url, timeoutMs=5000)` → data:image/jpeg;base64 หรือ null
- [ ] layout ตาม spec §4 (โลโก้+tagline / รูปหลัก 499×280 fit / แถวรูปย่อย / ตารางข้อมูลรถ 2 คอลัมน์ / กล่องราคา + hero / โปร 3 บรรทัด / จุดขาย / ติดต่อ+เงื่อนไข)
- [ ] routes: [plate]/pdf?download=1 ; /pdf?status=ready (ทุกคันพร้อมขายไม่มีสัญญา เรียงทะเบียน) ; Content-Disposition inline filename catalog-<plate>.pdf
- [ ] verify: curl 2 ทะเบียน (มีรูป/ไม่มีรูป) → pdftoppm ดูภาพ; commit

### Task 7: Catalog UI
**Files:** app/catalog/page.tsx, app/price-list/page.tsx
- [ ] /catalog: ตารางรถพร้อมขาย (จาก /api/vehicles fleetState=ready + /api/price-list) — thumbnail, ทะเบียน, ยี่ห้อ/รุ่น, ราคา, ผ่อน/เดือน, เตือน "ยังไม่มีรูป", ปุ่มเปิด PDF; ปุ่มหัว "รวม Catalog ทั้งหมด (n)"; แผงตั้งค่า template (admin) แก้ config + บันทึก
- [ ] price-list: ปุ่ม "Catalog" (icon BookImage) แถวละปุ่ม ข้างปุ่มทำใบเสนอ; salesperson เห็นได้ (อ่านอย่างเดียว) → เพิ่ม /catalog และ /api/catalog ใน SALESPERSON_PAGES + sidebar whitelist + rbac domain sales
- [ ] verify Playwright; next build; commit
