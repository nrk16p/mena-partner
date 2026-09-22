import { createHash } from "node:crypto"
import { promoCopy, type PromoCopy } from "@/lib/promo-copy"
import { displaySalePrice } from "@/lib/sale-display"

/** ทะเบียนไม่เอา prefix "สบ." — สูตรเดียวกับ lib/catalog-pdf (ไม่ import เพราะไฟล์นั้น server-only เทสต์โหลดไม่ได้) */
const normPlate = (p?: string | null) => (p ?? "").replace(/^[^0-9]*/, "").trim()

/**
 * ชั้นข้อมูลสาธารณะของหน้า /trucks — **แยก namespace จาก API ภายในโดยตั้งใจ**
 * ทุก field ที่ออกสู่เว็บสาธารณะต้องผ่าน toPublicTruck() เท่านั้น
 * ห้ามเพิ่ม field ลง PublicTruck โดยไม่อัปเดตเทสต์ allowlist ใน public-trucks.test.ts
 */

export interface PublicTruck {
  slug: string
  truckNumber: string
  brand: string
  model: string
  vehicleType: string
  characteristic: string
  color: string
  registrationYear: number | null   // ค.ศ. (หน้าเว็บแสดงคู่ พ.ศ. = +543)
  engineSize: string
  photoUrl: string
  photos: { front: string; back: string; left: string; right: string; cabin: string }
  totalSalePrice: number
  downPayment: number
  cashDown: number
  monthlyPayment: number
  financeInstallments: number
  /** ตัวเลขที่แสดงบนหน้าเว็บ (ปัดเลขกลม + ลงตัวกับดาวน์/งวด) — field ราคาด้านบนคือราคาจริง ใช้ตอนบันทึก lead */
  display: { price: number; monthlyPayment: number }
  promos: PromoCopy[]   // ถ้อยคำจาก lib/promo-copy (ชุดเดียวกับโปสเตอร์/Catalog PDF)
  isSold: boolean
}

const DB = process.env.MONGO_DB ?? "mena_partner"
const s = (v: unknown) => String(v ?? "").trim()
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0)

/** a-z0-9 + ขีด; ภาษาไทย/อักขระพิเศษกลายเป็นขีด แล้วยุบขีดซ้ำ */
const slugPart = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

export function registrationYear(registrationDate?: string): number | null {
  const y = Number(String(registrationDate ?? "").slice(0, 4))
  return Number.isInteger(y) && y > 1900 && y < 2200 ? y : null
}

