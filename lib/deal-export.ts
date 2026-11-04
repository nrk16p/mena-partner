import { STATUS_LABEL } from "@/lib/deal-stage"
import { stageOfDeal } from "@/lib/deal-list"

/** แถวดีลเท่าที่ไฟล์ Excel ต้องใช้ (หน้ารายการโหลดเอกสารเต็มมาอยู่แล้ว) */
export interface ExportDeal {
  quotationNo?: string
  stage?: string
  stageEnteredAt?: string
  nextFollowUpDate?: string
  holdReason?: string
  lossReasonLabel?: string
  customerName?: string
  customerPhone?: string
  licensePlate?: string
  truckNumber?: string
  vehicleBrand?: string
  vehicleModel?: string
  totalSalePrice?: number
  monthlyPayment?: number
  financeInstallments?: number
  depositAmount?: number
  salesName?: string
  createdBy?: { name?: string; email?: string }
  updatedBy?: { name?: string; at?: string }
  createdAt?: string
  lastActivityAt?: string
  updatedAt?: string
  timeline?: { at: string; action: string; note?: string }[]
}

const thDate = (iso?: string) => {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })
}
const lastNoteOf = (d: ExportDeal) => {
  const stage = stageOfDeal(d)
  if (stage === "ON_HOLD" && d.holdReason) return d.holdReason
  if (stage === "CLOSED_LOST") return d.lossReasonLabel ?? ""
  return [...(d.timeline ?? [])].reverse().find((t) => t.note)?.note ?? ""
}

/** แปลงดีลเป็นแถว Excel — หัวคอลัมน์ภาษาไทย เรียงตามที่ทีมขายอ่านในหน้ารายการ */
export function dealExportRows(deals: ExportDeal[]): Record<string, string | number>[] {
  return deals.map((d) => {
    const stage = stageOfDeal(d)
    return {
      "เลขที่": d.quotationNo ?? "",
      "ลูกค้า": d.customerName ?? "",
      "โทร": d.customerPhone ?? "",
      "ทะเบียน": d.licensePlate ?? "",
      "เบอร์รถ": d.truckNumber ?? "",
      "ยี่ห้อ/รุ่น": [d.vehicleBrand, d.vehicleModel].filter(Boolean).join(" "),
      "ราคาขาย": Number(d.totalSalePrice ?? 0) || 0,
      "ค่างวด/เดือน": Number(d.monthlyPayment ?? 0) || 0,
      "จำนวนงวด": Number(d.financeInstallments ?? 0) || 0,
      "เงินจอง": Number(d.depositAmount ?? 0) || 0,
      "สถานะ": STATUS_LABEL[stage as keyof typeof STATUS_LABEL] ?? stage,
      "รหัสสถานะ": stage,
      "เข้าขั้นนี้เมื่อ": thDate(d.stageEnteredAt),
      "ติดตามถัดไป": thDate(d.nextFollowUpDate),
      "เซลล์": d.salesName ?? "",
      "คีย์โดย": d.createdBy?.name ?? "",
      "แก้ล่าสุดโดย": d.updatedBy?.name ?? "",
      "วันสร้าง": thDate(d.createdAt),
      "เคลื่อนไหวล่าสุด": thDate(d.lastActivityAt ?? d.updatedAt),
      "หมายเหตุล่าสุด": lastNoteOf(d),
    }
  })
}

export const dealExportFilename = () => `deals-${new Date().toISOString().slice(0, 10)}.xlsx`
