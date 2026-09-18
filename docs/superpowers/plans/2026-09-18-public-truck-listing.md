# Public Truck Listing (P0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปิดหน้าขายรถสาธารณะ `/trucks` (browse + รายคัน) บน mena-partner ให้คนไม่ได้ login เข้าดูได้ Google เก็บ index ได้ และกรอกฟอร์มแล้วกลายเป็น lead ใน `/quotations`

**Architecture:** แยก route group `(app)` (ของเดิม ต้อง login) กับ `(public)` (หน้าใหม่ ไม่ต้อง login); middleware มี allowlist สำหรับ path สาธารณะ; ข้อมูลที่ออกสู่ public ผ่าน mapper ที่มี field allowlist ใน `lib/public-trucks.ts` เท่านั้น (แยก namespace จาก API ภายในทั้งหมด); หน้า public เป็น Server Component + ISR 600 วิ อ่าน Mongo ผ่าน lib ตรง ไม่ fetch API ตัวเอง

**Tech Stack:** Next.js 16.2.6 (App Router, React 19.2.4), MongoDB driver 7, zod 4, Tailwind 4, vitest 3 (`environment: node`, `globals: true`, มี `vite-tsconfig-paths` → ใช้ alias `@/…` ในเทสต์ได้), รูปอยู่บน DigitalOcean Spaces

**Spec:** `docs/superpowers/specs/2026-09-18-public-truck-listing-design.md`

## Global Constraints

- **ห้ามออกสู่ public เด็ดขาด:** `licensePlate` เต็ม, `chassisNumber`, `engineNumber`, `registrationDocUrl`, ชื่อ พขร., `contractCode`, ข้อมูลต้นทุน/ค่าซ่อม, `saleStatus` ดิบ, `_id`
- **รถพร้อมขาย** = `vehicle_master.status !== "inactive"` และไม่มี `contracts` status active ที่ทะเบียนนั้น และ `master_price_list.saleStatus === "ready"` (join ด้วย `normPlate` จาก `@/lib/catalog-pdf`)
- **ทุก URL ที่เขียนลง metadata/JSON-LD/sitemap/OG** สร้างจาก `process.env.NEXT_PUBLIC_SITE_URL` fallback `https://mena-partner.vercel.app` — ห้าม hardcode โดเมนที่อื่น
- **หน้าเดิมทุกหน้าต้องยังต้อง login เหมือนเดิม** — allowlist ใน middleware แคบที่สุด: prefix `/trucks`, `/api/public/`, `/og/` และ exact `/sitemap.xml`, `/robots.txt`
- **ไม่แตะ RBAC เดิม** (`lib/rbac.ts`) และไม่แก้ endpoint ภายในที่มีอยู่
- ปีแสดงผลแบบคู่ ค.ศ./พ.ศ. ตาม convention ระบบ (พ.ศ. = ค.ศ. + 543)
- เงิน format ด้วย `formatMoney` จาก `@/lib/utils`
- commit message ภาษาไทยได้ ตามสไตล์ repo; ห้าม `git add -A` (repo มีไฟล์ .rar/.xlsx/.pdf untracked ที่ห้ามคอมมิต) — ระบุ path ที่ add เสมอ

---

### Task 1: แยก route group `(app)` / `(public)`

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/(app)/layout.tsx`
- Create: `app/(public)/layout.tsx`
- Move: `app/{adjustments,admin,alerts,attendance,catalog,contracts,driver-ledger,drivers,import,insurance-tax,payroll,payroll-extras,price-list,promotions,quotations,reports,trip-fuel,trips,vehicle-cost,vehicles}` และ `app/page.tsx`, `app/login` → `app/(app)/…`
- ไม่ย้าย: `app/api`, `app/globals.css`, `app/layout.tsx`

**Interfaces:**
- Consumes: —
- Produces: route group `(public)` ที่ Task 6/7 เอาหน้าไปวาง; `app/(public)/layout.tsx` export ชื่อ default `PublicLayout`

**หมายเหตุสำคัญ:** route group ไม่เปลี่ยน URL (`app/(app)/drivers/page.tsx` ยังคือ `/drivers`) และ alias `@/…` ไม่เปลี่ยน → ไม่มี import ไหนต้องแก้

- [ ] **Step 1: ย้ายโฟลเดอร์หน้าเดิมเข้า `(app)` ด้วย `git mv`**

```bash
cd ~/Documents/project/mena-partner-driver
mkdir -p "app/(app)"
for d in adjustments admin alerts attendance catalog contracts driver-ledger drivers import insurance-tax login payroll payroll-extras price-list promotions quotations reports trip-fuel trips vehicle-cost vehicles; do
  git mv "app/$d" "app/(app)/$d"
done
git mv app/page.tsx "app/(app)/page.tsx"
ls app
```

Expected: เหลือ `(app)  api  globals.css  layout.tsx` ใน `app/`

- [ ] **Step 2: ตัด AppShell ออกจาก root layout**

`app/layout.tsx` — เอา `AppShell` ออก (เหลือ Providers/Toaster/ConfirmHost/Analytics) และย้ายคลาสฟิกซ์ความสูงออกจาก `<body>` เพราะหน้าสาธารณะต้อง scroll ยาว:

```tsx
// เดิม: <body className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
//       <Providers><AppShell>{children}</AppShell></Providers>
      <body className="bg-zinc-50 dark:bg-zinc-950">
        <Providers>{children}</Providers>
        <ConfirmHost />
        <Toaster richColors position="top-center" toastOptions={{ style: { fontFamily: "var(--font-noto-thai)" } }} />
        <Analytics />
      </body>
```

เก็บ `import { AppShell } from "@/components/app-shell"` ออกจากไฟล์นี้ (ย้ายไป `(app)/layout.tsx`)

- [ ] **Step 3: สร้าง `app/(app)/layout.tsx` รับคลาสเดิมมาไว้แทน**

```tsx
import { AppShell } from "@/components/app-shell"

/** Shell ของระบบภายใน — sidebar + navbar + จอไม่เลื่อน (หน้าใน main scroll เอง) */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppShell>{children}</AppShell>
    </div>
  )
}
```

- [ ] **Step 4: สร้าง `app/(public)/layout.tsx` (header/footer การตลาด, scroll ปกติ)**

```tsx
import Link from "next/link"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      <header className="border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/trucks" className="font-bold text-lg">มีนา ทรานสปอร์ต · รถมือสอง</Link>
          <a href="tel:" className="text-sm font-medium rounded-lg px-4 py-2 bg-zinc-900 text-white">ติดต่อฝ่ายขาย</a>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-zinc-500">
          <p className="font-semibold text-zinc-700">บริษัท มีนา ทรานสปอร์ต จำกัด</p>
          <p className="mt-1">รถผสมปูน (มิกเซอร์) มือสอง พร้อมงานวิ่ง · ผ่อนกับบริษัทโดยตรง</p>
        </div>
      </footer>
    </div>
  )
}
```

หมายเหตุ: เบอร์โทรจริงเติมใน Task 7 (อ่านจาก `catalog_config.contactPhone`) — ตอนนี้ปล่อย `href="tel:"` ไว้ก่อนเพราะ layout นี้เป็น Server Component ที่ยังไม่ได้ต่อ DB

- [ ] **Step 5: รัน typecheck + เทสต์เดิม**

Run: `npx tsc --noEmit && npm test`
Expected: ผ่านทั้งคู่ (เทสต์เดิม 6 ไฟล์ยังเขียว)

- [ ] **Step 6: build เพื่อยืนยันว่าเส้นทางเดิมไม่พัง**

Run: `npx next build`
Expected: build สำเร็จ และใน route list ยังเห็น `/drivers`, `/vehicle-cost`, `/catalog` ฯลฯ ตามเดิม (ไม่มี `/(app)/…` โผล่)

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx "app/(app)" "app/(public)"
git commit -m "refactor: แยก route group (app)/(public) — root layout ไม่ครอบ AppShell แล้ว เพื่อรองรับหน้าสาธารณะ

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 2: `lib/public-trucks.ts` — slug + field allowlist (pure functions)

**Files:**
- Create: `lib/public-trucks.ts`
- Test: `lib/public-trucks.test.ts`

**Interfaces:**
- Consumes: `normPlate` จาก `@/lib/catalog-pdf`
- Produces:
  - `export interface PublicTruck { slug: string; truckNumber: string; brand: string; model: string; vehicleType: string; characteristic: string; color: string; registrationYear: number | null; engineSize: string; photoUrl: string; photos: { front: string; back: string; left: string; right: string; cabin: string }; totalSalePrice: number; downPayment: number; cashDown: number; monthlyPayment: number; financeInstallments: number; promoLines: string[]; isSold: boolean }`
  - `export function makeSlug(v: { truckNumber?: string; brand?: string; model?: string; registrationDate?: string; licensePlate?: string }): string`
  - `export function uniqueSlug(base: string, taken: Set<string>): string`
  - `export function registrationYear(registrationDate?: string): number | null` (คืน ค.ศ.)
  - `export function toPublicTruck(vehicle: Record<string, unknown>, price: Record<string, unknown> | undefined, promoLines: string[], slug: string, isSold: boolean): PublicTruck`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`lib/public-trucks.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { makeSlug, uniqueSlug, registrationYear, toPublicTruck } from "@/lib/public-trucks"

describe("makeSlug", () => {
  it("สร้างจาก เบอร์รถ-ยี่ห้อ-รุ่น-ปีพ.ศ.", () => {
    expect(makeSlug({ truckNumber: "ME009", brand: "HINO", model: "FM2P", registrationDate: "2018-03-01" }))
      .toBe("me009-hino-fm2p-2561")
  })

  it("ตัดอักขระพิเศษและช่องว่างเป็นขีด", () => {
    expect(makeSlug({ truckNumber: "ME 010", brand: "ISUZU", model: "FVM 34W/T", registrationDate: "2017-01-01" }))
      .toBe("me-010-isuzu-fvm-34w-t-2560")
  })

  it("ไม่มีปี → ไม่ต่อท้ายปี", () => {
    expect(makeSlug({ truckNumber: "ME011", brand: "SANY", model: "SY306" })).toBe("me011-sany-sy306")
  })

  it("ไม่มีเบอร์รถ → ใช้ hash ของทะเบียน ไม่เผยทะเบียน", () => {
    const s = makeSlug({ brand: "HINO", model: "FM2P", licensePlate: "สบ.71-1956" })
    expect(s).toMatch(/^t-[a-f0-9]{6}-hino-fm2p$/)
    expect(s).not.toContain("71")
    expect(s).not.toContain("1956")
  })

  it("ภาษาไทยล้วน → ยังได้ slug ที่ใช้ได้", () => {
    const s = makeSlug({ truckNumber: "รถ01", brand: "ฮีโน่", model: "มิกเซอร์", licensePlate: "สบ.70-1111" })
    expect(s).toMatch(/^[a-z0-9-]+$/)
    expect(s.length).toBeGreaterThan(0)
  })
})

