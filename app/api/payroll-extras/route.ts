import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { EXTRA_TYPE_MAP } from "@/lib/payroll-extras"
import { normPlate } from "@/lib/promo-usage"

const DB = process.env.MONGO_DB ?? "mena_partner"
const COLL = "payroll_extras"
const MONTH_RE = /^\d{4}-\d{2}$/

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? ""
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "month=YYYY-MM required" }, { status: 400 })
  const client = await clientPromise
  const rows = await client.db(DB).collection(COLL).find({ month }).sort({ kind: 1, type: 1, driverName: 1 }).toArray()
  return NextResponse.json(rows.map((r: any) => ({ ...r, _id: r._id.toString() })))
}

// POST — เพิ่มรายการเดี่ยว { month, type, contractCode?, driverName?, licensePlate?, amount, wht?, note? }
// หรือ batch นำเข้า { month, type, action: "import", lines: [{ ref, amount, note? }] } — ref = สัญญา/ทะเบียน/ชื่อ
export async function POST(req: NextRequest) {
  const body = await req.json() as any
  const month = String(body.month ?? "")
  const t = EXTRA_TYPE_MAP[String(body.type ?? "")]
  if (!MONTH_RE.test(month) || !t) return NextResponse.json({ error: "month + type ไม่ถูกต้อง" }, { status: 400 })

  const client = await clientPromise
  const db = client.db(DB)
  const session = await getServerSession(authOptions)
  const now = new Date().toISOString()
  const by = session?.user?.email ?? "unknown"

  if (body.action === "import") {
    // จับคู่ ref → สัญญา: รหัสสัญญา > ทะเบียน (normalize) > ชื่อคนขับ
    const contracts = await db.collection("contracts").find({})
      .project({ contractCode: 1, licensePlate: 1, driverName: 1, buyerName: 1, status: 1 }).toArray()
    const byCC = new Map(contracts.map((c: any) => [String(c.contractCode).toUpperCase(), c]))
    const byPlate = new Map<string, any>()
    const byName = new Map<string, any>()
    for (const c of contracts) {
      const p = normPlate(c.licensePlate as string)
      if (p && (!byPlate.has(p) || c.status === "active")) byPlate.set(p, c)
      for (const n of [c.driverName, c.buyerName]) {
        const k = String(n ?? "").replace(/\s+/g, "").trim()
        if (k && (!byName.has(k) || c.status === "active")) byName.set(k, c)
      }
    }
    const lines = Array.isArray(body.lines) ? body.lines : []
    const docs: any[] = []
    const unmatched: any[] = []
    const batch = `imp-${Date.now()}`
    for (const ln of lines) {
      const ref = String(ln.ref ?? "").trim()
      const amount = Number(ln.amount) || 0
      if (!ref || amount === 0) continue
      const c = byCC.get(ref.toUpperCase()) ?? byPlate.get(normPlate(ref)) ?? byName.get(ref.replace(/\s+/g, ""))
      if (!c) { unmatched.push({ ref, amount }); continue }
      docs.push({
        month, kind: t.kind, type: t.key, label: t.label,
        contractCode: c.contractCode, driverName: c.driverName ?? c.buyerName, licensePlate: c.licensePlate,
        amount: Math.round(amount * 100) / 100,
        wht: body.wht !== undefined ? !!body.wht : t.wht,
        note: String(ln.note ?? "").trim() || null,
        source: "import", importBatch: batch, createdBy: by, createdAt: now,
      })
    }
    if (body.preview === true) return NextResponse.json({ matched: docs.length, unmatched, sample: docs.slice(0, 5) })
    if (docs.length > 0) await db.collection(COLL).insertMany(docs)
    return NextResponse.json({ ok: true, inserted: docs.length, unmatched })
  }

  // เพิ่มเดี่ยว
  const amount = Number(body.amount) || 0
  const contractCode = String(body.contractCode ?? "").trim()
  if (!contractCode || amount === 0) return NextResponse.json({ error: "contractCode + amount required" }, { status: 400 })
  await db.collection(COLL).insertOne({
    month, kind: t.kind, type: t.key, label: t.label,
    contractCode, driverName: String(body.driverName ?? "").trim() || null,
    licensePlate: String(body.licensePlate ?? "").trim() || null,
    amount: Math.round(amount * 100) / 100,
    wht: body.wht !== undefined ? !!body.wht : t.wht,
    note: String(body.note ?? "").trim() || null,
    source: "manual", createdBy: by, createdAt: now,
  })
  return NextResponse.json({ ok: true })
}

// PATCH { id, amount?, wht?, note? }
export async function PATCH(req: NextRequest) {
  const body = await req.json() as any
  if (!body.id || !ObjectId.isValid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
  const $set: any = {}
  if (body.amount !== undefined) $set.amount = Math.round((Number(body.amount) || 0) * 100) / 100
  if (body.wht !== undefined) $set.wht = !!body.wht
  if (body.note !== undefined) $set.note = String(body.note).trim() || null
  const client = await clientPromise
  await client.db(DB).collection(COLL).updateOne({ _id: new ObjectId(body.id) }, { $set })
  return NextResponse.json({ ok: true })
}

// DELETE { id } | { importBatch } — middleware บังคับ admin+
export async function DELETE(req: NextRequest) {
  const body = await req.json() as any
  const client = await clientPromise
  const col = client.db(DB).collection(COLL)
  if (body.importBatch) {
    const r = await col.deleteMany({ importBatch: String(body.importBatch) })
    return NextResponse.json({ ok: true, deleted: r.deletedCount })
  }
  if (!body.id || !ObjectId.isValid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
  await col.deleteOne({ _id: new ObjectId(body.id) })
  return NextResponse.json({ ok: true })
}
