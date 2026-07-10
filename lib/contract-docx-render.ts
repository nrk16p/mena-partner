/**
 * Server-only: โหลด contract + promo จาก DB แล้ว render template .docx เป็น buffer
 * ใช้ร่วมกันระหว่าง route ดาวน์โหลด .docx และ route แปลงเป็น PDF
 */
import "server-only"
import { ObjectId } from "mongodb"
import { readFile } from "fs/promises"
import path from "path"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import clientPromise from "@/lib/mongo"
import type { Contract } from "@/types"
import { DOCX_TEMPLATES, normPlate, type DocxType, type PromoMasterData } from "@/lib/contract-docx"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function renderContractDocx(
  id: string,
  type: DocxType,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const tpl = DOCX_TEMPLATES[type]
  if (!tpl) return null

  const client = await clientPromise
  const db = client.db(DB)
  const contract = (await db.collection("contracts").findOne({ _id: new ObjectId(id) })) as Contract | null
  if (!contract) return null

  const plate = normPlate(contract.licensePlate)
  const promos = (await db.collection("promotion_master").find({}).toArray()) as unknown as PromoMasterData[]
  const promo = promos.find((p) => normPlate(p.licensePlate) === plate) ?? null

  const data = tpl.build(contract, promo)
  const templatePath = path.join(process.cwd(), "templates", tpl.file)
  const content = await readFile(templatePath)
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "................",
  })
  doc.render(data)
  const buffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" })
  return { buffer, filename: tpl.filename(contract) }
}
