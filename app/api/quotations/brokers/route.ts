import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { resolveRole } from "@/lib/roles"
import { isAdminRole } from "@/lib/rbac"
import { BROKER_COLL, type BrokerStatus } from "@/lib/broker-application"

const DB = process.env.MONGO_DB ?? "mena_partner"

/** ใบสมัครมีเลขบัตร + เลขบัญชี → แอดมินเท่านั้น (เหมือนหน้าทีมขาย) */
async function adminOnly() {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email ?? "").trim().toLowerCase()
  const role = await resolveRole(email)
  return isAdminRole(role) ? { email } : null
}

/** GET /api/quotations/brokers?status=pending — ใบสมัครนายหน้า ใหม่สุดก่อน */
export async function GET(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "เฉพาะแอดมิน" }, { status: 403 })
  const status = req.nextUrl.searchParams.get("status") ?? ""
  const filter = ["pending", "approved", "rejected"].includes(status) ? { status } : {}
  const db = (await clientPromise).db(DB)
  const rows = await db.collection(BROKER_COLL).find(filter).sort({ createdAt: -1 }).limit(500).toArray()
  return NextResponse.json(rows.map((r) => ({ ...r, _id: String(r._id) })))
}

/** PATCH { _id, status, note } — อนุมัติ/ไม่อนุมัติ/ย้อนกลับเป็นรอตรวจ
 *  อนุมัติ → เพิ่มชื่อเข้า sales_people (ถ้ายังไม่มี) ให้เลือกเป็นผู้ขายในใบเสนอราคาได้ ยอดคอมจะนับเข้าคนนี้ */
export async function PATCH(req: NextRequest) {
  const admin = await adminOnly()
  if (!admin) return NextResponse.json({ error: "เฉพาะแอดมิน" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const id = String(body?._id ?? "")
  const status = String(body?.status ?? "") as BrokerStatus
  const note = String(body?.note ?? "").trim().slice(0, 500)
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 })
  if (!["pending", "approved", "rejected"].includes(status)) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 })
  if (status === "rejected" && !note) return NextResponse.json({ error: "ไม่อนุมัติ ต้องใส่เหตุผลด้วย" }, { status: 400 })

  const db = (await clientPromise).db(DB)
  const cur = await db.collection(BROKER_COLL).findOne({ _id: new ObjectId(id) })
  if (!cur) return NextResponse.json({ error: "ไม่พบใบสมัครนี้" }, { status: 404 })

  const now = new Date().toISOString()
  const action = status === "approved" ? "อนุมัติ" : status === "rejected" ? "ไม่อนุมัติ" : "ย้อนกลับเป็นรอตรวจ"
  await db.collection(BROKER_COLL).updateOne(
    { _id: cur._id },
    {
      $set: { status, reviewNote: note, reviewedBy: admin.email, reviewedAt: now, updatedAt: now },
      $push: { timeline: { at: now, by: admin.email, action: note ? `${action} — ${note}` : action } },
    } as never,
  )

  let addedToSales = false
  if (status === "approved") {
    const name = `${cur.firstName ?? ""} ${cur.lastName ?? ""}`.trim()
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const exists = await db.collection("sales_people").findOne({ name: { $regex: `^${esc}$`, $options: "i" } })
    if (name && !exists) {
      await db.collection("sales_people").insertOne({
        name, email: "", phone: String(cur.phone ?? ""), brokerApplicationId: id,
        createdAt: now, createdBy: admin.email,
      })
      addedToSales = true
    }
  }
  return NextResponse.json({ ok: true, addedToSales })
}
