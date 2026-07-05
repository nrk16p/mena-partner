import { NextRequest, NextResponse } from "next/server"
import { ObjectId, AnyBulkWriteOperation } from "mongodb"
import clientPromise from "@/lib/mongo"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q     = searchParams.get("q")?.trim()     ?? ""
  const group = searchParams.get("group")?.trim() ?? ""

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}
  if (group) filter.itemGroup = group

  if (q) {
    filter["$or"] = [
      { itemName:     { $regex: q, $options: "i" } },
      { itemCode:     { $regex: q, $options: "i" } },
      { itemGroup:    { $regex: q, $options: "i" } },
      { truckNumber:  { $regex: q, $options: "i" } },
      { driverName:   { $regex: q, $options: "i" } },
      { licensePlate: { $regex: q, $options: "i" } },
      { mr:           { $regex: q, $options: "i" } },
      { wd:           { $regex: q, $options: "i" } },
      { purpose:      { $regex: q, $options: "i" } },
    ]
  }

  const client = await clientPromise
  const db     = client.db(process.env.MONGO_DB ?? "mena_partner")

  const docs = await db
    .collection("stock_movements")
    .find(filter)
    .sort({ date: -1, wd: 1 })
    .toArray()

  return NextResponse.json(docs.map((d) => ({ ...d, _id: d._id.toString() })))
}

// PATCH — bulk-set promoType on multiple movement items at once
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { updates?: { id: string; promoType: string; pmType?: string }[] }
  const updates = body.updates ?? []

  if (updates.length === 0) {
    return NextResponse.json({ error: "updates required" }, { status: 400 })
  }
  for (const u of updates) {
    if (!["", "repair", "pm"].includes(u.promoType)) {
      return NextResponse.json({ error: `invalid promoType: ${u.promoType}` }, { status: 400 })
    }
    // pmType ระบุประเภทสิทธิ์เมื่อ promoType = "pm" (ทำให้ป้าย PM1/PM2 ติดจากคลังได้)
    if (u.pmType !== undefined && !["", "PM1", "PM2"].includes(u.pmType)) {
      return NextResponse.json({ error: `invalid pmType: ${u.pmType}` }, { status: 400 })
    }
  }

  const client = await clientPromise
  const now    = new Date()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: AnyBulkWriteOperation<any>[] = updates.map((u) => ({
    updateOne: {
      filter: { _id: new ObjectId(u.id) },
      update: {
        $set: {
          promoType: u.promoType,
          pmType: u.promoType === "pm" ? (u.pmType ?? "") : "",
          updatedAt: now,
        },
      },
    },
  }))

  const result = await client.db(process.env.MONGO_DB ?? "mena_partner")
    .collection("stock_movements")
    .bulkWrite(ops)

  return NextResponse.json({ ok: true, modified: result.modifiedCount, matched: result.matchedCount })
}
