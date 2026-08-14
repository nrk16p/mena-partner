import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { resolveRole } from "@/lib/roles"
import { hasPerm } from "@/lib/rbac"
import { SALES_PEOPLE } from "@/lib/quotation-people"

const DB = process.env.MONGO_DB ?? "mena_partner"
const COLL = "sales_people"

/** รวมชื่อตั้งต้นในโค้ด + ชื่อที่ทีมเพิ่มเองผ่านหน้าจอ (ไม่ซ้ำ) */
async function listNames(): Promise<string[]> {
  const client = await clientPromise
  const rows = await client.db(DB).collection(COLL).find({}).project({ name: 1, _id: 0 }).toArray()
  const added = rows.map((r) => String(r.name ?? "").trim()).filter(Boolean)
  const seen = new Set<string>()
  return [...SALES_PEOPLE, ...added].filter((n) => {
    const k = n.trim().toLowerCase()
    if (!n.trim() || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** GET /api/quotations/sales-people — รายชื่อผู้ขายให้ dropdown */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await listNames())
}

/** POST — เพิ่มชื่อผู้ขายใหม่จากหน้าใบเสนอราคา */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email ?? "").trim().toLowerCase()
  const role = await resolveRole(email)
  if (!hasPerm(role, "sales")) return NextResponse.json({ error: "ไม่มีสิทธิ์เพิ่มชื่อผู้ขาย" }, { status: 403 })

  const name = String((await req.json())?.name ?? "").trim()
  if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อผู้ขาย" }, { status: 400 })
  if (name.length > 60) return NextResponse.json({ error: "ชื่อยาวเกินไป" }, { status: 400 })

  const existing = await listNames()
  const dup = existing.find((n) => n.toLowerCase() === name.toLowerCase())
  if (dup) return NextResponse.json({ error: `มีชื่อ "${dup}" อยู่แล้ว`, names: existing }, { status: 409 })

  const client = await clientPromise
  await client.db(DB).collection(COLL).insertOne({
    name, createdAt: new Date().toISOString(), createdBy: email,
  })
  return NextResponse.json({ ok: true, name, names: await listNames() }, { status: 201 })
}
