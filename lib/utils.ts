import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { PayrollDeductionFields, PayrollIncomeFields, PayrollComputed } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

export function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-").map(Number)
  const thaiYear = year + 543
  return `${THAI_MONTHS[month - 1]} ${thaiYear}`
}

export function computePayroll(
  fields: PayrollIncomeFields & PayrollDeductionFields
): PayrollComputed {
  const totalIncome =
    fields.transportFee +
    fields.ot +
    fields.otherIncomeWHT +
    fields.otherIncomeNoWHT

  const totalDeductions =
    fields.fuel +
    fields.gps +
    fields.repairInHouse +
    fields.repairOutside +
    fields.mgmtFee8pct +
    fields.labor +
    fields.tire +
    fields.tirePatch +
    fields.carWash +
    fields.taxInsurance +
    fields.installment +
    fields.repairInstallment +
    fields.downPaymentInstallment

  return { totalIncome, totalDeductions, netPay: totalIncome - totalDeductions }
}
