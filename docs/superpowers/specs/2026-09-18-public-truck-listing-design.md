# Public Truck Listing (SEO) — Design

วันที่: 2026-09-18
สถานะ: approved design, ยังไม่ implement
ขอบเขตเอกสารนี้: **P0 เท่านั้น** (P1/P2 อยู่ท้ายเอกสารเป็น out of scope)

## 1. เป้าหมาย

เปิดหน้าขายรถสาธารณะบน `mena-partner.vercel.app/trucks` ให้ Google เก็บ index ได้
โครงหน้าเลียนแบบ truck2hand (listing detail + browse/filter) แต่ใช้จุดแข็งที่ marketplace
ทั่วไปไม่มี: ราคา/แผนผ่อนจริงของบริษัท, ประวัติซ่อมบำรุง, โปรฯ ติดรถ

**Definition of done (P0):** คนนอกที่ไม่ได้ login เปิด `/trucks` เห็นรถพร้อมขายทุกคัน,
กดเข้าไปดูรายคันได้, กรอกฟอร์มขอใบเสนอราคาแล้วงานไปโผล่ใน Kanban `/quotations` เป็น lead,
`/sitemap.xml` มีทุกหน้า, และแชร์ลิงก์ลง LINE แล้วขึ้นการ์ดรูป+ราคา

**ไม่ใช่เป้าหมาย (P0):** ติดอันดับคำแข่งสูงอย่าง "รถบรรทุก 10 ล้อ มือสอง" (truck2hand
มี 10,004 หน้าในหมวดนั้น — สู้ด้วยจำนวนหน้าไม่ได้), ระบบรับฝากขายจากภายนอก,
ระบบ chat, ระบบสมาชิก

## 2. ข้อจำกัดที่ยอมรับแล้ว

- **สต็อก 18 คัน** → หน้า listing = layer ปิดการขาย ไม่ใช่ layer ที่ทำอันดับ
  layer ที่ทำอันดับคือ content hub (P2) + หน้าหมวดที่เขียนเนื้อหาเอง (P1)
  คำที่เล็งคือ niche ที่ของขาดทั้งตลาด: "รถผสมปูนมือสอง", "รถมิกเซอร์มือสอง ราคา", "รถผสมปูน SANY มือสอง"
- **โดเมน vercel.app** — index ได้ (เฉพาะ production domain; preview deploy เป็น noindex อยู่แล้ว)
  แต่ไม่มี brand equity ทุก URL ที่เขียนลง metadata/JSON-LD/sitemap ต้องมาจาก `NEXT_PUBLIC_SITE_URL`
  ตัวเดียว เพื่อให้ย้ายไป `menatransport.co.th/trucks` ภายหลัง = แก้ env + ทำ 301 ไม่ต้องรื้อโค้ด
- **รูป 17 จาก 18 คันยังไม่มี** — เป็นงานถ่ายรูป ไม่ใช่งานโค้ด แต่บล็อกคุณค่าของทั้งโปรเจกต์
  (ดูข้อ 11)

## 3. สถาปัตยกรรม

### 3.1 Route groups

ปัจจุบัน `app/layout.tsx` ครอบทุกหน้าด้วย `AppShell` (sidebar + navbar) และ
`body … h-screen overflow-hidden` — หน้าสาธารณะที่ต้อง scroll ยาวอยู่ในนั้นไม่ได้

```
app/
  layout.tsx          ← เหลือแค่ <html>/<body> + fonts + Providers + Toaster (ไม่มี AppShell, ไม่ฟิกซ์ความสูง)
  (app)/              ← ย้ายหน้าเดิมทั้งหมดมาไว้ใต้นี้ (ย้ายโฟลเดอร์เฉย ๆ URL ไม่เปลี่ยน)
    layout.tsx        ← <AppShell> + คลาส h-screen overflow-hidden
    catalog/ contracts/ drivers/ … (เดิมทุกหน้า)
  (public)/
    layout.tsx        ← header/footer การตลาด, light mode, scroll ปกติ
    trucks/
      page.tsx        ← browse
      [slug]/page.tsx ← listing detail
```

