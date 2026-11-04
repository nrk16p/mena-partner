import { describe, it, expect } from "vitest"
import { optionsOf, findVehicle, withVehicle, promote, type VehicleOption } from "./deal-vehicles"

const mk = (plate: string, price: number): VehicleOption => ({
  licensePlate: plate, vehicleBrand: "HINO", totalSalePrice: price, downPayment: 100, cashDown: 50,
  downInstallmentCount: 2, downInstallmentAmt: 25, financeAmount: price - 100, financeInstallments: 48, monthlyPayment: 10,
})
const deal = { ...mk("71-1111", 1000), extras: "แถม A", vehicles: [mk("71-2222", 2000), mk("71 1111", 999), mk("71-3333", 3000)] }

describe("deal-vehicles", () => {
  it("optionsOf ตัดคันหลักและทะเบียนซ้ำออก", () => {
    expect(optionsOf(deal).map((v) => v.licensePlate)).toEqual(["71-2222", "71-3333"])
  })
  it("findVehicle หาได้ทั้งคันหลักและคันเสนอ (ไม่สนช่องว่าง/ขีด)", () => {
    expect(findVehicle(deal, "711111")?.totalSalePrice).toBe(1000)
    expect(findVehicle(deal, "71-3333")?.totalSalePrice).toBe(3000)
    expect(findVehicle(deal, "71-9999")).toBeNull()
  })
  it("withVehicle สลับฟิลด์รถ/ราคา แต่ของแถมคงเดิมถ้าคันนั้นไม่มี", () => {
    const d = withVehicle(deal, mk("71-2222", 2000))
    expect(d.licensePlate).toBe("71-2222")
    expect(d.totalSalePrice).toBe(2000)
    expect(d.extras).toBe("แถม A")
  })
  it("promote: คันที่เลือกขึ้นเป็นหลัก คันหลักเดิมลงรายการ", () => {
    const r = promote(deal, "71-3333")!
    expect(r.primary.licensePlate).toBe("71-3333")
    expect(r.vehicles.map((v) => v.licensePlate)).toEqual(["71-1111", "71-2222"])
    expect(promote(deal, "71-9999")).toBeNull()
  })
})
