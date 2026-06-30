# Promo Repair + PM Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the โปรโมชั่น ซ่อม+PM module — API routes and pages for tracking Promo 2 (lifetime repair budget pool) and Promo 3 (annual PM1/PM2 coupon + annual cap) per truck.

**Architecture:** 3 new collections (`promo_config`, `repair_claims`, `pm_records`) already seeded. 6 API routes + 2 pages. Auth: all authenticated users can read and write (no admin-only restriction for this module — middleware already handles session check globally).

**Tech Stack:** Next.js 15 App Router · TypeScript · shadcn/ui (v4.12.0, `@base-ui/react`) · MongoDB (`mena_partner` db) · next-auth v4

## Global Constraints

- Next.js 15 App Router; dynamic params are async: `const { contractCode } = await params`
- TypeScript strict; `npx tsc --noEmit` must pass
- shadcn/ui v4.12.0 uses `@base-ui/react` — NOT `@radix-ui`
- MongoDB: `client.db("mena_partner")` via `lib/mongo.ts`; never include `_id` in `$set`; strip `_id` from body before insert/update
- Mandatory client-side fetch pattern:
  ```ts
  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/...")
      if (r.ok) setData(await r.json())
      else setData([])
    } catch { setData([]) }
    finally { setLoading(false) }
  }
  load()
  ```
- `setLoading(false)` must be in `finally`, never only in `.then()`
- All error-prone fetches: check `r.ok` before calling `.json()`
- Thai language labels throughout
- Auth: all authenticated users can read AND write this module (no role check needed — middleware handles session; do NOT add admin-gate checks in these pages)
- Month format: `"YYYY-MM"` where used; Buddhist year = Gregorian + 543
- `formatMoney(n: number): string` from `lib/utils.ts` — use for all money display

---

## Data Shape Reference

**`promo_config` documents** (already in DB):
```ts
{
  _id: ObjectId,
  contractCode: string,   // may be absent for unmatched trucks
  licensePlate: string,
  repairBudget: number,   // Promo 2 lifetime ceiling
  pmOilCost: number,      // 500 fixed
  annualPmCap: number,    // Promo 3 annual ceiling
  createdAt: Date
}
```

**`repair_claims` documents**:
```ts
{
  _id: ObjectId,
  contractCode: string,
  date: string,           // "YYYY-MM-DD" (ISO date string from <input type="date">)
  description: string,
  amount: number,
  createdAt: Date
}
```

**`pm_records` documents**:
```ts
{
  _id: ObjectId,
  contractCode: string,
  year: number,           // Gregorian year e.g. 2026
  type: "PM1" | "PM2",
  date: string,           // "YYYY-MM-DD"
  amount: number,
  notes: string,
  createdAt: Date
}
```

---

## Types to Add (in `types/index.ts`)

```ts
export interface PromoConfig {
  _id?: string
  contractCode?: string
  licensePlate: string
  repairBudget: number
  pmOilCost: number
  annualPmCap: number
  createdAt?: string
}

export interface RepairClaim {
  _id?: string
  contractCode: string
  date: string
  description: string
  amount: number
  createdAt?: string
}

export interface PmRecord {
  _id?: string
  contractCode: string
  year: number
  type: "PM1" | "PM2"
  date: string
  amount: number
  notes: string
  createdAt?: string
}

export interface PromoSummaryRow {
  contractCode: string
  licensePlate: string
  driverName: string
  truckNumber: string
  repairBudget: number
  repairUsed: number
  repairRemaining: number
  annualPmCap: number
  pmUsedThisYear: number
  pmRemainingThisYear: number
  pm1UsedThisYear: boolean
  pm2UsedThisYear: boolean
}

export interface PromoDetail extends PromoSummaryRow {
  pmOilCost: number
  repairClaims: RepairClaim[]
  pmRecords: PmRecord[]
}
```

---

## File Map

