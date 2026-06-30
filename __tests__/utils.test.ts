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
  it("formats large number", () => {
    expect(formatMoney(1234567.89)).toBe("1,234,567.89")
  })
  it("rounds to 2 decimal places", () => {
    expect(formatMoney(1.266)).toBe("1.27")
    expect(formatMoney(1.264)).toBe("1.26")
  })
})

describe("formatMonth", () => {
  it("converts YYYY-MM to Thai month label", () => {
    expect(formatMonth("2026-06")).toBe("มิ.ย. 2569")
  })
  it("converts Jan", () => {
    expect(formatMonth("2026-01")).toBe("ม.ค. 2569")
  })
  it("converts December", () => {
    expect(formatMonth("2025-12")).toBe("ธ.ค. 2568")
  })
  it("converts all 12 months", () => {
    const expected = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ]
    for (let i = 1; i <= 12; i++) {
      const m = String(i).padStart(2, "0")
      expect(formatMonth(`2026-${m}`)).toContain(expected[i - 1])
    }
  })
  it("adds 543 to year for Buddhist era", () => {
    expect(formatMonth("2000-01")).toBe("ม.ค. 2543")
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
  it("handles December 31", () => {
    expect(formatDate("2025-12-31")).toBe("31/12/2568")
  })
  it("pads single-digit day and month", () => {
    expect(formatDate("2026-03-05")).toBe("05/03/2569")
  })
  it("returns - for empty string", () => {
    expect(formatDate("")).toBe("-")
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
  it("handles February → January", () => {
    expect(prevMonth("2026-02")).toBe("2026-01")
  })
  it("handles year wrap Dec→Nov same year", () => {
    expect(prevMonth("2026-12")).toBe("2026-11")
  })
  it("handles year 2000 January wrap", () => {
    expect(prevMonth("2000-01")).toBe("1999-12")
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

  it("returns zero for all-zero inputs", () => {
    const result = computePayroll({
      transportFee: 0,
      ot: 0,
      otherIncomeWHT: 0,
      otherIncomeNoWHT: 0,
      fuel: 0,
      gps: 0,
      repairInHouse: 0,
      repairOutside: 0,
      mgmtFee8pct: 0,
      labor: 0,
      tire: 0,
      tirePatch: 0,
      carWash: 0,
      taxInsurance: 0,
      installment: 0,
      repairInstallment: 0,
      downPaymentInstallment: 0,
    })
    expect(result.totalIncome).toBe(0)
    expect(result.totalDeductions).toBe(0)
    expect(result.netPay).toBe(0)
  })

  it("produces negative netPay when deductions exceed income", () => {
    const result = computePayroll({
      transportFee: 5000,
      ot: 0,
      otherIncomeWHT: 0,
      otherIncomeNoWHT: 0,
      fuel: 0,
      gps: 0,
      repairInHouse: 0,
      repairOutside: 0,
      mgmtFee8pct: 400,
      labor: 0,
      tire: 0,
      tirePatch: 0,
      carWash: 0,
      taxInsurance: 1500,
      installment: 8000,
      repairInstallment: 0,
      downPaymentInstallment: 0,
    })
    expect(result.totalIncome).toBe(5000)
    expect(result.totalDeductions).toBe(9900)
    expect(result.netPay).toBe(-4900)
  })

  it("sums all income fields correctly", () => {
    const result = computePayroll({
      transportFee: 10000,
      ot: 2000,
      otherIncomeWHT: 500,
      otherIncomeNoWHT: 300,
      fuel: 0, gps: 0, repairInHouse: 0, repairOutside: 0,
      mgmtFee8pct: 0, labor: 0, tire: 0, tirePatch: 0,
      carWash: 0, taxInsurance: 0, installment: 0,
      repairInstallment: 0, downPaymentInstallment: 0,
    })
    expect(result.totalIncome).toBe(12800)
  })

  it("sums all deduction fields correctly", () => {
    const result = computePayroll({
      transportFee: 50000, ot: 0, otherIncomeWHT: 0, otherIncomeNoWHT: 0,
      fuel: 1000,
      gps: 200,
      repairInHouse: 300,
      repairOutside: 400,
      mgmtFee8pct: 4000,
      labor: 100,
      tire: 500,
      tirePatch: 50,
      carWash: 80,
      taxInsurance: 600,
      installment: 10000,
      repairInstallment: 200,
      downPaymentInstallment: 300,
    })
    expect(result.totalDeductions).toBe(17730)
    expect(result.netPay).toBe(50000 - 17730)
  })

  it("netPay equals totalIncome minus totalDeductions", () => {
    const result = computePayroll({
      transportFee: 75000, ot: 3000, otherIncomeWHT: 0, otherIncomeNoWHT: 500,
      fuel: 5000, gps: 700, repairInHouse: 0, repairOutside: 1200,
      mgmtFee8pct: 6000, labor: 0, tire: 0, tirePatch: 0,
      carWash: 100, taxInsurance: 1200, installment: 12000,
      repairInstallment: 0, downPaymentInstallment: 0,
    })
    expect(result.netPay).toBe(result.totalIncome - result.totalDeductions)
  })
})

describe("mgmtFee8pct auto-calculation (contract)", () => {
  it("8% of transportFee equals expected amount", () => {
    const transportFee = 100000
    const mgmtFee8pct = Math.round(transportFee * 0.08 * 100) / 100
    expect(mgmtFee8pct).toBe(8000)
  })

  it("8% rounds correctly for fractional results", () => {
    const transportFee = 33333
    const mgmtFee8pct = Math.round(transportFee * 0.08 * 100) / 100
    expect(mgmtFee8pct).toBe(2666.64)
  })

  it("8% of zero is zero", () => {
    const mgmtFee8pct = Math.round(0 * 0.08 * 100) / 100
    expect(mgmtFee8pct).toBe(0)
  })
})

function nextMonthYear(year: number, mon: number): { ny: number; nm: number; str: string } {
  const ny = mon === 12 ? year + 1 : year
  const nm = mon === 12 ? 1 : mon + 1
  return { ny, nm, str: `${ny}-${String(nm).padStart(2, "0")}-01` }
}

describe("nextMonth boundary (batch-create date logic)", () => {
  it("December wraps to January of next year", () => {
    const { ny, nm, str } = nextMonthYear(2025, 12)
    expect(ny).toBe(2026)
    expect(nm).toBe(1)
    expect(str).toBe("2026-01-01")
  })

  it("Non-December month increments within same year", () => {
    const { ny, nm, str } = nextMonthYear(2026, 6)
    expect(ny).toBe(2026)
    expect(nm).toBe(7)
    expect(str).toBe("2026-07-01")
  })

  it("November increments to December same year", () => {
    const { ny, nm } = nextMonthYear(2026, 11)
    expect(ny).toBe(2026)
    expect(nm).toBe(12)
  })
})
