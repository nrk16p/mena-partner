/**
 * ตัวเลขราคา "สำหรับแสดงฝั่งขาย" — โปสเตอร์, หน้า /catalog, หน้าเว็บ /trucks, Catalog PDF
 * **ใช้ตัวเลขจากหน้า /price-list ตรง ๆ ไม่ปัด** (ผู้ใช้สั่ง 2026-11-13 "ยกเลิกปัดราคาทั้งหมด เอาจาก price-list เป็นหลัก")
 * — เดิม (2026-09-23) ปัดค่างวดขึ้นขั้น 250 แล้วคำนวณราคาใหม่ เลิกใช้แล้วทุกกลุ่ม (ML/MS)
 * ราคา = totalSalePrice · ค่างวด = monthlyPayment · ดาวน์ = downPayment (ตรงกับใบเสนอราคา/สัญญา)
 */

const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0)
export const ceilTo = (v: number, unit: number) => (v > 0 ? Math.ceil(v / unit) * unit : 0)

export interface SalePriceInput {
  /** "MS" (Mixer 6 ล้อ) = โชว์ตัวเลขจริงตามชีตไม่ปัด — ผู้ใช้สั่ง 2026-11-13 ("★ สรุปสำหรับเซลล์" เช่น 60 งวด × 9,640) */
  sizeGroup?: unknown
  totalSalePrice?: unknown
  downPayment?: unknown
  monthlyPayment?: unknown
  financeInstallments?: unknown
}

export function displaySalePrice(p: SalePriceInput): { price: number; monthlyPayment: number; downPayment: number } {
  return { price: n(p.totalSalePrice), monthlyPayment: n(p.monthlyPayment), downPayment: n(p.downPayment) }
}
