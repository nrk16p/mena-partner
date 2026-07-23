import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { diffFields, logActivity } from "@/lib/activity-log"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "vehicle_master"

const normPlate = (p?: string | null) => (p ?? "").replace(/^[^0-9]*/, "").trim()

const AUDIT_FIELDS = ["truckType", "status", "licensePlate", "brand", "model"]

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client  = await clientPromise
  const doc     = await client.db(DB).collection(COLL).findOne({ _id: new ObjectId(id) })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(doc)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json() as {
    truckType?:        string | null
    vehicleType?:      string | null
    characteristic?:   string | null
    brand?:            string | null
    model?:            string | null
    registrationDate?: string | null
    color?:            string | null
    licensePlate?:     string | null
    truckNumber?:      string | null
    chassisNumber?:    string | null
    engineNumber?:     string | null
    engineSize?:           string | null
    status?:               string
    registrationDocUrl?:   string | null
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() }
  const str = (v: string | null | undefined) => v?.trim() ?? null
  if (body.truckType            !== undefined) $set.truckType            = body.truckType === "trailer" ? "trailer" : "mixer"
  if (body.vehicleType          !== undefined) $set.vehicleType          = str(body.vehicleType)
  if (body.characteristic       !== undefined) $set.characteristic       = str(body.characteristic)
  if (body.brand                !== undefined) $set.brand                = str(body.brand)
  if (body.model                !== undefined) $set.model                = str(body.model)
  if (body.registrationDate     !== undefined) $set.registrationDate     = str(body.registrationDate)
  if (body.color                !== undefined) $set.color                = str(body.color)
  if (body.licensePlate         !== undefined) $set.licensePlate         = str(body.licensePlate)
  if (body.truckNumber          !== undefined) $set.truckNumber          = str(body.truckNumber)
  if (body.chassisNumber        !== undefined) $set.chassisNumber        = str(body.chassisNumber)
  if (body.engineNumber         !== undefined) $set.engineNumber         = str(body.engineNumber)
  if (body.engineSize           !== undefined) $set.engineSize           = str(body.engineSize)
  if (body.status               !== undefined) $set.status               = body.status
  if (body.registrationDocUrl   !== undefined) $set.registrationDocUrl   = str(body.registrationDocUrl)

  const client = await clientPromise
  const col = client.db(DB).collection(COLL)

  // กันทะเบียนซ้ำกับคันอื่น (เทียบแบบ normalize)
  if (body.licensePlate !== undefined && normPlate(body.licensePlate)) {
    const key = normPlate(body.licensePlate)
    const rows = await col.find({}, { projection: { licensePlate: 1 } }).toArray()
    const dup = rows.find((v) => normPlate(v.licensePlate as string) === key && v._id.toString() !== id)
    if (dup) return NextResponse.json({ error: `ทะเบียน ${body.licensePlate} มีอยู่แล้วในระบบ` }, { status: 409 })
  }

  const before = await col.findOne({ _id: new ObjectId(id) })
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set },
    { returnDocument: "after" }
  )

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // audit: log เฉพาะ ประเภท/สถานะ/ทะเบียน/ยี่ห้อ/รุ่น ที่เปลี่ยน
  const changes = diffFields(before, $set, AUDIT_FIELDS)
  if (Object.keys(changes).length > 0) {
    const session = await getServerSession(authOptions)
    await logActivity({
      entity: "vehicle",
      entityId: id,
      action: "edit",
      changes,
      editedBy: { email: session?.user?.email ?? "unknown", name: session?.user?.name ?? undefined },
    })
  }
  return NextResponse.json(result)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client  = await clientPromise
  const result  = await client.db(DB).collection(COLL).deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
