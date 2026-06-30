# Mena Partner Driver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a MERN-style (Next.js + MongoDB) web application for managing monthly payroll of partner mixer truck drivers, starting from hire-purchase contract registration through to net pay reports.

**Architecture:** Next.js 15 App Router with TypeScript. All API endpoints are Next.js route handlers. MongoDB on DigitalOcean (existing URI, new db `mena_partner`). Google OAuth via next-auth restricted to `menatransport.co.th` domain with admin emails in `lib/roles.ts`.

**Tech Stack:** Next.js, TypeScript, TailwindCSS v4, shadcn/ui, MongoDB driver, next-auth v4, lucide-react, Vitest (unit tests for pure functions)

## Global Constraints

- Database name: `mena_partner` (env var `MONGO_DB=mena_partner`)
- MongoDB URI: reuse existing `MONGO_URI` env var (DigitalOcean)
- Auth: Google OAuth, domain `menatransport.co.th`, admin role from `lib/roles.ts`
- All write API routes (POST/PUT/DELETE) require `role === "admin"` — return 403 otherwise
- All routes except `/login` and `/api/auth/*` require a valid session
- `month` field format: `"YYYY-MM"` (e.g. `"2026-06"`) everywhere
- Thai labels in all UI; English field names in code
- Follow master-sku-web patterns exactly: same AppShell, Sidebar, Providers, middleware shape
- Path alias `@/` maps to project root

---

### Task 1: Project Scaffold + Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.env.local` (not committed), `components.json`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/menatransport_02/Documents/project/mena-partner-driver
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes
```

Expected: project files created, `npm run dev` works on port 3000.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install mongodb next-auth@4 lucide-react
```

- [ ] **Step 3: Install dev dependencies (Vitest)**

```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 4: Add vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
  },
})
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Add shadcn/ui**

```bash
npx shadcn@latest init -d
```

When prompted: TypeScript yes, style Default, base color Slate, CSS variables yes.

- [ ] **Step 6: Install shadcn components**

```bash
npx shadcn@latest add button input label select badge card table dialog form
```

- [ ] **Step 7: Create .env.local**

```bash
cat > .env.local << 'EOF'
MONGO_URI=<paste existing DigitalOcean URI>
MONGO_DB=mena_partner
GOOGLE_CLIENT_ID=<from Google Console>
GOOGLE_CLIENT_SECRET=<from Google Console>
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
EOF
```

- [ ] **Step 8: Verify dev server**

```bash
npm run dev
```

Expected: `ready on http://localhost:3000` with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with deps and shadcn/ui"
```

---

### Task 2: Types + Core Utilities (TDD)

**Files:**
- Create: `types/index.ts`
- Create: `lib/utils.ts`
- Create: `__tests__/utils.test.ts`

**Produces:**
- `Contract`, `Driver`, `PayrollEntry`, `Trip` TypeScript interfaces
- `cn()`, `formatMoney()`, `formatMonth()`, `computePayroll()` functions

- [ ] **Step 1: Write failing tests**

Create `__tests__/utils.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { formatMoney, formatMonth, computePayroll } from "@/lib/utils"

describe("formatMoney", () => {
  it("formats positive number with Thai locale", () => {
    expect(formatMoney(15000)).toBe("15,000.00")
  })
  it("formats zero", () => {
    expect(formatMoney(0)).toBe("0.00")
  })
  it("formats negative", () => {
    expect(formatMoney(-500.5)).toBe("-500.50")
  })
})

describe("formatMonth", () => {
  it("converts YYYY-MM to Thai month label", () => {
    expect(formatMonth("2026-06")).toBe("มิ.ย. 2569")
  })
  it("converts Jan", () => {
    expect(formatMonth("2026-01")).toBe("ม.ค. 2569")
  })
})