describe("uniqueSlug", () => {
  it("ว่างอยู่ → คืนค่าเดิม", () => {
    expect(uniqueSlug("me009-hino", new Set())).toBe("me009-hino")
  })
  it("ชนกัน → ต่อ -2 แล้ว -3", () => {
    expect(uniqueSlug("me009-hino", new Set(["me009-hino"]))).toBe("me009-hino-2")
    expect(uniqueSlug("me009-hino", new Set(["me009-hino", "me009-hino-2"]))).toBe("me009-hino-3")
  })
})

describe("registrationYear", () => {
  it("คืนปี ค.ศ. จากวันที่ ISO", () => expect(registrationYear("2018-03-01")).toBe(2018))
  it("ว่าง/พัง → null", () => {
    expect(registrationYear("")).toBeNull()
    expect(registrationYear(undefined)).toBeNull()
    expect(registrationYear("ไม่ใช่วันที่")).toBeNull()
  })
})

describe("toPublicTruck — field allowlist", () => {
  const vehicle = {
    _id: "68c0ffee",
    licensePlate: "สบ.71-1956",
    truckNumber: "ME009",
    brand: "HINO", model: "FM2P", vehicleType: "รถผสมปูน", characteristic: "10 ล้อ",
    color: "ขาว", registrationDate: "2018-03-01", engineSize: "7790 cc / 240 hp",
    chassisNumber: "NKRHF1234567", engineNumber: "6HK1-99999",
    registrationDocUrl: "https://spaces/doc.pdf",
    photoUrl: "https://spaces/front.jpg",
    photos: { front: "https://spaces/front.jpg", back: "", left: "", right: "", cabin: "" },
    status: "active",
  }
  const price = { totalSalePrice: 1450000, downPayment: 200000, cashDown: 50000, monthlyPayment: 35000, financeInstallments: 48, saleStatus: "ready", costBasis: 900000 }

  it("ไม่มี field ต้องห้ามหลุดออกมาแม้แต่ตัวเดียว", () => {
    const out = toPublicTruck(vehicle, price, [], "me009-hino-fm2p-2561", false)
    const forbidden = ["licensePlate", "chassisNumber", "engineNumber", "registrationDocUrl", "_id", "saleStatus", "costBasis", "status", "contractCode", "driverName"]
    for (const k of forbidden) expect(out).not.toHaveProperty(k)
    expect(JSON.stringify(out)).not.toContain("71-1956")
    expect(JSON.stringify(out)).not.toContain("NKRHF")
  })

  it("map ข้อมูลที่เปิดเผยได้ครบ", () => {
    const out = toPublicTruck(vehicle, price, ["ฟรี PM"], "me009-hino-fm2p-2561", false)
    expect(out).toMatchObject({
      slug: "me009-hino-fm2p-2561", truckNumber: "ME009", brand: "HINO", model: "FM2P",
      registrationYear: 2018, totalSalePrice: 1450000, monthlyPayment: 35000,
      financeInstallments: 48, promoLines: ["ฟรี PM"], isSold: false,
    })
  })

  it("ไม่มีแถวราคา → ตัวเลขเป็น 0 ไม่ใช่ undefined", () => {
    const out = toPublicTruck(vehicle, undefined, [], "x", true)
    expect(out.totalSalePrice).toBe(0)
    expect(out.monthlyPayment).toBe(0)
    expect(out.isSold).toBe(true)
  })
})
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/public-trucks.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/public-trucks"`

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

`lib/public-trucks.ts`:

```ts
import { createHash } from "node:crypto"

/**
 * ชั้นข้อมูลสาธารณะของหน้า /trucks — **แยก namespace จาก API ภายในโดยตั้งใจ**
 * ทุก field ที่ออกสู่เว็บสาธารณะต้องผ่าน toPublicTruck() เท่านั้น
 * ห้ามเพิ่ม field ลง PublicTruck โดยไม่อัปเดตเทสต์ allowlist ใน public-trucks.test.ts
 */

export interface PublicTruck {
  slug: string
  truckNumber: string
  brand: string
  model: string
  vehicleType: string
  characteristic: string
  color: string
  registrationYear: number | null   // ค.ศ. (หน้าเว็บแสดงคู่ พ.ศ. = +543)
  engineSize: string
  photoUrl: string
  photos: { front: string; back: string; left: string; right: string; cabin: string }
  totalSalePrice: number
  downPayment: number
  cashDown: number
  monthlyPayment: number
  financeInstallments: number
  promoLines: string[]
  isSold: boolean
}

const s = (v: unknown) => String(v ?? "").trim()
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0)

/** a-z0-9 + ขีด; ภาษาไทย/อักขระพิเศษกลายเป็นขีด แล้วยุบขีดซ้ำ */
const slugPart = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

export function registrationYear(registrationDate?: string): number | null {
  const y = Number(String(registrationDate ?? "").slice(0, 4))
  return Number.isInteger(y) && y > 1900 && y < 2200 ? y : null
}

export function makeSlug(v: {
  truckNumber?: string; brand?: string; model?: string
  registrationDate?: string; licensePlate?: string
}): string {
  const year = registrationYear(v.registrationDate)
  // ไม่มีเบอร์รถ → hash ทะเบียน (ไม่ย้อนกลับเป็นทะเบียนได้ ตามข้อห้ามไม่เผยทะเบียน)
  const head = slugPart(s(v.truckNumber)) ||
    `t-${createHash("sha256").update(s(v.licensePlate)).digest("hex").slice(0, 6)}`
  const parts = [head, slugPart(s(v.brand)), slugPart(s(v.model)), year ? String(year + 543) : ""]
  const slug = parts.filter(Boolean).join("-").replace(/-+/g, "-")
  return slug || `t-${createHash("sha256").update(s(v.licensePlate) + s(v.truckNumber)).digest("hex").slice(0, 8)}`
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now()}`
}

