import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { resolveRole } from "@/lib/roles"
import { actorOf } from "@/lib/sales-owner"
import { createPayment } from "@/lib/commission-payment"
import { canPayCommission } from "@/app/api/quotations/commission/route"

const DB = process.env.MONGO_DB ?? "mena_partner"

/** POST — บันทึกทำจ่ายค่าคอม: { salesKey, items:[{quotationId, tranche}], paidAt, cycle?, note? } (แอดมิน/การเงิน) */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email ?? "").trim().toLowerCase()
  const role = await resolveRole(email)
  if (!canPayCommission(role)) return NextResponse.json({ error: "ทำจ่ายค่าคอมได้เฉพาะแอดมินหรือการเงิน" }, { status: 403 })

  const b = await req.json().catch(() => null)
  if (!b) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 })
  const items = Array.isArray(b.items)
    ? b.items.map((x: { quotationId?: unknown; tranche?: unknown }) => ({ quotationId: String(x.quotationId ?? ""), tranche: (Number(x.tranche) === 2 ? 2 : 1) as 1 | 2 }))
    : []
  const db = (await clientPromise).db(DB)
  const r = await createPayment(db, {
    salesKey: String(b.salesKey ?? ""), items, paidAt: String(b.paidAt ?? "").slice(0, 10),
    cycle: b.cycle ? String(b.cycle) : undefined, note: b.note ? String(b.note) : "",
  }, actorOf(session))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ ok: true, payment: r.payment })
}