export function makeSlug(v: {
  truckNumber?: string; brand?: string; model?: string
  registrationDate?: string; licensePlate?: string
}): string {
  const year = registrationYear(v.registrationDate)
  // ไม่มีเบอร์รถ → hash ทะเบียน (ย้อนกลับเป็นทะเบียนไม่ได้ ตามข้อห้ามไม่เผยทะเบียน)
  const head = slugPart(s(v.truckNumber)) ||
    `t-${createHash("sha256").update(s(v.licensePlate)).digest("hex").slice(0, 6)}`
  const parts = [head, slugPart(s(v.brand)), slugPart(s(v.model)), year ? String(year + 543) : ""]
  const slug = parts.filter(Boolean).join("-").replace(/-+/g, "-")
  return slug || `t-${createHash("sha256").update(s(v.licensePlate) + s(v.truckNumber)).digest("hex").slice(0, 8)}`
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now()}`
}

export function toPublicTruck(
  vehicle: Record<string, unknown>,
  price: Record<string, unknown> | undefined,
  promos: PromoCopy[],
  slug: string,
  isSold: boolean,
): PublicTruck {
  const ph = (vehicle.photos ?? {}) as Record<string, unknown>
  return {
    slug,
    truckNumber: s(vehicle.truckNumber),
    brand: s(vehicle.brand),
    model: s(vehicle.model),
    vehicleType: s(vehicle.vehicleType),
    characteristic: s(vehicle.characteristic),
    color: s(vehicle.color),
    registrationYear: registrationYear(s(vehicle.registrationDate)),
    engineSize: s(vehicle.engineSize),
    photoUrl: s(vehicle.photoUrl) || s(ph.front),
    photos: {
      front: s(ph.front), back: s(ph.back), left: s(ph.left), right: s(ph.right), cabin: s(ph.cabin),
    },
    totalSalePrice: n(price?.totalSalePrice),
    downPayment: n(price?.downPayment),
    cashDown: n(price?.cashDown),
    monthlyPayment: n(price?.monthlyPayment),
    financeInstallments: n(price?.financeInstallments),
    display: displaySalePrice(price ?? {}),
    promos,
    isSold,
  }
}

/** เกณฑ์เดียวกับ catalog PDF: ไม่ inactive + ไม่มีสัญญา active + saleStatus ready */
export function isReadyForSale(
  vehicle: Record<string, unknown>,
  price: Record<string, unknown> | undefined,
  underContract: Set<string>,
): boolean {
  if (!price) return false
  const key = normPlate(String(vehicle.licensePlate ?? ""))
  return vehicle.status !== "inactive" && !underContract.has(key) && price.saleStatus === "ready"
}

/** projection = field ที่เปิดเผยได้เท่านั้น (ไม่ดึงเลขตัวถัง/เลขเครื่องออกจาก DB ตั้งแต่ต้น) */
const VEHICLE_PROJECTION = {
  licensePlate: 1, truckNumber: 1, brand: 1, model: 1, vehicleType: 1,
  characteristic: 1, color: 1, registrationDate: 1, engineSize: 1,
  photoUrl: 1, photos: 1, status: 1, publicSlug: 1,
} as const

async function loadAll() {
  // import แบบ lazy — lib/mongo throw ตอน import ถ้าไม่มี MONGO_URI ทำให้เทสต์ pure function รันไม่ได้
  const { default: clientPromise } = await import("@/lib/mongo")
  const db = (await clientPromise).db(DB)
  const [vehicles, prices, promos, contracts] = await Promise.all([
    db.collection("vehicle_master").find({}, { projection: VEHICLE_PROJECTION }).toArray(),
    db.collection("master_price_list").find({}, { projection: { licensePlate: 1, saleStatus: 1, totalSalePrice: 1, downPayment: 1, cashDown: 1, monthlyPayment: 1, financeInstallments: 1 } }).toArray(),
    db.collection("promotion_master").find({}, { projection: { licensePlate: 1, pro1Condition: 1, pro1FreeCount: 1, pro1TotalValue: 1, pro2RepairBudget: 1, pro3AnnualPm: 1 } }).toArray(),
    db.collection("contracts").find({ status: "active" }, { projection: { licensePlate: 1 } }).toArray(),
  ])
  return {
    vehicles,
    priceBy: new Map(prices.map((p) => [normPlate(String(p.licensePlate ?? "")), p])),
    promoBy: new Map(promos.map((p) => [normPlate(String(p.licensePlate ?? "")), p])),
    underContract: new Set(contracts.map((c) => normPlate(String(c.licensePlate ?? "")))),
  }
}

/** slug ที่ยังไม่ถูก backfill → คำนวณสดแบบ deterministic (scripts/backfill-public-slug.mjs เขียนค่าถาวร) */
function slugOf(v: Record<string, unknown>, taken: Set<string>): string {
  const stored = String(v.publicSlug ?? "").trim()
  if (stored) return stored
  return uniqueSlug(makeSlug({
    truckNumber: String(v.truckNumber ?? ""), brand: String(v.brand ?? ""),
    model: String(v.model ?? ""), registrationDate: String(v.registrationDate ?? ""),
    licensePlate: String(v.licensePlate ?? ""),
  }), taken)
}

export async function loadPublicTrucks(): Promise<PublicTruck[]> {
  const { vehicles, priceBy, promoBy, underContract } = await loadAll()
  const taken = new Set<string>()
  const out: PublicTruck[] = []
  for (const v of vehicles) {
    const key = normPlate(String(v.licensePlate ?? ""))
    if (!isReadyForSale(v, priceBy.get(key), underContract)) continue
    const slug = slugOf(v, taken)
    taken.add(slug)
    out.push(toPublicTruck(v, priceBy.get(key), promoCopy(promoBy.get(key)), slug, false))
  }
  // มีรูปขึ้นก่อน (หน้าแรกต้องดูดี) แล้วเรียงราคาต่ำ→สูง
  return out.sort((a, b) =>
    Number(!!b.photoUrl) - Number(!!a.photoUrl) || a.display.price - b.display.price)
}

export async function loadPublicTruckBySlug(slug: string): Promise<PublicTruck | null> {
  const { vehicles, priceBy, promoBy, underContract } = await loadAll()
  const taken = new Set<string>()
  for (const v of vehicles) {
    const s2 = slugOf(v, taken)
    taken.add(s2)
    if (s2 !== slug) continue
    const key = normPlate(String(v.licensePlate ?? ""))
    const price = priceBy.get(key)
    const ready = isReadyForSale(v, price, underContract)
    // รถที่ขายแล้ว/เข้าสัญญาแล้ว ยังเปิดหน้าได้ (ริบบิ้น "ขายแล้ว" + noindex)
    return toPublicTruck(v, price, promoCopy(promoBy.get(key)), s2, !ready)
  }
  return null
}