describe("computePayroll", () => {
  it("calculates netPay correctly", () => {
    const result = computePayroll({
      transportFee: 100000,
      ot: 5000,
      otherIncomeWHT: 2000,
      otherIncomeNoWHT: 1000,
      fuel: 10000,
      gps: 700,
      repairInHouse: 3000,
      repairOutside: 0,
      mgmtFee8pct: 240,
      labor: 200,
      tire: 500,
      tirePatch: 100,
      carWash: 150,
      taxInsurance: 800,
      installment: 15000,
      repairInstallment: 0,
      downPaymentInstallment: 0,
    })
    expect(result.totalIncome).toBe(108000)
    expect(result.totalDeductions).toBe(30690)
    expect(result.netPay).toBe(77310)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: `Cannot find module '@/lib/utils'`

- [ ] **Step 3: Create types/index.ts**

```ts
export type ContractStatus = "active" | "completed" | "terminated"
export type DriverStatus = "active" | "inactive"
export type UserRole = "admin" | "viewer"

export interface Contract {
  _id?: string
  contractCode: string
  contractDate: string          // ISO date string
  buyerName: string
  driverName: string
  accountNumber: string
  phone: string
  plant: string
  truckNumber: string
  licensePlate: string
  vehicleBrand: string
  totalPrice: number
  downPayment: number
  monthlyInstallment: number
  totalInstallments: number
  startDate: string             // ISO date string
  status: ContractStatus
  notes: string
  createdAt?: string
  updatedAt?: string
}

export interface Driver {
  _id?: string
  contractCode: string
  buyerName: string
  driverName: string
  truckNumber: string
  licensePlate: string
  phone: string
  plant: string
  status: DriverStatus
  createdAt?: string
}

export interface PayrollIncomeFields {
  transportFee: number
  ot: number
  otherIncomeWHT: number
  otherIncomeNoWHT: number
}

export interface PayrollDeductionFields {
  fuel: number
  gps: number
  repairInHouse: number
  repairOutside: number
  mgmtFee8pct: number
  labor: number
  tire: number
  tirePatch: number
  carWash: number
  taxInsurance: number
  installment: number
  repairInstallment: number
  downPaymentInstallment: number
}

export interface PayrollEntry extends PayrollIncomeFields, PayrollDeductionFields {
  _id?: string
  contractCode: string
  month: string                 // "YYYY-MM"
  workingDays: number
  tripCount: number
  totalIncome: number
  totalDeductions: number
  netPay: number
  createdAt?: string
  updatedAt?: string
}

export interface Trip {
  _id?: string
  contractCode: string
  date: string                  // ISO date string
  ldtNumber: string
  plant: string
  serviceType: string
  routeCode: string
  destinationName: string
  district: string
  province: string
  zone: string
  tripFee: number
  createdAt?: string
}

export interface PayrollComputed {
  totalIncome: number
  totalDeductions: number
  netPay: number
}
```

- [ ] **Step 4: Create lib/utils.ts**

```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { PayrollDeductionFields, PayrollIncomeFields, PayrollComputed } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

export function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-").map(Number)
  const thaiYear = year + 543
  return `${THAI_MONTHS[month - 1]} ${thaiYear}`
}

export function computePayroll(
  fields: PayrollIncomeFields & PayrollDeductionFields
): PayrollComputed {
  const totalIncome =
    fields.transportFee +
    fields.ot +
    fields.otherIncomeWHT +
    fields.otherIncomeNoWHT

  const totalDeductions =
    fields.fuel +
    fields.gps +
    fields.repairInHouse +
    fields.repairOutside +
    fields.mgmtFee8pct +
    fields.labor +
    fields.tire +
    fields.tirePatch +
    fields.carWash +
    fields.taxInsurance +
    fields.installment +
    fields.repairInstallment +
    fields.downPaymentInstallment

  return { totalIncome, totalDeductions, netPay: totalIncome - totalDeductions }
}
```

- [ ] **Step 5: Install clsx + tailwind-merge (if not already present)**

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npm test
```

Expected:
```
✓ __tests__/utils.test.ts (6)
  ✓ formatMoney > formats positive number with Thai locale
  ✓ formatMoney > formats zero
  ✓ formatMoney > formats negative
  ✓ formatMonth > converts YYYY-MM to Thai month label
  ✓ formatMonth > converts Jan
  ✓ computePayroll > calculates netPay correctly
Test Files  1 passed (1)
```

- [ ] **Step 7: Commit**

```bash
git add types/ lib/utils.ts __tests__/ vitest.config.ts
git commit -m "feat: add TypeScript types and core utility functions with tests"
```

---

### Task 3: MongoDB Client + Auth + Middleware

**Files:**
- Create: `lib/mongo.ts`
- Create: `lib/roles.ts`
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`

**Produces:**
- `clientPromise` default export from `lib/mongo.ts`
- `authOptions` from `lib/auth.ts`
- `isAdmin(email)` from `lib/roles.ts`
- Protected middleware matching mena-wms pattern

- [ ] **Step 1: Create lib/mongo.ts**

```ts
import { MongoClient } from "mongodb"

const uri = process.env.MONGO_URI as string

if (!uri) throw new Error("Please add MONGO_URI to .env.local")

let client: MongoClient
let clientPromise: Promise<MongoClient>

declare global {
  var _mongoClientPromise: Promise<MongoClient>
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri)
  global._mongoClientPromise = client.connect()
}

clientPromise = global._mongoClientPromise

export default clientPromise
```

- [ ] **Step 2: Create lib/roles.ts**

```ts
export const ADMIN_EMAILS = new Set([
  "bunphak.p@menatransport.co.th",
  "kittaboon.l@menatransport.co.th",
  // add more admin emails here
])

export function isAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has(email ?? "")
}
```

- [ ] **Step 3: Create lib/auth.ts**

```ts
import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { isAdmin } from "./roles"

const ALLOWED_DOMAIN = "menatransport.co.th"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = user?.email ?? (profile as { email?: string })?.email ?? ""
      return email.split("@")[1]?.toLowerCase() === ALLOWED_DOMAIN
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.email = token.email ?? (profile as { email?: string })?.email
      }
      token.role = isAdmin(token.email as string) ? "admin" : "viewer"
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string
      }
      return session
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
}
```

- [ ] **Step 4: Create app/api/auth/[...nextauth]/route.ts**

```ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 5: Create middleware.ts**

```ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    return NextResponse.next()
  }

  const sessionToken =
    request.cookies.get("next-auth.session-token")?.value ??
    request.cookies.get("__Secure-next-auth.session-token")?.value

  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Write operations require admin role
  if (!READ_METHODS.has(request.method) && pathname.startsWith("/api/")) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (token?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot)$).*)"],
}
```

- [ ] **Step 6: Add NextAuth type extension**

Create `types/next-auth.d.ts`:
```ts
import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
  }
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/mongo.ts lib/roles.ts lib/auth.ts app/api/auth middleware.ts types/next-auth.d.ts
git commit -m "feat: add MongoDB client, Google OAuth auth, and middleware"
```

---

### Task 4: App Shell — Layout, Sidebar, Navbar, Login Page

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Create: `components/providers.tsx`
- Create: `components/app-shell.tsx`
- Create: `components/sidebar.tsx`
- Create: `components/navbar.tsx`
- Create: `app/login/page.tsx`

- [ ] **Step 1: Update app/globals.css**

Keep TailwindCSS directives, add:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

- [ ] **Step 2: Create components/providers.tsx**

```tsx
"use client"

import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

- [ ] **Step 3: Create components/sidebar.tsx**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Users, ClipboardList, Truck, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/",          label: "หน้าหลัก",      icon: BarChart3 },
  { href: "/contracts", label: "สัญญาเช่าซื้อ",  icon: FileText },
  { href: "/drivers",   label: "พนักงานขับรถ",   icon: Users },
  { href: "/payroll",   label: "เงินเดือน",       icon: ClipboardList },
  { href: "/trips",     label: "รายเที่ยว",       icon: Truck },
  { href: "/reports",   label: "รายงาน",          icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="flex flex-col w-56 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-screen overflow-y-auto">
      <div className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-sm font-bold tracking-widest text-emerald-600 uppercase">Mena Partner</h1>
        <p className="text-[10px] text-zinc-400 mt-0.5">รถร่วม Mixer</p>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: Create components/navbar.tsx**

```tsx
"use client"

import { useSession, signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { data: session } = useSession()
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        {session?.user && (
          <span className="text-xs text-zinc-500">{session.user.name ?? session.user.email}</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Create components/app-shell.tsx**

```tsx
"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Navbar } from "./navbar"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/login") return <div className="w-full h-full">{children}</div>
  return (
    <>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto px-8 py-7">{children}</main>
      </div>
    </>
  )
}
```

- [ ] **Step 6: Update app/layout.tsx**

```tsx
import "./globals.css"
import { Providers } from "@/components/providers"
import { AppShell } from "@/components/app-shell"

