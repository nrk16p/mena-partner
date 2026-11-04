import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { promotionSummary } from "@/lib/promotion-summary"

const DB = process.env.MONGO_DB ?? "mena_partner"
const norm = (s: string) => (s ?? "").replace(/\s+/g, "").replace(/^สบ\.?/, "").trim()

/**
 * GET /api/promotions/master
 *   • ไม่ส่ง plate  → คืน array โปรโมชั่นตั้งต้นทุกคัน (ใช้ใน /contracts/new)
 *   • ส่ง ?plate=   → คืน { found, summary, ... } ของรถคันนั้น (ใช้ในใบเสนอราคา /quotations)
 */
export async function GET(req: NextRequest) {
  const plate = req.nextUrl.searchParams.get("plate")?.trim() ?? ""
  const client = await clientPromise
  const db = client.db(DB)
  const all = await db.collection("promotion_master").find({}).sort({ licensePlate: 1 }).toArray()

  // ── ไม่ระบุทะเบียน → array ทั้งหมด (backward-compatible กับ contracts/new) ──
  if (!plate) {
    return NextResponse.json(all.map((d) => ({
      licensePlate:           d.licensePlate,
      pro1FreeCount:          d.pro1FreeCount,
      pro1TotalValue:         d.pro1TotalValue,
      pro1InstallmentValue:   d.pro1InstallmentValue,
      pro1Condition:          d.pro1Condition,
      pro1FreeAtInstallments: d.pro1FreeAtInstallments,
      pro2RepairBudget:       d.pro2RepairBudget,
      pro3AnnualPm:           d.pro3AnnualPm,
    })))
  }

  // ── ระบุทะเบียน → สรุปข้อความพร้อมใช้ในใบเสนอราคา ──
  const m = all.find((p) => norm(p.licensePlate as string) === norm(plate))
  if (!m) return NextResponse.json({ found: false, summary: "" })
  const n = (v: unknown) => (typeof v === "number" ? v : 0)
  return NextResponse.json({
    found: true, summary: promotionSummary(m as Record<string, unknown>),
    pro1TotalValue: n(m.pro1TotalValue), pro2RepairBudget: n(m.pro2RepairBudget), pro3AnnualPm: n(m.pro3AnnualPm),
  })
}
