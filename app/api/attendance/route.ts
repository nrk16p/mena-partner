import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { ATT_COLL } from "@/lib/attendance"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? ""
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "month=YYYY-MM required" }, { status: 400 })
  const client = await clientPromise
  const rows = await client.db(DB).collection(ATT_COLL).find({ month }).sort({ driverName: 1 }).toArray()
  return NextResponse.json(rows.map((r) => ({ ...r, _id: r._id.toString() })))
}
