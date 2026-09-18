# หน้าเว็บขายรถสาธารณะ /trucks

เปิดให้คนนอกดูได้โดยไม่ต้อง login: `/trucks` (รวม) และ `/trucks/<slug>` (รายคัน)
สเปก: `docs/superpowers/specs/2026-09-18-public-truck-listing-design.md`

## รถขึ้นเว็บได้อย่างไร
รถโผล่บน /trucks อัตโนมัติเมื่อครบ 3 ข้อ (กติกาเดียวกับ Catalog PDF):
1. `vehicle_master.status` ไม่ใช่ `inactive`
2. ไม่มีสัญญา (`contracts`) status `active` ที่ทะเบียนนั้น
3. `master_price_list.saleStatus === "ready"` (ตั้งที่หน้า ราคาขาย)

รถคันใหม่ที่เพิ่งพร้อมขาย: รัน `node scripts/backfill-public-slug.mjs` (dry-run) แล้ว `--apply`
เพื่อออก URL ถาวรให้ — ไม่รันก็ขึ้นเว็บได้ แต่ URL จะคำนวณสดและเปลี่ยนถ้าแก้ยี่ห้อ/รุ่น/เบอร์รถ

## แก้ข้อความบนหน้าเว็บ
จุดขาย/เงื่อนไข/ชื่อ-เบอร์-LINE ฝ่ายขาย = หน้า /catalog → ปุ่มตั้งค่า template (เก็บใน `catalog_config`)
แก้แล้วหน้าเว็บอัปเดตภายใน 10 นาที (ISR revalidate 600) — **ต้องกรอก contactPhone ก่อน ปุ่ม "โทร" ถึงจะโผล่**

## รูป
อัปที่หน้า /vehicles → ช่องรูป 5 มุม (หน้า/หลัง/ซ้าย/ขวา/ห้องโดยสาร)
รูป "หน้า" ใช้เป็นรูปการ์ดและรูปตอนแชร์ LINE (`/og/truck/<slug>`)
ระวัง: ป้ายทะเบียนบนตัวรถในรูปจะเห็นได้ — ระบบไม่เผยเลขทะเบียนในข้อความ แต่ไม่เบลอรูปให้

## lead จากหน้าเว็บ
ฟอร์มใต้ราคา → `POST /api/public/leads` → เข้า `quotations` (status `lead`, source `public-listing`)
→ เห็นใน /quotations คอลัมน์ lead · กันสแปม: honeypot + 5 ครั้ง/ชม./IP + ตรวจเบอร์ไทย

## ย้ายโดเมน
ตั้ง env `NEXT_PUBLIC_SITE_URL=https://menatransport.co.th` แล้ว redeploy —
canonical/OG/sitemap/JSON-LD เปลี่ยนตามทั้งหมด จากนั้นทำ 301 จากโดเมนเดิม

## ข้อมูลที่ห้ามออกสู่หน้าเว็บ
ทะเบียนจริง, เลขตัวถัง, เลขเครื่อง, สำเนาทะเบียน, ชื่อ พขร./รหัสสัญญา, ต้นทุน, `_id`
บังคับด้วย `toPublicTruck()` ใน `lib/public-trucks.ts` + เทสต์ allowlist ใน `lib/public-trucks.test.ts`
**เพิ่ม field ใหม่ต้องแก้เทสต์ด้วยเสมอ** · API สาธารณะอยู่ใต้ `/api/public/*` เท่านั้น (allowlist ใน `lib/public-routes.ts`)

## โครงไฟล์
- `app/(app)/*` หน้าระบบภายใน (ต้อง login, มี sidebar) · `app/(public)/*` หน้าสาธารณะ
- `lib/public-trucks.ts` loader + mapper · `lib/public-seo.ts` metadata/JSON-LD · `lib/public-lead.ts` validate ฟอร์ม
- `app/sitemap.ts`, `app/robots.ts`, `app/og/truck/[slug]/route.tsx`
