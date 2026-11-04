/**
 * ค่าคอมมิชชั่นฝ่ายขาย — ขั้นบันไดแบบ marginal สะสมตลอดชีพ (ไม่รีเซ็ตรอบ)
 * ไฟล์นี้ pure ไม่แตะ DB/env — ใช้ได้ทั้ง server, client และ unit test
 *
 * นับ 1 คัน เมื่อใบเสนอราคามีสถานะ "won" (ปิดการขาย)
 */

/** ช่วงขั้นบันได: คันที่ 1..upTo ได้ rate บาท/คัน (upTo = null คือขั้นสุดท้าย ไม่จำกัด) */
export type CommissionTier = { upTo: number | null; rate: number }

export const COMMISSION_TIERS: CommissionTier[] = [
  { upTo: 5,    rate: 2000 },
  { upTo: 10,   rate: 3500 },
  { upTo: 15,   rate: 4000 },
  { upTo: null, rate: 5000 },
]

/** ค่าคอมของ "คันที่ n" (n เริ่มที่ 1) */
export function commissionForNth(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 0
  const i = Math.floor(n)
  for (const t of COMMISSION_TIERS) if (t.upTo === null || i <= t.upTo) return t.rate
  return 0
}

/** ค่าคอมสะสมของคนที่ขายไปแล้ว count คัน */
export function commissionTotal(count: number): number {
  if (!Number.isFinite(count) || count < 1) return 0
  let total = 0
  for (let i = 1; i <= Math.floor(count); i++) total += commissionForNth(i)
  return total
}

/** ขั้นถัดไป: อีกกี่คันถึงจะขึ้นอัตรา และขึ้นเป็นเท่าไหร่ (null = อยู่ขั้นสูงสุดแล้ว) */
export function nextTierInfo(count: number): { carsToNext: number; nextRate: number } | null {
  const done = Math.max(0, Math.floor(count || 0))
  const currentRate = commissionForNth(done + 1)
  for (const t of COMMISSION_TIERS) {
    if (t.upTo === null) break
    if (done < t.upTo && t.rate === currentRate) {
      const nextIdx = COMMISSION_TIERS.indexOf(t) + 1
      const next = COMMISSION_TIERS[nextIdx]
      if (!next || next.rate === currentRate) return null
      return { carsToNext: t.upTo - done, nextRate: next.rate }
    }
  }
  return null
}

/* ---------- สรุปรายคน ---------- */

/** ร่องรอยว่างวดนี้ทำจ่ายไปแล้ว (เก็บบนเอกสารใบเสนอ commissionPayouts.t1/t2) */
export type PayoutMark = { paymentId: string; paidAt: string; amount: number; cycle: string }

/** ใบเสนอราคาเท่าที่การคำนวณค่าคอมต้องใช้ */
export type CommissionQuote = {
  _id?: string
  quotationNo: string
  status: string
  stage?: string
  salesEmail?: string
  salesName?: string
  customerName?: string
  licensePlate?: string
  truckNumber?: string
  totalSalePrice?: number
  updatedAt?: string
  createdAt?: string
  // วันเริ่มต้นสัญญา — ฐานคิดรอบจ่ายค่าคอม (ตั้งเองได้ > วันที่ขยับเป็นเซ็นสัญญาแล้ว > วันนัดเซ็น > วันปิดการขาย)
  contractStartDate?: string
  contractSignedAt?: string
  contractDate?: string
  commissionPayouts?: { t1?: PayoutMark; t2?: PayoutMark }
  timeline?: { at: string; by: string; action: string; note?: string }[]
}

/** งวดจ่ายของคันหนึ่ง — งวด 1 = 1,000 เมื่อครบ 30 วัน · งวด 2 = ส่วนที่เหลือเมื่อครบ 90 วัน */
export type Payout = {
  tranche: 1 | 2
  amount: number
  due: string            // YYYY-MM-DD วันครบกำหนด
  cycle: string          // YYYY-MM รอบจ่าย (ตัดรอบวันที่ 20)
  cycleLabel: string
  paid?: PayoutMark
}

export type CommissionSale = {
  nth: number            // คันที่เท่าไหร่ของคนนี้ (นับสะสมตลอดชีพ)
  wonAt: string          // วันปิดการขาย (ISO)
  contractStart: string  // วันเริ่มต้นสัญญา YYYY-MM-DD (ฐานรอบจ่าย)
  quotationId: string
  quotationNo: string
  customerName: string
  licensePlate: string
  truckNumber: string
  salePrice: number
  commission: number     // ค่าคอมของคันนี้
  cumulative: number     // ค่าคอมสะสมถึงคันนี้
  payouts: Payout[]
  paid: number           // จ่ายไปแล้วของคันนี้
}

