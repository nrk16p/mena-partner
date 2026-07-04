import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import type { Contract, Driver } from "@/types"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "contracts"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q      = searchParams.get("q")?.trim() ?? ""
  const status = searchParams.get("status")?.trim() ?? ""
  const plant  = searchParams.get("plant")?.trim() ?? ""

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (q) {
    filter["$or"] = [
      { contractCode: { $regex: q, $options: "i" } },
      { buyerName:    { $regex: q, $options: "i" } },
      { driverName:   { $regex: q, $options: "i" } },
      { licensePlate: { $regex: q, $options: "i" } },
      { truckNumber:  { $regex: q, $options: "i" } },
      { phone:        { $regex: q, $options: "i" } },
      { plant:        { $regex: q, $options: "i" } },
    ]
  }
  if (status) filter.status = status
  if (plant)  filter.plant  = { $regex: plant, $options: "i" }

  const items = await col
    .find(filter)
    .sort({ contractCode: 1 })
    .project({ notes: 0 })
    .toArray()

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const body: Contract = await req.json()

  if (!body.contractCode || !body.buyerName || !body.driverName) {
    return NextResponse.json({ error: "contractCode, buyerName, driverName required" }, { status: 400 })
  }

  const client    = await clientPromise
  const contracts = client.db(DB).collection(COLL)
  const drivers   = client.db(DB).collection("drivers")

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = body
  const doc = { ...rest, createdAt: now, updatedAt: now }

  const existing = await contracts.findOne({ contractCode: body.contractCode })
  if (existing) {
    return NextResponse.json({ error: "contractCode already exists" }, { status: 409 })
  }

  const result = await contracts.insertOne(doc)

  // Auto-create driver document
  const driverDoc: Driver = {
    firstName:    body.driverName ?? body.buyerName ?? "",
    lastName:     "",
    contractCode: body.contractCode,
    buyerName:    body.buyerName,
    driverName:   body.driverName,
    truckNumber:  body.truckNumber,
    licensePlate: body.licensePlate,
    phone:        body.phone,
    status:       "active",
    createdAt:    now,
  }
  await drivers.updateOne(
    { contractCode: body.contractCode },
    { $setOnInsert: driverDoc },
    { upsert: true }
  )

  return NextResponse.json({ _id: result.insertedId, ...doc }, { status: 201 })
}
