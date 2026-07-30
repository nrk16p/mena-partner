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
  return (
    Array.from(SEG.segment(s), (x) => x.segment)
      .join("​")
      // ห้ามตัดบรรทัดก่อนเครื่องหมายปิด/ตามหลัง และหลังเครื่องหมายเปิด
      // (กัน ")" หรือ "ๆ" หลุดไปขึ้นต้นบรรทัด และ "(" ค้างท้ายบรรทัด)
      .replace(/​([)\]”’ๆฯ,.:;!?%])/g, "$1")
      .replace(/([([“‘])​/g, "$1")
      // วรรคจริงก่อนไม้ยมก/ฯ → NBSP: "ต่าง ๆ" ไม่ให้ "ๆ" หลุดไปขึ้นต้นบรรทัด (ผิดหลักพิมพ์ไทย)
      // ต้องกลืน ZWSP ที่ join() แทรกรอบวรรคด้วย ไม่งั้นจุดตัดบรรทัดยังอยู่ (วรรคเป็น required — คำติดกันไม่โดนแทรก)
      .replace(/\u200B? \u200B?([ๆฯ])/g, "\u00A0$1")
      // "ผู้" เป็นคำนำหน้านาม (bound prefix) — ห้ามแยกจากคำถัดไป: ผู้ซื้อ/ผู้ขาย/ผู้ว่าจ้าง/ผู้รับจ้าง/ผู้ค้ำประกัน เกาะเป็นคำเดียว
      .replace(/ผู้\u200B/g, "ผู้")
      // คำประสมหลักของสัญญา — ห้ามแตกกลางคำ (ค้ำ|ประกัน, ว่า|จ้าง)
      .replace(/ค้ำ\u200Bประกัน/g, "ค้ำประกัน")
      .replace(/ว่า\u200Bจ้าง/g, "ว่าจ้าง")
      // วรรคในเครื่องหมายคำพูด “ ผู้ขาย ” → เกาะเป็นก้อนเดียวกับคำข้างใน ไม่มีเครื่องหมายโดดคนละบรรทัด
      .replace(/“\u200B? \u200B?/g, "“\u00A0")
      .replace(/\u200B? \u200B?”/g, "\u00A0”")
  )
}
