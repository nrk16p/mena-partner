import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { readFile } from "fs/promises"
import path from "path"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import clientPromise from "@/lib/mongo"
import type { Contract } from "@/types"
import { DOCX_TEMPLATES, normPlate, type DocxType, type PromoMasterData } from "@/lib/contract-docx"

export const runtime = "nodejs"

const DB = process.env.MONGO_DB ?? "mena_partner"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const type = (req.nextUrl.searchParams.get("type") ?? "sale") as DocxType
  const tpl = DOCX_TEMPLATES[type]
  if (!tpl) return NextResponse.json({ error: "unknown template type" }, { status: 400 })

  const client = await clientPromise
  const db = client.db(DB)
  const contract = (await db.collection("contracts").findOne({ _id: new ObjectId(id) })) as Contract | null
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // promo master — match by normalised plate (เหมือนหน้า preview)
  const plate = normPlate(contract.licensePlate)
  const promos = (await db.collection("promotion_master").find({}).toArray()) as unknown as PromoMasterData[]
  const promo = promos.find((p) => normPlate(p.licensePlate) === plate) ?? null

  const data = tpl.build(contract, promo)

  let buf: Buffer
  try {
    const templatePath = path.join(process.cwd(), "templates", tpl.file)
    const content = await readFile(templatePath)
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "................",
    })
    doc.render(data)
    buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "render error"
    return NextResponse.json({ error: "docx generation failed", detail: msg }, { status: 500 })
  }

  const filename = tpl.filename(contract)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
