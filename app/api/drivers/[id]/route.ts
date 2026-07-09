import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "drivers"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client  = await clientPromise
  const driver  = await client.db(DB).collection(COLL)
    .findOne({ _id: new ObjectId(id) })
  if (!driver) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(driver)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json() as {
    firstName?:     string
    lastName?:      string
    birthDate?:     string | null
    nationalId?:    string | null
    address?:       string | null
    addressDetail?: string | null
    subdistrict?:   string | null
    district?:      string | null
    province?:      string | null
    postalCode?:    string | null
    staffCode?:      string | null
    contractCode?:   string | null
    phone?:          string | null
    bankName?:       string | null
    accountNumber?:  string | null
    idCardUrl?:      string | null
    licenseUrl?:     string | null
    houseRegUrl?:    string | null
    licenseNumber?:  string | null
    licenseType?:    string | null
    licenseExpiry?:  string | null
    isTruckOwner?:   boolean
    isDriver?:      boolean
    startDate?:     string | null
    endDate?:       string | null
    status?:        string
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() }
  if (body.firstName    !== undefined) $set.firstName    = body.firstName?.trim() ?? ""
  if (body.lastName     !== undefined) $set.lastName     = body.lastName?.trim() ?? ""
  if (body.birthDate    !== undefined) $set.birthDate    = body.birthDate ?? null
  if (body.nationalId   !== undefined) $set.nationalId   = body.nationalId?.trim() ?? null
  if (body.address      !== undefined) $set.address      = body.address?.trim() ?? null
  if (body.addressDetail !== undefined) $set.addressDetail = body.addressDetail?.trim() ?? null
  if (body.subdistrict  !== undefined) $set.subdistrict  = body.subdistrict?.trim() ?? null
  if (body.district     !== undefined) $set.district     = body.district?.trim() ?? null
  if (body.province     !== undefined) $set.province     = body.province?.trim() ?? null
  if (body.postalCode   !== undefined) $set.postalCode   = body.postalCode?.trim() ?? null
  if (body.staffCode    !== undefined) $set.staffCode    = body.staffCode?.trim() ?? null
  // รหัสสัญญาซ้ำกันได้ (หลายคนอยู่ใต้สัญญาเดียวกัน) — ไม่เช็ค unique
  if (body.contractCode !== undefined) $set.contractCode = body.contractCode?.trim() ?? null
  if (body.phone         !== undefined) $set.phone         = body.phone?.trim()         ?? null
  if (body.bankName      !== undefined) $set.bankName      = body.bankName?.trim()      ?? null
  if (body.accountNumber !== undefined) $set.accountNumber = body.accountNumber?.trim() ?? null
  if (body.idCardUrl      !== undefined) $set.idCardUrl      = body.idCardUrl?.trim()     ?? null
  if (body.licenseUrl     !== undefined) $set.licenseUrl     = body.licenseUrl?.trim()    ?? null
  if (body.houseRegUrl    !== undefined) $set.houseRegUrl    = body.houseRegUrl?.trim()   ?? null
  if (body.licenseNumber  !== undefined) $set.licenseNumber  = body.licenseNumber?.trim() ?? null
  if (body.licenseType    !== undefined) $set.licenseType    = body.licenseType?.trim()   ?? null
  if (body.licenseExpiry  !== undefined) $set.licenseExpiry  = body.licenseExpiry?.trim() ?? null
  if (body.isTruckOwner   !== undefined) $set.isTruckOwner   = body.isTruckOwner
  if (body.isDriver     !== undefined) $set.isDriver     = body.isDriver
  if (body.startDate    !== undefined) $set.startDate    = body.startDate ?? null
  if (body.endDate      !== undefined) $set.endDate      = body.endDate ?? null
  if (body.status       !== undefined) {
    if (!["active", "inactive"].includes(body.status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    $set.status = body.status
  }

  const client = await clientPromise
  const result = await client.db(DB).collection(COLL)
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set },
      { returnDocument: "after" }
    )

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(result)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client  = await clientPromise
  const result  = await client.db(DB).collection(COLL)
    .deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
