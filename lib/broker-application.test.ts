import { describe, it, expect } from "vitest"
import { parseBrokerApplication, isThaiNationalId } from "@/lib/broker-application"

// เลขบัตรที่หลักสุดท้ายถูกตามสูตร — สร้างจาก 12 หลักแรก
function withCheck(d12: string) {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (13 - i)
  return d12 + String((11 - (sum % 11)) % 10)
}
const ID = withCheck("110170023070")

const good = {
  firstName: "สมชาย", lastName: "ใจดี", nationalId: ID, address: "99 หมู่ 1 ต.หน้าพระลาน อ.เฉลิมพระเกียรติ จ.สระบุรี",
  phone: "081-234-5678", lineId: "somchai", position: "", company: "",
  bankAccountNo: "123-4-56789-0", bankName: "กสิกรไทย", bankAccountName: "สมชาย ใจดี",
  center: "ssb", centerOther: "", consentPdpa: true, confirmTrue: true,
}

describe("isThaiNationalId", () => {
  it("เลขถูกสูตร → ผ่าน", () => expect(isThaiNationalId(ID)).toBe(true))
  it("หลักสุดท้ายผิด → ไม่ผ่าน", () => expect(isThaiNationalId(ID.slice(0, 12) + String((Number(ID[12]) + 1) % 10))).toBe(false))
  it("ไม่ครบ 13 หลัก → ไม่ผ่าน", () => expect(isThaiNationalId("123")).toBe(false))
})

describe("parseBrokerApplication", () => {
  it("ข้อมูลครบ → ผ่าน และตัดขีดออกจากเบอร์/เลขบัญชี", () => {
    const r = parseBrokerApplication(good)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.phone).toBe("0812345678")
      expect(r.data.bankAccountNo).toBe("1234567890")
    }
  })
  it("ไม่ติ๊กยินยอม PDPA → ปฏิเสธ", () => {
    expect(parseBrokerApplication({ ...good, consentPdpa: false }).ok).toBe(false)
  })
  it("ไม่ติ๊กยืนยันข้อมูล → ปฏิเสธ", () => {
    expect(parseBrokerApplication({ ...good, confirmTrue: false }).ok).toBe(false)
  })
  it("honeypot มีค่า → ปฏิเสธ", () => {
    expect(parseBrokerApplication({ ...good, website: "x" }).ok).toBe(false)
  })
  it("เลขบัตรผิด → บอกว่าเลขบัตรผิด", () => {
    const r = parseBrokerApplication({ ...good, nationalId: "1234567890123" })
    expect(r).toEqual({ ok: false, error: expect.stringContaining("เลขบัตร") })
  })
  it("เลือกศูนย์อื่น ๆ แต่ไม่พิมพ์ชื่อ → ปฏิเสธ", () => {
    expect(parseBrokerApplication({ ...good, center: "other", centerOther: "" }).ok).toBe(false)
  })
  it("ศูนย์ที่ไม่ใช่อื่น ๆ → ล้างช่องชื่อศูนย์ทิ้ง", () => {
    const r = parseBrokerApplication({ ...good, centerOther: "ขยะ" })
    expect(r.ok && r.data.centerOther).toBe("")
  })
  it("field แปลกปลอมไม่หลุดเข้าข้อมูล", () => {
    const r = parseBrokerApplication({ ...good, status: "approved" })
    expect(r.ok && "status" in r.data).toBe(false)
  })
})
