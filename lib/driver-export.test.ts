import { describe, it, expect } from "vitest"
import { ageFrom, fullNameNoPrefix, splitFullName } from "@/lib/driver-export"

describe("driver export", () => {
  it("ชื่อ-นามสกุลคอลัมน์เดียว ไม่มีคำนำหน้า", () => {
    expect(fullNameNoPrefix("สมชาย", "ใจดี")).toBe("สมชาย ใจดี")
    expect(fullNameNoPrefix("นายสมชาย", "ใจดี")).toBe("สมชาย ใจดี")
    expect(fullNameNoPrefix("นางสาว สมหญิง", " รักดี ")).toBe("สมหญิง รักดี")
  })
  it("แยกกลับตอน import", () => {
    expect(splitFullName("สมชาย ใจดี")).toEqual({ firstName: "สมชาย", lastName: "ใจดี" })
    expect(splitFullName("นาย สมชาย ณ อยุธยา")).toEqual({ firstName: "สมชาย", lastName: "ณ อยุธยา" })
  })
  it("อายุเต็มปี", () => {
    const today = new Date("2026-11-23T00:00:00")
    expect(ageFrom("1990-11-23", today)).toBe(36)
    expect(ageFrom("1990-11-24", today)).toBe(35)
    expect(ageFrom("", today)).toBe("")
    expect(ageFrom("abc", today)).toBe("")
  })
})