export function toPublicTruck(
  vehicle: Record<string, unknown>,
  price: Record<string, unknown> | undefined,
  promoLines: string[],
  slug: string,
  isSold: boolean,
): PublicTruck {
  const ph = (vehicle.photos ?? {}) as Record<string, unknown>
  return {
    slug,
    truckNumber: s(vehicle.truckNumber),
    brand: s(vehicle.brand),
    model: s(vehicle.model),
    vehicleType: s(vehicle.vehicleType),
    characteristic: s(vehicle.characteristic),
    color: s(vehicle.color),
    registrationYear: registrationYear(s(vehicle.registrationDate)),
    engineSize: s(vehicle.engineSize),
    photoUrl: s(vehicle.photoUrl),
    photos: {
      front: s(ph.front), back: s(ph.back), left: s(ph.left), right: s(ph.right), cabin: s(ph.cabin),
    },
    totalSalePrice: n(price?.totalSalePrice),
    downPayment: n(price?.downPayment),
    cashDown: n(price?.cashDown),
    monthlyPayment: n(price?.monthlyPayment),
    financeInstallments: n(price?.financeInstallments),
    promoLines: promoLines.filter(Boolean).slice(0, 6),
    isSold,
  }
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/public-trucks.test.ts`
Expected: PASS ทั้ง 11 เคส

- [ ] **Step 5: Commit**

```bash
git add lib/public-trucks.ts lib/public-trucks.test.ts
git commit -m "feat(public): mapper ข้อมูลรถสาธารณะ + slug ถาวร (field allowlist มีเทสต์กันรั่ว)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 3: เกณฑ์ "รถพร้อมขาย" + loader อ่าน Mongo

**Files:**
- Modify: `lib/public-trucks.ts`
- Modify: `lib/public-trucks.test.ts`

**Interfaces:**
- Consumes: `PublicTruck`, `toPublicTruck`, `makeSlug`, `uniqueSlug` (Task 2); `normPlate` จาก `@/lib/catalog-pdf`; `clientPromise` จาก `@/lib/mongo`
- Produces:
  - `export function isReadyForSale(vehicle: Record<string, unknown>, price: Record<string, unknown> | undefined, underContract: Set<string>): boolean`
  - `export function promoLinesFrom(promo: Record<string, unknown> | undefined): string[]`
  - `export async function loadPublicTrucks(): Promise<PublicTruck[]>` (เฉพาะรถพร้อมขาย เรียงมีรูปก่อน)
  - `export async function loadPublicTruckBySlug(slug: string): Promise<PublicTruck | null>` (คืนรถที่ขายแล้วด้วย โดย `isSold: true`)

- [ ] **Step 1: เพิ่มเทสต์ที่ยังไม่ผ่าน**

เพิ่มท้าย `lib/public-trucks.test.ts`:

```ts
import { isReadyForSale, promoLinesFrom } from "@/lib/public-trucks"

describe("isReadyForSale", () => {
  const ready = { saleStatus: "ready" }
  it("พร้อมขาย = ไม่ inactive + ไม่มีสัญญา + saleStatus ready", () => {
    expect(isReadyForSale({ status: "active", licensePlate: "สบ.71-1956" }, ready, new Set())).toBe(true)
  })
  it("รถ inactive → ไม่ขึ้นเว็บ", () => {
    expect(isReadyForSale({ status: "inactive", licensePlate: "สบ.71-1956" }, ready, new Set())).toBe(false)
  })
  it("มีสัญญา active → ไม่ขึ้นเว็บ", () => {
    expect(isReadyForSale({ status: "active", licensePlate: "สบ.71-1956" }, ready, new Set(["71-1956"]))).toBe(false)
  })
  it("saleStatus ไม่ใช่ ready → ไม่ขึ้นเว็บ", () => {
    expect(isReadyForSale({ status: "active", licensePlate: "สบ.71-1956" }, { saleStatus: "repair15" }, new Set())).toBe(false)
  })
  it("ไม่มีแถวราคาเลย → ไม่ขึ้นเว็บ", () => {
    expect(isReadyForSale({ status: "active", licensePlate: "สบ.71-1956" }, undefined, new Set())).toBe(false)
  })
})

describe("promoLinesFrom", () => {
  it("แปลง promotion_master เป็นบรรทัดอ่านง่าย", () => {
    expect(promoLinesFrom({ pro2RepairBudget: 120000, pro3AnnualPm: 10070 })).toEqual([
      "ฟรีค่าซ่อมบำรุง วงเงิน 120,000 บาท",
      "ฟรี PM (บำรุงรักษาเชิงป้องกัน) 10,070 บาท/ปี ตลอดสัญญา",
    ])
  })
  it("ไม่มีโปรฯ → ลิสต์ว่าง", () => {
    expect(promoLinesFrom(undefined)).toEqual([])
    expect(promoLinesFrom({ pro2RepairBudget: 0, pro3AnnualPm: 0 })).toEqual([])
  })
})
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/public-trucks.test.ts`
Expected: FAIL — `isReadyForSale is not a function`

- [ ] **Step 3: เขียน implementation**

เพิ่มใน `lib/public-trucks.ts`:

```ts
import clientPromise from "@/lib/mongo"
import { normPlate } from "@/lib/catalog-pdf"

const DB = process.env.MONGO_DB ?? "mena_partner"
const fm = (v: number) => v.toLocaleString("th-TH")

/** เกณฑ์เดียวกับ catalog PDF: ไม่ inactive + ไม่มีสัญญา active + saleStatus ready */
export function isReadyForSale(
  vehicle: Record<string, unknown>,
  price: Record<string, unknown> | undefined,
  underContract: Set<string>,
): boolean {
  if (!price) return false
  const key = normPlate(String(vehicle.licensePlate ?? ""))
  return vehicle.status !== "inactive" && !underContract.has(key) && price.saleStatus === "ready"
}

export function promoLinesFrom(promo: Record<string, unknown> | undefined): string[] {
  if (!promo) return []
  const lines: string[] = []
  const budget = n(promo.pro2RepairBudget)
  const pm = n(promo.pro3AnnualPm)
  if (budget > 0) lines.push(`ฟรีค่าซ่อมบำรุง วงเงิน ${fm(budget)} บาท`)
  if (pm > 0) lines.push(`ฟรี PM (บำรุงรักษาเชิงป้องกัน) ${fm(pm)} บาท/ปี ตลอดสัญญา`)
  return lines
}

/** projection = field ที่เปิดเผยได้เท่านั้น (ไม่ดึงเลขตัวถัง/เลขเครื่องออกจาก DB ตั้งแต่ต้น) */
const VEHICLE_PROJECTION = {
  licensePlate: 1, truckNumber: 1, brand: 1, model: 1, vehicleType: 1,
  characteristic: 1, color: 1, registrationDate: 1, engineSize: 1,
  photoUrl: 1, photos: 1, status: 1, publicSlug: 1,
} as const

async function loadAll() {
  const db = (await clientPromise).db(DB)
  const [vehicles, prices, promos, contracts] = await Promise.all([
    db.collection("vehicle_master").find({}, { projection: VEHICLE_PROJECTION }).toArray(),
    db.collection("master_price_list").find({}, { projection: { licensePlate: 1, saleStatus: 1, totalSalePrice: 1, downPayment: 1, cashDown: 1, monthlyPayment: 1, financeInstallments: 1 } }).toArray(),
    db.collection("promotion_master").find({}, { projection: { licensePlate: 1, pro2RepairBudget: 1, pro3AnnualPm: 1 } }).toArray(),
    db.collection("contracts").find({ status: "active" }, { projection: { licensePlate: 1 } }).toArray(),
  ])
  return {
    vehicles,
    priceBy: new Map(prices.map((p) => [normPlate(String(p.licensePlate ?? "")), p])),
    promoBy: new Map(promos.map((p) => [normPlate(String(p.licensePlate ?? "")), p])),
    underContract: new Set(contracts.map((c) => normPlate(String(c.licensePlate ?? "")))),
  }
}

/** slug ที่ยังไม่ถูก backfill → คำนวณสดแบบ deterministic (Task 4 เขียนค่าถาวรลง DB) */
function slugOf(v: Record<string, unknown>, taken: Set<string>): string {
  const stored = String(v.publicSlug ?? "").trim()
  if (stored) return stored
  return uniqueSlug(makeSlug({
    truckNumber: String(v.truckNumber ?? ""), brand: String(v.brand ?? ""),
    model: String(v.model ?? ""), registrationDate: String(v.registrationDate ?? ""),
    licensePlate: String(v.licensePlate ?? ""),
  }), taken)
}

export async function loadPublicTrucks(): Promise<PublicTruck[]> {
  const { vehicles, priceBy, promoBy, underContract } = await loadAll()
  const taken = new Set<string>()
  const out: PublicTruck[] = []
  for (const v of vehicles) {
    const key = normPlate(String(v.licensePlate ?? ""))
    if (!isReadyForSale(v, priceBy.get(key), underContract)) continue
    const slug = slugOf(v, taken)
    taken.add(slug)
    out.push(toPublicTruck(v, priceBy.get(key), promoLinesFrom(promoBy.get(key)), slug, false))
  }
  // มีรูปขึ้นก่อน (หน้าแรกต้องดูดี) แล้วเรียงราคาต่ำ→สูง
  return out.sort((a, b) =>
    Number(!!b.photoUrl) - Number(!!a.photoUrl) || a.totalSalePrice - b.totalSalePrice)
}

export async function loadPublicTruckBySlug(slug: string): Promise<PublicTruck | null> {
  const { vehicles, priceBy, promoBy, underContract } = await loadAll()
  const taken = new Set<string>()
  for (const v of vehicles) {
    const s2 = slugOf(v, taken)
    taken.add(s2)
    if (s2 !== slug) continue
    const key = normPlate(String(v.licensePlate ?? ""))
    const price = priceBy.get(key)
    const ready = isReadyForSale(v, price, underContract)
    // รถที่ขายแล้ว/เข้าสัญญาแล้ว ยังเปิดหน้าได้ (ริบบิ้น "ขายแล้ว" + noindex)
    return toPublicTruck(v, price, promoLinesFrom(promoBy.get(key)), s2, !ready)
  }
  return null
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/public-trucks.test.ts && npx tsc --noEmit`
Expected: PASS ทั้งหมด, tsc เงียบ

- [ ] **Step 5: Commit**

```bash
git add lib/public-trucks.ts lib/public-trucks.test.ts
git commit -m "feat(public): loader รถพร้อมขายสำหรับหน้าเว็บสาธารณะ (projection เฉพาะ field ที่เปิดเผยได้)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 4: สคริปต์ backfill `publicSlug` (แตะ prod — ต้องขออนุมัติ)

**Files:**
- Create: `scripts/backfill-public-slug.mjs`

**Interfaces:**
- Consumes: กติกา slug จาก Task 2 (สคริปต์ implement ซ้ำแบบ standalone เพราะเป็น .mjs รันนอก Next — ต้องให้ผลตรงกับ `makeSlug`)
- Produces: `vehicle_master.publicSlug` (string, unique) สำหรับรถพร้อมขายทุกคัน + unique partial index

- [ ] **Step 1: เขียนสคริปต์ dry-run-by-default**

`scripts/backfill-public-slug.mjs` — ยึดรูปแบบเดียวกับ `scripts/clear-vehicle-cost-data.mjs` ที่มีอยู่ (โหลด .env.local เอง, dry-run เป็นค่าเริ่มต้น, `--apply` ถึงเขียนจริง):

```js
#!/usr/bin/env node
/**
 * backfill-public-slug.mjs — เติม vehicle_master.publicSlug ให้รถพร้อมขาย (หน้า /trucks)
 * slug ต้องคงที่ตลอดไป: ถ้าแก้ยี่ห้อ/รุ่นภายหลัง URL ที่ Google เก็บไว้ต้องไม่เปลี่ยน
 * DEFAULT = DRY-RUN
 *   node scripts/backfill-public-slug.mjs           # แสดงว่าจะเขียนอะไร ไม่แตะ DB
 *   node scripts/backfill-public-slug.mjs --apply   # เขียนจริง + สร้าง unique index
 */
import { MongoClient } from "mongodb"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(resolve(ROOT, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch { /* ไม่มีไฟล์ — ข้าม */ }
}

const uri = process.env.MONGO_URI
const DB  = process.env.MONGO_DB ?? "mena_partner"
if (!uri) { console.error("MONGO_URI not set"); process.exit(1) }
const APPLY = process.argv.includes("--apply")

const normPlate = (p) => String(p ?? "").replace(/^[^0-9]*/, "").trim()
const slugPart  = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const regYear   = (d) => { const y = Number(String(d ?? "").slice(0, 4)); return Number.isInteger(y) && y > 1900 && y < 2200 ? y : null }
const makeSlug  = (v) => {
  const year = regYear(v.registrationDate)
  const head = slugPart(v.truckNumber) || `t-${createHash("sha256").update(String(v.licensePlate ?? "")).digest("hex").slice(0, 6)}`
  return [head, slugPart(v.brand), slugPart(v.model), year ? String(year + 543) : ""].filter(Boolean).join("-").replace(/-+/g, "-")
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
await client.connect()
const db = client.db(DB)
try {
  const [vehicles, prices, contracts] = await Promise.all([
    db.collection("vehicle_master").find({}, { projection: { licensePlate: 1, truckNumber: 1, brand: 1, model: 1, registrationDate: 1, status: 1, publicSlug: 1 } }).toArray(),
    db.collection("master_price_list").find({}, { projection: { licensePlate: 1, saleStatus: 1 } }).toArray(),
    db.collection("contracts").find({ status: "active" }, { projection: { licensePlate: 1 } }).toArray(),
  ])
  const priceBy = new Map(prices.map((p) => [normPlate(p.licensePlate), p]))
  const underContract = new Set(contracts.map((c) => normPlate(c.licensePlate)))
  const taken = new Set(vehicles.map((v) => v.publicSlug).filter(Boolean))

  const ready = vehicles.filter((v) => {
    const k = normPlate(v.licensePlate)
    return v.status !== "inactive" && !underContract.has(k) && priceBy.get(k)?.saleStatus === "ready"
  })
  console.log(`DB: ${DB}   โหมด: ${APPLY ? "APPLY" : "DRY-RUN"}`)
  console.log(`รถพร้อมขาย ${ready.length} คัน · มี publicSlug แล้ว ${ready.filter((v) => v.publicSlug).length} คัน\n`)

  let written = 0
  for (const v of ready) {
    if (v.publicSlug) { console.log(`   ${String(v.truckNumber ?? "-").padEnd(8)} มีแล้ว: ${v.publicSlug}`); continue }
    let slug = makeSlug(v)
    if (taken.has(slug)) { let i = 2; while (taken.has(`${slug}-${i}`)) i++; slug = `${slug}-${i}` }
    taken.add(slug)
    console.log(`   ${String(v.truckNumber ?? "-").padEnd(8)} ${APPLY ? "เขียน" : "จะเขียน"}: ${slug}`)
    if (APPLY) await db.collection("vehicle_master").updateOne({ _id: v._id }, { $set: { publicSlug: slug } })
    written++
  }

  if (APPLY) {
    // unique เฉพาะ doc ที่มี publicSlug (partial) — รถที่ยังไม่ publish ไม่ติดกติกา
    await db.collection("vehicle_master").createIndex(
      { publicSlug: 1 },
      { unique: true, partialFilterExpression: { publicSlug: { $type: "string" } } },
    )
    console.log(`\n✓ เขียน ${written} คัน + สร้าง unique index publicSlug_1 แล้ว`)
  } else {
    console.log(`\n(dry-run — จะเขียน ${written} คัน · ใส่ --apply เพื่อเขียนจริง)`)
  }
} finally { await client.close() }
```

- [ ] **Step 2: รัน dry-run (อ่านอย่างเดียว ไม่เขียน)**

Run: `node scripts/backfill-public-slug.mjs`
Expected: ลิสต์รถพร้อมขาย ~18 คันพร้อม slug ที่จะเขียน ไม่มีการเขียน DB

- [ ] **Step 3: หยุดขออนุมัติจากผู้ใช้ก่อนเขียนจริง**

⚠️ ขั้นนี้เขียน prod DB (เพิ่ม field + unique index บน `vehicle_master`) — สรุปจำนวนคันที่จะเขียนให้ผู้ใช้ 1 บรรทัด แล้วรอ "go" ก่อนรัน `--apply`
(ตามกติกา DB safety ของโปรเจกต์: pause ก่อนแตะ prod ทุกครั้ง)

- [ ] **Step 4: รันจริงหลังได้อนุมัติ**

Run: `node scripts/backfill-public-slug.mjs --apply`
Expected: `✓ เขียน N คัน + สร้าง unique index publicSlug_1 แล้ว`

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-public-slug.mjs
git commit -m "feat(public): สคริปต์ backfill publicSlug + unique index (dry-run เป็นค่าเริ่มต้น)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 5: middleware allowlist + public API routes

**Files:**
- Create: `lib/public-routes.ts`
- Test: `lib/public-routes.test.ts`
- Modify: `middleware.ts:9-13` (บล็อกแรกสุดของ `middleware()`)
- Create: `app/api/public/trucks/route.ts`
- Create: `app/api/public/trucks/[slug]/route.ts`

**Interfaces:**
- Consumes: `loadPublicTrucks`, `loadPublicTruckBySlug` (Task 3)
- Produces: `export function isPublicPath(pathname: string): boolean`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`lib/public-routes.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { isPublicPath } from "@/lib/public-routes"

describe("isPublicPath", () => {
  it("เปิดเฉพาะเส้นทางสาธารณะที่ตั้งใจ", () => {
    for (const p of ["/trucks", "/trucks/me009-hino-fm2p-2561", "/api/public/trucks", "/og/truck/x", "/sitemap.xml", "/robots.txt"])
      expect(isPublicPath(p)).toBe(true)
  })

  it("หน้าระบบภายในต้องไม่หลุดเป็น public", () => {
    for (const p of ["/", "/drivers", "/payroll", "/vehicle-cost", "/catalog", "/api/drivers", "/api/contracts", "/api/upload", "/admin/users"])
      expect(isPublicPath(p)).toBe(false)
  })

  it("กันชื่อ path ที่ขึ้นต้นคล้ายกันแต่ไม่ใช่ของสาธารณะ", () => {
    expect(isPublicPath("/trucksecret")).toBe(false)
    expect(isPublicPath("/api/publicity")).toBe(false)
  })
})
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/public-routes.test.ts`
Expected: FAIL — resolve `@/lib/public-routes` ไม่ได้

- [ ] **Step 3: เขียน implementation**

`lib/public-routes.ts`:

```ts
/**
 * เส้นทางที่เปิดสาธารณะ (ไม่ต้อง login) — ใช้ทั้งใน middleware
 * แคบที่สุดเท่าที่พอใช้: หน้าเว็บขายรถ + API สาธารณะ + ไฟล์ SEO
 */
const PUBLIC_EXACT = new Set(["/trucks", "/sitemap.xml", "/robots.txt"])
const PUBLIC_PREFIXES = ["/trucks/", "/api/public/", "/og/"]

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/public-routes.test.ts`
Expected: PASS ทั้ง 3 เคส

- [ ] **Step 5: เสียบ allowlist เข้า middleware**

`middleware.ts` — แทรก **ก่อน** `getToken` (คือก่อนบรรทัด `const token = await getToken(...)`) และเพิ่ม import:

```ts
import { isPublicPath } from "@/lib/public-routes"

// … ใน middleware() ต่อจากบล็อก /api/auth และ /login เดิม:
  // หน้าเว็บขายรถสาธารณะ — ไม่ต้อง login (ดู lib/public-routes.ts)
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }
```

- [ ] **Step 6: สร้าง API สาธารณะ**

`app/api/public/trucks/route.ts`:

```ts
import { NextResponse } from "next/server"
import { loadPublicTrucks } from "@/lib/public-trucks"

export const revalidate = 600

export async function GET() {
  const trucks = await loadPublicTrucks()
  return NextResponse.json({ trucks, count: trucks.length })
}
```

`app/api/public/trucks/[slug]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { loadPublicTruckBySlug } from "@/lib/public-trucks"

export const revalidate = 600

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const truck = await loadPublicTruckBySlug(slug)
  if (!truck) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(truck)
}
```

- [ ] **Step 7: ตรวจของจริงว่าไม่ต้อง login**

Run: `npm run dev` แล้วอีกเทอร์มินัล `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/public/trucks` และ `curl -s http://localhost:3000/api/public/trucks | head -c 400`
Expected: `200` และ JSON ที่ **ไม่มี** คำว่า `licensePlate`/`chassisNumber` (ตรวจด้วยตา)
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/drivers`
Expected: `401` (ของภายในยังปิดอยู่)

- [ ] **Step 8: Commit**

```bash
git add lib/public-routes.ts lib/public-routes.test.ts middleware.ts app/api/public
git commit -m "feat(public): middleware allowlist + API สาธารณะ /api/public/trucks

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 6: หน้า `/trucks` (browse + ตัวกรอง)

**Files:**
- Create: `app/(public)/trucks/page.tsx`
- Create: `components/public/truck-card.tsx`
- Create: `components/public/truck-browser.tsx`
- Modify: `next.config.ts:19-21` (บล็อก `images`)

**Interfaces:**
- Consumes: `loadPublicTrucks`, `PublicTruck` (Task 3)
- Produces: `<TruckCard truck={PublicTruck} />`, `<TruckBrowser trucks={PublicTruck[]} />`

- [ ] **Step 1: อนุญาตโดเมนรูป DO Spaces ให้ next/image**

`next.config.ts`:

```ts
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.digitaloceanspaces.com" }],
  },
```

- [ ] **Step 2: สร้างการ์ดรถ**

`components/public/truck-card.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"
import { formatMoney } from "@/lib/utils"
import type { PublicTruck } from "@/lib/public-trucks"

export function TruckCard({ truck }: { truck: PublicTruck }) {
  const year = truck.registrationYear
  const title = [truck.brand, truck.model].filter(Boolean).join(" ") || "รถผสมปูนมือสอง"
  return (
    <Link href={`/trucks/${truck.slug}`} className="group block rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-lg transition-shadow bg-white">
      <div className="relative aspect-[4/3] bg-zinc-100">
        {truck.photoUrl ? (
          <Image src={truck.photoUrl} alt={`${title}${year ? ` ปี ${year + 543}` : ""} มือสอง`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-[1.02] transition-transform" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">รูปกำลังอัปเดต</div>
        )}
        {truck.promoLines.length > 0 && (
          <span className="absolute top-3 left-3 rounded-full bg-amber-500 text-white text-[11px] font-semibold px-2.5 py-1">โปรฯ ติดรถ</span>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold leading-tight">{title}{year ? ` ปี ${year + 543}` : ""}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{[truck.characteristic, truck.vehicleType].filter(Boolean).join(" · ")}</p>
        <p className="text-xl font-bold mt-2">฿{formatMoney(truck.totalSalePrice)}</p>
        {truck.monthlyPayment > 0 && (
          <p className="text-sm text-emerald-700 font-medium">ผ่อน ฿{formatMoney(truck.monthlyPayment)}/เดือน</p>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: สร้างตัวกรอง (client component, กรองในหน่วยความจำ — สต็อก 18 คันไม่ต้อง server pagination)**

`components/public/truck-browser.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { TruckCard } from "./truck-card"
import type { PublicTruck } from "@/lib/public-trucks"

type Sort = "recommended" | "price-asc" | "year-desc"

export function TruckBrowser({ trucks }: { trucks: PublicTruck[] }) {
  const [brand, setBrand] = useState("")
  const [characteristic, setChar] = useState("")
  const [maxPrice, setMaxPrice] = useState(0)
  const [sort, setSort] = useState<Sort>("recommended")

  const brands = useMemo(() => [...new Set(trucks.map((t) => t.brand).filter(Boolean))].sort(), [trucks])
  const chars  = useMemo(() => [...new Set(trucks.map((t) => t.characteristic).filter(Boolean))].sort(), [trucks])

  const shown = useMemo(() => {
    const out = trucks.filter((t) =>
      (!brand || t.brand === brand) &&
      (!characteristic || t.characteristic === characteristic) &&
      (!maxPrice || t.totalSalePrice <= maxPrice))
    if (sort === "price-asc") return [...out].sort((a, b) => a.totalSalePrice - b.totalSalePrice)
    if (sort === "year-desc") return [...out].sort((a, b) => (b.registrationYear ?? 0) - (a.registrationYear ?? 0))
    return out
  }, [trucks, brand, characteristic, maxPrice, sort])

  const sel = "rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
  return (
    <>
      <div className="flex flex-wrap gap-2 items-center mb-6">
        <select className={sel} value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">ยี่ห้อทั้งหมด</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={sel} value={characteristic} onChange={(e) => setChar(e.target.value)}>
          <option value="">ลักษณะทั้งหมด</option>
          {chars.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={sel} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
          <option value={0}>ราคาทุกช่วง</option>
          <option value={800000}>ไม่เกิน 800,000</option>
          <option value={1200000}>ไม่เกิน 1,200,000</option>
          <option value={1800000}>ไม่เกิน 1,800,000</option>
        </select>
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recommended">แนะนำ</option>
          <option value="price-asc">ราคาต่ำ → สูง</option>
          <option value="year-desc">ปีใหม่ → เก่า</option>
        </select>
        <span className="text-sm text-zinc-500 ml-auto">{shown.length} คัน</span>
      </div>
      {shown.length === 0 ? (
        <p className="text-zinc-500 py-12 text-center">ไม่พบรถตามเงื่อนไขนี้ — ลองล้างตัวกรอง</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => <TruckCard key={t.slug} truck={t} />)}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: สร้างหน้า browse (Server Component + ISR)**

`app/(public)/trucks/page.tsx`:

```tsx
import type { Metadata } from "next"
import { loadPublicTrucks } from "@/lib/public-trucks"
import { TruckBrowser } from "@/components/public/truck-browser"

export const revalidate = 600

export const metadata: Metadata = {
  title: "รถผสมปูน (มิกเซอร์) มือสอง พร้อมงานวิ่ง | มีนา ทรานสปอร์ต",
  description: "รถผสมปูนมือสองจากกองรถบริษัท เจ้าของเดียว มีประวัติซ่อมบำรุงครบ ผ่อนกับบริษัทโดยตรง พร้อมงานวิ่งรองรับ",
}

export default async function TrucksPage() {
  const trucks = await loadPublicTrucks()
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold">รถผสมปูน (มิกเซอร์) มือสอง</h1>
      <p className="text-zinc-600 mt-2 max-w-2xl">
        รถจากกองรถของบริษัทเอง เจ้าของเดียว มีประวัติการซ่อมบำรุงครบทุกครั้ง
        ผ่อนชำระกับบริษัทโดยตรง และมีงานวิ่งรองรับตั้งแต่วันแรก
      </p>
      <div className="mt-8">
        <TruckBrowser trucks={trucks} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: ตรวจหน้าจริง**

Run: `npm run dev` แล้วเปิด `http://localhost:3000/trucks` ใน browser ที่ไม่ได้ login (หน้าต่าง private)
Expected: เห็นการ์ดรถ ไม่เด้งไป `/login`, ตัวกรองทำงาน, ไม่มีทะเบียนโผล่บนหน้า

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/trucks/page.tsx" components/public/truck-card.tsx components/public/truck-browser.tsx next.config.ts
git commit -m "feat(public): หน้า /trucks — การ์ดรถ + ตัวกรองยี่ห้อ/ลักษณะ/ราคา

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 7: หน้า `/trucks/[slug]` (listing detail)

**Files:**
- Create: `app/(public)/trucks/[slug]/page.tsx`
- Create: `components/public/truck-gallery.tsx`
- Create: `components/public/truck-spec-table.tsx`

**Interfaces:**
- Consumes: `loadPublicTruckBySlug`, `loadPublicTrucks` (Task 3), `getCatalogConfig` + `CatalogConfig` จาก `@/lib/catalog-config`, `clientPromise` จาก `@/lib/mongo`
- Produces: `<TruckGallery photos={string[]} alt={string} />`, `<TruckSpecTable truck={PublicTruck} location={string} />`

- [ ] **Step 1: สร้าง gallery (client component — สลับรูปได้)**

`components/public/truck-gallery.tsx`:

```tsx
"use client"

import { useState } from "react"
import Image from "next/image"

export function TruckGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const list = photos.filter(Boolean)
  const [i, setI] = useState(0)
  if (list.length === 0) {
    return <div className="aspect-[4/3] rounded-2xl bg-zinc-100 grid place-items-center text-zinc-400">รูปกำลังอัปเดต</div>
  }
  return (
    <div>
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100">
        <Image src={list[i]} alt={alt} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" priority />
      </div>
      {list.length > 1 && (
        <div className="flex gap-2 mt-3">
          {list.map((p, idx) => (
            <button key={p} onClick={() => setI(idx)} aria-label={`รูปที่ ${idx + 1}`}
              className={`relative w-20 h-16 rounded-lg overflow-hidden border-2 ${idx === i ? "border-zinc-900" : "border-transparent"}`}>
              <Image src={p} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: สร้างตารางสเปก**

`components/public/truck-spec-table.tsx`:

```tsx
import type { PublicTruck } from "@/lib/public-trucks"

export function TruckSpecTable({ truck, location }: { truck: PublicTruck; location: string }) {
  const y = truck.registrationYear
  const rows: [string, string][] = [
    ["ยี่ห้อ", truck.brand],
    ["รุ่น", truck.model],
    ["ปีจดทะเบียน", y ? `${y} (${y + 543})` : "—"],
    ["ประเภทรถ", truck.vehicleType],
    ["ลักษณะ", truck.characteristic],
    ["สี", truck.color],
    ["ขนาดเครื่องยนต์", truck.engineSize],
    ["เบอร์รถ", truck.truckNumber],
    ["ทำเล", location],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-zinc-500">{k}</dt>
          <dd className="font-medium text-right sm:text-left">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  )
}
```

- [ ] **Step 3: สร้างหน้า detail**

`app/(public)/trucks/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import Link from "next/link"
import clientPromise from "@/lib/mongo"
import { formatMoney } from "@/lib/utils"
import { getCatalogConfig } from "@/lib/catalog-config"
import { loadPublicTruckBySlug, loadPublicTrucks } from "@/lib/public-trucks"
import { TruckGallery } from "@/components/public/truck-gallery"
import { TruckSpecTable } from "@/components/public/truck-spec-table"
import { TruckCard } from "@/components/public/truck-card"

export const revalidate = 600

/** ทำเลใน P0 = ค่าคงที่ระดับบริษัท (vehicle_master ยังไม่มี field จังหวัด — อยู่ใน P1) */
const LOCATION = "สระบุรี"

export default async function TruckDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const truck = await loadPublicTruckBySlug(slug)
  if (!truck) notFound()

  const db = (await clientPromise).db(process.env.MONGO_DB ?? "mena_partner")
  const [cfg, all] = await Promise.all([getCatalogConfig(db), loadPublicTrucks()])
  const related = all.filter((t) => t.slug !== truck.slug).slice(0, 3)
  const title = [truck.brand, truck.model].filter(Boolean).join(" ") || "รถผสมปูนมือสอง"
  const y = truck.registrationYear
  const heading = `${title}${y ? ` ปี ${y + 543}` : ""}`

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <nav className="text-sm text-zinc-500 mb-5">
        <Link href="/trucks" className="hover:underline">รถมือสอง</Link>
        <span className="mx-2">›</span>
        <span>{truck.vehicleType || "รถผสมปูน"}</span>
        <span className="mx-2">›</span>
        <span className="text-zinc-800">{heading}</span>
      </nav>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div>
          <TruckGallery photos={[truck.photos.front, truck.photos.left, truck.photos.right, truck.photos.back, truck.photos.cabin]} alt={`${heading} มือสอง`} />
        </div>

        <div>
          {truck.isSold && (
            <p className="mb-3 inline-block rounded-full bg-zinc-900 text-white text-xs font-semibold px-3 py-1">ขายแล้ว</p>
          )}
          <h1 className="text-2xl font-bold">{heading}</h1>
          <p className="text-3xl font-bold mt-3">฿{formatMoney(truck.totalSalePrice)}</p>
          {truck.monthlyPayment > 0 && (
            <p className="text-emerald-700 font-semibold mt-1">
              ผ่อน ฿{formatMoney(truck.monthlyPayment)}/เดือน
              {truck.financeInstallments > 0 && ` × ${truck.financeInstallments} งวด`}
              {truck.downPayment > 0 && ` · ดาวน์ ฿${formatMoney(truck.downPayment)}`}
            </p>
          )}

          <div className="flex gap-2 mt-5">
            {cfg.contactPhone && (
              <a href={`tel:${cfg.contactPhone}`} className="flex-1 text-center rounded-xl bg-zinc-900 text-white font-semibold py-3">โทรหาฝ่ายขาย</a>
            )}
            {cfg.contactLine && (
              <a href={`https://line.me/R/ti/p/${encodeURIComponent(cfg.contactLine)}`} className="flex-1 text-center rounded-xl border border-zinc-300 font-semibold py-3">LINE</a>
            )}
          </div>

          {truck.promoLines.length > 0 && (
            <ul className="mt-6 space-y-1.5 text-sm">
              {truck.promoLines.map((l) => <li key={l} className="flex gap-2"><span className="text-amber-500">★</span>{l}</li>)}
            </ul>
          )}

          <div className="mt-6 rounded-2xl border border-zinc-200 p-5">
            <p className="text-sm font-semibold mb-3">ข้อมูลรถ</p>
            <TruckSpecTable truck={truck} location={LOCATION} />
          </div>
        </div>
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-lg font-bold">ทำไมต้องซื้อรถจากกองรถบริษัท</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          {cfg.sellingPoints.map((p) => <li key={p} className="flex gap-2"><span className="text-emerald-600">✓</span>{p}</li>)}
        </ul>
        {cfg.terms.length > 0 && (
          <div className="mt-6 text-xs text-zinc-500 space-y-1">
            {cfg.terms.map((t) => <p key={t}>{t}</p>)}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-zinc-200 p-5 max-w-3xl">
        <p className="text-sm text-zinc-500">ผู้ขาย</p>
        <p className="font-bold text-lg">บริษัท มีนา ทรานสปอร์ต จำกัด</p>
        <p className="text-sm text-zinc-600 mt-1">{cfg.contactName}{cfg.contactPhone ? ` · ${cfg.contactPhone}` : ""}</p>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold mb-4">รถคันอื่นที่น่าสนใจ</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {related.map((t) => <TruckCard key={t.slug} truck={t} />)}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: ตรวจหน้าจริง**

Run: `npm run dev` แล้วเปิด `/trucks` → คลิกรถคันหนึ่ง (private window)
Expected: หน้ารายละเอียดขึ้นครบ, กด gallery สลับรูปได้, 404 เมื่อเปิด `/trucks/ไม่มีจริง`

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/trucks/[slug]/page.tsx" components/public/truck-gallery.tsx components/public/truck-spec-table.tsx
git commit -m "feat(public): หน้ารายละเอียดรถ /trucks/[slug] — gallery, ราคา+แผนผ่อน, สเปก, โปรฯ, รถใกล้เคียง

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 8: SEO — metadata, JSON-LD, sitemap, robots, OG image

**Files:**
- Create: `lib/public-seo.ts`
- Test: `lib/public-seo.test.ts`
- Modify: `app/(public)/trucks/[slug]/page.tsx` (เพิ่ม `generateMetadata` + JSON-LD)
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Create: `app/og/truck/[slug]/route.tsx`
- Modify: `next.config.ts` (`outputFileTracingIncludes` ของ route OG)

**Interfaces:**
- Consumes: `PublicTruck`, `loadPublicTrucks`, `loadPublicTruckBySlug` (Task 3)
- Produces:
  - `export function siteUrl(path?: string): string`
  - `export function truckTitle(t: PublicTruck): string`
  - `export function truckDescription(t: PublicTruck): string`
  - `export function truckJsonLd(t: PublicTruck): Record<string, unknown>`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`lib/public-seo.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { siteUrl, truckTitle, truckDescription, truckJsonLd } from "@/lib/public-seo"
import type { PublicTruck } from "@/lib/public-trucks"

const truck: PublicTruck = {
  slug: "me009-hino-fm2p-2561", truckNumber: "ME009", brand: "HINO", model: "FM2P",
  vehicleType: "รถผสมปูน", characteristic: "10 ล้อ", color: "ขาว", registrationYear: 2018,
  engineSize: "7790 cc", photoUrl: "https://spaces/f.jpg",
  photos: { front: "https://spaces/f.jpg", back: "", left: "", right: "", cabin: "" },
  totalSalePrice: 1450000, downPayment: 200000, cashDown: 50000, monthlyPayment: 35000,
  financeInstallments: 48, promoLines: [], isSold: false,
}

describe("siteUrl", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL
  afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original })

  it("ใช้ค่า env เมื่อมี", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://menatransport.co.th"
    expect(siteUrl("/trucks/x")).toBe("https://menatransport.co.th/trucks/x")
  })
  it("ไม่มี env → fallback โดเมน vercel", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(siteUrl("/trucks")).toBe("https://mena-partner.vercel.app/trucks")
  })
  it("ตัด / ซ้ำท้ายโดเมน", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/"
    expect(siteUrl("/trucks")).toBe("https://example.com/trucks")
  })
})

describe("truckTitle / truckDescription", () => {
  it("title มียี่ห้อ รุ่น ปีพ.ศ. ราคา และชื่อบริษัท", () => {
    const t = truckTitle(truck)
    expect(t).toContain("HINO FM2P")
    expect(t).toContain("2561")
    expect(t).toContain("1,450,000")
    expect(t).toContain("มีนา ทรานสปอร์ต")
  })
  it("description ยาวไม่เกิน 160 ตัวอักษร", () => {
    expect(truckDescription(truck).length).toBeLessThanOrEqual(160)
  })
})

describe("truckJsonLd", () => {
  it("เป็น schema.org Vehicle พร้อม Offer ราคาบาท", () => {
    const ld = truckJsonLd(truck) as Record<string, any>
    expect(ld["@type"]).toBe("Vehicle")
    expect(ld.offers.price).toBe(1450000)
    expect(ld.offers.priceCurrency).toBe("THB")
    expect(ld.offers.availability).toBe("https://schema.org/InStock")
    expect(ld.brand.name).toBe("HINO")
  })
  it("ขายแล้ว → availability = SoldOut", () => {
    const ld = truckJsonLd({ ...truck, isSold: true }) as Record<string, any>
    expect(ld.offers.availability).toBe("https://schema.org/SoldOut")
  })
  it("ไม่มีทะเบียนหลุดเข้า JSON-LD", () => {
    expect(JSON.stringify(truckJsonLd(truck))).not.toContain("71-")
  })
})
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/public-seo.test.ts`
Expected: FAIL — resolve `@/lib/public-seo` ไม่ได้

- [ ] **Step 3: เขียน implementation**

`lib/public-seo.ts`:

```ts
import type { PublicTruck } from "@/lib/public-trucks"

const FALLBACK_ORIGIN = "https://mena-partner.vercel.app"
const COMPANY = "มีนา ทรานสปอร์ต"

/** ทุก URL สาธารณะต้องผ่านตัวนี้ — ย้ายโดเมนภายหลัง = แก้ env ตัวเดียว */
export function siteUrl(path = ""): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_ORIGIN).replace(/\/+$/, "")
  return path ? `${origin}${path.startsWith("/") ? path : `/${path}`}` : origin
}

const nameOf = (t: PublicTruck) =>
  [t.brand, t.model].filter(Boolean).join(" ") || t.vehicleType || "รถผสมปูนมือสอง"
const beYear = (t: PublicTruck) => (t.registrationYear ? t.registrationYear + 543 : null)

export function truckTitle(t: PublicTruck): string {
  const y = beYear(t)
  const price = t.totalSalePrice > 0 ? ` ราคา ${t.totalSalePrice.toLocaleString("en-US")}` : ""
  return `${t.vehicleType || "รถผสมปูน"} ${nameOf(t)}${y ? ` ปี ${y}` : ""}${price} | ${COMPANY}`
}

export function truckDescription(t: PublicTruck): string {
  const y = beYear(t)
  const parts = [
    `${nameOf(t)}${y ? ` ปี ${y}` : ""} ${t.characteristic}`.trim(),
    "เจ้าของเดียว ประวัติซ่อมบำรุงครบ",
    t.monthlyPayment > 0 ? `ผ่อน ${t.monthlyPayment.toLocaleString("en-US")} บาท/เดือน` : "",
    "ผ่อนกับบริษัทโดยตรง พร้อมงานวิ่ง",
  ].filter(Boolean)
  return parts.join(" · ").slice(0, 160)
}

export function truckJsonLd(t: PublicTruck): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: truckTitle(t),
    description: truckDescription(t),
    brand: { "@type": "Brand", name: t.brand || COMPANY },
    model: t.model || undefined,
    vehicleConfiguration: t.characteristic || undefined,
    color: t.color || undefined,
    ...(t.registrationYear ? { vehicleModelDate: String(t.registrationYear) } : {}),
    image: [t.photos.front, t.photos.left, t.photos.right, t.photos.back, t.photos.cabin].filter(Boolean),
    url: siteUrl(`/trucks/${t.slug}`),
    offers: {
      "@type": "Offer",
      price: t.totalSalePrice,
      priceCurrency: "THB",
      availability: t.isSold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      seller: { "@type": "Organization", name: `บริษัท ${COMPANY} จำกัด` },
      url: siteUrl(`/trucks/${t.slug}`),
    },
  }
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/public-seo.test.ts`
Expected: PASS ทั้ง 8 เคส

- [ ] **Step 5: เสียบ metadata + JSON-LD เข้าหน้า detail**

`app/(public)/trucks/[slug]/page.tsx` — เพิ่ม import และ `generateMetadata` เหนือ component แล้วแทรก `<script type="application/ld+json">` ไว้บนสุดของ JSX ที่ return:

```tsx
import type { Metadata } from "next"
import { siteUrl, truckTitle, truckDescription, truckJsonLd } from "@/lib/public-seo"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const truck = await loadPublicTruckBySlug(slug)
  if (!truck) return { title: "ไม่พบรถคันนี้" }
  const url = siteUrl(`/trucks/${truck.slug}`)
  return {
    title: truckTitle(truck),
    description: truckDescription(truck),
    alternates: { canonical: url },
    // รถที่ขายแล้ว: เก็บหน้าไว้ (สะสมลิงก์) แต่ไม่ให้ Google เก็บ index
    robots: truck.isSold ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website", url, title: truckTitle(truck), description: truckDescription(truck),
      images: [{ url: siteUrl(`/og/truck/${truck.slug}`), width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: truckTitle(truck), description: truckDescription(truck) },
  }
}
```

และใน JSX (บรรทัดแรกใน `<div className="max-w-6xl …">`):

```tsx
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(truckJsonLd(truck)) }} />
```

- [ ] **Step 6: sitemap + robots**

`app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next"
import { loadPublicTrucks } from "@/lib/public-trucks"
import { siteUrl } from "@/lib/public-seo"

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const trucks = await loadPublicTrucks()   // เฉพาะรถพร้อมขาย — ที่ขายแล้วไม่เข้า sitemap
  return [
    { url: siteUrl("/trucks"), changeFrequency: "daily", priority: 1 },
    ...trucks.map((t) => ({
      url: siteUrl(`/trucks/${t.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]
}
```

`app/robots.ts`:

```ts
import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/public-seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/trucks"], disallow: ["/api/", "/admin/", "/payroll", "/drivers", "/contracts", "/vehicle-cost", "/quotations", "/reports"] }],
    sitemap: siteUrl("/sitemap.xml"),
  }
}
```

- [ ] **Step 7: OG image (การ์ดตอนแชร์ LINE/Facebook)**

`app/og/truck/[slug]/route.tsx`:

```tsx
import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { loadPublicTruckBySlug } from "@/lib/public-trucks"

export const runtime = "nodejs"
export const revalidate = 600

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const truck = await loadPublicTruckBySlug(slug)
  if (!truck) return new Response("not found", { status: 404 })

  // ฟอนต์ไทยจำเป็น — ImageResponse ไม่มี glyph ไทยในตัว (ใช้ Sarabun ชุดเดียวกับใบเสนอราคา)
  const font = await readFile(join(process.cwd(), "fonts", "Sarabun-Bold.ttf"))
  const title = [truck.brand, truck.model].filter(Boolean).join(" ")
  const year = truck.registrationYear ? ` ปี ${truck.registrationYear + 543}` : ""

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0b0b0c", color: "white", fontFamily: "Sarabun", position: "relative" }}>
        {truck.photoUrl
          ? <img src={truck.photoUrl} width={1200} height={420} style={{ objectFit: "cover" }} />
          : <div style={{ width: 1200, height: 420, background: "#27272a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>มีนา ทรานสปอร์ต</div>}
        <div style={{ display: "flex", flexDirection: "column", padding: "24px 40px", gap: 8 }}>
          <div style={{ fontSize: 44 }}>{title}{year}</div>
          <div style={{ fontSize: 52, color: "#fbbf24" }}>฿{truck.totalSalePrice.toLocaleString("en-US")}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: "Sarabun", data: font, style: "normal", weight: 700 }] },
  )
}
```

`next.config.ts` — เพิ่มใน `outputFileTracingIncludes` ให้ route นี้เห็นไฟล์ฟอนต์:

```ts
    "/og/truck/[slug]": ["./fonts/**"],
```

- [ ] **Step 8: ตรวจของจริง**

Run: `npm run dev` แล้ว
```bash
curl -s http://localhost:3000/sitemap.xml | head -20
curl -s http://localhost:3000/robots.txt
curl -s -o /tmp/og.png -w "%{http_code} %{content_type}\n" http://localhost:3000/og/truck/<slug จริง>
curl -s http://localhost:3000/trucks/<slug จริง> | grep -o 'application/ld+json' | head -1
```
Expected: sitemap มีทุกคัน, robots ชี้ sitemap ถูก, OG ตอบ `200 image/png` (เปิดดู `/tmp/og.png` ว่าไทยไม่เป็นสี่เหลี่ยม), หน้า detail มี ld+json

- [ ] **Step 9: Commit**

```bash
git add lib/public-seo.ts lib/public-seo.test.ts app/sitemap.ts app/robots.ts "app/og/truck/[slug]/route.tsx" "app/(public)/trucks/[slug]/page.tsx" next.config.ts
git commit -m "feat(public): SEO — metadata/canonical, JSON-LD Vehicle+Offer, sitemap, robots, OG image ไทย

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 9: ฟอร์มขอใบเสนอราคา → lead ใน `/quotations`

**Files:**
- Create: `lib/public-lead.ts`
- Test: `lib/public-lead.test.ts`
- Create: `app/api/public/leads/route.ts`
- Create: `components/public/lead-form.tsx`
- Modify: `app/(public)/trucks/[slug]/page.tsx` (วางฟอร์มใต้กล่องราคา)

**Interfaces:**
- Consumes: `PublicTruck` (Task 2), `clientPromise` จาก `@/lib/mongo`
- Produces:
  - `export const leadSchema` (zod)
  - `export function parseLead(body: unknown): { ok: true; data: LeadInput } | { ok: false; error: string }`
  - `export function allowRequest(ip: string, now?: number): boolean` (rate limit 5 ครั้ง/ชม./IP)
  - `export interface LeadInput { name: string; phone: string; slug: string; budgetDown: number; message: string }`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`lib/public-lead.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { parseLead, allowRequest } from "@/lib/public-lead"

const good = { name: "สมชาย ใจดี", phone: "0812345678", slug: "me009-hino-fm2p-2561", budgetDown: 200000, message: "สนใจครับ" }

describe("parseLead", () => {
  it("ข้อมูลถูกต้อง → ผ่าน", () => {
    const r = parseLead(good)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.phone).toBe("0812345678")
  })

  it("honeypot มีค่า → ปฏิเสธ (บอท)", () => {
    expect(parseLead({ ...good, website: "http://spam.example" }).ok).toBe(false)
  })

  it("เบอร์ไม่ใช่รูปแบบไทย → ปฏิเสธ", () => {
    expect(parseLead({ ...good, phone: "12345" }).ok).toBe(false)
    expect(parseLead({ ...good, phone: "+1 555 0100" }).ok).toBe(false)
  })

  it("เบอร์มีขีด/เว้นวรรค → normalize เหลือตัวเลข", () => {
    const r = parseLead({ ...good, phone: "081-234-5678" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.phone).toBe("0812345678")
  })

  it("ไม่มีชื่อ → ปฏิเสธ", () => {
    expect(parseLead({ ...good, name: "  " }).ok).toBe(false)
  })

  it("ข้อความยาวเกิน → ตัดที่ 500 ตัวอักษร", () => {
    const r = parseLead({ ...good, message: "ก".repeat(900) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.message.length).toBe(500)
  })

  it("field แปลกปลอมถูกทิ้ง ไม่หลุดเข้า DB", () => {
    const r = parseLead({ ...good, status: "won", salesEmail: "x@y.com" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).not.toHaveProperty("status")
      expect(r.data).not.toHaveProperty("salesEmail")
    }
  })
})

describe("allowRequest", () => {
  it("5 ครั้งแรกผ่าน ครั้งที่ 6 ถูกบล็อก", () => {
    const ip = `test-${Math.random()}`
    const t = 1_700_000_000_000
    for (let i = 0; i < 5; i++) expect(allowRequest(ip, t)).toBe(true)
    expect(allowRequest(ip, t)).toBe(false)
  })

  it("พ้น 1 ชม. แล้วนับใหม่", () => {
    const ip = `test-${Math.random()}`
    const t = 1_700_000_000_000
    for (let i = 0; i < 5; i++) allowRequest(ip, t)
    expect(allowRequest(ip, t + 60 * 60 * 1000 + 1)).toBe(true)
  })
})
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/public-lead.test.ts`
Expected: FAIL — resolve `@/lib/public-lead` ไม่ได้

- [ ] **Step 3: เขียน implementation**

`lib/public-lead.ts`:

```ts
import { z } from "zod"

/** ฟอร์มสาธารณะ = ไม่มี auth → validate เข้ม + ทิ้ง field ที่ไม่รู้จักทั้งหมด */
export interface LeadInput {
  name: string
  phone: string
  slug: string
  budgetDown: number
  message: string
}

const thaiPhone = /^0\d{8,9}$/

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30),
  slug: z.string().trim().max(120),
  budgetDown: z.coerce.number().min(0).max(100_000_000).default(0),
  message: z.string().trim().max(500).default(""),
  website: z.string().optional(),   // honeypot — คนจริงไม่เห็นช่องนี้
})

export function parseLead(body: unknown): { ok: true; data: LeadInput } | { ok: false; error: string } {
  const parsed = leadSchema.safeParse(body)
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง" }
  const v = parsed.data
  if (v.website) return { ok: false, error: "rejected" }          // บอทกรอก honeypot
  const phone = v.phone.replace(/[^0-9]/g, "")
  if (!thaiPhone.test(phone)) return { ok: false, error: "เบอร์โทรไม่ถูกต้อง" }
  return {
    ok: true,
    data: { name: v.name, phone, slug: v.slug, budgetDown: v.budgetDown, message: v.message.slice(0, 500) },
  }
}

// rate limit ในหน่วยความจำ — พอสำหรับ P0 (รีเซ็ตเมื่อ instance รีสตาร์ต ยอมรับได้)
const HITS = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000
const LIMIT = 5

export function allowRequest(ip: string, now = Date.now()): boolean {
  const hits = (HITS.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= LIMIT) { HITS.set(ip, hits); return false }
  hits.push(now)
  HITS.set(ip, hits)
  return true
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/public-lead.test.ts`
Expected: PASS ทั้ง 9 เคส

- [ ] **Step 5: สร้าง API รับ lead**

`app/api/public/leads/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { parseLead, allowRequest } from "@/lib/public-lead"
import { loadPublicTruckBySlug } from "@/lib/public-trucks"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!allowRequest(ip)) {
    return NextResponse.json({ error: "ส่งคำขอถี่เกินไป กรุณาลองใหม่ภายหลัง" }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = parseLead(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const lead = parsed.data

  // แนบข้อมูลรถจากฝั่ง server เท่านั้น (ห้ามเชื่อราคาที่ client ส่งมา)
  const truck = lead.slug ? await loadPublicTruckBySlug(lead.slug) : null
  const now = new Date().toISOString()
  const db = (await clientPromise).db(DB)

  await db.collection("quotations").insertOne({
    quotationNo: "",                       // ยังไม่ออกเลขใบเสนอ — ออกตอนทีมขายแปลงเป็นใบจริง
    status: "lead",
    source: "public-listing",
    publicSlug: lead.slug,
    customerName: lead.name,
    customerPhone: lead.phone,
    vehicleBrand: truck?.brand ?? "",
    vehicleModel: truck?.model ?? "",
    truckNumber: truck?.truckNumber ?? "",
    vehiclePhotoUrl: truck?.photoUrl ?? "",
    totalSalePrice: truck?.totalSalePrice ?? 0,
    downPayment: truck?.downPayment ?? 0,
    monthlyPayment: truck?.monthlyPayment ?? 0,
    financeInstallments: truck?.financeInstallments ?? 0,
    cashDown: lead.budgetDown,
    note: lead.message,
    salesEmail: "", salesName: "",
    createdAt: now, updatedAt: now,
    timeline: [{ at: now, by: "public-listing", action: "ลูกค้ากรอกฟอร์มจากหน้าเว็บ" }],
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: สร้างฟอร์ม**

`components/public/lead-form.tsx`:

```tsx
"use client"

import { useState } from "react"

export function LeadForm({ slug }: { slug: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState("sending"); setError("")
    const fd = new FormData(e.currentTarget)
    const res = await fetch("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        name: fd.get("name"), phone: fd.get("phone"),
        budgetDown: fd.get("budgetDown") || 0, message: fd.get("message") || "",
        website: fd.get("website") || "",
      }),
    })
    if (res.ok) { setState("done"); return }
    const j = await res.json().catch(() => ({}))
    setError(j.error ?? "ส่งไม่สำเร็จ กรุณาโทรหาเราโดยตรง")
    setState("idle")
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
        <p className="font-semibold text-emerald-800">ได้รับข้อมูลแล้ว ขอบคุณครับ</p>
        <p className="text-emerald-700 mt-1">ฝ่ายขายจะติดต่อกลับภายในวันทำการถัดไป</p>
      </div>
    )
  }

  const field = "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-zinc-200 p-5 space-y-3">
      <p className="font-semibold">ขอใบเสนอราคา / ให้ติดต่อกลับ</p>
      <input name="name" required placeholder="ชื่อ-นามสกุล" className={field} />
      <input name="phone" required inputMode="tel" placeholder="เบอร์โทร (เช่น 0812345678)" className={field} />
      <input name="budgetDown" inputMode="numeric" placeholder="เงินดาวน์ที่มี (บาท)" className={field} />
      <textarea name="message" rows={3} placeholder="ข้อความถึงฝ่ายขาย (ไม่บังคับ)" className={field} />
      {/* honeypot — ซ่อนจากคน บอทมักกรอก */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={state === "sending"} className="w-full rounded-xl bg-zinc-900 text-white font-semibold py-3 disabled:opacity-50">
        {state === "sending" ? "กำลังส่ง…" : "ส่งข้อมูลให้ฝ่ายขาย"}
      </button>
      <p className="text-[11px] text-zinc-400">ข้อมูลของคุณใช้เพื่อติดต่อกลับเรื่องรถคันนี้เท่านั้น</p>
    </form>
  )
}
```

- [ ] **Step 7: วางฟอร์มในหน้า detail**

`app/(public)/trucks/[slug]/page.tsx` — เพิ่ม `import { LeadForm } from "@/components/public/lead-form"` และวางใต้บล็อกสเปก (ในคอลัมน์ขวา):

```tsx
          <div className="mt-6">
            <LeadForm slug={truck.slug} />
          </div>
