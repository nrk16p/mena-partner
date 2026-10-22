import { describe, it, expect } from "vitest"
import { effectiveSaleKey, countBySaleKey } from "@/lib/sale-readiness"

describe("effectiveSaleKey", () => {
  it("รถติดสัญญา = ขายแล้ว แม้เคยตั้งพร้อมขายไว้ก่อนขาย", () => {
    expect(effectiveSaleKey({ status: "contract", saleStatus: "ready" })).toBe("sold")
    expect(effectiveSaleKey({ status: "contract", saleStatus: "repair15" })).toBe("sold")
    expect(effectiveSaleKey({ status: "contract", saleStatus: null })).toBe("sold")
  })
  it("รถว่างใช้สถานะที่ตั้งไว้", () => {
    expect(effectiveSaleKey({ status: "active", saleStatus: "ready" })).toBe("ready")
    expect(effectiveSaleKey({ status: "active", saleStatus: "review" })).toBe("review")
  })
  it("รถว่างที่ยังไม่ตั้งสถานะ = ยังไม่ระบุ", () => {
    expect(effectiveSaleKey({ status: "active", saleStatus: null })).toBe("none")
  })
})

describe("countBySaleKey", () => {
  it("นับแต่ละกลุ่มไม่ซ้ำกัน รวมแล้วเท่าจำนวนรถทั้งหมด", () => {
    const rows = [
      { status: "contract", saleStatus: "ready" },
      { status: "contract", saleStatus: null },
      { status: "active", saleStatus: "ready" },
      { status: "active", saleStatus: "repair30" },
      { status: "active", saleStatus: null },
    ]
    const c = countBySaleKey(rows)
    expect(c).toEqual({ sold: 2, ready: 1, repair15: 0, repair30: 1, review: 0, none: 1 })
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(rows.length)
  })
})
