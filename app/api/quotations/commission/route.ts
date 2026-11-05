import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { resolveRole } from "@/lib/roles"
import { hasPerm, isAdminRole } from "@/lib/rbac"
import { loadCommissionSummaries, PAYMENT_COLL } from "@/lib/commission-payment"
import { bankAccountIndex } from "@/lib/sales-bank"

const DB = process.env.MONGO_DB ?? "mena_partner"

/** ใครทำจ่ายค่าคอมได้: แอดมิน + การเงิน */
export const canPayCommission = (role: string) => isAdminRole(role) || hasPerm(role, "finance")

/**
 * GET /api/quotations/commission — สรุปยอดขาย + ค่าคอมรายคน + แผนจ่ายรายงวด + ประวัติทำจ่าย
 * ฝ่ายขายเห็นเฉพาะของตัวเอง (กรองที่ server ไม่ส่งข้อมูลคนอื่นออกไป)
 * แอดมิน/การเงิน/แผนกรถร่วม เห็นทุกคน · ทำจ่ายได้เฉพาะแอดมิน/การเงิน
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email ?? "").trim().toLowerCase()
  const role = await resolveRole(email)
  if (!hasPerm(role, "sales")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลค่าคอมมิชชั่น" }, { status: 403 })
  }
  const onlyMine = role === "salesperson"

  const db = (await clientPromise).db(DB)
  const bankOf = await bankAccountIndex(db)
  const all = (await loadCommissionSummaries(db)).map((r) => ({ ...r, bankAccount: bankOf({ email: r.email, name: r.name }) }))
  const me = all.find((r) => r.email && r.email === email) ?? null

  const payFilter = onlyMine ? { salesKey: me?.key ?? "__none__" } : {}
  const payments = await db.collection(PAYMENT_COLL).find(payFilter).sort({ paidAt: -1, createdAt: -1 }).limit(500).toArray()

  return NextResponse.json({
    role,
    myEmail: email,
    myName: session?.user?.name ?? "",
    me,
    // ฝ่ายขาย: ไม่ส่งของคนอื่นออกไปเลย
    all: onlyMine ? [] : all,
    canSeeAll: !onlyMine,
    canPay: canPayCommission(role),
    // ใบทำจ่ายเก่าที่บันทึกก่อนมีช่องบัญชี → ดึงบัญชีปัจจุบันของเซลล์มาแสดง (ไม่เขียนกลับ)
    payments: payments.map((p) => ({ ...p, _id: String(p._id), bankAccount: p.bankAccount || bankOf({ email: p.salesEmail, name: p.salesName }) })),
  })
}
