import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { diffFields, logActivity } from "@/lib/activity-log"
import { normPlateIT } from "@/lib/insurance-tax"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "vehicle_insurance_tax"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body   = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, createdAt, platePlain: _pp, ...update } = body

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const now    = new Date().toISOString()

  // ทะเบียนเปลี่ยน → คำนวณ platePlain ใหม่
  if (typeof update.licensePlate === "string") {
    update.platePlain = normPlateIT(update.licensePlate) || update.licensePlate
  }

  const before = await col.findOne({ _id: new ObjectId(id) })
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...update, updatedAt: now } },
    { returnDocument: "after" }
  )
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const changes = diffFields(before, result, [
    "amount", "effectiveDate", "expiryDate", "company",
    "monthlyInstallment", "installmentCount", "collectStart", "collectEnd", "status",
  ])
  if (Object.keys(changes).length > 0) {
    const session = await getServerSession(authOptions)
    await logActivity({
      entity: "insurance_tax",
      entityId: (before.platePlain as string) ?? "",
      action: "edit",
      changes: { ประเภท: { from: null, to: before.itemType ?? null }, ...changes },
      editedBy: { email: session?.user?.email ?? "unknown", name: session?.user?.name ?? undefined },
    })
  }

  return NextResponse.json(result)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  await col.deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ok: true })
}
