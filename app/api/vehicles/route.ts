import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "vehicle_master"

// normalize ทะเบียน — ตัดคำนำหน้าที่ไม่ใช่เลข (สบ.71-1956 → 71-1956) เทียบกันแบบ digits
const normPlate = (p?: string | null) => (p ?? "").replace(/^[^0-9]*/, "").trim()

/** หารถที่ทะเบียนซ้ำ (normalize) — คืน doc ถ้าเจอ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findPlateDuplicate(db: any, plate: string) {
  const key = normPlate(plate)
  if (!key) return null
  const rows = await db.collection(COLL).find({}, { projection: { licensePlate: 1 } }).toArray()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.find((v: any) => normPlate(v.licensePlate) === key) ?? null
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q      = searchParams.get("q")?.trim() ?? ""
  const status = searchParams.get("status")?.trim() ?? ""

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (q) {
    filter["$or"] = [
      { licensePlate:  { $regex: q, $options: "i" } },
      { truckNumber:   { $regex: q, $options: "i" } },
      { brand:         { $regex: q, $options: "i" } },
      { model:         { $regex: q, $options: "i" } },
      { chassisNumber: { $regex: q, $options: "i" } },
      { engineNumber:  { $regex: q, $options: "i" } },
      { vehicleType:   { $regex: q, $options: "i" } },
    ]
  }
  if (status) filter.status = status

  const client = await clientPromise
  const items  = await client.db(DB).collection(COLL)
    .find(filter)
    .sort({ truckNumber: 1, licensePlate: 1 })
    .toArray()

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    truckType?:        string
    vehicleType?:      string
    characteristic?:   string
    brand?:            string
    model?:            string
    registrationDate?: string
    color?:            string
    licensePlate?:     string
    truckNumber?:      string
    chassisNumber?:    string
    engineNumber?:     string
    engineSize?:           string
    status?:               string
    registrationDocUrl?:   string
    dataComplete?:         boolean
    dataExpectedDate?:     string
  }

  const now = new Date()
  const client = await clientPromise
  const db = client.db(DB)

  // กันทะเบียนซ้ำ
  const plate = body.licensePlate?.trim() ?? ""
  if (plate) {
    const dup = await findPlateDuplicate(db, plate)
    if (dup) return NextResponse.json({ error: `ทะเบียน ${plate} มีอยู่แล้วในระบบ` }, { status: 409 })
  }

  const result = await db.collection(COLL).insertOne({
    truckType:            body.truckType === "trailer" ? "trailer" : "mixer",
    vehicleType:          body.vehicleType?.trim()          ?? null,
    characteristic:       body.characteristic?.trim()       ?? null,
    brand:                body.brand?.trim()                ?? null,
    model:                body.model?.trim()                ?? null,
    registrationDate:     body.registrationDate?.trim()     ?? null,
    color:                body.color?.trim()                ?? null,
    licensePlate:         body.licensePlate?.trim()         ?? null,
    truckNumber:          body.truckNumber?.trim()          ?? null,
    chassisNumber:        body.chassisNumber?.trim()        ?? null,
    engineNumber:         body.engineNumber?.trim()         ?? null,
    engineSize:           body.engineSize?.trim()           ?? null,
    status:               body.status                       ?? "active",
    registrationDocUrl:   body.registrationDocUrl?.trim()   ?? null,
    dataComplete:         body.dataComplete === true,
    dataExpectedDate:     body.dataExpectedDate?.trim()     ?? null,
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ ok: true, id: result.insertedId.toHexString() })
}
