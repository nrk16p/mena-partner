import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { QUOTE_COLL, nextQuotationNo, type QuoteStatus } from "@/lib/quotation"

const DB = process.env.MONGO_DB ?? "mena_partner"
const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0)

/** GET /api/quotations?status=&q= — ลิสต์ใบเสนอ (ทั้งทีมเห็นทุกดีล) */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const status = sp.get("status")?.trim()
  const q = sp.get("q")?.trim()
  const client = await clientPromise
  const db = client.db(DB)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = {}
  if (status) filter.status = status
  if (q) filter.$or = [
    { quotationNo: { $regex: q, $options: "i" } },
    { customerName: { $regex: q, $options: "i" } },
    { licensePlate: { $regex: q, $options: "i" } },
    { salesName: { $regex: q, $options: "i" } },
  ]
  const rows = await db.collection(QUOTE_COLL).find(filter).sort({ createdAt: -1 }).limit(300).toArray()
  return NextResponse.json(rows.map((r) => ({ ...r, _id: String(r._id) })))
}

/** POST /api/quotations — สร้างใบเสนอ (salesperson = ผู้ใช้ login) */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const b = await req.json()
  const isLead = (b.status as QuoteStatus) === "lead"
  // lead บันทึกได้โดยยังไม่ต้องเลือกรถ — บังคับเฉพาะชื่อลูกค้า (รถบังคับเมื่อไม่ใช่ lead)
  if (!String(b.customerName ?? "").trim() || (!isLead && !b.licensePlate)) {
    return NextResponse.json({ error: isLead ? "กรุณาระบุชื่อลูกค้า" : "ต้องเลือกรถและลูกค้า" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db(DB)
  const now = new Date().toISOString()
  const email = session.user?.email ?? "unknown"
  const salesName = session.user?.name ?? email.split("@")[0]
  const quotationNo = await nextQuotationNo(db)

  const doc = {
    quotationNo,
    status: (b.status as QuoteStatus) ?? "quoted",
    customerId: b.customerId ? String(b.customerId) : undefined,
    customerName: String(b.customerName).trim(),
    customerPhone: (b.customerPhone ?? "").trim(),
    licensePlate: String(b.licensePlate ?? "").trim(),
    vehicleBrand: (b.vehicleBrand ?? "").trim(),
    vehicleModel: (b.vehicleModel ?? "").trim(),
    truckNumber: (b.truckNumber ?? "").trim(),
    vehiclePhotoUrl: (b.vehiclePhotoUrl ?? "").trim(),
    totalSalePrice: n(b.totalSalePrice), downPayment: n(b.downPayment), cashDown: n(b.cashDown),
    downInstallmentCount: n(b.downInstallmentCount), downInstallmentAmt: n(b.downInstallmentAmt),
    financeAmount: n(b.financeAmount), financeInstallments: n(b.financeInstallments), monthlyPayment: n(b.monthlyPayment),
    extras: (b.extras ?? "").trim(), note: (b.note ?? "").trim(),
    validUntil: b.validUntil || null,
    salesEmail: email, salesName,
    createdAt: now, updatedAt: now,
    timeline: [{ at: now, by: email, action: "สร้างใบเสนอ" }],
  }
  const r = await db.collection(QUOTE_COLL).insertOne(doc)
  return NextResponse.json({ ...doc, _id: String(r.insertedId) })
}