export const metadata = { title: "Mena Partner Driver", description: "ระบบเงินเดือนรถร่วม Mixer" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Create app/login/page.tsx**

```tsx
"use client"

import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") router.replace("/")
  }, [status, router])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-xs px-8 py-10 bg-white rounded-2xl shadow-xl text-center">
        <h1 className="text-xl font-bold tracking-widest text-emerald-600 uppercase mb-1">Mena Partner</h1>
        <p className="text-xs text-zinc-400 mb-8">ระบบเงินเดือนรถร่วม Mixer</p>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          เข้าสู่ระบบด้วย Google
        </Button>
        <p className="text-[10px] text-zinc-400 mt-4">เฉพาะ @menatransport.co.th เท่านั้น</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Verify and commit**

```bash
npm run dev
# Visit http://localhost:3000 — should redirect to /login
# /login should show the login card
npx tsc --noEmit
git add app/globals.css app/layout.tsx components/ app/login/
git commit -m "feat: add app shell, sidebar, navbar, and login page"
```

---

### Task 5: Contracts API + Pages

**Files:**
- Create: `app/api/contracts/route.ts`
- Create: `app/api/contracts/[id]/route.ts`
- Create: `app/contracts/page.tsx`
- Create: `app/contracts/new/page.tsx`
- Create: `app/contracts/[id]/page.tsx`

**Interfaces consumed:** `Contract` from `@/types`
**Produces:** `/api/contracts` REST endpoints, `/contracts` list + form pages

- [ ] **Step 1: Create app/api/contracts/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"
import type { Contract, Driver } from "@/types"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "contracts"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q      = searchParams.get("q")?.trim() ?? ""
  const status = searchParams.get("status")?.trim() ?? ""
  const plant  = searchParams.get("plant")?.trim() ?? ""

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (q) {
    filter["$or"] = [
      { contractCode: { $regex: q, $options: "i" } },
      { buyerName:    { $regex: q, $options: "i" } },
      { driverName:   { $regex: q, $options: "i" } },
      { licensePlate: { $regex: q, $options: "i" } },
      { truckNumber:  { $regex: q, $options: "i" } },
    ]
  }
  if (status) filter.status = status
  if (plant)  filter.plant  = { $regex: plant, $options: "i" }

  const items = await col
    .find(filter)
    .sort({ contractCode: 1 })
    .project({ notes: 0 })
    .toArray()

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const body: Contract = await req.json()

  if (!body.contractCode || !body.buyerName || !body.driverName) {
    return NextResponse.json({ error: "contractCode, buyerName, driverName required" }, { status: 400 })
  }

  const client    = await clientPromise
  const contracts = client.db(DB).collection(COLL)
  const drivers   = client.db(DB).collection("drivers")

  const now = new Date().toISOString()
  const doc = { ...body, createdAt: now, updatedAt: now }

  const existing = await contracts.findOne({ contractCode: body.contractCode })
  if (existing) {
    return NextResponse.json({ error: "contractCode already exists" }, { status: 409 })
  }

  const result = await contracts.insertOne(doc)

  // Auto-create driver document
  const driverDoc: Driver = {
    contractCode: body.contractCode,
    buyerName:    body.buyerName,
    driverName:   body.driverName,
    truckNumber:  body.truckNumber,
    licensePlate: body.licensePlate,
    phone:        body.phone,
    plant:        body.plant,
    status:       "active",
    createdAt:    now,
  }
  await drivers.updateOne(
    { contractCode: body.contractCode },
    { $setOnInsert: driverDoc },
    { upsert: true }
  )

  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 })
}
```

- [ ] **Step 2: Create app/api/contracts/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "contracts"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const item   = await col.findOne({ _id: new ObjectId(id) })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id }   = await params
  const body     = await req.json()
  const { _id, createdAt, ...update } = body
  void _id; void createdAt

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const now    = new Date().toISOString()

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...update, updatedAt: now } },
    { returnDocument: "after" }
  )
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Sync driver document
  const drivers = client.db(DB).collection("drivers")
  await drivers.updateOne(
    { contractCode: result.contractCode },
    { $set: {
        buyerName:   result.buyerName,
        driverName:  result.driverName,
        truckNumber: result.truckNumber,
        licensePlate: result.licensePlate,
        phone:       result.phone,
        plant:       result.plant,
      }
    }
  )

  return NextResponse.json(result)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  await col.deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Test API with curl (dev server must be running)**

```bash
# Create a contract
curl -s -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "contractCode":"MTL003","contractDate":"2022-01-01",
    "buyerName":"สมดี คงเคน","driverName":"สมดี คงเคน",
    "accountNumber":"863-2-42836-8","phone":"082-198-1335",
    "plant":"หนามแดง","truckNumber":"ME009","licensePlate":"สบ.71-1956",
    "vehicleBrand":"HINO","totalPrice":1500000,"downPayment":150000,
    "monthlyInstallment":15000,"totalInstallments":72,
    "startDate":"2022-02-01","status":"active","notes":""
  }' | jq .
```

Expected: `201` with `_id` field. If you get `401`, you need to log in first (API is protected). For testing without auth, temporarily comment out the session check in middleware and restore afterward.

```bash
# List contracts
curl -s http://localhost:3000/api/contracts | jq .
```

Expected: array with one item.

- [ ] **Step 4: Create app/contracts/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { PlusCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Contract } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งาน", completed: "สิ้นสุด", terminated: "ยกเลิก"
}
const STATUS_COLOR: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700",
  completed:  "bg-blue-100 text-blue-700",
  terminated: "bg-red-100 text-red-700",
}