```

- [ ] **Step 8: ทดสอบ end-to-end**

```bash
curl -s -X POST http://localhost:3000/api/public/leads -H "Content-Type: application/json" \
  -d '{"name":"ทดสอบ ระบบ","phone":"0812345678","slug":"<slug จริง>","budgetDown":200000,"message":"ทดสอบจากสคริปต์"}'
```
Expected: `{"ok":true}` แล้วเปิด `/quotations` (login) เห็นการ์ด lead ชื่อ "ทดสอบ ระบบ" ในคอลัมน์ lead
จากนั้นทดสอบ honeypot: ส่งซ้ำโดยเพิ่ม `"website":"spam"` → ต้องได้ 400
⚠️ lead ทดสอบเป็นข้อมูลจริงใน prod DB — ลบทิ้งหลังตรวจเสร็จ (แจ้งผู้ใช้ก่อนลบตามกติกา DB safety)

- [ ] **Step 9: Commit**

```bash
git add lib/public-lead.ts lib/public-lead.test.ts app/api/public/leads components/public/lead-form.tsx "app/(public)/trucks/[slug]/page.tsx"
git commit -m "feat(public): ฟอร์มขอใบเสนอราคา → lead เข้า /quotations (honeypot + rate limit + validate เบอร์ไทย)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

