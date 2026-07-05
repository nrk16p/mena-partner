import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

// ยืนยัน/ยกเลิกการตัดงบของ claim (กติกา: ทีมต้องระบุก่อน งบถึงถูกตัด)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    return NextResponse.json({ error: "invalid id" }, { status: 400 })
  }
  const body = await req.json()
  if (typeof body.confirmed !== "boolean") {
    return NextResponse.json({ error: "confirmed (boolean) required" }, { status: 400 })
  }
  const client = await clientPromise
  const db = client.db(DB)
  const result = await db.collection("repair_claims").updateOne(
    { _id: oid },
    { $set: { confirmed: body.confirmed, confirmedAt: body.confirmed ? new Date() : null } }
  )
  if (result.matchedCount === 0) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    return NextResponse.json({ error: "invalid id" }, { status: 400 })
  }
  const client = await clientPromise
  const db = client.db(DB)
  const result = await db.collection("repair_claims").deleteOne({ _id: oid })
  if (result.deletedCount === 0) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
