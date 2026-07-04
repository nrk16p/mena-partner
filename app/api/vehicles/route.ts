import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "vehicle_master"

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
  }

  const now = new Date()
  const client = await clientPromise
  const result = await client.db(DB).collection(COLL).insertOne({
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
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ ok: true, id: result.insertedId.toHexString() })
}
