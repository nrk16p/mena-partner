import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"
import { normPlateIT } from "@/lib/insurance-tax"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "vehicle_insurance_tax"

type Ctx = { params: Promise<{ id: string }> }

const COST_FIELDS = ["insuranceAmount", "prbAmount", "taxAmount", "inspectionCost"] as const

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body   = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, createdAt, platePlain: _pp, ...update } = body

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const now    = new Date().toISOString()

  const existing = await col.findOne({ _id: new ObjectId(id) })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // ทะเบียนเปลี่ยน → คำนวณ platePlain ใหม่
  if (typeof update.licensePlate === "string") {
    update.platePlain = normPlateIT(update.licensePlate) || update.licensePlate
  }

  // ถ้ามีการแก้ field ต้นทุน แต่ไม่ได้ส่ง totalCost มา → คำนวณรวมใหม่จากค่าที่ merge แล้ว
  const costTouched = COST_FIELDS.some((f) => f in update)
  if (costTouched && !("totalCost" in update)) {
    const merged = { ...existing, ...update }
    update.totalCost = COST_FIELDS.reduce(
      (s, f) => s + (typeof merged[f] === "number" ? (merged[f] as number) : 0),
      0
    )
  }

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...update, updatedAt: now } },
    { returnDocument: "after" }
  )
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(result)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  await col.deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ok: true })
}
