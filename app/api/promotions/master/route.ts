import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"
const norm = (s: string) => (s ?? "").replace(/\s+/g, "").replace(/^สบ\.?/, "").trim()

/**
 * GET /api/promotions/master?plate=<ทะเบียน>
 * โปรโมชั่นตั้งต้นของรถ (promotion_master) + สรุปข้อความพร้อมใช้ในใบเสนอราคา
 */
export async function GET(req: NextRequest) {
  const plate = req.nextUrl.searchParams.get("plate")?.trim() ?? ""
  if (!plate) return NextResponse.json({ error: "plate required" }, { status: 400 })
  const client = await clientPromise
  const db = client.db(DB)
  const all = await db.collection("promotion_master").find({}).toArray()
  const m = all.find((p) => norm(p.licensePlate as string) === norm(plate))
  if (!m) return NextResponse.json({ found: false, summary: "" })

  const n = (v: unknown) => (typeof v === "number" ? v : 0)
  const fm = (v: number) => v.toLocaleString("th-TH")
  const lines: string[] = []
  if (n(m.pro1TotalValue) > 0 || m.pro1Condition) {
    const cond = (m.pro1Condition as string) || "ฟรีค่างวด"
    lines.push(`ฟรีค่างวด (${cond})${n(m.pro1FreeCount) ? ` ฟรี ${m.pro1FreeCount} งวด` : ""}${n(m.pro1TotalValue) ? ` รวม ${fm(n(m.pro1TotalValue))} บาท` : ""}`)
  }
  if (n(m.pro2RepairBudget) > 0) lines.push(`ฟรีค่าซ่อมบำรุง วงเงิน ${fm(n(m.pro2RepairBudget))} บาท`)
  if (n(m.pro3AnnualPm) > 0) lines.push(`ฟรี PM (บำรุงรักษาเชิงป้องกัน) ${fm(n(m.pro3AnnualPm))} บาท/ปี ตลอดสัญญา`)

  return NextResponse.json({
    found: true,
    summary: lines.join(" · "),
    pro1TotalValue: n(m.pro1TotalValue), pro2RepairBudget: n(m.pro2RepairBudget), pro3AnnualPm: n(m.pro3AnnualPm),
  })
}
