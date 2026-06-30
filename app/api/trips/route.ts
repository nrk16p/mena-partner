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
    const [yearStr, monthStr] = month.split("-")
    const year = parseInt(yearStr)
    const mon  = parseInt(monthStr)
    const startStr = `${yearStr}-${monthStr.padStart(2, "0")}-01`
    const nextYear = mon === 12 ? year + 1 : year
    const nextMon  = mon === 12 ? 1 : mon + 1
    const endStr   = `${nextYear}-${String(nextMon).padStart(2, "0")}-01`
    filter.date = { $gte: startStr, $lt: endStr }
  }

  const items = await col.find(filter).sort({ date: -1, contractCode: 1 }).limit(500).toArray()
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