`app/api/**` ไม่ต้องย้าย (route group ไม่กระทบ URL)
Import alias `@/…` ไม่เปลี่ยน → การย้ายไม่กระทบ import ใด ๆ

### 3.2 Middleware

`middleware.ts` ตอนนี้ redirect ทุก path ที่ไม่มี token ไป `/login`
เพิ่ม allowlist **ก่อน** `getToken`:

```ts
const PUBLIC_PREFIXES = ["/trucks", "/api/public/", "/og/"]
const PUBLIC_EXACT    = ["/sitemap.xml", "/robots.txt"]
if (PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)))
  return NextResponse.next()
```

กติกาที่ต้องคงไว้: ทุกอย่างนอก allowlist นี้พฤติกรรมเดิมเป๊ะ (RBAC/salesperson redirect/DELETE=admin)

### 3.3 Public data layer — `lib/public-trucks.ts`

**หลักการ: แยก namespace ไม่ใช่ใส่ flag.** public API เป็นคนละไฟล์คนละ path กับของภายใน
เพื่อไม่ให้การแก้ endpoint ภายในวันหลังทำข้อมูลรั่วออกหน้าเว็บโดยไม่ตั้งใจ

เกณฑ์ "รถพร้อมขาย" ใช้กติกาเดียวกับ catalog เดิม (`lib/catalog-pdf.ts` → `loadCatalogVehicles`):
`vehicle_master.status !== "inactive"` **และ** ไม่มีสัญญา active **และ** `master_price_list.saleStatus === "ready"`
แต่เขียน loader ใหม่ที่ projection เฉพาะ field ที่เปิดเผยได้ (ของเดิม `find({})` ทั้ง collection —
ยอมรับได้ตอนทำ PDF ให้พนักงาน แต่หน้าเว็บสาธารณะไม่ควรลากทั้ง collection มาทุก request)

**Field allowlist (สิ่งที่ออกสู่ public API ได้):**

| กลุ่ม | fields |
|---|---|
| ระบุตัวรถ | slug, truckNumber, brand, model, vehicleType, characteristic, color |
| ปี | registrationDate → แปลงเป็น **ปีอย่างเดียว** (ค.ศ./พ.ศ.) |
| เครื่อง | engineSize |
| รูป | photoUrl, photos{front,back,left,right,cabin} |
| ราคา | totalSalePrice, downPayment, cashDown, monthlyPayment, financeInstallments |
| โปรฯ | promoLines (ข้อความสำเร็จรูปจาก promotion_master) |

**ห้ามออกเด็ดขาด:** `licensePlate` เต็ม (เลขทะเบียนจริง), `chassisNumber`, `engineNumber`,
`registrationDocUrl`, ชื่อ พขร./สัญญา/contractCode, ต้นทุน/ค่าซ่อม, `saleStatus` ดิบ, `_id`

ทะเบียนจริงไม่ออกหน้าเว็บ (ทั้งความเป็นส่วนตัวและกันคนเอาไปเช็คประวัติ/สวมรอย) —
หน้าเว็บอ้างอิงรถด้วย `truckNumber` (ME009) + slug เท่านั้น

### 3.4 Slug

รูปแบบ: `me009-hino-fm2p-2561` = `truckNumber-brand-model-ปีพ.ศ.` (a-z0-9 + ขีด)

- เก็บถาวรใน `vehicle_master.publicSlug` (unique index) — สร้างครั้งแรกตอน publish
  ไม่ derive สด เพราะถ้าแก้ยี่ห้อ/รุ่นวันหลัง URL จะเปลี่ยนแล้ว link ที่ Google เก็บไว้พัง
- ชนกัน → ต่อท้าย `-2`
- ไม่มี `truckNumber` → ใช้ `t-<hash6 ของ licensePlate>` (hash ไม่ย้อนกลับเป็นทะเบียน)
- lookup: `findOne({ publicSlug })` → ไม่เจอ/ไม่ ready = 404