---

### Task 10: ตรวจรับรวม + เอกสาร

**Files:**
- Create: `docs/PUBLIC-LISTING.md`
- Modify: `README.md` (ถ้ามีหัวข้อโครงสร้างหน้า — เพิ่มบรรทัดชี้ไปเอกสารใหม่)

**Interfaces:**
- Consumes: ทุก task ก่อนหน้า
- Produces: เอกสารวิธีดูแล (เพิ่มรถขึ้นเว็บ, เปลี่ยนข้อความ, ย้ายโดเมน)

- [ ] **Step 1: รันชุดตรวจทั้งหมด**

```bash
npm test && npx tsc --noEmit && npx next build
```
Expected: เทสต์ผ่านหมด (เดิม + ใหม่ ~31 เคส), tsc เงียบ, build สำเร็จและเห็น route `/trucks`, `/trucks/[slug]`, `/sitemap.xml`, `/robots.txt`, `/og/truck/[slug]`, `/api/public/…`

- [ ] **Step 2: ตรวจว่าไม่มีข้อมูลต้องห้ามหลุด (สำคัญที่สุด)**

```bash
npm run dev
curl -s http://localhost:3000/api/public/trucks > /tmp/pub.json
for k in licensePlate chassisNumber engineNumber registrationDocUrl contractCode driverName saleStatus _id; do
  printf "%-20s %s\n" "$k" "$(grep -c "$k" /tmp/pub.json)"
done
curl -s "http://localhost:3000/trucks/<slug จริง>" | grep -cE "สบ\.|[0-9]{2}-[0-9]{4}"
```
Expected: ทุก key นับได้ **0** และหน้า HTML นับทะเบียนได้ **0**

