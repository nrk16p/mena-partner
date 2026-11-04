import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { QUOTE_COLL } from "@/lib/quotation"
import { STATUS_LABEL } from "@/lib/deal-stage"
import { stageOfDeal } from "@/lib/deal-list"
import { findOpenDealFor, normalizePhone, type MatchDeal } from "@/lib/customer-match"

const DB = process.env.MONGO_DB ?? "mena_partner"

/** ดีลเปิดของลูกค้าคนนี้ (ลูกค้า 1 คน = 1 ดีลเปิด · เซลล์คนเดียวจนกว่าจะปิด) — ใช้ทั้ง API เตือนและตอนสร้างใบ */
export async function openDealOfCustomer(
  who: { customerId?: string; phone?: string; name?: string },
  excludeId?: string,
) {
  const client = await clientPromise
  const db = client.db(DB)
  const or: Record<string, unknown>[] = []
  const id = String(who.customerId ?? "").trim()
  const phone = normalizePhone(who.phone)
  const name = String(who.name ?? "").trim()
  if (id) or.push({ customerId: id })
  // เบอร์ในฐานอาจมีขีด/เว้นวรรค — ดึงที่ลงท้ายด้วย 7 หลักท้ายมาก่อน แล้วค่อยเทียบแบบตัวเลขล้วนในโค้ด
  if (phone.length >= 9) or.push({ customerPhone: { $regex: phone.slice(-7).split("").join("[^0-9]*") + "$" } })
  if (name) or.push({ customerName: { $regex: `^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\s*$`, $options: "i" } })
  if (!or.length) return null
  const rows = await db.collection(QUOTE_COLL)
    .find({ $or: or }, { projection: { quotationNo: 1, status: 1, stage: 1, customerId: 1, customerName: 1, customerPhone: 1, salesName: 1 } })
    .limit(50).toArray()
  const hit = findOpenDealFor(rows.map((r) => ({ ...r, _id: String(r._id) })) as MatchDeal[], who, excludeId)
  if (!hit) return null
  const stage = stageOfDeal(hit)
  return {
    _id: String(hit._id), quotationNo: hit.quotationNo ?? "", salesName: hit.salesName ?? "",
    stage, stageLabel: STATUS_LABEL[stage as keyof typeof STATUS_LABEL] ?? stage, customerName: hit.customerName ?? "",
  }
}

/** GET /api/quotations/open-deal?customerId=&phone=&name= → { existing: {...} | null } */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const existing = await openDealOfCustomer({
    customerId: sp.get("customerId") ?? "", phone: sp.get("phone") ?? "", name: sp.get("name") ?? "",
  })
  return NextResponse.json({ existing })
}
