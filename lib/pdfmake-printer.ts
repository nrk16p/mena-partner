/**
 * Server-side pdfmake printer (pure JS — รันบน Vercel ได้ ไม่ต้อง chromium/LibreOffice)
 * โหลดฟอนต์ CordiaUPC จาก /fonts เข้า virtualfs ของ pdfmake
 */
import "server-only"
import path from "path"
import fs from "fs"

// pdfmake 0.3 server API อยู่ใน subpaths เหล่านี้ (ไม่มี type — ใช้ require)
/* eslint-disable @typescript-eslint/no-explicit-any */
import pdfmake from "pdfmake"
// @ts-expect-error no types for subpath
import PrinterMod from "pdfmake/js/Printer"
// @ts-expect-error no types for subpath
import URLResolverMod from "pdfmake/js/URLResolver"

const Printer = (PrinterMod as any).default || PrinterMod
const URLResolver = (URLResolverMod as any).default || URLResolverMod

const FONT_FILES = {
  normal: "CordiaUPC.ttf",
  bold: "CordiaUPC-Bold.ttf",
  italics: "CordiaUPC-Italic.ttf",
  bolditalics: "CordiaUPC-BoldItalic.ttf",
}

let printer: any = null

function getPrinter() {
  if (printer) return printer
  const vfs = (pdfmake as any).virtualfs
  const dir = path.join(process.cwd(), "fonts")
  for (const f of Object.values(FONT_FILES)) {
    vfs.writeFileSync(f, fs.readFileSync(path.join(dir, f)))
  }
  const fonts = { Cordia: { ...FONT_FILES } }
  printer = new Printer(fonts, vfs, new URLResolver(vfs), () => true)
  return printer
}

/** สร้าง PDF buffer จาก docDefinition ของ pdfmake */
export async function renderPdfmake(docDefinition: any): Promise<Buffer> {
  const p = getPrinter()
  const pdfDoc = await p.createPdfKitDocument(docDefinition)
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    pdfDoc.on("data", (c: Buffer) => chunks.push(c))
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)))
    pdfDoc.on("error", reject)
    pdfDoc.end()
  })
}

// ── ตัดคำไทยด้วย Intl.Segmenter → แทรก ZWSP ให้ pdfmake ขึ้นบรรทัดถูก ──
const SEG = new Intl.Segmenter("th", { granularity: "word" })
/** segment ข้อความไทยแทรก U+200B (เฉพาะข้อความไทย — ห้ามใช้กับเลข/ทะเบียนที่มี "-") */
export function seg(s: string | null | undefined): string {
  if (!s) return ""
  return Array.from(SEG.segment(s), (x) => x.segment).join("​")
}
