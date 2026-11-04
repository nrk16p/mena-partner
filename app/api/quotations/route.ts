import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { actorOf, resolveSalesEmail } from "@/lib/sales-owner"
import { openDealOfCustomer } from "@/app/api/quotations/open-deal/route"
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
  // กรองตามขั้นใน pipeline ใหม่ (หน้าเว็บส่งมาเป็นรายการขั้นของด่านนั้น)
  const stages = (sp.get("stages") ?? "").split(",").map((x) => x.trim()).filter(Boolean)
  if (stages.length) filter.stage = { $in: stages }
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

  // ลูกค้า 1 คน = 1 ดีลที่ยังเปิด — มีเซลล์ดูแลอยู่แล้วต้องปิดใบเดิมก่อน (หน้าเว็บเตือนล่วงหน้า API กันซ้ำอีกชั้น)
  const existing = await openDealOfCustomer({ customerId: b.customerId ? String(b.customerId) : "", phone: b.customerPhone, name: b.customerName })
  if (existing) {
    return NextResponse.json({
      error: `ลูกค้าคนนี้มีดีลเปิดอยู่แล้ว (${existing.quotationNo} · เซลล์ ${existing.salesName || "ไม่ระบุ"} · ${existing.stageLabel}) ต้องปิดใบเดิมก่อนจึงเปิดใหม่ได้`,
      existing,
    }, { status: 409 })
  }

  const client = await clientPromise
  const db = client.db(DB)
  const now = new Date().toISOString()
  const actor = actorOf(session)
  const email = actor.email
  const salesName = (typeof b.salesName === "string" && b.salesName.trim()) || actor.name
  const quotationNo = await nextQuotationNo(db)
  // เซลล์เจ้าของดีลกับคนกดบันทึกเป็นคนละช่อง — ฝากคนอื่นคีย์ให้ ดีลก็ยังเป็นของเซลล์ที่เลือก
  const salesEmail = await resolveSalesEmail(db, salesName, actor)

  const doc = {
    quotationNo,
    status: (b.status as QuoteStatus) ?? "quoted",
    // ดีลใหม่เข้าไปป์ไลน์ทันที: ลีด = ผู้สนใจ, สร้างจากใบเสนอราคา = เสนอราคาแล้ว
    stage: isLead ? "LEAD" : "QUOTED",
    stageEnteredAt: now,
    lastActivityAt: now,
    customerId: b.customerId ? String(b.customerId) : undefined,
    customerName: String(b.customerName).trim(),
    customerPhone: (b.customerPhone ?? "").trim(),
    licensePlate: String(b.licensePlate ?? "").trim(),
    vehicleBrand: (b.vehicleBrand ?? "").trim(),
    vehicleModel: (b.vehicleModel ?? "").trim(),
    truckNumber: (b.truckNumber ?? "").trim(),
    vehiclePhotoUrl: (b.vehiclePhotoUrl ?? "").trim(),
    vehiclePhotos: b.vehiclePhotos && typeof b.vehiclePhotos === "object"
      ? Object.fromEntries(["front", "back", "left", "right", "cabin"].map((k) => [k, typeof b.vehiclePhotos[k] === "string" ? b.vehiclePhotos[k] : ""]))
      : undefined,
    totalSalePrice: n(b.totalSalePrice), downPayment: n(b.downPayment), cashDown: n(b.cashDown),
    savingsUsed: n(b.savingsUsed),
    downInstallmentCount: n(b.downInstallmentCount), downInstallmentAmt: n(b.downInstallmentAmt),
    financeAmount: n(b.financeAmount), financeInstallments: n(b.financeInstallments), monthlyPayment: n(b.monthlyPayment),
    extras: (b.extras ?? "").trim(), note: (b.note ?? "").trim(),
    validUntil: b.validUntil || null,
    salesEmail,
    salesName,
    createdBy: actor,
    updatedBy: { ...actor, at: now },
    createdAt: now, updatedAt: now,
    timeline: [{ at: now, by: email, action: "สร้างใบเสนอ" }],
  }
  const r = await db.collection(QUOTE_COLL).insertOne(doc)
  return NextResponse.json({ ...doc, _id: String(r.insertedId) })
}