export default function ContractsPage() {
  const { data: session } = useSession()
  const [items, setItems]   = useState<Contract[]>([])
  const [q, setQ]           = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/contracts?q=${encodeURIComponent(q)}`)
      setItems(await res.json())
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">สัญญาเช่าซื้อ</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{items.length} สัญญา</p>
        </div>
        {session?.user?.role === "admin" && (
          <Link href="/contracts/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="w-4 h-4 mr-2" /> เพิ่มสัญญา
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="ค้นหา รหัส / ชื่อ / ทะเบียน"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อผู้เช่าซื้อ</th>
              <th className="px-4 py-3 text-left">ชื่อผู้ขับขี่</th>
              <th className="px-4 py-3 text-left">ทะเบียน</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-left">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((c) => (
              <tr key={c._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3">
                  <Link href={`/contracts/${c._id}`} className="text-emerald-600 hover:underline font-medium">
                    {c.contractCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.buyerName}</td>
                <td className="px-4 py-3 text-zinc-500">{c.driverName}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.licensePlate}</td>
                <td className="px-4 py-3 text-zinc-500">{c.plant}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create app/contracts/new/page.tsx**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Contract } from "@/types"

const EMPTY: Omit<Contract, "_id" | "createdAt" | "updatedAt"> = {
  contractCode: "", contractDate: "", buyerName: "", driverName: "",
  accountNumber: "", phone: "", plant: "", truckNumber: "", licensePlate: "",
  vehicleBrand: "", totalPrice: 0, downPayment: 0, monthlyInstallment: 0,
  totalInstallments: 0, startDate: "", status: "active", notes: "",
}

export default function NewContractPage() {
  const router = useRouter()
  const [form, setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  function field(key: keyof typeof EMPTY) {
    return {
      value: String(form[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const v = e.target.value
        setForm((p) => ({ ...p, [key]: typeof p[key] === "number" ? Number(v) : v }))
      },
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "เกิดข้อผิดพลาด")
        return
      }
      router.push("/contracts")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">เพิ่มสัญญาเช่าซื้อใหม่</h1>
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>รหัสสัญญา *</Label>
            <Input {...field("contractCode")} required placeholder="MTL003" />
          </div>
          <div className="space-y-1">
            <Label>วันที่ทำสัญญา *</Label>
            <Input {...field("contractDate")} type="date" required />
          </div>
          <div className="space-y-1">
            <Label>ชื่อผู้เช่าซื้อ *</Label>
            <Input {...field("buyerName")} required />
          </div>
          <div className="space-y-1">
            <Label>ชื่อผู้ขับขี่ *</Label>
            <Input {...field("driverName")} required />
          </div>
          <div className="space-y-1">
            <Label>เลขที่บัญชีผู้เช่า-ซื้อ</Label>
            <Input {...field("accountNumber")} />
          </div>
          <div className="space-y-1">
            <Label>เบอร์โทร</Label>
            <Input {...field("phone")} />
          </div>
          <div className="space-y-1">
            <Label>แพล้นท์</Label>
            <Input {...field("plant")} placeholder="หนามแดง" />
          </div>
          <div className="space-y-1">
            <Label>เบอร์รถ</Label>
            <Input {...field("truckNumber")} placeholder="ME009" />
          </div>
          <div className="space-y-1">
            <Label>ทะเบียน</Label>
            <Input {...field("licensePlate")} placeholder="สบ.71-1956" />
          </div>
          <div className="space-y-1">
            <Label>ยี่ห้อรถ</Label>
            <Input {...field("vehicleBrand")} placeholder="HINO" />
          </div>
          <div className="space-y-1">
            <Label>ราคารถรวม (บาท)</Label>
            <Input {...field("totalPrice")} type="number" min="0" />
          </div>
          <div className="space-y-1">
            <Label>เงินดาวน์ (บาท)</Label>
            <Input {...field("downPayment")} type="number" min="0" />
          </div>
          <div className="space-y-1">
            <Label>ค่างวด/เดือน (บาท)</Label>
            <Input {...field("monthlyInstallment")} type="number" min="0" />
          </div>
          <div className="space-y-1">
            <Label>จำนวนงวด</Label>
            <Input {...field("totalInstallments")} type="number" min="0" />
          </div>
          <div className="space-y-1">
            <Label>วันที่เริ่มผ่อนงวดแรก</Label>
            <Input {...field("startDate")} type="date" />
          </div>
          <div className="space-y-1">
            <Label>สถานะ</Label>
            <select {...field("status")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="active">ใช้งาน</option>
              <option value="completed">สิ้นสุด</option>
              <option value="terminated">ยกเลิก</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Create app/contracts/[id]/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Contract } from "@/types"

export default function ContractDetailPage() {
  const { id }             = useParams<{ id: string }>()
  const router             = useRouter()
  const { data: session }  = useSession()
  const isAdmin            = session?.user?.role === "admin"
  const [form, setForm]    = useState<Contract | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]  = useState("")

  useEffect(() => {
    fetch(`/api/contracts/${id}`).then((r) => r.json()).then(setForm)
  }, [id])

  function field(key: keyof Contract) {
    return {
      value: String(form?.[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const v = e.target.value
        setForm((p) => p ? ({ ...p, [key]: typeof p[key] === "number" ? Number(v) : v }) : p)
      },
      disabled: !isAdmin,
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !isAdmin) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); return }
      router.push("/contracts")
    } finally { setSaving(false) }
  }

  if (!form) return <div className="text-zinc-400 text-sm">กำลังโหลด...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-1">สัญญา {form.contractCode}</h1>
      <p className="text-sm text-zinc-400 mb-6">{form.buyerName}</p>
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}
      <form onSubmit={handleSave} className="space-y-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="grid grid-cols-2 gap-4">
          {(["contractCode","contractDate","buyerName","driverName","accountNumber","phone","plant","truckNumber","licensePlate","vehicleBrand"] as (keyof Contract)[]).map((key) => (
            <div key={key} className="space-y-1">
              <Label>{key}</Label>
              <Input {...field(key)} />
            </div>
          ))}
          {(["totalPrice","downPayment","monthlyInstallment","totalInstallments"] as (keyof Contract)[]).map((key) => (
            <div key={key} className="space-y-1">
              <Label>{key}</Label>
              <Input {...field(key)} type="number" min="0" />
            </div>
          ))}
          <div className="space-y-1">
            <Label>startDate</Label>
            <Input {...field("startDate")} type="date" />
          </div>
          <div className="space-y-1">
            <Label>สถานะ</Label>
            <select {...field("status")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="active">ใช้งาน</option>
              <option value="completed">สิ้นสุด</option>
              <option value="terminated">ยกเลิก</option>
            </select>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
          </div>
        )}
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Verify manually**

```
1. Go to /contracts — list renders
2. Click "เพิ่มสัญญา" — form opens
3. Fill in MTL003 details and save — redirects to /contracts
4. Click the contractCode link — detail page loads
5. Edit a field and save — changes persist
```

- [ ] **Step 8: Commit**

```bash
git add app/api/contracts/ app/contracts/
git commit -m "feat: add contracts CRUD API and pages"
```

---

### Task 6: Drivers API + Pages

**Files:**
- Create: `app/api/drivers/route.ts`
- Create: `app/api/drivers/[id]/route.ts`
- Create: `app/drivers/page.tsx`
- Create: `app/drivers/[id]/page.tsx`

- [ ] **Step 1: Create app/api/drivers/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "drivers"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q      = searchParams.get("q")?.trim() ?? ""
  const status = searchParams.get("status")?.trim() ?? ""
  const plant  = searchParams.get("plant")?.trim() ?? ""

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (q) {
    filter["$or"] = [
      { contractCode: { $regex: q, $options: "i" } },
      { driverName:   { $regex: q, $options: "i" } },
      { buyerName:    { $regex: q, $options: "i" } },
      { licensePlate: { $regex: q, $options: "i" } },
    ]
  }
  if (status) filter.status = status
  if (plant)  filter.plant  = { $regex: plant, $options: "i" }

  const items = await col.find(filter).sort({ contractCode: 1 }).toArray()
  return NextResponse.json(items)
}
```

- [ ] **Step 2: Create app/api/drivers/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "drivers"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const db     = client.db(DB)
  const driver = await db.collection(COLL).findOne({ _id: new ObjectId(id) })
  if (!driver) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Attach last 6 months of payroll
  const payroll = await db.collection("payroll_entries")
    .find({ contractCode: driver.contractCode })
    .sort({ month: -1 })
    .limit(6)
    .toArray()

  return NextResponse.json({ ...driver, payrollHistory: payroll })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { status } = await req.json()
  if (!["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status } },
    { returnDocument: "after" }
  )
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Create app/drivers/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Driver } from "@/types"

export default function DriversPage() {
  const [items, setItems]     = useState<Driver[]>([])
  const [q, setQ]             = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/drivers?q=${encodeURIComponent(q)}`)
      setItems(await res.json())
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">พนักงานขับรถ</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{items.length} คน</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="ค้นหา รหัส / ชื่อ / ทะเบียน"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อผู้ขับขี่</th>
              <th className="px-4 py-3 text-left">ทะเบียน</th>
              <th className="px-4 py-3 text-left">เบอร์รถ</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-left">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((d) => (
              <tr key={d._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3">
                  <Link href={`/drivers/${d._id}`} className="text-emerald-600 hover:underline font-medium">
                    {d.contractCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{d.driverName}</td>
                <td className="px-4 py-3 font-mono text-xs">{d.licensePlate}</td>
                <td className="px-4 py-3 text-zinc-500">{d.truckNumber}</td>
                <td className="px-4 py-3 text-zinc-500">{d.plant}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    d.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {d.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create app/drivers/[id]/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { Driver, PayrollEntry } from "@/types"
import { formatMoney, formatMonth } from "@/lib/utils"

type DriverWithHistory = Driver & { payrollHistory: PayrollEntry[] }

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DriverWithHistory | null>(null)

  useEffect(() => {
    fetch(`/api/drivers/${id}`).then((r) => r.json()).then(setData)
  }, [id])

  if (!data) return <div className="text-zinc-400 text-sm">กำลังโหลด...</div>

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{data.driverName}</h1>
        <p className="text-sm text-zinc-400">{data.contractCode} · {data.licensePlate} · {data.plant}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          ["ชื่อผู้เช่าซื้อ", data.buyerName],
          ["เบอร์โทร", data.phone],
          ["เบอร์รถ", data.truckNumber],
          ["แพล้นท์", data.plant],
        ].map(([label, value]) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <p className="text-xs text-zinc-400 mb-1">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-3">ประวัติเงินเดือน (6 เดือนล่าสุด)</h2>
        {data.payrollHistory.length === 0 ? (
          <p className="text-sm text-zinc-400">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">เดือน</th>
                  <th className="px-4 py-3 text-right">รายรับ</th>
                  <th className="px-4 py-3 text-right">รายหัก</th>
                  <th className="px-4 py-3 text-right">สุทธิ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.payrollHistory.map((p) => (
                  <tr key={p._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">{formatMonth(p.month)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(p.totalIncome)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{formatMoney(p.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.netPay)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/payroll/${p.month}/${data.contractCode}`} className="text-xs text-emerald-600 hover:underline">
                        ดู →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/drivers/ app/drivers/
git commit -m "feat: add drivers API and pages with payroll history"
```

---

### Task 7: Payroll Entry API + Pages

**Files:**
- Create: `app/api/payroll/route.ts`
- Create: `app/api/payroll/[month]/[contractCode]/route.ts`
- Create: `app/payroll/page.tsx`
- Create: `app/payroll/[month]/[contractCode]/page.tsx`

- [ ] **Step 1: Create app/api/payroll/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { computePayroll } from "@/lib/utils"
import type { PayrollEntry } from "@/types"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "payroll_entries"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const month = searchParams.get("month")?.trim() ?? ""
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 })

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const items  = await col.find({ month }).sort({ contractCode: 1 }).toArray()
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const body: PayrollEntry = await req.json()
  if (!body.contractCode || !body.month) {
    return NextResponse.json({ error: "contractCode and month required" }, { status: 400 })
  }

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)

  const existing = await col.findOne({ contractCode: body.contractCode, month: body.month })
  if (existing) return NextResponse.json({ error: "Entry already exists for this driver/month" }, { status: 409 })

  const computed = computePayroll(body)
  const now      = new Date().toISOString()
  const doc      = { ...body, ...computed, createdAt: now, updatedAt: now }

  const result = await col.insertOne(doc)
  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 })
}
```

- [ ] **Step 2: Create app/api/payroll/[month]/[contractCode]/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { computePayroll } from "@/lib/utils"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "payroll_entries"

type Ctx = { params: Promise<{ month: string; contractCode: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { month, contractCode } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const item   = await col.findOne({ month, contractCode })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { month, contractCode } = await params
  const body   = await req.json()
  const computed = computePayroll(body)
  const now    = new Date().toISOString()

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)

  const result = await col.findOneAndUpdate(
    { month, contractCode },
    { $set: { ...body, ...computed, updatedAt: now } },
    { returnDocument: "after", upsert: true }
  )
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Create app/payroll/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { formatMonth, formatMoney } from "@/lib/utils"
import type { Driver, PayrollEntry } from "@/types"

function monthOptions() {
  const now  = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    opts.push({ value: v, label: formatMonth(v) })
  }
  return opts
}

export default function PayrollPage() {
  const options             = monthOptions()
  const [month, setMonth]   = useState(options[0].value)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/drivers?status=active").then((r) => r.json()).then(setDrivers)
  }, [])

  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/payroll?month=${month}`)
      .then((r) => r.json())
      .then((d) => { setEntries(d); setLoading(false) })
  }, [month])

  const entryMap = Object.fromEntries(entries.map((e) => [e.contractCode, e]))

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">เงินเดือน</h1>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="ml-auto rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อผู้ขับขี่</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-right">รายรับ</th>
              <th className="px-4 py-3 text-right">รายหัก</th>
              <th className="px-4 py-3 text-right">สุทธิ</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : drivers.map((d) => {
              const entry = entryMap[d.contractCode]
              return (
                <tr key={d._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium">{d.contractCode}</td>
                  <td className="px-4 py-3">{d.driverName}</td>
                  <td className="px-4 py-3 text-zinc-500">{d.plant}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">
                    {entry ? formatMoney(entry.totalIncome) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {entry ? formatMoney(entry.totalDeductions) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {entry ? formatMoney(entry.netPay) : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {entry ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/payroll/${month}/${d.contractCode}`}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      {entry ? "แก้ไข →" : "กรอก →"}
                    </Link>
                  </td>
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

