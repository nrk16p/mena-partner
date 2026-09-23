/**
 * ตัวเลขราคา "สำหรับแสดงฝั่งขาย" — โปสเตอร์, หน้า /catalog, หน้าเว็บ /trucks (ฝ่ายขาย 2026-09-22: ปัดเลขกลม + ต้องลงตัว)
 * - ค่างวด → ปัดขึ้นเต็มร้อย
 * - ราคา → ปัดขึ้นเต็มพันเสมอ (ฝ่ายขาย 2026-09-23 "ราคารถต้องเป็นหลักพัน")
 * - มีแผนผ่อน → ดาวน์ที่โชว์รับส่วนต่างให้ยอดลงตัว: ดาวน์ = ราคา − ค่างวด × งวด
 *   (1,339,000 = 100,600 + 17,200 × 72 · ในระบบ 1,335,728 / ดาวน์จริง 100,000 — ส่วนต่างสูงสุด 800 บาท)
 *   ปัดราคาเป็นพันพร้อมคงดาวน์ 100,000 ไว้ด้วยกันไม่ได้ ผู้ใช้เลือกให้ดาวน์ขยับ ยอดจะได้บวกแล้วลงตัว
 * - ไม่มีแผนผ่อน → ราคาปัดขึ้นเต็มพัน ดาวน์คงเดิม
 * ใช้แสดงผลเท่านั้น — ตัวเลขจริงยังอยู่ในระบบ/Catalog PDF/ใบเสนอราคา/สัญญา (lead จากเว็บเก็บราคาจริง)
 */

const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0)
export const ceilTo = (v: number, unit: number) => (v > 0 ? Math.ceil(v / unit) * unit : 0)

export interface SalePriceInput {
  totalSalePrice?: unknown
  downPayment?: unknown
  monthlyPayment?: unknown
  financeInstallments?: unknown
}

export function displaySalePrice(p: SalePriceInput): { price: number; monthlyPayment: number; downPayment: number } {
  const monthly = ceilTo(n(p.monthlyPayment), 100)
  const count = n(p.financeInstallments)
  if (monthly > 0 && count > 0) {
    const down = n(p.downPayment)
    const price = ceilTo(down + monthly * count, 1_000)
    // ไม่มีดาวน์จริง → ไม่เสกดาวน์ขึ้นมาจากเศษที่ปัด (หน้าเว็บจะขึ้น "ดาวน์ 600" ทั้งที่รถคันนั้นไม่มีดาวน์)
    return { price, monthlyPayment: monthly, downPayment: down > 0 ? price - monthly * count : 0 }
  }
  return { price: ceilTo(n(p.totalSalePrice), 1_000), monthlyPayment: monthly, downPayment: n(p.downPayment) }
}
