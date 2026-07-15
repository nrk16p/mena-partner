import type { Db } from "mongodb"
import { nextMonth } from "@/lib/utils"
import { getInsuranceDeductionForPlate } from "@/lib/insurance-tax"
import { getLedgerDeductions } from "@/lib/driver-ledger"

export interface PayrollResult {
  contractCode: string
  month: string
  workingDays: number
  tripCount: number
  transportFee: number
  ot: number
  otherIncomeWHT: number
  otherIncomeNoWHT: number
  fuel: number
  gps: number
  repairInHouse: number
  repairOutside: number
  mgmtFee8pct: number
  labor: number
  tire: number
  tirePatch: number
  carWash: number
  taxInsurance: number
  installment: number
  repairInstallment: number
  downPaymentInstallment: number
  otherDeductWHT: number
  otherDeductNoWHT: number
  ledgerDeduction: number
  ledgerItems: { entryId: string; debtCode: string; label: string; amount: number }[]
  totalIncome: number
  totalDeductions: number
  netPay: number
}

/**
 * Calculate payroll for one contract/month from MongoDB source collections.
 * Returns null if the contract does not exist.
 */
export async function calculatePayrollEntry(
  db: Db,
  contractCode: string,
  month: string
): Promise<PayrollResult | null> {
  const start = `${month}-01`
  const end   = `${nextMonth(month)}-01`

  const [contract, tripAgg, fuelRec, gpsRec, repairRec, installRec, adjRec] = await Promise.all([
    db.collection("contracts").findOne(
      { contractCode },
      { projection: { taxMonthlyInstallment: 1, repairMonthlyInstallment: 1, monthlyInstallment: 1, licensePlate: 1 } }
    ),
    db.collection("trips").aggregate([
      { $match: { contractCode, date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$tripFee" },
          count: { $sum: 1 },
          uniqueDates: { $addToSet: "$date" },
        },
      },
    ]).toArray(),
    db.collection("fuel_records").findOne({ contractCode, month }),
    db.collection("gps_config").findOne({ contractCode }),
    db.collection("repair_monthly").findOne({ contractCode, month }),
    db.collection("installment_schedule").findOne({ contractCode }),
    db.collection("monthly_adjustments").findOne({ contractCode, month }),
  ])

  if (!contract) return null

  const trips       = tripAgg[0] ?? { total: 0, count: 0, uniqueDates: [] }
  const transportFee = trips.total as number
  const tripCount    = trips.count as number
  const workingDays  = (trips.uniqueDates as string[]).length

  const fuel             = (fuelRec?.deductionAmount as number) ?? 0
  const gps              = (gpsRec?.monthlyFee as number) ?? 700
  // ภาษี/ประกัน: หักตามรอบของทะเบียนรถ (vehicle_insurance_tax) — ทะเบียนที่ยังไม่มีข้อมูล
  // ในโมดูลใหม่ (null) fallback ไป field เดิมใน contract ช่วงเปลี่ยนผ่าน
  const cycleDeduction   = await getInsuranceDeductionForPlate(db, (contract.licensePlate as string) ?? "", month)
  const taxInsurance     = cycleDeduction ?? ((contract.taxMonthlyInstallment as number) ?? 0)
  const installment      = (installRec?.monthlyAmount as number) ?? (contract.monthlyInstallment as number) ?? 0
  const repairInstallment = (contract.repairMonthlyInstallment as number) ?? 0

  // In the Excel data model, `mgmtFee8pct` stores repair management fee (ค่าดำเนินการซ่อม),
  // NOT 8% of transport. repairInHouse stores parts cost only.
  const repairInHouse = (repairRec?.partsAmount as number) ?? 0
  const repairOutside = (repairRec?.outsideRepairAmount as number) ?? 0
  const labor         = (repairRec?.laborAmount as number) ?? 0
  const tire          = (repairRec?.tireAmount as number) ?? 0
  const tirePatch     = (repairRec?.tirePatchAmount as number) ?? 0
  const carWash       = (repairRec?.cleaningAmount as number) ?? 0
  const mgmtFee8pct   = (repairRec?.managementFee as number) ?? 0

  const ot               = (adjRec?.ot as number) ?? 0
  const otherIncomeWHT   = (adjRec?.otherIncomeWHT as number) ?? 0
  const otherIncomeNoWHT = (adjRec?.otherIncomeNoWHT as number) ?? 0
  const otherDeductWHT   = (adjRec?.otherDeductWHT as number) ?? 0
  const otherDeductNoWHT = (adjRec?.otherDeductNoWHT as number) ?? 0
  const downPaymentInstallment = 0

  // ledger กลาง (หนี้/เงินสะสม พขร.) — ยอดหักของเดือนนี้ตาม balance ปัจจุบัน
  const ledgerItems     = await getLedgerDeductions(db, contractCode, month)
  const ledgerDeduction = Math.round(ledgerItems.reduce((s, i) => s + i.amount, 0) * 100) / 100

  const totalIncome = transportFee + ot + otherIncomeWHT + otherIncomeNoWHT
  const totalDeductions =
    fuel + gps + repairInHouse + repairOutside + mgmtFee8pct +
    labor + tire + tirePatch + carWash +
    taxInsurance + installment + repairInstallment + downPaymentInstallment +
    otherDeductWHT + otherDeductNoWHT + ledgerDeduction

  return {
    contractCode,
    month,
    workingDays,
    tripCount,
    transportFee,
    ot,
    otherIncomeWHT,
    otherIncomeNoWHT,
    fuel,
    gps,
    repairInHouse,
    repairOutside,
    mgmtFee8pct,
    labor,
    tire,
    tirePatch,
    carWash,
    taxInsurance,
    installment,
    repairInstallment,
    downPaymentInstallment,
    otherDeductWHT,
    otherDeductNoWHT,
    ledgerDeduction,
    ledgerItems,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay: Math.round((totalIncome - totalDeductions) * 100) / 100,
  }
}