- [ ] **Step 4: Create app/payroll/[month]/[contractCode]/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatMonth, computePayroll } from "@/lib/utils"
import type { PayrollEntry } from "@/types"

type NumericFields = Omit<PayrollEntry, "_id"|"contractCode"|"month"|"totalIncome"|"totalDeductions"|"netPay"|"createdAt"|"updatedAt">

const INCOME_FIELDS: { key: keyof PayrollEntry; label: string }[] = [
  { key: "transportFee",     label: "ค่าขนส่ง" },
  { key: "ot",               label: "OT" },
  { key: "otherIncomeWHT",   label: "รับอื่นๆ (หักWHT)" },
  { key: "otherIncomeNoWHT", label: "รับอื่นๆ ไม่หักWHT" },
]

const DEDUCTION_FIELDS: { key: keyof PayrollEntry; label: string }[] = [
  { key: "fuel",                    label: "ค่าเชื้อเพลิง" },
  { key: "gps",                     label: "GPS" },
  { key: "repairInHouse",           label: "ค่าซ่อมแซม" },
  { key: "repairOutside",           label: "ซ่อมนอก" },
  { key: "mgmtFee8pct",             label: "ค่าดำเนินการ 8%" },
  { key: "labor",                   label: "ค่าแรง" },
  { key: "tire",                    label: "ค่ายาง" },
  { key: "tirePatch",               label: "ค่าปะยาง" },
  { key: "carWash",                 label: "ค่าทำความสะอาดรถ" },
  { key: "taxInsurance",            label: "ต่อภาษีและประกัน" },
  { key: "installment",             label: "ค่างวดรถ" },
  { key: "repairInstallment",       label: "ผ่อนชำระค่าซ่อม" },
  { key: "downPaymentInstallment",  label: "ผ่อนเงินดาวน์" },
]

