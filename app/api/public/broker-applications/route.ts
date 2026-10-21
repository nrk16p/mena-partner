import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { allowRequest } from "@/lib/public-lead"
import { parseBrokerApplication, BROKER_COLL } from "@/lib/broker-application"

const DB = process.env.MONGO_DB ?? "mena_partner"

/** ฟอร์มสมัครนายหน้าจากหน้าเว็บ /sales-partner → broker_applications สถานะ pending (ฝ่ายขายตรวจที่ /quotations/brokers) */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!allowRequest(ip)) {
    return NextResponse.json({ error: "ส่งถี่เกินไป รอสักครู่แล้วลองใหม่ หรือโทรหาฝ่ายขาย" }, { status: 429 })
  }

  const parsed = parseBrokerApplication(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 })
  const a = parsed.data

  const db = (await clientPromise).db(DB)
  // เลขบัตรเดิมสมัครซ้ำ → รับไว้ แต่ติดป้ายให้ฝ่ายขายเห็น (ไม่บอกผู้ส่งว่าเลขนี้มีในระบบ กันคนลองสุ่มเลขบัตร)
  const prev = await db.collection(BROKER_COLL).findOne({ nationalId: a.nationalId }, { projection: { _id: 1 } })
  const now = new Date().toISOString()
  await db.collection(BROKER_COLL).insertOne({
    ...a,
    status: "pending",
    duplicateOf: prev ? String(prev._id) : "",
    source: "public-web",
    createdAt: now, updatedAt: now,
    timeline: [{ at: now, by: "public-web", action: "ผู้สมัครส่งใบสมัครจากหน้าเว็บ" }],
  })

  return NextResponse.json({ ok: true })
}