**New files:**
- `types/index.ts` — add 5 interfaces above (modify existing)
- `app/api/promotions/route.ts` — GET list
- `app/api/promotions/[contractCode]/route.ts` — GET detail
- `app/api/promotions/repair/route.ts` — POST repair claim
- `app/api/promotions/repair/[id]/route.ts` — DELETE repair claim
- `app/api/promotions/pm/route.ts` — POST PM record
- `app/api/promotions/pm/[id]/route.ts` — DELETE PM record
- `app/promotions/page.tsx` — overview table
- `app/promotions/[contractCode]/page.tsx` — detail page

**Modified files:**
- `components/sidebar.tsx` — add "โปรโมชั่น" nav link

---

### Task 1: Types + API routes (GET list + GET detail)

**Files:**
- Modify: `types/index.ts`
- Create: `app/api/promotions/route.ts`
- Create: `app/api/promotions/[contractCode]/route.ts`

**Interfaces:**
- Produces: `GET /api/promotions` → `PromoSummaryRow[]`
- Produces: `GET /api/promotions/[contractCode]` → `PromoDetail`

- [ ] **Step 1: Add types to `types/index.ts`**

Append these 5 interfaces at the end of the file:
```ts
export interface PromoConfig {
  _id?: string
  contractCode?: string
  licensePlate: string
  repairBudget: number
  pmOilCost: number
  annualPmCap: number
  createdAt?: string
}

export interface RepairClaim {
  _id?: string
  contractCode: string
  date: string
  description: string
  amount: number
  createdAt?: string
}

export interface PmRecord {
  _id?: string
  contractCode: string
  year: number
  type: "PM1" | "PM2"
  date: string
  amount: number
  notes: string
  createdAt?: string
}

export interface PromoSummaryRow {
  contractCode: string
  licensePlate: string
  driverName: string
  truckNumber: string
  repairBudget: number
  repairUsed: number
  repairRemaining: number
  annualPmCap: number
  pmUsedThisYear: number
  pmRemainingThisYear: number
  pm1UsedThisYear: boolean
  pm2UsedThisYear: boolean
}

export interface PromoDetail extends PromoSummaryRow {
  pmOilCost: number
  repairClaims: RepairClaim[]
  pmRecords: PmRecord[]
}
```

- [ ] **Step 2: Create `app/api/promotions/route.ts`**

GET /api/promotions — list all trucks with computed promo status.

Business logic:
- `currentYear = new Date().getFullYear()`
- For each promo_config doc (that has a contractCode):
  - Join driver info from `drivers` collection by contractCode
  - `repairUsed = SUM(repair_claims.amount WHERE contractCode = X)`
  - `pmUsedThisYear = SUM(pm_records.amount WHERE contractCode = X AND year = currentYear)`
  - `pm1UsedThisYear = COUNT(pm_records WHERE type="PM1" AND year=currentYear) > 0`
  - `pm2UsedThisYear = COUNT(pm_records WHERE type="PM2" AND year=currentYear) > 0`

Use MongoDB aggregation for efficiency. Sort by contractCode ascending.

