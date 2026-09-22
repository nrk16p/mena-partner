import { describe, it, expect } from "vitest"
import { displaySalePrice } from "@/lib/sale-display"

describe("displaySalePrice — ปัดเลขกลม", () => {
  it("สบ.70-6298: ดาวน์ + ค่างวดปัดร้อย × งวด แล้วปัดราคาขึ้นเต็มพัน", () => {
    const d = displaySalePrice({ totalSalePrice: 1335728, downPayment: 100000, monthlyPayment: 17163, financeInstallments: 72 })
    expect(d).toEqual({ price: 1339000, monthlyPayment: 17200 })
    const plan = 100000 + d.monthlyPayment * 72
    expect(d.price - plan).toBeGreaterThanOrEqual(0)
    expect(d.price - plan).toBeLessThan(1000)
  })

  it("ผลรวมแผนผ่อนลงพันพอดี → ไม่ปัดเพิ่ม", () => {
    expect(displaySalePrice({ downPayment: 100000, monthlyPayment: 18436, financeInstallments: 96 }).price).toBe(1876000)
  })

  it("ค่างวดลงตัวร้อยอยู่แล้ว → ไม่ปัดเพิ่ม", () => {
    expect(displaySalePrice({ downPayment: 0, monthlyPayment: 17200, financeInstallments: 72 })).toEqual({ price: 1239000, monthlyPayment: 17200 })
  })

  it("ไม่มีแผนผ่อน → ราคาปัดขึ้นเต็มพัน", () => {
    expect(displaySalePrice({ totalSalePrice: 1335728 })).toEqual({ price: 1336000, monthlyPayment: 0 })
  })

  it("ไม่มีราคา → 0", () => {
    expect(displaySalePrice({})).toEqual({ price: 0, monthlyPayment: 0 })
  })
})
