import { describe, it, expect } from "vitest"
import { formatMoney, formatMonth, formatDate, prevMonth, computePayroll } from "@/lib/utils"

describe("formatMoney", () => {
  it("formats positive number with Thai locale", () => {
    expect(formatMoney(15000)).toBe("15,000.00")
  })
  it("formats zero", () => {
    expect(formatMoney(0)).toBe("0.00")
  })
  it("formats negative", () => {
    expect(formatMoney(-500.5)).toBe("-500.50")
  })
})

describe("formatMonth", () => {
  it("converts YYYY-MM to Thai month label", () => {
    expect(formatMonth("2026-06")).toBe("มิ.ย. 2569")
  })
  it("converts Jan", () => {
    expect(formatMonth("2026-01")).toBe("ม.ค. 2569")
  })
})

describe("formatDate", () => {
  it("formats ISO date to Thai DD/MM/BBBB", () => {
    expect(formatDate("2026-06-30")).toBe("30/06/2569")
  })
  it("returns - for null/undefined", () => {
    expect(formatDate(null)).toBe("-")
    expect(formatDate(undefined)).toBe("-")
  })
  it("handles January correctly", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2569")
  })
})

describe("prevMonth", () => {
  it("returns previous month", () => {
    expect(prevMonth("2026-06")).toBe("2026-05")
  })
  it("wraps from January to December of previous year", () => {
    expect(prevMonth("2026-01")).toBe("2025-12")
  })
  it("returns previous month with zero-padding", () => {
    expect(prevMonth("2026-10")).toBe("2026-09")
  })
})

describe("computePayroll", () => {
  it("calculates netPay correctly", () => {
    const result = computePayroll({
      transportFee: 100000,
      ot: 5000,
      otherIncomeWHT: 2000,
      otherIncomeNoWHT: 1000,
      fuel: 10000,
      gps: 700,
      repairInHouse: 3000,
      repairOutside: 0,
      mgmtFee8pct: 240,
      labor: 200,
      tire: 500,
      tirePatch: 100,
      carWash: 150,
      taxInsurance: 800,
      installment: 15000,
      repairInstallment: 0,
      downPaymentInstallment: 0,
    })
    expect(result.totalIncome).toBe(108000)
    expect(result.totalDeductions).toBe(30690)
    expect(result.netPay).toBe(77310)
  })
})