/* ---------- รอบจ่าย ---------- */

export const FIRST_TRANCHE = 1000
export const TRANCHE_DAYS: Record<1 | 2, number> = { 1: 30, 2: 90 }
export const CYCLE_CUTOFF_DAY = 20
/** ขั้น pipeline ที่นับเป็นปิดการขายแล้ว (ซ้ำกับ deal-stage.WON_STAGES — ไฟล์นี้ต้อง pure ไม่ import server code) */
const WON_STAGE_SET = new Set(["CONTRACT_SIGNED", "DELIVERED", "COMPLETED_90D"])

export const isWonQuote = (q: { status?: string; stage?: string }) =>
  q.status === "won" || WON_STAGE_SET.has(String(q.stage ?? ""))

const ymd = (iso: string) => iso.slice(0, 10)
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

export function addDays(dateYmd: string, n: number): string {
  const d = new Date(dateYmd.slice(0, 10) + "T00:00:00Z")
  if (Number.isNaN(d.getTime())) return ""
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** รอบจ่ายของวันครบกำหนด: ถึงวันที่ 20 = รอบเดือนนั้น · หลังวันที่ 20 = รอบเดือนถัดไป */
export function cycleOf(dateYmd: string): string {
  const d = new Date(dateYmd.slice(0, 10) + "T00:00:00Z")
  if (Number.isNaN(d.getTime())) return ""
  if (d.getUTCDate() > CYCLE_CUTOFF_DAY) d.setUTCMonth(d.getUTCMonth() + 1, 1)
  return d.toISOString().slice(0, 7)
}

/** "2026-11" → "รอบ 20 พ.ย. 69" */
export function cycleLabel(cycle: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(cycle)
  if (!m) return cycle || "—"
  return `รอบ ${CYCLE_CUTOFF_DAY} ${TH_MONTHS[Number(m[2]) - 1]} ${String(Number(m[1]) + 543).slice(-2)}`
}

/** วันเริ่มต้นสัญญาของใบนี้ (YYYY-MM-DD) — ฐานคิดรอบจ่าย */
export function contractStartOf(q: CommissionQuote): string {
  const pick = q.contractStartDate || q.contractSignedAt || q.contractDate || wonDateOf(q)
  return pick ? ymd(pick) : ""
}

/** แผนจ่ายของคันหนึ่ง จากค่าคอมกับวันเริ่มต้นสัญญา */
export function payoutsOf(commission: number, contractStart: string, marks?: { t1?: PayoutMark; t2?: PayoutMark }): Payout[] {
  if (commission <= 0) return []
  const first = Math.min(FIRST_TRANCHE, commission)
  const rest = commission - first
  const mk = (tranche: 1 | 2, amount: number): Payout => {
    const due = contractStart ? addDays(contractStart, TRANCHE_DAYS[tranche]) : ""
    const cycle = due ? cycleOf(due) : ""
    const paid = tranche === 1 ? marks?.t1 : marks?.t2
    return { tranche, amount, due, cycle, cycleLabel: cycleLabel(cycle), ...(paid ? { paid } : {}) }
  }
  return rest > 0 ? [mk(1, first), mk(2, rest)] : [mk(1, first)]
}

export type CommissionSummary = {
  key: string            // email (lowercase) หรือ name — ใช้เป็น id ของกลุ่ม
  name: string
  email: string
  unassigned: boolean    // true = ใบที่ไม่มีผู้ขาย (ข้อมูลไม่สมบูรณ์)
  count: number
  total: number          // ค่าคอมสะสมรวม
  paidTotal: number      // ทำจ่ายไปแล้ว
  dueTotal: number       // ถึงกำหนดแล้วแต่ยังไม่จ่าย (นับถึงรอบปัจจุบัน)
  salesValue: number     // มูลค่าขายรวม
  currentRate: number    // อัตราของคันถัดไป
  next: { carsToNext: number; nextRate: number } | null
  sales: CommissionSale[]
}

/** วันปิดการขาย: event ล่าสุดใน timeline ที่ลงท้าย "ปิดการขาย" หรือขยับเป็น "เซ็นสัญญาแล้ว" ไม่มีก็ใช้ updatedAt/createdAt */
export function wonDateOf(q: CommissionQuote): string {
  const events = (q.timeline ?? []).filter((t) => /ปิดการขาย\s*$|→ เซ็นสัญญาแล้ว/.test(t.action ?? ""))
  const last = events[events.length - 1]
  return last?.at || q.contractSignedAt || q.updatedAt || q.createdAt || ""
}

/** สรุปค่าคอมรายคนจากใบเสนอราคาทั้งหมด (กรองใบที่ปิดการขายให้เอง)
 *  จับกลุ่มด้วยอีเมลก่อน ใบที่ไม่มีอีเมล (คนอื่นคีย์ให้สมัยก่อน) เทียบชื่อเข้ากลุ่มเดิม
 *  @param today ใช้ตัดสินว่างวดไหน "ถึงกำหนดแล้ว" (YYYY-MM-DD) */
export function buildSalesCommission(quotes: CommissionQuote[], today = new Date().toISOString().slice(0, 10)): CommissionSummary[] {
  const groups = new Map<string, { name: string; email: string; unassigned: boolean; rows: CommissionQuote[] }>()
  const keyOfName = new Map<string, string>()
  const norm = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase()

  // ใบที่มีอีเมลก่อน ให้ชื่อผูกกับกลุ่มอีเมลไว้ แล้วใบชื่ออย่างเดียวค่อยตามเข้ากลุ่ม
  const won = quotes.filter(isWonQuote)
  const ordered = [...won.filter((q) => (q.salesEmail ?? "").trim()), ...won.filter((q) => !(q.salesEmail ?? "").trim())]
  for (const q of ordered) {
    const email = (q.salesEmail ?? "").trim().toLowerCase()
    const name = (q.salesName ?? "").trim()
    const key = email || (name && keyOfName.get(norm(name))) || name || "__unassigned__"
    const g = groups.get(key) ?? {
      name: name || email || "ไม่ระบุผู้ขาย",
      email,
      unassigned: !email && !name,
      rows: [],
    }
    // ชื่อล่าสุดชนะ (กันเคสเปลี่ยนชื่อ/สะกดต่างกันในใบเก่า)
    if (name) { g.name = name; if (!keyOfName.has(norm(name))) keyOfName.set(norm(name), key) }
    g.rows.push(q)
    groups.set(key, g)
  }

  const out: CommissionSummary[] = []
  for (const [key, g] of groups) {
    const sorted = [...g.rows].sort((a, b) => {
      const d = (contractStartOf(a) || wonDateOf(a)).localeCompare(contractStartOf(b) || wonDateOf(b))
      return d !== 0 ? d : (a.quotationNo ?? "").localeCompare(b.quotationNo ?? "")
    })
    let cumulative = 0
    const sales: CommissionSale[] = sorted.map((q, i) => {
      const nth = i + 1
      const commission = commissionForNth(nth)
      cumulative += commission
      const contractStart = contractStartOf(q)
      const payouts = payoutsOf(commission, contractStart, q.commissionPayouts)
      return {
        nth,
        wonAt: wonDateOf(q),
        contractStart,
        quotationId: String(q._id ?? ""),
        quotationNo: q.quotationNo ?? "",
        customerName: q.customerName ?? "",
        licensePlate: q.licensePlate ?? "",
        truckNumber: q.truckNumber ?? "",
        salePrice: Number(q.totalSalePrice) || 0,
        commission,
        cumulative,
        payouts,
        paid: payouts.reduce((a, p) => a + (p.paid ? p.amount : 0), 0),
      }
    })
    const todayCycle = cycleOf(today)
    out.push({
      key,
      name: g.name,
      email: g.email,
      unassigned: g.unassigned,
      count: sales.length,
      total: cumulative,
      paidTotal: sales.reduce((a, s) => a + s.paid, 0),
      dueTotal: sales.reduce((a, s) => a + s.payouts.filter((p) => !p.paid && p.cycle && p.cycle <= todayCycle).reduce((b, p) => b + p.amount, 0), 0),
      salesValue: sales.reduce((a, s) => a + s.salePrice, 0),
      currentRate: commissionForNth(sales.length + 1),
      next: nextTierInfo(sales.length),
      sales,
    })
  }

  // ขายมากสุดขึ้นก่อน · กลุ่มไม่ระบุผู้ขายไปท้ายเสมอ
  return out.sort((a, b) =>
    Number(a.unassigned) - Number(b.unassigned) || b.count - a.count || b.total - a.total)
}

/** label ของช่วงขั้นบันได สำหรับแสดงตารางกติกา */
export function tierLabel(i: number): string {
  const t = COMMISSION_TIERS[i]
  const from = i === 0 ? 1 : (COMMISSION_TIERS[i - 1].upTo ?? 0) + 1
  return t.upTo === null ? `คันที่ ${from} เป็นต้นไป` : `คันที่ ${from}–${t.upTo}`
}
