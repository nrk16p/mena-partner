import { describe, it, expect } from "vitest"
import { displaySalePrice } from "@/lib/sale-display"

describe("displaySalePrice — ปัดเลข + ลงตัว", () => {
  it("สบ.70-6298: ราคาปัดขึ้นพัน ดาวน์รับส่วนต่างให้ลงตัว", () => {
    const d = displaySalePrice({ totalSalePrice: 1335728, downPayment: 100000, monthlyPayment: 17163, financeInstallments: 72 })
    expect(d).toEqual({ price: 1339000, monthlyPayment: 17200, downPayment: 100600 })
    expect(d.price).toBe(d.downPayment + d.monthlyPayment * 72)
  })

  it("ทุกคันบนหน้าเว็บ: ราคาเป็นหลักพัน และ ดาวน์ + ค่างวด × งวด = ราคา", () => {
    const rows = [
      { totalSalePrice: 1335728, downPayment: 100000, monthlyPayment: 17163, financeInstallments: 72 },
      { totalSalePrice: 1650991, downPayment: 100000, monthlyPayment: 16108, financeInstallments: 96 },
      { totalSalePrice: 1698591, downPayment: 100000, monthlyPayment: 16651, financeInstallments: 96 },
      { totalSalePrice: 1703693, downPayment: 100000, monthlyPayment: 16705, financeInstallments: 96 },
      { totalSalePrice: 1759987, downPayment: 100000, monthlyPayment: 17292, financeInstallments: 96 },
      { totalSalePrice: 1869893, downPayment: 100000, monthlyPayment: 18436, financeInstallments: 96 },
    ]
    for (const r of rows) {
      const d = displaySalePrice(r)
      expect(d.price % 1000).toBe(0)
      expect(d.monthlyPayment % 100).toBe(0)
      expect(d.price).toBe(d.downPayment + d.monthlyPayment * r.financeInstallments)
      expect(d.price).toBeGreaterThanOrEqual(r.totalSalePrice)   // ห้ามโชว์ต่ำกว่าราคาจริงในระบบ
      expect(d.downPayment - r.downPayment).toBeLessThan(1000)   // ดาวน์ขยับได้ไม่เกินหลักพัน
    }
  })

  it("ไม่มีดาวน์ → ปัดราคาขึ้นพัน แต่ไม่เสกดาวน์จากเศษ", () => {
    expect(displaySalePrice({ downPayment: 0, monthlyPayment: 17200, financeInstallments: 72 }))
      .toEqual({ price: 1239000, monthlyPayment: 17200, downPayment: 0 })
  })

  it("ไม่มีแผนผ่อน → ราคาปัดขึ้นเต็มพัน ดาวน์คงเดิม", () => {
    expect(displaySalePrice({ totalSalePrice: 1335728, downPayment: 100000 }))
      .toEqual({ price: 1336000, monthlyPayment: 0, downPayment: 100000 })
  })

  it("ไม่มีราคา → 0", () => {
    expect(displaySalePrice({})).toEqual({ price: 0, monthlyPayment: 0, downPayment: 0 })
  })
})
