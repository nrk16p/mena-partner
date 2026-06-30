import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

type Alert = {
  type: "negative_pay" | "insurance_expired" | "insurance_expiring" | "repair_budget_critical"
  severity: "critical" | "warning" | "info"
  contractCode: string
  driverName: string
  message: string
  value?: string
}

export async function GET() {
  const client = await clientPromise
  const db     = client.db(DB)

  const alerts: Alert[] = []

  // Latest month with payroll entries
  const months = await db.collection("payroll_entries").distinct("month")
  months.sort((a: string, b: string) => b.localeCompare(a))
  const latestMonth = months[0] as string | undefined

  // Pre-load all driver names once (avoid N+1)
  const allDrivers = await db.collection("drivers").find({}, { projection: { contractCode: 1, driverName: 1 } }).toArray()
  const driverNameMap = Object.fromEntries(allDrivers.map((d) => [d.contractCode as string, d.driverName as string]))

  // 1. Negative net pay in latest month
  if (latestMonth) {
    const negativeEntries = await db
      .collection("payroll_entries")
      .find({ month: latestMonth, netPay: { $lt: 0 } })
      .sort({ netPay: 1 })
      .toArray()

    for (const e of negativeEntries) {
      const code = e.contractCode as string
      alerts.push({
        type: "negative_pay",
        severity: "warning",
        contractCode: code,
        driverName: driverNameMap[code] ?? code,
        message: `ยอดสุทธิติดลบ เดือน ${latestMonth}`,
        value: `${(e.netPay as number).toLocaleString("th-TH", { minimumFractionDigits: 0 })} บาท`,
      })
    }
  }

  // 2. Insurance: expired or expiring within 60 days (single query with $or)
  const today = new Date().toISOString().slice(0, 10)
  const in60  = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const insuranceContracts = await db
    .collection("contracts")
    .find(
      { taxExpiryDate: { $lte: in60 } },
      { projection: { contractCode: 1, driverName: 1, taxExpiryDate: 1 } }
    )
    .sort({ taxExpiryDate: 1 })
    .toArray()

  for (const c of insuranceContracts) {
    const expired = (c.taxExpiryDate as string) < today
    alerts.push({
      type: expired ? "insurance_expired" : "insurance_expiring",
      severity: expired ? "critical" : "warning",
      contractCode: c.contractCode as string,
      driverName: (c.driverName as string) ?? c.contractCode,
      message: expired ? "ประกันภัย/ภาษีหมดอายุแล้ว" : "ประกันภัย/ภาษีใกล้หมดอายุ",
      value: c.taxExpiryDate as string,
    })
  }

  // 3. Repair budget > 90% utilized
  const configs = await db
    .collection("promo_config")
    .find({ contractCode: { $exists: true, $ne: "" }, repairBudget: { $gt: 0 } })
    .toArray()

  const contractCodes = configs.map((c) => c.contractCode as string)
  const repairAgg = await db.collection("repair_claims").aggregate([
    { $match: { contractCode: { $in: contractCodes } } },
    { $group: { _id: "$contractCode", total: { $sum: "$amount" } } },
  ]).toArray()
  const repairMap = Object.fromEntries(repairAgg.map((r) => [r._id as string, r.total as number]))

  for (const cfg of configs) {
    const code = cfg.contractCode as string
    const used = repairMap[code] ?? 0
    const pct  = used / (cfg.repairBudget as number)
    if (pct >= 0.9) {
      alerts.push({
        type: "repair_budget_critical",
        severity: pct >= 1.0 ? "critical" : "warning",
        contractCode: code,
        driverName: driverNameMap[code] ?? code,
        message: `โปร 2 วงเงินซ่อมใกล้เต็ม (${Math.round(pct * 100)}%)`,
        value: `คงเหลือ ${((cfg.repairBudget as number) - used).toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`,
      })
    }
  }

  // Sort: critical first
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return NextResponse.json(alerts)
}
