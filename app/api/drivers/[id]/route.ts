import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "drivers"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const db     = client.db(DB)
  const driver = await db.collection(COLL).findOne({ _id: new ObjectId(id) })
  if (!driver) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Attach last 6 months of payroll
  const payroll = await db.collection("payroll_entries")
    .find({ contractCode: driver.contractCode })
    .sort({ month: -1 })
    .limit(6)
    .toArray()

  return NextResponse.json({ ...driver, payrollHistory: payroll })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { status } = await req.json()
  if (!["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status } },
    { returnDocument: "after" }
  )
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(result)
}
