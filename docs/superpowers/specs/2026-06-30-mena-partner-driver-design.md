# Mena Partner Driver — Payroll System Design Spec
**Date:** 2026-06-30  
**Stack:** Next.js 15 (App Router) · TypeScript · TailwindCSS · shadcn/ui · MongoDB (DigitalOcean) · next-auth  
**Deployment:** Vercel (same pattern as mena-wms / master-sku-web)

---

## 1. Overview

A web application for managing monthly payroll of partner mixer truck drivers (รถร่วม Mixer). A hire-purchase contract (สัญญาเช่าซื้อ) is the entry point for each driver. Monthly payroll is entered per driver per month covering income and deductions. Trip records are logged per LDT delivery. A net pay report summarises each month.

**Phase 1 scope:** Contract registration · Driver master · Monthly payroll entry · Trip log · Net pay report · Role-based auth.

---

## 2. Stack & Architecture

```
mena-partner-driver/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── contracts/
│   │   │   ├── route.ts              GET list, POST create
│   │   │   └── [id]/route.ts         GET one, PUT update, DELETE
│   │   ├── drivers/
│   │   │   ├── route.ts              GET list, POST create
│   │   │   └── [id]/route.ts         GET one, PUT update, DELETE
│   │   ├── payroll/
│   │   │   ├── route.ts              GET list (by month), POST create
│   │   │   └── [month]/[contractCode]/route.ts  GET one, PUT update
│   │   ├── trips/
│   │   │   ├── route.ts              GET list (filtered), POST create
│   │   │   └── [id]/route.ts         PUT update, DELETE
│   │   └── reports/
│   │       └── netpay/route.ts       GET summary by month
│   ├── login/page.tsx
│   ├── page.tsx                      Dashboard
│   ├── contracts/
│   │   ├── page.tsx                  Contract list
│   │   ├── new/page.tsx              New contract form
│   │   └── [id]/page.tsx             Contract detail + edit
│   ├── drivers/
│   │   ├── page.tsx                  Driver list
│   │   └── [id]/page.tsx             Driver detail + payroll history
│   ├── payroll/
│   │   ├── page.tsx                  Month picker → all drivers status
│   │   └── [month]/[contractCode]/page.tsx  Entry form
│   ├── trips/
│   │   ├── page.tsx                  Trip log table
│   │   └── new/page.tsx              Add trip form
│   └── reports/
│       └── page.tsx                  Net pay report + export
├── components/
│   ├── ui/                           shadcn/ui primitives
│   ├── layout/                       Sidebar, Navbar, AuthGuard
│   ├── contracts/                    ContractForm, ContractTable
│   ├── drivers/                      DriverTable, DriverCard
│   ├── payroll/                      PayrollForm, PayrollStatusBadge
│   ├── trips/                        TripTable, TripForm
│   └── reports/                      NetPayTable, ExportButton
├── lib/
│   ├── mongo.ts                      MongoDB client (reuse DigitalOcean URI)
│   ├── auth.ts                       NextAuth config (credentials + roles)
│   └── utils.ts
└── types/
    └── index.ts                      Shared TypeScript types
```

---

## 3. Data Models

### 3.1 `contracts` collection

```ts
{
  _id: ObjectId,
  contractCode: string,          // e.g. "MTL003" — unique, primary key
  contractDate: Date,            // วันที่ทำสัญญา
  buyerName: string,             // ชื่อผู้เช่าซื้อ
  driverName: string,            // ชื่อผู้ขับขี่ (may differ from buyer)
  accountNumber: string,         // เลขที่บัญชีผู้เช่า-ซื้อ
  phone: string,
  plant: string,                 // แพล้นท์ (หนามแดง, ลาดกระบัง, ...)
  truckNumber: string,           // เบอร์รถ e.g. "ME009"
  licensePlate: string,          // ทะเบียน e.g. "สบ.71-1956"
  vehicleBrand: string,          // ยี่ห้อ HINO / ISUZU
  totalPrice: number,            // ราคารถรวม
  downPayment: number,           // เงินดาวน์
  monthlyInstallment: number,    // ค่างวด/เดือน
  totalInstallments: number,     // จำนวนงวดทั้งหมด
  startDate: Date,               // วันที่เริ่มผ่อนงวดแรก
  status: 'active' | 'completed' | 'terminated',
  notes: string,
  createdAt: Date,
  updatedAt: Date
}
```

> **Note:** Contract fields will be reconciled against the actual สัญญาเช่าซื้อ document when available. The schema above covers all fields observed in the payroll Excel.

### 3.2 `drivers` collection

Derived from `contracts`. Created automatically when a contract is registered. Serves as the live profile for the driver.

```ts
{
  _id: ObjectId,
  contractCode: string,          // FK → contracts.contractCode
  buyerName: string,
  driverName: string,
  truckNumber: string,
  licensePlate: string,
  phone: string,
  plant: string,
  status: 'active' | 'inactive',
  createdAt: Date
}
```

### 3.3 `payroll_entries` collection

One document per driver per month.

