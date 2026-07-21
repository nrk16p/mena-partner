import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { diffFields, logActivity } from "@/lib/activity-log"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "contracts"

type Ctx = { params: Promise<{ id: string }> }

// field ที่ log การแก้ไข — เน้นการเงิน/กฎหมาย/วันที่ (ไม่ log พวก url ไฟล์แนบ ที่ log แยกแล้ว)
const AUDIT_FIELDS = [
  "contractDate", "startDate", "buyerName", "driverName", "licensePlate", "truckNumber",
  "totalPrice", "downPayment", "cashDown", "remainingInstallment", "downInstallmentAmt",
  "downInstallmentCount", "financeAmount", "monthlyInstallment", "totalInstallments",
  "accountNumber", "bankName", "nationalId", "status",
  "guarantorName", "guarantorNationalId",
]

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const item   = await col.findOne({ _id: new ObjectId(id) })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id }   = await params
  const body     = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, createdAt, contractCode: _cc, ...update } = body

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const now    = new Date().toISOString()

  const before = await col.findOne({ _id: new ObjectId(id) })

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...update, updatedAt: now } },
    { returnDocument: "after" }
  )
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // audit: log เฉพาะ field การเงิน/กฎหมายที่เปลี่ยนจริง
  const changes = diffFields(before, update, AUDIT_FIELDS)
  if (Object.keys(changes).length > 0) {
    const session = await getServerSession(authOptions)
    await logActivity({
      entity: "contract",
      entityId: result.contractCode as string,
      action: "edit",
      changes,
      editedBy: { email: session?.user?.email ?? "unknown", name: session?.user?.name ?? undefined },
    })
  }

  // Sync driver document
  const drivers = client.db(DB).collection("drivers")
  await drivers.updateOne(
    { contractCode: result.contractCode },
    { $set: {
        buyerName:    result.buyerName,
        driverName:   result.driverName,
        truckNumber:  result.truckNumber,
        licensePlate: result.licensePlate,
        phone:        result.phone,
        plant:        result.plant,
      }
    }
  )

  return NextResponse.json(result)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  await col.deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ok: true })
}
