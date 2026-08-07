import "server-only"
import fs from "fs"
import path from "path"
import { COMPANY } from "@/lib/contract-pdfmake-helpers"
import { seg } from "@/lib/pdfmake-printer"
import type { Quotation } from "@/lib/quotation"

/** ใบเสนอราคา — pdfmake สไตล์หรู โทนทอง (แถบหัว gradient จำลองด้วยแถบทอง + เส้นคั่น) */

const GOLD = "#C9A227"
const GOLD_DK = "#8C6B1F"
const INK = "#3F3000"
const fm = (n: number) => (n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fm2 = (n: number) => (n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const THM = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
function thDate(iso?: string | null): string {
  if (!iso) return "-"
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d} ${THM[m]} ${y + 543}`
}

let LOGO = ""
try { LOGO = fs.readFileSync(path.join(process.cwd(), "fonts", "mena-logo.jpg")).toString("base64") } catch { /* ไม่มีโลโก้ก็ได้ */ }

async function fetchImg(url?: string): Promise<string> {
  if (!url) return ""
  try {
    const r = await fetch(url); if (!r.ok) return ""
    const ct = (r.headers.get("content-type") || "").toLowerCase()
    if (!ct.includes("jpeg") && !ct.includes("jpg") && !ct.includes("png")) return ""
    const buf = Buffer.from(await r.arrayBuffer())
    return `data:${ct.includes("png") ? "image/png" : "image/jpeg"};base64,${buf.toString("base64")}`
  } catch { return "" }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function quotationDocDef(q: Quotation): Promise<any> {
  const vehImg = await fetchImg(q.vehiclePhotoUrl)
  const kv = (label: string, value: string) => [
    { text: seg(label), color: "#71717a", fontSize: 13, margin: [0, 1, 0, 1] },
    { text: seg(value || "-"), bold: true, color: INK, fontSize: 14, margin: [0, 1, 0, 1] },
  ]
  const priceRow = (label: string, value: string, opts: { big?: boolean; gold?: boolean } = {}) => [
    { text: seg(label), fontSize: opts.big ? 15 : 13, bold: opts.big, color: opts.big ? INK : "#52525b", margin: [0, opts.big ? 3 : 1.5, 0, opts.big ? 3 : 1.5] },
    { text: value, alignment: "right", fontSize: opts.big ? 17 : 14, bold: opts.big || opts.gold, color: opts.gold ? GOLD_DK : INK, margin: [0, opts.big ? 3 : 1.5, 0, opts.big ? 3 : 1.5] },
  ]

  return {
    pageSize: "A4",
    pageMargins: [48, 40, 48, 56],
    defaultStyle: { font: "Cordia", fontSize: 14, lineHeight: 1.1 },
    footer: (page: number, total: number) => ({
      columns: [
        { text: seg(COMPANY.name), color: "#a1a1aa", fontSize: 10 },
        { text: `${page}/${total}`, alignment: "right", color: "#a1a1aa", fontSize: 10 },
      ],
      margin: [48, 12, 48, 0],
    }),
    content: [
      // ── หัวเอกสาร: โลโก้ใหญ่บรรทัดบน · ชื่อบริษัทบรรทัดถัดมา | บล็อกเลขที่ใบเสนอ (ขวา) ──
      {
        columns: [
          {
            width: "*",
            stack: [
              ...(LOGO
                ? [{ image: `data:image/jpeg;base64,${LOGO}`, width: 300, margin: [0, 4, 0, 0] }]
                : [{ text: seg(COMPANY.name), bold: true, fontSize: 18, color: INK }]),
            ],
          },
          {
            width: 168,
            stack: [
              { text: "ใบเสนอราคา", bold: true, fontSize: 20, color: GOLD_DK, alignment: "right" },
              { text: "QUOTATION", fontSize: 11, color: GOLD, alignment: "right", characterSpacing: 2 },
              { text: seg(`เลขที่ ${q.quotationNo}`), fontSize: 13, bold: true, color: INK, alignment: "right", margin: [0, 4, 0, 0] },
              { text: seg(`วันที่ ${thDate(q.createdAt)}`), fontSize: 12, color: "#52525b", alignment: "right" },
              ...(q.validUntil ? [{ text: seg(`ยืนราคาถึง ${thDate(q.validUntil)}`), fontSize: 12, color: "#b45309", alignment: "right" }] : []),
            ],
          },
        ],
      },
      // แถบทองคั่น
      { canvas: [{ type: "rect", x: 0, y: 0, w: 499, h: 3.2, color: GOLD }], margin: [0, 12, 0, 14] },

      // ── ลูกค้า | พนักงานขาย ──
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "เรียน / ลูกค้า", bold: true, fontSize: 12, color: GOLD_DK, margin: [0, 0, 0, 3] },
              { table: { widths: [54, "*"], body: [
                kv("ชื่อ", q.customerName),
                kv("โทร", q.customerPhone ?? "-"),
              ] }, layout: "noBorders" },
            ],
          },
          { width: 20, text: "" },
          {
            width: "*",
            stack: [
              { text: "พนักงานขาย", bold: true, fontSize: 12, color: GOLD_DK, margin: [0, 0, 0, 3] },
              { table: { widths: [54, "*"], body: [
                kv("ผู้เสนอ", q.salesName),
                kv("อีเมล", q.salesEmail),
              ] }, layout: "noBorders" },
            ],
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // ── รถที่เสนอ ──
      { text: "รายการรถที่เสนอขาย", bold: true, fontSize: 13, color: INK, margin: [0, 0, 0, 4] },
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              { text: "ทะเบียน", bold: true, color: INK, fillColor: "#FBF3D9", margin: [4, 3, 4, 3] },
              { text: "ยี่ห้อ", bold: true, color: INK, fillColor: "#FBF3D9", margin: [4, 3, 4, 3] },
              { text: "รุ่น", bold: true, color: INK, fillColor: "#FBF3D9", margin: [4, 3, 4, 3] },
              { text: "เบอร์รถ", bold: true, color: INK, fillColor: "#FBF3D9", margin: [4, 3, 4, 3] },
            ],
            [
              { text: seg(q.licensePlate), bold: true, margin: [4, 3, 4, 3] },
              { text: seg(q.vehicleBrand || "-"), margin: [4, 3, 4, 3] },
              { text: seg(q.vehicleModel || "-"), margin: [4, 3, 4, 3] },
              { text: seg(q.truckNumber || "-"), margin: [4, 3, 4, 3] },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          hLineColor: () => "#E7C86E", vLineColor: () => "#E7C86E",
        },
        margin: [0, 0, 0, vehImg ? 8 : 16],
      },
      ...(vehImg ? [{ image: vehImg, fit: [280, 160], alignment: "center" as const, margin: [0, 0, 0, 16] }] : []),

      // ── เงื่อนไขราคา (2 คอลัมน์: สรุปเงินก้อน | แผนผ่อน) ──
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "สรุปราคา", bold: true, fontSize: 13, color: GOLD_DK, margin: [0, 0, 0, 4] },
              { table: { widths: ["*", "auto"], body: [
                priceRow("ราคาขายรวม", `${fm2(q.totalSalePrice)} บาท`, { big: true, gold: true }),
                priceRow("เงินดาวน์รวm".replace("m", "ม"), `${fm2(q.downPayment)} บาท`),
                priceRow("ดาวน์ชำระวันทำสัญญา", `${fm2(q.cashDown)} บาท`),
                priceRow("ดาวน์ผ่อน", q.downInstallmentCount ? `${fm(q.downInstallmentAmt)} × ${q.downInstallmentCount} งวด` : "-"),
              ] }, layout: "noBorders" },
            ],
          },
          { width: 20, text: "" },
          {
            width: "*",
            stack: [
              { text: "แผนไฟแนนซ์", bold: true, fontSize: 13, color: GOLD_DK, margin: [0, 0, 0, 4] },
              { table: { widths: ["*", "auto"], body: [
                priceRow("ยอดจัดไฟแนนซ์", `${fm2(q.financeAmount)} บาท`),
                priceRow("จำนวนงวด", q.financeInstallments ? `${q.financeInstallments} งวด` : "-"),
                priceRow("ค่างวด/เดือน", `${fm2(q.monthlyPayment)} บาท`, { big: true, gold: true }),
              ] }, layout: "noBorders" },
            ],
          },
        ],
        margin: [0, 0, 0, 14],
      },

      ...(q.extras ? [
        { text: "ของแถม / โปรโมชั่น", bold: true, fontSize: 12, color: GOLD_DK, margin: [0, 4, 0, 2] },
        { text: seg(q.extras), fontSize: 13, color: INK, margin: [0, 0, 0, 8] },
      ] : []),
      ...(q.note ? [
        { text: "หมายเหตุ", bold: true, fontSize: 12, color: GOLD_DK, margin: [0, 2, 0, 2] },
        { text: seg(q.note), fontSize: 13, color: "#52525b", margin: [0, 0, 0, 8] },
      ] : []),

      // ── เงื่อนไข ──
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.5, lineColor: "#E7C86E" }], margin: [0, 6, 0, 8] },
      { text: seg("เงื่อนไข: ใบเสนอราคานี้เป็นการเสนอเบื้องต้น ราคายังไม่รวมภาษีและค่าธรรมเนียมโอน (ถ้ามี) · การจองรถถือว่าสมบูรณ์เมื่อวางเงินจองและบริษัทออกหลักฐานรับเงิน · เงื่อนไขการผ่อนขึ้นกับการอนุมัติของไฟแนนซ์"), fontSize: 11, color: "#71717a", margin: [0, 0, 0, 22] },

      // ── ลายเซ็น ──
      {
        columns: [
          { width: "*", stack: [
            { text: "ลงชื่อ .............................................", alignment: "center", margin: [0, 10, 0, 2] },
            { text: seg(`( ${q.salesName} )`), alignment: "center", fontSize: 12 },
            { text: "พนักงานขาย", alignment: "center", color: "#71717a", fontSize: 12 },
          ] },
          { width: "*", stack: [
            { text: "ลงชื่อ .............................................", alignment: "center", margin: [0, 10, 0, 2] },
            { text: seg(`( ${q.customerName} )`), alignment: "center", fontSize: 12 },
            { text: "ลูกค้า / ผู้ซื้อ", alignment: "center", color: "#71717a", fontSize: 12 },
          ] },
        ],
      },
    ],
  }
}
