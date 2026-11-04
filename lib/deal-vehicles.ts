/**
 * ดีลเดียว เสนอรถได้หลายคัน (แบบ A): ฟิลด์รถ/ราคาบนเอกสาร = "คันหลัก" (คันที่กำลังปิด)
 * คันอื่นที่เสนอให้ลูกค้าเลือกอยู่ใน vehicles[] — ออก PDF แยกคันได้ด้วย ?plate=
 * ไฟล์นี้ pure (ใช้ได้ทั้ง client/server/test)
 */
export interface VehicleOption {
  licensePlate: string
  vehicleBrand?: string
  vehicleModel?: string
  truckNumber?: string
  vehiclePhotoUrl?: string
  vehiclePhotos?: { front?: string; back?: string; left?: string; right?: string; cabin?: string }
  totalSalePrice: number
  downPayment: number
  cashDown: number
  downInstallmentCount: number
  downInstallmentAmt: number
  financeAmount: number
  financeInstallments: number
  monthlyPayment: number
  extras?: string
  addedAt?: string
  addedBy?: string
}

/** ฟิลด์ที่ย้ายไปมาระหว่างคันหลักกับคันเสนอ */
export const VEHICLE_FIELDS = [
  "licensePlate", "vehicleBrand", "vehicleModel", "truckNumber", "vehiclePhotoUrl", "vehiclePhotos",
  "totalSalePrice", "downPayment", "cashDown", "downInstallmentCount", "downInstallmentAmt",
  "financeAmount", "financeInstallments", "monthlyPayment", "extras",
] as const

export const normPlate = (p?: string) => String(p ?? "").replace(/[\s.\-]/g, "").toLowerCase()

/** คันหลักของดีลในรูป VehicleOption (ไม่มีรถ = null) */
export function primaryOf(q: Partial<VehicleOption> & { licensePlate?: string }): VehicleOption | null {
  if (!q.licensePlate) return null
  const o: Record<string, unknown> = {}
  for (const k of VEHICLE_FIELDS) o[k] = q[k as keyof typeof q]
  return o as unknown as VehicleOption
}

/** รายการคันเสนอ (ไม่รวมคันหลัก ไม่ซ้ำทะเบียน) */
export function optionsOf(q: { licensePlate?: string; vehicles?: VehicleOption[] }): VehicleOption[] {
  const seen = new Set<string>([normPlate(q.licensePlate)])
  return (q.vehicles ?? []).filter((v) => {
    const k = normPlate(v.licensePlate)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** หาคันตามทะเบียน — คันหลักก่อน แล้วค่อยคันเสนอ */
export function findVehicle(q: { licensePlate?: string; vehicles?: VehicleOption[] } & Partial<VehicleOption>, plate: string): VehicleOption | null {
  const k = normPlate(plate)
  if (!k) return null
  const primary = primaryOf(q)
  if (primary && normPlate(primary.licensePlate) === k) return primary
  return optionsOf(q).find((v) => normPlate(v.licensePlate) === k) ?? null
}

/** เอกสารใบเสนอที่สลับรถเป็นคันที่ระบุ (ใช้ออก PDF แยกคัน) — ไม่แตะ DB */
export function withVehicle<T extends Record<string, unknown>>(q: T, v: VehicleOption): T {
  const out: Record<string, unknown> = { ...q }
  for (const k of VEHICLE_FIELDS) out[k] = v[k as keyof VehicleOption] ?? (k === "extras" ? out.extras : undefined)
  return out as T
}

/** สลับคันหลัก: คันที่เลือกขึ้นเป็นหลัก คันหลักเดิมลงไปอยู่ในรายการ (ไม่ทิ้งข้อมูล) */
export function promote(q: { licensePlate?: string; vehicles?: VehicleOption[] } & Partial<VehicleOption>, plate: string):
  { primary: VehicleOption; vehicles: VehicleOption[] } | null {
  const target = optionsOf(q).find((v) => normPlate(v.licensePlate) === normPlate(plate))
  if (!target) return null
  const old = primaryOf(q)
  const rest = optionsOf(q).filter((v) => normPlate(v.licensePlate) !== normPlate(plate))
  return { primary: target, vehicles: old ? [old, ...rest] : rest }
}
