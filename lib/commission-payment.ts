import "server-only"
import { ObjectId, type Db } from "mongodb"
import { QUOTE_COLL } from "@/lib/quotation"
import { buildSalesCommission, cycleLabel, type CommissionQuote, type CommissionSummary } from "@/lib/commission"

/**
 * ทำจ่ายค่าคอม — บันทึกว่าจ่ายคันไหน งวดไหน เท่าไหร่ รอบไหน
 * เก็บใน commission_payments + ประทับ commissionPayouts.t1/t2 บนใบเสนอ (กันจ่ายซ้ำ)
 */
export const PAYMENT_COLL = "commission_payments"

export interface PaymentItem {
  quotationId: string
  quotationNo: string
  customerName: string
  licensePlate: string
  truckNumber: string
  nth: number
  tranche: 1 | 2
  amount: number
  due: string
  contractStart: string
}
export interface CommissionPayment {
  _id?: string
  salesKey: string
  salesName: string
  salesEmail: string
  cycle: string
  cycleLabel: string
  paidAt: string          // YYYY-MM-DD
  note: string
  items: PaymentItem[]
  total: number
  createdBy: { email: string; name: string }
  createdAt: string
}

export const COMMISSION_PROJECTION = {
  quotationNo: 1, status: 1, stage: 1, salesEmail: 1, salesName: 1, customerName: 1,
  licensePlate: 1, truckNumber: 1, totalSalePrice: 1, createdAt: 1, updatedAt: 1, timeline: 1,
  contractStartDate: 1, contractSignedAt: 1, contractDate: 1, commissionPayouts: 1,
}

/** ใบที่นับค่าคอมทั้งหมด (status won แบบเก่า หรือขั้นเซ็นสัญญาขึ้นไป) */
export async function loadCommissionSummaries(db: Db): Promise<CommissionSummary[]> {
  const rows = await db.collection(QUOTE_COLL)
    .find({ $or: [{ status: "won" }, { stage: { $in: ["CONTRACT_SIGNED", "DELIVERED", "COMPLETED_90D"] } }] }, { projection: COMMISSION_PROJECTION })
    .limit(5000)
    .toArray()
  return buildSalesCommission(rows.map((r) => ({ ...r, _id: String(r._id) })) as unknown as CommissionQuote[])
}

export async function createPayment(
  db: Db,
  input: { salesKey: string; items: { quotationId: string; tranche: 1 | 2 }[]; paidAt: string; cycle?: string; note?: string },
  actor: { email: string; name: string },
): Promise<{ ok: true; payment: CommissionPayment } | { ok: false; error: string }> {
  const summaries = await loadCommissionSummaries(db)
  const group = summaries.find((s) => s.key === input.salesKey)
  if (!group) return { ok: false, error: "ไม่พบเซลล์คนนี้ในสรุปค่าคอม" }
  if (!input.items.length) return { ok: false, error: "ยังไม่ได้เลือกงวดที่จะทำจ่าย" }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt)) return { ok: false, error: "วันที่จ่ายไม่ถูกต้อง" }

  const items: PaymentItem[] = []
  for (const it of input.items) {
    const sale = group.sales.find((s) => s.quotationId === it.quotationId)
    if (!sale) return { ok: false, error: `ไม่พบใบ ${it.quotationId} ในรายการของ ${group.name}` }
    const payout = sale.payouts.find((p) => p.tranche === it.tranche)
    if (!payout) return { ok: false, error: `${sale.quotationNo} ไม่มีงวดที่ ${it.tranche}` }
    if (payout.paid) return { ok: false, error: `${sale.quotationNo} งวดที่ ${it.tranche} ทำจ่ายไปแล้วเมื่อ ${payout.paid.paidAt}` }
    if (items.some((x) => x.quotationId === it.quotationId && x.tranche === it.tranche)) continue
    items.push({
      quotationId: sale.quotationId, quotationNo: sale.quotationNo, customerName: sale.customerName,
      licensePlate: sale.licensePlate, truckNumber: sale.truckNumber, nth: sale.nth,
      tranche: it.tranche, amount: payout.amount, due: payout.due, contractStart: sale.contractStart,
    })
  }
  // รอบ: ที่ส่งมา หรือรอบที่พบมากสุดในงวดที่เลือก
  const cycle = input.cycle && /^\d{4}-\d{2}$/.test(input.cycle) ? input.cycle : mostCommonCycle(group, items)
  const now = new Date().toISOString()
  const payment: Omit<CommissionPayment, "_id"> = {
    salesKey: group.key, salesName: group.name, salesEmail: group.email,
    cycle, cycleLabel: cycleLabel(cycle), paidAt: input.paidAt, note: String(input.note ?? "").trim(),
    items, total: items.reduce((a, x) => a + x.amount, 0), createdBy: actor, createdAt: now,
  }
  const r = await db.collection(PAYMENT_COLL).insertOne({ ...payment })
  const paymentId = String(r.insertedId)
  for (const it of items) {
    // driver type ของ $push เข้มเกินไปกับ schema แบบหลวม (ที่อื่นในโปรเจกต์ก็ใช้ any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u: any = {
      $set: { [`commissionPayouts.t${it.tranche}`]: { paymentId, paidAt: input.paidAt, amount: it.amount, cycle }, updatedAt: now },
      $push: { timeline: { at: now, by: actor.email, action: `ทำจ่ายค่าคอมงวดที่ ${it.tranche} ${it.amount.toLocaleString()} บาท (${cycleLabel(cycle)})` } },
    }
    await db.collection(QUOTE_COLL).updateOne({ _id: new ObjectId(it.quotationId) }, u)
  }
  return { ok: true, payment: { ...payment, _id: paymentId } }
}

function mostCommonCycle(group: CommissionSummary, items: PaymentItem[]): string {
  const count = new Map<string, number>()
  for (const it of items) {
    const c = group.sales.find((s) => s.quotationId === it.quotationId)?.payouts.find((p) => p.tranche === it.tranche)?.cycle ?? ""
    if (c) count.set(c, (count.get(c) ?? 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? new Date().toISOString().slice(0, 7)
}