```ts
import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

export async function GET() {
  const client = await clientPromise
  const db = client.db("mena_partner")
  const currentYear = new Date().getFullYear()

  // All promo configs that have a contractCode
  const configs = await db
    .collection("promo_config")
    .find({ contractCode: { $exists: true, $ne: "" } })
    .sort({ contractCode: 1 })
    .toArray()

  const contractCodes = configs.map((c) => c.contractCode as string)

  // Batch fetch drivers
  const drivers = await db
    .collection("drivers")
    .find({ contractCode: { $in: contractCodes } })
    .toArray()
  const driverMap = Object.fromEntries(drivers.map((d) => [d.contractCode, d]))

  // Batch fetch repair claim totals
  const repairAgg = await db
    .collection("repair_claims")
    .aggregate([
      { $match: { contractCode: { $in: contractCodes } } },
      { $group: { _id: "$contractCode", total: { $sum: "$amount" } } },
    ])
    .toArray()
  const repairMap = Object.fromEntries(repairAgg.map((r) => [r._id, r.total]))

  // Batch fetch PM totals this year + coupon status
  const pmAgg = await db
    .collection("pm_records")
    .aggregate([
      { $match: { contractCode: { $in: contractCodes }, year: currentYear } },
      {
        $group: {
          _id: "$contractCode",
          total: { $sum: "$amount" },
          types: { $addToSet: "$type" },
        },
      },
    ])
    .toArray()
  const pmMap = Object.fromEntries(
    pmAgg.map((p) => [p._id, { total: p.total, types: p.types as string[] }])
  )

  const rows = configs.map((cfg) => {
    const code = cfg.contractCode as string
    const driver = driverMap[code] ?? {}
    const repairUsed = repairMap[code] ?? 0
    const pm = pmMap[code] ?? { total: 0, types: [] }
    return {
      contractCode: code,
      licensePlate: cfg.licensePlate ?? "",
      driverName: driver.driverName ?? "",
      truckNumber: driver.truckNumber ?? "",
      repairBudget: cfg.repairBudget ?? 0,
      repairUsed,
      repairRemaining: (cfg.repairBudget ?? 0) - repairUsed,
      annualPmCap: cfg.annualPmCap ?? 0,
      pmUsedThisYear: pm.total,
      pmRemainingThisYear: (cfg.annualPmCap ?? 0) - pm.total,
      pm1UsedThisYear: pm.types.includes("PM1"),
      pm2UsedThisYear: pm.types.includes("PM2"),
    }
  })

  return NextResponse.json(rows)
}
```

- [ ] **Step 3: Create `app/api/promotions/[contractCode]/route.ts`**

GET /api/promotions/[contractCode] — single truck detail.

```ts
import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contractCode: string }> }
) {
  const { contractCode } = await params
  const client = await clientPromise
  const db = client.db("mena_partner")
  const currentYear = new Date().getFullYear()

  const cfg = await db.collection("promo_config").findOne({ contractCode })
  if (!cfg) return NextResponse.json({ error: "not found" }, { status: 404 })

  const driver = await db.collection("drivers").findOne({ contractCode })

  const repairClaims = await db
    .collection("repair_claims")
    .find({ contractCode })
    .sort({ date: -1 })
    .toArray()

  const pmRecords = await db
    .collection("pm_records")
    .find({ contractCode })
    .sort({ year: -1, date: -1 })
    .toArray()

  const repairUsed = repairClaims.reduce((s, c) => s + (c.amount ?? 0), 0)
  const pmThisYear = pmRecords.filter((p) => p.year === currentYear)
  const pmUsedThisYear = pmThisYear.reduce((s, p) => s + (p.amount ?? 0), 0)
  const pm1Used = pmThisYear.some((p) => p.type === "PM1")
  const pm2Used = pmThisYear.some((p) => p.type === "PM2")

  const toPlain = (doc: Record<string, unknown>) => ({
    ...doc,
    _id: doc._id?.toString(),
  })

  return NextResponse.json({
    contractCode,
    licensePlate: cfg.licensePlate ?? "",
    driverName: driver?.driverName ?? "",
    truckNumber: driver?.truckNumber ?? "",
    repairBudget: cfg.repairBudget ?? 0,
    pmOilCost: cfg.pmOilCost ?? 0,
    repairUsed,
    repairRemaining: (cfg.repairBudget ?? 0) - repairUsed,
    annualPmCap: cfg.annualPmCap ?? 0,
    pmUsedThisYear,
    pmRemainingThisYear: (cfg.annualPmCap ?? 0) - pmUsedThisYear,
    pm1UsedThisYear: pm1Used,
    pm2UsedThisYear: pm2Used,
    repairClaims: repairClaims.map(toPlain),
    pmRecords: pmRecords.map(toPlain),
  })
}
```