- [ ] **Step 3: ตรวจว่าระบบภายในยังปิดอยู่**

```bash
for p in / /drivers /payroll /vehicle-cost /catalog /admin/users; do
  printf "%-16s %s\n" "$p" "$(curl -s -o /dev/null -w "%{http_code}" -L "http://localhost:3000$p" -c /dev/null)"
done
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/drivers
```
Expected: หน้าเว็บทั้งหมด redirect ไป `/login` (200 ที่หน้า login), `/api/drivers` = 401

- [ ] **Step 4: ตรวจ SEO ด้วยเครื่องมือจริง**

- วาง JSON-LD จาก `curl -s http://localhost:3000/trucks/<slug> | grep -A1 ld+json` ลง https://search.google.com/test/rich-results → ต้องไม่มี error
- เปิด `/tmp/og.png` ดูว่าไทยไม่เป็นสี่เหลี่ยม

- [ ] **Step 5: เขียนเอกสารวิธีดูแล**

`docs/PUBLIC-LISTING.md` — ครอบคลุม:

```markdown
# หน้าเว็บขายรถสาธารณะ /trucks

## รถขึ้นเว็บได้อย่างไร
รถจะโผล่บน /trucks อัตโนมัติเมื่อครบ 3 ข้อ:
1. `vehicle_master.status` ไม่ใช่ `inactive`
2. ไม่มีสัญญา (`contracts`) status `active` ที่ทะเบียนนั้น
3. `master_price_list.saleStatus === "ready"` (ตั้งที่หน้า ราคาขาย)

รถคันใหม่ที่เพิ่งพร้อมขาย: รัน `node scripts/backfill-public-slug.mjs` (dry-run) แล้ว `--apply`
เพื่อออก URL ถาวรให้ (ไม่รันก็ขึ้นเว็บได้ แต่ URL จะคำนวณสดและอาจเปลี่ยนถ้าแก้ยี่ห้อ/รุ่น)

## แก้ข้อความบนหน้าเว็บ
จุดขาย/เงื่อนไข/ชื่อ-เบอร์ฝ่ายขาย = หน้า /catalog → ปุ่มตั้งค่า template (เก็บใน `catalog_config`)
แก้แล้วหน้าเว็บอัปเดตภายใน 10 นาที (ISR revalidate 600)

## รูป
อัปที่หน้า /vehicles → ช่องรูป 5 มุม (หน้า/หลัง/ซ้าย/ขวา/ห้องโดยสาร)
รูปแรก (หน้า) ใช้เป็นรูปการ์ดและรูปตอนแชร์ LINE

## lead จากหน้าเว็บ
เข้า `quotations` (status `lead`, source `public-listing`) → เห็นใน /quotations คอลัมน์ lead

## ย้ายโดเมน
ตั้ง env `NEXT_PUBLIC_SITE_URL=https://menatransport.co.th` แล้ว redeploy —
canonical/OG/sitemap เปลี่ยนตามทั้งหมด จากนั้นทำ 301 จากโดเมนเดิม

