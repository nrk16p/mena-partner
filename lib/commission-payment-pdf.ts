import "server-only"
import { COMPANY } from "@/lib/contract-pdfmake-helpers"
import { seg } from "@/lib/pdfmake-printer"
import { formatMoney } from "@/lib/utils"
import type { CommissionPayment } from "@/lib/commission-payment"

const INK = "#18181b", MUTED = "#71717a", RULE = "#e4e4e7", GOLD_DK = "#7A5C14"

const thDate = (ymd: string) => {
  if (!ymd) return "—"
  const d = new Date(ymd.slice(0, 10) + "T00:00:00Z")
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

/** ใบสรุปทำจ่ายค่าคอมมิชชั่น (pdfmake) — 1 ใบต่อการทำจ่าย 1 ครั้ง */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function commissionPaymentDocDef(p: CommissionPayment): any {
  const cell = (text: string, opts: Record<string, unknown> = {}) => ({ text, fontSize: 9.5, margin: [0, 3, 0, 3], ...opts })
  const head = (text: string, opts: Record<string, unknown> = {}) => cell(seg(text), { bold: true, color: MUTED, fontSize: 9, ...opts })
  const rows = p.items.map((it, i) => [
    cell(String(i + 1), { alignment: "center" }),
    cell(it.quotationNo),
    cell(it.contractCode || "—"),
    cell(seg(it.customerName || "—")),
    cell([it.licensePlate, it.truckNumber].filter(Boolean).join(" · ") || "—"),
    cell(String(it.nth), { alignment: "center" }),
    cell(thDate(it.contractStart), { alignment: "center" }),
    cell(it.tranche === 1 ? seg("งวด 1 (30 วัน)") : seg("งวด 2 (90 วัน)"), { alignment: "center" }),
    cell(thDate(it.due), { alignment: "center" }),
    cell(formatMoney(it.amount), { alignment: "right", bold: true }),
  ])
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [40, 40, 40, 44],
    info: { title: `ทำจ่ายค่าคอม ${p.salesName} ${p.cycleLabel}` },
    defaultStyle: { font: "Sarabun", fontSize: 10, lineHeight: 1.15, color: INK },
    footer: (page: number, total: number) => ({
      columns: [
        { text: seg(COMPANY.name), color: MUTED, fontSize: 8.5 },
        { text: `${page}/${total}`, alignment: "right", color: MUTED, fontSize: 8.5 },
      ],
      margin: [40, 12, 40, 0],
    }),
    content: [
      { columns: [
        { stack: [
          { text: seg("ใบสรุปทำจ่ายค่าคอมมิชชั่นฝ่ายขาย"), fontSize: 15, bold: true, color: GOLD_DK },
          { text: seg(COMPANY.name), fontSize: 9.5, color: MUTED, margin: [0, 2, 0, 0] },
        ] },
        { stack: [
          { text: seg(p.cycleLabel), fontSize: 12, bold: true, alignment: "right" },
          { text: seg(`วันที่จ่าย ${thDate(p.paidAt)}`), fontSize: 9.5, color: MUTED, alignment: "right" },
        ] },
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 762, y2: 0, lineWidth: 0.8, lineColor: GOLD_DK }], margin: [0, 8, 0, 10] },
      { columns: [
        { width: "*", stack: [
          { text: [{ text: seg("พนักงานขาย  "), color: MUTED }, { text: seg(p.salesName), bold: true }] },
          ...(p.salesEmail ? [{ text: p.salesEmail, fontSize: 9, color: MUTED }] : []),
          { text: [{ text: seg("บัญชีรับเงิน  "), color: MUTED }, { text: seg(p.bankAccount || "— (ยังไม่ระบุ)") }], fontSize: 9.5, margin: [0, 2, 0, 0] },
        ] },
        { width: "*", stack: [
          { text: [{ text: seg("จำนวน  "), color: MUTED }, { text: seg(`${p.items.length} งวด`), bold: true }] },
          { text: [{ text: seg("ยอดรวม  "), color: MUTED }, { text: `${formatMoney(p.total)} บาท`, bold: true, color: GOLD_DK }] },
        ] },
        { width: "*", stack: [
          { text: [{ text: seg("ผู้บันทึก  "), color: MUTED }, { text: seg(p.createdBy.name) }] },
          ...(p.note ? [{ text: seg(`หมายเหตุ: ${p.note}`), fontSize: 9, color: MUTED }] : []),
        ] },
      ], margin: [0, 0, 0, 12] },
      { table: {
        headerRows: 1,
        widths: [22, 70, 72, "*", 100, 30, 64, 70, 64, 66],
        body: [
          [head("#", { alignment: "center" }), head("ใบเสนอราคา"), head("รหัสสัญญา"), head("ลูกค้า"), head("รถ"), head("คันที่", { alignment: "center" }),
           head("เริ่มสัญญา", { alignment: "center" }), head("งวด", { alignment: "center" }), head("ครบกำหนด", { alignment: "center" }), head("จำนวนเงิน", { alignment: "right" })],
          ...rows,
          [cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(seg("รวม"), { bold: true, alignment: "right" }),
           cell(formatMoney(p.total), { alignment: "right", bold: true, color: GOLD_DK })],
        ],
      }, layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length) ? 0.6 : 0.3,
        vLineWidth: () => 0,
        hLineColor: () => RULE,
        paddingLeft: () => 4, paddingRight: () => 4,
      } },
      { columns: [
        { stack: [
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: INK }] },
          { text: seg("ผู้รับเงิน (พนักงานขาย)"), fontSize: 9, color: MUTED, margin: [0, 4, 0, 0] },
        ], width: 220 },
        { text: "", width: "*" },
        { stack: [
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: INK }] },
          { text: seg("ผู้อนุมัติจ่าย (การเงิน)"), fontSize: 9, color: MUTED, margin: [0, 4, 0, 0] },
        ], width: 220 },
      ], margin: [0, 40, 0, 0] },
    ],
  }
}
