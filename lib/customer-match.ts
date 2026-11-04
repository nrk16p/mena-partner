import { isOpen } from "@/lib/deal-stage"

/**
 * กติกา "ลูกค้า 1 คน = 1 ดีลที่ยังเปิด" — เซลล์คนเดียวดูแลจนกว่าจะปิด
 * ปิดแล้ว (ปิด–ไม่สำเร็จ / ครบ 90 วัน / won-lost แบบเก่า) ค่อยเปิดใหม่ได้ เซลล์ใครก็ได้
 */
export interface MatchDeal {
  _id?: string
  quotationNo?: string
  status?: string
  stage?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  salesName?: string
}

/** เบอร์โทรเทียบด้วยตัวเลขล้วน (ตัด - เว้นวรรค +66) */
export function normalizePhone(p?: string): string {
  const digits = String(p ?? "").replace(/\D/g, "")
  return digits.startsWith("66") && digits.length === 11 ? "0" + digits.slice(2) : digits
}
export const normalizeName = (n?: string) => String(n ?? "").trim().replace(/\s+/g, " ").toLowerCase()

/** ดีลยังเปิดอยู่ไหม — มี stage ใช้กติกา pipeline · ดีลเก่าไม่มี stage ดูจาก status */
export function isDealOpen(d: MatchDeal): boolean {
  if (d.stage) return isOpen(d.stage)
  return d.status !== "won" && d.status !== "lost"
}

/** ดีลเปิดของลูกค้าคนนี้ (ถ้ามี) — เทียบ id ก่อน แล้วเบอร์โทร แล้วชื่อเต็ม */
export function findOpenDealFor(
  deals: MatchDeal[],
  who: { customerId?: string; phone?: string; name?: string },
  excludeId?: string,
): MatchDeal | null {
  const phone = normalizePhone(who.phone)
  const name = normalizeName(who.name)
  const id = String(who.customerId ?? "").trim()
  const open = deals.filter((d) => isDealOpen(d) && (!excludeId || String(d._id) !== excludeId))
  return open.find((d) => id && String(d.customerId ?? "") === id)
    ?? open.find((d) => phone.length >= 9 && normalizePhone(d.customerPhone) === phone)
    ?? open.find((d) => name && normalizeName(d.customerName) === name)
    ?? null
}
