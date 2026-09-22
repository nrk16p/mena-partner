/**
 * ตัวเลขราคา "สำหรับแสดงฝั่งขาย" — โปสเตอร์, หน้า /catalog, หน้าเว็บ /trucks (ฝ่ายขาย 2026-09-22: ปัดเลขกลม + ต้องลงตัว)
 * - ค่างวด → ปัดขึ้นเต็มร้อย
 * - ราคา = ดาวน์ + ค่างวดที่ปัดแล้ว × งวด  (100,000 + 17,200 × 72 = 1,338,400 · ในระบบ 1,335,728)
 * - ไม่มีแผนผ่อน → ราคาปัดขึ้นเต็มพัน
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

export function displaySalePrice(p: SalePriceInput): { price: number; monthlyPayment: number } {
  const monthly = ceilTo(n(p.monthlyPayment), 100)
  const count = n(p.financeInstallments)
  return {
    price: monthly > 0 && count > 0 ? n(p.downPayment) + monthly * count : ceilTo(n(p.totalSalePrice), 1_000),
    monthlyPayment: monthly,
  }
}
