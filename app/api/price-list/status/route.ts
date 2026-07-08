import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "master_price_list"

const SALE_STATUSES = new Set(["ready", "repair15", "repair30", "review"])

/**
 * POST /api/price-list/status — ตั้งสถานะความพร้อมขายของทะเบียนรถ
 * body: { licensePlate, saleStatus: ready|repair15|repair30|review|null, repairStart?, repairEnd? }
 * (middleware บังคับ admin สำหรับ method ที่ไม่ใช่ GET อยู่แล้ว)
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    licensePlate?: string
    saleStatus?:   string | null
    repairStart?:  string | null
    repairEnd?:    string | null
  }

  const plate = body.licensePlate?.trim()
  if (!plate) return NextResponse.json({ error: "licensePlate required" }, { status: 400 })

  const saleStatus = body.saleStatus && SALE_STATUSES.has(body.saleStatus) ? body.saleStatus : null
  const isRepair   = saleStatus === "repair15" || saleStatus === "repair30"

  const client = await clientPromise
  const result = await client.db(DB).collection(COLL).updateOne(
    { licensePlate: plate },
    {
      $set: {
        saleStatus,
        repairStart: isRepair ? (body.repairStart ?? null) : null,
        repairEnd:   isRepair ? (body.repairEnd   ?? null) : null,
        updatedAt:   new Date().toISOString(),
      },
    }
  )
  if (result.matchedCount === 0)
    return NextResponse.json({ error: "ไม่พบทะเบียนนี้ใน price list" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
