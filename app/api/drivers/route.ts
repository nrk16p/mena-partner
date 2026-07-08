import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "drivers"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q      = searchParams.get("q")?.trim() ?? ""
  const status = searchParams.get("status")?.trim() ?? ""

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (q) {
    filter["$or"] = [
      { firstName:  { $regex: q, $options: "i" } },
      { lastName:   { $regex: q, $options: "i" } },
      { nationalId: { $regex: q, $options: "i" } },
      { staffCode:  { $regex: q, $options: "i" } },
      { phone:      { $regex: q, $options: "i" } },
      { address:    { $regex: q, $options: "i" } },
    ]
  }
  if (status) filter.status = status

  const client = await clientPromise
  const items  = await client.db(DB).collection(COLL)
    .find(filter)
    .sort({ firstName: 1, lastName: 1 })
    .toArray()

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    firstName:     string
    lastName:      string
    birthDate?:    string
    nationalId?:   string
    address?:      string
    contractCode?: string
    staffCode?:     string
    phone?:         string
    bankName?:      string
    accountNumber?: string
    idCardUrl?:      string
    licenseUrl?:     string
    houseRegUrl?:    string
    licenseNumber?:  string
    licenseType?:    string
    licenseExpiry?:  string
    isTruckOwner?: boolean
    isDriver?:     boolean
    startDate?:    string
    endDate?:      string
    status?:       string
  }

  if (!body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json({ error: "firstName and lastName required" }, { status: 400 })
  }

  const now = new Date()
  const client = await clientPromise
  const result = await client.db(DB).collection(COLL).insertOne({
    firstName:    body.firstName.trim(),
    lastName:     body.lastName.trim(),
    birthDate:    body.birthDate?.trim()  ?? null,
    nationalId:   body.nationalId?.trim() ?? null,
    address:      body.address?.trim()    ?? null,
    staffCode:     body.staffCode?.trim()     ?? null,
    contractCode:  body.contractCode?.trim()  ?? null,   // ซ้ำกันได้ — ไม่เช็ค unique
    phone:         body.phone?.trim()         ?? null,
    bankName:      body.bankName?.trim()      ?? null,
    accountNumber: body.accountNumber?.trim() ?? null,
    idCardUrl:      body.idCardUrl?.trim()      ?? null,
    licenseUrl:     body.licenseUrl?.trim()     ?? null,
    houseRegUrl:    body.houseRegUrl?.trim()    ?? null,
    licenseNumber:  body.licenseNumber?.trim()  ?? null,
    licenseType:    body.licenseType?.trim()    ?? null,
    licenseExpiry:  body.licenseExpiry?.trim()  ?? null,
    isTruckOwner: body.isTruckOwner      ?? false,
    isDriver:     body.isDriver          ?? true,
    startDate:    body.startDate?.trim()  ?? null,
    endDate:      body.endDate?.trim()    ?? null,
    status:       body.status            ?? "active",
    createdAt:    now,
    updatedAt:    now,
  })

  return NextResponse.json({ ok: true, id: result.insertedId.toHexString() })
}
