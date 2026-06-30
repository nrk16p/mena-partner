import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { computePayroll } from "@/lib/utils"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "payroll_entries"

type Ctx = { params: Promise<{ month: string; contractCode: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { month, contractCode } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const item   = await col.findOne({ month, contractCode })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { month, contractCode } = await params
  const body   = await req.json()
  const computed = computePayroll(body)
  const now    = new Date().toISOString()

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)

  const result = await col.findOneAndUpdate(
    { month, contractCode },
    { $set: { ...body, ...computed, updatedAt: now } },
    { returnDocument: "after", upsert: true }
  )
  return NextResponse.json(result)
}
