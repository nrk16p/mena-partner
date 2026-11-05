import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import * as XLSX from "xlsx"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { resolveRole } from "@/lib/roles"
import { hasPerm } from "@/lib/rbac"
import { renderPdfmake } from "@/lib/pdfmake-printer"
import { PAYMENT_COLL, enrichPayment, loadCommissionSummaries, type CommissionPayment } from "@/lib/commission-payment"
import { commissionPaymentDocDef } from "@/lib/commission-payment-pdf"

export const runtime = "nodejs"
export const maxDuration = 30
const DB = process.env.MONGO_DB ?? "mena_partner"

/** GET /api/quotations/commission/payments/[id]/export?format=xlsx|pdf — ใบสรุปทำจ่าย 1 ครั้ง */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 })
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email ?? "").trim().toLowerCase()
  const role = await resolveRole(email)
  if (!hasPerm(role, "sales")) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })

  const db = (await clientPromise).db(DB)
  const doc = await db.collection(PAYMENT_COLL).findOne({ _id: new ObjectId(id) })
  if (!doc) return NextResponse.json({ error: "ไม่พบรายการทำจ่าย" }, { status: 404 })
  const p = await enrichPayment(db, { ...doc, _id: String(doc._id) } as unknown as CommissionPayment)
  // ฝ่ายขายโหลดได้เฉพาะของตัวเอง
  if (role === "salesperson") {
    const mine = (await loadCommissionSummaries(db)).find((s) => s.email && s.email === email)
    if (!mine || mine.key !== p.salesKey) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })
  }

  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "xlsx"
  const base = `ค่าคอม-${p.salesName}-${p.cycle}`
  if (format === "pdf") {
    const pdf = await renderPdfmake(commissionPaymentDocDef(p))
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(base + ".pdf")}` },
    })
  }
  const rows = p.items.map((it, i) => ({
    "ลำดับ": i + 1, "พนักงานขาย": p.salesName, "บัญชีรับเงิน": p.bankAccount ?? "", "รอบจ่าย": p.cycleLabel, "วันที่จ่าย": p.paidAt,
    "ใบเสนอราคา": it.quotationNo, "รหัสสัญญา": it.contractCode ?? "", "ลูกค้า": it.customerName, "ทะเบียน": it.licensePlate, "เบอร์รถ": it.truckNumber,
    "คันที่": it.nth, "วันเริ่มต้นสัญญา": it.contractStart, "งวด": it.tranche === 1 ? "งวด 1 (30 วัน)" : "งวด 2 (90 วัน)",
    "ครบกำหนด": it.due, "จำนวนเงิน": it.amount, "หมายเหตุ": p.note,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.sheet_add_aoa(ws, [["", "", "", "", "", "", "", "", "", "", "", "", "", "รวม", p.total]], { origin: -1 })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "ทำจ่าย")
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(base + ".xlsx")}`,
    },
  })
}
