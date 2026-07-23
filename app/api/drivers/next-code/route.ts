import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

/**
 * รหัสพนักงานถัดไป = เลขสูงสุด + 1 (ชุดเดียวกับรหัสสัญญา เช่น MTM191 → MTM192)
 * ดูจากทั้ง drivers.staffCode และ contracts.contractCode กันเลขชน
 */
export async function GET() {
  const client = await clientPromise
  const db = client.db(DB)
  const [drivers, contracts] = await Promise.all([
    db.collection("drivers").find({}, { projection: { staffCode: 1 } }).toArray(),
    db.collection("contracts").find({}, { projection: { contractCode: 1 } }).toArray(),
  ])

  let max = 0
  let prefix = "MTM"
  const scan = (v: unknown) => {
    const m = String(v ?? "").trim().match(/^([A-Za-z]+)[-\s]?(\d+)$/)
    if (!m) return
    const n = parseInt(m[2], 10)
    if (!isNaN(n) && n > max) { max = n; prefix = m[1] }
  }
  for (const d of drivers) scan(d.staffCode)
  for (const c of contracts) scan(c.contractCode)

  return NextResponse.json({ code: `${prefix}${String(max + 1).padStart(3, "0")}` })
}
