import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET() {
  const client = await clientPromise
  const db = client.db(DB)
  const currentYear = new Date().getFullYear()

  // All promo configs that have a contractCode
  const configs = await db
    .collection("promo_config")
    .find({ contractCode: { $exists: true, $ne: "" } })
    .sort({ contractCode: 1 })
    .toArray()

  const contractCodes = configs.map((c) => c.contractCode as string)

  // Batch fetch drivers
  const drivers = await db
    .collection("drivers")
    .find({ contractCode: { $in: contractCodes } })
    .toArray()
  const driverMap = Object.fromEntries(drivers.map((d) => [d.contractCode, d]))

  // Batch fetch repair claim totals
  const repairAgg = await db
    .collection("repair_claims")
    .aggregate([
      { $match: { contractCode: { $in: contractCodes } } },
      { $group: { _id: "$contractCode", total: { $sum: "$amount" } } },
    ])
    .toArray()
  const repairMap = Object.fromEntries(repairAgg.map((r) => [r._id, r.total]))

  // Batch fetch PM totals this year + coupon status
  const pmAgg = await db
    .collection("pm_records")
    .aggregate([
      { $match: { contractCode: { $in: contractCodes }, year: currentYear } },
      {
        $group: {
          _id: "$contractCode",
          total: { $sum: "$amount" },
          types: { $addToSet: "$type" },
        },
      },
    ])
    .toArray()
  const pmMap = Object.fromEntries(
    pmAgg.map((p) => [p._id, { total: p.total, types: p.types as string[] }])
  )

  const rows = configs.map((cfg) => {
    const code = cfg.contractCode as string
    const driver = driverMap[code] ?? {}
    const repairUsed = repairMap[code] ?? 0
    const pm = pmMap[code] ?? { total: 0, types: [] }
    return {
      contractCode: code,
      licensePlate: cfg.licensePlate ?? "",
      driverName: driver.driverName ?? "",
      truckNumber: driver.truckNumber ?? "",
      repairBudget: cfg.repairBudget ?? 0,
      repairUsed,
      repairRemaining: (cfg.repairBudget ?? 0) - repairUsed,
      annualPmCap: cfg.annualPmCap ?? 0,
      pmUsedThisYear: pm.total,
      pmRemainingThisYear: (cfg.annualPmCap ?? 0) - pm.total,
      pm1UsedThisYear: pm.types.includes("PM1"),
      pm2UsedThisYear: pm.types.includes("PM2"),
    }
  })

  return NextResponse.json(rows)
}