## 4. หน้าเว็บ

### 4.1 `/trucks` — browse

- การ์ด: รูป (front หรือ placeholder), หัวเรื่อง `HINO FM2P ปี 2561 #10 ล้อ`, ราคา,
  "ผ่อน ฿X/เดือน", badge (มิกเซอร์ / โปรฯ ติดรถ / มาใหม่), ทำเล
- ตัวกรอง (client-side ทั้งหมด — 18 คัน ไม่ต้องทำ server pagination):
  ยี่ห้อ · ลักษณะ · ช่วงราคา · ปีจดทะเบียน · ช่วงค่างวด
- เรียง: แนะนำ (มีรูปก่อน) · ราคาต่ำ→สูง · ปีใหม่→เก่า
- **ตัวกรองอยู่ใน querystring และหน้าใด ๆ ที่มี query = `noindex`**
  (18 คัน × หลาย facet = หน้าบางซ้ำกันเป็นร้อย ซึ่งเป็นวิธีมาตรฐานที่แคตตาล็อกเล็ก ๆ จมหายจาก Google)
  หน้าที่ให้ index มีแค่ `/trucks` เปล่า ๆ

### 4.2 `/trucks/[slug]` — listing detail

ลำดับตาม truck2hand (โครงที่พิสูจน์แล้วว่าขายได้) สลับของจริงเข้าช่อง trust:

1. Breadcrumb — รถมือสอง > รถผสมปูน > HINO > สระบุรี
2. Gallery 5 รูป (front/back/left/right/cabin) — `next/image`, lightbox, alt text มีคีย์เวิร์ด
3. ราคา + **"ผ่อน ฿X/เดือน × Y งวด · ดาวน์ ฿Z"** (จาก master_price_list ไม่ใช่เครื่องคิดเลขธนาคาร)
4. CTA: โทร · LINE · **ขอใบเสนอราคา**
5. ตารางสเปก: ยี่ห้อ, รุ่น, ปีจดทะเบียน (ค.ศ./พ.ศ. ตาม convention ระบบ), ลักษณะ, สี, ขนาดเครื่อง, ทำเล

**เรื่องทำเล/จังหวัดใน P0:** `vehicle_master` ยังไม่มี field จังหวัด (P1) — P0 จึงใช้
**ค่าคงที่ระดับบริษัทค่าเดียว** (ที่ตั้งบริษัท) ทั้ง breadcrumb/การ์ด/ตารางสเปก
เก็บไว้ที่ `catalog_config` เพื่อให้ admin แก้ได้โดยไม่ต้อง deploy
6. **จุดเด่น** — เจ้าของเดียว ใช้ในระบบบริษัท · ประวัติซ่อมบำรุงครบ · โปรฯ ติดรถ (promoLines)
   (ช่อง "เลขไมล์จริงจาก GPS" เตรียมที่ไว้ แต่ยังไม่มีข้อมูลใน P0 — ดูข้อ 11)
7. รายละเอียด — ใช้ template `catalog_config` (จุดขาย/เงื่อนไข) ที่ admin แก้ได้อยู่แล้ว
8. กล่องผู้ขาย — บริษัท มีนา ทรานสปอร์ต จำกัด, เบอร์โทร, ที่อยู่, badge ยืนยันตัวตน
9. รถใกล้เคียง (ยี่ห้อเดียวกัน/ราคาใกล้กัน 3 คัน) + ปุ่มโหลด PDF สเปก (route เดิมที่มีอยู่)

## 5. SEO

- `generateMetadata` ต่อคัน — title: `รถผสมปูน HINO FM2P ปี 2561 ราคา 1,450,000 | มีนา ทรานสปอร์ต`
- canonical + `openGraph` + `twitter` ทุกหน้า สร้างจาก `NEXT_PUBLIC_SITE_URL`
- **JSON-LD** `Vehicle` + `Offer` (price, priceCurrency THB, availability) + `BreadcrumbList`
  → ทำให้ผลค้นหาแสดงราคา/ปีในตัว SERP