```ts
{
  _id: ObjectId,
  contractCode: string,          // FK → contracts.contractCode
  month: string,                 // "2026-06" (YYYY-MM)
  // Work summary
  workingDays: number,           // สรุปวันทำงาน
  tripCount: number,             // จำนวนเที่ยว
  // Income (รายการรับ)
  transportFee: number,          // ค่าขนส่ง
  ot: number,                    // OT
  otherIncomeWHT: number,        // รับอื่นๆ (หักWHT)
  otherIncomeNoWHT: number,      // รับอื่นๆ ไม่หักWHT
  // Deductions — vehicle (รายการจ่ายเกี่ยวกับรถ)
  fuel: number,                  // ค่าเชื้อเพลิง
  gps: number,                   // GPS
  repairInHouse: number,         // ค่าซ่อมแซม (in-house)
  repairOutside: number,         // ซ่อมนอก
  mgmtFee8pct: number,           // ค่าดำเนินการ 8%
  labor: number,                 // ค่าแรง
  tire: number,                  // ค่ายาง
  tirePatch: number,             // ค่าปะยาง
  carWash: number,               // ค่าทำความสะอาดรถ
  taxInsurance: number,          // ต่อภาษีและประกัน
  // Deductions — financial (รายการหักอื่นๆ)
  installment: number,           // ค่างวดรถ
  repairInstallment: number,     // ผ่อนชำระค่าซ่อม
  downPaymentInstallment: number,// ผ่อนเงินดาวน์
  // Computed (calculated server-side on save)
  totalIncome: number,
  totalDeductions: number,
  netPay: number,
  createdAt: Date,
  updatedAt: Date
}
```

### 3.4 `trips` collection

One document per LDT delivery trip.

```ts
{
  _id: ObjectId,
  contractCode: string,          // FK → contracts.contractCode
  date: Date,                    // ออก LDT
  ldtNumber: string,             // เลขที่ LDT
  plant: string,                 // แพล้นท์
  serviceType: string,           // บริการ
  routeCode: string,             // Route/Ship To code
  destinationName: string,       // ชื่อ Ship To
  district: string,              // อำเภอ
  province: string,              // จังหวัด
  zone: string,                  // โซน
  tripFee: number,               // ค่าเที่ยว
  createdAt: Date
}
```

---

## 4. Pages & UI

| Route | Description | Role |
|-------|-------------|------|
| `/login` | next-auth credentials login | Public |
| `/` | Dashboard: driver count, current month net pay total, recent trips | All |
| `/contracts` | Contract list (search by code/name, filter by status/plant) | All |
| `/contracts/new` | New hire-purchase contract form → auto-creates driver | Admin |
| `/contracts/[id]` | Contract detail + edit | Admin |
| `/drivers` | Driver list table (search, filter by plant/status) | All |
| `/drivers/[id]` | Driver detail: profile + payroll history by month | All |
| `/payroll` | Month picker → all drivers with entry status badge (entered / missing) | All |
| `/payroll/[month]/[contractCode]` | Full payroll entry form for one driver in one month | Admin |
| `/trips` | Trip log: filter by driver, month, plant, zone | All |
| `/trips/new` | Add single trip form | Admin |
| `/reports` | Select month → net pay table (income, deductions, net). Export Excel | All |

**UI conventions:**
- shadcn/ui components (Table, Dialog, Form, Select, Badge, Card)
- Thai language labels throughout
- `admin` role: full CRUD. `viewer` role: read-only (no add/edit/delete buttons rendered)
- Sidebar navigation, same visual pattern as mena-wms

---

## 5. API Routes

```
# Auth
POST   /api/auth/[...nextauth]

# Contracts
GET    /api/contracts                        list (search, filter)
POST   /api/contracts                        create → also creates driver  [admin]
GET    /api/contracts/[id]                   get one
PUT    /api/contracts/[id]                   update  [admin]
DELETE /api/contracts/[id]                   delete  [admin]

# Drivers
GET    /api/drivers                          list (search, filter)
GET    /api/drivers/[id]                     get one + payroll history
PUT    /api/drivers/[id]                     update status  [admin]

# Payroll
GET    /api/payroll?month=2026-06            all entries for month
GET    /api/payroll/[month]/[contractCode]   one driver's entry
POST   /api/payroll                          create entry  [admin]
PUT    /api/payroll/[month]/[contractCode]   update entry  [admin]

# Trips
GET    /api/trips?contractCode=MTL003&month=2026-06  filtered list
POST   /api/trips                            create trip  [admin]
PUT    /api/trips/[id]                       update trip  [admin]
DELETE /api/trips/[id]                       delete trip  [admin]

# Reports
GET    /api/reports/netpay?month=2026-06     net pay summary for all drivers
```

All routes: session check required. Write routes: `admin` role required.

---

## 6. Business Logic

- **netPay** is computed on every `POST`/`PUT` to `payroll_entries`:
  ```
  totalIncome = transportFee + ot + otherIncomeWHT + otherIncomeNoWHT
  totalDeductions = fuel + gps + repairInHouse + repairOutside + mgmtFee8pct
                  + labor + tire + tirePatch + carWash + taxInsurance
                  + installment + repairInstallment + downPaymentInstallment
  netPay = totalIncome - totalDeductions
  ```
- **Creating a contract** automatically upserts a matching `drivers` document.
- `tripCount` on `payroll_entries` should match the count of `trips` documents for that `contractCode` + `month`. The payroll form shows the live count as a hint.
- `month` field format is always `"YYYY-MM"` (e.g. `"2026-06"`).

---

## 7. Auth & Roles

- next-auth credentials provider (username + password, hashed with bcrypt)
- Two roles: `admin` (full CRUD), `viewer` (read-only)
- Session stored in JWT, role embedded in token
- Middleware protects all routes except `/login`
- API routes check `getServerSession` and return 401/403 accordingly

---

## 8. Out of Scope (Phase 2)

- Repair details module (รวมค่าซ่อม)
- GPS fee detail (GPS sheet)
- Tire advance (ค่ายางรับล่วงหน้า)
- Debt/installment tracking detail (มูลหนี้ค่างวด)
- Tax & insurance detail (ภาษี ประกัน พรบ)
- OT detail (สรุป OT)
- Journal Voucher (JV) generation
- Excel import from existing payroll files
- Full loan agreement contract fields (pending review of actual contract document)
