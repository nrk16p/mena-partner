import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"
import { renderPdfmake } from "@/lib/pdfmake-printer"
import { quotationDocDef } from "@/lib/quotation-pdf"
import { QUOTE_COLL, type Quotation } from "@/lib/quotation"
import { findVehicle, withVehicle } from "@/lib/deal-vehicles"
import { salesDisplayName } from "@/lib/sales-display"

export const runtime = "nodejs"
export const maxDuration = 30
const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 })
  const client = await clientPromise
  const db = client.db(DB)
  const doc = await db.collection(QUOTE_COLL).findOne({ _id: new ObjectId(id) })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // ผู้เสนอราคาในเอกสารต้องเป็นชื่อ-นามสกุลจริง ไม่ใช่อีเมล (ใบเก่าบางใบเก็บชื่อเซลล์มาเป็นอีเมล)
  doc.salesName = await salesDisplayName(db, String(doc.salesName ?? ""), String(doc.salesEmail ?? ""))
  // ?plate= → ใบเสนอของคันนั้นในดีลเดียวกัน (ดีลเสนอได้หลายคัน) — ไม่ระบุ = คันหลัก
  const plate = req.nextUrl.searchParams.get("plate") ?? ""
  let q = { ...doc, _id: String(doc._id) } as unknown as Quotation
  if (plate) {
    const v = findVehicle(q as unknown as Parameters<typeof findVehicle>[0], plate)
    if (!v) return NextResponse.json({ error: "ไม่พบคันนี้ในดีล" }, { status: 404 })
    q = withVehicle(q as unknown as Record<string, unknown>, v) as unknown as Quotation
  }
  try {
    const pdf = await renderPdfmake(await quotationDocDef(q))
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(`ใบเสนอราคา-${doc.quotationNo}${plate ? `-${q.licensePlate}` : ""}.pdf`)}`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "pdf error" }, { status: 500 })
  }
}
