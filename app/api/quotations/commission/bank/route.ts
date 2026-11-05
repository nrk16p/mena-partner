import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { resolveRole } from "@/lib/roles"
import { upsertSalesBank } from "@/lib/sales-bank"
import { canPayCommission } from "@/app/api/quotations/commission/route"

const DB = process.env.MONGO_DB ?? "mena_partner"

/** PATCH { email?, name, bankName, bankAccountNo, bankAccountName } — กรอกบัญชีรับเงินของเซลล์จากหน้าค่าคอม (แอดมิน/การเงิน) */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const actor = (session?.user?.email ?? "").trim().toLowerCase()
  const role = await resolveRole(actor)
  if (!canPayCommission(role)) return NextResponse.json({ error: "เฉพาะแอดมิน/การเงิน" }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const bankAccountNo = String(b?.bankAccountNo ?? "").replace(/\D/g, "")
  if (bankAccountNo && (bankAccountNo.length < 10 || bankAccountNo.length > 15)) {
    return NextResponse.json({ error: "เลขบัญชีไม่ถูกต้อง ใส่เฉพาะตัวเลข 10–15 หลัก" }, { status: 400 })
  }
  try {
    const db = (await clientPromise).db(DB)
    const r = await upsertSalesBank(db, { email: String(b?.email ?? ""), name: String(b?.name ?? "") },
      { bankName: String(b?.bankName ?? ""), bankAccountNo, bankAccountName: String(b?.bankAccountName ?? "") }, actor)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" }, { status: 400 })
  }
}
