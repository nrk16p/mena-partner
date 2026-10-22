/**
 * ความพร้อมขายที่ใช้จริงในหน้า /price-list
 * รถติดสัญญา = ขายแล้ว เสมอ ไม่ดู saleStatus ที่เคยตั้งไว้ตอนยังว่าง
 * (เคยมีรถตั้ง "พร้อมขาย" ไว้ก่อนขาย พอติดสัญญาแล้วยังถูกนับเป็นพร้อมขายในตัวกรอง — 2026-10-22)
 */

export type SaleKey = "sold" | "ready" | "repair15" | "repair30" | "review" | "none"

export interface SaleRow {
  status: string
  saleStatus: string | null
}

const SET_KEYS = new Set(["ready", "repair15", "repair30", "review"])

export function effectiveSaleKey(r: SaleRow): SaleKey {
  if (r.status === "contract") return "sold"
  return r.saleStatus && SET_KEYS.has(r.saleStatus) ? (r.saleStatus as SaleKey) : "none"
}

export function countBySaleKey(rows: SaleRow[]): Record<SaleKey, number> {
  const c: Record<SaleKey, number> = { sold: 0, ready: 0, repair15: 0, repair30: 0, review: 0, none: 0 }
  for (const r of rows) c[effectiveSaleKey(r)]++
  return c
}
