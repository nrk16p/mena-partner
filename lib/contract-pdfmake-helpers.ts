/**
 * Helpers ที่ใช้ร่วมกันสำหรับสร้างเนื้อ PDF ด้วย pdfmake (สัญญาทุกชนิด)
 * - S(): ตัดคำไทย (ZWSP) — ใช้กับ "ข้อความไทย" เท่านั้น ห้ามใช้กับเลข/ทะเบียน/โค้ด (มี "-" จะแตกบรรทัด)
 * - body/H/B/sigCell: paragraph helpers ให้หน้าตาตรงต้นฉบับ
 */
import "server-only"
import { seg } from "@/lib/pdfmake-printer"

/* eslint-disable @typescript-eslint/no-explicit-any */

export const S = seg

export const COMPANY = {
  name: "บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)",
  regNo: "0195536000089",
  address: "เลขที่ 280/8 หมู่ที่ 9 ตำบลทับกวาง อำเภอแก่งคอย จังหวัดสระบุรี",
  sellerSignatories: ["นางสุวรรณา ขจรวุฒิเดช", "นางสาวพัชรีรัตน์ ขจรวุฒิเดชภัทร์"],
  witnesses: ["นางสาวนัชภัค ขจรวุฒิเดช", "นางสาวธัญรดี ตะกิ่นนอก"],
}

// ── style "Body Legal": justify, line 1.15, spacing before/after 0, first-line indent 1.25cm ──
export const FIRST_LINE_INDENT = 35.4 // 1.25 cm = 35.43 pt
export const LINE_HEIGHT = 1.15

/** ย่อหน้าเนื้อความ (Body Legal). parts = string (ไทยล้วน) หรือ array ของ run
 *  หมายเหตุ: ใช้ชิดซ้าย (ไม่ justify) — justify ของ pdfmake เกลี่ยช่องว่างเข้าทุกรอยต่อคำไทย
 *  ทำให้ตัวอักษรห่างผิดปกติ (ไม่มี thaiDistribute แบบ Word) */
export const body = (parts: any, extra: any = {}) => ({
  text: Array.isArray(parts) ? parts : S(parts),
  alignment: "left",
  leadingIndent: FIRST_LINE_INDENT,
  lineHeight: LINE_HEIGHT,
  margin: [0, 0, 0, 0], // spacing before/after = 0 (ระยะห่างมาจาก line spacing เท่านั้น)
  ...extra,
})

/** หัวข้อข้อ (Heading style): หนา + ขีดเส้นใต้, ไม่ย่อหน้าบรรทัดแรก, เว้นก่อนหัวข้อด้วย spacing before */
export const H = (txt: string) => ({
  text: S(txt),
  bold: true,
  decoration: "underline",
  lineHeight: LINE_HEIGHT,
  margin: [0, 12, 0, 0], // spacing before 12pt, after 0
})

/** run ตัวหนา (ใช้ใน text array) */
export const B = (txt: string) => ({ text: S(txt), bold: true })

/** ค่าที่กรอก (input data) แบบตัวหนา — v() สำหรับเลข/ทะเบียน/โค้ด (raw), vS() สำหรับข้อความไทย (ตัดคำ) */
export const v = (x: string) => ({ text: x ?? "", bold: true })
export const vS = (x: string) => ({ text: S(x), bold: true })

/** footer มืออาชีพ: เลขสัญญา + วันเวลาพิมพ์ (ซ้าย) + หน้า X/Y (ขวา) + เส้นคั่นบาง
 *  "พิมพ์เมื่อ" = document-control stamp (คนละอย่างกับวันที่ทำสัญญาซึ่งเป็นวันที่มีผลทางกฎหมาย) */
export const pageFooter = (contractCode: string) => {
  const printedAt = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())
  return (currentPage: number, pageCount: number) => ({
    margin: [57, 6, 45, 0],
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 493, y2: 0, lineWidth: 0.5, lineColor: "#cccccc" }] },
      {
        columns: [
          {
            text: S(`เลขที่สัญญา ${contractCode || "-"}  ·  พิมพ์เมื่อ ${printedAt} น.`),
            fontSize: 11,
            color: "#888888",
          },
          { text: `หน้า ${currentPage} / ${pageCount}`, alignment: "right", fontSize: 11, color: "#888888" },
        ],
        margin: [0, 3, 0, 0],
      },
    ],
  })
}

/** ช่องลายเซ็น — รับ line เดิม "ลงชื่อ....ผู้ซื้อ" แล้วทำเส้นเซ็น (เส้นประยืดได้) + ชื่อ center ใต้เส้น
 *  แก้ปัญหาชื่อเยื้องขวา (เดิม center ใต้ทั้งคอลัมน์) */
export const sigCell = (line: string, name?: string) => {
  const m = line.match(/^(.*?)\.{2,}(.*)$/)
  const prefix = (m ? m[1] : "ลงชื่อ").trim()
  const role = (m ? m[2] : "").trim()
  return {
    stack: [
      {
        table: {
          widths: ["auto", "*", "auto"],
          body: [[
            { text: S(prefix + " "), border: [false, false, false, false] },
            { text: " ", border: [false, false, false, true] },
            { text: S(" " + role), border: [false, false, false, false] },
          ]],
        },
        layout: {
          defaultBorder: false,
          hLineWidth: () => 0.8,
          hLineColor: () => "#111",
          hLineStyle: () => ({ dash: { length: 2, space: 2 } }),
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 1,
        },
        margin: [0, 16, 0, 0],
      },
      {
        text: name ? S(`( ${name} )`) : S("(.................................)"),
        alignment: "center",
        margin: [0, 3, 0, 0],
      },
    ],
  }
}
