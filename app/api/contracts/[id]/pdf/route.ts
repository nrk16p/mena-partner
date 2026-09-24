import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"
import type { Contract } from "@/types"
import { normPlate, type PromoMasterData } from "@/lib/contract-docx"
import { renderPdfmake } from "@/lib/pdfmake-printer"
import { PDFMAKE_DOCS, PDF_FILENAME, type PdfmakeType } from "@/lib/contract-pdfmake"
import { appendContractAttachments } from "@/lib/pdf-attachments"
import { withVehicleDetails } from "@/lib/contract-vehicle"
import { getCompanyConfig } from "@/lib/company-config"
import { applyCompany } from "@/lib/contract-pdfmake-helpers"

export const runtime = "nodejs"
export const maxDuration = 30

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const type = (req.nextUrl.searchParams.get("type") ?? "sale") as PdfmakeType
  const builder = PDFMAKE_DOCS[type]
  if (!builder) return NextResponse.json({ error: "unsupported type" }, { status: 400 })

  const client = await clientPromise
  const db = client.db(DB)
  const found = (await db.collection("contracts").findOne({ _id: new ObjectId(id) })) as Contract | null
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const contract = await withVehicleDetails(db, found as unknown as Record<string, unknown>) as unknown as Contract

  const plate = normPlate(contract.licensePlate)
  const promos = (await db.collection("promotion_master").find({}).toArray()) as unknown as PromoMasterData[]
  const promo = promos.find((p) => normPlate(p.licensePlate) === plate) ?? null

  const company = await getCompanyConfig(db)
  try {
    applyCompany(company)          // ต้องติดกับ builder() ไม่มี await คั่น
    const docDef = builder(contract, promo)
    // ต่อเอกสารแนบท้าย PDF ตามชนิดสัญญา (sale/hire/guarantee — creditor/promotion ไม่แนบ)
    await appendContractAttachments(db, contract, docDef, type)
    const pdf = await renderPdfmake(docDef)
    const filename = (PDF_FILENAME[type] ?? PDF_FILENAME.sale)(contract)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "pdf error"
    return NextResponse.json({ error: "pdf generation failed", detail: msg }, { status: 500 })
  }
}
