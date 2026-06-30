# Promo Repair + PM Module — Design Spec
**Date:** 2026-06-30  
**Stack:** Next.js 15 (App Router) · TypeScript · TailwindCSS · shadcn/ui · MongoDB · next-auth  
**Auth:** All authenticated users can read and write (no admin-only restriction for this module)

---

## 1. Overview

Track two warranty/promotion entitlements bundled with each hire-purchase contract:

**โปรโมชั่น 2 — ฟรีค่าซ่อมบำรุง (Repair Budget Pool)**  
- Lifetime ceiling per truck: 50,000 / 80,000 / 100,000 / 120,000 บาท (varies by contract tier)
- Cumulative deduction — no annual reset; ends when budget exhausted or contract terminated
- Only covers repairs arranged by the seller

**โปรโมชั่น 3 — ฟรี PM เชิงป้องกัน (PM Coupons + Annual Cap)**  
- PM1 × 1 and PM2 × 1 per calendar year; resets every 1 Jan
- Annual ceiling per truck: 10,070 / 11,826 / 12,011 / 12,207 / 12,761 / 15,441 บาท (varies by truck)
- PM3 (กระดุมล้อ) is excluded

---

## 2. Data Models

### 2.1 `promo_config` collection

One document per truck/contract. Seeded from the Excel sheet "โปรโมชั่น ซ่อม+PM", keyed by license plate → contractCode lookup.

```ts
{
  _id: ObjectId,
  contractCode: string,    // FK → contracts.contractCode
  licensePlate: string,    // จาก Excel (ทะเบียน)
  repairBudget: number,    // โปร 2 ceiling: 50000/80000/100000/120000
  pmOilCost: number,       // ค่าน้ำมัน PM (500 fixed in current data)
  annualPmCap: number,     // โปร 3 annual ceiling: 10070/11826/12011/12207/12761/15441
  createdAt: Date
}
```

### 2.2 `repair_claims` collection

One document per repair event charged against Promo 2.

```ts
{
  _id: ObjectId,
  contractCode: string,    // FK → promo_config
  date: Date,              // วันที่ซ่อม
  description: string,     // รายละเอียดงานซ่อม
  amount: number,          // ยอดเบิก (บาท)
  createdAt: Date
}
```

### 2.3 `pm_records` collection

One document per PM event charged against Promo 3.

```ts
{
  _id: ObjectId,
  contractCode: string,    // FK → promo_config
  year: number,            // ปี Gregorian (e.g. 2026)
  type: 'PM1' | 'PM2',    // ประเภท (PM3 ไม่รวม)
  date: Date,              // วันที่ทำ PM
  amount: number,          // ค่าใช้จ่ายจริง (บาท)
  notes: string,           // หมายเหตุ (optional)
  createdAt: Date
}
```

---

## 3. Business Logic

### โปร 2 — Repair Budget Pool

```
repairUsed      = SUM(repair_claims.amount WHERE contractCode = X)
repairRemaining = promo_config.repairBudget - repairUsed
```

- `repairRemaining < 0` is possible if a claim is entered that exceeds remaining budget (warn but allow)
- No annual reset

### โปร 3 — PM Coupons + Annual Cap

```
currentYear     = current Gregorian year
pmUsedThisYear  = SUM(pm_records.amount WHERE contractCode = X AND year = currentYear)
pmRemaining     = promo_config.annualPmCap - pmUsedThisYear
pm1UsedThisYear = COUNT(pm_records WHERE type = 'PM1' AND year = currentYear) > 0
pm2UsedThisYear = COUNT(pm_records WHERE type = 'PM2' AND year = currentYear) > 0
```

- Warn (but allow) if a second PM1 or PM2 is entered in the same year
- Warn (but allow) if pmUsedThisYear would exceed annualPmCap

---

## 4. Seed Script

**File:** `scripts/seed-promo.ts`

