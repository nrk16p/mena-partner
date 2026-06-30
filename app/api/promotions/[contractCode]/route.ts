import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

type Ctx = { params: Promise<{ contractCode: string }> }

export async function GET(
  _req: Request,
  { params }: Ctx
) {
  const { contractCode } = await params
  const client = await clientPromise
  const db = client.db(DB)
  const currentYear = new Date().getFullYear()

  const cfg = await db.collection("promo_config").findOne({ contractCode })
  if (!cfg) return NextResponse.json({ error: "not found" }, { status: 404 })

  const driver = await db.collection("drivers").findOne({ contractCode })

  const repairClaims = await db
    .collection("repair_claims")
    .find({ contractCode })
    .sort({ date: -1 })
    .toArray()

  const pmRecords = await db
    .collection("pm_records")
    .find({ contractCode })
    .sort({ year: -1, date: -1 })
    .toArray()

  const repairUsed = repairClaims.reduce((s, c) => s + (c.amount ?? 0), 0)
  const pmThisYear = pmRecords.filter((p) => p.year === currentYear)
  const pmUsedThisYear = pmThisYear.reduce((s, p) => s + (p.amount ?? 0), 0)
  const pm1Used = pmThisYear.some((p) => p.type === "PM1")
  const pm2Used = pmThisYear.some((p) => p.type === "PM2")

  const toPlain = (doc: Record<string, unknown>) => ({
    ...doc,
    _id: doc._id?.toString(),
  })

  return NextResponse.json({
    contractCode,
    licensePlate: cfg.licensePlate ?? "",
    driverName: driver?.driverName ?? "",
    truckNumber: driver?.truckNumber ?? "",
    repairBudget: cfg.repairBudget ?? 0,
    pmOilCost: cfg.pmOilCost ?? 0,
    repairUsed,
    repairRemaining: (cfg.repairBudget ?? 0) - repairUsed,
    annualPmCap: cfg.annualPmCap ?? 0,
    pmUsedThisYear,
    pmRemainingThisYear: (cfg.annualPmCap ?? 0) - pmUsedThisYear,
    pm1UsedThisYear: pm1Used,
    pm2UsedThisYear: pm2Used,
    repairClaims: repairClaims.map(toPlain),
    pmRecords: pmRecords.map(toPlain),
  })
}