- `app/sitemap.ts` (จากรถ ready ทุกคัน + `/trucks`) และ `app/robots.ts`
- **OG image dynamic** ผ่าน `next/og` ที่ `/og/truck/[slug]` — รูปรถ + ราคา + โลโก้
  (แชร์ LINE/Facebook ขึ้นการ์ด ไม่ใช่ลิงก์เปล่า)
- `next.config.ts` เพิ่ม `images.remotePatterns` ให้ `*.digitaloceanspaces.com` (รูปอยู่บน DO Spaces)
- Rendering: ISR `revalidate = 600` ทั้ง browse และ detail (ข้อมูลรถเปลี่ยนไม่บ่อย,
  กัน public traffic ยิง Mongo ตรงทุก request ตามกติกา DB safety ของโปรเจกต์)

## 6. รับ lead

`POST /api/public/leads` — ฟอร์ม: ชื่อ · เบอร์ · (อีเมล) · สนใจคันไหน (slug) · เงินดาวน์ที่มี · ข้อความ

- สร้าง `quotations` doc: `status: "lead"`, `source: "public-listing"`, `slug`, `createdAt`
  (+ `customers` ถ้ายังไม่มีเบอร์นี้) → โผล่ใน Kanban ที่ทีมขายใช้อยู่แล้ว ไม่ต้องทำ inbox ใหม่
- **ไม่มี auth = ต้องกัน abuse:** honeypot field, rate limit ต่อ IP (เช่น 5 ครั้ง/ชม.
  เก็บ in-memory ต่อ instance พอสำหรับ P0), cap ความยาวทุก field, ตรวจรูปแบบเบอร์ไทย,
  ปฏิเสธ payload ที่ไม่ใช่ field ที่รู้จัก
- ตอบกลับหน้าเว็บ: ขอบคุณ + เบอร์ติดต่อกลับ (ไม่เผย id/ข้อมูลระบบ)
- LINE notify = P2 (ยังไม่มี token)

## 7. เคสขอบ

| เคส | พฤติกรรม |
|---|---|
| รถไม่มีรูป | placeholder โทนแบรนด์ + ป้าย "รูปกำลังอัปเดต" (ยังขึ้นเว็บ ไม่ซ่อน) |
| รถไม่มีแถวราคา | ไม่ขึ้นเว็บเลย (ready ต้องมี price row ตามนิยามเดิม) |
| รถถูกขาย/เข้าสัญญา | หลุดจาก `/trucks` อัตโนมัติ; หน้า detail ยังอยู่ + ริบบิ้น "ขายแล้ว" + `noindex` + ลิงก์ไปรถใกล้เคียง (ไม่ลบ — หน้าเก่าคือหน้าที่สะสมลิงก์ไว้) |
| slug ไม่รู้จัก | 404 พร้อมลิงก์กลับ `/trucks` |
| ยังไม่ตั้ง `NEXT_PUBLIC_SITE_URL` | fallback เป็น `https://mena-partner.vercel.app` |

## 8. การทดสอบ

vitest มีอยู่แล้วในโปรเจกต์ (`npm test`) — เขียนเทสต์ก่อนโค้ดตาม TDD:

1. **`toPublicTruck()` field allowlist** — ยัด doc ที่มี chassisNumber/engineNumber/licensePlate/
   contractCode/ต้นทุน เข้าไป แล้ว assert ว่า output **ไม่มี** key เหล่านั้น (เทสต์กันรั่วที่สำคัญที่สุด)
