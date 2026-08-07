import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { QUOTE_COLL, QUOTE_STATUSES, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/quotation"

const DB = process.env.MONGO_DB ?? "mena_partner"
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 })
  const client = await clientPromise
  const doc = await client.db(DB).collection(QUOTE_COLL).findOne({ _id: new ObjectId(id) })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ...doc, _id: String(doc._id) })
}

/** PATCH — เปลี่ยนสถานะ pipeline / เงินจอง / แก้ราคา (บันทึก timeline) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 })
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const b = await req.json()
  const email = session.user?.email ?? "unknown"
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const $set: any = { updatedAt: now }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = []

  if (b.status !== undefined) {
    if (!QUOTE_STATUSES.includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 })
    $set.status = b.status
    events.push({ at: now, by: email, action: `เปลี่ยนสถานะ → ${QUOTE_STATUS_LABEL[b.status as QuoteStatus]}`, ...(b.note ? { note: b.note } : {}) })
  }
  for (const k of ["depositAmount", "totalSalePrice", "downPayment", "cashDown", "downInstallmentCount", "downInstallmentAmt", "financeAmount", "financeInstallments", "monthlyPayment"]) {
    if (b[k] !== undefined) $set[k] = Number(b[k]) || 0
  }
  for (const k of ["depositSlipUrl", "depositPaidAt", "extras", "note", "validUntil", "customerName", "customerPhone",
                   "licensePlate", "vehicleBrand", "vehicleModel", "truckNumber", "vehiclePhotoUrl"]) {
    if (b[k] !== undefined) $set[k] = b[k]
  }
  if (b.depositSlips !== undefined && Array.isArray(b.depositSlips)) $set.depositSlips = b.depositSlips.slice(0, 10)
  if (b.depositAmount !== undefined) events.push({ at: now, by: email, action: `บันทึกเงินจอง ${Number(b.depositAmount).toLocaleString()} บาท` })
  if (b.note && b.status === undefined && b.depositAmount === undefined) events.push({ at: now, by: email, action: "บันทึกกิจกรรม", note: b.note })

  const client = await clientPromise
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { $set }
  if (events.length) update.$push = { timeline: { $each: events } }
  await client.db(DB).collection(QUOTE_COLL).updateOne({ _id: new ObjectId(id) }, update)
  const doc = await client.db(DB).collection(QUOTE_COLL).findOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ...doc, _id: String(doc?._id) })
}
