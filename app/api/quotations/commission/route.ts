import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { QUOTE_COLL } from "@/lib/quotation"
import { resolveRole } from "@/lib/roles"
import { hasPerm } from "@/lib/rbac"
import { buildSalesCommission, type CommissionQuote } from "@/lib/commission"

const DB = process.env.MONGO_DB ?? "mena_partner"

/**
 * GET /api/quotations/commission — สรุปยอดขาย + ค่าคอมรายคน
 * ฝ่ายขายเห็นเฉพาะของตัวเอง (กรองที่ server ไม่ส่งข้อมูลคนอื่นออกไป)
 * แอดมิน/การเงิน/แผนกรถร่วม เห็นทุกคน
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email ?? "").trim().toLowerCase()
  const role = await resolveRole(email)
  if (!hasPerm(role, "sales")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลค่าคอมมิชชั่น" }, { status: 403 })
  }
  const onlyMine = role === "salesperson"

  const client = await clientPromise
  const rows = await client.db(DB).collection(QUOTE_COLL)
    .find({ status: "won" }, {
      projection: {
        quotationNo: 1, status: 1, salesEmail: 1, salesName: 1, customerName: 1,
        licensePlate: 1, truckNumber: 1, totalSalePrice: 1, createdAt: 1, updatedAt: 1, timeline: 1,
      },
    })
    .limit(5000)
    .toArray()

  const all = buildSalesCommission(rows as unknown as CommissionQuote[])
  const me = all.find((r) => r.email && r.email === email) ?? null

  return NextResponse.json({
    role,
    myEmail: email,
    myName: session?.user?.name ?? "",
    me,
    // ฝ่ายขาย: ไม่ส่งของคนอื่นออกไปเลย
    all: onlyMine ? [] : all,
    canSeeAll: !onlyMine,
  })
}
