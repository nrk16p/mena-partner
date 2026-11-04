import { describe, it, expect } from "vitest"
import { findOpenDealFor, isDealOpen, normalizePhone } from "./customer-match"

const deals = [
  { _id: "1", quotationNo: "QT-1", stage: "QUOTED", customerId: "c1", customerName: "สมชาย ใจดี", customerPhone: "081-234-5678", salesName: "K.Bally" },
  { _id: "2", quotationNo: "QT-2", stage: "CLOSED_LOST", customerId: "c2", customerName: "สมหญิง", customerPhone: "0899999999", salesName: "K.บอล" },
  { _id: "3", quotationNo: "QT-3", status: "won", customerName: "เก่า", customerPhone: "0811111111" },
  { _id: "4", quotationNo: "QT-4", status: "quoted", customerName: "เก่าเปิด", customerPhone: "0822222222" },
]

describe("customer-match", () => {
  it("normalizePhone ตัดขีด/เว้นวรรค และ +66", () => {
    expect(normalizePhone("081-234 5678")).toBe("0812345678")
    expect(normalizePhone("+66812345678")).toBe("0812345678")
  })
  it("isDealOpen: ตาม stage ถ้ามี ไม่มีก็ดู status เก่า", () => {
    expect(isDealOpen(deals[0])).toBe(true)
    expect(isDealOpen(deals[1])).toBe(false)
    expect(isDealOpen(deals[2])).toBe(false)
    expect(isDealOpen(deals[3])).toBe(true)
    expect(isDealOpen({ stage: "COMPLETED_90D" })).toBe(false)
    expect(isDealOpen({ stage: "ON_HOLD" })).toBe(true)
  })
  it("เจอด้วย customerId / เบอร์ / ชื่อ — ข้ามดีลที่ปิดแล้ว", () => {
    expect(findOpenDealFor(deals, { customerId: "c1" })?.quotationNo).toBe("QT-1")
    expect(findOpenDealFor(deals, { phone: "0812345678" })?.quotationNo).toBe("QT-1")
    expect(findOpenDealFor(deals, { name: " สมชาย  ใจดี " })?.quotationNo).toBe("QT-1")
    expect(findOpenDealFor(deals, { customerId: "c2", phone: "0899999999", name: "สมหญิง" })).toBeNull()
    expect(findOpenDealFor(deals, { phone: "0811111111" })).toBeNull()
    expect(findOpenDealFor(deals, { phone: "0822222222" })?.quotationNo).toBe("QT-4")
  })
  it("เบอร์สั้นเกิน/ชื่อว่าง ไม่จับคู่มั่ว · excludeId ไม่นับตัวเอง", () => {
    expect(findOpenDealFor(deals, { phone: "081" })).toBeNull()
    expect(findOpenDealFor(deals, { name: "" })).toBeNull()
    expect(findOpenDealFor(deals, { customerId: "c1" }, "1")).toBeNull()
  })
})
