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
