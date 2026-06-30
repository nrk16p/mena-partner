import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { nextMonth } from "@/lib/utils"

const DB = process.env.MONGO_DB ?? "mena_partner"

/**
 * POST /api/payroll/batch-create?month=YYYY-MM
 *
 * Auto-creates payroll entries for all active drivers that don't yet
 * have an entry for the given month. For each driver it:
 *   1. Looks up trip total for the month from the trips collection
 *   2. Looks up contract for installment + monthlyInsuranceFee
 *   3. Creates an entry with:
 *        transportFee = trip total
 *        mgmtFee8pct  = round(transportFee × 0.08, 2)
 *        installment  = contract.monthlyInstallment
 *        taxInsurance = contract.monthlyInsuranceFee
 *        tripCount    = count of trips for the month
 *        all other fields = 0
 *
 * Returns { created, skipped, errors }
 */
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const month = searchParams.get("month")?.trim() ?? ""
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 })
  }

  const [yearStr, monthStr] = month.split("-")
  const start = `${yearStr}-${monthStr.padStart(2, "0")}-01`
  const end   = `${nextMonth(month)}-01`

  const client = await clientPromise
  const db     = client.db(DB)

  // 1. All active drivers
  const drivers = await db.collection("drivers").find({ status: "active" }).toArray()

  // 2. Existing entries this month
  const existingEntries = await db.collection("payroll_entries")
    .find({ month }, { projection: { contractCode: 1 } }).toArray()
  const existingCodes = new Set(existingEntries.map((e) => e.contractCode as string))

  // 3. Drivers that need an entry
  const pending = drivers.filter((d) => !existingCodes.has(d.contractCode as string))
  if (pending.length === 0) {
    return NextResponse.json({ created: 0, skipped: drivers.length, errors: 0 })
  }

  const pendingCodes = pending.map((d) => d.contractCode as string)

  // 4. Trip aggregation for the month — include unique date count for workingDays
  const tripAgg = await db.collection("trips").aggregate([
    { $match: { contractCode: { $in: pendingCodes }, date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: "$contractCode",
        total: { $sum: "$tripFee" },
        count: { $sum: 1 },
        uniqueDates: { $addToSet: "$date" },
      },
    },
  ]).toArray()
  const tripMap = Object.fromEntries(tripAgg.map((t) => [
    t._id as string,
    { total: t.total as number, count: t.count as number, workingDays: (t.uniqueDates as string[]).length },
  ]))

  // 5. Contract lookup for installment + insurance
  const contracts = await db.collection("contracts")
    .find({ contractCode: { $in: pendingCodes } }, {
      projection: { contractCode: 1, monthlyInstallment: 1, monthlyInsuranceFee: 1 }
    }).toArray()
  const contractMap = Object.fromEntries(contracts.map((c) => [c.contractCode as string, c]))

  // 6. Build payroll entries
  const now = new Date().toISOString()
  const docs = pending.map((d) => {
    const code       = d.contractCode as string
    const trips      = tripMap[code]
    const contract   = contractMap[code]
    const transportFee  = trips?.total ?? 0
    const mgmtFee8pct   = Math.round(transportFee * 0.08 * 100) / 100
    const installment   = (contract?.monthlyInstallment as number) ?? 0
    const taxInsurance  = (contract?.monthlyInsuranceFee as number) ?? 0
    const totalIncome   = transportFee
    const totalDeductions = mgmtFee8pct + installment + taxInsurance
    return {
      contractCode: code,
      month,
      workingDays:  trips?.workingDays ?? 0,
      tripCount:    trips?.count ?? 0,
      transportFee,
      ot:                     0,
      otherIncomeWHT:         0,
      otherIncomeNoWHT:       0,
      fuel:                   0,
      gps:                    0,
      repairInHouse:          0,
      repairOutside:          0,
      mgmtFee8pct,
      labor:                  0,
      tire:                   0,
      tirePatch:              0,
      carWash:                0,
      taxInsurance,
      installment,
      repairInstallment:      0,
      downPaymentInstallment: 0,
      totalIncome,
      totalDeductions,
      netPay: totalIncome - totalDeductions,
      createdAt: now,
      updatedAt: now,
    }
  })

  let created = 0
  let errors  = 0
  for (const doc of docs) {
    try {
      await db.collection("payroll_entries").insertOne(doc)
      created++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ created, skipped: existingCodes.size, errors })
}