2. **slug** — สร้าง, normalize ภาษาไทย/อักขระพิเศษ, ชนกันแล้วต่อ `-2`, ไม่มี truckNumber → hash
3. **เกณฑ์รถพร้อมขาย** — inactive / มีสัญญา active / saleStatus ไม่ใช่ ready ต้องไม่ติดมา
4. **lead validation** — honeypot มีค่า = ปฏิเสธ, เบอร์ผิดรูปแบบ = ปฏิเสธ, field แปลกปลอมถูกตัดทิ้ง
5. **sitemap** — มีทุก slug ที่ ready และไม่มีคันที่ขายแล้ว
6. Manual: Playwright + dev server ตรวจว่าเปิด `/trucks` โดย**ไม่มี cookie** แล้วไม่เด้ง `/login`
   (ใช้ pattern เดิมของโปรเจกต์ แต่ล้าง cookie ก่อน)

## 9. ความปลอดภัย

- middleware allowlist แคบที่สุดเท่าที่พอใช้ — prefix `/api/public/` เท่านั้น ไม่เปิด `/api/` อื่น
- public route ทั้งหมด read-only ยกเว้น `POST /api/public/leads`
- ไม่แตะ RBAC เดิม; หน้าเดิมทุกหน้ายังต้อง login เหมือนเดิม
- ตรวจด้วยตาอีกครั้งก่อน deploy: `curl` public API แล้วอ่าน JSON ทีละ field

## 10. ลำดับงาน (P0)

1. Route groups + layout แยก (ยังไม่มีหน้าใหม่) — ยืนยันหน้าเดิมทั้งหมดยังทำงานปกติ
2. `lib/public-trucks.ts` + เทสต์ allowlist/slug + migration ใส่ `publicSlug` ให้รถที่ ready
   ⚠️ **ขั้นนี้เขียน prod DB** (เพิ่ม field + unique index บน `vehicle_master`) — ต้อง dry-run
   นับก่อน แล้วขออนุมัติก่อนรันจริง ตามกติกา DB safety ของโปรเจกต์
3. `GET /api/public/trucks`, `GET /api/public/trucks/[slug]`
4. middleware allowlist + เทสต์ว่าไม่มี cookie แล้วเข้าได้
5. `(public)/layout.tsx` + `/trucks` (browse)
6. `/trucks/[slug]` (detail)
7. metadata + JSON-LD + sitemap + robots + OG image + remotePatterns
8. ฟอร์ม lead + `POST /api/public/leads` + anti-spam
9. ตรวจจริง: curl ไม่มี cookie, Rich Results Test, LINE share preview

## 11. งานที่ไม่ใช่โค้ด (บล็อกคุณค่า ไม่บล็อกการ implement)

1. **ถ่ายรูป 5 มุม × 18 คัน (~90 รูป)** — งานที่ได้ผลตอบแทนสูงสุดในโปรเจกต์นี้
   หน้าไม่มีรูป = ไม่มีคนติดต่อ และ Google ก็ไม่ให้น้ำหนัก
2. **เลขไมล์** — ยังไม่มีใน vehicle_master (P1: ช่องกรอกมือ, P2: ดึงจาก GPS drivingdistance)
3. **จังหวัด** — ยังไม่มี field (P1)
4. **เบอร์โทร/LINE ที่จะโชว์สาธารณะ** — ต้องได้เบอร์ที่ทีมขายรับสาย

## 12. Out of scope (ทำหลัง P0)

- **P1** — หน้าหมวดที่เขียนเนื้อหาเอง (`/trucks/mixer`, `/trucks/hino`) ที่ให้ index จริง,
  field เลขไมล์/จังหวัด, รถใกล้เคียงแบบฉลาด, Search Console + analytics ต่อ listing
- **P2** — content hub 5–8 บทความจากข้อมูลจริง (ค่าซ่อมต่อปี, อายุยาง, ต้นทุนต่อ กม.,
  เช็กลิสต์ซื้อรถผสมปูนมือสอง) = layer ที่ทำอันดับจริง,
  ดึงเลขไมล์จาก GPS, ส่วนประวัติซ่อมบำรุงบนหน้า listing, LINE notify ตอนมี lead,
  ย้ายไปโดเมน menatransport.co.th + 301