## ข้อมูลที่ห้ามออกสู่หน้าเว็บ
ทะเบียนจริง, เลขตัวถัง, เลขเครื่อง, สำเนาทะเบียน, ชื่อ พขร., ต้นทุน
บังคับด้วย `toPublicTruck()` ใน lib/public-trucks.ts + เทสต์ allowlist —
**เพิ่ม field ใหม่ต้องแก้เทสต์ด้วยเสมอ**
```

- [ ] **Step 6: Commit**

```bash
git add docs/PUBLIC-LISTING.md
git commit -m "docs: วิธีดูแลหน้าเว็บขายรถสาธารณะ /trucks

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hg43VnKhrcBNvPeUXYKmFe"
```

- [ ] **Step 7: หยุดถามผู้ใช้ก่อน deploy**

สรุปให้ผู้ใช้: จำนวนรถที่จะขึ้นเว็บ, จำนวนคันที่ยังไม่มีรูป, URL ตัวอย่าง แล้วถามก่อน push/deploy
(ตามกติกา: commit local ได้ แต่ push/deploy ต้องขออนุมัติทุกครั้ง)

---

## หมายเหตุสำหรับผู้ execute

- **ห้าม `git add -A`** — repo มี `Mixer.rar`, ไฟล์ .xlsx/.pdf untracked ที่ห้ามคอมมิต ระบุ path เสมอ
- **Task 4 Step 3 และ Task 10 Step 7 คือจุดหยุดบังคับ** (แตะ prod DB / deploy) — ต้องรออนุมัติจากผู้ใช้
- รูปรถยังขาด 17 จาก 18 คัน — หน้าเว็บจะดูโล่งจนกว่าจะถ่ายรูปเพิ่ม เป็นข้อจำกัดที่รู้อยู่แล้ว ไม่ใช่บั๊ก
- ถ้า `npx next build` ล้มเรื่อง `useSearchParams` ต้องห่อ `<Suspense>` (บทเรียนเดิมของโปรเจกต์ — Turbopack prod เข้มกว่า dev)
