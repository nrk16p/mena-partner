import { describe, it, expect } from "vitest"
import { formatBankAccount, hasBankAccount } from "./bank-account"

describe("bank-account", () => {
  it("รวม 3 ช่องเป็นบรรทัดเดียว ข้ามช่องว่าง", () => {
    expect(formatBankAccount({ bankName: "กสิกรไทย", bankAccountNo: "0758997766", bankAccountName: "กนกวรรณ วงษ์ชาลี" })).toBe("กสิกรไทย · 0758997766 · กนกวรรณ วงษ์ชาลี")
    expect(formatBankAccount({ bankName: "", bankAccountNo: "123", bankAccountName: " " })).toBe("123")
    expect(formatBankAccount(null)).toBe("")
  })
  it("มีบัญชีเมื่อมีเลขบัญชี", () => {
    expect(hasBankAccount({ bankAccountNo: "1" })).toBe(true)
    expect(hasBankAccount({ bankName: "กสิกรไทย" })).toBe(false)
  })
})
