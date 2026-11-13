import { describe, it, expect } from "vitest"
import { displaySalePrice } from "@/lib/sale-display"

// ตั้งแต่ 2026-11-13 ไม่ปัดราคาแล้ว — ตัวเลขฝั่งขายต้องเท่ากับ /price-list เป๊ะ
describe("displaySalePrice — ใช้ตัวเลข price-list ตรง ๆ", () => {
  it("ML สบ.70-6298: ไม่ปัดค่างวด/ราคา", () => {
    expect(displaySalePrice({ totalSalePrice: 1335728, downPayment: 100000, monthlyPayment: 17163, financeInstallments: 72 }))
      .toEqual({ price: 1335728, monthlyPayment: 17163, downPayment: 100000 })
  })

  it("MS: 60 งวด × 9,640 · ราคา 608,400", () => {
    expect(displaySalePrice({ sizeGroup: "MS", totalSalePrice: 608400, downPayment: 30000, monthlyPayment: 9640, financeInstallments: 60 }))
      .toEqual({ price: 608400, monthlyPayment: 9640, downPayment: 30000 })
  })

  it("ไม่มีแผนผ่อน / ข้อมูลว่าง → 0 ไม่เสกตัวเลข", () => {
    expect(displaySalePrice({ totalSalePrice: 950000 })).toEqual({ price: 950000, monthlyPayment: 0, downPayment: 0 })
    expect(displaySalePrice({})).toEqual({ price: 0, monthlyPayment: 0, downPayment: 0 })
  })
})