- [ ] **Step 4: Run tsc and verify**

```bash
cd /Users/menatransport_02/Documents/project/mena-partner-driver
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts app/api/promotions/
git commit -m "feat: add promo types and GET API routes"
```

---

### Task 2: Write API routes (POST + DELETE)

**Files:**
- Create: `app/api/promotions/repair/route.ts`
- Create: `app/api/promotions/repair/[id]/route.ts`
- Create: `app/api/promotions/pm/route.ts`
- Create: `app/api/promotions/pm/[id]/route.ts`

**Interfaces:**
- Consumes: RepairClaim, PmRecord from `types/index.ts`
- No admin restriction — all authenticated users can write

- [ ] **Step 1: Create `app/api/promotions/repair/route.ts`**

```ts
import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

export async function POST(req: Request) {
  const body = await req.json()
  const { contractCode, date, description, amount } = body
  if (!contractCode || !date || !description || amount == null) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 })
  }
  const client = await clientPromise
  const db = client.db("mena_partner")
  const doc = {
    contractCode: String(contractCode),
    date: String(date),
    description: String(description),
    amount: Number(amount),
    createdAt: new Date(),
  }
  const result = await db.collection("repair_claims").insertOne(doc)
  return NextResponse.json({ _id: result.insertedId.toString(), ...doc }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/promotions/repair/[id]/route.ts`**

```ts
import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let oid: ObjectId
  try { oid = new ObjectId(id) } catch {
    return NextResponse.json({ error: "invalid id" }, { status: 400 })
  }
  const client = await clientPromise
  const db = client.db("mena_partner")
  const result = await db.collection("repair_claims").deleteOne({ _id: oid })
  if (result.deletedCount === 0) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `app/api/promotions/pm/route.ts`**

```ts
import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

export async function POST(req: Request) {
  const body = await req.json()
  const { contractCode, year, type, date, amount, notes } = body
  if (!contractCode || !year || !type || !date || amount == null) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 })
  }
  if (type !== "PM1" && type !== "PM2") {
    return NextResponse.json({ error: "type must be PM1 or PM2" }, { status: 400 })
  }
  const client = await clientPromise
  const db = client.db("mena_partner")
  const doc = {
    contractCode: String(contractCode),
    year: Number(year),
    type: type as "PM1" | "PM2",
    date: String(date),
    amount: Number(amount),
    notes: String(notes ?? ""),
    createdAt: new Date(),
  }
  const result = await db.collection("pm_records").insertOne(doc)
  return NextResponse.json({ _id: result.insertedId.toString(), ...doc }, { status: 201 })
}
```

- [ ] **Step 4: Create `app/api/promotions/pm/[id]/route.ts`**

```ts
import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let oid: ObjectId
  try { oid = new ObjectId(id) } catch {
    return NextResponse.json({ error: "invalid id" }, { status: 400 })
  }
  const client = await clientPromise
  const db = client.db("mena_partner")
  const result = await db.collection("pm_records").deleteOne({ _id: oid })
  if (result.deletedCount === 0) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Run tsc**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/promotions/repair/ app/api/promotions/pm/
git commit -m "feat: add promo repair and PM write API routes"
```

---

### Task 3: Promotions overview page + sidebar link

**Files:**
- Create: `app/promotions/page.tsx`
- Modify: `components/sidebar.tsx`

**Interfaces:**
- Consumes: `GET /api/promotions` → `PromoSummaryRow[]`

The page shows:
- Search bar (filter by contractCode / licensePlate / driverName client-side)
- Table columns: ทะเบียน | เบอร์รถ | ชื่อคนขับ | โปร 2 วงเงิน | ใช้ไป | คงเหลือ | โปร 3 PM1 | PM2 | งบคงเหลือปีนี้
- Progress bar for repair budget (repairUsed / repairBudget)
- Badge for PM1/PM2: "ใช้แล้ว" (green) / "ยังไม่ได้ใช้" (gray)
- Click row → navigate to `/promotions/[contractCode]`

- [ ] **Step 1: Create `app/promotions/page.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PromoSummaryRow } from "@/types"
import { formatMoney } from "@/lib/utils"