Reads `Rev.o1 Payroll รถร่วม Mixer มิ.ย. 69.xlsx` sheet "โปรโมชั่น ซ่อม+PM". For each row:
1. Look up `contractCode` from `contracts` collection by `licensePlate`
2. Upsert into `promo_config` (keyed on `licensePlate`)
3. Log rows where no matching contract found (skip, don't error)

Run via: `npx tsx scripts/seed-promo.ts`

---

## 5. API Routes

```
GET  /api/promotions                        List all trucks with computed promo status
GET  /api/promotions/[contractCode]         One truck's config + claims + PM records
POST /api/promotions/repair                 Log a repair claim  { contractCode, date, description, amount }
DELETE /api/promotions/repair/[id]          Delete a repair claim
POST /api/promotions/pm                     Log a PM record  { contractCode, year, type, date, amount, notes }
DELETE /api/promotions/pm/[id]              Delete a PM record
```

**GET /api/promotions** response shape (one item):
```ts
{
  contractCode: string,
  licensePlate: string,
  driverName: string,       // joined from drivers
  truckNumber: string,      // joined from drivers
  repairBudget: number,
  repairUsed: number,
  repairRemaining: number,
  annualPmCap: number,
  pmUsedThisYear: number,
  pmRemainingThisYear: number,
  pm1UsedThisYear: boolean,
  pm2UsedThisYear: boolean,
}[]
```

**GET /api/promotions/[contractCode]** adds:
```ts
{
  ...above,
  repairClaims: RepairClaim[],    // sorted date desc
  pmRecords: PmRecord[],          // sorted year desc, date desc
}
```

All routes: session required (middleware handles). No admin-role restriction.

---

## 6. Pages & UI

### `/promotions` — Overview table

| คอลัมน์ | หมายเหตุ |
|---------|---------|
| ทะเบียน / เบอร์รถ | |
| ชื่อคนขับ | |
| โปร 2: วงเงิน / ใช้ไป / คงเหลือ | progress bar สี |
| โปร 3: PM1 ปีนี้ | Badge ✓ / ✗ |
| โปร 3: PM2 ปีนี้ | Badge ✓ / ✗ |
| โปร 3: งบคงเหลือปีนี้ | |

- Search by contractCode / license plate / driver name
- Click row → `/promotions/[contractCode]`

### `/promotions/[contractCode]` — Detail page

**Header:** driver name, truck number, license plate, plant

**Section 1 — โปร 2 ค่าซ่อม:**
- Progress bar: repairUsed / repairBudget
- Table of repair claims (date, description, amount, delete button)
- "บันทึกการซ่อม" form: date, description, amount → POST /api/promotions/repair

**Section 2 — โปร 3 PM:**
- Current year coupon badge: PM1 [ใช้แล้ว/ยังไม่ได้ใช้], PM2 [ใช้แล้ว/ยังไม่ได้ใช้]
- Annual budget bar: pmUsedThisYear / annualPmCap
- PM history table grouped by year (year, type, date, amount, notes, delete button)
- "บันทึก PM" form: year (default current), type (PM1/PM2), date, amount, notes → POST /api/promotions/pm

**Sidebar:** add "โปรโมชั่น" link

---

## 7. File Structure

```
app/
  api/
    promotions/
      route.ts                      GET list
      [contractCode]/route.ts       GET detail
      repair/route.ts               POST
      repair/[id]/route.ts          DELETE
      pm/route.ts                   POST
      pm/[id]/route.ts              DELETE
  promotions/
    page.tsx                        Overview table
    [contractCode]/page.tsx         Detail page
scripts/
  seed-promo.ts                     One-time Excel seed
types/
  index.ts                          Add PromoConfig, RepairClaim, PmRecord interfaces
```

---

## 8. Out of Scope

- PM3 (กระดุมล้อ) — excluded by business rule
- Part-level breakdown of PM items (ไส้กรอง, น้ำมัน etc.) — record as lump sum only
- Integration with repair_claims → payroll deduction (Phase 3)
- Approval workflow for claims
