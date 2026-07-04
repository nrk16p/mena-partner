import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

// Normalize a plate like "สบ.71-1959" → "71-1959" so callers can match
// plates extracted from free text against configured plates.
function normPlate(p: string): string {
  const m = String(p).match(/\d{2}-\d{4}/)
  return m ? m[0] : String(p).trim()
}

export async function GET() {
  const client = await clientPromise
  const db     = client.db(DB)
  const currentYear = new Date().getFullYear()

  const configs = await db
    .collection("promo_config")
    .find({ licensePlate: { $exists: true, $ne: "" } })
    .toArray()

  const contractCodes = configs
    .map((c) => String(c.contractCode ?? ""))
    .filter(Boolean)

  // Usage totals only exist for configs linked to a contractCode
  const repairAgg = contractCodes.length
    ? await db.collection("repair_claims").aggregate([
        { $match: { contractCode: { $in: contractCodes } } },
        { $group: { _id: "$contractCode", total: { $sum: "$amount" } } },
      ]).toArray()
    : []
  const repairMap = Object.fromEntries(repairAgg.map((r) => [r._id, r.total]))

  const pmAgg = contractCodes.length
    ? await db.collection("pm_records").aggregate([
        { $match: { contractCode: { $in: contractCodes }, year: currentYear } },
        { $group: { _id: "$contractCode", total: { $sum: "$amount" }, types: { $addToSet: "$type" } } },
      ]).toArray()
    : []
  const pmMap = Object.fromEntries(
    pmAgg.map((p) => [p._id, { total: p.total, types: p.types as string[] }])
  )

  const rows = configs.map((cfg) => {
    const code       = String(cfg.contractCode ?? "")
    const repairUsed = code ? (repairMap[code] ?? 0) : 0
    const pm         = code ? (pmMap[code] ?? { total: 0, types: [] }) : { total: 0, types: [] }
    const repairBudget = Number(cfg.repairBudget ?? 0)
    const annualPmCap  = Number(cfg.annualPmCap  ?? 0)
    return {
      plate:               normPlate(String(cfg.licensePlate)),
      licensePlate:        String(cfg.licensePlate),
      contractCode:        code,
      repairBudget,
      repairUsed,
      repairRemaining:     repairBudget - repairUsed,
      annualPmCap,
      pmUsedThisYear:      pm.total,
      pmRemainingThisYear: annualPmCap - pm.total,
      pm1UsedThisYear:     pm.types.includes("PM1"),
      pm2UsedThisYear:     pm.types.includes("PM2"),
    }
  })

  return NextResponse.json(rows)
}