const ZERO_ENTRY = Object.fromEntries(
  [...INCOME_FIELDS, ...DEDUCTION_FIELDS].map(({ key }) => [key, 0])
) as unknown as NumericFields

export default function PayrollEntryPage() {
  const { month, contractCode } = useParams<{ month: string; contractCode: string }>()
  const router = useRouter()
  const [form, setForm]     = useState<NumericFields & { workingDays: number; tripCount: number }>({
    workingDays: 0, tripCount: 0, ...ZERO_ENTRY,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [isNew, setIsNew]   = useState(true)

  useEffect(() => {
    fetch(`/api/payroll/${month}/${contractCode}`)
      .then((r) => { if (r.ok) return r.json(); return null })
      .then((d) => {
        if (d) { setForm(d); setIsNew(false) }
      })
    // Load trip count hint
    fetch(`/api/trips?contractCode=${contractCode}&month=${month}`)
      .then((r) => r.json())
      .then((trips: unknown[]) => {
        if (isNew) setForm((p) => ({ ...p, tripCount: trips.length }))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, contractCode])

  const computed = computePayroll(form as Parameters<typeof computePayroll>[0])

  function numField(key: keyof typeof form) {
    return {
      value: String(form[key] ?? 0),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((p) => ({ ...p, [key]: Number(e.target.value) })),
      type: "number" as const,
      min: "0",
      step: "0.01",
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const payload = { ...form, contractCode, month }
      const url     = `/api/payroll/${month}/${contractCode}`
      const res     = await fetch(url, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); return }
      router.push("/payroll")
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
          {isNew ? "กรอกเงินเดือน" : "แก้ไขเงินเดือน"}
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">{contractCode} · {formatMonth(month)}</p>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Work summary */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 mb-4">ข้อมูลการทำงาน</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>วันทำงาน (วัน)</Label>
              <Input {...numField("workingDays")} />
            </div>
            <div className="space-y-1">
              <Label>จำนวนเที่ยว</Label>
              <Input {...numField("tripCount")} />
            </div>
          </div>
        </div>

        {/* Income */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-emerald-600 mb-4">รายการรับ</h2>
          <div className="grid grid-cols-2 gap-4">
            {INCOME_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input {...numField(key as keyof typeof form)} />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between text-sm">
            <span className="text-zinc-500">รวมรายรับ</span>
            <span className="font-bold text-emerald-600">{formatMoney(computed.totalIncome)} บาท</span>
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-red-500 mb-4">รายการหัก</h2>
          <div className="grid grid-cols-2 gap-4">
            {DEDUCTION_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input {...numField(key as keyof typeof form)} />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between text-sm">
            <span className="text-zinc-500">รวมรายหัก</span>
            <span className="font-bold text-red-500">{formatMoney(computed.totalDeductions)} บาท</span>
          </div>
        </div>

        {/* Net Pay */}
        <div className="bg-zinc-800 dark:bg-zinc-700 rounded-xl px-6 py-5 flex items-center justify-between">
          <span className="text-white font-medium">เงินสุทธิ</span>
          <span className="text-2xl font-bold text-emerald-400">{formatMoney(computed.netPay)} บาท</span>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Verify manually**

```
1. Go to /payroll — month picker shows, driver rows show "ยังไม่บันทึก"
2. Click "กรอก →" for a driver — form opens
3. Enter values — net pay updates live in the summary box
4. Save — redirects to /payroll, row now shows "บันทึกแล้ว" with amounts
5. Click "แก้ไข →" — form reopens with saved values
```

- [ ] **Step 6: Commit**

```bash
git add app/api/payroll/ app/payroll/
git commit -m "feat: add payroll entry API and pages with live net pay calculation"
```

---

### Task 8: Trips API + Pages

**Files:**
- Create: `app/api/trips/route.ts`
- Create: `app/api/trips/[id]/route.ts`
- Create: `app/trips/page.tsx`
- Create: `app/trips/new/page.tsx`

- [ ] **Step 1: Create app/api/trips/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "trips"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const contractCode = searchParams.get("contractCode")?.trim() ?? ""
  const month        = searchParams.get("month")?.trim() ?? ""
  const plant        = searchParams.get("plant")?.trim() ?? ""

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (contractCode) filter.contractCode = contractCode
  if (plant)        filter.plant = { $regex: plant, $options: "i" }
  if (month) {
    const [y, m] = month.split("-").map(Number)
    filter.date  = {
      $gte: new Date(y, m - 1, 1).toISOString(),
      $lt:  new Date(y, m,     1).toISOString(),
    }
  }

  const items = await col.find(filter).sort({ date: -1 }).limit(500).toArray()
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.contractCode || !body.date) {
    return NextResponse.json({ error: "contractCode and date required" }, { status: 400 })
  }
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const doc    = { ...body, createdAt: new Date().toISOString() }
  const result = await col.insertOne(doc)
  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 })
}
```

- [ ] **Step 2: Create app/api/trips/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "trips"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body   = await req.json()
  const { _id, createdAt, ...update } = body
  void _id; void createdAt
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  )
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(result)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  await col.deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create app/trips/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { PlusCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatMonth } from "@/lib/utils"
import type { Trip } from "@/types"

function monthOptions() {
  const now = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    opts.push({ value: v, label: formatMonth(v) })
  }
  return opts
}

export default function TripsPage() {
  const { data: session }   = useSession()
  const options             = monthOptions()
  const [month, setMonth]   = useState(options[0].value)
  const [q, setQ]           = useState("")
  const [items, setItems]   = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ month })
    if (q) params.set("contractCode", q)
    fetch(`/api/trips?${params}`)
      .then((r) => r.json())
      .then((d) => { setItems(d); setLoading(false) })
  }, [month, q])

  async function handleDelete(id: string) {
    if (!confirm("ลบรายเที่ยวนี้?")) return
    await fetch(`/api/trips/${id}`, { method: "DELETE" })
    setItems((p) => p.filter((t) => t._id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">รายเที่ยว</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{items.length} รายการ</p>
        </div>
        {session?.user?.role === "admin" && (
          <Link href="/trips/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="w-4 h-4 mr-2" /> เพิ่มรายเที่ยว
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-zinc-400" />
          <Input
            placeholder="รหัสสัญญา (MTL003)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-48"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">วันที่</th>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">LDT</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-left">ปลายทาง</th>
              <th className="px-4 py-3 text-left">จังหวัด</th>
              <th className="px-4 py-3 text-right">ค่าเที่ยว</th>
              {session?.user?.role === "admin" && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((t) => (
              <tr key={t._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 text-zinc-500 text-xs">{t.date?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-medium">{t.contractCode}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.ldtNumber}</td>
                <td className="px-4 py-3 text-zinc-500">{t.plant}</td>
                <td className="px-4 py-3">{t.destinationName}</td>
                <td className="px-4 py-3 text-zinc-500">{t.province}</td>
                <td className="px-4 py-3 text-right">{formatMoney(t.tripFee)}</td>
                {session?.user?.role === "admin" && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t._id!)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      ลบ
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create app/trips/new/page.tsx**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Trip } from "@/types"

type TripForm = Omit<Trip, "_id" | "createdAt">

const EMPTY: TripForm = {
  contractCode: "", date: "", ldtNumber: "", plant: "",
  serviceType: "", routeCode: "", destinationName: "",
  district: "", province: "", zone: "", tripFee: 0,
}

export default function NewTripPage() {
  const router = useRouter()
  const [form, setForm]     = useState<TripForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  function field(key: keyof TripForm) {
    return {
      value: String(form[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value
        setForm((p) => ({ ...p, [key]: key === "tripFee" ? Number(v) : v }))
      },
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); return }
      router.push("/trips")
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">เพิ่มรายเที่ยว</h1>
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>รหัสสัญญา *</Label>
            <Input {...field("contractCode")} required placeholder="MTL003" />
          </div>
          <div className="space-y-1">
            <Label>วันที่ *</Label>
            <Input {...field("date")} type="date" required />
          </div>
          <div className="space-y-1">
            <Label>เลขที่ LDT</Label>
            <Input {...field("ldtNumber")} />
          </div>
          <div className="space-y-1">
            <Label>แพล้นท์</Label>
            <Input {...field("plant")} />
          </div>
          <div className="space-y-1">
            <Label>บริการ</Label>
            <Input {...field("serviceType")} />
          </div>
          <div className="space-y-1">
            <Label>Route/Ship To</Label>
            <Input {...field("routeCode")} />
          </div>
          <div className="space-y-1">
            <Label>ชื่อปลายทาง</Label>
            <Input {...field("destinationName")} />
          </div>
          <div className="space-y-1">
            <Label>อำเภอ</Label>
            <Input {...field("district")} />
          </div>
          <div className="space-y-1">
            <Label>จังหวัด</Label>
            <Input {...field("province")} />
          </div>
          <div className="space-y-1">
            <Label>โซน</Label>
            <Input {...field("zone")} />
          </div>
          <div className="space-y-1">
            <Label>ค่าเที่ยว (บาท)</Label>
            <Input {...field("tripFee")} type="number" min="0" step="0.01" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/trips/ app/trips/
git commit -m "feat: add trips API and pages"
```

---

### Task 9: Reports + Dashboard

**Files:**
- Create: `app/api/reports/netpay/route.ts`
- Create: `app/reports/page.tsx`
- Modify: `app/page.tsx` (dashboard)

- [ ] **Step 1: Create app/api/reports/netpay/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const month = searchParams.get("month")?.trim() ?? ""
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 })

  const client   = await clientPromise
  const db       = client.db(DB)
  const entries  = await db.collection("payroll_entries").find({ month }).toArray()
  const drivers  = await db.collection("drivers").find({ status: "active" }).toArray()
  const tripAgg  = await db.collection("trips").aggregate([
    { $match: {
        date: {
          $gte: new Date(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1, 1).toISOString(),
          $lt:  new Date(Number(month.split("-")[0]), Number(month.split("-")[1]),     1).toISOString(),
        }
    }},
    { $group: { _id: "$contractCode", tripCount: { $sum: 1 }, totalTripFee: { $sum: "$tripFee" } } },
  ]).toArray()

  const tripMap   = Object.fromEntries(tripAgg.map((t) => [t._id, t]))
  const entryMap  = Object.fromEntries(entries.map((e) => [e.contractCode, e]))

  const rows = drivers.map((d) => {
    const entry = entryMap[d.contractCode]
    const trips = tripMap[d.contractCode]
    return {
      contractCode:   d.contractCode,
      driverName:     d.driverName,
      plant:          d.plant,
      tripCount:      trips?.tripCount ?? 0,
      totalTripFee:   trips?.totalTripFee ?? 0,
      totalIncome:    entry?.totalIncome ?? 0,
      totalDeductions: entry?.totalDeductions ?? 0,
      netPay:         entry?.netPay ?? 0,
      hasEntry:       !!entry,
    }
  })

  const summary = {
    totalDrivers:     drivers.length,
    driversWithEntry: entries.length,
    grandNetPay:      rows.reduce((s, r) => s + r.netPay, 0),
    grandIncome:      rows.reduce((s, r) => s + r.totalIncome, 0),
    grandDeductions:  rows.reduce((s, r) => s + r.totalDeductions, 0),
  }

  return NextResponse.json({ month, summary, rows })
}
```

- [ ] **Step 2: Create app/reports/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import { formatMoney, formatMonth } from "@/lib/utils"

type Row = {
  contractCode: string; driverName: string; plant: string
  tripCount: number; totalIncome: number; totalDeductions: number
  netPay: number; hasEntry: boolean
}
type Report = {
  month: string
  summary: { totalDrivers: number; driversWithEntry: number; grandNetPay: number; grandIncome: number; grandDeductions: number }
  rows: Row[]
}

function monthOptions() {
  const now = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    opts.push({ value: v, label: formatMonth(v) })
  }
  return opts
}

export default function ReportsPage() {
  const options           = monthOptions()
  const [month, setMonth] = useState(options[0].value)
  const [data, setData]   = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/netpay?month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [month])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">รายงานสรุปเงินเดือน</h1>
          {data && <p className="text-sm text-zinc-400 mt-0.5">{formatMonth(data.month)}</p>}
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "รวมรายรับ",  value: formatMoney(data.summary.grandIncome),      color: "text-emerald-600" },
            { label: "รวมรายหัก",  value: formatMoney(data.summary.grandDeductions),  color: "text-red-500" },
            { label: "รวมสุทธิ",   value: formatMoney(data.summary.grandNetPay),      color: "text-zinc-800 dark:text-zinc-100 text-2xl" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อ</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-right">เที่ยว</th>
              <th className="px-4 py-3 text-right">รายรับ</th>
              <th className="px-4 py-3 text-right">รายหัก</th>
              <th className="px-4 py-3 text-right">สุทธิ</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : data?.rows.map((r) => (
              <tr key={r.contractCode} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 font-medium">{r.contractCode}</td>
                <td className="px-4 py-3">{r.driverName}</td>
                <td className="px-4 py-3 text-zinc-500">{r.plant}</td>
                <td className="px-4 py-3 text-right">{r.tripCount}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(r.totalIncome)}</td>
                <td className="px-4 py-3 text-right text-red-500">{formatMoney(r.totalDeductions)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatMoney(r.netPay)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.hasEntry ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {r.hasEntry ? "บันทึกแล้ว" : "รอบันทึก"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace app/page.tsx (dashboard)**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Users, ClipboardList, Truck, BarChart3 } from "lucide-react"
import { formatMoney, formatMonth } from "@/lib/utils"

type Summary = { totalDrivers: number; driversWithEntry: number; grandNetPay: number; grandIncome: number; grandDeductions: number }

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function DashboardPage() {
  const month = currentMonth()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [driverCount, setDriverCount] = useState(0)

  useEffect(() => {
    fetch(`/api/reports/netpay?month=${month}`).then((r) => r.json()).then((d) => setSummary(d.summary))
    fetch("/api/drivers?status=active").then((r) => r.json()).then((d: unknown[]) => setDriverCount(d.length))
  }, [month])

  const QUICK = [
    { href: "/contracts", label: "สัญญาเช่าซื้อ",  icon: FileText,      color: "bg-blue-50 text-blue-600" },
    { href: "/drivers",   label: "พนักงานขับรถ",   icon: Users,         color: "bg-emerald-50 text-emerald-600" },
    { href: "/payroll",   label: "เงินเดือน",       icon: ClipboardList, color: "bg-amber-50 text-amber-600" },
    { href: "/trips",     label: "รายเที่ยว",       icon: Truck,         color: "bg-purple-50 text-purple-600" },
    { href: "/reports",   label: "รายงาน",          icon: BarChart3,     color: "bg-red-50 text-red-600" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">หน้าหลัก</h1>
        <p className="text-sm text-zinc-400 mt-1">{formatMonth(month)}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "รถร่วมทั้งหมด",   value: `${driverCount} คัน`,                      color: "" },
          { label: "รายรับรวม",        value: summary ? formatMoney(summary.grandIncome) : "-", color: "text-emerald-600" },
          { label: "รายหักรวม",        value: summary ? formatMoney(summary.grandDeductions) : "-", color: "text-red-500" },
          { label: "สุทธิรวม",         value: summary ? formatMoney(summary.grandNetPay) : "-",  color: "text-zinc-800 dark:text-zinc-100" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <p className="text-xs text-zinc-400 mb-2">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-500 mb-3 uppercase tracking-wide">เมนูหลัก</h2>
        <div className="grid grid-cols-5 gap-3">
          {QUICK.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-3 p-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 hover:shadow-sm transition-all text-center"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Final end-to-end verification**

```
1. Login with @menatransport.co.th Google account
2. Dashboard shows current month summary cards
3. /contracts → add a contract (MTL003) → appears in list
4. /drivers → MTL003 driver auto-appeared
5. /trips/new → add 2 trips for MTL003 in current month
6. /payroll → MTL003 shows "ยังไม่บันทึก", trip count hint appears in form
7. /payroll/[month]/MTL003 → fill all fields → net pay computed live → save
8. /payroll → MTL003 now shows "บันทึกแล้ว" with amounts
9. /reports → MTL003 appears with correct figures
10. /drivers/[id] → payroll history tab shows the entry
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all 6 tests pass.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Final commit**

```bash
git add app/api/reports/ app/reports/ app/page.tsx
git commit -m "feat: add net pay report API, reports page, and dashboard"
```

---

## MongoDB Indexes (run once after deploy)

```js
// Run in MongoDB shell or Compass after first deploy
use mena_partner

db.contracts.createIndex({ contractCode: 1 }, { unique: true })
db.drivers.createIndex({ contractCode: 1 }, { unique: true })
db.drivers.createIndex({ status: 1 })
db.payroll_entries.createIndex({ contractCode: 1, month: 1 }, { unique: true })
db.payroll_entries.createIndex({ month: 1 })
db.trips.createIndex({ contractCode: 1, date: -1 })
db.trips.createIndex({ date: -1 })
```

---

## Environment Variables Summary

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | DigitalOcean MongoDB connection string (existing) |
| `MONGO_DB` | `mena_partner` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) / Vercel URL (prod) |
