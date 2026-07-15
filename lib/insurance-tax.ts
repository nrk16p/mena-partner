import "server-only"

/** "สบ.71-1515" → "71-1515" (เหมือน normPlate ใน lib/contract-docx.ts) */
export function normPlateIT(p?: string | null): string {
  return (p ?? "").replace(/^[^0-9]*/, "").trim()
}

export interface InsuranceCycle {
  _id?: string
  licensePlate: string          // canonical with สบ. prefix as given
  platePlain: string            // normalized (71-1515) — set on write, used for joins
  effectiveDate?: string        // ISO YYYY-MM-DD วันเริ่มคุ้มครอง/ต่อภาษี
  expiryDate?: string           // ISO YYYY-MM-DD วันหมดอายุ
  insuranceCompany?: string
  insurer?: string              // ผู้ทำเรื่อง/ผู้รับผิดชอบ
  insuranceAmount?: number      // ประกันภัย
  prbAmount?: number            // พรบ.
  taxAmount?: number            // ภาษีทะเบียน
  inspectionCost?: number       // ตรวจสภาพ
  totalCost?: number            // รวม (ถ้าไม่ส่งมา คำนวณจาก 4 ตัวบน)
  installmentCount?: number     // จำนวนงวดเรียกเก็บจาก พขร.
  monthlyInstallment?: number   // ยอดหัก/เดือน
  collectStart?: string         // "YYYY-MM" เดือนแรกที่หัก
  collectEnd?: string           // "YYYY-MM" เดือนสุดท้ายที่หัก
  status: "active" | "renewed"  // renewed = ถูกแทนที่ด้วยรอบใหม่แล้ว
  attachments?: { name: string; url: string }[]
  notes?: string
  migratedFrom?: string         // contractCode ถ้ามาจาก migration
  createdAt: string
  updatedAt: string
}

const COLL = "vehicle_insurance_tax"
const EXPIRING_DAYS = 60

/** สถานะแสดงผล: active(ปกติ) | expiring(หมดใน<=60วัน) | expired | renewed */
export function cycleDisplayStatus(
  c: Pick<InsuranceCycle, "expiryDate" | "status">,
  todayISO?: string
): "active" | "expiring" | "expired" | "renewed" {
  if (c.status === "renewed") return "renewed"
  if (!c.expiryDate) return "active"
  const today = todayISO ?? new Date().toISOString().slice(0, 10)
  if (c.expiryDate < today) return "expired"
  const limit = new Date(today + "T00:00:00Z")
  limit.setUTCDate(limit.getUTCDate() + EXPIRING_DAYS)
  if (c.expiryDate <= limit.toISOString().slice(0, 10)) return "expiring"
  return "active"
}

/** เดือน "YYYY-MM" อยู่ในช่วง collectStart..collectEnd ของ cycle หรือไม่
 *  (ไม่ระบุขอบไหน = เปิดปลายด้านนั้น — record จาก migration เก่าไม่มีช่วงหัก ให้หักต่อเนื่องตามพฤติกรรมเดิม) */
function monthInCollectRange(c: Pick<InsuranceCycle, "collectStart" | "collectEnd">, month: string): boolean {
  if (c.collectStart && month < c.collectStart) return false
  if (c.collectEnd && month > c.collectEnd) return false
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickDeduction(cycles: any[], month: string): number | null {
  if (cycles.length === 0) return null
  // เอาใบที่เดือนอยู่ในช่วงหัก — ถ้าซ้อนกันหลายใบ เอาใบ createdAt ล่าสุด
  const inRange = cycles
    .filter((c) => monthInCollectRange(c, month))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  if (inRange.length === 0) return 0 // มี cycle แต่เดือนนี้อยู่นอกช่วงหักทุกใบ → หยุดหัก
  return inRange[0].monthlyInstallment ?? 0
}

/** ยอดหักประกัน/ภาษีของทะเบียนสำหรับเดือน payroll ("YYYY-MM"):
 *  - ไม่มี cycle ของทะเบียนนี้เลย → null (ให้ caller fallback ไป field เดิมใน contract)
 *  - มี cycle แต่เดือนนี้อยู่นอกช่วง collectStart..collectEnd ทุกใบ → 0 (หยุดหัก)
 *  - เดือนอยู่ในช่วงของ cycle ไหน (เอาใบ createdAt ล่าสุดถ้าซ้อน) → monthlyInstallment ?? 0 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getInsuranceDeductionForPlate(db: any, licensePlate: string, month: string): Promise<number | null> {
  const platePlain = normPlateIT(licensePlate)
  if (!platePlain) return null
  const cycles = await db
    .collection(COLL)
    .find({ platePlain })
    .project({ collectStart: 1, collectEnd: 1, monthlyInstallment: 1, createdAt: 1 })
    .toArray()
  return pickDeduction(cycles, month)
}

/** batch เวอร์ชันของข้างบน: คืน Map<platePlain, number|null> ครอบทุก plate ที่ส่งเข้า (plate ที่ไม่มี cycle → null) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getInsuranceDeductionMap(db: any, month: string, plates: string[]): Promise<Map<string, number | null>> {
  const plains = Array.from(new Set(plates.map(normPlateIT).filter(Boolean)))
  const out = new Map<string, number | null>()
  for (const p of plates) out.set(normPlateIT(p), null)
  if (plains.length === 0) return out

  const cycles = await db
    .collection(COLL)
    .find({ platePlain: { $in: plains } })
    .project({ platePlain: 1, collectStart: 1, collectEnd: 1, monthlyInstallment: 1, createdAt: 1 })
    .toArray()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byPlate = new Map<string, any[]>()
  for (const c of cycles) {
    const arr = byPlate.get(c.platePlain) ?? []
    arr.push(c)
    byPlate.set(c.platePlain, arr)
  }
  for (const [plate, arr] of byPlate) out.set(plate, pickDeduction(arr, month))
  return out
}