export default function PromotionsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<PromoSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const r = await fetch("/api/promotions")
        if (r.ok) setRows(await r.json())
        else setRows([])
      } catch { setRows([]) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = rows.filter((row) =>
    [row.contractCode, row.licensePlate, row.driverName]
      .some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">โปรโมชั่น ซ่อม+PM</h1>
      </div>

      <input
        className="border rounded px-3 py-1.5 text-sm w-72"
        placeholder="ค้นหา รหัส / ทะเบียน / ชื่อ"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">ทะเบียน</th>
              <th className="text-left px-3 py-2">เบอร์รถ</th>
              <th className="text-left px-3 py-2">ชื่อคนขับ</th>
              <th className="text-right px-3 py-2">โปร 2 วงเงิน</th>
              <th className="text-right px-3 py-2">ใช้ไป</th>
              <th className="text-left px-3 py-2 min-w-[140px]">คงเหลือ</th>
              <th className="text-center px-3 py-2">PM1</th>
              <th className="text-center px-3 py-2">PM2</th>
              <th className="text-right px-3 py-2">งบ PM คงเหลือ/ปี</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</td></tr>
            ) : filtered.map((row) => {
              const pct = row.repairBudget > 0
                ? Math.min(100, (row.repairUsed / row.repairBudget) * 100)
                : 0
              return (
                <tr
                  key={row.contractCode}
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/promotions/${row.contractCode}`)}
                >
                  <td className="px-3 py-2 font-mono">{row.licensePlate}</td>
                  <td className="px-3 py-2">{row.truckNumber}</td>
                  <td className="px-3 py-2">{row.driverName}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.repairBudget)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.repairUsed)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-green-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs w-20 text-right">{formatMoney(row.repairRemaining)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.pm1UsedThisYear ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {row.pm1UsedThisYear ? "ใช้แล้ว" : "ยังไม่ได้ใช้"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.pm2UsedThisYear ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {row.pm2UsedThisYear ? "ใช้แล้ว" : "ยังไม่ได้ใช้"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.pmRemainingThisYear)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add "โปรโมชั่น" to sidebar**

Read `components/sidebar.tsx`. Find the nav links array. Add:
```ts
{ href: "/promotions", label: "โปรโมชั่น", icon: <ShieldCheck className="h-4 w-4" /> }
```
Import `ShieldCheck` from `lucide-react` at the top if not already imported.

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/promotions/page.tsx components/sidebar.tsx
git commit -m "feat: add promotions overview page and sidebar link"
```

---

### Task 4: Promotion detail page

**Files:**
- Create: `app/promotions/[contractCode]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/promotions/[contractCode]` → `PromoDetail`
- Consumes: `POST /api/promotions/repair` body: `{ contractCode, date, description, amount }`
- Consumes: `DELETE /api/promotions/repair/[id]`
- Consumes: `POST /api/promotions/pm` body: `{ contractCode, year, type, date, amount, notes }`
- Consumes: `DELETE /api/promotions/pm/[id]`

The page has two sections:
**Section 1 — โปร 2 ค่าซ่อม:**
- Progress bar: repairUsed / repairBudget with % used
- Repair claims table: date | รายละเอียด | ยอด | ลบ
- "บันทึกการซ่อม" inline form: date, description, amount → POST

**Section 2 — โปร 3 PM:**
- PM coupon status (current year): PM1 badge + PM2 badge
- Annual budget bar: pmUsedThisYear / annualPmCap
- PM history table: ปี | ประเภท | วันที่ | ยอด | หมายเหตุ | ลบ
- "บันทึก PM" inline form: year (default current), type (PM1/PM2 select), date, amount, notes → POST

All mutations: re-fetch detail after success (call load() again).
No confirm dialogs needed (simple delete buttons).

- [ ] **Step 1: Create `app/promotions/[contractCode]/page.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { PromoDetail, RepairClaim, PmRecord } from "@/types"
import { formatMoney } from "@/lib/utils"

export default function PromoDetailPage() {
  const { contractCode } = useParams<{ contractCode: string }>()
  const [data, setData] = useState<PromoDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Repair form state
  const [rDate, setRDate] = useState("")
  const [rDesc, setRDesc] = useState("")
  const [rAmt, setRAmt] = useState("")
  const [rSaving, setRSaving] = useState(false)

  // PM form state
  const currentYear = new Date().getFullYear()
  const [pmYear, setPmYear] = useState(String(currentYear))
  const [pmType, setPmType] = useState<"PM1" | "PM2">("PM1")
  const [pmDate, setPmDate] = useState("")
  const [pmAmt, setPmAmt] = useState("")
  const [pmNotes, setPmNotes] = useState("")
  const [pmSaving, setPmSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/promotions/${contractCode}`)
      if (r.ok) setData(await r.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [contractCode])

  const handleRepairSave = async () => {
    if (!rDate || !rDesc || !rAmt) return
    setRSaving(true)
    try {
      const r = await fetch("/api/promotions/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractCode, date: rDate, description: rDesc, amount: Number(rAmt) }),
      })
      if (r.ok) { setRDate(""); setRDesc(""); setRAmt(""); await load() }
    } catch {} finally { setRSaving(false) }
  }

  const handleRepairDelete = async (id: string) => {
    try {
      const r = await fetch(`/api/promotions/repair/${id}`, { method: "DELETE" })
      if (r.ok) await load()
    } catch {}
  }

  const handlePmSave = async () => {
    if (!pmDate || !pmAmt) return
    setPmSaving(true)
    try {
      const r = await fetch("/api/promotions/pm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractCode, year: Number(pmYear), type: pmType, date: pmDate, amount: Number(pmAmt), notes: pmNotes }),
      })
      if (r.ok) { setPmDate(""); setPmAmt(""); setPmNotes(""); await load() }
    } catch {} finally { setPmSaving(false) }
  }

  const handlePmDelete = async (id: string) => {
    try {
      const r = await fetch(`/api/promotions/pm/${id}`, { method: "DELETE" })
      if (r.ok) await load()
    } catch {}
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
  if (!data) return <div className="p-8 text-center text-muted-foreground">ไม่พบข้อมูล</div>

  const repairPct = data.repairBudget > 0 ? Math.min(100, (data.repairUsed / data.repairBudget) * 100) : 0
  const pmPct = data.annualPmCap > 0 ? Math.min(100, (data.pmUsedThisYear / data.annualPmCap) * 100) : 0

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{data.driverName || data.contractCode}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.contractCode} · {data.licensePlate} · {data.truckNumber}
        </p>
      </div>

      {/* Section 1: Promo 2 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">🔧 โปร 2 — ค่าซ่อมบำรุง (ตลอดสัญญา)</h2>

        {/* Budget bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>ใช้ไป {formatMoney(data.repairUsed)}</span>
            <span>วงเงิน {formatMoney(data.repairBudget)}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${repairPct >= 90 ? "bg-red-500" : repairPct >= 60 ? "bg-amber-500" : "bg-green-500"}`}
              style={{ width: `${repairPct}%` }}
            />
          </div>
          <p className="text-sm text-right">คงเหลือ <span className="font-semibold">{formatMoney(data.repairRemaining)}</span></p>
        </div>

        {/* Repair claims table */}
        <div className="rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">วันที่</th>
                <th className="text-left px-3 py-2">รายละเอียด</th>
                <th className="text-right px-3 py-2">ยอด</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.repairClaims.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">ยังไม่มีรายการซ่อม</td></tr>
              ) : data.repairClaims.map((c: RepairClaim) => (
                <tr key={c._id} className="border-t">
                  <td className="px-3 py-2">{c.date}</td>
                  <td className="px-3 py-2">{c.description}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(c.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleRepairDelete(c._id!)} className="text-red-500 hover:text-red-700 text-xs">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add repair form */}
        <div className="border rounded p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">บันทึกการซ่อม</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">วันที่ซ่อม</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={rDate} onChange={e => setRDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">รายละเอียด</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="เช่น เปลี่ยนปะเก็น" value={rDesc} onChange={e => setRDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ยอด (บาท)</label>
              <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="0" value={rAmt} onChange={e => setRAmt(e.target.value)} />
            </div>
          </div>
          <button
            onClick={handleRepairSave}
            disabled={rSaving || !rDate || !rDesc || !rAmt}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {rSaving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </section>

      {/* Section 2: Promo 3 PM */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">🛠 โปร 3 — PM เชิงป้องกัน (รายปี รีเซ็ตทุก 1 ม.ค.)</h2>

        {/* Coupon badges */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">PM1 ปีนี้:</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${data.pm1UsedThisYear ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {data.pm1UsedThisYear ? "✓ ใช้แล้ว" : "ยังไม่ได้ใช้"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">PM2 ปีนี้:</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${data.pm2UsedThisYear ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {data.pm2UsedThisYear ? "✓ ใช้แล้ว" : "ยังไม่ได้ใช้"}
            </span>
          </div>
        </div>

        {/* Annual budget bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>ใช้ไปปีนี้ {formatMoney(data.pmUsedThisYear)}</span>
            <span>เพดานปี {formatMoney(data.annualPmCap)}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pmPct >= 90 ? "bg-red-500" : pmPct >= 60 ? "bg-amber-500" : "bg-blue-500"}`}
              style={{ width: `${pmPct}%` }}
            />
          </div>
          <p className="text-sm text-right">คงเหลือปีนี้ <span className="font-semibold">{formatMoney(data.pmRemainingThisYear)}</span></p>
        </div>

        {/* PM history table */}
        <div className="rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">ปี</th>
                <th className="text-left px-3 py-2">ประเภท</th>
                <th className="text-left px-3 py-2">วันที่</th>
                <th className="text-right px-3 py-2">ยอด</th>
                <th className="text-left px-3 py-2">หมายเหตุ</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.pmRecords.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">ยังไม่มีบันทึก PM</td></tr>
              ) : data.pmRecords.map((p: PmRecord) => (
                <tr key={p._id} className="border-t">
                  <td className="px-3 py-2">{p.year}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type === "PM1" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">{p.date}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(p.amount)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.notes}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handlePmDelete(p._id!)} className="text-red-500 hover:text-red-700 text-xs">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add PM form */}
        <div className="border rounded p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">บันทึก PM</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">ปี (คริสต์ศักราช)</label>
              <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={pmYear} onChange={e => setPmYear(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ประเภท</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={pmType} onChange={e => setPmType(e.target.value as "PM1" | "PM2")}>
                <option value="PM1">PM1</option>
                <option value="PM2">PM2</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">วันที่ทำ PM</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={pmDate} onChange={e => setPmDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ยอด (บาท)</label>
              <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="0" value={pmAmt} onChange={e => setPmAmt(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">หมายเหตุ</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="หมายเหตุ (ถ้ามี)" value={pmNotes} onChange={e => setPmNotes(e.target.value)} />
            </div>
          </div>
          <button
            onClick={handlePmSave}
            disabled={pmSaving || !pmDate || !pmAmt}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {pmSaving ? "กำลังบันทึก..." : "บันทึก PM"}
          </button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/promotions/
git commit -m "feat: add promotions detail page"
```

---

## Post-implementation

After all 4 tasks complete and reviewed:
1. Push to GitHub: `git push origin master`
2. Run setup-indexes if not done: `npx tsx scripts/setup-indexes.ts`
